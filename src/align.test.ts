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
