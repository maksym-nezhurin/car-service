import { Aspiration, FuelType } from '../../../generated/client';
import {
  deriveCanonicalAspiration,
  deriveCanonicalFuelType,
} from './canonical-fuel-type.utils';

describe('deriveCanonicalFuelType', () => {
  it.each([
    ['diesel', null, FuelType.DIESEL],
    ['d', null, FuelType.DIESEL],
    ['hybrid', null, FuelType.HYBRID],
    ['electric', null, FuelType.ELECTRIC],
    ['ev', null, FuelType.ELECTRIC],
    ['petrol', null, FuelType.PETROL],
    ['gasoline', null, FuelType.PETROL],
    ['benzyna', null, FuelType.PETROL],
    [null, 'turbo', FuelType.PETROL],
    [null, 't', FuelType.PETROL],
    [null, 'supercharged', FuelType.PETROL],
    [null, 'atmo', FuelType.PETROL],
    [null, 'atmospheric', FuelType.PETROL],
    [null, 'a', FuelType.PETROL],
    [null, null, FuelType.UNKNOWN],
    ['', '', FuelType.UNKNOWN],
    ['nonsense', null, FuelType.UNKNOWN],
  ])('fuelType=%s aspiration=%s -> %s', (fuelType, aspiration, expected) => {
    expect(deriveCanonicalFuelType(fuelType, aspiration)).toBe(expected);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(deriveCanonicalFuelType('  DIESEL  ', null)).toBe(FuelType.DIESEL);
    expect(deriveCanonicalFuelType('Petrol', null)).toBe(FuelType.PETROL);
  });

  it('prefers an explicit fuel signal over an aspiration-implied one', () => {
    // Real data never pairs these, but the precedence should still be deterministic:
    // diesel/hybrid/electric win over any aspiration-implied "petrol" inference.
    expect(deriveCanonicalFuelType('diesel', 'turbo')).toBe(FuelType.DIESEL);
    expect(deriveCanonicalFuelType('hybrid', 'atmo')).toBe(FuelType.HYBRID);
  });
});

describe('deriveCanonicalAspiration', () => {
  it.each([
    ['turbo', Aspiration.TURBO],
    ['t', Aspiration.TURBO],
    ['supercharged', Aspiration.SUPERCHARGED],
    ['atmo', Aspiration.ATMO],
    ['atmospheric', Aspiration.ATMO],
    ['a', Aspiration.ATMO],
    [null, Aspiration.UNKNOWN],
    ['', Aspiration.UNKNOWN],
    ['nonsense', Aspiration.UNKNOWN],
  ])('aspiration=%s -> %s', (aspiration, expected) => {
    expect(deriveCanonicalAspiration(aspiration)).toBe(expected);
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(deriveCanonicalAspiration('  TURBO  ')).toBe(Aspiration.TURBO);
  });
});
