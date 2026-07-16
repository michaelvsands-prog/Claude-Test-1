/** Jaro-Winkler similarity, 0..1. Standard implementation, prefix scale 0.1, max prefix 4. */
export function jaroWinkler(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array(a.length).fill(false);
  const bMatched = new Array(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - matchWindow);
    const hi = Math.min(b.length - 1, i + matchWindow);
    for (let j = lo; j <= hi; j++) {
      if (!bMatched[j] && a[i] === b[j]) {
        aMatched[i] = true;
        bMatched[j] = true;
        matches++;
        break;
      }
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Token-set similarity for multi-word headers: Dice coefficient on shared
 * tokens, with partial credit for non-shared tokens that are near-identical
 * by Jaro-Winkler (handles small spelling variants).
 */
export function tokenSetScore(a, b) {
  const ta = a.split(' ').filter(Boolean);
  const tb = b.split(' ').filter(Boolean);
  if (!ta.length || !tb.length) return 0;

  const setB = [...tb];
  let shared = 0;
  const leftoverA = [];
  for (const t of ta) {
    const idx = setB.indexOf(t);
    if (idx >= 0) {
      shared++;
      setB.splice(idx, 1);
    } else {
      leftoverA.push(t);
    }
  }

  // Partial credit: best fuzzy pairing among leftover tokens.
  let partial = 0;
  for (const t of leftoverA) {
    let best = 0;
    let bestIdx = -1;
    for (let j = 0; j < setB.length; j++) {
      const s = jaroWinkler(t, setB[j]);
      if (s > best) {
        best = s;
        bestIdx = j;
      }
    }
    if (best >= 0.85 && bestIdx >= 0) {
      partial += best;
      setB.splice(bestIdx, 1);
    }
  }

  return (2 * (shared + partial)) / (ta.length + tb.length);
}

/**
 * Combined fuzzy score used by the matcher. Whole-string Jaro-Winkler is
 * scaled by length ratio — it produces inflated scores for strings of very
 * different lengths, which token-set scoring handles more honestly.
 */
export function fuzzyScore(a, b) {
  const lengthRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  return Math.max(jaroWinkler(a, b) * lengthRatio, tokenSetScore(a, b));
}
