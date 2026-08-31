/**
 * Minimal Levenshtein-based fuzzy matcher — no dependency added for this,
 * the problem (match noisy OCR text against a short candidate list) doesn't
 * need a full library.
 */
function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0),
  );

  for (let i = 0; i < rows; i++) dist[i][0] = i;
  for (let j = 0; j < cols; j++) dist[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,
        dist[i][j - 1] + 1,
        dist[i - 1][j - 1] + cost,
      );
    }
  }

  return dist[rows - 1][cols - 1];
}

/** 1 = identical, 0 = completely different. */
function similarity(a: string, b: string): number {
  const normalizedA = a.trim().toUpperCase();
  const normalizedB = b.trim().toUpperCase();
  if (normalizedA === normalizedB) return 1;
  const maxLen = Math.max(normalizedA.length, normalizedB.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(normalizedA, normalizedB) / maxLen;
}

/**
 * Finds the candidate whose `name` field best matches `query`, or undefined if
 * nothing clears `threshold`. Candidates carry an arbitrary payload (`T`) so
 * callers can get back e.g. a catalog make's slug alongside its name.
 */
export function findBestFuzzyMatch<T extends { name: string }>(
  query: string,
  candidates: T[],
  threshold = 0.6,
): T | undefined {
  let best: { candidate: T; score: number } | undefined;

  for (const candidate of candidates) {
    const score = similarity(query, candidate.name);
    if (!best || score > best.score) {
      best = { candidate, score };
    }
  }

  if (!best || best.score < threshold) return undefined;
  return best.candidate;
}

/**
 * Like `findBestFuzzyMatch`, but searches many query tokens (e.g. every line
 * of an OCR text dump) against the candidate list and returns the single best
 * match across all of them — not just the first token that happens to clear
 * the threshold, which could lock in a weaker match before a better one
 * later in the token list is considered.
 */
export function findBestFuzzyMatchAcrossQueries<T extends { name: string }>(
  queries: string[],
  candidates: T[],
  threshold = 0.6,
): T | undefined {
  let best: { candidate: T; score: number } | undefined;

  for (const query of queries) {
    for (const candidate of candidates) {
      const score = similarity(query, candidate.name);
      if (!best || score > best.score) {
        best = { candidate, score };
      }
    }
  }

  if (!best || best.score < threshold) return undefined;
  return best.candidate;
}
