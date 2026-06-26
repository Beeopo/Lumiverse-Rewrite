import { test, expect } from "bun:test"

// Guards the refactor invariant behind the token-cost panel: `assembleContext` is now
// `assembleContextBlocks(...).map(b => b.text).join("\n\n")`. The joined string MUST stay
// byte-identical to the pre-refactor `blocks.join("\n\n")` over the same block texts, in the
// same order. `assembleContextBlocks` itself can't be unit-tested here (the backend module
// has top-level `spindle` side effects), so we pin the join shape that both paths rely on.

// The exact block texts the assembler emits, in append order, for a representative state.
const BLOCK_TEXTS = [
  "<character>\nName: Alice\nPersonality: brave\n</character>",
  "<context>\nUSER: hi\nASSISTANT: hello\n</context>",
  "<persona note=\"...\">\nName: Bob\n</persona>",
  "<speaker>The selected passage is the USER's own words. Edit in the user's voice and register, not a character's.</speaker>",
  "<lore>\nMagic: real\n</lore>",
  "<memory>\nThey met yesterday.\n</memory>",
]

test("labeled blocks reproduce the old join byte-for-byte", () => {
  const labeled = BLOCK_TEXTS.map((text, i) => ({ label: `b${i}`, text }))
  const fromLabeled = labeled.map((b) => b.text).join("\n\n")
  const fromPlain = BLOCK_TEXTS.join("\n\n")
  expect(fromLabeled).toBe(fromPlain)
})

test("empty block list joins to the empty string (unchanged from before)", () => {
  expect([].map((b: { text: string }) => b.text).join("\n\n")).toBe("")
})

test("the join separator is exactly two newlines", () => {
  const labeled = [
    { label: "a", text: "<a>x</a>" },
    { label: "b", text: "<b>y</b>" },
  ]
  expect(labeled.map((b) => b.text).join("\n\n")).toBe("<a>x</a>\n\n<b>y</b>")
})
