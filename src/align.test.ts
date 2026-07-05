import { test, expect } from "bun:test"
import { mapRenderedSpanToRaw, spliceRewrite } from "./align"

test("maps a span when rendered === raw (no transforms)", () => {
  const s = "The quick brown fox jumps."
  // select "quick brown" → indices 4..15
  const span = mapRenderedSpanToRaw(s, s, 4, 15)
  expect(span).not.toBeNull()
  expect(s.slice(span!.as, span!.ae)).toBe("quick brown")
})

test("maps a span across a markdown transform (rendered drops asterisks)", () => {
  const raw = "He said *hello* warmly to her."
  const rendered = "He said hello warmly to her." // emphasis markers stripped on render
  // in rendered, select "warmly" → indices 14..20
  const rs = rendered.indexOf("warmly")
  const span = mapRenderedSpanToRaw(rendered, raw, rs, rs + "warmly".length)
  expect(span).not.toBeNull()
  expect(raw.slice(span!.as, span!.ae)).toBe("warmly")
})

test("spliceRewrite replaces the located raw span with the output", () => {
  const raw = "He said *hello* warmly to her."
  const rendered = "He said hello warmly to her."
  const rs = rendered.indexOf("warmly")
  const out = spliceRewrite(raw, rendered, rs, rs + "warmly".length, "coldly")
  expect(out).toBe("He said *hello* coldly to her.")
})

test("spliceRewrite returns null when the span can't be located", () => {
  // R and A share almost nothing → no clean anchors
  const out = spliceRewrite("totally different raw text here", "xxxxxxxxxx", 2, 6, "Z")
  expect(out).toBeNull()
})

test("rejects an out-of-bounds re (the multi-paragraph capture bug)", () => {
  // Regression: captureSelection once set re = rs + Selection.toString().length, but
  // Selection.toString() adds paragraph newlines that Range-based R/rs omit, so on a
  // multi-paragraph message re could exceed R.length. The guard must reject that span
  // (return null) rather than splice with a bogus end — and an in-bounds re must still map.
  const R = "para onepara two" // Range.toString(): block newline dropped (n=16)
  const raw = "para one\n\npara two"
  expect(mapRenderedSpanToRaw(R, raw, 0, R.length + 2)).toBeNull() // re overshoots → reject
  expect(mapRenderedSpanToRaw(R, raw, 0, R.length)).not.toBeNull() // in-bounds → maps
})

test("selection that spans a markdown link splices correctly (URL content in raw doesn't break the guard)", () => {
  // v1.0.2 tightened the stale-guard too far: a legitimate selection that spans across a
  // markdown link failed because the URL characters (letters, slashes) survive
  // normForCompare and end up in rawSpan but not in sel. Subsequence check restores
  // the fix without reintroducing the substring-bypass bug.
  const raw = "See [Google](https://google.com) here."
  const R = "See Google here."
  const out = spliceRewrite(raw, R, 0, R.length, "REPL.")
  expect(out).not.toBeNull()
  expect(out).toContain("REPL")
})

test("large multi-paragraph message above the old 4M-cell cap now splices (v1.0.6)", () => {
  // Regression: previously n*m > 4M returned null from alignExact and the windowed
  // fallback couldn't handle full-message selections (no room to bracket). Bumped to 16M.
  const para = `She turned slowly, her eyes narrowing. "You think you're clever?" she said, voice low. This wasn't the response he had expected, and yet here they were — locked in this dance of wills he had somehow started.`
  const raw = Array(10).fill(para).join("\n\n")
  const R = raw.replace(/\n+/g, "")
  // n*m > 4M (was failing) but < 16M (now succeeds).
  expect(R.length * raw.length).toBeGreaterThan(4_000_000)
  const out = spliceRewrite(raw, R, 0, R.length, "REPL")
  expect(out).not.toBeNull()
})

test("multi-transform paragraph containing a link splices", () => {
  const raw = "This is [a link](https://example.com/foo) inside prose."
  const R = "This is a link inside prose."
  const out = spliceRewrite(raw, R, 0, R.length, "X.")
  expect(out).not.toBeNull()
})

test("stale selection whose normalized text SUBSUMES the raw span is rejected (no half-application)", () => {
  // Regression: previously the guard was `sel.includes(rawSpan) || rawSpan.includes(sel)`,
  // so selecting three words in a stale rendered R that later reduced to two words in raw
  // could splice into just the overlapping two, silently dropping a word from user intent.
  const liveRaw = "The fox jumps over the dog"
  const staleR = "The quick brown fox jumps over the log"
  const rs = staleR.indexOf("brown fox jumps")
  const out = spliceRewrite(liveRaw, staleR, rs, rs + "brown fox jumps".length, "REPL")
  expect(out).toBeNull()
})

test("spliceRewrite rejects a mid-surrogate splice boundary", () => {
  const raw = "hi 😀 world" // 11 code units, 😀 at 3-4
  // rs=3, re=4 lands mid-surrogate on both edges → reject.
  expect(spliceRewrite(raw, raw, 3, 4, "X")).toBeNull()
  // Full emoji [3,5) is valid → splices fine.
  expect(spliceRewrite(raw, raw, 3, 5, "X")).toBe("hi X world")
})

test("mapRenderedSpanToRaw handles a single-char rendered token wrapped in transforms", () => {
  // Regression: island-demotion used to nuke every anchor for '*a*' pattern and return null,
  // making it impossible to rewrite a bolded 'I' or single italic character.
  expect(mapRenderedSpanToRaw("a", "*a*", 0, 1)).not.toBeNull()
})

test("spliceRewrite rejects a stale selection that maps to a coincidental anchor", () => {
  // Stale capture: R (what the user selected against) no longer matches the live raw.
  // The shared prefix/suffix give alignExact a foothold, so it CAN map the selection's
  // position — onto the wrong raw word ("gamma"). The selection text ("WRONGWORD") does
  // not match that raw span, so the guard must refuse rather than corrupt the message.
  const liveRaw = "alpha beta gamma delta epsilon zeta"
  const staleR = "alpha beta WRONGWORD delta epsilon zeta"
  const rs = staleR.indexOf("WRONGWORD")
  const out = spliceRewrite(liveRaw, staleR, rs, rs + "WRONGWORD".length, "X")
  expect(out).toBeNull()
  // sanity: the same selection against MATCHING content still splices
  const ok = spliceRewrite("alpha beta gamma delta", "alpha beta gamma delta", 11, 16, "X")
  expect(ok).toBe("alpha beta X delta")
})
