import { Aspiration, FuelType } from '../../../generated/client';

/**
 * Same raw-value matching rules as formatFuelLabel() in engine-trim.utils.ts (kept in sync
 * intentionally — that function produces a Polish display string, this one a canonical enum;
 * see AUT-33 for why the raw fuelType/aspiration columns stay free strings and these are
 * derived separately rather than replacing them).
 */
export function deriveCanonicalFuelType(
  fuelType?: string | null,
  aspiration?: string | null,
): FuelType {
  const fuel = (fuelType ?? '').trim().toLowerCase();
  const asp = (aspiration ?? '').trim().toLowerCase();

  if (fuel === 'diesel' || fuel === 'd') return FuelType.DIESEL;
  if (fuel === 'hybrid') return FuelType.HYBRID;
  if (fuel === 'electric' || fuel === 'ev') return FuelType.ELECTRIC;

  // An aspiration value with no conflicting fuel signal implies a petrol engine in this
  // dataset's convention — same inference formatFuelLabel() makes (see its comment there).
  if (asp === 'turbo' || asp === 't') return FuelType.PETROL;
  if (asp === 'supercharged') return FuelType.PETROL;
  if (asp === 'atmo' || asp === 'atmospheric' || asp === 'a')
    return FuelType.PETROL;

  if (fuel === 'petrol' || fuel === 'gasoline' || fuel === 'benzyna')
    return FuelType.PETROL;

  return FuelType.UNKNOWN;
}

export function deriveCanonicalAspiration(
  aspiration?: string | null,
): Aspiration {
  const asp = (aspiration ?? '').trim().toLowerCase();

  if (asp === 'turbo' || asp === 't') return Aspiration.TURBO;
  if (asp === 'supercharged') return Aspiration.SUPERCHARGED;
  if (asp === 'atmo' || asp === 'atmospheric' || asp === 'a')
    return Aspiration.ATMO;

  return Aspiration.UNKNOWN;
}
