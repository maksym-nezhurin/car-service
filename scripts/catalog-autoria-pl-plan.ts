/**
 * Curated PL-market sync plan — only these makes/models spend AUTO.RIA quota.
 * Matches apps/client/lib/catalog/showcase-data.ts (keep in sync manually).
 *
 * Request math (live API, no cache):
 *   structure: 1 marks + N makes models + M models generations
 *   trims:     + sum(generations per synced model) modifications
 */
export type AutoriaPlPlanMake = {
  makeSlug: string;
  /** Extra slug aliases for AUTO.RIA eng/name matching */
  makeAliases?: string[];
  modelSlugs: string[];
  /** plan slug → AUTO.RIA eng/name needles (e.g. mazda3 → "3", glc → "glc-class") */
  modelAliases?: Record<string, string[]>;
};

export const AUTORIA_PL_SYNC_PLAN: AutoriaPlPlanMake[] = [
  {
    makeSlug: 'hyundai',
    modelSlugs: ['tucson', 'i30', 'kona', 'santa-fe', 'ioniq-5'],
  },
  {
    makeSlug: 'kia',
    modelSlugs: ['sportage', 'ceed', 'niro', 'ev6', 'sorento'],
  },
  {
    makeSlug: 'volkswagen',
    makeAliases: ['vw'],
    modelSlugs: ['golf', 'passat', 'tiguan', 'polo', 't-roc'],
  },
  {
    makeSlug: 'skoda',
    modelSlugs: ['octavia', 'fabia', 'superb', 'kodiaq', 'kamiq'],
  },
  {
    makeSlug: 'toyota',
    modelSlugs: ['corolla', 'yaris', 'rav4', 'c-hr', 'camry'],
  },
  {
    makeSlug: 'bmw',
    modelSlugs: ['3-series', '5-series', 'x1', 'x3', 'x5'],
    makeAliases: ['bmw'],
  },
  {
    makeSlug: 'audi',
    modelSlugs: ['a3', 'a4', 'a6', 'q3', 'q5'],
  },
  {
    makeSlug: 'mercedes',
    makeAliases: ['mercedes-benz', 'mercedesbenz'],
    modelSlugs: ['c-class', 'e-class', 'a-class', 'glc', 'gla'],
    modelAliases: {
      glc: ['glc-class'],
      gla: ['gla-class'],
    },
  },
  {
    makeSlug: 'ford',
    modelSlugs: ['focus', 'fiesta', 'kuga', 'puma', 'mondeo'],
  },
  {
    makeSlug: 'opel',
    modelSlugs: ['corsa', 'astra', 'mokka', 'grandland'],
  },
  {
    makeSlug: 'renault',
    modelSlugs: ['clio', 'megane', 'captur', 'kadjar'],
  },
  {
    makeSlug: 'peugeot',
    modelSlugs: ['208', '308', '3008', '2008'],
  },
  {
    makeSlug: 'seat',
    modelSlugs: ['leon', 'ibiza', 'arona', 'ateca'],
  },
  {
    makeSlug: 'nissan',
    modelSlugs: ['qashqai', 'juke', 'leaf', 'x-trail'],
  },
  {
    makeSlug: 'mazda',
    modelSlugs: ['mazda3', 'cx-5', 'cx-30', 'mx-5'],
    modelAliases: {
      mazda3: ['3'],
    },
  },
];

/** Pilot models for phase "trims-pilot" — full engine list first. */
export const AUTORIA_PL_TRIM_PILOT: Array<{ makeSlug: string; modelSlug: string }> = [
  { makeSlug: 'hyundai', modelSlug: 'tucson' },
  { makeSlug: 'kia', modelSlug: 'sportage' },
  { makeSlug: 'volkswagen', modelSlug: 'golf' },
  { makeSlug: 'skoda', modelSlug: 'octavia' },
  { makeSlug: 'toyota', modelSlug: 'corolla' },
];

export function countPlPlan(): { makes: number; models: number } {
  const makes = AUTORIA_PL_SYNC_PLAN.length;
  const models = AUTORIA_PL_SYNC_PLAN.reduce((n, m) => n + m.modelSlugs.length, 0);
  return { makes, models };
}

/** Rough API cost (generations per model is unknown until fetched). */
export function estimatePlSyncRequests(options: {
  phase: 'structure' | 'trims' | 'trims-pilot' | 'full';
  /** Average generations per model — for trims estimate only */
  avgGenerationsPerModel?: number;
}): {
  marks: number;
  modelLists: number;
  generations: number;
  modifications: number;
  total: number;
  note: string;
} {
  const { makes, models } = countPlPlan();
  const avgGen = options.avgGenerationsPerModel ?? 6;

  const marks = 1;
  const modelLists = makes;

  let generationModels = 0;
  let modGenerations = 0;

  if (options.phase === 'structure' || options.phase === 'full') {
    generationModels = models;
  }
  if (options.phase === 'trims' || options.phase === 'full') {
    generationModels = models;
    modGenerations = models * avgGen;
  }
  if (options.phase === 'trims-pilot') {
    generationModels = AUTORIA_PL_TRIM_PILOT.length;
    modGenerations = AUTORIA_PL_TRIM_PILOT.length * avgGen;
  }

  const generations = generationModels;
  const modifications = options.phase === 'structure' ? 0 : modGenerations;
  const total = marks + modelLists + generations + modifications;

  return {
    marks,
    modelLists,
    generations,
    modifications,
    total,
    note:
      options.phase === 'structure'
        ? 'Structure only — no engine trims. Safe first step (~85 req).'
        : `Trims assume ~${avgGen} generations/model (actual varies). Cache hits cost 0.`,
  };
}

export function plPlanModelNeedles(
  plan: AutoriaPlPlanMake,
  planSlug: string,
): string[] {
  const slug = planSlug.toLowerCase();
  const aliases = plan.modelAliases?.[slug] ?? plan.modelAliases?.[planSlug] ?? [];
  return [slug, ...aliases.map((a) => a.toLowerCase())];
}

export function findPlPlanMake(makeSlug: string): AutoriaPlPlanMake | undefined {
  const s = makeSlug.toLowerCase();
  return AUTORIA_PL_SYNC_PLAN.find(
    (m) =>
      m.makeSlug === s ||
      m.makeAliases?.some((a) => a.toLowerCase() === s),
  );
}

export function isPlPlanModel(makeSlug: string, modelSlug: string): boolean {
  const make = findPlPlanMake(makeSlug);
  if (!make) return false;
  return make.modelSlugs.includes(modelSlug.toLowerCase());
}

export function isTrimPilotModel(makeSlug: string, modelSlug: string): boolean {
  return AUTORIA_PL_TRIM_PILOT.some(
    (p) => p.makeSlug === makeSlug && p.modelSlug === modelSlug,
  );
}

export function parseTrimPilotFilter(raw: string | undefined): Array<{ makeSlug: string; modelSlug: string }> {
  if (!raw?.trim()) return AUTORIA_PL_TRIM_PILOT;
  return raw.split(',').map((pair) => {
    const [makeSlug, modelSlug] = pair.trim().toLowerCase().split('/');
    if (!makeSlug || !modelSlug) {
      throw new Error(`Invalid SYNC_TRIM_MODELS entry "${pair}" — use make/model, e.g. hyundai/tucson`);
    }
    return { makeSlug, modelSlug };
  });
}
