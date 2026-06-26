import type { SpindleFrontendContext } from "lumiverse-spindle-types"
import { DEF_PROFILES } from "./profiles"
import type { RewriteConfig, BackendMsg, DebugEntry } from "./types"
import { sanitizeImport } from "./settings-io"
import { wc } from "./wc"

interface Capture {
  chatId: string
  messageId: string
  R: string
  rs: number
  re: number
}

// Map a live selection to a message + rendered geometry, or null if the
// selection isn't fully inside a single rendered message bubble.
function captureSelection(): { cap: Capture; text: string } | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  const anchor = range.commonAncestorContainer
  const el = anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement
  // Scope to the rendered message CONTENT subtree, NOT the whole bubble. The bubble
  // ([data-message-id]) also wraps avatar/name/timestamp/token-count/buttons chrome that
  // is absent from the raw content — including it in R would misalign the splice. The
  // host marks the prose container with data-component="MessageContent". Only capture
  // selections that land inside the prose.
  const contentEl = el?.closest('[data-component="MessageContent"]') as HTMLElement | null
  if (!contentEl) return null
  const msgEl = contentEl.closest("[data-message-id]") as HTMLElement | null
  const messageId = msgEl?.getAttribute("data-message-id")
  if (!messageId) return null

  // R and [rs,re) share one coordinate space: Range.toString() over contentEl.
  const fullRange = document.createRange()
  fullRange.selectNodeContents(contentEl)
  const R = fullRange.toString()

  const startProbe = document.createRange()
  startProbe.selectNodeContents(contentEl)
  startProbe.setEnd(range.startContainer, range.startOffset)
  const rs = startProbe.toString().length

  const text = sel.toString()
  const re = rs + text.length
  if (!text.trim()) return null

  return { cap: { chatId: "", messageId, R, rs, re }, text }
}

// One per-message segment of a multi-bubble selection. R/rs/re share the SAME
// coordinate space (Range.toString() over the message's MessageContent subtree) as a
// single Capture, so each segment splices through the identical guarded path.
interface MultiSeg {
  messageId: string
  R: string
  rs: number
  re: number
  text: string
  output?: string
}

// Pure span-math for a multi-message segment. Given a message's full rendered content
// length `rLen`, its position in the selection (`role`), and the precomputed selection
// offsets within THIS content, return the [rs,re) sub-span:
//  - "first": selection starts inside this message and runs to its end.
//  - "last":  selection covers from this message's start up to the selection end.
//  - "middle": the message is fully enclosed → the whole content.
// `startLen` = length of a range from content-start to the selection's start container/offset
// (only meaningful for "first"); `endLen` = same to the selection's end (only for "last").
export function multiSegSpan(
  role: "first" | "middle" | "last",
  rLen: number,
  startLen: number,
  endLen: number,
): { rs: number; re: number } {
  if (role === "first") return { rs: Math.max(0, Math.min(startLen, rLen)), re: rLen }
  if (role === "last") return { rs: 0, re: Math.max(0, Math.min(endLen, rLen)) }
  return { rs: 0, re: rLen }
}

// Map a live selection that spans MULTIPLE message bubbles into one segment per touched
// message. Returns null (deferring to the single-message path) when fewer than 2 distinct
// non-empty messages are involved. Each segment carries its own R/rs/re so apply splices
// each independently through spliceRewrite's guard.
function captureMultiSelection(): { segments: MultiSeg[] } | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)

  // Cheap exit: if the selection begins and ends inside the same message bubble it's a
  // single-message selection — skip the full-document scan below and defer to captureSelection().
  const bubbleOf = (n: Node) => (n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement)?.closest("[data-message-id]") ?? null
  const startBubble = bubbleOf(range.startContainer)
  if (startBubble && startBubble === bubbleOf(range.endContainer)) return null

  // Collect every MessageContent subtree the selection intersects, in document order,
  // that sits inside a [data-message-id] bubble.
  const all = Array.from(document.querySelectorAll('[data-component="MessageContent"]')) as HTMLElement[]
  const touched: { el: HTMLElement; messageId: string }[] = []
  for (const el of all) {
    let intersects = false
    try { intersects = range.intersectsNode(el) } catch { intersects = false }
    if (!intersects) continue
    const msgEl = el.closest("[data-message-id]") as HTMLElement | null
    const messageId = msgEl?.getAttribute("data-message-id")
    if (!messageId) continue
    touched.push({ el, messageId })
  }
  // Distinct messages only; need ≥2 to be a multi-message selection.
  const distinctIds = new Set(touched.map((t) => t.messageId))
  if (distinctIds.size < 2) return null

  const segments: MultiSeg[] = []
  for (let i = 0; i < touched.length; i++) {
    const { el, messageId } = touched[i]
    const fullRange = document.createRange()
    fullRange.selectNodeContents(el)
    const R = fullRange.toString()

    // Determine this content's role by whether it owns the selection's start/end container.
    const hasStart = el.contains(range.startContainer)
    const hasEnd = el.contains(range.endContainer)

    let rs: number, re: number
    if (hasStart && !hasEnd) {
      // First message: selection starts here, runs to this message's end.
      const startProbe = document.createRange()
      startProbe.selectNodeContents(el)
      startProbe.setEnd(range.startContainer, range.startOffset)
      ;({ rs, re } = multiSegSpan("first", R.length, startProbe.toString().length, 0))
    } else if (hasEnd && !hasStart) {
      // Last message: from this message's start up to the selection end.
      const endProbe = document.createRange()
      endProbe.selectNodeContents(el)
      endProbe.setEnd(range.endContainer, range.endOffset)
      ;({ rs, re } = multiSegSpan("last", R.length, 0, endProbe.toString().length))
    } else if (hasStart && hasEnd) {
      // Defensive: start and end land in the same content — that's a single-message
      // selection, which the single-message path handles. Bail to it.
      return null
    } else {
      // Fully-enclosed middle message.
      ;({ rs, re } = multiSegSpan("middle", R.length, 0, 0))
    }

    const text = R.slice(rs, re)
    if (!text.trim()) continue
    segments.push({ messageId, R, rs, re, text })
  }

  if (segments.length < 2) return null
  return { segments }
}

// Re-derive the current rendered text of a message's content subtree, in the SAME
// coordinate space as a Capture's R. Used to detect that the captured message changed
// (edit/swipe/regenerate) before applying — splicing into changed content can corrupt it.
// Returns null if the message is no longer on screen.
function liveRenderedFor(messageId: string): string | null {
  const msgEl = document.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)
  const contentEl = msgEl?.querySelector('[data-component="MessageContent"]') as HTMLElement | null
  if (!contentEl) return null
  const r = document.createRange()
  r.selectNodeContents(contentEl)
  return r.toString()
}

// Frontend watchdog: re-enable Run if the backend never replies (worker torn down /
// channel dropped). Slightly above the backend LLM_TIMEOUT_MS (120s).
const RUN_WATCHDOG_MS = 125_000

// ── Word-level diff (ported from the original) ──
const DIFF_TOKEN_CAP = 500
function computeWordDiff(oldStr: string, newStr: string): Array<{ t: string; v: string }> | null {
  let oldToks = oldStr.split(/(\s+)/)
  let newToks = newStr.split(/(\s+)/)
  if (oldToks.length > DIFF_TOKEN_CAP * 2) oldToks = oldToks.slice(0, DIFF_TOKEN_CAP * 2)
  if (newToks.length > DIFF_TOKEN_CAP * 2) newToks = newToks.slice(0, DIFF_TOKEN_CAP * 2)
  const m = oldToks.length, n = newToks.length
  if (m * n > DIFF_TOKEN_CAP * DIFF_TOKEN_CAP) return null
  const dp: Int32Array[] = []
  for (let i = 0; i <= m; i++) dp.push(new Int32Array(n + 1))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldToks[i - 1] === newToks[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  const ops: Array<{ t: string; v: string }> = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldToks[i - 1] === newToks[j - 1]) { ops.unshift({ t: "eq", v: oldToks[i - 1] }); i--; j-- }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { ops.unshift({ t: "ins", v: newToks[j - 1] }); j-- }
    else { ops.unshift({ t: "del", v: oldToks[i - 1] }); i-- }
  }
  return ops
}
function renderDiff(el: HTMLElement, oldStr: string, newStr: string) {
  const ops = computeWordDiff(oldStr, newStr)
  el.replaceChildren()
  if (!ops) { el.textContent = newStr; return }
  for (const op of ops) {
    if (op.t === "eq") el.appendChild(document.createTextNode(op.v))
    else {
      const s = document.createElement(op.t === "ins" ? "ins" : "del")
      s.textContent = op.v
      el.appendChild(s)
    }
  }
}

export function setup(ctx: SpindleFrontendContext): () => void {
  const removeStyle = ctx.dom.addStyle(`
    .rw-panel { --rw-accent: var(--lumiverse-accent, var(--lumiverse-primary)); --rw-accent-text: var(--lumiverse-primary-text, #b8a0ff); container: rw / inline-size; padding: 4px 14px 18px; display: flex; flex-direction: column; color: var(--lumiverse-text); font-size: calc(13px * var(--lumiverse-font-scale, 1)); line-height: 1.45; -webkit-font-smoothing: antialiased; }

    /* ── Sections: hairline-separated groups with uppercase headers ── */
    .rw-sec { display: flex; flex-direction: column; gap: 9px; padding: 15px 0; border-top: 1px solid var(--lumiverse-border); }
    .rw-pane > .rw-sec:first-child { border-top: 0; padding-top: 12px; }
    .rw-sec-hd { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--lumiverse-text-muted); margin: 0; }
    details.rw-sec { gap: 0; }
    details.rw-sec > summary { list-style: none; cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--lumiverse-text-muted); padding: 0; }
    details.rw-sec > summary::-webkit-details-marker { display: none; }
    details.rw-sec > summary::after { content: ""; flex: 0 0 auto; width: 6px; height: 6px; margin-right: 2px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform .2s ease; opacity: .85; }
    details.rw-sec[open] > summary::after { transform: rotate(45deg); }
    details.rw-sec[open] > summary { margin-bottom: 13px; }
    .rw-sec-body { display: flex; flex-direction: column; gap: 10px; }

    .rw-field { display: flex; flex-direction: column; gap: 5px; }
    .rw-fieldlbl { font-size: 11px; color: var(--lumiverse-text-muted); }
    .rw-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .rw-label { font-size: 11px; color: var(--lumiverse-text-muted); }

    /* ── Text controls ── */
    .rw-area { width: 100%; min-height: 96px; resize: vertical; padding: 9px 11px; background: var(--lumiverse-fill); color: var(--lumiverse-text); border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); font: inherit; line-height: 1.5; outline: none; box-sizing: border-box; transition: border-color .15s ease, box-shadow .15s ease; }
    .rw-select, .rw-input { width: 100%; padding: 8px 11px; background: var(--lumiverse-fill); color: var(--lumiverse-text); border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); font: inherit; font-size: 12.5px; outline: none; box-sizing: border-box; transition: border-color .15s ease, box-shadow .15s ease; }
    .rw-area:focus, .rw-select:focus, .rw-input:focus { border-color: var(--rw-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--rw-accent) 22%, transparent); }
    .rw-area::placeholder, .rw-input::placeholder, .rw-area:-ms-input-placeholder { color: var(--lumiverse-text-muted); }
    .rw-select { appearance: none; -webkit-appearance: none; padding-right: 30px; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-opacity='0.65' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }
    .rw-num { width: 58px; text-align: right; padding: 6px 8px; font-size: 12px; font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
    .rw-num::-webkit-inner-spin-button, .rw-num::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

    /* ── Buttons ── */
    .rw-btns { display: flex; gap: 7px; flex-wrap: wrap; }
    .rw-btn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 5px 10px; border-radius: var(--lumiverse-radius); border: 1px solid var(--lumiverse-border); background: var(--lumiverse-fill); color: var(--lumiverse-text); cursor: pointer; font: inherit; font-size: 11.5px; line-height: 1.2; transition: background .15s ease, border-color .15s ease, color .15s ease, filter .15s ease; }
    .rw-btn:hover:not(:disabled) { background: var(--lumiverse-fill-hover); border-color: var(--lumiverse-border-hover); }
    .rw-btn:active:not(:disabled) { transform: translateY(1px); }
    .rw-btn:disabled { opacity: .4; cursor: default; }
    .rw-btn.full { width: 100%; }
    .rw-btn.primary { background: color-mix(in srgb, var(--rw-accent) 86%, #000); color: #fff; border-color: transparent; font-weight: 600; }
    .rw-btn.primary:hover:not(:disabled) { filter: brightness(1.14); }
    .rw-btn.run { width: 100%; padding: 7px; font-size: 12.5px; }
    .rw-btn.accent { background: color-mix(in srgb, var(--rw-accent) 13%, transparent); border-color: color-mix(in srgb, var(--rw-accent) 32%, transparent); color: var(--rw-accent-text); font-weight: 600; }
    .rw-btn.accent:hover:not(:disabled) { background: color-mix(in srgb, var(--rw-accent) 20%, transparent); border-color: color-mix(in srgb, var(--rw-accent) 45%, transparent); }

    /* ── Pill toggle (replaces raw checkboxes) ── */
    .rw-tog { display: flex; align-items: center; gap: 9px; cursor: pointer; font-size: 12.5px; color: var(--lumiverse-text); user-select: none; white-space: nowrap; }
    .rw-tog input { position: absolute; opacity: 0; width: 0; height: 0; }
    .rw-tog-sl { position: relative; flex: 0 0 auto; width: 34px; height: 19px; border-radius: 19px; background: var(--lumiverse-fill-strong); transition: background .2s ease; }
    .rw-tog-sl::before { content: ""; position: absolute; top: 3px; left: 3px; width: 13px; height: 13px; border-radius: 50%; background: var(--lumiverse-text-dim); transition: transform .2s ease, background .2s ease; }
    .rw-tog input:checked + .rw-tog-sl { background: color-mix(in srgb, var(--rw-accent) 42%, transparent); }
    .rw-tog input:checked + .rw-tog-sl::before { transform: translateX(15px); background: var(--rw-accent); }
    .rw-tog input:focus-visible + .rw-tog-sl { box-shadow: 0 0 0 2px color-mix(in srgb, var(--rw-accent) 35%, transparent); }
    .rw-tog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 11px 14px; }

    /* ── Length row ── */
    .rw-len-row { display: flex; align-items: center; gap: 11px; }
    .rw-len-row input[type=range] { flex: 1; min-width: 70px; accent-color: var(--rw-accent); height: 4px; cursor: pointer; }

    /* ── Status lines ── */
    .rw-status { font-size: 11px; color: var(--lumiverse-text-muted); min-height: 15px; }
    .rw-status.err { color: var(--lumiverse-danger); }
    #rw-cap { color: var(--lumiverse-text-muted); }
    #rw-cap.err { color: var(--lumiverse-danger); }
    .rw-delta { font-size: 11px; color: var(--lumiverse-text-muted); font-variant-numeric: tabular-nums; }

    /* ── Diff ── */
    .rw-diff { padding: 9px 11px; background: var(--lumiverse-fill); border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); font-size: 13px; line-height: 1.55; white-space: pre-wrap; max-height: 220px; overflow-y: auto; color: var(--lumiverse-text); }
    .rw-diff ins { background: color-mix(in srgb, var(--lumiverse-success) 24%, transparent); text-decoration: none; border-radius: 2px; }
    .rw-diff del { color: var(--lumiverse-danger); text-decoration: line-through; opacity: .8; }

    /* ── Managed-style list items ── */
    .rw-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); background: var(--lumiverse-fill); transition: border-color .15s ease; }
    .rw-item:hover { border-color: var(--lumiverse-border-hover); }
    .rw-item-name { flex: 1; min-width: 0; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rw-iconbtn { flex: 0 0 auto; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 1px solid transparent; border-radius: var(--lumiverse-radius-sm); background: transparent; color: var(--lumiverse-text-muted); cursor: pointer; font-size: 13px; transition: background .12s ease, color .12s ease; }
    .rw-iconbtn:hover { background: var(--lumiverse-fill-hover); color: var(--lumiverse-text); }
    .rw-subhd { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--lumiverse-text-muted); margin-top: 2px; }

    /* ── Cost panel (details) ── */
    .rw-cost { border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); background: var(--lumiverse-fill); font-size: 12px; }
    .rw-cost > summary { cursor: pointer; user-select: none; padding: 8px 11px; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--lumiverse-text-muted); }
    .rw-cost > summary::-webkit-details-marker { display: none; }
    .rw-cost > summary::before { content: ""; order: 2; flex: 0 0 auto; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform .2s ease; opacity: .7; }
    .rw-cost[open] > summary::before { transform: rotate(45deg); }
    .rw-cost-total { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--lumiverse-text); font-weight: 600; }
    .rw-cost-body { padding: 2px 11px 9px; display: flex; flex-direction: column; gap: 3px; border-top: 1px solid var(--lumiverse-border); margin-top: 0; padding-top: 8px; }
    .rw-cost-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--lumiverse-text-muted); }
    .rw-cost-line span:last-child { font-variant-numeric: tabular-nums; color: var(--lumiverse-text); }

    /* ── Tabs ── */
    .rw-tabs { display: flex; gap: 3px; background: var(--lumiverse-fill-medium); border-radius: var(--lumiverse-radius-md); padding: 3px; margin: 4px 0 2px; }
    .rw-tab { flex: 1; text-align: center; font: inherit; font-size: 11.5px; font-weight: 600; padding: 6px 4px; border: 0; border-radius: var(--lumiverse-radius-sm); background: transparent; color: var(--lumiverse-text-muted); cursor: pointer; transition: background .15s ease, color .15s ease; }
    .rw-tab:hover { color: var(--lumiverse-text); }
    .rw-tab.on { background: color-mix(in srgb, var(--rw-accent) 24%, transparent); color: #fff; }
    .rw-pane { display: none; flex-direction: column; }
    .rw-pane.on { display: flex; }

    /* ── Style chip grid ── */
    .rw-style-sel { margin-left: auto; font-size: 11px; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--lumiverse-text-muted); max-width: 58%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rw-cgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
    .rw-chip { display: flex; align-items: center; gap: 6px; text-align: left; padding: 0 10px; height: 29px; font: inherit; font-size: 11.5px; font-weight: 600; border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); background: var(--lumiverse-fill); color: var(--lumiverse-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; transition: background .15s ease, border-color .15s ease, color .15s ease; }
    .rw-chip:hover { border-color: var(--lumiverse-border-hover); background: var(--lumiverse-fill-hover); }
    .rw-chip.on { border-color: var(--rw-accent); background: color-mix(in srgb, var(--rw-accent) 24%, transparent); color: #fff; }
    .rw-chip.wide { grid-column: 1 / -1; }
    .rw-chip.auto { border-color: color-mix(in srgb, var(--rw-accent) 40%, transparent); background: color-mix(in srgb, var(--rw-accent) 13%, transparent); color: var(--rw-accent-text); }
    .rw-chip.auto.on { background: color-mix(in srgb, var(--rw-accent) 26%, transparent); color: #fff; }

    /* ── Taller output + compact action row ── */
    .rw-output { min-height: 150px; }
    .rw-actions { flex-wrap: nowrap; }
    .rw-actbtn { flex: 0 0 auto; width: 30px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--lumiverse-text-muted); }
    .rw-actbtn:hover:not(:disabled) { color: var(--lumiverse-text); }
    .rw-actbtn svg { width: 15px; height: 15px; }
    .rw-mi { width: 13px; height: 13px; flex: 0 0 auto; }

    /* ── Focus rings on non-form controls (form controls/toggles already ring) ── */
    .rw-tab:focus-visible, .rw-chip:focus-visible, .rw-btn:focus-visible, .rw-iconbtn:focus-visible {
      outline: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--rw-accent) 45%, transparent);
    }

    /* ── Narrow PANEL (container-keyed, not viewport — the drawer width is independent
       of the viewport): single-column grids + larger touch targets for the most-tapped controls. ── */
    @container rw (max-width: 360px) {
      .rw-tog-grid, .rw-cgrid { grid-template-columns: 1fr; }
      .rw-iconbtn { width: 34px; height: 34px; }
      .rw-actbtn { width: 38px; height: 36px; }
      .rw-tab { padding: 9px 4px; }
      .rw-chip { height: 38px; }
      .rw-actions { flex-wrap: wrap; }
    }

    @media (prefers-reduced-motion: reduce) {
      .rw-area, .rw-select, .rw-input, .rw-btn, .rw-tab, .rw-chip, .rw-item, .rw-iconbtn, .rw-tog-sl, .rw-tog-sl::before,
      details.rw-sec > summary::after, .rw-cost > summary::before { transition: none !important; }
    }
  `)

  const tab = ctx.ui.registerDrawerTab({
    id: "rewrite_assistant",
    title: "Rewrite",
    shortName: "Rewrite",
    description: "Rewrite selected message text with an LLM style profile",
    keywords: ["rewrite", "edit", "prose", "style"],
    iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  })

  const root = ctx.dom.createElement("div")
  root.className = "rw-panel"

  // Inline SVG icons (stroke=currentColor so they inherit the button's text/accent color),
  // replacing the ✨/✎/✕ glyphs so the AI-action and list-row buttons match the panel's icon set.
  const SPARKLE = `<svg class="rw-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2 5.2 1.8-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>`
  const EDIT_SVG = `<svg class="rw-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`
  const X_SVG = `<svg class="rw-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`
  const aiBtn = (label: string) => `${SPARKLE}<span>${label}</span>`

  root.innerHTML = `
    <div class="rw-tabs" id="rw-tabs" role="tablist" aria-label="Rewrite panel sections">
      <button class="rw-tab on" type="button" role="tab" id="rw-tab-rw" data-pane="rw" aria-controls="rw-pane-rw" aria-selected="true" tabindex="0">Rewrite</button>
      <button class="rw-tab" type="button" role="tab" id="rw-tab-ar" data-pane="ar" aria-controls="rw-pane-ar" aria-selected="false" tabindex="-1">Architect</button>
      <button class="rw-tab" type="button" role="tab" id="rw-tab-op" data-pane="op" aria-controls="rw-pane-op" aria-selected="false" tabindex="-1">Options</button>
    </div>

    <div class="rw-pane on" data-pane="rw" role="tabpanel" id="rw-pane-rw" aria-labelledby="rw-tab-rw" tabindex="0">
      <div class="rw-sec">
        <div class="rw-field">
          <span class="rw-fieldlbl">Connection</span>
          <select class="rw-select" id="rw-conn" aria-label="Connection"></select>
        </div>
      </div>

      <details class="rw-sec rw-style-sec" open>
        <summary><span>Style</span><span class="rw-style-sel" id="rw-style-sel"></span></summary>
        <div class="rw-sec-body">
          <select class="rw-select" id="rw-style" style="display:none;"></select>
          <div class="rw-cgrid" id="rw-style-grid"></div>
          <button class="rw-btn accent full" id="rw-autostyle" title="Generate a voice style from this chat's character">${aiBtn("Style this chat")}</button>
          <div id="rw-custom-wrap" style="display:none; flex-direction:column; gap:8px;">
            <select class="rw-select" id="rw-custom-saved" aria-label="Recent custom prompts"><option value="">— recent custom prompts —</option></select>
            <textarea class="rw-area" id="rw-custom" style="min-height:62px" placeholder="Type a one-off rewrite instruction…"></textarea>
            <div class="rw-btns"><button class="rw-btn accent" id="rw-refine">${aiBtn("Refine")}</button><button class="rw-btn" id="rw-save-as-style">Save as style…</button></div>
          </div>
        </div>
      </details>

      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Input</span><label class="rw-tog" title="Auto-capture highlighted text"><input type="checkbox" id="rw-watch" /><span class="rw-tog-sl"></span>Watch</label></div>
        <textarea class="rw-area" id="rw-input" placeholder="Highlight text in a message (Watch on), or type here. Alt+R captures the selection."></textarea>
        <div class="rw-status" id="rw-cap" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="rw-len-row">
          <span class="rw-label" id="rw-len-label">Length</span>
          <input type="range" id="rw-len" min="25" max="200" step="5" value="100" aria-label="Length percent" />
          <input type="number" id="rw-lenval" min="1" max="1000" value="100" class="rw-input rw-num" title="Target length % (1–1000)" aria-label="Length percent" />
        </div>
        <details class="rw-cost" id="rw-cost">
          <summary><span>Estimated cost</span><span class="rw-cost-total" id="rw-cost-total">≈ 0 tokens</span></summary>
          <div class="rw-cost-body" id="rw-cost-body"></div>
        </details>
        <button class="rw-btn primary run" id="rw-run">Run</button>
      </div>

      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Output</span><span id="rw-delta" class="rw-delta"></span></div>
        <textarea class="rw-area rw-output" id="rw-output" placeholder="The rewrite appears here (editable before applying)."></textarea>
        <label class="rw-tog"><input type="checkbox" id="rw-diff-toggle" /><span class="rw-tog-sl"></span>Show diff</label>
        <div id="rw-diff" class="rw-diff" style="display:none;"></div>
        <div class="rw-btns rw-actions">
          <button class="rw-btn primary" id="rw-apply" style="flex:1;">Apply to message</button>
          <button class="rw-btn rw-actbtn" id="rw-undo" type="button" aria-label="Undo" title="Undo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></button>
          <button class="rw-btn rw-actbtn" id="rw-redo" type="button" aria-label="Redo" title="Redo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg></button>
          <button class="rw-btn rw-actbtn" id="rw-copy" type="button" aria-label="Copy" title="Copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        </div>
        <div class="rw-status" id="rw-msg" role="status" aria-live="polite" aria-atomic="true"></div>
      </div>

      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Context</span></div>
        <div class="rw-tog-grid">
          <label class="rw-tog"><input type="checkbox" id="rw-ctx-prev" /><span class="rw-tog-sl"></span>Prev msgs</label>
          <label class="rw-tog"><input type="checkbox" id="rw-ctx-char" /><span class="rw-tog-sl"></span>Character</label>
          <label class="rw-tog"><input type="checkbox" id="rw-ctx-persona" /><span class="rw-tog-sl"></span>Persona</label>
          <label class="rw-tog"><input type="checkbox" id="rw-ctx-speaker" /><span class="rw-tog-sl"></span>Speaker</label>
          <label class="rw-tog"><input type="checkbox" id="rw-ctx-memory" /><span class="rw-tog-sl"></span>Memory</label>
          <label class="rw-tog"><input type="checkbox" id="rw-ctx-lore" /><span class="rw-tog-sl"></span>Lore</label>
        </div>
      </div>
    </div>

    <div class="rw-pane" data-pane="ar" role="tabpanel" id="rw-pane-ar" aria-labelledby="rw-tab-ar" tabindex="0">
      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Create a style</span></div>
        <input class="rw-input" id="rw-newprof-name" placeholder="New style name" />
        <textarea class="rw-area" id="rw-newprof-prompt" style="min-height:52px" placeholder="Instruction for this style…"></textarea>
        <div class="rw-btns"><button class="rw-btn accent" id="rw-newprof-add">Add style</button></div>
      </div>
      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Generate with AI</span></div>
        <input class="rw-input" id="rw-architect-desc" placeholder="Describe a style for AI to write…" />
        <div class="rw-btns"><button class="rw-btn accent" id="rw-architect">${aiBtn("AI generate style")}</button></div>
      </div>
      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Saved styles</span></div>
        <div id="rw-custom-profiles" style="display:flex;flex-direction:column;gap:6px;"></div>
        <div class="rw-subhd">Hide built-ins</div>
        <div id="rw-hide-builtins" class="rw-tog-grid"></div>
      </div>
    </div>

    <div class="rw-pane" data-pane="op" role="tabpanel" id="rw-pane-op" aria-labelledby="rw-tab-op" tabindex="0">
      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Behaviour</span></div>
        <div class="rw-tog-grid">
          <label class="rw-tog"><input type="checkbox" id="rw-concise" /><span class="rw-tog-sl"></span>Concise prompt</label>
          <label class="rw-tog"><input type="checkbox" id="rw-autoapply" /><span class="rw-tog-sl"></span>Auto-apply</label>
          <label class="rw-tog"><input type="checkbox" id="rw-debug" /><span class="rw-tog-sl"></span>Debug log</label>
        </div>
        <div class="rw-row"><span class="rw-label">Undo depth</span><input type="number" id="rw-histdepth" min="1" max="100" value="30" class="rw-input rw-num" title="Undo/redo history depth (1–100)" aria-label="Undo history depth" /></div>
      </div>
      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Data</span></div>
        <div class="rw-btns"><button class="rw-btn" id="rw-export">Export settings</button><button class="rw-btn" id="rw-import">Import settings</button><button class="rw-btn" id="rw-export-debug">Export debug</button><button class="rw-btn" id="rw-reset">Reset to defaults</button></div>
      </div>
    </div>
  `
  tab.root.appendChild(root)

  const $ = <T extends HTMLElement>(id: string) => root.querySelector(`#${id}`) as T
  const connEl = $("rw-conn") as HTMLSelectElement
  const watchEl = $("rw-watch") as HTMLInputElement
  const conciseEl = $("rw-concise") as HTMLInputElement
  const autoApplyEl = $("rw-autoapply") as HTMLInputElement
  const debugEl = $("rw-debug") as HTMLInputElement
  const exportDebugBtn = $("rw-export-debug") as HTMLButtonElement
  const inputEl = $("rw-input") as HTMLTextAreaElement
  const capEl = $("rw-cap")
  const styleEl = $("rw-style") as HTMLSelectElement
  const styleGridEl = $("rw-style-grid")
  const styleSelEl = $("rw-style-sel")
  const tabsEl = $("rw-tabs")
  const lenEl = $("rw-len") as HTMLInputElement
  const lenValEl = $("rw-lenval") as HTMLInputElement
  const runBtn = $("rw-run") as HTMLButtonElement
  const outputEl = $("rw-output") as HTMLTextAreaElement
  const applyBtn = $("rw-apply") as HTMLButtonElement
  const undoBtn = $("rw-undo") as HTMLButtonElement
  const redoBtn = $("rw-redo") as HTMLButtonElement
  const copyBtn = $("rw-copy") as HTMLButtonElement
  const msgEl = $("rw-msg")
  const diffToggle = $("rw-diff-toggle") as HTMLInputElement
  const deltaEl = $("rw-delta")
  const diffEl = $("rw-diff")
  const ctxPrev = $("rw-ctx-prev") as HTMLInputElement
  const ctxChar = $("rw-ctx-char") as HTMLInputElement
  const ctxPersona = $("rw-ctx-persona") as HTMLInputElement
  const ctxSpeaker = $("rw-ctx-speaker") as HTMLInputElement
  const ctxMemory = $("rw-ctx-memory") as HTMLInputElement
  const ctxLore = $("rw-ctx-lore") as HTMLInputElement
  const costEl = $("rw-cost") as HTMLDetailsElement
  const costTotalEl = $("rw-cost-total")
  const costBodyEl = $("rw-cost-body")
  const customWrap = $("rw-custom-wrap") as HTMLDivElement
  const customEl = $("rw-custom") as HTMLTextAreaElement
  const customSavedEl = $("rw-custom-saved") as HTMLSelectElement

  const customProfListEl = $("rw-custom-profiles")
  const newProfName = $("rw-newprof-name") as HTMLInputElement
  const newProfPrompt = $("rw-newprof-prompt") as HTMLTextAreaElement
  const newProfAdd = $("rw-newprof-add") as HTMLButtonElement
  const hideBuiltinsEl = $("rw-hide-builtins")
  const histDepthEl = $("rw-histdepth") as HTMLInputElement
  const exportBtn = $("rw-export") as HTMLButtonElement
  const importBtn = $("rw-import") as HTMLButtonElement
  const refineBtn = $("rw-refine") as HTMLButtonElement
  const saveAsStyleBtn = $("rw-save-as-style") as HTMLButtonElement
  const archDescEl = $("rw-architect-desc") as HTMLInputElement
  const architectBtn = $("rw-architect") as HTMLButtonElement
  const autoStyleBtn = $("rw-autostyle") as HTMLButtonElement
  const resetBtn = $("rw-reset") as HTMLButtonElement
  const TAB_ORDER = ["rw", "ar", "op"]
  function switchTab(name: string) {
    tabsEl.querySelectorAll(".rw-tab").forEach((t) => {
      const el = t as HTMLElement
      const on = el.dataset.pane === name
      el.classList.toggle("on", on)
      el.setAttribute("aria-selected", on ? "true" : "false")
      el.tabIndex = on ? 0 : -1
    })
    root.querySelectorAll(".rw-pane").forEach((p) => (p as HTMLElement).classList.toggle("on", (p as HTMLElement).dataset.pane === name))
  }
  tabsEl.querySelectorAll(".rw-tab").forEach((t) => {
    t.addEventListener("click", () => switchTab((t as HTMLElement).dataset.pane as string))
    t.addEventListener("keydown", (e) => {
      const ke = e as KeyboardEvent
      const i = TAB_ORDER.indexOf((t as HTMLElement).dataset.pane as string)
      let j = -1
      if (ke.key === "ArrowRight" || ke.key === "ArrowDown") j = (i + 1) % TAB_ORDER.length
      else if (ke.key === "ArrowLeft" || ke.key === "ArrowUp") j = (i - 1 + TAB_ORDER.length) % TAB_ORDER.length
      else if (ke.key === "Home") j = 0
      else if (ke.key === "End") j = TAB_ORDER.length - 1
      if (j < 0) return
      ke.preventDefault()
      switchTab(TAB_ORDER[j])
      ;(tabsEl.querySelector(`.rw-tab[data-pane="${TAB_ORDER[j]}"]`) as HTMLElement | null)?.focus()
    })
  })
  // Mark static section titles as headings for screen-reader navigation (the <details>
  // sections already expose structure via their <summary>).
  root.querySelectorAll(".rw-sec-hd > span:first-child").forEach((s) => { s.setAttribute("role", "heading"); s.setAttribute("aria-level", "3") })
  root.querySelectorAll(".rw-subhd").forEach((s) => { s.setAttribute("role", "heading"); s.setAttribute("aria-level", "4") })

  // The Style <select> stays in the DOM as the single source of truth (all the existing
  // value/option/change logic is untouched); this just mirrors it as a tappable chip grid.
  function renderStyleChips() {
    styleGridEl.replaceChildren()
    for (const o of [...styleEl.options]) {
      const chip = ctx.dom.createElement("button") as HTMLButtonElement
      chip.type = "button"
      chip.className = "rw-chip"
      const isSel = o.value === styleEl.value
      if (isSel) chip.classList.add("on")
      chip.setAttribute("aria-pressed", isSel ? "true" : "false")
      if (o.value.startsWith("auto:")) chip.classList.add("auto", "wide")
      if (o.value === "__custom__") chip.classList.add("wide")
      chip.textContent = o.textContent
      chip.title = o.textContent ?? ""
      chip.addEventListener("click", () => { styleEl.value = o.value; styleEl.dispatchEvent(new Event("change")) })
      styleGridEl.appendChild(chip)
    }
    const sel = styleEl.options[styleEl.selectedIndex]
    styleSelEl.textContent = sel ? (sel.textContent ?? "") : ""
  }

  let customProfilesList: { id: string; name: string; prompt: string }[] = []
  let hiddenProfilesList: string[] = []
  let autoProfilesMap: Record<string, { name: string; prompt: string }> = {}
  let pendingConnId = ""
  let lastConfig: RewriteConfig | null = null
  let running = false
  let editingProfileId: string | null = null

  function rebuildStyleOptions() {
    const cur = styleEl.value
    styleEl.replaceChildren()
    const co = ctx.dom.createElement("option") as HTMLOptionElement
    co.value = "__custom__"; co.textContent = "Custom…"
    styleEl.appendChild(co)
    const a = ctx.getActiveChat()
    const auto = a.chatId ? autoProfilesMap[a.chatId] : undefined
    if (auto) {
      const o = ctx.dom.createElement("option") as HTMLOptionElement
      o.value = "auto:" + a.chatId; o.textContent = auto.name
      styleEl.appendChild(o)
    }
    for (const p of [...DEF_PROFILES].sort((a, b) => a.order - b.order)) {
      if (hiddenProfilesList.includes(p.id)) continue
      const o = ctx.dom.createElement("option") as HTMLOptionElement
      o.value = p.id; o.textContent = p.name
      styleEl.appendChild(o)
    }
    for (const p of customProfilesList) {
      const o = ctx.dom.createElement("option") as HTMLOptionElement
      o.value = p.id; o.textContent = p.name
      styleEl.appendChild(o)
    }
    if (cur && [...styleEl.options].some((o) => o.value === cur)) styleEl.value = cur
    else {
      // Default to the first real built-in style (skip the Custom… / auto entries) so the
      // panel opens ready to rewrite rather than on an empty Custom prompt.
      const firstBuiltin = [...styleEl.options].find((o) => o.value !== "__custom__" && !o.value.startsWith("auto:"))
      if (firstBuiltin) styleEl.value = firstBuiltin.value
    }
    renderStyleChips()
  }

  function renderStyleMgmt() {
    customProfListEl.replaceChildren()
    for (const p of customProfilesList) {
      const row = ctx.dom.createElement("div"); row.className = "rw-item"
      const lab = ctx.dom.createElement("span"); lab.className = "rw-item-name"; lab.textContent = p.name
      const editBtnRow = ctx.dom.createElement("button"); editBtnRow.className = "rw-iconbtn"; editBtnRow.innerHTML = EDIT_SVG
      editBtnRow.title = "Edit this style"; editBtnRow.setAttribute("aria-label", "Edit style")
      editBtnRow.addEventListener("click", () => {
        newProfName.value = p.name; newProfPrompt.value = p.prompt
        editingProfileId = p.id
        newProfAdd.textContent = "Update"
        switchTab("ar")
        newProfName.focus()
      })
      const del = ctx.dom.createElement("button"); del.className = "rw-iconbtn"; del.innerHTML = X_SVG
      del.title = "Delete this style"; del.setAttribute("aria-label", "Delete style")
      del.addEventListener("click", () => {
        customProfilesList = customProfilesList.filter((x) => x.id !== p.id)
        if (editingProfileId === p.id) { editingProfileId = null; newProfAdd.textContent = "Add style"; newProfName.value = ""; newProfPrompt.value = "" }
        ctx.sendToBackend({ type: "update_config", config: { customProfiles: customProfilesList } })
        rebuildStyleOptions(); renderStyleMgmt()
      })
      row.appendChild(lab); row.appendChild(editBtnRow); row.appendChild(del); customProfListEl.appendChild(row)
    }
    hideBuiltinsEl.replaceChildren()
    for (const b of [...DEF_PROFILES].sort((a, c) => a.order - c.order)) {
      const lab = ctx.dom.createElement("label"); lab.className = "rw-tog"
      const cb = ctx.dom.createElement("input") as HTMLInputElement
      cb.type = "checkbox"; cb.checked = hiddenProfilesList.includes(b.id)
      cb.addEventListener("change", () => {
        hiddenProfilesList = cb.checked
          ? [...new Set([...hiddenProfilesList, b.id])]
          : hiddenProfilesList.filter((x) => x !== b.id)
        ctx.sendToBackend({ type: "update_config", config: { hiddenProfiles: hiddenProfilesList } })
        rebuildStyleOptions()
      })
      const sl = ctx.dom.createElement("span"); sl.className = "rw-tog-sl"
      lab.appendChild(cb); lab.appendChild(sl); lab.appendChild(document.createTextNode(b.name))
      hideBuiltinsEl.appendChild(lab)
    }
  }

  newProfAdd.addEventListener("click", () => {
    const nm = newProfName.value.trim(); const pr = newProfPrompt.value.trim()
    if (!nm || !pr) { setStatus(msgEl, "Enter a name and an instruction for the style.", true); return }
    if (editingProfileId) {
      const eid = editingProfileId
      customProfilesList = customProfilesList.map((x) => x.id === eid ? { id: eid, name: nm, prompt: pr } : x)
      editingProfileId = null
      newProfAdd.textContent = "Add style"
      ctx.sendToBackend({ type: "update_config", config: { customProfiles: customProfilesList } })
      newProfName.value = ""; newProfPrompt.value = ""
      rebuildStyleOptions(); renderStyleMgmt()
      setStatus(msgEl, `Updated style "${nm}".`)
    } else {
      const id = "cp_" + Date.now().toString(36)
      customProfilesList = [...customProfilesList, { id, name: nm, prompt: pr }]
      ctx.sendToBackend({ type: "update_config", config: { customProfiles: customProfilesList } })
      newProfName.value = ""; newProfPrompt.value = ""
      rebuildStyleOptions(); renderStyleMgmt(); styleEl.value = id; styleEl.dispatchEvent(new Event("change"))
      setStatus(msgEl, `Added style "${nm}".`)
    }
  })

  exportBtn.addEventListener("click", () => {
    if (!lastConfig) { setStatus(msgEl, "Settings not loaded yet.", true); return }
    const { customProfiles, customPrompts, hiddenProfiles, usePrevMessages, prevMessageCount,
      speakerAware, useCharCard, useUserPersona, useMemory, useLorebook,
      lengthPct, concise, autoApply } = lastConfig
    const obj = { version: 1, customProfiles, customPrompts, hiddenProfiles, usePrevMessages,
      prevMessageCount, speakerAware, useCharCard, useUserPersona, useMemory, useLorebook,
      lengthPct, concise, autoApply }
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "rewrite-settings.json"
    a.click()
    URL.revokeObjectURL(a.href)
    setStatus(msgEl, "Settings exported.")
  })

  importBtn.addEventListener("click", async () => {
    const files = await ctx.uploads.pickFile({ accept: [".json", "application/json"] })
    if (!files.length) return
    const text = new TextDecoder().decode(files[0].bytes)
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { setStatus(msgEl, "Import failed: not valid JSON.", true); return }
    const clean = sanitizeImport(parsed)
    ctx.sendToBackend({ type: "update_config", config: clean })
    setStatus(msgEl, "Settings imported.")
  })

  refineBtn.addEventListener("click", () => {
    if (!customEl.value.trim()) { setStatus(msgEl, "Enter a custom instruction to refine.", true); return }
    refineBtn.disabled = true; refineBtn.innerHTML = aiBtn("Refining…")
    ctx.sendToBackend({ type: "refine_prompt", text: customEl.value, connectionId: connEl.value })
  })

  saveAsStyleBtn.addEventListener("click", () => {
    if (!customEl.value.trim()) { setStatus(msgEl, "Nothing to save — type a custom instruction first.", true); return }
    newProfPrompt.value = customEl.value
    switchTab("ar")
    newProfName.focus()
    setStatus(msgEl, "Name it and click Add to save as a style.")
  })

  resetBtn.addEventListener("click", async () => {
    const { confirmed } = await ctx.ui.showConfirm({
      title: "Reset to defaults",
      message: "This will restore all settings to their defaults and clear the undo/redo history. Your connection will be preserved.",
      variant: "danger",
      confirmLabel: "Reset",
    })
    if (!confirmed) return
    ctx.sendToBackend({ type: "reset_config" })
  })

  architectBtn.addEventListener("click", () => {
    if (!archDescEl.value.trim()) { setStatus(msgEl, "Enter a description for the AI to generate a style.", true); return }
    architectBtn.disabled = true; architectBtn.innerHTML = aiBtn("Generating…")
    ctx.sendToBackend({ type: "architect_style", description: archDescEl.value, connectionId: connEl.value })
  })

  autoStyleBtn.addEventListener("click", () => {
    const a = ctx.getActiveChat()
    if (!a.chatId || !a.characterId) { setStatus(msgEl, "Open a chat with a character first.", true); return }
    if (!connEl.value) { setStatus(msgEl, "Select a connection first.", true); return }
    autoStyleBtn.disabled = true; setStatus(msgEl, "Generating a chat style…")
    ctx.sendToBackend({ type: "gen_autoprofile", chatId: a.chatId, characterId: a.characterId, connectionId: connEl.value })
  })

  function populateConnections(list: { id: string; name: string; model: string }[]) {
    connEl.replaceChildren()
    const none = ctx.dom.createElement("option") as HTMLOptionElement
    none.value = ""; none.textContent = "— select a connection —"
    connEl.appendChild(none)
    for (const c of list) {
      const o = ctx.dom.createElement("option") as HTMLOptionElement
      o.value = c.id; o.textContent = c.model ? `${c.name} — ${c.model}` : c.name
      connEl.appendChild(o)
    }
    if (pendingConnId && [...connEl.options].some(o => o.value === pendingConnId)) connEl.value = pendingConnId
  }

  rebuildStyleOptions()
  renderStyleMgmt()

  let customPromptsList: string[] = []
  function repopulateSaved() {
    customSavedEl.replaceChildren()
    const head = ctx.dom.createElement("option") as HTMLOptionElement
    head.value = ""; head.textContent = "— recent custom prompts —"
    customSavedEl.appendChild(head)
    for (const c of customPromptsList) {
      const o = ctx.dom.createElement("option") as HTMLOptionElement
      o.value = c; o.textContent = c.length > 50 ? c.slice(0, 50) + "…" : c
      customSavedEl.appendChild(o)
    }
  }
  function saveCustom(text: string) {
    customPromptsList = [text, ...customPromptsList.filter((c) => c !== text)].slice(0, 8)
    repopulateSaved()
    ctx.sendToBackend({ type: "update_config", config: { customPrompts: customPromptsList } })
  }

  let capture: Capture | null = null
  let multiCapture: { chatId: string; segments: MultiSeg[]; sig: string } | null = null
  const SEG_SEP = "\n— — —\n"

  function setStatus(el: HTMLElement, text: string, isErr = false) {
    el.textContent = text
    el.className = "rw-status" + (isErr ? " err" : "")
    // Escalate errors to an assertive live region so a screen reader interrupts; routine
    // confirmations stay polite.
    el.setAttribute("aria-live", isErr ? "assertive" : "polite")
  }

  function updateDiffView() {
    if (diffToggle.checked && outputEl.value) {
      renderDiff(diffEl, inputEl.value, outputEl.value)
      diffEl.style.display = "block"
    } else {
      diffEl.style.display = "none"
    }
    const d = wc(outputEl.value) - wc(inputEl.value)
    deltaEl.textContent = outputEl.value ? `${d >= 0 ? "+" : ""}${d} words` : ""
  }

  // ── Live token-cost estimation (debounced; separate timer so it never fights
  // the watch-capture debounce). Reads the current selection/style/context state
  // and asks the backend for a per-source breakdown of the prompt token cost.
  let previewTimer: ReturnType<typeof setTimeout> | null = null
  function schedulePreview() {
    if (previewTimer) clearTimeout(previewTimer)
    previewTimer = setTimeout(() => {
      previewTimer = null
      const text = inputEl.value
      if (!text.trim()) {
        // Clear the panel without a round-trip.
        costTotalEl.textContent = "≈ 0 tokens"
        costBodyEl.replaceChildren()
        return
      }
      const isCustom = styleEl.value === "__custom__"
      const active = ctx.getActiveChat()
      ctx.sendToBackend({
        type: "preview_tokens",
        text,
        profileId: styleEl.value,
        customPrompt: isCustom ? customEl.value : undefined,
        concise: conciseEl.checked,
        lengthPct: parseInt(lenValEl.value, 10) || 100,
        // multiCapture omits messageId (prev/speaker need one) — character/lore/memory still assemble.
        chatId: capture?.chatId ?? active.chatId ?? undefined,
        messageId: capture?.messageId,
        characterId: active.characterId ?? undefined,
      })
    }, 400)
  }

  // ── Watch-mode selection capture (debounced) ──
  let debounce: ReturnType<typeof setTimeout> | null = null
  let runTimer: ReturnType<typeof setTimeout> | null = null
  function doCapture(): boolean {
    const chatId = ctx.getActiveChat().chatId
    if (!chatId) return false
    // Multi-message selection takes priority — but only when it spans ≥2 messages.
    const multi = captureMultiSelection()
    if (multi && multi.segments.length >= 2) {
      const sig = multi.segments.map((s) => `${s.messageId}:${s.rs}:${s.re}`).join("|")
      // Idempotent: a stray selectionchange on the SAME selection must not rebuild the
      // capture — that would wipe the outputs rewrite_multi_result attached to the segments.
      if (multiCapture && multiCapture.sig === sig) return true
      multiCapture = { chatId, segments: multi.segments, sig }
      capture = null
      inputEl.value = multi.segments.map((s) => s.text).join(SEG_SEP)
      outputEl.readOnly = true
      setStatus(capEl, `captured ✓ ${multi.segments.length} messages`)
      schedulePreview()
      return true
    }
    // Fall back to the single-message path (unchanged).
    const result = captureSelection()
    if (!result) return false
    result.cap.chatId = chatId
    capture = result.cap
    multiCapture = null
    outputEl.readOnly = false
    inputEl.value = result.text
    setStatus(capEl, `captured ✓ from message ${result.cap.messageId.slice(0, 8)} (${result.text.length} chars)`)
    schedulePreview()
    return true
  }
  const onSelectionChange = () => {
    if (!watchEl.checked) return
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(doCapture, 200)
  }
  document.addEventListener("selectionchange", onSelectionChange)
  // Alt+R: capture the current selection on demand (works even with Watch off).
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "r" || e.key === "R")) {
      if (doCapture()) e.preventDefault()
    }
  }
  document.addEventListener("keydown", onKeyDown)

  // ── Controls ──
  lenEl.addEventListener("input", () => { lenValEl.value = lenEl.value })
  lenEl.addEventListener("change", () => { ctx.sendToBackend({ type: "update_config", config: { lengthPct: parseInt(lenEl.value, 10) } }); schedulePreview() })
  lenValEl.addEventListener("change", () => {
    let v = parseInt(lenValEl.value, 10)
    if (!Number.isFinite(v)) v = 100
    v = Math.max(1, Math.min(1000, v))
    lenValEl.value = String(v)
    lenEl.value = String(Math.min(v, 200))
    ctx.sendToBackend({ type: "update_config", config: { lengthPct: v } })
    schedulePreview()
  })
  autoApplyEl.addEventListener("change", () => ctx.sendToBackend({ type: "update_config", config: { autoApply: autoApplyEl.checked } }))
  debugEl.addEventListener("change", () => ctx.sendToBackend({ type: "update_config", config: { debug: debugEl.checked } }))
  histDepthEl.addEventListener("change", () => {
    let v = parseInt(histDepthEl.value, 10)
    if (!Number.isFinite(v)) v = 30
    v = Math.max(1, Math.min(100, v))
    histDepthEl.value = String(v)
    ctx.sendToBackend({ type: "update_config", config: { historyDepth: v } })
  })

  exportDebugBtn.addEventListener("click", () => {
    ctx.sendToBackend({ type: "get_debug" })
  })
  connEl.addEventListener("change", () => ctx.sendToBackend({ type: "update_config", config: { connectionId: connEl.value } }))
  watchEl.addEventListener("change", () => ctx.sendToBackend({ type: "update_config", config: { watch: watchEl.checked } }))
  conciseEl.addEventListener("change", () => { ctx.sendToBackend({ type: "update_config", config: { concise: conciseEl.checked } }); schedulePreview() })
  ctxPrev.addEventListener("change", () => { ctx.sendToBackend({ type: "update_config", config: { usePrevMessages: ctxPrev.checked } }); schedulePreview() })
  ctxChar.addEventListener("change", () => { ctx.sendToBackend({ type: "update_config", config: { useCharCard: ctxChar.checked } }); schedulePreview() })
  ctxPersona.addEventListener("change", () => { ctx.sendToBackend({ type: "update_config", config: { useUserPersona: ctxPersona.checked } }); schedulePreview() })
  ctxSpeaker.addEventListener("change", () => { ctx.sendToBackend({ type: "update_config", config: { speakerAware: ctxSpeaker.checked } }); schedulePreview() })
  ctxMemory.addEventListener("change", () => { ctx.sendToBackend({ type: "update_config", config: { useMemory: ctxMemory.checked } }); schedulePreview() })
  ctxLore.addEventListener("change", () => { ctx.sendToBackend({ type: "update_config", config: { useLorebook: ctxLore.checked } }); schedulePreview() })
  styleEl.addEventListener("change", () => { customWrap.style.display = styleEl.value === "__custom__" ? "flex" : "none"; renderStyleChips(); schedulePreview() })
  customSavedEl.addEventListener("change", () => { if (customSavedEl.value) { customEl.value = customSavedEl.value; schedulePreview() } })
  // Typing into the input or a custom instruction changes the estimate too.
  inputEl.addEventListener("input", schedulePreview)
  customEl.addEventListener("input", schedulePreview)
  // Persist the cost panel's collapse state and refresh the estimate when expanded.
  costEl.addEventListener("toggle", () => {
    ctx.sendToBackend({ type: "update_config", config: { costCollapsed: !costEl.open } })
    if (costEl.open) schedulePreview()
  })
  diffToggle.addEventListener("change", () => {
    ctx.sendToBackend({ type: "update_config", config: { showDiff: diffToggle.checked } })
    updateDiffView()
  })
  outputEl.addEventListener("input", updateDiffView)

  function endRun() {
    running = false
    runBtn.disabled = false
    runBtn.textContent = "Run"
    runBtn.removeAttribute("aria-busy")
    if (runTimer) { clearTimeout(runTimer); runTimer = null }
  }

  runBtn.addEventListener("click", () => {
    if (running) { ctx.sendToBackend({ type: "cancel" }); return }
    const isCustom = styleEl.value === "__custom__"
    const customText = isCustom ? customEl.value.trim() : ""
    if (isCustom && !customText) { setStatus(msgEl, "Enter a custom instruction.", true); return }
    if (!inputEl.value.trim()) { setStatus(msgEl, "Nothing to rewrite — input is empty.", true); return }
    running = true; runBtn.textContent = "Cancel"; runBtn.setAttribute("aria-busy", "true"); setStatus(msgEl, "")
    if (runTimer) clearTimeout(runTimer)
    runTimer = setTimeout(() => {
      runTimer = null
      running = false; runBtn.disabled = false; runBtn.textContent = "Run"; runBtn.removeAttribute("aria-busy")
      setStatus(msgEl, "Timed out waiting for a response. Try again.", true)
    }, RUN_WATCHDOG_MS)
    const active = ctx.getActiveChat()
    if (multiCapture) {
      ctx.sendToBackend({
        type: "rewrite_multi",
        segments: multiCapture.segments.map((s) => ({ messageId: s.messageId, text: s.text })),
        profileId: styleEl.value,
        customPrompt: isCustom ? customText : undefined,
        concise: conciseEl.checked,
        connectionId: connEl.value,
        lengthPct: parseInt(lenValEl.value, 10) || 100,
        chatId: multiCapture.chatId,
        characterId: active.characterId ?? undefined,
      })
    } else {
      ctx.sendToBackend({
        type: "rewrite",
        profileId: styleEl.value,
        customPrompt: isCustom ? customText : undefined,
        text: inputEl.value,
        concise: conciseEl.checked,
        connectionId: connEl.value,
        lengthPct: parseInt(lenValEl.value, 10) || 100,
        chatId: capture?.chatId ?? active.chatId ?? undefined,
        messageId: capture?.messageId,
        characterId: active.characterId ?? undefined,
      })
    }
    if (isCustom) saveCustom(customText)
  })

  applyBtn.addEventListener("click", () => {
    if (multiCapture) {
      const items = multiCapture.segments
        .filter((s) => s.output != null)
        .map((s) => ({ messageId: s.messageId, R: s.R, rs: s.rs, re: s.re, output: s.output as string }))
      if (!items.length) { setStatus(msgEl, "Output is empty — run a rewrite first.", true); return }
      if (multiCapture.chatId !== ctx.getActiveChat().chatId) {
        setStatus(msgEl, "That selection is from a different chat — switch back or re-select here.", true); return
      }
      applyBtn.disabled = true; setStatus(msgEl, "Applying…")
      ctx.sendToBackend({ type: "apply_multi", chatId: multiCapture.chatId, items })
      return
    }
    if (!capture) { setStatus(msgEl, "No captured selection. Turn on Watch mode and highlight text in a message.", true); return }
    if (!outputEl.value.trim()) { setStatus(msgEl, "Output is empty — run a rewrite first.", true); return }
    // Stale-capture guards. Refuse if the user switched chats, or if the captured message
    // changed since selection (edit/swipe/regenerate) — splicing into changed content can
    // silently land the rewrite in the wrong place.
    if (capture.chatId !== ctx.getActiveChat().chatId) {
      setStatus(msgEl, "That selection is from a different chat — switch back or re-select here.", true); return
    }
    const liveR = liveRenderedFor(capture.messageId)
    if (liveR === null || liveR !== capture.R) {
      capture = null
      setStatus(capEl, "")
      setStatus(msgEl, "The message changed since you selected it. Re-select the text and run again.", true)
      return
    }
    applyBtn.disabled = true; setStatus(msgEl, "Applying…")
    ctx.sendToBackend({
      type: "apply",
      chatId: capture.chatId,
      messageId: capture.messageId,
      R: capture.R,
      rs: capture.rs,
      re: capture.re,
      output: outputEl.value,
    })
  })

  undoBtn.addEventListener("click", () => ctx.sendToBackend({ type: "undo" }))
  redoBtn.addEventListener("click", () => ctx.sendToBackend({ type: "redo" }))

  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(outputEl.value); setStatus(msgEl, "Copied output.") }
    catch { setStatus(msgEl, "Copy failed.", true) }
  })

  // ── Backend responses ──
  const unsub = ctx.onBackendMessage((raw: unknown) => {
    const m = raw as BackendMsg
    switch (m.type) {
      case "config": {
        lastConfig = m.config as RewriteConfig
        const cfg = m.config as RewriteConfig
        pendingConnId = cfg.connectionId
        if ([...connEl.options].some(o => o.value === pendingConnId)) connEl.value = pendingConnId
        watchEl.checked = cfg.watch
        conciseEl.checked = cfg.concise
        lenEl.value = String(Math.min(cfg.lengthPct, 200))
        lenValEl.value = String(cfg.lengthPct)
        autoApplyEl.checked = cfg.autoApply
        debugEl.checked = cfg.debug ?? false
        ctxPrev.checked = cfg.usePrevMessages
        ctxChar.checked = cfg.useCharCard
        ctxPersona.checked = cfg.useUserPersona
        ctxSpeaker.checked = cfg.speakerAware
        ctxMemory.checked = cfg.useMemory
        ctxLore.checked = cfg.useLorebook
        customPromptsList = cfg.customPrompts || []
        repopulateSaved()
        customProfilesList = cfg.customProfiles || []
        hiddenProfilesList = cfg.hiddenProfiles || []
        autoProfilesMap = cfg.autoProfiles || {}
        rebuildStyleOptions()
        renderStyleMgmt()
        // Reflect the persisted cost-panel collapse state. Set the property directly to
        // avoid round-tripping the toggle handler back into update_config.
        costEl.open = !cfg.costCollapsed
        // Restore diff toggle and apply its show/hide effect.
        diffToggle.checked = cfg.showDiff ?? false
        updateDiffView()
        // Restore history depth input.
        histDepthEl.value = String(cfg.historyDepth ?? 30)
        // Refresh the estimate once after the initial sync if there's already input.
        if (inputEl.value.trim()) schedulePreview()
        break
      }
      case "rewrite_result": endRun(); outputEl.value = m.text; setStatus(msgEl, `Done.${m.tokens ? ` · prompt ~${m.tokens} tok` : ""}`); updateDiffView(); if (autoApplyEl.checked && capture) applyBtn.click(); break
      case "rewrite_multi_result": {
        endRun()
        if (multiCapture) {
          // Store each output onto its matching segment (by messageId).
          for (const r of m.segments) {
            const seg = multiCapture.segments.find((s) => s.messageId === r.messageId)
            if (seg) seg.output = r.output
          }
          outputEl.value = multiCapture.segments.map((s) => s.output ?? "").join(SEG_SEP)
          outputEl.readOnly = true
          const n = multiCapture.segments.filter((s) => s.output != null).length
          setStatus(msgEl, `Rewrote ${n} messages — Apply applies all.${m.tokens ? ` · prompt ~${m.tokens} tok` : ""}`)
          updateDiffView()
          if (autoApplyEl.checked) applyBtn.click()
        }
        break
      }
      case "rewrite_error": endRun(); setStatus(msgEl, m.error, true); break
      case "rewrite_cancelled": endRun(); setStatus(msgEl, "Cancelled."); break
      case "apply_done": applyBtn.disabled = false; undoBtn.disabled = !m.canUndo; redoBtn.disabled = !m.canRedo; setStatus(msgEl, "Applied to message ✓"); break
      case "apply_multi_done": {
        applyBtn.disabled = false
        undoBtn.disabled = !m.canUndo
        redoBtn.disabled = !m.canRedo
        setStatus(msgEl, `Applied ${m.applied} message(s).${m.skipped.length ? " Skipped " + m.skipped.length + " (couldn't locate)." : ""}`)
        multiCapture = null
        outputEl.readOnly = false
        break
      }
      case "apply_error": applyBtn.disabled = false; setStatus(msgEl, m.error, true); break
      case "undo_done": undoBtn.disabled = !m.canUndo; redoBtn.disabled = !m.canRedo; setStatus(msgEl, "Reverted ✓"); break
      case "undo_error": setStatus(msgEl, m.error, true); break
      case "redo_done": undoBtn.disabled = !m.canUndo; redoBtn.disabled = !m.canRedo; setStatus(msgEl, "Reapplied ✓"); break
      case "redo_error": setStatus(msgEl, m.error, true); break
      case "history": undoBtn.disabled = !m.canUndo; redoBtn.disabled = !m.canRedo; break
      case "connections": populateConnections(m.connections); break
      case "refine_result": refineBtn.disabled = false; refineBtn.innerHTML = aiBtn("Refine"); customEl.value = m.text; setStatus(msgEl, "Refined."); break
      case "refine_error": refineBtn.disabled = false; refineBtn.innerHTML = aiBtn("Refine"); setStatus(msgEl, m.error, true); break
      case "architect_result": architectBtn.disabled = false; architectBtn.innerHTML = aiBtn("AI generate style"); newProfName.value = m.name; newProfPrompt.value = m.prompt; setStatus(msgEl, "Style drafted — review and Add."); break
      case "architect_error": architectBtn.disabled = false; architectBtn.innerHTML = aiBtn("AI generate style"); setStatus(msgEl, m.error, true); break
      case "autoprofile_result": autoStyleBtn.disabled = false; autoProfilesMap[m.chatId] = { name: m.name, prompt: m.prompt }; rebuildStyleOptions(); styleEl.value = "auto:" + m.chatId; styleEl.dispatchEvent(new Event("change")); setStatus(msgEl, `Style ready: ${m.name}`); break
      case "autoprofile_error": autoStyleBtn.disabled = false; setStatus(msgEl, m.error, true); break
      case "debug": {
        const entries = (m as { type: "debug"; entries: DebugEntry[] }).entries
        if (!entries.length) { setStatus(msgEl, "Debug log is empty (enable Debug log, then run a rewrite)."); break }
        const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" })
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = "rewrite-debug.json"
        a.click()
        URL.revokeObjectURL(a.href)
        setStatus(msgEl, `Debug log exported (${entries.length} entr${entries.length === 1 ? "y" : "ies"}).`)
        break
      }
      case "token_estimate": {
        costTotalEl.textContent = `≈ ${m.total} tokens`
        costBodyEl.replaceChildren()
        const addLine = (label: string, tokens: number) => {
          const row = ctx.dom.createElement("div"); row.className = "rw-cost-line"
          const l = ctx.dom.createElement("span"); l.textContent = label
          const v = ctx.dom.createElement("span"); v.textContent = String(tokens)
          row.appendChild(l); row.appendChild(v); costBodyEl.appendChild(row)
        }
        addLine("selection", m.selection)
        for (const s of m.sources) addLine(s.label, s.tokens)
        addLine("system", m.system)
        break
      }
    }
  })

  redoBtn.disabled = true
  ctx.sendToBackend({ type: "get_config" })
  ctx.sendToBackend({ type: "get_connections" })
  ctx.sendToBackend({ type: "get_history" })

  return () => {
    document.removeEventListener("selectionchange", onSelectionChange)
    document.removeEventListener("keydown", onKeyDown)
    if (debounce) clearTimeout(debounce)
    if (runTimer) clearTimeout(runTimer)
    if (previewTimer) clearTimeout(previewTimer)
    unsub()
    removeStyle()
    ctx.dom.cleanup()
    tab.destroy()
  }
}
