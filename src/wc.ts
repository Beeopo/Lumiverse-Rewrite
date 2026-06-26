/**
 * Word-count helper with CJK/no-space script fallback.
 *
 * Plain whitespace splitting drastically under-counts scripts that don't use
 * spaces between words (CJK, Thai, etc.). When the whitespace word-count is
 * implausibly low relative to the character count, we fall back to estimating
 * ~2 characters per word.
 */
export function wc(s: string): number {
  const t = s.trim()
  if (!t) return 0
  const words = (t.match(/\S+/g) || []).length
  const nonSpace = t.replace(/\s+/g, "").length
  // Whitespace word-splitting drastically under-counts CJK/no-space scripts; when the
  // word count is implausibly low for the character count, estimate ~2 chars per word.
  if (nonSpace > 0 && words < nonSpace / 8) return Math.max(words, Math.round(nonSpace / 2))
  return words
}
