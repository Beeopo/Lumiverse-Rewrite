declare const spindle: import("lumiverse-spindle-types").SpindleAPI

import { sysPrompt, buildUserPrompt, findProfile, type Profile } from "./profiles"
import { spliceRewrite, resolveRawInput } from "./align"
import { DEFAULT_CONFIG, type RewriteConfig, type FrontendMsg, type DebugEntry, buildParams } from "./types"
import { stripWrappingQuotes, wasQuoteWrapped } from "./quotes"
import { sanitizeConfig } from "./settings-io"

const CONFIG_FILE = "config.json"
// Read at call time from the (already-warm) config cache so a settings change takes effect
// without restarting the worker; falls back to the default before the first load.
// Clamped at the use site (same convention as histCap): update_config writes straight into
// the cache without validation, and AbortSignal.timeout(0 | NaN) would kill every call.
const llmTimeoutMs = (userId: string | undefined) => {
  const s = configCache.get(userId || "")?.timeoutSec
  return (Number.isFinite(s) ? Math.max(10, Math.min(600, s as number)) : DEFAULT_CONFIG.timeoutSec) * 1000
}

// Per-user config cache, keyed by userId ("" when the host gives none).
const configCache = new Map<string, RewriteConfig>()

const autoInFlight = new Set<string>()
// Per-user abort registries. A cancel from user A must NOT abort user B's rewrites on
// shared multi-user hosts, so key by userId (empty string when host doesn't provide one).
const activeAborts = new Map<string, Set<AbortController>>()
function addAbort(userId: string | undefined, ac: AbortController) {
  const key = userId || ""
  let set = activeAborts.get(key)
  if (!set) { set = new Set(); activeAborts.set(key, set) }
  set.add(ac)
}
function delAbort(userId: string | undefined, ac: AbortController) {
  activeAborts.get(userId || "")?.delete(ac)
}
// Bumped by every cancel, so a run can notice a cancel that arrived between model calls.
const cancelEpochs = new Map<string, number>()
const cancelEpoch = (userId: string | undefined) => cancelEpochs.get(userId || "") ?? 0
function throwIfCancelled(userId: string | undefined, startEpoch: number) {
  if (cancelEpoch(userId) !== startEpoch) throw new DOMException("Cancelled.", "AbortError")
}
// A cancel or our own timeout; hosts may surface the timeout as a TimeoutError.
const isAbort = (err: any): boolean => err?.name === "AbortError" || err?.name === "TimeoutError"
function cancelUser(userId: string | undefined) {
  cancelEpochs.set(userId || "", cancelEpoch(userId) + 1)
  const set = activeAborts.get(userId || "")
  if (!set) return
  for (const ac of set) ac.abort()
  set.clear()
}
// Convenience: register a cancel-eligible abort signal for the caller. Used by every LLM
// call (rewrite/rewrite_multi/refine/architect/autoprofile) so a user's `cancel` message
// can stop them mid-flight and — critically — cannot reach OTHER users' operations.
function withUserCancel(userId: string | undefined): { signal: AbortSignal; done: () => void; reason: () => string } {
  const ac = new AbortController()
  addAbort(userId, ac)
  return {
    signal: AbortSignal.any([ac.signal, AbortSignal.timeout(llmTimeoutMs(userId))]),
    done: () => delAbort(userId, ac),
    reason: () => abortReason(ac, userId),
  }
}
// Both a user cancel and the timeout surface as the same AbortError, so the two used to be
// reported identically ("Cancelled."). Now that the timeout is user-configurable people will
// set it low, and a silent "Cancelled." for a deadline they chose is actively misleading —
// an untouched user controller means the timeout won the race.
function abortReason(ac: AbortController, userId: string | undefined): string {
  return ac.signal.aborted
    ? "Cancelled."
    : `Timed out after ${Math.round(llmTimeoutMs(userId) / 1000)}s — raise Timeout in Options.`
}

// ── Debug ring buffer ───────────────────────────────────────────────────────
const DEBUG_MAX = 50
const debugLog: DebugEntry[] = []
function pushDebug(e: DebugEntry, userId: string | undefined) {
  debugLog.push({ ...e, userId })
  if (debugLog.length > DEBUG_MAX) debugLog.shift()
}

// Per-user files live in spindle.userStorage. Before 1.3 everything was in the shared
// spindle.storage, so a user with no per-user file yet reads the legacy shared one.
async function readUserJson<T>(file: string, userId: string | undefined, fallback: T): Promise<T> {
  if (await spindle.userStorage.exists(file, userId || undefined)) {
    return await spindle.userStorage.getJson<T>(file, { fallback, userId: userId || undefined })
  }
  return await spindle.storage.getJson<T>(file, { fallback })
}

async function loadConfig(userId: string | undefined): Promise<RewriteConfig> {
  const key = userId || ""
  let cfg = configCache.get(key)
  if (!cfg) {
    // Merge sanitized values over defaults: new fields get defaults, wrong-typed ones are dropped.
    const stored = await readUserJson<unknown>(CONFIG_FILE, userId, {})
    cfg = { ...DEFAULT_CONFIG, ...sanitizeConfig(stored) }
    configCache.set(key, cfg)
  }
  return cfg
}
async function saveConfig(userId: string | undefined, cfg: RewriteConfig): Promise<void> {
  await spindle.userStorage.setJson(CONFIG_FILE, cfg, { userId: userId || undefined })
  configCache.set(userId || "", cfg)
}

// Global undo/redo history (across all messages, in apply order) — matches the original's
// hist[]/redo[] stacks. Each entry records one apply's before/after so undo/redo can walk
// the chain, with an optimistic-concurrency check so neither ever clobbers an edit the user
// (or another tool) made since.
const HISTORY_FILE = "history.json"
// userId isolates per-user history — undo/redo only pop entries the caller owns. Optional
// so entries persisted before this field existed still parse and remain undoable for the
// same user (they inherit ownership by matching an empty tag).
interface HistEntry { chatId: string; messageId: string; prev: string; applied: string; userId?: string }
interface History { undo: HistEntry[]; redo: HistEntry[] }

async function loadHistory(userId: string | undefined): Promise<History> {
  const h = await readUserJson<Partial<History> | null>(HISTORY_FILE, userId, { undo: [], redo: [] })
  const list = (x: unknown) => (Array.isArray(x) ? (x as HistEntry[]) : [])
  // The legacy shared file holds every user's entries; keep only the caller's.
  return { undo: list(h?.undo).filter((e) => ownsEntry(e, userId)), redo: list(h?.redo).filter((e) => ownsEntry(e, userId)) }
}
async function saveHistory(userId: string | undefined, h: History): Promise<void> {
  await spindle.userStorage.setJson(HISTORY_FILE, h, { userId: userId || undefined })
}
// History ops are read-modify-write; run them one at a time per user so two quick
// applies/undos can't drop each other's entries.
const histLocks = new Map<string, Promise<unknown>>()
const configLocks = new Map<string, Promise<unknown>>()
function withConfigLock<T>(userId: string | undefined, fn: () => Promise<T>): Promise<T> {
  const key = userId || ""
  const next = (configLocks.get(key) ?? Promise.resolve()).then(fn, fn)
  configLocks.set(key, next.catch(() => {}))
  return next
}
const HISTORY_OPS = new Set(["apply", "apply_multi", "undo", "redo", "reset_config"])
// Owner test — empty tag matches empty tag (pre-userId entries share ownership with an
// unauthenticated caller). Prevents user A's Undo from reverting user B's rewrite.
function ownsEntry(e: HistEntry, userId: string | undefined): boolean {
  return (e.userId || "") === (userId || "")
}
function topOwnedIndex(list: HistEntry[], userId: string | undefined): number {
  for (let i = list.length - 1; i >= 0; i--) if (ownsEntry(list[i], userId)) return i
  return -1
}
function countOwned(list: HistEntry[], userId: string | undefined): number {
  let n = 0
  for (const e of list) if (ownsEntry(e, userId)) n++
  return n
}
function histCap(cfg: RewriteConfig): number {
  return Math.max(1, Math.min(100, cfg.historyDepth || 30))
}
// Trim to at most `cap` entries owned by this user. Shifts from the oldest owned entry
// so other users' entries are preserved.
function trimUndo(h: History, userId: string | undefined, cap: number): void {
  while (countOwned(h.undo, userId) > cap) {
    const oldest = h.undo.findIndex((e) => ownsEntry(e, userId))
    if (oldest < 0) return
    h.undo.splice(oldest, 1)
  }
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
  // Optional pre-fetched chat messages — when the caller already has them, reuse instead of
  // re-fetching (the `rewrite` handler shares one fetch with raw-slice resolution).
  prefetchedMsgs?: Array<{ id: string; role: string; content: string }>,
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
      const msgs = prefetchedMsgs ?? ((await spindle.chat.getMessages(chatId)) as Array<{ id: string; role: string; content: string }>)
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
  prefetchedMsgs?: Array<{ id: string; role: string; content: string }>,
): Promise<string> {
  return (await assembleContextBlocks(cfg, anchor, userId, prefetchedMsgs)).map((b) => b.text).join("\n\n")
}

// Which config switch governs each labeled context block (labels from assembleContextBlocks).
const SOURCE_FLAG: Record<string, keyof RewriteConfig> = {
  character: "useCharCard",
  context: "usePrevMessages",
  persona: "useUserPersona",
  speaker: "speakerAware",
  lore: "useLorebook",
  memory: "useMemory",
}
function sourceEnabled(cfg: RewriteConfig, label: string): boolean {
  const flag = SOURCE_FLAG[label]
  return flag ? Boolean(cfg[flag]) : true
}

// The profiles a run applies, in order. Two or more ids is a multi-style run.
function resolvePasses(cfg: RewriteConfig, msg: { profileId: string; customPrompt?: string; profileIds?: string[] }): Profile[] {
  if (!msg.profileId && !msg.customPrompt && !(msg.profileIds?.length)) throw new Error("Pick a style first.")
  const ids = (msg.profileIds ?? []).filter((id) => typeof id === "string" && id && id !== "__custom__")
  return ids.length > 1 ? ids.map((id) => resolveProfile(cfg, id)) : [resolveProfile(cfg, msg.profileId, msg.customPrompt)]
}

type GenMessages = { role: "system" | "user"; content: string }[]

// One model call. With onText it streams and reports the text so far (throttled);
// without it, one blocking call. Both honour the same abort signal.
async function genText(
  cfg: RewriteConfig,
  userId: string,
  connectionId: string,
  messages: GenMessages,
  signal: AbortSignal,
  onText?: (text: string) => void,
): Promise<string> {
  const req = { type: "quiet" as const, userId, connection_id: connectionId, messages, parameters: buildParams(cfg), reasoning: { source: "off" as const }, signal }
  if (!onText) {
    const content = ((await spindle.generate.quiet(req)) as Record<string, unknown>)?.content
    return typeof content === "string" ? content : ""
  }
  let acc = ""
  let last = 0
  for await (const chunk of spindle.generate.quietStream(req)) {
    if (chunk.type === "token") {
      acc += chunk.token
      const t = Date.now()
      if (t - last > 120) { last = t; onText(acc) }
    } else if (chunk.type === "done") {
      return typeof chunk.content === "string" && chunk.content ? chunk.content : acc
    }
  }
  return acc
}

const MERGE_SYS = "You combine several rewrite instructions into ONE clear, imperative instruction that applies all of them to the same passage. Where they conflict, the earlier instruction wins. Output ONLY the combined instruction, no preamble or quotes."

// "Merged" multi-style mode: one helper call turns the picked styles into a single instruction.
async function mergeProfiles(cfg: RewriteConfig, userId: string, connectionId: string, profiles: Profile[], signal: AbortSignal): Promise<Profile> {
  const list = profiles.map((p, i) => `${i + 1}. ${p.name}: ${p.prompt}`).join("\n")
  const content = ((await spindle.generate.quiet({
    type: "quiet",
    userId,
    connection_id: connectionId,
    messages: [{ role: "system", content: MERGE_SYS }, { role: "user", content: list }],
    parameters: cfg.applyParamsToHelpers ? buildParams(cfg) : { temperature: 0.3 },
    reasoning: { source: "off" },
    signal,
  })) as Record<string, unknown>)?.content
  const prompt = stripWrappingQuotes(typeof content === "string" ? content.trim() : "")
  if (!prompt) throw new Error("Couldn't merge the styles: the model returned nothing.")
  return { id: "merged", name: profiles.map((p) => p.name).join(" + "), order: -1, prompt }
}

spindle.onFrontendMessage((raw: unknown, userId: string) => {
  const msg = raw as FrontendMsg
  if (!HISTORY_OPS.has(msg.type)) return handleMessage(msg, userId)
  const key = userId || ""
  const run = () => handleMessage(msg, userId)
  const next = (histLocks.get(key) ?? Promise.resolve()).then(run, run)
  histLocks.set(key, next.catch(() => {}))
  return next
})

async function handleMessage(msg: FrontendMsg, userId: string) {
  // Always target the requesting user: an operator-scoped install broadcasts untargeted
  // sends to every connected user. Echo requestId so the frontend can drop stale results.
  const requestId = "requestId" in msg ? msg.requestId : undefined
  const send = (m: Record<string, unknown>) => spindle.sendToFrontend(requestId ? { ...m, requestId } : m, userId)
  switch (msg.type) {
    case "get_config": {
      try {
        send({ type: "config", config: await loadConfig(userId) })
      } catch (err: any) {
        spindle.log.error(`get_config failed: ${err?.message}`)
        send({ type: "config", config: DEFAULT_CONFIG })
      }
      break
    }

    case "update_config": {
      let next: RewriteConfig = DEFAULT_CONFIG
      let persisted = true
      await withConfigLock(userId, async () => {
        try {
          next = { ...(await loadConfig(userId)), ...sanitizeConfig(msg.config) }
          await saveConfig(userId, next)
        } catch (err: any) {
          persisted = false
          spindle.log.error(`update_config persist failed: ${err?.message}`)
          next = await loadConfig(userId).catch(() => next)
        }
      })
      // saveConfig updates the cache only after the write succeeds, so a failed save
      // can't leave memory and disk disagreeing.
      // Always reply so the UI never hangs, even if persistence failed. persisted:false lets
      // the frontend surface a "settings not saved" warning.
      send({ type: "config", config: next, persisted })
      break
    }

    case "preview_tokens": {
      if (!msg.text.trim()) {
        send({ type: "token_estimate", total: 0, system: 0, selection: 0, sources: [] })
        break
      }
      try {
        const cfg = await loadConfig(userId)
        const profile = resolveProfile(cfg, msg.profileId, msg.customPrompt)
        // Assemble every source, so the panel can show what a switched-off source would add.
        const allOn: RewriteConfig = !msg.full ? cfg : { ...cfg, usePrevMessages: true, useCharCard: true, useUserPersona: true, speakerAware: true, useMemory: true, useLorebook: true }
        const blocks = await assembleContextBlocks(
          allOn,
          { chatId: msg.chatId, messageId: msg.messageId, characterId: msg.characterId },
          userId,
        )
        const onBlocks = blocks.filter((b) => sourceEnabled(cfg, b.label))
        const context = onBlocks.map((b) => b.text).join("\n\n")
        const sys = sysPrompt(msg.concise)
        const userPrompt = buildUserPrompt(profile, msg.text, msg.lengthPct, context)
        // ponytail: ~N countMessages calls per preview; debounced on the frontend so it's fine.
        const total = (await spindle.tokens.countMessages(
          [{ role: "system", content: sys }, { role: "user", content: userPrompt }],
          { userId },
        )).total_tokens
        const system = (await spindle.tokens.countMessages([{ role: "system", content: sys }], { userId })).total_tokens
        const selection = (await spindle.tokens.countMessages([{ role: "user", content: msg.text }], { userId })).total_tokens
        const sources: { label: string; tokens: number; on: boolean }[] = []
        for (const b of blocks) {
          const tokens = (await spindle.tokens.countMessages([{ role: "user", content: b.text }], { userId })).total_tokens
          sources.push({ label: b.label, tokens, on: sourceEnabled(cfg, b.label) })
        }
        send({ type: "token_estimate", total, system, selection, sources, seq: msg.seq })
      } catch (err: any) {
        spindle.log.warn(`preview_tokens failed: ${err?.message}`)
        send({ type: "token_estimate", total: 0, system: 0, selection: 0, sources: [] })
      }
      break
    }

    case "rewrite": {
      // Hoisted so the catch below can tell a user cancel from a timeout (the ref is
      // replaced by each model call inside the try).
      let cancelRef: { reason: () => string } | null = null
      let _debugCfg: RewriteConfig | null = null
      let _debugProfile = ""
      let _debugPromptChars = 0
      let _debugT0 = 0
      try {
        if (!msg.connectionId) {
          send({ type: "rewrite_error", error: "No model connection selected." })
          break
        }
        if (!msg.text.trim()) {
          send({ type: "rewrite_error", error: "Nothing to rewrite — the input is empty." })
          break
        }
        const startEpoch = cancelEpoch(userId)
        const cfg = await loadConfig(userId)
        _debugCfg = cfg
        let profiles = resolvePasses(cfg, msg)
        _debugProfile = profiles.map((p) => p.id).join("+")

        // Fetch the chat's messages ONCE — shared by context assembly and raw-slice
        // resolution. A fetch failure degrades gracefully: assembleContext falls back to
        // its own (also guarded) fetch, and the raw-slice step falls back to rendered text.
        let chatMsgs: Array<{ id: string; role: string; content: string }> | undefined
        if (msg.chatId) {
          try {
            chatMsgs = (await spindle.chat.getMessages(msg.chatId)) as Array<{ id: string; role: string; content: string }>
          } catch (e: any) {
            spindle.log.warn(`chat messages fetch skipped: ${e?.message}`)
          }
        }

        const context = await assembleContext(
          cfg,
          { chatId: msg.chatId, messageId: msg.messageId, characterId: msg.characterId },
          userId,
          chatMsgs,
        )
        spindle.log.info(`rewrite: profile=${_debugProfile} context=${context.length}c`)

        // Feed the model the raw markdown slice (preserves formatting) when we can locate it;
        // otherwise degrade gracefully to the rendered text — never turn a working rewrite
        // into an error.
        let modelInput = msg.text
        if (msg.messageId && chatMsgs) {
          const target = chatMsgs.find((m) => m.id === msg.messageId)
          if (target) modelInput = resolveRawInput(target.content, msg.R, msg.rs, msg.re, msg.text) ?? msg.text
        }

        throwIfCancelled(userId, startEpoch)
        _debugT0 = Date.now()
        if (profiles.length > 1 && msg.multiMode === "merged") {
          send({ type: "rewrite_stage", stage: "merging", passes: profiles.length })
          const c = withUserCancel(userId); cancelRef = c
          try { profiles = [await mergeProfiles(cfg, userId, msg.connectionId, profiles, c.signal)] } finally { c.done() }
        }

        // One pass per profile; each later pass rewrites the previous pass's output. The
        // length target always comes from the original selection so passes don't compound it.
        let current = modelInput
        let promptTokens = 0
        for (let i = 0; i < profiles.length; i++) {
          const p = profiles[i]
          const passInfo = { pass: i + 1, passes: profiles.length, label: p.name }
          if (profiles.length > 1) send({ type: "rewrite_stage", stage: "pass", ...passInfo })
          const messages = [
            { role: "system" as const, content: sysPrompt(msg.concise) },
            { role: "user" as const, content: buildUserPrompt(p, current, msg.lengthPct, context, msg.text) },
          ]
          try {
            promptTokens += (await spindle.tokens.countMessages(messages, { userId })).total_tokens
          } catch (e: any) {
            spindle.log.warn(`token count skipped: ${e?.message}`)
          }
          _debugPromptChars += messages[1].content.length
          throwIfCancelled(userId, startEpoch)
          const c = withUserCancel(userId); cancelRef = c
          let raw: string
          try {
            raw = (await genText(cfg, userId, msg.connectionId, messages, c.signal, (text) => send({ type: "rewrite_chunk", text, ...passInfo }))).trim()
          } finally { c.done() }
          // When the input was itself quote-wrapped, the model legitimately keeps those quotes.
          const out = wasQuoteWrapped(current) ? raw : stripWrappingQuotes(raw)
          if (!out) {
            send({ type: "rewrite_error", error: profiles.length > 1 ? `Model returned an empty rewrite on pass ${i + 1} (${p.name}).` : "Model returned an empty rewrite." })
            return
          }
          current = out
        }
        if (cfg.debug) pushDebug({ ts: Date.now(), profile: _debugProfile, promptChars: _debugPromptChars, outputChars: current.length, tokens: promptTokens, ms: Date.now() - _debugT0 }, userId)
        send({ type: "rewrite_result", text: current, tokens: promptTokens })
      } catch (err: any) {
        if (isAbort(err)) {
          send({ type: "rewrite_cancelled", reason: cancelRef?.reason() ?? "Cancelled." })
          break
        }
        spindle.log.error(`rewrite failed: ${err?.message}`)
        if (_debugCfg?.debug && _debugT0) pushDebug({ ts: Date.now(), profile: _debugProfile, promptChars: _debugPromptChars, outputChars: 0, tokens: 0, ms: Date.now() - _debugT0, error: err?.message }, userId)
        send({ type: "rewrite_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "rewrite_multi": {
      let cancelRef: { reason: () => string } | null = null
      try {
        if (!msg.connectionId) {
          send({ type: "rewrite_error", error: "No model connection selected." })
          break
        }
        if (!msg.segments?.length) {
          send({ type: "rewrite_error", error: "Nothing to rewrite — no segments." })
          break
        }
        const startEpoch = cancelEpoch(userId)
        const cfg = await loadConfig(userId)
        // Resolve the passes ONCE — same resolution as the single `rewrite` case.
        let profiles = resolvePasses(cfg, msg)
        if (profiles.length > 1 && msg.multiMode === "merged") {
          send({ type: "rewrite_stage", stage: "merging", passes: profiles.length })
          const c = withUserCancel(userId); cancelRef = c
          try { profiles = [await mergeProfiles(cfg, userId, msg.connectionId, profiles, c.signal)] } finally { c.done() }
        }

        // Fetch the chat's messages ONCE — every segment resolves its raw slice against
        // this same snapshot. A fetch failure degrades gracefully: each segment then
        // falls back to its own rendered text.
        let chatMsgs: Array<{ id: string; content: string }> = []
        try {
          chatMsgs = (await spindle.chat.getMessages(msg.chatId)) as Array<{ id: string; content: string }>
        } catch (e: any) {
          spindle.log.warn(`raw-slice message fetch skipped: ${e?.message}`)
        }

        const sys = sysPrompt(msg.concise)
        const out: { messageId: string; output: string }[] = []
        // ponytail: re-assembles chat-level context per segment; fine for typical 2-3 message selections
        let totalPromptTokens = 0
        let cancelled = false
        let cancelReason = "Cancelled."
        segments: for (let s = 0; s < msg.segments.length; s++) {
          const seg = msg.segments[s]
          const context = await assembleContext(
            cfg,
            { chatId: msg.chatId, messageId: seg.messageId, characterId: msg.characterId },
            userId,
          )
          const target = chatMsgs.find((m) => m.id === seg.messageId)
          const segInput = target ? (resolveRawInput(target.content, seg.R, seg.rs, seg.re, seg.text) ?? seg.text) : seg.text
          let current = segInput
          for (let i = 0; i < profiles.length; i++) {
            const p = profiles[i]
            send({ type: "rewrite_stage", stage: "pass", pass: i + 1, passes: profiles.length, label: p.name, segment: s + 1, segments: msg.segments.length })
            const messages = [
              { role: "system" as const, content: sys },
              { role: "user" as const, content: buildUserPrompt(p, current, msg.lengthPct, context, seg.text) },
            ]
            try {
              totalPromptTokens += (await spindle.tokens.countMessages(messages, { userId })).total_tokens
            } catch (e: any) {
              spindle.log.warn(`token count skipped: ${e?.message}`)
            }
            if (cancelEpoch(userId) !== startEpoch) { cancelled = true; break segments }
            const c = withUserCancel(userId); cancelRef = c
            let raw: string
            try {
              raw = (await genText(cfg, userId, msg.connectionId, messages, c.signal)).trim()
            } catch (segErr: any) {
              if (isAbort(segErr)) {
                cancelled = true
                cancelReason = c.reason()
                break segments
              }
              throw segErr
            } finally { c.done() }
            const text = wasQuoteWrapped(current) ? raw : stripWrappingQuotes(raw)
            // An empty pass leaves this segment unchanged from here on; an empty first pass
            // means no output for it, and apply_multi skips segments without one.
            if (!text) { if (i === 0) current = ""; break }
            current = text
          }
          if (current) out.push({ messageId: seg.messageId, output: current })
        }
        if (cancelled) {
          // Deliver already-completed segments so the user doesn't lose paid-for work when
          // cancelling mid-batch. Frontend can decide whether to Apply the partial set.
          if (out.length > 0) {
            send({ type: "rewrite_multi_result", segments: out, tokens: totalPromptTokens || undefined, partial: true })
          }
          send({ type: "rewrite_cancelled", reason: cancelReason })
          break
        }
        if (!out.length) {
          send({ type: "rewrite_error", error: "Model returned empty rewrites for every segment." })
          break
        }
        send({ type: "rewrite_multi_result", segments: out, tokens: totalPromptTokens || undefined })
      } catch (err: any) {
        if (isAbort(err)) {
          send({ type: "rewrite_cancelled", reason: cancelRef?.reason() ?? "Cancelled." })
          break
        }
        spindle.log.error(`rewrite_multi failed: ${err?.message}`)
        send({ type: "rewrite_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "apply": {
      try {
        if (!spindle.permissions.has("chat_mutation")) {
          send({ type: "apply_error", error: "Missing chat_mutation permission." })
          break
        }
        const msgs = (await spindle.chat.getMessages(msg.chatId)) as Array<{ id: string; content: string }>
        const target = msgs.find((m) => m.id === msg.messageId)
        if (!target) {
          send({ type: "apply_error", error: "Target message not found." })
          break
        }
        const newContent = spliceRewrite(target.content, msg.R, msg.rs, msg.re, msg.output)
        if (newContent === null) {
          send({
            type: "apply_error",
            error: "Couldn't locate the selection in the message. Copy the output and edit manually.",
          })
          break
        }
        await spindle.chat.updateMessage(msg.chatId, msg.messageId, { content: newContent })
        // Push onto the per-user undo stack; applying clears this user's redo.
        const cfg = await loadConfig(userId)
        const hist = await loadHistory(userId)
        hist.undo.push({ chatId: msg.chatId, messageId: msg.messageId, prev: target.content, applied: newContent, userId })
        trimUndo(hist, userId, histCap(cfg))
        hist.redo = hist.redo.filter((e) => !ownsEntry(e, userId))
        await saveHistory(userId, hist)
        send({ type: "apply_done", messageId: msg.messageId, canUndo: countOwned(hist.undo, userId) > 0, canRedo: false })
        spindle.log.info(`Rewrite applied to message ${msg.messageId.slice(0, 8)}`)
      } catch (err: any) {
        spindle.log.error(`apply failed: ${err?.message}`)
        send({ type: "apply_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "apply_multi": {
      try {
        if (!spindle.permissions.has("chat_mutation")) {
          send({ type: "apply_error", error: "Missing chat_mutation permission." })
          break
        }
        const msgs = (await spindle.chat.getMessages(msg.chatId)) as Array<{ id: string; content: string }>
        const multiCfg = await loadConfig(userId)
        const cap = histCap(multiCfg)
        const hist = await loadHistory(userId)
        const skipped: string[] = []
        let applied = 0
        let midLoopError: string | null = null
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
          try {
            await spindle.chat.updateMessage(msg.chatId, item.messageId, { content: nc })
          } catch (err: any) {
            // Persist the history we've accumulated so already-applied writes stay undoable,
            // then bail so the outer response reports the partial state.
            midLoopError = String(err?.message ?? err)
            break
          }
          hist.undo.push({ chatId: msg.chatId, messageId: item.messageId, prev: target.content, applied: nc, userId })
          trimUndo(hist, userId, cap)
          // Reflect the new content locally so any later item targeting the same message
          // (defensive — items are distinct messages) sees the freshest content.
          target.content = nc
          applied++
        }
        // Clear this user's redo once, only if we actually applied something (matches
        // single-apply semantics: a fully-skipped apply makes no mutation, so leave
        // history untouched). Persist BEFORE reporting so a mid-loop throw doesn't lose
        // successful writes.
        if (applied > 0) {
          hist.redo = hist.redo.filter((e) => !ownsEntry(e, userId))
          await saveHistory(userId, hist)
        }
        if (midLoopError) {
          send({ type: "apply_error", error: `Partial apply (${applied} succeeded): ${midLoopError}` })
          break
        }
        send({
          type: "apply_multi_done",
          applied,
          skipped,
          canUndo: countOwned(hist.undo, userId) > 0,
          canRedo: false,
        })
        spindle.log.info(`Multi-rewrite applied to ${applied} message(s), skipped ${skipped.length}`)
      } catch (err: any) {
        spindle.log.error(`apply_multi failed: ${err?.message}`)
        send({ type: "apply_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "undo": {
      try {
        if (!spindle.permissions.has("chat_mutation")) {
          send({ type: "undo_error", error: "Missing chat_mutation permission." })
          break
        }
        const hist = await loadHistory(userId)
        const idx = topOwnedIndex(hist.undo, userId)
        if (idx < 0) {
          send({ type: "undo_error", error: "Nothing to undo." })
          break
        }
        const entry = hist.undo[idx]
        const msgs = (await spindle.chat.getMessages(entry.chatId)) as Array<{ id: string; content: string }>
        const target = msgs.find((m) => m.id === entry.messageId)
        if (!target) {
          send({ type: "undo_error", error: "That message no longer exists." })
          break
        }
        // Optimistic concurrency: only revert if the live message is still what we applied.
        if (target.content !== entry.applied) {
          send({ type: "undo_error", error: "Message changed since the rewrite; undo skipped to protect your edits." })
          break
        }
        hist.undo.splice(idx, 1)
        hist.redo.push(entry)
        await spindle.chat.updateMessage(entry.chatId, entry.messageId, { content: entry.prev })
        await saveHistory(userId, hist)
        send({ type: "undo_done", messageId: entry.messageId, canUndo: countOwned(hist.undo, userId) > 0, canRedo: countOwned(hist.redo, userId) > 0 })
      } catch (err: any) {
        spindle.log.error(`undo failed: ${err?.message}`)
        send({ type: "undo_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "redo": {
      try {
        if (!spindle.permissions.has("chat_mutation")) {
          send({ type: "redo_error", error: "Missing chat_mutation permission." })
          break
        }
        const hist = await loadHistory(userId)
        const idx = topOwnedIndex(hist.redo, userId)
        if (idx < 0) {
          send({ type: "redo_error", error: "Nothing to redo." })
          break
        }
        const entry = hist.redo[idx]
        const msgs = (await spindle.chat.getMessages(entry.chatId)) as Array<{ id: string; content: string }>
        const target = msgs.find((m) => m.id === entry.messageId)
        if (!target) {
          send({ type: "redo_error", error: "That message no longer exists." })
          break
        }
        // Only re-apply if the message is still in the post-undo state we expect.
        if (target.content !== entry.prev) {
          send({ type: "redo_error", error: "Message changed since the undo; redo skipped to protect your edits." })
          break
        }
        hist.redo.splice(idx, 1)
        hist.undo.push(entry)
        await spindle.chat.updateMessage(entry.chatId, entry.messageId, { content: entry.applied })
        await saveHistory(userId, hist)
        send({ type: "redo_done", messageId: entry.messageId, canUndo: countOwned(hist.undo, userId) > 0, canRedo: countOwned(hist.redo, userId) > 0 })
      } catch (err: any) {
        spindle.log.error(`redo failed: ${err?.message}`)
        send({ type: "redo_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "get_history": {
      const hist = await loadHistory(userId)
      send({ type: "history", canUndo: countOwned(hist.undo, userId) > 0, canRedo: countOwned(hist.redo, userId) > 0 })
      break
    }

    case "get_connections": {
      try {
        const conns = await spindle.connections.list(userId)
        send({ type: "connections", connections: conns.map(c => ({ id: c.id, name: c.name, model: c.model })) })
      } catch (err: any) {
        spindle.log.warn(`connections list failed: ${err?.message}`)
        send({ type: "connections", connections: [] })
      }
      break
    }

    case "refine_prompt": {
      // Hoisted so the catch below can tell a user cancel from a timeout (the ref is
      // created inside the try).
      let cancelRef: { reason: () => string } | null = null
      try {
        if (!msg.connectionId) {
          send({ type: "refine_error", error: "Select a connection first." })
          break
        }
        const cfg = await loadConfig(userId)
        const SYS = "You turn a user's rough note into ONE clear, imperative, verb-first instruction for rewriting a passage of prose. Output ONLY the instruction, no preamble or quotes."
        const c = withUserCancel(userId); cancelRef = c
        try {
          const result = await spindle.generate.quiet({
            type: "quiet",
            userId,
            connection_id: msg.connectionId,
            messages: [{ role: "system", content: SYS }, { role: "user", content: msg.text }],
            parameters: cfg.applyParamsToHelpers ? buildParams(cfg) : { temperature: 0.4 },
            reasoning: { source: "off" },
            signal: c.signal,
          })
          const content = (result as Record<string, unknown>)?.content
          const text = stripWrappingQuotes(typeof content === "string" ? content.trim() : "")
          if (!text) {
            send({ type: "refine_error", error: "Model returned an empty response." })
            break
          }
          send({ type: "refine_result", text })
        } finally { c.done() }
      } catch (err: any) {
        if (isAbort(err)) { send({ type: "refine_error", error: cancelRef?.reason() ?? "Cancelled." }); break }
        spindle.log.error(`refine_prompt failed: ${err?.message}`)
        send({ type: "refine_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "architect_style": {
      // Hoisted so the catch below can tell a user cancel from a timeout (the ref is
      // created inside the try).
      let cancelRef: { reason: () => string } | null = null
      try {
        if (!msg.connectionId) {
          send({ type: "architect_error", error: "Select a connection first." })
          break
        }
        const cfg = await loadConfig(userId)
        const SYS = `From the user's description, produce a rewrite STYLE as strict minified JSON: {"name":"<short name>","prompt":"<one clear imperative rewrite instruction>"}. Output ONLY the JSON object.`
        const c = withUserCancel(userId); cancelRef = c
        try {
          const result = await spindle.generate.quiet({
            type: "quiet",
            userId,
            connection_id: msg.connectionId,
            messages: [{ role: "system", content: SYS }, { role: "user", content: msg.description }],
            parameters: cfg.applyParamsToHelpers ? buildParams(cfg) : { temperature: 0.4 },
            reasoning: { source: "off" },
            signal: c.signal,
          })
          const content = (result as Record<string, unknown>)?.content
          let raw = typeof content === "string" ? content.trim() : ""
          // Strip markdown code fence if present
          raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
          let parsed: unknown
          try { parsed = JSON.parse(raw) } catch {
            send({ type: "architect_error", error: "Could not parse a style from the response." })
            break
          }
          const obj = parsed as Record<string, unknown>
          if (typeof obj?.name === "string" && typeof obj?.prompt === "string") {
            send({ type: "architect_result", name: obj.name, prompt: obj.prompt })
          } else {
            send({ type: "architect_error", error: "Could not parse a style from the response." })
          }
        } finally { c.done() }
      } catch (err: any) {
        if (isAbort(err)) { send({ type: "architect_error", error: cancelRef?.reason() ?? "Cancelled." }); break }
        spindle.log.error(`architect_style failed: ${err?.message}`)
        send({ type: "architect_error", error: String(err?.message ?? err) })
      }
      break
    }

    case "cancel": {
      cancelUser(userId)
      break
    }

    case "get_debug": {
      // Per-user filter — a shared multi-user host must not leak peer users' rewrite metadata.
      send({ type: "debug", entries: debugLog.filter((e) => (e.userId || "") === (userId || "")) })
      break
    }

    case "reset_config": {
      try {
        const next = await withConfigLock(userId, async () => {
          const cur = await loadConfig(userId)
          const fresh = { ...DEFAULT_CONFIG, connectionId: cur.connectionId }
          await saveConfig(userId, fresh)
          return fresh
        })
        await saveHistory(userId, { undo: [], redo: [] })
        send({ type: "config", config: next })
        send({ type: "history", canUndo: false, canRedo: false })
      } catch (err: any) {
        spindle.log.error(`reset_config failed: ${err?.message}`)
        // Signal failure via a persisted:false config echo — the frontend already handles it.
        const cur = await loadConfig(userId).catch(() => DEFAULT_CONFIG)
        send({ type: "config", config: cur, persisted: false })
      }
      break
    }

    case "gen_autoprofile": {
      // Hoisted so the catch below can tell a user cancel from a timeout (the ref is
      // created inside the try).
      let cancelRef: { reason: () => string } | null = null
      if (!msg.connectionId || !msg.characterId) {
        send({ type: "autoprofile_error", error: "Need a connection and a character." })
        break
      }
      if (autoInFlight.has(msg.chatId)) {
        send({ type: "autoprofile_error", error: "Already generating…" })
        break
      }
      autoInFlight.add(msg.chatId)
      try {
        const c = await spindle.characters.get(msg.characterId, userId)
        if (!c) {
          send({ type: "autoprofile_error", error: "Character not found." })
          break
        }
        const SYS = "From a character's profile, write a single imperative rewrite instruction that rewrites a passage into THAT character's narration/voice (diction, register, mannerisms). Output ONLY the instruction."
        const USER = `Name: ${c.name}\nPersonality: ${(c.personality || "").slice(0, 500)}\nDescription: ${(c.description || "").slice(0, 500)}`
        const cfg = await loadConfig(userId)
        const cancel = withUserCancel(userId); cancelRef = cancel
        try {
          const result = await spindle.generate.quiet({
            type: "quiet",
            userId,
            connection_id: msg.connectionId,
            messages: [{ role: "system", content: SYS }, { role: "user", content: USER }],
            parameters: cfg.applyParamsToHelpers ? buildParams(cfg) : { temperature: 0.5 },
            reasoning: { source: "off" },
            signal: cancel.signal,
          })
          const content = (result as Record<string, unknown>)?.content
          const text = typeof content === "string" ? content.trim() : ""
          if (!text) {
            send({ type: "autoprofile_error", error: "Model returned an empty response." })
            break
          }
          const name = `${c.name}'s Voice`
          // Re-read: settings may have changed during the generation.
          await withConfigLock(userId, async () => {
            const fresh = await loadConfig(userId)
            // Unhide the chat style slot so the new style is selectable.
            const hiddenProfiles = fresh.hiddenProfiles.filter((h) => h !== "auto")
            await saveConfig(userId, { ...fresh, hiddenProfiles, autoProfiles: { ...fresh.autoProfiles, [msg.chatId]: { name, prompt: text } } })
          })
          send({ type: "autoprofile_result", chatId: msg.chatId, name, prompt: text })
        } finally { cancel.done() }
      } catch (err: any) {
        if (isAbort(err)) { send({ type: "autoprofile_error", error: cancelRef?.reason() ?? "Cancelled." }); break }
        spindle.log.error(`gen_autoprofile failed: ${err?.message}`)
        send({ type: "autoprofile_error", error: String(err?.message ?? err) })
      } finally {
        autoInFlight.delete(msg.chatId)
      }
      break
    }
  }
}

spindle.log.info("Rewrite extension backend loaded")
