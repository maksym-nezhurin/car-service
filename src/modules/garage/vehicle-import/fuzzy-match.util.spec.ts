import {
  findBestFuzzyMatch,
  findBestFuzzyMatchAcrossQueries,
} from './fuzzy-match.util';

describe('findBestFuzzyMatch', () => {
  const makes = [{ name: 'BMW' }, { name: 'Volkswagen' }, { name: 'Toyota' }];

  it('matches an exact name regardless of case', () => {
    expect(findBestFuzzyMatch('bmw', makes)).toEqual({ name: 'BMW' });
  });

  it('matches a slightly misread name (OCR-style single-character error)', () => {
    expect(findBestFuzzyMatch('VOLKSWAGEH', makes)).toEqual({
      name: 'Volkswagen',
    });
  });

  it('returns undefined when nothing is close enough', () => {
    expect(
      findBestFuzzyMatch('completely unrelated text', makes),
    ).toBeUndefined();
  });

  it('returns undefined for an empty candidate list', () => {
    expect(findBestFuzzyMatch('BMW', [])).toBeUndefined();
  });

  it('respects a custom threshold', () => {
    // "Toyota" vs "Toyoda" is a 1-char edit on a 6-char word (~0.83 similarity) — passes default,
    // fails an artificially strict 0.95 threshold.
    expect(findBestFuzzyMatch('Toyoda', makes, 0.95)).toBeUndefined();
    expect(findBestFuzzyMatch('Toyoda', makes, 0.6)).toEqual({
      name: 'Toyota',
    });
  });
});

describe('findBestFuzzyMatchAcrossQueries', () => {
  const makes = [{ name: 'BMW' }, { name: 'Volkswagen' }, { name: 'Toyota' }];

  it('picks the best match across multiple query tokens, not just the first that clears the threshold', () => {
    // "BMX" clears a low threshold against "BMW" (weak match) but "Toyota" is an exact
    // match later in the list — the exact match should win, not the first weak one.
    const queries = ['some noise', 'BMX', 'unrelated line', 'Toyota'];
    expect(findBestFuzzyMatchAcrossQueries(queries, makes, 0.5)).toEqual({
      name: 'Toyota',
    });
  });

  it('returns undefined when no query is close enough to any candidate', () => {
    expect(
      findBestFuzzyMatchAcrossQueries(['xyz', 'abc'], makes),
    ).toBeUndefined();
  });

  it('returns undefined for an empty query list', () => {
    expect(findBestFuzzyMatchAcrossQueries([], makes)).toBeUndefined();
  });
});
