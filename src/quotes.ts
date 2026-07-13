// Strip a single matched wrapping quote pair the model sometimes adds around the whole
// output. Conservative: only strips when the inner text contains NO further occurrence of
// that quote char, so genuine dialogue ("Hi," he said "bye") is left untouched.
export function stripWrappingQuotes(s: string): string {
  const t = s.trim()
  const pairs: [string, string][] = [['"', '"'], ["'", "'"], ['“', '”'], ['‘', '’'], ['«', '»']]
  for (const [o, c] of pairs) {
    if (t.length >= o.length + c.length && t.startsWith(o) && t.endsWith(c)) {
      const inner = t.slice(o.length, t.length - c.length)
      if (!inner.includes(o) && !inner.includes(c)) return inner.trim()
    }
  }
  return t
}

// True only when the string was actually wrapped in a matched quote pair. Compares to the
// TRIMMED value so leading/trailing whitespace (which stripWrappingQuotes also removes)
// doesn't masquerade as a quote wrap.
export function wasQuoteWrapped(s: string): boolean {
  return stripWrappingQuotes(s) !== s.trim()
}
