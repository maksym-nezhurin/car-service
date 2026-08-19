/**
 * Curated model generations (platform / body style), independent of CarAPI's flat model id.
 * Year ranges are public facts; editorial text comes from Contentful, not third-party sites.
 *
 * @see docs/V1_7_VEHICLE_ENCYCLOPEDIA.md — later: admin merge + full PL spine import
 */

export type GenerationSpineEntry = {
  slug: string;
  displayName: string;
  yearFrom: number;
  /** null = still in production */
  yearTo: number | null;
};

export type ModelGenerationSpine = {
  makeSlug: string;
  modelSlug: string;
  generations: GenerationSpineEntry[];
};

/** Pilot PL models — expand gradually (manual curation + review). */
export const CATALOG_GENERATION_SPINE: ModelGenerationSpine[] = [
  {
    makeSlug: 'hyundai',
    modelSlug: 'tucson',
    generations: [
      { slug: 'tucson-i', displayName: 'Tucson I', yearFrom: 2004, yearTo: 2009 },
      { slug: 'tucson-ii', displayName: 'Tucson II (ix35)', yearFrom: 2009, yearTo: 2015 },
      { slug: 'tucson-iii', displayName: 'Tucson III', yearFrom: 2015, yearTo: 2021 },
      { slug: 'tucson-iv', displayName: 'Tucson IV', yearFrom: 2020, yearTo: null },
    ],
  },
  {
    makeSlug: 'kia',
    modelSlug: 'sportage',
    generations: [
      { slug: 'sportage-i', displayName: 'Sportage I', yearFrom: 1993, yearTo: 2004 },
      { slug: 'sportage-ii', displayName: 'Sportage II', yearFrom: 2004, yearTo: 2010 },
      { slug: 'sportage-iii', displayName: 'Sportage III', yearFrom: 2010, yearTo: 2015 },
      { slug: 'sportage-iv', displayName: 'Sportage IV (QL)', yearFrom: 2015, yearTo: 2021 },
      { slug: 'sportage-v', displayName: 'Sportage V (NQ5)', yearFrom: 2021, yearTo: null },
    ],
  },
];

export function findGenerationSpine(
  makeSlug: string,
  modelSlug: string,
): ModelGenerationSpine | undefined {
  return CATALOG_GENERATION_SPINE.find(
    (s) => s.makeSlug === makeSlug && s.modelSlug === modelSlug,
  );
}

/** Pick the newest spine generation whose year range contains the trim model year. */
export function pickGenerationForTrimYear(
  spine: GenerationSpineEntry[],
  trimYear: number,
): GenerationSpineEntry | null {
  const matches = spine.filter(
    (g) =>
      trimYear >= g.yearFrom &&
      (g.yearTo == null || trimYear <= g.yearTo),
  );
  if (matches.length === 0) {
    return null;
  }
  return matches.sort((a, b) => b.yearFrom - a.yearFrom)[0];
}

const YEAR_GAP_FOR_NEW_GENERATION = 2;

/**
 * Fallback when no curated spine: split trim years into clusters (gap ≥ 2 years).
 */
export function clusterTrimYearsToGenerations(
  modelName: string,
  modelSlug: string,
  trimYears: number[],
): GenerationSpineEntry[] {
  const years = [...new Set(trimYears.filter(Number.isFinite))].sort((a, b) => a - b);
  if (years.length === 0) {
    return [];
  }

  const clusters: number[][] = [[years[0]]];
  for (let i = 1; i < years.length; i++) {
    const prev = years[i - 1];
    const cur = years[i];
    if (cur - prev >= YEAR_GAP_FOR_NEW_GENERATION) {
      clusters.push([cur]);
    } else {
      clusters[clusters.length - 1].push(cur);
    }
  }

  return clusters.map((cluster, index) => {
    const from = cluster[0];
    const to = cluster[cluster.length - 1];
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI'][index] ?? String(index + 1);
    return {
      slug: `${modelSlug}-${from}-${to}`,
      displayName:
        clusters.length > 1 ? `${modelName} ${roman}` : `${modelName} ${from}–${to}`,
      yearFrom: from,
      yearTo: to,
    };
  });
}

export function resolveGenerationsForModel(
  makeSlug: string,
  modelSlug: string,
  modelName: string,
  trimYears: number[],
): GenerationSpineEntry[] {
  const curated = findGenerationSpine(makeSlug, modelSlug);
  if (curated) {
    return curated.generations;
  }
  return clusterTrimYearsToGenerations(modelName, modelSlug, trimYears);
}
