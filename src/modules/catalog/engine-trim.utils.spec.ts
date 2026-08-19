import {
  isPlausibleGearCount,
  normalizeTransmissionLabel,
  parseGearCount,
  preferGearSpecificSlug,
  transmissionKey,
} from './engine-trim.utils';

describe('normalizeTransmissionLabel', () => {
  it('passes through plain gearbox tokens', () => {
    expect(normalizeTransmissionLabel('AT')).toBe('AT');
    expect(normalizeTransmissionLabel('MT')).toBe('MT');
  });

  it('keeps a plausible gear count prefix', () => {
    expect(normalizeTransmissionLabel('6MT')).toBe('6MT');
    expect(normalizeTransmissionLabel('7DCT')).toBe('7DCT');
  });

  it('latinizes Cyrillic lookalikes before matching', () => {
    expect(normalizeTransmissionLabel('МТ')).toBe('MT');
    expect(normalizeTransmissionLabel('6МТ')).toBe('6MT');
    expect(normalizeTransmissionLabel('АТ')).toBe('AT');
  });

  it('drops an implausible gear count instead of keeping a fake one', () => {
    // AMG line badges ("63 AT") must not become a 63-speed gearbox.
    expect(normalizeTransmissionLabel('63AT')).toBe('AT');
    expect(normalizeTransmissionLabel('45DCT')).toBe('DCT');
  });

  it('returns null for empty/whitespace input', () => {
    expect(normalizeTransmissionLabel(null)).toBeNull();
    expect(normalizeTransmissionLabel(undefined)).toBeNull();
    expect(normalizeTransmissionLabel('  ')).toBeNull();
  });

  it('passes through CVT/IVT/AMT without a gear count', () => {
    expect(normalizeTransmissionLabel('CVT')).toBe('CVT');
    expect(normalizeTransmissionLabel('IVT')).toBe('IVT');
    expect(normalizeTransmissionLabel('AMT')).toBe('AMT');
  });
});

describe('isPlausibleGearCount', () => {
  it('accepts real-world MT gear counts (4-7)', () => {
    expect(isPlausibleGearCount('MT', 5)).toBe(true);
    expect(isPlausibleGearCount('MT', 6)).toBe(true);
    expect(isPlausibleGearCount('MT', 3)).toBe(false);
    expect(isPlausibleGearCount('MT', 8)).toBe(false);
  });

  it('rejects AMG-style line numbers for MT/DCT', () => {
    expect(isPlausibleGearCount('MT', 63)).toBe(false);
    expect(isPlausibleGearCount('DCT', 45)).toBe(false);
  });

  it('accepts DCT/DSG only in the 6-8 range', () => {
    expect(isPlausibleGearCount('DCT', 7)).toBe(true);
    expect(isPlausibleGearCount('DSG', 6)).toBe(true);
    expect(isPlausibleGearCount('DSG', 5)).toBe(false);
  });
});

describe('transmissionKey', () => {
  it('strips the gear count, keeping only the gearbox type', () => {
    expect(transmissionKey('6MT')).toBe('MT');
    expect(transmissionKey('7DCT')).toBe('DCT');
    expect(transmissionKey('AT')).toBe('AT');
  });

  it('returns null when there is nothing to key on', () => {
    expect(transmissionKey(null)).toBeNull();
    expect(transmissionKey(undefined)).toBeNull();
  });
});

describe('parseGearCount', () => {
  it('reads the leading digit(s) off a normalized label', () => {
    expect(parseGearCount('6MT')).toBe(6);
    expect(parseGearCount('7DCT')).toBe(7);
  });

  it('returns null when the label carries no gear count', () => {
    expect(parseGearCount('MT')).toBeNull();
    expect(parseGearCount('AT')).toBeNull();
    expect(parseGearCount(null)).toBeNull();
  });
});

describe('preferGearSpecificSlug', () => {
  const kbWithGearFamilies = new Map<string, unknown>([
    ['vag-5mt', {}],
    ['vag-6mt', {}],
  ]);

  it('upgrades to the gear-specific family when it exists in the KB', () => {
    expect(preferGearSpecificSlug('vag-mt', 6, kbWithGearFamilies)).toBe('vag-6mt');
    expect(preferGearSpecificSlug('vag-mt', 5, kbWithGearFamilies)).toBe('vag-5mt');
  });

  it('falls back to the base slug when the trim carries no gear count', () => {
    expect(preferGearSpecificSlug('vag-mt', null, kbWithGearFamilies)).toBe('vag-mt');
  });

  it('falls back to the base slug when that gear count has not been curated yet', () => {
    // e.g. a 4-speed or 7-speed manual for a manufacturer that only has 5mt/6mt curated.
    expect(preferGearSpecificSlug('vag-mt', 7, kbWithGearFamilies)).toBe('vag-mt');
  });

  it('falls back to the base slug for a manufacturer with no gear-specific families at all', () => {
    expect(preferGearSpecificSlug('renault-mt', 6, new Map())).toBe('renault-mt');
  });

  it('leaves non-MT-family slugs untouched (no "-mt" suffix to upgrade)', () => {
    expect(preferGearSpecificSlug('vag-dsg-wet', 6, kbWithGearFamilies)).toBe('vag-dsg-wet');
    expect(preferGearSpecificSlug('hyundai-m6cf1-6mt', 6, kbWithGearFamilies)).toBe(
      'hyundai-m6cf1-6mt',
    );
  });

  it('never invents a family slug that is not actually in the KB', () => {
    expect(preferGearSpecificSlug('bmw-mt', 6, kbWithGearFamilies)).toBe('bmw-mt');
  });
});
