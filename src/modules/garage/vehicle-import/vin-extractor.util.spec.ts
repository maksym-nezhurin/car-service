import { extractVin } from './vin-extractor.util';

describe('extractVin', () => {
  it('extracts a 17-character VIN embedded in surrounding text', () => {
    const text = 'E. WVWZZZ1KZAM123456\nA. KR1234A\nD.1 VOLKSWAGEN';
    expect(extractVin(text)).toBe('WVWZZZ1KZAM123456');
  });

  it('is case-insensitive and normalizes to uppercase', () => {
    const text = 'vin: wvwzzz1kzam123456';
    expect(extractVin(text)).toBe('WVWZZZ1KZAM123456');
  });

  it('does not match a run longer than 17 characters', () => {
    const text = 'ref 123456789012345678 more text';
    expect(extractVin(text)).toBeUndefined();
  });

  it('prefers a 17-char candidate over a shorter one', () => {
    const text = 'ABCDEFGHJ12 WVWZZZ1KZAM123456';
    expect(extractVin(text)).toBe('WVWZZZ1KZAM123456');
  });

  it('returns undefined when nothing matches', () => {
    expect(extractVin('no codes here, just words')).toBeUndefined();
  });

  it('does not match sequences containing I, O, or Q', () => {
    // 'O' at position 10 splits this into two runs of 9 and 7 chars — neither reaches
    // the 11-char minimum, so no candidate should match.
    const text = 'WVWZZZ1KZOM123456';
    expect(extractVin(text)).toBeUndefined();
  });
});
