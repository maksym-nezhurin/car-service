/** Public encyclopedia filters — shared by API and ETL scripts. */

export const CATALOG_YEAR_CUTOFF = 2005;

export function buildContentKey(
  makeSlug: string,
  modelSlug: string,
  generationSlug: string,
): string {
  return `${makeSlug}/${modelSlug}/${generationSlug}`;
}

export function buildTrimContentKey(
  makeSlug: string,
  modelSlug: string,
  generationSlug: string,
  trimSlug: string,
): string {
  return `${makeSlug}/${modelSlug}/${generationSlug}/${trimSlug}`;
}

export function isGenerationSupported(
  yearFrom: number | null,
  yearTo: number | null,
): boolean {
  if (yearTo != null && yearTo < CATALOG_YEAR_CUTOFF) {
    return false;
  }
  const currentYear = new Date().getFullYear();
  if (yearFrom != null && yearFrom > currentYear) {
    return false;
  }
  return true;
}

export function resolveSupportTier(yearTo: number | null): string {
  const currentYear = new Date().getFullYear();
  if (yearTo == null || yearTo >= currentYear - 2) {
    return 'active';
  }
  if (yearTo >= CATALOG_YEAR_CUTOFF) {
    return 'legacy';
  }
  return 'archived';
}
