/**
 * One-off / scheduled sync: CarQuery API → local catalog_* tables.
 *
 * Usage (from services/car):
 *   CARQUERY_API_URL=https://www.carqueryapi.com/api/0.3/ \
 *   DATABASE_URL=... \
 *   npx ts-node scripts/sync-carquery-catalog.ts
 *
 * Optional: SYNC_MAKE_LIMIT=5 SYNC_DELAY_MS=300 for dev smoke runs.
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
  isTrimPackageName,
  parseCarQueryTrim,
  resolveEngineLabel,
  slugify,
} from '../src/modules/catalog/engine-trim.utils';

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}`);
  }
  const data = await res.json();
  return typeof data === 'string' ? JSON.parse(data) : (data as Record<string, unknown>);
}

async function main() {
  const apiUrl = process.env.CARQUERY_API_URL;
  if (!apiUrl) {
    throw new Error('CARQUERY_API_URL is required');
  }

  const makeLimit = Number(process.env.SYNC_MAKE_LIMIT || '0') || undefined;
  const delayMs = Number(process.env.SYNC_DELAY_MS || '200');

  const makesRaw = await fetchJson(`${apiUrl}?cmd=getMakes`);
  const makes = (makesRaw.Makes || makesRaw.makes || []) as Array<Record<string, string>>;
  const slice = makeLimit ? makes.slice(0, makeLimit) : makes;

  console.log(`Syncing ${slice.length} makes…`);

  for (const make of slice) {
    const makeId = String(make.make_id ?? make.id ?? '');
    const makeName = String(make.make_display ?? make.name ?? makeId);
    if (!makeId) continue;

      const makeSlug = slugify(makeName) || makeId;

      await prisma.catalogMake.upsert({
        where: { id: makeId },
        create: {
          id: makeId,
          slug: makeSlug,
          name: makeName,
        },
        update: { name: makeName, slug: makeSlug, syncedAt: new Date() },
      });

    await sleep(delayMs);
    const modelsRaw = await fetchJson(
      `${apiUrl}?cmd=getModels&make=${encodeURIComponent(makeId)}`,
    );
    const models = (modelsRaw.Models || modelsRaw.models || []) as Array<
      Record<string, string>
    >;

    for (const model of models) {
      const modelId = String(model.model_id ?? model.id ?? '');
      const modelName = String(model.model_name ?? model.name ?? modelId);
      if (!modelId) continue;

      const modelSlug = slugify(modelName) || modelId;
      await prisma.catalogModel.upsert({
        where: { id: modelId },
        create: {
          id: modelId,
          makeId,
          slug: modelSlug,
          name: modelName,
        },
        update: { name: modelName, slug: modelSlug, syncedAt: new Date() },
      });

      await sleep(delayMs);
      const trimsRaw = await fetchJson(
        `${apiUrl}?cmd=getTrims&model=${encodeURIComponent(modelId)}`,
      );
      const trims = (trimsRaw.Trims || trimsRaw.trims || []) as Array<
        Record<string, string>
      >;

      let yearFrom: number | null = null;
      let yearTo: number | null = null;
      for (const t of trims) {
        const y = Number(t.model_year ?? t.year);
        if (!Number.isFinite(y)) continue;
        yearFrom = yearFrom == null ? y : Math.min(yearFrom, y);
        yearTo = yearTo == null ? y : Math.max(yearTo, y);
      }

      const genSlug = modelSlug;
      const displayName =
        yearFrom != null && yearTo != null
          ? `${modelName} ${yearFrom}–${yearTo}`
          : modelName;

      if (!isGenerationSupported(yearFrom, yearTo)) {
        continue;
      }

      const contentKey = buildContentKey(makeSlug, modelSlug, genSlug);
      const isSupported = isGenerationSupported(yearFrom, yearTo);
      const supportTier = resolveSupportTier(yearTo);

      const generation = await prisma.catalogGeneration.upsert({
        where: {
          modelId_slug: { modelId, slug: genSlug },
        },
        create: {
          modelId,
          externalModelId: modelId,
          slug: genSlug,
          displayName,
          yearFrom,
          yearTo,
          contentKey,
          isSupported,
          supportTier,
        },
        update: {
          externalModelId: modelId,
          displayName,
          yearFrom,
          yearTo,
          contentKey,
          isSupported,
          supportTier,
          syncedAt: new Date(),
        },
      });

      const seenEngineKeys = new Set<string>();

      for (const trim of trims) {
        const parsed = parseCarQueryTrim(trim);
        const engineLabel = resolveEngineLabel(parsed);
        if (!engineLabel || isTrimPackageName(parsed.displayName ?? '')) {
          continue;
        }

        const variantKey = buildEngineVariantKey(parsed);
        if (seenEngineKeys.has(variantKey)) {
          continue;
        }
        seenEngineKeys.add(variantKey);

        const displayName = formatEngineDisplaySubtitle(parsed);
        const trimId = String(trim.model_id ?? trim.trim_id ?? trim.id ?? '');
        const id =
          trimId && trimId !== modelId
            ? trimId
            : `${modelId}-${variantKey}`;

        await prisma.catalogTrim.upsert({
          where: { id },
          create: {
            id,
            generationId: generation.id,
            slug: variantKey,
            displayName,
            engine: engineLabel,
            fuelType: parsed.fuelType,
            aspiration: parsed.aspiration,
            powerHp: parsed.powerHp,
            modelYear: Number(trim.model_year) || null,
          },
          update: {
            generationId: generation.id,
            slug: variantKey,
            displayName,
            engine: engineLabel,
            fuelType: parsed.fuelType,
            aspiration: parsed.aspiration,
            powerHp: parsed.powerHp,
            modelYear: Number(trim.model_year) || null,
            syncedAt: new Date(),
          },
        });
      }
    }

    console.log(`  ✓ ${makeName} (${models.length} models)`);
  }

  const counts = {
    makes: await prisma.catalogMake.count(),
    models: await prisma.catalogModel.count(),
    generations: await prisma.catalogGeneration.count(),
    trims: await prisma.catalogTrim.count(),
  };
  console.log('Done.', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
