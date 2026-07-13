import { test, expect } from "bun:test"
import { DEF_PROFILES, findProfile, sysPrompt, buildUserPrompt } from "./profiles"

test("ships 13 ordered profiles with unique ids", () => {
  expect(DEF_PROFILES.length).toBe(13)
  const ids = DEF_PROFILES.map((p) => p.id)
  expect(new Set(ids).size).toBe(13)
  expect(ids).toContain("expand")
  expect(ids).toContain("grammar")
  const orders = DEF_PROFILES.map((p) => p.order)
  expect(orders).toEqual([...orders].sort((a, b) => a - b))
})

test("findProfile returns by id and undefined when missing", () => {
  expect(findProfile("compress")?.name).toBe("Compress")
  expect(findProfile("nope")).toBeUndefined()
})

test("sysPrompt switches on the concise flag", () => {
  expect(sysPrompt(false)).toContain("Output rules:")
  expect(sysPrompt(true).length).toBeLessThan(sysPrompt(false).length)
  expect(sysPrompt(true)).toContain("<rewrite_this>")
})

test("sysPrompt instructs preserving HTML/markdown instead of banning it", () => {
  const full = sysPrompt(false)
  const concise = sysPrompt(true)
  expect(full).toContain("Preserve")
  expect(full).toMatch(/HTML/)
  expect(full).toMatch(/markdown/)
  expect(concise).toContain("Preserve")
  expect(concise).toMatch(/HTML/)
  expect(concise).toMatch(/markdown/)
  // the full prompt's output-rules line must no longer ban markdown/quotation marks
  const outputRulesLine = full.split("\n").find((l) => l.startsWith("- Output ONLY"))!
  expect(outputRulesLine).not.toContain("markdown")
  expect(outputRulesLine).not.toContain("quotation marks")
})

test("buildUserPrompt wraps the selection and carries the instruction", () => {
  const p = findProfile("expand")!
  const out = buildUserPrompt(p, "She ran.")
  expect(out).toContain(p.prompt)
  expect(out).toContain("<rewrite_this>\nShe ran.\n</rewrite_this>")
})

test("buildUserPrompt adds a length target only when not 100%", () => {
  const p = findProfile("expand")!
  expect(buildUserPrompt(p, "x", 100)).not.toContain("Target length")
  // single word at 60% → target = round(0.6) = 1, low = 1, high = 1
  expect(buildUserPrompt(p, "x", 60)).toContain("Target length")
  expect(buildUserPrompt(p, "x", 60)).not.toContain("about 60%")
})

test("buildUserPrompt emits word-count range for normal selections", () => {
  const p = findProfile("expand")!
  // 10 words at 50%: target=5, low=round(4.25)=4, high=round(5.75)=6
  const out = buildUserPrompt(p, "one two three four five six seven eight nine ten", 50)
  expect(out).toContain("about 5 words")
  expect(out).toContain("roughly 4–6 words")
})

test("buildUserPrompt omits length note when lengthPct is 100 or undefined", () => {
  const p = findProfile("expand")!
  expect(buildUserPrompt(p, "one two three four five", 100)).not.toContain("Target length")
  expect(buildUserPrompt(p, "one two three four five")).not.toContain("Target length")
})

test("buildUserPrompt falls back to percentage for empty or whitespace selection", () => {
  const p = findProfile("expand")!
  // empty string: origWords=0, falls back to percentage form
  expect(buildUserPrompt(p, "", 70)).toContain("about 70% of the original")
  expect(buildUserPrompt(p, "   ", 70)).toContain("about 70% of the original")
})

test("buildUserPrompt prepends context blocks before the instruction", () => {
  const p = findProfile("expand")!
  const out = buildUserPrompt(p, "She ran.", undefined, "<character>\nName: Alice\n</character>")
  expect(out.startsWith("<character>")).toBe(true)
  expect(out).toContain("<rewrite_this>\nShe ran.\n</rewrite_this>")
  expect(out.indexOf("<character>")).toBeLessThan(out.indexOf("Instruction:"))
})

test("buildUserPrompt uses origText's word count for the length note, not selectedText's", () => {
  const p = findProfile("expand")!
  // origText has 4 words at 50% -> target=round(2)=2, low=round(1.7)=2, high=round(2.3)=2
  const out = buildUserPrompt(p, "*hi*", 50, undefined, "one two three four")
  expect(out).toContain("about 2 words")
  expect(out).toContain("roughly 2–2 words")
  // must NOT be derived from selectedText's own word count (1 word -> "about 1 words")
  expect(out).not.toContain("about 1 words")
})

test("buildUserPrompt omits empty context", () => {
  const p = findProfile("expand")!
  expect(buildUserPrompt(p, "x", undefined, "   ").startsWith("Instruction:")).toBe(true)
})
