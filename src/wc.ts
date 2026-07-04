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
  // Only trip the CJK/no-space fallback when a script-detect actually finds no-space
  // characters — otherwise long-average-word English prose (rare, but real) was tripping
  // the /8 heuristic and returning nonsense counts. Test both branches independently.
  const hasNoSpaceScript = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u.test(t)
  if (hasNoSpaceScript && nonSpace > 0 && words < nonSpace / 3) return Math.max(words, Math.round(nonSpace / 2))
  return words
}
