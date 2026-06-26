function alignExact(R: string, A: string, rs: number, re: number): { as: number; ae: number } | null {
  const n = R.length, m = A.length;
  if (!n || !m || n * m > 4000000) return null; // ponytail: ~2k×2k char cap; null -> caller windows or copy-falls-back
  if (rs < 0 || re > n || re < rs) return null;
  let i, j, k, c;
  const dp: Int32Array[] = [];
  for (i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
  for (i = n - 1; i >= 0; i--)
    for (j = m - 1; j >= 0; j--)
      dp[i][j] = (R.charCodeAt(i) === A.charCodeAt(j))
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
  // Backtrace the alignment. mr[i] = matched raw index for rendered char i, or -1
  // (rendered-only). matchedRaw[j] = 1 if raw char j is an LCS match (else it is a
  // raw-only / transform char).
  const mr = new Int32Array(n);
  for (k = 0; k < n; k++) mr[k] = -1;
  const matchedRaw = new Uint8Array(m);
  let i2 = 0, j2 = 0;
  while (i2 < n || j2 < m) {
    if (i2 < n && j2 < m && R.charCodeAt(i2) === A.charCodeAt(j2)) {
      mr[i2] = j2; matchedRaw[j2] = 1; i2++; j2++;
    } else if (j2 >= m || (i2 < n && dp[i2 + 1][j2] >= dp[i2][j2 + 1])) {
      i2++; // rendered-only char
    } else {
      j2++; // raw-only char
    }
  }
  // Demote ISLAND matches: a matched raw char flanked by raw-only chars on BOTH
  // sides is an incidental match inside a transform token, not a real anchor.
  // Iterate to a fixpoint (demoting one island can expose another).
  let changed = true;
  while (changed) {
    changed = false;
    for (k = 0; k < n; k++) {
      const rj = mr[k];
      if (rj < 0) continue;
      const leftRO = (rj > 0) && !matchedRaw[rj - 1];
      const rightRO = (rj < m - 1) && !matchedRaw[rj + 1];
      if (leftRO && rightRO) { mr[k] = -1; matchedRaw[rj] = 0; changed = true; }
    }
  }
  // If island-demotion removed every match, there are no anchors at all → cannot locate.
  let hasAnyAnchor = false;
  for (let a = 0; a < m; a++) { if (matchedRaw[a]) { hasAnyAnchor = true; break; } }
  if (!hasAnyAnchor) return null;
  // Compute raw cut points from the nearest real anchors.
  let as, ae, x, pm, nm;
  // START cut (before rendered char rs).
  if (rs >= n) { as = m; }
  else if (mr[rs] >= 0) { as = mr[rs]; }
  else { // rendered-only: just after the previous anchor's raw char
    pm = -1;
    for (x = rs - 1; x >= 0; x--) { if (mr[x] >= 0) { pm = x; break; } }
    as = (pm >= 0) ? mr[pm] + 1 : 0;
  }
  // END cut (after rendered char re-1).
  if (re <= 0) { ae = 0; }
  else if (mr[re - 1] >= 0) { ae = mr[re - 1] + 1; }
  else { // last selected char is rendered-only: extend to the next anchor's raw start
    nm = -1;
    for (x = re; x < n; x++) { if (mr[x] >= 0) { nm = x; break; } }
    ae = (nm >= 0) ? mr[nm] : m;
  }
  if (ae < as) return null;
  // If the selection touches a transform (it contains rendered-only chars, or the
  // raw span interior contains raw-only chars), snap each edge OUTWARD so no
  // raw-only token is bisected.
  let touchesTransform = false;
  for (k = rs; k < re; k++) { if (mr[k] < 0) { touchesTransform = true; break; } }
  if (!touchesTransform) {
    for (c = as; c < ae; c++) { if (!matchedRaw[c]) { touchesTransform = true; break; } }
  }
  if (touchesTransform) {
    // Start partway into a raw-only token -> pull cut to that token's start.
    while (as > 0 && !matchedRaw[as - 1] && !matchedRaw[as]) as--;
    // End partway through a raw-only token -> push cut to that token's end.
    while (ae < m && !matchedRaw[ae] && ae > 0 && !matchedRaw[ae - 1]) ae++;
    // Selection clearly covers a transform but mapped to an empty raw span:
    // expand to enclose the adjacent raw-only run.
    if (as === ae) {
      for (k = rs; k < re; k++) {
        if (mr[k] < 0) {
          while (ae < m && !matchedRaw[ae]) ae++;
          while (as > 0 && !matchedRaw[as - 1]) as--;
          break;
        }
      }
    }
  }
  if (ae < as) return null;
  // Final clean-edge check: neither cut may sit strictly inside a raw-only run.
  const dirtyStart = as > 0 && as < m && !matchedRaw[as - 1] && !matchedRaw[as];
  const dirtyEnd = ae > 0 && ae < m && !matchedRaw[ae - 1] && !matchedRaw[ae];
  if (dirtyStart || dirtyEnd) return null;
  return { as: as, ae: ae };
}
// Find a "clean anchor": a verbatim run of rendered text near `pos` that occurs
// exactly once in raw A, giving an unambiguous coordinate peg. side<0 searches runs
// ending at/before pos (leftward); side>0 searches runs starting at/after pos
// (rightward). Steps past transforms (which break the verbatim match) and repetition
// (which breaks uniqueness). Returns {rPos, aPos} (R[rPos..rPos+LEN] === A[aPos..]) or null.
function findCleanAnchor(R: string, A: string, pos: number, side: number, LEN: number, MAXSPAN: number): { rPos: number; aPos: number } | null {
  const step = 8;
  let t, p, cand, idx;
  for (t = 0; t * step <= MAXSPAN; t++) {
    p = side < 0 ? (pos - t * step - LEN) : (pos + t * step);
    if (p < 0 || p + LEN > R.length) continue;
    cand = R.substring(p, p + LEN);
    idx = A.indexOf(cand);
    if (idx < 0) continue;                       // transform inside cand: not verbatim in raw
    if (A.indexOf(cand, idx + 1) >= 0) continue; // not unique: ambiguous peg
    return { rPos: p, aPos: idx };
  }
  return null;
}
// Map a rendered span [rs,re) into raw msg.content coords. Small message: exact
// full-message LCS. Large message: the O(n*m) matrix would blow the cap (the v5.1
// bug — a 3k-char message is 9M cells), so window it — peg clean anchors just outside
// the selection on both sides and run alignExact on only that bounded slice, then
// translate the result back to global raw coords. The anchors share verbatim text
// with raw at both window edges, so the windowed alignment is as exact as the full
// one. Falls back to null (copy) only when the message can't be anchored or the
// selection itself is too large to window.
// Curly quotes/apostrophes are the engine's most common length-PRESERVING transform
// (straight " -> " ", ' -> '). They break verbatim anchor matching but not positions,
// so we normalize them straight for the anchor SEARCH only — pegs stay valid in the
// original coords, and the splice still aligns the original (un-normalized) window.
function normForAnchor(s: string): string {
  return s.replace(/[""]/g, '"').replace(/['']/g, "'");
}
export function mapRenderedSpanToRaw(R: string, A: string, rs: number, re: number): { as: number; ae: number } | null {
  const n = R.length, m = A.length;
  if (!n || !m) return null;
  if (rs < 0 || re > n || re < rs) return null;
  if (n * m <= 4000000) return alignExact(R, A, rs, re);
  const LEN = 40, MAXSPAN = 800;
  const Rn = normForAnchor(R), An = normForAnchor(A);
  const left = findCleanAnchor(Rn, An, rs, -1, LEN, MAXSPAN);
  const right = findCleanAnchor(Rn, An, re, 1, LEN, MAXSPAN);
  const wlo = left ? left.rPos : 0;
  const lo = left ? left.aPos : 0;
  const whi = right ? right.rPos + LEN : n;
  const hi = right ? right.aPos + LEN : m;
  if (wlo > rs || whi < re || lo >= hi || wlo >= whi) return null; // anchors must bracket & stay ordered
  if ((whi - wlo) * (hi - lo) > 4000000) return null;             // selection too large to window
  const loc = alignExact(R.slice(wlo, whi), A.slice(lo, hi), rs - wlo, re - wlo);
  if (!loc) return null;
  return { as: lo + loc.as, ae: lo + loc.ae };
}

/**
 * Locate the rendered selection [rs,re) inside the raw markdown A and replace
 * that raw span with `output`. Returns the new full raw content, or null when
 * the selection cannot be unambiguously located (caller must NOT splice then).
 */
// Normalize for a stale-capture sanity check: drop whitespace + common markdown/punctuation
// so a rendered selection ("hello") and its raw form ("*hello*") compare equal.
function normForCompare(s: string): string {
  return s.replace(/[\s*_~`"'“”‘’()[\]{}…—–\-.,!?;:]/g, "").toLowerCase()
}

export function spliceRewrite(
  rawA: string,
  R: string,
  rs: number,
  re: number,
  output: string,
): string | null {
  const span = mapRenderedSpanToRaw(R, rawA, rs, re)
  if (!span) return null
  // AUTHORITATIVE stale-capture guard: the raw span we're about to replace must actually
  // correspond to the rendered text the user selected. If R is stale (the message was
  // edited/swiped/regenerated since capture), alignExact can still land on a coincidental
  // anchor in the changed content and we'd splice into the wrong place. Reject when the
  // mapped raw span doesn't match the selection. Runs on the live raw content the backend
  // just fetched, so it can't be bypassed by a frontend DOM-render race.
  const sel = normForCompare(R.slice(rs, re))
  const rawSpan = normForCompare(rawA.slice(span.as, span.ae))
  if (sel.length > 0 && !(sel === rawSpan || rawSpan.includes(sel) || sel.includes(rawSpan))) {
    return null
  }
  return rawA.slice(0, span.as) + output + rawA.slice(span.ae)
}
