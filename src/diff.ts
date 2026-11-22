export interface DiffOp { t: "eq" | "ins" | "del"; v: string }

// Word-level LCS is O(m·n); past this many token pairs a direct diff is too slow/large.
const CELL_CAP = 250_000

function lcsOps(a: string[], b: string[]): DiffOp[] {
  const m = a.length, n = b.length
  const dp: Int32Array[] = []
  for (let i = 0; i <= m; i++) dp.push(new Int32Array(n + 1))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  const ops: DiffOp[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) { ops.push({ t: "eq", v: a[i - 1] }); i--; j-- }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { ops.push({ t: "ins", v: b[j - 1] }); j-- }
    else { ops.push({ t: "del", v: a[i - 1] }); i-- }
  }
  return ops.reverse()
}

const words = (s: string) => s.split(/(\s+)/).filter((x) => x !== "")

// Sentences with their trailing whitespace, so joining them rebuilds the text exactly.
export function sentences(s: string): string[] {
  return s.match(/[^.!?…\n]*(?:[.!?…]+["'”’)\]]*|\n+|$)\s*/g)?.filter((x) => x !== "") ?? []
}

function wordDiff(oldStr: string, newStr: string): DiffOp[] {
  const a = words(oldStr), b = words(newStr)
  if (a.length * b.length <= CELL_CAP) return lcsOps(a, b)
  return [...(oldStr ? [{ t: "del" as const, v: oldStr }] : []), ...(newStr ? [{ t: "ins" as const, v: newStr }] : [])]
}

// Word diff for short texts; for long ones, align sentences first, then word-diff each run
// of changed sentences against its replacement. Rewrites keep sentence order, so this stays
// readable at any length instead of giving up.
export function computeDiff(oldStr: string, newStr: string): DiffOp[] {
  const a = words(oldStr), b = words(newStr)
  if (a.length * b.length <= CELL_CAP) return lcsOps(a, b)
  const sa = sentences(oldStr), sb = sentences(newStr)
  if (sa.length * sb.length > CELL_CAP) return wordDiff(oldStr, newStr)
  const out: DiffOp[] = []
  let del = "", ins = ""
  const flush = () => { if (del || ins) out.push(...wordDiff(del, ins)); del = ""; ins = "" }
  for (const op of lcsOps(sa, sb)) {
    if (op.t === "eq") { flush(); out.push(op) }
    else if (op.t === "del") del += op.v
    else ins += op.v
  }
  flush()
  return out
}
