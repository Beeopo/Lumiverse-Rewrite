import { test, expect } from "bun:test"
import { sanitizeImport } from "./settings-io"

test("a clean export object round-trips through sanitizeImport", () => {
  const input = {
    version: 1,
    customProfiles: [{ id: "cp_abc", name: "My Style", prompt: "Be terse." }],
    customPrompts: ["Make it snappier"],
    hiddenProfiles: ["expand"],
    usePrevMessages: true,
    prevMessageCount: 2,
    speakerAware: false,
    useCharCard: true,
    useUserPersona: false,
    useMemory: false,
    useLorebook: true,
    lengthPct: 80,
    concise: true,
    autoApply: false,
  }
  const out = sanitizeImport(input)
  expect(out.customProfiles).toEqual([{ id: "cp_abc", name: "My Style", prompt: "Be terse." }])
  expect(out.customPrompts).toEqual(["Make it snappier"])
  expect(out.hiddenProfiles).toEqual(["expand"])
  expect(out.usePrevMessages).toBe(true)
  expect(out.prevMessageCount).toBe(2)
  expect(out.speakerAware).toBe(false)
  expect(out.useCharCard).toBe(true)
  expect(out.useUserPersona).toBe(false)
  expect(out.useMemory).toBe(false)
  expect(out.useLorebook).toBe(true)
  expect(out.lengthPct).toBe(80)
  expect(out.concise).toBe(true)
  expect(out.autoApply).toBe(false)
})

test("a malformed customProfiles entry is dropped while valid entries are kept", () => {
  const out = sanitizeImport({
    customProfiles: [
      { id: "cp_1", name: "Good", prompt: "Good prompt" },
      { id: 123, name: "Bad id", prompt: "nope" },    // id is number, not string
      { name: "Missing id", prompt: "nope" },           // missing id
      null,                                             // null entry
      "string entry",                                   // not an object
      { id: "cp_2", name: "Also good", prompt: "yes" },
    ],
  })
  expect(out.customProfiles).toEqual([
    { id: "cp_1", name: "Good", prompt: "Good prompt" },
    { id: "cp_2", name: "Also good", prompt: "yes" },
  ])
})

test("unknown keys (connectionId, evil, version) are ignored", () => {
  const out = sanitizeImport({
    connectionId: "machine-specific-id",
    evil: "hack attempt",
    version: 1,
    watch: true,
    concise: true,
  })
  expect(out).not.toHaveProperty("connectionId")
  expect(out).not.toHaveProperty("evil")
  expect(out).not.toHaveProperty("version")
  expect(out).not.toHaveProperty("watch")
  expect(out.concise).toBe(true)
})

test("prevMessageCount: 99 clamps to 4", () => {
  const out = sanitizeImport({ prevMessageCount: 99 })
  expect(out.prevMessageCount).toBe(4)
})

test("prevMessageCount: 0 clamps to 1", () => {
  const out = sanitizeImport({ prevMessageCount: 0 })
  expect(out.prevMessageCount).toBe(1)
})

test("lengthPct: 5000 clamps to 1000", () => {
  const out = sanitizeImport({ lengthPct: 5000 })
  expect(out.lengthPct).toBe(1000)
})

test("lengthPct: 0 clamps to 1", () => {
  const out = sanitizeImport({ lengthPct: 0 })
  expect(out.lengthPct).toBe(1)
})

test("non-boolean values for boolean flags are ignored", () => {
  const out = sanitizeImport({ concise: "yes", autoApply: 1, usePrevMessages: null })
  expect(out).not.toHaveProperty("concise")
  expect(out).not.toHaveProperty("autoApply")
  expect(out).not.toHaveProperty("usePrevMessages")
})

test("passing null or a primitive returns empty object", () => {
  expect(sanitizeImport(null)).toEqual({})
  expect(sanitizeImport(42)).toEqual({})
  expect(sanitizeImport("string")).toEqual({})
  expect(sanitizeImport([])).toEqual({})
})

test("historyDepth: 999 clamps to 100", () => {
  const out = sanitizeImport({ historyDepth: 999 })
  expect(out.historyDepth).toBe(100)
})

test("historyDepth: 0 clamps to 1", () => {
  const out = sanitizeImport({ historyDepth: 0 })
  expect(out.historyDepth).toBe(1)
})

test("showDiff round-trips as boolean", () => {
  const out = sanitizeImport({ showDiff: true })
  expect(out.showDiff).toBe(true)
  const out2 = sanitizeImport({ showDiff: false })
  expect(out2.showDiff).toBe(false)
})

test("showDiff: non-boolean value is ignored", () => {
  const out = sanitizeImport({ showDiff: "yes" })
  expect(out).not.toHaveProperty("showDiff")
})

test("customProfiles: entries with empty-string fields are dropped", () => {
  const out = sanitizeImport({
    customProfiles: [
      { id: "", name: "", prompt: "" },
      { id: "cp_1", name: "  ", prompt: "keep me" },
      { id: "cp_2", name: "Real", prompt: "Real prompt" },
    ],
  })
  expect(out.customProfiles).toEqual([{ id: "cp_2", name: "Real", prompt: "Real prompt" }])
})

test("customPrompts and hiddenProfiles: empty/whitespace-only strings are dropped", () => {
  const out = sanitizeImport({
    customPrompts: ["", "  ", "keep this"],
    hiddenProfiles: ["", "expand", "  "],
  })
  expect(out.customPrompts).toEqual(["keep this"])
  expect(out.hiddenProfiles).toEqual(["expand"])
})
