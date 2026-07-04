export interface RewriteConfig {
  connectionId: string
  concise: boolean
  lengthPct: number
  watch: boolean
  // Context injection — each source is gated by a flag and degrades gracefully
  // (skipped, never errors) if its permission isn't granted.
  usePrevMessages: boolean
  prevMessageCount: number
  speakerAware: boolean
  useCharCard: boolean
  useUserPersona: boolean
  useMemory: boolean
  useLorebook: boolean
  autoApply: boolean
  // Saved one-off custom instructions (most-recent first, capped).
  customPrompts: string[]
  // User-defined reusable style profiles, and built-in ids hidden from the dropdown.
  customProfiles: { id: string; name: string; prompt: string }[]
  hiddenProfiles: string[]
  // Auto-generated per-chat character-voice profiles, keyed by chatId.
  autoProfiles: Record<string, { name: string; prompt: string }>
  debug: boolean
  // Live token-cost panel: persist whether it's collapsed.
  costCollapsed: boolean
  // Persist the diff-toggle state across reloads.
  showDiff: boolean
  // Configurable undo/redo history depth (1..100).
  historyDepth: number
}

export const DEFAULT_CONFIG: RewriteConfig = {
  connectionId: "",
  concise: false,
  lengthPct: 100,
  watch: false,
  usePrevMessages: true,
  prevMessageCount: 2,
  speakerAware: true,
  useCharCard: true,
  useUserPersona: true,
  useMemory: false,
  useLorebook: false,
  autoApply: false,
  customPrompts: [],
  customProfiles: [],
  hiddenProfiles: [],
  autoProfiles: {},
  debug: false,
  costCollapsed: false,
  showDiff: false,
  historyDepth: 30,
}

// Frontend → backend
export type FrontendMsg =
  | { type: "get_config" }
  | { type: "update_config"; config: Partial<RewriteConfig> }
  | { type: "rewrite"; profileId: string; customPrompt?: string; text: string; concise: boolean; connectionId: string; lengthPct: number; chatId?: string; messageId?: string; characterId?: string }
  | { type: "rewrite_multi"; segments: { messageId: string; text: string }[]; profileId: string; customPrompt?: string; concise: boolean; connectionId: string; lengthPct: number; chatId: string; characterId?: string }
  | { type: "apply"; chatId: string; messageId: string; R: string; rs: number; re: number; output: string }
  | { type: "apply_multi"; chatId: string; items: { messageId: string; R: string; rs: number; re: number; output: string }[] }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "get_history" }
  | { type: "get_connections" }
  | { type: "refine_prompt"; text: string; connectionId: string }
  | { type: "architect_style"; description: string; connectionId: string }
  | { type: "gen_autoprofile"; chatId: string; characterId: string; connectionId: string }
  | { type: "preview_tokens"; chatId?: string; messageId?: string; characterId?: string; text: string; profileId: string; customPrompt?: string; concise: boolean; lengthPct: number }
  | { type: "get_debug" }
  | { type: "cancel" }
  | { type: "reset_config" }

// Backend → frontend
export type BackendMsg =
  | { type: "config"; config: RewriteConfig; persisted?: boolean }
  | { type: "rewrite_result"; text: string; tokens?: number }
  | { type: "rewrite_multi_result"; segments: { messageId: string; output: string }[]; tokens?: number }
  | { type: "rewrite_error"; error: string }
  | { type: "apply_done"; messageId: string; canUndo?: boolean; canRedo?: boolean }
  | { type: "apply_multi_done"; applied: number; skipped: string[]; canUndo: boolean; canRedo: boolean }
  | { type: "apply_error"; error: string }
  | { type: "undo_done"; messageId: string; canUndo?: boolean; canRedo?: boolean }
  | { type: "undo_error"; error: string }
  | { type: "redo_done"; messageId: string; canUndo?: boolean; canRedo?: boolean }
  | { type: "redo_error"; error: string }
  | { type: "history"; canUndo: boolean; canRedo: boolean }
  | { type: "connections"; connections: { id: string; name: string; model: string }[] }
  | { type: "refine_result"; text: string }
  | { type: "refine_error"; error: string }
  | { type: "architect_result"; name: string; prompt: string }
  | { type: "architect_error"; error: string }
  | { type: "autoprofile_result"; chatId: string; name: string; prompt: string }
  | { type: "autoprofile_error"; error: string }
  | { type: "debug"; entries: DebugEntry[] }
  | { type: "token_estimate"; total: number; system: number; selection: number; sources: { label: string; tokens: number }[] }
  | { type: "rewrite_cancelled" }

export interface DebugEntry {
  ts: number
  profile: string
  promptChars: number
  outputChars: number
  tokens: number
  ms: number
  error?: string
  // userId is set by the backend at push time so get_debug can filter to the caller.
  // Optional so older serialized entries still parse.
  userId?: string
}
