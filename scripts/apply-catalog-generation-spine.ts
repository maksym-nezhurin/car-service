/**
 * Apply curated generation spine to existing catalog models (Tucson, Sportage, …).
 * Reassigns trims by modelYear and removes obsolete single-blob generations.
 *
 * Usage: npx ts-node scripts/apply-catalog-generation-spine.ts
 */
import { PrismaClient } from '../generated/client';
import {
  buildContentKey,
  isGenerationSupported,
  resolveSupportTier,
} from '../src/modules/catalog/catalog-public.utils';
import {
  CATALOG_GENERATION_SPINE,
  pickGenerationForTrimYear,
} from '../src/modules/catalog/generation-spine';

const prisma = new PrismaClient();

async function applySpine(spine: (typeof CATALOG_GENERATION_SPINE)[number]) {
  const model = await prisma.catalogModel.findFirst({
    where: {
      slug: spine.modelSlug,
      make: { slug: spine.makeSlug },
    },
    select: { id: true, slug: true, name: true },
  });

  if (!model) {
    console.warn(`  skip ${spine.makeSlug}/${spine.modelSlug} — model not in DB`);
    return;
  }

  const spineSlugs = new Set(spine.generations.map((g) => g.slug));
  const generationIds = new Map<string, string>();

  for (const gen of spine.generations) {
    const contentKey = buildContentKey(spine.makeSlug, spine.modelSlug, gen.slug);
    const isSupported = isGenerationSupported(gen.yearFrom, gen.yearTo);
    const supportTier = resolveSupportTier(gen.yearTo);

    // manual_override > autoria_sync (docs/V1_7_VEHICLE_ENCYCLOPEDIA.md §4.5): don't clobber
    // an admin-edited displayName. reviewedAt is stamped on any admin edit — see
    // CatalogService.updateGenerationAdmin() and the same guard in sync-autoria-catalog.ts.
    const existingRow = await prisma.catalogGeneration.findUnique({
      where: { modelId_slug: { modelId: model.id, slug: gen.slug } },
      select: { reviewedAt: true },
    });
    const manuallyReviewed = existingRow?.reviewedAt != null;

    const row = await prisma.catalogGeneration.upsert({
      where: { modelId_slug: { modelId: model.id, slug: gen.slug } },
      create: {
        modelId: model.id,
        slug: gen.slug,
        displayName: gen.displayName,
        yearFrom: gen.yearFrom,
        yearTo: gen.yearTo,
        contentKey,
        isSupported,
        supportTier,
      },
      update: {
        ...(manuallyReviewed ? {} : { displayName: gen.displayName }),
        yearFrom: gen.yearFrom,
        yearTo: gen.yearTo,
        contentKey,
        isSupported,
        supportTier,
        syncedAt: new Date(),
      },
    });
    generationIds.set(gen.slug, row.id);
  }

  const trims = await prisma.catalogTrim.findMany({
    where: { generation: { modelId: model.id } },
    select: {
      id: true,
      modelYear: true,
      generationId: true,
      generation: { select: { slug: true, yearFrom: true, yearTo: true } },
    },
  });

  let moved = 0;
  for (const trim of trims) {
    let target = trim.modelYear != null
      ? pickGenerationForTrimYear(spine.generations, trim.modelYear)
      : null;

    if (!target && trim.generation.yearFrom != null) {
      target = pickGenerationForTrimYear(spine.generations, trim.generation.yearFrom);
    }

    if (!target) continue;
    const generationId = generationIds.get(target.slug);
    if (!generationId || generationId === trim.generationId) continue;
    await prisma.catalogTrim.update({
      where: { id: trim.id },
      data: { generationId },
    });
    moved += 1;
  }

  const obsolete = await prisma.catalogGeneration.findMany({
    where: {
      modelId: model.id,
      slug: { notIn: [...spineSlugs] },
    },
    select: { id: true, slug: true, _count: { select: { trims: true } } },
  });

  let removed = 0;
  for (const gen of obsolete) {
    if (gen._count.trims > 0) {
      console.warn(
        `  ⚠ ${spine.makeSlug}/${spine.modelSlug}: generation "${gen.slug}" still has ${gen._count.trims} trims — not deleted`,
      );
      continue;
    }
    await prisma.catalogGeneration.delete({ where: { id: gen.id } });
    removed += 1;
  }

  console.log(
    `  ✓ ${spine.makeSlug}/${spine.modelSlug}: ${spine.generations.length} generations, ${moved} trims moved, ${removed} obsolete removed`,
  );
}

async function main() {
  console.log(`Applying ${CATALOG_GENERATION_SPINE.length} generation spines…`);
  for (const spine of CATALOG_GENERATION_SPINE) {
    await applySpine(spine);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
