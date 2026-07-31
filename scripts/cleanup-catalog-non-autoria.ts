/**
 * Hard cleanup — keep only AUTO.RIA data that belongs to the curated PL plan.
 *
 * Rules (in order):
 *   1. makes    — slug not in AUTORIA_PL_SYNC_PLAN (incl. aliases) → delete (cascades)
 *   2. models   — inside kept makes, slug not in plan.modelSlugs   → delete (cascades)
 *   3. trims    — id without "autoria-" prefix (CarAPI / CarQuery / smoke)
 *   4. gens     — legacy rows left empty after step 3. AUTO.RIA generation slugs are
 *                always "<model>-<gen>", so slug === model slug marks a CarAPI
 *                single-blob generation. Empty AUTO.RIA generations are kept —
 *                their trims phase may simply not have run yet.
 *
 * Dry-run by default. Nothing is deleted without --apply.
 *
 * Usage:
 *   npx ts-node scripts/cleanup-catalog-non-autoria.ts
 *   npx ts-node scripts/cleanup-catalog-non-autoria.ts --apply
 */
import { PrismaClient } from '../generated/client';
import {
  AUTORIA_PL_SYNC_PLAN,
  findPlPlanMake,
} from './catalog-autoria-pl-plan';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const AUTORIA_ID_PREFIX = 'autoria-';

type MakeRow = {
  id: string;
  slug: string;
  name: string;
  _count: { models: number };
};

function isNumericAutoriaModelId(value: string | null): boolean {
  return value != null && /^\d+$/.test(value);
}

function plannedModelSlugs(makeSlug: string): Set<string> {
  const plan = findPlPlanMake(makeSlug);
  return new Set((plan?.modelSlugs ?? []).map((s) => s.toLowerCase()));
}

async function countChildren(makeIds: string[], modelIds: string[]) {
  const models = makeIds.length
    ? await prisma.catalogModel.count({ where: { makeId: { in: makeIds } } })
    : 0;
  const generations = await prisma.catalogGeneration.count({
    where: {
      OR: [
        ...(makeIds.length ? [{ model: { makeId: { in: makeIds } } }] : []),
        ...(modelIds.length ? [{ modelId: { in: modelIds } }] : []),
      ],
    },
  });
  const trims = await prisma.catalogTrim.count({
    where: {
      OR: [
        ...(makeIds.length
          ? [{ generation: { model: { makeId: { in: makeIds } } } }]
          : []),
        ...(modelIds.length ? [{ generation: { modelId: { in: modelIds } } }] : []),
      ],
    },
  });
  return { models, generations, trims };
}

async function main() {
  console.log(
    APPLY
      ? '── CATALOG CLEANUP (APPLY — rows will be deleted) ──'
      : '── CATALOG CLEANUP (dry-run — pass --apply to delete) ──',
  );

  const before = {
    makes: await prisma.catalogMake.count(),
    models: await prisma.catalogModel.count(),
    generations: await prisma.catalogGeneration.count(),
    trims: await prisma.catalogTrim.count(),
  };
  console.log('Before:', before);
  console.log(
    `PL plan: ${AUTORIA_PL_SYNC_PLAN.length} makes, ` +
      `${AUTORIA_PL_SYNC_PLAN.reduce((n, m) => n + m.modelSlugs.length, 0)} models\n`,
  );

  // ---------------------------------------------------------------- 1. makes
  const makes: MakeRow[] = await prisma.catalogMake.findMany({
    select: { id: true, slug: true, name: true, _count: { select: { models: true } } },
    orderBy: { slug: 'asc' },
  });

  const keptMakes = makes.filter((m) => findPlPlanMake(m.slug));
  const doomedMakes = makes.filter((m) => !findPlPlanMake(m.slug));

  const makeImpact = await countChildren(
    doomedMakes.map((m) => m.id),
    [],
  );
  console.log(
    `1. Makes outside PL plan: ${doomedMakes.length}/${makes.length} ` +
      `(→ ${makeImpact.models} models, ${makeImpact.generations} generations, ${makeImpact.trims} trims)`,
  );
  console.log(
    `   kept: ${keptMakes.map((m) => m.slug).join(', ') || '(none)'}`,
  );
  if (doomedMakes.length > 0) {
    const preview = doomedMakes
      .slice(0, 20)
      .map((m) => `${m.slug}(${m._count.models})`)
      .join(', ');
    console.log(
      `   drop: ${preview}${doomedMakes.length > 20 ? `, …+${doomedMakes.length - 20}` : ''}`,
    );
  }

  // --------------------------------------------------------------- 2. models
  const keptMakeIds = keptMakes.map((m) => m.id);
  const modelsInKeptMakes = keptMakeIds.length
    ? await prisma.catalogModel.findMany({
        where: { makeId: { in: keptMakeIds } },
        select: {
          id: true,
          slug: true,
          makeId: true,
          make: { select: { slug: true } },
        },
        orderBy: [{ make: { slug: 'asc' } }, { slug: 'asc' }],
      })
    : [];

  const doomedModels = modelsInKeptMakes.filter(
    (m) => !plannedModelSlugs(m.make.slug).has(m.slug.toLowerCase()),
  );
  const modelImpact = await countChildren(
    [],
    doomedModels.map((m) => m.id),
  );
  console.log(
    `\n2. Models outside PL plan (in kept makes): ${doomedModels.length}/${modelsInKeptMakes.length} ` +
      `(→ ${modelImpact.generations} generations, ${modelImpact.trims} trims)`,
  );
  if (doomedModels.length > 0) {
    const preview = doomedModels
      .slice(0, 20)
      .map((m) => `${m.make.slug}/${m.slug}`)
      .join(', ');
    console.log(
      `   drop: ${preview}${doomedModels.length > 20 ? `, …+${doomedModels.length - 20}` : ''}`,
    );
  }

  // ---------------------------------------------------------------- 3. trims
  const survivingModelIds = modelsInKeptMakes
    .filter((m) => !doomedModels.some((d) => d.id === m.id))
    .map((m) => m.id);

  const nonAutoriaTrims = survivingModelIds.length
    ? await prisma.catalogTrim.findMany({
        where: {
          generation: { modelId: { in: survivingModelIds } },
          NOT: { id: { startsWith: AUTORIA_ID_PREFIX } },
        },
        select: {
          id: true,
          slug: true,
          contentKey: true,
          generation: {
            select: {
              slug: true,
              model: { select: { slug: true, make: { select: { slug: true } } } },
            },
          },
        },
      })
    : [];

  console.log(`\n3. Non-AUTO.RIA trims in kept models: ${nonAutoriaTrims.length}`);
  for (const trim of nonAutoriaTrims.slice(0, 30)) {
    const g = trim.generation;
    console.log(
      `   drop: ${g.model.make.slug}/${g.model.slug}/${g.slug}/${trim.slug} (id=${trim.id})`,
    );
  }
  if (nonAutoriaTrims.length > 30) {
    console.log(`   …+${nonAutoriaTrims.length - 30} more`);
  }

  // ----------------------------------------------------------- 4. generations
  const generationsInScope = survivingModelIds.length
    ? await prisma.catalogGeneration.findMany({
        where: { modelId: { in: survivingModelIds } },
        select: {
          id: true,
          slug: true,
          externalModelId: true,
          contentKey: true,
          model: { select: { slug: true, make: { select: { slug: true } } } },
          trims: { select: { id: true } },
        },
      })
    : [];

  const doomedTrimIds = new Set(nonAutoriaTrims.map((t) => t.id));
  const isLegacyGeneration = (g: (typeof generationsInScope)[number]): boolean =>
    g.slug === g.model.slug ||
    !isNumericAutoriaModelId(g.externalModelId) ||
    g.contentKey == null;
  const survivingTrimCount = (g: (typeof generationsInScope)[number]): number =>
    g.trims.filter((t) => !doomedTrimIds.has(t.id)).length;

  const emptyStaleGenerations = generationsInScope.filter(
    (g) => isLegacyGeneration(g) && survivingTrimCount(g) === 0,
  );
  const staleWithTrims = generationsInScope.filter(
    (g) => isLegacyGeneration(g) && survivingTrimCount(g) > 0,
  );

  console.log(
    `\n4. Legacy generations left empty after step 3: ${emptyStaleGenerations.length}`,
  );
  for (const g of emptyStaleGenerations.slice(0, 30)) {
    console.log(`   drop: ${g.model.make.slug}/${g.model.slug}/${g.slug}`);
  }
  if (emptyStaleGenerations.length > 30) {
    console.log(`   …+${emptyStaleGenerations.length - 30} more`);
  }
  if (staleWithTrims.length > 0) {
    console.log(
      `   kept (legacy slug but holds AUTO.RIA trims): ${staleWithTrims
        .map((g) => `${g.model.make.slug}/${g.model.slug}/${g.slug} (${survivingTrimCount(g)})`)
        .join(', ')}`,
    );
  }

  // -------------------------------------------------------- content keys lost
  const lostContentKeys = [
    ...nonAutoriaTrims.map((t) => t.contentKey).filter(Boolean),
    ...emptyStaleGenerations.map((g) => g.contentKey).filter(Boolean),
  ] as string[];
  if (lostContentKeys.length > 0) {
    console.log(
      `\nContentful keys that disappear (${lostContentKeys.length}): ${lostContentKeys.join(', ')}`,
    );
  }

  if (!APPLY) {
    console.log('\nDry-run only — nothing deleted. Re-run with --apply.');
    return;
  }

  // ---------------------------------------------------------------- deletion
  console.log('\nDeleting…');
  const deletedMakes = doomedMakes.length
    ? await prisma.catalogMake.deleteMany({
        where: { id: { in: doomedMakes.map((m) => m.id) } },
      })
    : { count: 0 };

  const deletedModels = doomedModels.length
    ? await prisma.catalogModel.deleteMany({
        where: { id: { in: doomedModels.map((m) => m.id) } },
      })
    : { count: 0 };

  const deletedTrims = nonAutoriaTrims.length
    ? await prisma.catalogTrim.deleteMany({
        where: { id: { in: nonAutoriaTrims.map((t) => t.id) } },
      })
    : { count: 0 };

  const deletedGenerations = emptyStaleGenerations.length
    ? await prisma.catalogGeneration.deleteMany({
        where: { id: { in: emptyStaleGenerations.map((g) => g.id) } },
      })
    : { count: 0 };

  const after = {
    makes: await prisma.catalogMake.count(),
    models: await prisma.catalogModel.count(),
    generations: await prisma.catalogGeneration.count(),
    trims: await prisma.catalogTrim.count(),
  };

  console.log('Deleted:', {
    makes: deletedMakes.count,
    models: deletedModels.count,
    generations: deletedGenerations.count,
    trims: deletedTrims.count,
  });
  console.log('After:', after);
  console.log(
    '\nNext: re-run community seed in services/user (pnpm community:seed) so ' +
      'community_groups drop references to deleted generations/trims.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
