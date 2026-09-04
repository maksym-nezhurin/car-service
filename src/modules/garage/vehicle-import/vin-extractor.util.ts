/**
 * VIN is content-identifiable regardless of where it sits on the document or how the
 * photo is rotated — no layout-aware parsing needed, unlike brand/model. Charset
 * excludes I, O, Q (ISO 3779) to avoid confusion with 1 and 0.
 */
const VIN_CHARSET = 'A-HJ-NPR-Z0-9';
const VIN_CANDIDATE_PATTERN = new RegExp(
  `(?<![${VIN_CHARSET}])[${VIN_CHARSET}]{11,17}(?![${VIN_CHARSET}])`,
  'g',
);

/**
 * Scans raw OCR text for VIN candidates and returns the most likely one.
 * Prefers a 17-character match (the standard modern length) over shorter ones.
 */
export function extractVin(rawText: string): string | undefined {
  const upper = rawText.toUpperCase();
  const candidates = upper.match(VIN_CANDIDATE_PATTERN) ?? [];
  if (candidates.length === 0) return undefined;

  const seventeen = candidates.find((c) => c.length === 17);
  return seventeen ?? candidates[0];
}
