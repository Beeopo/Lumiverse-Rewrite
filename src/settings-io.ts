import type { RewriteConfig } from "./types"

// Validate + coerce an imported object into a safe Partial<RewriteConfig>, dropping
// anything malformed. Never throws.
export function sanitizeImport(raw: unknown): Partial<RewriteConfig> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {}

  const obj = raw as Record<string, unknown>
  const out: Partial<RewriteConfig> = {}

  // customProfiles: array of {id, name, prompt} objects, cap 100 — every field must be a
  // non-empty trimmed string. Without the trim guard a crafted import can inject 100 blank
  // rows that render as ghost entries in the style manager and, if selected, fall through
  // resolveProfile to an empty prompt.
  if (Array.isArray(obj.customProfiles)) {
    const cleaned = (obj.customProfiles as unknown[])
      .filter((item) => {
        if (item === null || typeof item !== "object" || Array.isArray(item)) return false
        const r = item as Record<string, unknown>
        return typeof r.id === "string" && r.id.trim().length > 0 &&
               typeof r.name === "string" && r.name.trim().length > 0 &&
               typeof r.prompt === "string" && r.prompt.trim().length > 0
      })
      .slice(0, 100) as { id: string; name: string; prompt: string }[]
    out.customProfiles = cleaned
  }

  // customPrompts: array of non-empty strings, cap 100
  if (Array.isArray(obj.customPrompts)) {
    out.customPrompts = (obj.customPrompts as unknown[])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, 100)
  }

  // hiddenProfiles: array of non-empty strings, cap 100
  if (Array.isArray(obj.hiddenProfiles)) {
    out.hiddenProfiles = (obj.hiddenProfiles as unknown[])
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, 100)
  }

  // Boolean flags
  const boolKeys = [
    "usePrevMessages",
    "speakerAware",
    "useCharCard",
    "useUserPersona",
    "useMemory",
    "useLorebook",
    "concise",
    "autoApply",
    "showDiff",
    "applyParamsToHelpers",
  ] as const
  for (const key of boolKeys) {
    if (typeof obj[key] === "boolean") {
      ;(out as Record<string, unknown>)[key] = obj[key]
    }
  }

  // prevMessageCount: integer clamped 1..4
  if (typeof obj.prevMessageCount === "number" && Number.isFinite(obj.prevMessageCount)) {
    out.prevMessageCount = Math.max(1, Math.min(4, Math.round(obj.prevMessageCount)))
  }

  // lengthPct: integer clamped 1..1000
  if (typeof obj.lengthPct === "number" && Number.isFinite(obj.lengthPct)) {
    out.lengthPct = Math.max(1, Math.min(1000, Math.round(obj.lengthPct)))
  }

  // historyDepth: integer clamped 1..100
  if (typeof obj.historyDepth === "number" && Number.isFinite(obj.historyDepth)) {
    out.historyDepth = Math.max(1, Math.min(100, Math.round(obj.historyDepth)))
  }

  // Sampler params: number clamped to range (int ones rounded), null kept as explicit
  // "inherit", anything else dropped.
  const samplerRanges = {
    temperature: [0, 2, false],
    topP: [0, 1, false],
    topK: [0, 1000, true],
    maxTokens: [1, 1000000, true], // permissive sanity ceiling, not a model limit
    frequencyPenalty: [-2, 2, false],
    presencePenalty: [-2, 2, false],
  } as const
  for (const key of Object.keys(samplerRanges) as (keyof typeof samplerRanges)[]) {
    const [min, max, isInt] = samplerRanges[key]
    const val = obj[key]
    if (val === null) {
      ;(out as Record<string, unknown>)[key] = null
    } else if (typeof val === "number" && Number.isFinite(val)) {
      const clamped = Math.max(min, Math.min(max, val))
      ;(out as Record<string, unknown>)[key] = isInt ? Math.round(clamped) : clamped
    }
  }

  // Explicitly NOT including: connectionId (machine-specific), watch, version, or anything else

  return out
}
