declare const spindle: import("lumiverse-spindle-types").SpindleAPI

import { sysPrompt, buildUserPrompt, findProfile, type Profile } from "./profiles"
import { spliceRewrite } from "./align"
import { DEFAULT_CONFIG, type RewriteConfig, type FrontendMsg, type DebugEntry } from "./types"
import { stripWrappingQuotes } from "./quotes"

const CONFIG_FILE = "config.json"
const LLM_TIMEOUT_MS = 120_000

let configCache: RewriteConfig | null = null

const autoInFlight = new Set<string>()
const activeAborts = new Set<AbortController>()

// ── Debug ring buffer ───────────────────────────────────────────────────────
const DEBUG_MAX = 50
const debugLog: DebugEntry[] = []
function pushDebug(e: DebugEntry) {
  debugLog.push(e)
  if (debugLog.length > DEBUG_MAX) debugLog.shift()
}

async function loadConfig(): Promise<RewriteConfig> {
  if (!configCache) {
    // Merge over defaults so a config persisted before new fields existed still
    // gets sane values for them (forward-compatible migration).
    const stored = await spindle.storage.getJson<Partial<RewriteConfig>>(CONFIG_FILE, { fallback: {} })
    configCache = { ...DEFAULT_CONFIG, ...stored }
  }
  return configCache
}

// Global undo/redo history (across all messages, in apply order) — matches the original's
// hist[]/redo[] stacks. Each entry records one apply's before/after so undo/redo can walk
// the chain, with an optimistic-concurrency check so neither ever clobbers an edit the user
// (or another tool) made since.
const HISTORY_FILE = "history.json"
interface HistEntry { chatId: string; messageId: string; prev: string; applied: string }
interface History { undo: HistEntry[]; redo: HistEntry[] }

async function loadHistory(): Promise<History> {
  return await spindle.storage.getJson<History>(HISTORY_FILE, { fallback: { undo: [], redo: [] } })
}
async function saveHistory(h: History): Promise<void> {
  await spindle.storage.setJson(HISTORY_FILE, h)
}

// ── Context injection ───────────────────────────────────────────────────────
// Ports the original's reference blocks onto Lumiverse's native APIs. Each source is
// gated by a config flag and wrapped in try/catch so a missing permission (or any error)
// simply skips that block — context never breaks a rewrite.

const SPEAKER_USER =
  "<speaker>The selected passage is the USER's own words. Edit in the user's voice and register, not a character's.</speaker>"
const SPEAKER_CHAR =
  "<speaker>The selected passage is a CHARACTER's voice. Keep that character's voice, register, and mannerisms.</speaker>"

function clip(s: string, n: number): string {
  const t = (s || "").trim()
  return t.length > n ? t.slice(0, n).trimEnd() + "…" : t
}

// Resolve a Profile the same way `rewrite` does: custom prompt → auto profile →
// built-in → saved custom profile → raw id as the prompt itself.
function resolveProfile(cfg: RewriteConfig, profileId: string, customPrompt?: string): Profile {
  const customProf = cfg.customProfiles.find((p) => p.id === profileId)
  const autoProf = profileId.startsWith("auto:") ? cfg.autoProfiles[profileId.slice(5)] : undefined
  return customPrompt
    ? { id: "custom", name: "Custom", order: -1, prompt: customPrompt }
    : autoProf
      ? { id: profileId, name: autoProf.name, order: -1, prompt: autoProf.prompt }
      : findProfile(profileId)
        ?? (customProf
          ? { id: customProf.id, name: customProf.name, order: -1, prompt: customProf.prompt }
          : { id: "custom", name: "Custom", order: -1, prompt: profileId })
}

// Builds the reference blocks as LABELED entries, in the same order they were
// appended before. `assembleContext` joins these with "\n\n" to produce the
// byte-identical string the rewrite paths consume; the token-cost preview reads
// the labels to attribute cost per source. The block-building logic is unchanged.
async function assembleContextBlocks(
  cfg: RewriteConfig,
  anchor: { chatId?: string; messageId?: string; characterId?: string },
  userId: string,
): Promise<{ label: string; text: string }[]> {
  const blocks: { label: string; text: string }[] = []
  const { chatId, messageId, characterId } = anchor

  if (cfg.useCharCard && characterId) {
    try {
      const c = await spindle.characters.get(characterId, userId)
      if (c) {
        const parts = [`Name: ${c.name}`]
        if (clip(c.personality, 1)) parts.push(`Personality: ${clip(c.personality, 300)}`)
        if (clip(c.description, 1)) parts.push(`Description: ${clip(c.description, 300)}`)
        blocks.push({ label: "character", text: `<character>\n${parts.join("\n")}\n</character>` })
      }
    } catch (err: any) {
      spindle.log.warn(`character context skipped: ${err?.message}`)
    }
  }

  // Messages-derived context (previous messages, target role for speaker/persona).
  let targetRole: string | null = null
  if (chatId && messageId && (cfg.usePrevMessages || cfg.speakerAware || cfg.useUserPersona)) {
    try {
      const msgs = (await spindle.chat.getMessages(chatId)) as Array<{ id: string; role: string; content: string }>
      const idx = msgs.findIndex((m) => m.id === messageId)
      if (idx >= 0) {
        targetRole = (msgs[idx].role || "").toLowerCase()
        if (cfg.usePrevMessages) {
          const n = Math.max(1, Math.min(4, cfg.prevMessageCount || 2))
          const prev = msgs.slice(Math.max(0, idx - n), idx)
          if (prev.length) {
            const lines = prev.map((m) => `${(m.role || "?").toUpperCase()}: ${clip(m.content, 300)}`)
            blocks.push({ label: "context", text: `<context>\n${lines.join("\n")}\n</context>` })
          }
        }
      }
    } catch (err: any) {
      spindle.log.warn(`message context skipped: ${err?.message}`)
    }
  }

  if (cfg.useUserPersona && targetRole === "user") {
    try {
      const p = (await spindle.personas.getActive(userId)) ?? (await spindle.personas.getDefault(userId))
      if (p) {
        const parts = [`Name: ${p.name}`]
        if (clip(p.title, 1)) parts.push(`Title: ${clip(p.title, 120)}`)
        if (clip(p.description, 1)) parts.push(`Description: ${clip(p.description, 300)}`)
        blocks.push({ label: "persona", text: `<persona note="This is the human user's own persona. When rewriting their message, preserve their voice, register, and mannerisms.">\n${parts.join("\n")}\n</persona>` })
      }
    } catch (err: any) {
      spindle.log.warn(`persona context skipped: ${err?.message}`)
    }
  }

  if (cfg.speakerAware && targetRole) {
    blocks.push({ label: "speaker", text: targetRole === "user" ? SPEAKER_USER : SPEAKER_CHAR })
  }

  if (cfg.useLorebook && chatId) {
    try {
      const activated = await spindle.world_books.getActivated(chatId, userId)
      const entryTexts: string[] = []
      let loreChars = 0
      for (const a of (activated || []).slice(0, 20)) {
        if (loreChars > 2000) break
        try {
          const entry = await spindle.world_books.entries.get(a.id, userId)
          const c = clip(entry?.content ?? "", 400)
          if (c) {
            const key = (entry?.key && entry.key[0]) || a.comment || ""
            entryTexts.push(key ? `${key}: ${c}` : c)
            loreChars += c.length
          }
        } catch {
          // skip a single bad/inaccessible entry
        }
      }
      if (entryTexts.length) blocks.push({ label: "lore", text: `<lore>\n${entryTexts.join("\n")}\n</lore>` })
    } catch (err: any) {
      spindle.log.warn(`lore context skipped: ${err?.message}`)
    }
  }

  if (cfg.useMemory && chatId) {
    try {
      const mem = await spindle.memories.chatMemory.get(chatId, { topK: 8, userId })
      if (mem?.enabled && clip(mem.formatted, 1)) {
        blocks.push({ label: "memory", text: `<memory>\n${clip(mem.formatted, 1500)}\n</memory>` })
      }
    } catch (err: any) {
      spindle.log.warn(`memory context skipped: ${err?.message}`)
    }
  }

  return blocks
}

async function assembleContext(
  cfg: RewriteConfig,
  anchor: { chatId?: string; messageId?: string; characterId?: string },
  userId: string,
): Promise<string> {
  return (await assembleContextBlocks(cfg, anchor, userId)).map((b) => b.text).join("\n\n")
}

spindle.onFrontendMessage(async (raw: unknown, userId: string) => {
  const msg = raw as FrontendMsg
  switch (msg.type) {
    case "get_config": {
      try {
        spindle.sendToFrontend({ type: "config", config: await loadConfig() })
      } catch (err: any) {
        spindle.log.error(`get_config failed: ${err?.message}`)
        spindle.sendToFrontend({ type: "config", config: DEFAULT_CONFIG })
      }
      break
    }

    case "update_config": {
      const next = { ...(await loadConfig()), ...msg.config }
      configCache = next
      try {
        await spindle.storage.setJson(CONFIG_FILE, next)
      } catch (err: any) {
        spindle.log.error(`update_config persist failed: ${err?.message}`)
      }
      // Always reply so the UI never hangs, even if persistence failed.
      spindle.sendToFrontend({ type: "config", config: next })
      break
    }

    case "preview_tokens": {
      if (!msg.text.trim()) {
        spindle.sendToFrontend({ type: "token_estimate", total: 0, system: 0, selection: 0, sources: [] })
        break
      }
      try {
        const cfg = await loadConfig()
        const profile = resolveProfile(cfg, msg.profileId, msg.customPrompt)
        const blocks = await assembleContextBlocks(
          cfg,
          { chatId: msg.chatId, messageId: msg.messageId, characterId: msg.characterId },
          userId,
        )
        const context = blocks.map((b) => b.text).join("\n\n")
        const sys = sysPrompt(msg.concise)
        const userPrompt = buildUserPrompt(profile, msg.text, msg.lengthPct, context)
        // ponytail: ~N countMessages calls per preview; debounced on the frontend so it's fine.
        const total = (await spindle.tokens.countMessages(
          [{ role: "system", content: sys }, { role: "user", content: userPrompt }],
          { userId },
        )).total_tokens
        const system = (await spindle.tokens.countMessages([{ role: "system", content: sys }], { userId })).total_tokens
        const selection = (await spindle.tokens.countMessages([{ role: "user", content: msg.text }], { userId })).total_tokens
        const sources: { label: string; tokens: number }[] = []
        for (const b of blocks) {
          const tokens = (await spindle.tokens.countMessages([{ role: "user", content: b.text }], { userId })).total_tokens
          sources.push({ label: b.label, tokens })
        }
        spindle.sendToFrontend({ type: "token_estimate", total, system, selection, sources })
      } catch (err: any) {
        spindle.log.warn(`preview_tokens failed: ${err?.message}`)
        spindle.sendToFrontend({ type: "token_estimate", total: 0, system: 0, selection: 0, sources: [] })
      }
      break
    }

    case "rewrite": {
      let _debugCfg: RewriteConfig | null = null
      let _debugProfile = ""
      let _debugPromptChars = 0
      let _debugT0 = 0
      try {
        if (!msg.connectionId) {
          spindle.sendToFrontend({ type: "rewrite_error", error: "No model connection selected." })
          break
        }
        if (!msg.text.trim()) {
          spindle.sendToFrontend({ type: "rewrite_error", error: "Nothing to rewrite — the input is empty." })
          break
        }
        const cfg = await loadConfig()
        _debugCfg = cfg
        const profile = resolveProfile(cfg, msg.profileId, msg.customPrompt)
        _debugProfile = profile.id

        const context = await assembleContext(
          cfg,
          { chatId: msg.chatId, messageId: msg.messageId, characterId: msg.characterId },
          userId,
        )
        spindle.log.info(`rewrite: profile=${profile.id} context=${context.length}c`)

        const messages = [
          { role: "system" as const, content: sysPrompt(msg.concise) },
          { role: "user" as const, content: buildUserPrompt(profile, msg.text, msg.lengthPct, context) },
        ]
        let promptTokens = 0
        try {
          promptTokens = (await spindle.tokens.countMessages(messages, { userId })).total_tokens
        } catch (e: any) {
          spindle.log.warn(`token count skipped: ${e?.message}`)
        }

        _debugPromptChars = messages[1].content.length
        _debugT0 = Date.now()
        const ac = new AbortController()
        activeAborts.add(ac)
        let result: unknown
        try {
          result = await spindle.generate.quiet({
            type: "quiet",
            userId, // required for operator-scoped extensions (the requesting user)
            connection_id: msg.connectionId,
            messages,
            parameters: { temperature: 0.7, top_p: 0.9 },
            reasoning: { source: "off" },
            signal: AbortSignal.any([ac.signal, AbortSignal.timeout(LLM_TIMEOUT_MS)]),
          })
        } finally {
          activeAborts.delete(ac)
        }
        const content = (result as Record<string, unknown>)?.content
        const text = stripWrappingQuotes(typeof content === "string" ? content.trim() : "")
        if (!text) {
          spindle.sendToFrontend({ type: "rewrite_error", error: "Model returned an empty rewrite." })
          break
        }
        if (cfg.debug) pushDebug({ ts: Date.now(), profile: profile.id, promptChars: _debugPromptChars, outputChars: text.length, tokens: promptTokens, ms: Date.now() - _debugT0 })
        spindle.sendToFrontend({ type: "rewrite_result", text, tokens: promptTokens })
      } catch (err: any) {
        if (err?.name === "AbortError") {
          spindle.sendToFrontend({ type: "rewrite_cancelled" })
          break
        }
        spindle.log.error(`rewrite failed: ${err?.message}`)
        if (_debugCfg?.debug && _debugT0) pushDebug({ ts: Date.now(), profile: _debugProfile, promptChars: _debugPromptChars, outputChars: 0, tokens: 0, ms: Date.now() - _debugT0, error: err?.message })
        spindle.sendToFrontend({ type: "rewrite_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "rewrite_multi": {
      try {
        if (!msg.connectionId) {
          spindle.sendToFrontend({ type: "rewrite_error", error: "No model connection selected." })
          break
        }
        if (!msg.segments?.length) {
          spindle.sendToFrontend({ type: "rewrite_error", error: "Nothing to rewrite — no segments." })
          break
        }
        const cfg = await loadConfig()
        // Resolve the profile ONCE — same resolution as the single `rewrite` case.
        const profile = resolveProfile(cfg, msg.profileId, msg.customPrompt)

        const sys = sysPrompt(msg.concise)
        const out: { messageId: string; output: string }[] = []
        // ponytail: re-assembles chat-level context per segment; fine for typical 2-3 message selections
        let totalPromptTokens = 0
        let cancelled = false
        for (const seg of msg.segments) {
          const context = await assembleContext(
            cfg,
            { chatId: msg.chatId, messageId: seg.messageId, characterId: msg.characterId },
            userId,
          )
          const messages = [
            { role: "system" as const, content: sys },
            { role: "user" as const, content: buildUserPrompt(profile, seg.text, msg.lengthPct, context) },
          ]
          try {
            totalPromptTokens += (await spindle.tokens.countMessages(messages, { userId })).total_tokens
          } catch (e: any) {
            spindle.log.warn(`token count skipped: ${e?.message}`)
          }
          const ac = new AbortController()
          activeAborts.add(ac)
          let result: unknown
          try {
            result = await spindle.generate.quiet({
              type: "quiet",
              userId, // required for operator-scoped extensions (the requesting user)
              connection_id: msg.connectionId,
              messages,
              parameters: { temperature: 0.7, top_p: 0.9 },
              reasoning: { source: "off" },
              signal: AbortSignal.any([ac.signal, AbortSignal.timeout(LLM_TIMEOUT_MS)]),
            })
          } catch (segErr: any) {
            activeAborts.delete(ac)
            if (segErr?.name === "AbortError") {
              cancelled = true
              break
            }
            throw segErr
          } finally {
            activeAborts.delete(ac)
          }
          const content = (result as Record<string, unknown>)?.content
          const text = stripWrappingQuotes(typeof content === "string" ? content.trim() : "")
          // Skip empty model outputs — apply_multi filters by output presence, so an empty
          // segment simply won't be applied (never corrupts).
          if (text) out.push({ messageId: seg.messageId, output: text })
        }
        if (cancelled) {
          spindle.sendToFrontend({ type: "rewrite_cancelled" })
          break
        }
        if (!out.length) {
          spindle.sendToFrontend({ type: "rewrite_error", error: "Model returned empty rewrites for every segment." })
          break
        }
        spindle.sendToFrontend({ type: "rewrite_multi_result", segments: out, tokens: totalPromptTokens || undefined })
      } catch (err: any) {
        if (err?.name === "AbortError") {
          spindle.sendToFrontend({ type: "rewrite_cancelled" })
          break
        }
        spindle.log.error(`rewrite_multi failed: ${err?.message}`)
        spindle.sendToFrontend({ type: "rewrite_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "apply": {
      try {
        if (!spindle.permissions.has("chat_mutation")) {
          spindle.sendToFrontend({ type: "apply_error", error: "Missing chat_mutation permission." })
          break
        }
        const msgs = (await spindle.chat.getMessages(msg.chatId)) as Array<{ id: string; content: string }>
        const target = msgs.find((m) => m.id === msg.messageId)
        if (!target) {
          spindle.sendToFrontend({ type: "apply_error", error: "Target message not found." })
          break
        }
        const newContent = spliceRewrite(target.content, msg.R, msg.rs, msg.re, msg.output)
        if (newContent === null) {
          spindle.sendToFrontend({
            type: "apply_error",
            error: "Couldn't locate the selection in the message. Copy the output and edit manually.",
          })
          break
        }
        await spindle.chat.updateMessage(msg.chatId, msg.messageId, { content: newContent })
        // Push onto the global undo stack; applying clears redo.
        const cfg = await loadConfig()
        const cap = Math.max(1, Math.min(100, cfg.historyDepth || 30))
        const hist = await loadHistory()
        hist.undo.push({ chatId: msg.chatId, messageId: msg.messageId, prev: target.content, applied: newContent })
        while (hist.undo.length > cap) hist.undo.shift()
        hist.redo = []
        await saveHistory(hist)
        spindle.sendToFrontend({ type: "apply_done", messageId: msg.messageId, canUndo: hist.undo.length > 0, canRedo: false })
        spindle.log.info(`Rewrite applied to message ${msg.messageId.slice(0, 8)}`)
      } catch (err: any) {
        spindle.log.error(`apply failed: ${err?.message}`)
        spindle.sendToFrontend({ type: "apply_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "apply_multi": {
      try {
        if (!spindle.permissions.has("chat_mutation")) {
          spindle.sendToFrontend({ type: "apply_error", error: "Missing chat_mutation permission." })
          break
        }
        const msgs = (await spindle.chat.getMessages(msg.chatId)) as Array<{ id: string; content: string }>
        const multiCfg = await loadConfig()
        const multiCap = Math.max(1, Math.min(100, multiCfg.historyDepth || 30))
        const hist = await loadHistory()
        const skipped: string[] = []
        let applied = 0
        for (const item of msg.items) {
          // Use the freshest content per message — re-find the target each iteration so
          // independent segments never read stale content. (Distinct messages here, but
          // this is the safe pattern regardless.)
          const target = msgs.find((m) => m.id === item.messageId)
          if (!target) { skipped.push(item.messageId); continue }
          // EVERY splice goes through spliceRewrite — a null return means SKIP+report,
          // never write. This is the authoritative corruption guard.
          const nc = spliceRewrite(target.content, item.R, item.rs, item.re, item.output)
          if (nc === null) { skipped.push(item.messageId); continue }
          await spindle.chat.updateMessage(msg.chatId, item.messageId, { content: nc })
          hist.undo.push({ chatId: msg.chatId, messageId: item.messageId, prev: target.content, applied: nc })
          while (hist.undo.length > multiCap) hist.undo.shift()
          // Reflect the new content locally so any later item targeting the same message
          // (defensive — items are distinct messages) sees the freshest content.
          target.content = nc
          applied++
        }
        // Clear redo once, only if we actually applied something (matches single-apply semantics:
        // a fully-skipped apply makes no mutation, so leave history untouched).
        if (applied > 0) {
          hist.redo = []
          await saveHistory(hist)
        }
        spindle.sendToFrontend({
          type: "apply_multi_done",
          applied,
          skipped,
          canUndo: hist.undo.length > 0,
          canRedo: false,
        })
        spindle.log.info(`Multi-rewrite applied to ${applied} message(s), skipped ${skipped.length}`)
      } catch (err: any) {
        spindle.log.error(`apply_multi failed: ${err?.message}`)
        spindle.sendToFrontend({ type: "apply_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "undo": {
      try {
        const hist = await loadHistory()
        if (!hist.undo.length) {
          spindle.sendToFrontend({ type: "undo_error", error: "Nothing to undo." })
          break
        }
        const entry = hist.undo[hist.undo.length - 1]
        const msgs = (await spindle.chat.getMessages(entry.chatId)) as Array<{ id: string; content: string }>
        const target = msgs.find((m) => m.id === entry.messageId)
        if (!target) {
          spindle.sendToFrontend({ type: "undo_error", error: "That message no longer exists." })
          break
        }
        // Optimistic concurrency: only revert if the live message is still what we applied.
        if (target.content !== entry.applied) {
          spindle.sendToFrontend({ type: "undo_error", error: "Message changed since the rewrite; undo skipped to protect your edits." })
          break
        }
        hist.undo.pop()
        hist.redo.push(entry)
        await spindle.chat.updateMessage(entry.chatId, entry.messageId, { content: entry.prev })
        await saveHistory(hist)
        spindle.sendToFrontend({ type: "undo_done", messageId: entry.messageId, canUndo: hist.undo.length > 0, canRedo: hist.redo.length > 0 })
      } catch (err: any) {
        spindle.log.error(`undo failed: ${err?.message}`)
        spindle.sendToFrontend({ type: "undo_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "redo": {
      try {
        const hist = await loadHistory()
        if (!hist.redo.length) {
          spindle.sendToFrontend({ type: "redo_error", error: "Nothing to redo." })
          break
        }
        const entry = hist.redo[hist.redo.length - 1]
        const msgs = (await spindle.chat.getMessages(entry.chatId)) as Array<{ id: string; content: string }>
        const target = msgs.find((m) => m.id === entry.messageId)
        if (!target) {
          spindle.sendToFrontend({ type: "redo_error", error: "That message no longer exists." })
          break
        }
        // Only re-apply if the message is still in the post-undo state we expect.
        if (target.content !== entry.prev) {
          spindle.sendToFrontend({ type: "redo_error", error: "Message changed since the undo; redo skipped to protect your edits." })
          break
        }
        hist.redo.pop()
        hist.undo.push(entry)
        await spindle.chat.updateMessage(entry.chatId, entry.messageId, { content: entry.applied })
        await saveHistory(hist)
        spindle.sendToFrontend({ type: "redo_done", messageId: entry.messageId, canUndo: hist.undo.length > 0, canRedo: hist.redo.length > 0 })
      } catch (err: any) {
        spindle.log.error(`redo failed: ${err?.message}`)
        spindle.sendToFrontend({ type: "redo_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "get_history": {
      const hist = await loadHistory()
      spindle.sendToFrontend({ type: "history", canUndo: hist.undo.length > 0, canRedo: hist.redo.length > 0 })
      break
    }

    case "get_connections": {
      try {
        const conns = await spindle.connections.list(userId)
        spindle.sendToFrontend({ type: "connections", connections: conns.map(c => ({ id: c.id, name: c.name, model: c.model })) })
      } catch (err: any) {
        spindle.log.warn(`connections list failed: ${err?.message}`)
        spindle.sendToFrontend({ type: "connections", connections: [] })
      }
      break
    }

    case "refine_prompt": {
      try {
        if (!msg.connectionId) {
          spindle.sendToFrontend({ type: "refine_error", error: "Select a connection first." })
          break
        }
        const SYS = "You turn a user's rough note into ONE clear, imperative, verb-first instruction for rewriting a passage of prose. Output ONLY the instruction, no preamble or quotes."
        const result = await spindle.generate.quiet({
          type: "quiet",
          userId,
          connection_id: msg.connectionId,
          messages: [{ role: "system", content: SYS }, { role: "user", content: msg.text }],
          parameters: { temperature: 0.4 },
          reasoning: { source: "off" },
          signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        })
        const content = (result as Record<string, unknown>)?.content
        const text = stripWrappingQuotes(typeof content === "string" ? content.trim() : "")
        if (!text) {
          spindle.sendToFrontend({ type: "refine_error", error: "Model returned an empty response." })
          break
        }
        spindle.sendToFrontend({ type: "refine_result", text })
      } catch (err: any) {
        spindle.log.error(`refine_prompt failed: ${err?.message}`)
        spindle.sendToFrontend({ type: "refine_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "architect_style": {
      try {
        if (!msg.connectionId) {
          spindle.sendToFrontend({ type: "architect_error", error: "Select a connection first." })
          break
        }
        const SYS = `From the user's description, produce a rewrite STYLE as strict minified JSON: {"name":"<short name>","prompt":"<one clear imperative rewrite instruction>"}. Output ONLY the JSON object.`
        const result = await spindle.generate.quiet({
          type: "quiet",
          userId,
          connection_id: msg.connectionId,
          messages: [{ role: "system", content: SYS }, { role: "user", content: msg.description }],
          parameters: { temperature: 0.4 },
          reasoning: { source: "off" },
          signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        })
        const content = (result as Record<string, unknown>)?.content
        let raw = typeof content === "string" ? content.trim() : ""
        // Strip markdown code fence if present
        raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
        let parsed: unknown
        try { parsed = JSON.parse(raw) } catch {
          spindle.sendToFrontend({ type: "architect_error", error: "Could not parse a style from the response." })
          break
        }
        const obj = parsed as Record<string, unknown>
        if (typeof obj?.name === "string" && typeof obj?.prompt === "string") {
          spindle.sendToFrontend({ type: "architect_result", name: obj.name, prompt: obj.prompt })
        } else {
          spindle.sendToFrontend({ type: "architect_error", error: "Could not parse a style from the response." })
        }
      } catch (err: any) {
        spindle.log.error(`architect_style failed: ${err?.message}`)
        spindle.sendToFrontend({ type: "architect_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "cancel": {
      for (const ac of activeAborts) ac.abort()
      activeAborts.clear()
      break
    }

    case "get_debug": {
      spindle.sendToFrontend({ type: "debug", entries: debugLog.slice() })
      break
    }

    case "reset_config": {
      try {
        const cur = await loadConfig()
        const next = { ...DEFAULT_CONFIG, connectionId: cur.connectionId }
        configCache = next
        await spindle.storage.setJson(CONFIG_FILE, next)
        await saveHistory({ undo: [], redo: [] })
        spindle.sendToFrontend({ type: "config", config: next })
        spindle.sendToFrontend({ type: "history", canUndo: false, canRedo: false })
      } catch (err: any) {
        spindle.log.error(`reset_config failed: ${err?.message}`)
      }
      break
    }

    case "gen_autoprofile": {
      if (!msg.connectionId || !msg.characterId) {
        spindle.sendToFrontend({ type: "autoprofile_error", error: "Need a connection and a character." })
        break
      }
      if (autoInFlight.has(msg.chatId)) {
        spindle.sendToFrontend({ type: "autoprofile_error", error: "Already generating…" })
        break
      }
      autoInFlight.add(msg.chatId)
      try {
        const c = await spindle.characters.get(msg.characterId, userId)
        if (!c) {
          spindle.sendToFrontend({ type: "autoprofile_error", error: "Character not found." })
          break
        }
        const SYS = "From a character's profile, write a single imperative rewrite instruction that rewrites a passage into THAT character's narration/voice (diction, register, mannerisms). Output ONLY the instruction."
        const USER = `Name: ${c.name}\nPersonality: ${(c.personality || "").slice(0, 500)}\nDescription: ${(c.description || "").slice(0, 500)}`
        const result = await spindle.generate.quiet({
          type: "quiet",
          userId,
          connection_id: msg.connectionId,
          messages: [{ role: "system", content: SYS }, { role: "user", content: USER }],
          parameters: { temperature: 0.5 },
          reasoning: { source: "off" },
          signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
        })
        const content = (result as Record<string, unknown>)?.content
        const text = typeof content === "string" ? content.trim() : ""
        if (!text) {
          spindle.sendToFrontend({ type: "autoprofile_error", error: "Model returned an empty response." })
          break
        }
        const cfg = await loadConfig()
        const name = `${c.name}'s Voice`
        cfg.autoProfiles[msg.chatId] = { name, prompt: text }
        configCache = cfg
        await spindle.storage.setJson(CONFIG_FILE, cfg)
        spindle.sendToFrontend({ type: "autoprofile_result", chatId: msg.chatId, name, prompt: text })
      } catch (err: any) {
        spindle.log.error(`gen_autoprofile failed: ${err?.message}`)
        spindle.sendToFrontend({ type: "autoprofile_error", error: String(err?.message ?? err) })
      } finally {
        autoInFlight.delete(msg.chatId)
      }
      break
    }
  }
})

spindle.log.info("Rewrite extension backend loaded")
