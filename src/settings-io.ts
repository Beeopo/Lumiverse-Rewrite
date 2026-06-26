import type { RewriteConfig } from "./types"

// Validate + coerce an imported object into a safe Partial<RewriteConfig>, dropping
// anything malformed. Never throws.
export function sanitizeImport(raw: unknown): Partial<RewriteConfig> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {}

  const obj = raw as Record<string, unknown>
  const out: Partial<RewriteConfig> = {}

  // customProfiles: array of {id, name, prompt} objects, cap 100
  if (Array.isArray(obj.customProfiles)) {
    const cleaned = (obj.customProfiles as unknown[])
      .filter(
        (item) =>
          item !== null &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          typeof (item as Record<string, unknown>).id === "string" &&
          typeof (item as Record<string, unknown>).name === "string" &&
          typeof (item as Record<string, unknown>).prompt === "string",
      )
      .slice(0, 100) as { id: string; name: string; prompt: string }[]
    out.customProfiles = cleaned
  }

  // customPrompts: array of strings, cap 100
  if (Array.isArray(obj.customPrompts)) {
    out.customPrompts = (obj.customPrompts as unknown[])
      .filter((x) => typeof x === "string")
      .slice(0, 100) as string[]
  }

  // hiddenProfiles: array of strings, cap 100
  if (Array.isArray(obj.hiddenProfiles)) {
    out.hiddenProfiles = (obj.hiddenProfiles as unknown[])
      .filter((x) => typeof x === "string")
      .slice(0, 100) as string[]
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

  // Explicitly NOT including: connectionId (machine-specific), watch, version, or anything else

  return out
}
