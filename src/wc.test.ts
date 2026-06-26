import { test, expect } from "bun:test"
import { wc } from "./wc"

test("empty string returns 0", () => {
  expect(wc("")).toBe(0)
  expect(wc("   ")).toBe(0)
})

test("normal English sentence returns plain word count", () => {
  expect(wc("The quick brown fox")).toBe(4)
  expect(wc("hello world")).toBe(2)
})

test("CJK-like no-space string (20 chars, 0 spaces) returns ~10", () => {
  // 20 non-space characters with no spaces — simulates a CJK passage.
  const cjk = "一二三四五六七八九十一二三四五六七八九十"
  const result = wc(cjk)
  expect(result).toBeGreaterThanOrEqual(9)
  expect(result).toBeLessThanOrEqual(11)
})

test("mixed English and spaces not affected by CJK fallback", () => {
  // A sentence with spaces — word count should match split count.
  const s = "one two three four five"
  expect(wc(s)).toBe(5)
})
