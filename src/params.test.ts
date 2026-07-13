import { test, expect } from "bun:test"
import { buildParams, DEFAULT_CONFIG } from "./types"

test("buildParams(DEFAULT_CONFIG) returns only temperature and top_p", () => {
  const out = buildParams(DEFAULT_CONFIG)
  expect(out).toEqual({ temperature: 0.7, top_p: 0.9 })
  expect("top_k" in out).toBe(false)
  expect("max_tokens" in out).toBe(false)
  expect("frequency_penalty" in out).toBe(false)
  expect("presence_penalty" in out).toBe(false)
})

test("buildParams includes all six snake_case keys when all six fields are set", () => {
  const out = buildParams({
    ...DEFAULT_CONFIG,
    temperature: 1.1,
    topP: 0.5,
    topK: 40,
    maxTokens: 512,
    frequencyPenalty: 0.3,
    presencePenalty: -0.2,
  })
  expect(out).toEqual({
    temperature: 1.1,
    top_p: 0.5,
    top_k: 40,
    max_tokens: 512,
    frequency_penalty: 0.3,
    presence_penalty: -0.2,
  })
})

test("buildParams omits a key when its field is null", () => {
  const out = buildParams({ ...DEFAULT_CONFIG, temperature: null })
  expect("temperature" in out).toBe(false)
  expect(out.top_p).toBe(0.9)
})
