import { test, expect } from "bun:test"
import { multiSegSpan } from "./frontend"

// The first message in a multi-bubble selection: the selection starts partway in and
// runs to the message's end. rs = offset to the selection start; re = full content length.
test("first segment spans from selection start to content end", () => {
  const R = "The quick brown fox jumps."
  const startLen = R.indexOf("brown") // 10
  const span = multiSegSpan("first", R.length, startLen, 0)
  expect(span).toEqual({ rs: 10, re: R.length })
  expect(R.slice(span.rs, span.re)).toBe("brown fox jumps.")
})

// A fully-enclosed middle message: the whole content is selected.
test("middle segment spans the entire content", () => {
  const R = "Entirely selected line."
  const span = multiSegSpan("middle", R.length, 0, 0)
  expect(span).toEqual({ rs: 0, re: R.length })
  expect(R.slice(span.rs, span.re)).toBe(R)
})

// The last message: from content start up to where the selection ends.
test("last segment spans from content start to selection end", () => {
  const R = "Hello there, world."
  const endLen = R.indexOf(",") // 11
  const span = multiSegSpan("last", R.length, 0, endLen)
  expect(span).toEqual({ rs: 0, re: 11 })
  expect(R.slice(span.rs, span.re)).toBe("Hello there")
})

// Defensive clamping: offsets outside [0, rLen] are clamped so rs/re stay in range.
test("offsets are clamped into [0, rLen]", () => {
  const first = multiSegSpan("first", 5, 99, 0)
  expect(first).toEqual({ rs: 5, re: 5 })
  const last = multiSegSpan("last", 5, 0, 99)
  expect(last).toEqual({ rs: 0, re: 5 })
  const firstNeg = multiSegSpan("first", 5, -3, 0)
  expect(firstNeg).toEqual({ rs: 0, re: 5 })
})
