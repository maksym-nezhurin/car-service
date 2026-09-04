import { stripPeselFromFields } from './pesel-filter.util';

describe('stripPeselFromFields', () => {
  it('strips an 11-digit sequence and reports it triggered', () => {
    const result = stripPeselFromFields({
      vin: 'ABC123',
      note: 'owner 90010112345 here',
    });
    expect(result.triggered).toBe(true);
    expect(result.cleaned.note).toBe('owner  here');
    expect(result.cleaned.vin).toBe('ABC123');
  });

  it('leaves fields untouched and reports not triggered when no PESEL-shaped sequence is present', () => {
    const result = stripPeselFromFields({
      vin: 'WVWZZZ1KZAM123456',
      plateNumber: 'KR1234A',
    });
    expect(result.triggered).toBe(false);
    expect(result.cleaned).toEqual({
      vin: 'WVWZZZ1KZAM123456',
      plateNumber: 'KR1234A',
    });
  });

  it('does not strip a 10-digit or 12-digit sequence (must be exactly 11)', () => {
    const result = stripPeselFromFields({ a: '1234567890', b: '123456789012' });
    expect(result.triggered).toBe(false);
    expect(result.cleaned).toEqual({ a: '1234567890', b: '123456789012' });
  });

  it('ignores undefined values', () => {
    const result = stripPeselFromFields({
      vin: undefined,
      note: 'no digits here',
    });
    expect(result.triggered).toBe(false);
    expect(result.cleaned.vin).toBeUndefined();
  });

  it('strips PESEL-shaped sequences from multiple fields', () => {
    const result = stripPeselFromFields({
      a: '90010112345',
      b: 'clean',
      c: '90010112345',
    });
    expect(result.triggered).toBe(true);
    expect(result.cleaned.a).toBe('');
    expect(result.cleaned.c).toBe('');
    expect(result.cleaned.b).toBe('clean');
  });
});
