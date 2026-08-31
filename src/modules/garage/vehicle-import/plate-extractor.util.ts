/**
 * Polish registration plates: a 2-3 letter district code followed by 4-5
 * alphanumeric characters (total 5-8 chars), e.g. "KR1234A", "WA12345".
 * Deliberately does not allow a bare space as separator — that let the pattern
 * span two unrelated words in ordinary prose (e.g. "no plate" → "NOPLATE").
 * Only a hyphen or no separator at all is accepted. The registration part
 * must contain at least one digit — otherwise ordinary 6-8 letter words
 * (e.g. "PLATEX") satisfy the length constraints and false-positive. Real
 * plates always have a numeric portion; requiring one costs nothing.
 * Real-world plates vary enough (other spacing/formatting) that this needs
 * tuning against real sample documents — see AUT-32.
 */
const PLATE_PATTERN = /\b([A-Z]{2,3})-?((?=[A-Z0-9]*\d)[A-Z0-9]{4,5})\b/;

export function extractPlateNumber(rawText: string): string | undefined {
  const upper = rawText.toUpperCase();
  const match = upper.match(PLATE_PATTERN);
  if (!match) return undefined;
  return `${match[1]}${match[2]}`;
}
