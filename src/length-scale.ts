// The length slider runs 0–100 with 100% length at the centre: the left half covers
// 25–100% (compress), the right half 100–400% (expand). Typed values outside that range
// still work; the slider just pins to its end.
export const LEN_MIN = 25
export const LEN_MAX = 400

export function pctToPos(pct: number): number {
  if (!Number.isFinite(pct)) return 50
  if (pct <= 100) return Math.max(0, Math.round(((pct - LEN_MIN) / (100 - LEN_MIN)) * 50))
  return Math.min(100, Math.round(50 + ((pct - 100) / (LEN_MAX - 100)) * 50))
}

export function posToPct(pos: number): number {
  if (!Number.isFinite(pos)) return 100
  if (Math.abs(pos - 50) <= 2) return 100 // small detent so the centre is easy to hit
  const raw = pos < 50 ? LEN_MIN + (pos / 50) * (100 - LEN_MIN) : 100 + ((pos - 50) / 50) * (LEN_MAX - 100)
  return Math.round(raw / 5) * 5
}
