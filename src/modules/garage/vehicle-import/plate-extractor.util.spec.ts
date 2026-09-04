import { extractPlateNumber } from './plate-extractor.util';

describe('extractPlateNumber', () => {
  it('extracts a plain district+registration plate', () => {
    expect(extractPlateNumber('A. KR1234A\nD.1 VOLKSWAGEN')).toBe('KR1234A');
  });

  it('is case-insensitive', () => {
    expect(extractPlateNumber('plate: wa12345')).toBe('WA12345');
  });

  it('handles a hyphen between district code and registration', () => {
    expect(extractPlateNumber('ZS-1234A')).toBe('ZS1234A');
  });

  it('returns undefined when nothing matches', () => {
    expect(extractPlateNumber('no plate in this text')).toBeUndefined();
  });

  it('does not false-positive across unrelated words separated by a space', () => {
    expect(extractPlateNumber('no platex in this text')).toBeUndefined();
  });

  it('does not match an all-letter word (registration must contain a digit)', () => {
    // "PLATEX" alone splits as "PL" + "ATEX" and would satisfy the length
    // constraints if digits weren't required.
    expect(extractPlateNumber('PLATEX')).toBeUndefined();
  });
});
