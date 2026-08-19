import {
  buildContentKey,
  buildTrimContentKey,
  CATALOG_YEAR_CUTOFF,
  isGenerationSupported,
  resolveSupportTier,
} from './catalog-public.utils';

describe('CATALOG_YEAR_CUTOFF', () => {
  it('is 2004, per docs/V1_7_VEHICLE_ENCYCLOPEDIA.md §3', () => {
    expect(CATALOG_YEAR_CUTOFF).toBe(2004);
  });
});

describe('buildContentKey', () => {
  it('joins make/model/generation slugs', () => {
    expect(buildContentKey('vw', 'golf', 'golf-vii')).toBe('vw/golf/golf-vii');
  });
});

describe('buildTrimContentKey', () => {
  it('joins make/model/generation/trim slugs', () => {
    expect(buildTrimContentKey('vw', 'golf', 'golf-vii', '2-0-tdi-150')).toBe(
      'vw/golf/golf-vii/2-0-tdi-150',
    );
  });
});

describe('isGenerationSupported', () => {
  it('rejects a generation that ended before the year cutoff', () => {
    expect(isGenerationSupported(1998, 2003)).toBe(false);
  });

  it('accepts a generation that ended at or after the cutoff', () => {
    expect(isGenerationSupported(2000, 2004)).toBe(true);
    expect(isGenerationSupported(2010, 2015)).toBe(true);
  });

  it('accepts an open-ended (still-produced) generation', () => {
    expect(isGenerationSupported(2020, null)).toBe(true);
  });

  it('rejects a generation whose yearFrom is implausibly in the future', () => {
    const nextYear = new Date().getFullYear() + 1;
    expect(isGenerationSupported(nextYear, null)).toBe(false);
  });

  it('accepts when both years are unknown', () => {
    expect(isGenerationSupported(null, null)).toBe(true);
  });
});

describe('resolveSupportTier', () => {
  const currentYear = new Date().getFullYear();

  it('returns "active" for an open-ended generation', () => {
    expect(resolveSupportTier(null)).toBe('active');
  });

  it('returns "active" for a generation still within the last 2 years', () => {
    expect(resolveSupportTier(currentYear - 1)).toBe('active');
    expect(resolveSupportTier(currentYear - 2)).toBe('active');
  });

  it('returns "legacy" for an older generation still above the year cutoff', () => {
    expect(resolveSupportTier(currentYear - 5)).toBe('legacy');
    expect(resolveSupportTier(CATALOG_YEAR_CUTOFF)).toBe('legacy');
  });

  it('returns "archived" below the year cutoff', () => {
    expect(resolveSupportTier(CATALOG_YEAR_CUTOFF - 1)).toBe('archived');
    expect(resolveSupportTier(1995)).toBe('archived');
  });
});
