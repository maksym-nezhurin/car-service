/**
 * Sync AUTO.RIA taxonomy → local catalog_* tables.
 *
 * Recommended (969 req/month budget):
 *   pnpm catalog:estimate:autoria          — cost calculator, no API
 *   SYNC_PLAN=pl SYNC_PHASE=structure SYNC_REQUEST_BUDGET=969 SYNC_DELAY_MS=800 \
 *     pnpm catalog:sync:autoria
 *
 * Phases (SYNC_PLAN=pl):
 *   structure   — makes + planned models + generations (~85 req)
 *   trims-pilot — engine trims for 5 headline models (~35–50 req, uses cache for gens)
 *   trims       — engine trims for all PL plan models (~350+ req)
 *
 * Env:
 *   SYNC_PLAN=pl                — only curated PL makes/models (see catalog-autoria-pl-plan.ts)
 *   SYNC_PHASE=structure|trims-pilot|trims|full
 *   SYNC_REQUEST_BUDGET=969     — stop before exceeding (reserve 20 by default)
 *   SYNC_REQUEST_RESERVE=20
 *   SYNC_DRY_RUN=1              — print plan + estimate, no API/DB writes
 *   SYNC_MAKE_SLUG=hyundai      — override: single make
 *   SYNC_HOURLY_MAX=25          — stop before RIA hourly cap (default 25 when SYNC_PLAN=pl)
 *   SYNC_RESUME=1               — skip models/makes already in DB (default on)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '../generated/client';
import {
  buildContentKey,
  buildTrimContentKey,
  isGenerationSupported,
  resolveSupportTier,
} from '../src/modules/catalog/catalog-public.utils';
import {
  autoriaGenerationSlug,
  buildEngineVariantKey,
  formatEngineDisplaySubtitle,
  parseAutoriaModification,
  resolveEngineLabel,
  slugify,
} from '../src/modules/catalog/engine-trim.utils';
import {
  AUTORIA_PL_SYNC_PLAN,
  estimatePlSyncRequests,
  findPlPlanMake,
  isPlPlanModel,
  isTrimPilotModel,
  parseTrimPilotFilter,
  plPlanModelNeedles,
} from './catalog-autoria-pl-plan';
import { linkCatalogEngines } from './link-catalog-engines';
import {
  autoriaId,
  autoriaListGenerationsByModel,
  autoriaListMarks,
  autoriaListModifications,
  autoriaListModels,
  dedupeMarksByEng,
  findByEngOrName,
  flattenAutoriaGenerations,
  normalizeAutoriaEng,
  requireAutoriaApiKey,
  type AutoriaMark,
  type AutoriaNameValue,
} from './autoria-client';
import { autoriaCacheEnabled } from './autoria-cache';
import {
  assertHourlyQuotaAvailable,
  AutoriaBudgetExhaustedError,
  AutoriaHourlyLimitError,
  getQuotaStats,
} from './autoria-quota';

const prisma = new PrismaClient();

type SyncPhase = 'structure' | 'trims-pilot' | 'trims' | 'full';

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('.env');

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isDryRun(): boolean {
  return ['1', 'true', 'yes'].includes((process.env.SYNC_DRY_RUN ?? '').trim().toLowerCase());
}

function resolvePhase(): SyncPhase {
  const raw = (process.env.SYNC_PHASE ?? '').trim().toLowerCase();
  if (raw === 'structure' || raw === 'trims-pilot' || raw === 'trims' || raw === 'full') {
    return raw;
  }
  if (process.env.SYNC_PLAN === 'pl') {
    return 'structure';
  }
  return 'full';
}

function shouldFetchStructure(phase: SyncPhase): boolean {
  return phase === 'structure' || phase === 'full' || phase === 'trims-pilot' || phase === 'trims';
}

function shouldFetchTrims(phase: SyncPhase, makeSlug: string, modelSlug: string): boolean {
  if (phase === 'structure') return false;
  if (phase === 'trims-pilot') {
    const pilots = parseTrimPilotFilter(process.env.SYNC_TRIM_MODELS);
    return pilots.some((p) => p.makeSlug === makeSlug && p.modelSlug === modelSlug);
  }
  if (phase === 'trims' || phase === 'full') {
    if (process.env.SYNC_PLAN === 'pl') {
      return isPlPlanModel(makeSlug, modelSlug);
    }
    return true;
  }
  return false;
}

async function upsertCatalogMake(params: {
  autoriaMakeId: string;
  name: string;
  slug: string;
}): Promise<string> {
  const bySlug = await prisma.catalogMake.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });
  if (bySlug) {
    await prisma.catalogMake.update({
      where: { id: bySlug.id },
      data: { name: params.name, syncedAt: new Date() },
    });
    return bySlug.id;
  }

  // PL plan slug (mercedes) may already exist as CarAPI slug (mercedes-benz)
  const plan = findPlPlanMake(params.slug);
  if (plan) {
    const candidates = [plan.makeSlug, ...(plan.makeAliases ?? [])];
    for (const alias of candidates) {
      if (alias === params.slug) continue;
      const byAlias = await prisma.catalogMake.findUnique({
        where: { slug: alias },
        select: { id: true },
      });
      if (byAlias) {
        await prisma.catalogMake.update({
          where: { id: byAlias.id },
          data: { name: params.name, syncedAt: new Date() },
        });
        return byAlias.id;
      }
    }
  }

  await prisma.catalogMake.upsert({
    where: { id: params.autoriaMakeId },
    create: {
      id: params.autoriaMakeId,
      slug: params.slug,
      name: params.name,
    },
    update: { name: params.name, syncedAt: new Date() },
  });
  return params.autoriaMakeId;
}

async function upsertCatalogModel(params: {
  autoriaModelId: string;
  makeId: string;
  name: string;
  slug: string;
}): Promise<string> {
  const bySlug = await prisma.catalogModel.findUnique({
    where: { makeId_slug: { makeId: params.makeId, slug: params.slug } },
    select: { id: true },
  });
  if (bySlug) {
    await prisma.catalogModel.update({
      where: { id: bySlug.id },
      data: { name: params.name, syncedAt: new Date() },
    });
    return bySlug.id;
  }

  await prisma.catalogModel.upsert({
    where: { id: params.autoriaModelId },
    create: {
      id: params.autoriaModelId,
      makeId: params.makeId,
      slug: params.slug,
      name: params.name,
    },
    update: { name: params.name, slug: params.slug, syncedAt: new Date() },
  });
  return params.autoriaModelId;
}

function shouldResumeSkip(): boolean {
  return process.env.SYNC_RESUME !== '0';
}

function sortMarksByPlPlan(
  marks: Array<AutoriaMark & { __planSlug?: string }>,
): Array<AutoriaMark & { __planSlug?: string }> {
  const order = new Map(AUTORIA_PL_SYNC_PLAN.map((m, i) => [m.makeSlug, i]));
  return [...marks].sort((a, b) => {
    const ai = order.get(a.__planSlug ?? resolveMakeSlug(a)) ?? 999;
    const bi = order.get(b.__planSlug ?? resolveMakeSlug(b)) ?? 999;
    return ai - bi;
  });
}

async function isMakeStructureComplete(
  makeId: string,
  plannedSlugs: string[],
): Promise<boolean> {
  if (plannedSlugs.length === 0) return false;
  for (const slug of plannedSlugs) {
    const model = await prisma.catalogModel.findUnique({
      where: { makeId_slug: { makeId, slug } },
      select: { id: true, _count: { select: { generations: true } } },
    });
    if (!model || model._count.generations === 0) {
      return false;
    }
  }
  return true;
}

async function modelGenerationCount(modelId: string): Promise<number> {
  return prisma.catalogGeneration.count({ where: { modelId } });
}

function resolveMakeSlug(mark: AutoriaMark): string {
  return (
    normalizeAutoriaEng(mark.eng) ||
    slugify(mark.name) ||
    autoriaId(mark.value)
  );
}

function resolveModelSlug(model: AutoriaNameValue): string {
  const eng = (model.eng ?? '').trim();
  if (eng) {
    return normalizeAutoriaEng(eng) || slugify(eng);
  }
  return slugify(model.name) || autoriaId(model.value);
}

function matchMakeInPlan(mark: AutoriaMark): string | null {
  const slug = resolveMakeSlug(mark);
  const byExact = findPlPlanMake(slug);
  if (byExact) return byExact.makeSlug;
  for (const entry of AUTORIA_PL_SYNC_PLAN) {
    const needles = [entry.makeSlug, ...(entry.makeAliases ?? [])];
    if (needles.some((n) => normalizeAutoriaEng(n) === slug || slugify(n) === slug)) {
      return entry.makeSlug;
    }
    if (findByEngOrName([mark], entry.makeSlug)) {
      return entry.makeSlug;
    }
  }
  return null;
}

function resolvePlannedModels(
  makeSlug: string,
  apiModels: AutoriaNameValue[],
): Array<{ planSlug: string; api: AutoriaNameValue }> {
  const plan = findPlPlanMake(makeSlug);
  if (!plan) return [];

  const out: Array<{ planSlug: string; api: AutoriaNameValue }> = [];
  for (const planSlug of plan.modelSlugs) {
    let api: AutoriaNameValue | undefined;
    for (const needle of plPlanModelNeedles(plan, planSlug)) {
      api =
        findByEngOrName(apiModels, needle) ??
        apiModels.find((m) => resolveModelSlug(m) === needle) ??
        apiModels.find((m) => slugify(m.name) === needle);
      if (api) break;
    }
    if (api) {
      out.push({ planSlug, api });
    } else {
      console.warn(`  ⚠ model not in AUTO.RIA: ${makeSlug}/${planSlug}`);
    }
  }
  return out;
}

async function syncModificationsForGeneration(params: {
  makeSlug: string;
  modelSlug: string;
  modelId: string;
  generation: Awaited<ReturnType<typeof prisma.catalogGeneration.upsert>>;
  autoriaGenerationId: number;
  delayMs: number;
}): Promise<number> {
  const { makeSlug, modelSlug, generation, autoriaGenerationId, delayMs } = params;

  const existingTrimCount = await prisma.catalogTrim.count({
    where: { generationId: generation.id },
  });
  if (existingTrimCount > 0 && process.env.SYNC_FORCE_TRIMS !== '1') {
    return 0;
  }

  if (delayMs > 0) await sleep(delayMs);

  let modifications;
  try {
    modifications = await autoriaListModifications(autoriaGenerationId);
  } catch (err) {
    if (err instanceof AutoriaHourlyLimitError || err instanceof AutoriaBudgetExhaustedError) {
      throw err;
    }
    console.warn(`    ⚠ mods ${generation.displayName}:`, (err as Error).message);
    return 0;
  }

  let written = 0;
  const seenEngineKeys = new Set<string>();
  const existingTrims = await prisma.catalogTrim.findMany({
    where: { generationId: generation.id },
    select: { id: true, slug: true },
  });
  const existingBySlug = new Map(existingTrims.map((t) => [t.slug, t.id]));
  const genSlug = generation.slug;

  for (const mod of modifications) {
    const parsed = parseAutoriaModification(mod.name);
    const engineLabel = resolveEngineLabel(parsed);
    if (!engineLabel) continue;

    const variantKey = buildEngineVariantKey(parsed);
    if (seenEngineKeys.has(variantKey)) continue;
    seenEngineKeys.add(variantKey);

    const trimData = {
      generationId: generation.id,
      slug: variantKey,
      displayName: formatEngineDisplaySubtitle(parsed),
      engine: engineLabel,
      fuelType: parsed.fuelType,
      aspiration: parsed.aspiration,
      powerHp: parsed.powerHp,
      transmission: parsed.transmission,
      modelYear: generation.yearFrom,
      contentKey: buildTrimContentKey(makeSlug, modelSlug, genSlug, variantKey),
      syncedAt: new Date(),
    };

    const autoriaTrimId = autoriaId(mod.value);
    const existingId = existingBySlug.get(variantKey);
    if (existingId) {
      await prisma.catalogTrim.update({ where: { id: existingId }, data: trimData });
    } else {
      await prisma.catalogTrim.upsert({
        where: { id: autoriaTrimId },
        create: { id: autoriaTrimId, ...trimData },
        update: trimData,
      });
    }
    written += 1;
  }
  return written;
}

async function main() {
  const usePlPlan = process.env.SYNC_PLAN === 'pl';
  const phase = resolvePhase();
  const dryRun = isDryRun();

  if (dryRun) {
    console.log('DRY RUN — no API calls, no DB writes\n');
    if (usePlPlan) {
      const est = estimatePlSyncRequests({
        phase: phase === 'full' ? 'full' : phase,
        avgGenerationsPerModel: 6,
      });
      console.log('PL plan estimate:', est);
    }
    console.log('\nWhen ready:');
    console.log('  SYNC_PLAN=pl SYNC_PHASE=structure SYNC_REQUEST_BUDGET=969 SYNC_DELAY_MS=800 pnpm catalog:sync:autoria');
    return;
  }

  requireAutoriaApiKey();
  assertHourlyQuotaAvailable();

  const budget = process.env.SYNC_REQUEST_BUDGET?.trim();
  console.log(`AUTO.RIA sync — phase="${phase}"${usePlPlan ? ' (PL plan)' : ''}`);
  if (budget) {
    console.log(`Request budget: ${budget} (reserve ${process.env.SYNC_REQUEST_RESERVE ?? '20'})`);
  }
  if (autoriaCacheEnabled()) {
    console.log('Dictionary cache ON — repeat runs cost 0 for cached paths.');
  }

  const makeLimit = Number(process.env.SYNC_MAKE_LIMIT || '0') || undefined;
  const makeSlugFilter = process.env.SYNC_MAKE_SLUG?.trim().toLowerCase();
  const delayMs = Number(process.env.SYNC_DELAY_MS || '800');

  const rawMarks = await autoriaListMarks();
  let marks = dedupeMarksByEng(rawMarks);

  if (usePlPlan) {
    marks = sortMarksByPlPlan(
      marks
        .map((m) => {
          const planSlug = matchMakeInPlan(m);
          return planSlug ? { ...m, __planSlug: planSlug } : null;
        })
        .filter(Boolean) as Array<AutoriaMark & { __planSlug?: string }>,
    );
  }

  if (makeSlugFilter) {
    const planForFilter = findPlPlanMake(makeSlugFilter);
    marks = marks.filter((m) => {
      const resolved = resolveMakeSlug(m);
      const planSlug =
        (m as AutoriaMark & { __planSlug?: string }).__planSlug ??
        matchMakeInPlan(m);
      if (resolved === makeSlugFilter || planSlug === makeSlugFilter) {
        return true;
      }
      // SYNC_MAKE_SLUG=mercedes | mercedes-benz → same PL plan entry
      if (planForFilter && planSlug === planForFilter.makeSlug) {
        return true;
      }
      if (
        planForFilter &&
        (resolved === planForFilter.makeSlug ||
          planForFilter.makeAliases?.some((a) => a.toLowerCase() === resolved))
      ) {
        return true;
      }
      return false;
    });
  }
  const slice = makeLimit ? marks.slice(0, makeLimit) : marks;

  console.log(`Processing ${slice.length} makes…`);

  let totalGenerations = 0;
  let totalTrims = 0;

  for (const mark of slice) {
    const markApiId = mark.value;
    const makeName = mark.name.trim();
    const makeSlug =
      (mark as AutoriaMark & { __planSlug?: string }).__planSlug ?? resolveMakeSlug(mark);
    const autoriaMakeId = autoriaId(markApiId);

    const makeId = await upsertCatalogMake({
      autoriaMakeId,
      name: makeName,
      slug: makeSlug,
    });

    const plan = findPlPlanMake(makeSlug);
    const plannedSlugsPreview = plan?.modelSlugs ?? [];

    if (
      phase === 'structure' &&
      shouldResumeSkip() &&
      (await isMakeStructureComplete(makeId, plannedSlugsPreview))
    ) {
      console.log(`  ○ ${makeName} — all ${plannedSlugsPreview.length} models already in DB, skip API`);
      continue;
    }

    if (delayMs > 0) await sleep(delayMs);

    const allApiModels = await autoriaListModels(markApiId);
    const planned = usePlPlan
      ? resolvePlannedModels(makeSlug, allApiModels)
      : allApiModels.map((api) => ({ planSlug: resolveModelSlug(api), api }));

    const modelLimit = Number(process.env.SYNC_MODEL_LIMIT || '0') || undefined;
    let modelsToProcess = modelLimit ? planned.slice(0, modelLimit) : planned;

    // trims-pilot: only the 5 headline models — skip other PL models of this make
    if (phase === 'trims-pilot') {
      modelsToProcess = modelsToProcess.filter((m) =>
        shouldFetchTrims(phase, makeSlug, m.planSlug),
      );
      if (modelsToProcess.length === 0) {
        console.log(`  ○ ${makeName} — no pilot models, skip`);
        continue;
      }
    }

    console.log(`  → ${makeName} (${modelsToProcess.length}/${allApiModels.length} models in scope)…`);

    for (const { planSlug: modelSlug, api: model } of modelsToProcess) {
      const modelApiId = model.value;
      const modelName = model.name.trim();
      const autoriaModelId = autoriaId(modelApiId);
      const fetchTrims = shouldFetchTrims(phase, makeSlug, modelSlug);

      const modelId = await upsertCatalogModel({
        autoriaModelId,
        makeId,
        name: modelName,
        slug: modelSlug,
      });

      if (
        phase === 'structure' &&
        shouldResumeSkip() &&
        !fetchTrims &&
        (await modelGenerationCount(modelId)) > 0
      ) {
        console.log(`    ○ skip ${modelSlug} — generations already in DB`);
        continue;
      }

      if (!shouldFetchStructure(phase) && fetchTrims) {
        // trims-only: generations from cache/API, then mods
      }

      if (shouldFetchStructure(phase) || fetchTrims) {
        if (delayMs > 0) await sleep(delayMs);

        let generationsPayload;
        try {
          generationsPayload = await autoriaListGenerationsByModel(modelApiId);
        } catch (err) {
          if (err instanceof AutoriaHourlyLimitError || err instanceof AutoriaBudgetExhaustedError) {
            throw err;
          }
          console.warn(`    ⚠ generations ${modelName}:`, (err as Error).message);
          continue;
        }

        const generations = flattenAutoriaGenerations(generationsPayload);
        for (const gen of generations) {
          const genSlug = autoriaGenerationSlug(modelSlug, gen.eng, gen.name);
          const isSupported = isGenerationSupported(gen.yearFrom, gen.yearTo);
          const supportTier = resolveSupportTier(gen.yearTo);
          const contentKey = buildContentKey(makeSlug, modelSlug, genSlug);

          let generationRecord;
          if (shouldFetchStructure(phase)) {
            generationRecord = await prisma.catalogGeneration.upsert({
              where: { modelId_slug: { modelId, slug: genSlug } },
              create: {
                modelId,
                externalModelId: String(modelApiId),
                slug: genSlug,
                displayName: gen.name,
                yearFrom: gen.yearFrom,
                yearTo: gen.yearTo,
                contentKey,
                isSupported,
                supportTier,
              },
              update: {
                externalModelId: String(modelApiId),
                displayName: gen.name,
                yearFrom: gen.yearFrom,
                yearTo: gen.yearTo,
                contentKey,
                isSupported,
                supportTier,
                syncedAt: new Date(),
              },
            });
            totalGenerations += 1;
          } else {
            generationRecord = await prisma.catalogGeneration.findUnique({
              where: { modelId_slug: { modelId, slug: genSlug } },
            });
            if (!generationRecord) {
              console.warn(`    ⚠ skip trims — generation missing in DB: ${makeSlug}/${modelSlug}/${genSlug}`);
              continue;
            }
          }

          if (fetchTrims && generationRecord) {
            const n = await syncModificationsForGeneration({
              makeSlug,
              modelSlug,
              modelId,
              generation: generationRecord,
              autoriaGenerationId: gen.generationId,
              delayMs,
            });
            totalTrims += n;
          }
        }
      }
    }

    console.log(`  ✓ ${makeName}`);
  }

  const counts = {
    makes: await prisma.catalogMake.count(),
    models: await prisma.catalogModel.count(),
    generations: await prisma.catalogGeneration.count(),
    trims: await prisma.catalogTrim.count(),
  };
  const linked = await linkCatalogEngines({ prisma, quiet: true });
  const quota = getQuotaStats();
  console.log('Done.', {
    ...counts,
    syncedGenerations: totalGenerations,
    syncedTrims: totalTrims,
    linkedEngines: linked.linkedEngines,
    linkedEngineFamilies: linked.linkedEngineFamilies,
    quota,
  });
}

main()
  .catch(async (e) => {
    if (e instanceof AutoriaBudgetExhaustedError || e instanceof AutoriaHourlyLimitError) {
      // Link what was already written — the next run may be an hour away.
      await linkCatalogEngines({ prisma, quiet: true }).catch(() => undefined);
      console.error('\n', e.message);
      console.error('Progress saved. Re-run the same command after the next hour.');
      process.exit(2);
    }
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
