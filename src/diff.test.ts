import { test, expect } from "bun:test"
import { computeDiff, sentences } from "./diff"

const rebuild = (ops: { t: string; v: string }[], side: "old" | "new") =>
  ops.filter((o) => o.t === "eq" || o.t === (side === "old" ? "del" : "ins")).map((o) => o.v).join("")

test("small texts get a word diff", () => {
  const ops = computeDiff("the cat sat", "the dog sat")
  expect(ops.filter((o) => o.t !== "eq").map((o) => o.t + ":" + o.v)).toEqual(["del:cat", "ins:dog"])
})

test("sentences() rebuilds the text exactly", () => {
  const s = 'She ran. "Why?" he asked!  Then… silence\nNext line'
  expect(sentences(s).join("")).toBe(s)
})

test("large texts still diff, and both sides rebuild exactly", () => {
  const para = (w: string) => Array.from({ length: 80 }, (_, i) => `Sentence ${i} has the word ${i % 7 === 0 ? w : "plain"} in it.`).join(" ")
  const a = para("old"), b = para("new")
  const ops = computeDiff(a, b)
  expect(rebuild(ops, "old")).toBe(a)
  expect(rebuild(ops, "new")).toBe(b)
  // Unchanged sentences stay as equal runs; only the edited words are marked.
  expect(ops.some((o) => o.t === "eq")).toBe(true)
  expect(ops.filter((o) => o.t === "del").every((o) => o.v.length < 40)).toBe(true)
})
