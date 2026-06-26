import { test, expect } from "bun:test"
import { stripWrappingQuotes } from "./quotes"

test("strips straight double quotes wrapping entire output", () => {
  expect(stripWrappingQuotes('"hello"')).toBe("hello")
})

test("leaves dialogue with internal quotes untouched", () => {
  const s = '"Hi," he said "bye"'
  expect(stripWrappingQuotes(s)).toBe(s)
})

test("leaves plain text unchanged", () => {
  expect(stripWrappingQuotes("just some text")).toBe("just some text")
})

test("strips curly/smart double-quote pair", () => {
  expect(stripWrappingQuotes('“hello”')).toBe("hello")
})

test("strips single-quote pair when no inner single quotes", () => {
  expect(stripWrappingQuotes("'hello'")).toBe("hello")
})

test("leaves single-quoted text with internal apostrophe untouched", () => {
  const s = "'it's fine'"
  expect(stripWrappingQuotes(s)).toBe(s)
})

test("strips guillemets pair when no inner guillemets", () => {
  expect(stripWrappingQuotes("«hello»")).toBe("hello")
})

test("trims surrounding whitespace before checking", () => {
  expect(stripWrappingQuotes('  "hello"  ')).toBe("hello")
})

test("empty string stays empty", () => {
  expect(stripWrappingQuotes("")).toBe("")
})
