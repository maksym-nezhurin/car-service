/**
 * Dev smoke data when CarQuery is unreachable.
 * VARIANT rows = engines (not trim packages like Premium).
 * Includes Hyundai Tucson + Kia Sportage (powiązane grupy demo).
 *
 * Usage: npx ts-node scripts/seed-catalog-smoke.ts
 */
import { PrismaClient } from '../generated/client';
import {
  buildContentKey,
  isGenerationSupported,
  resolveSupportTier,
} from '../src/modules/catalog/catalog-public.utils';
import {
  buildEngineVariantKey,
  formatEngineDisplaySubtitle,
} from '../src/modules/catalog/engine-trim.utils';

const prisma = new PrismaClient();

type EngineRow = {
  id: string;
  engine: string;
  fuelType: string;
  aspiration: string | null;
  powerHp: number;
};

const TUCSON_ENGINES: EngineRow[] = [
  {
    id: 'tucson-16-gdi-132',
    engine: '1.6 GDI',
    fuelType: 'petrol',
    aspiration: 'atmo',
    powerHp: 132,
  },
  {
    id: 'tucson-16-tgdi-177',
    engine: '1.6 T-GDI',
    fuelType: 'petrol',
    aspiration: 'turbo',
    powerHp: 177,
  },
  {
    id: 'tucson-17-crdi-116',
    engine: '1.7 CRDi',
    fuelType: 'diesel',
    aspiration: null,
    powerHp: 116,
  },
  {
    id: 'tucson-20-crdi-136',
    engine: '2.0 CRDi',
    fuelType: 'diesel',
    aspiration: null,
    powerHp: 136,
  },
  {
    id: 'tucson-20-crdi-185',
    engine: '2.0 CRDi',
    fuelType: 'diesel',
    aspiration: null,
    powerHp: 185,
  },
];

const SPORTAGE_ENGINES: EngineRow[] = [
  {
    id: 'sportage-20-crdi-136',
    engine: '2.0 CRDi',
    fuelType: 'diesel',
    aspiration: null,
    powerHp: 136,
  },
  {
    id: 'sportage-16-tgdi-177',
    engine: '1.6 T-GDI',
    fuelType: 'petrol',
    aspiration: 'turbo',
    powerHp: 177,
  },
];

async function seedGeneration(params: {
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
  generationSlug: string;
  displayName: string;
  yearFrom: number;
  yearTo: number;
  shortDescription: string;
  engines: EngineRow[];
}) {
  await prisma.catalogMake.upsert({
    where: { id: params.makeId },
    create: { id: params.makeId, slug: params.makeId, name: params.makeName },
    update: { name: params.makeName },
  });

  await prisma.catalogModel.upsert({
    where: { id: params.modelId },
    create: {
      id: params.modelId,
      makeId: params.makeId,
      slug: params.modelId,
      name: params.modelName,
    },
    update: { name: params.modelName },
  });

  const contentKey = buildContentKey(params.makeId, params.modelId, params.generationSlug);
  const isSupported = isGenerationSupported(params.yearFrom, params.yearTo);
  const supportTier = resolveSupportTier(params.yearTo);

  const generation = await prisma.catalogGeneration.upsert({
    where: {
      modelId_slug: { modelId: params.modelId, slug: params.generationSlug },
    },
    create: {
      modelId: params.modelId,
      externalModelId: params.modelId,
      slug: params.generationSlug,
      displayName: params.displayName,
      yearFrom: params.yearFrom,
      yearTo: params.yearTo,
      shortDescription: params.shortDescription,
      coverImageUrl: null,
      contentKey,
      isSupported,
      supportTier,
    },
    update: {
      displayName: params.displayName,
      yearFrom: params.yearFrom,
      yearTo: params.yearTo,
      shortDescription: params.shortDescription,
      contentKey,
      isSupported,
      supportTier,
    },
  });

  for (const row of params.engines) {
    const spec = {
      engine: row.engine,
      fuelType: row.fuelType,
      aspiration: row.aspiration,
      powerHp: row.powerHp,
      displayName: row.engine,
    };
    const slug = buildEngineVariantKey(spec);
    const displayName = formatEngineDisplaySubtitle(spec);

    await prisma.catalogTrim.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        generationId: generation.id,
        slug,
        displayName,
        engine: row.engine,
        fuelType: row.fuelType,
        aspiration: row.aspiration,
        powerHp: row.powerHp,
      },
      update: {
        slug,
        displayName,
        engine: row.engine,
        fuelType: row.fuelType,
        aspiration: row.aspiration,
        powerHp: row.powerHp,
      },
    });
  }
}

async function main() {
  await seedGeneration({
    makeId: 'hyundai',
    makeName: 'Hyundai',
    modelId: 'tucson',
    modelName: 'Tucson',
    generationSlug: 'tucson-2015-2018',
    displayName: 'Tucson 2015–2018',
    yearFrom: 2015,
    yearTo: 2018,
    shortDescription: 'Smoke catalog — Hyundai TL (powiązane z Kia Sportage QL).',
    engines: TUCSON_ENGINES,
  });

  await seedGeneration({
    makeId: 'kia',
    makeName: 'Kia',
    modelId: 'sportage',
    modelName: 'Sportage',
    generationSlug: 'sportage-2016-2018',
    displayName: 'Sportage 2016–2018',
    yearFrom: 2016,
    yearTo: 2018,
    shortDescription: 'Smoke catalog — Kia QL (powiązane z Hyundai Tucson TL).',
    engines: SPORTAGE_ENGINES,
  });

  const counts = {
    makes: await prisma.catalogMake.count(),
    generations: await prisma.catalogGeneration.count(),
    trims: await prisma.catalogTrim.count(),
  };
  console.log('Smoke catalog seeded (Tucson + Sportage).', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
