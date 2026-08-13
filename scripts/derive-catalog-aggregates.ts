/**
 * Derive fact-only engine / transmission stubs from AUTO.RIA trim labels already in DB.
 *
 * Does not scrape third-party encyclopedias. Creates approved units with
 * `source: autoria_derived`, no prose descriptions. Never overwrites curated KB rows
 * (`source` other than `autoria_derived`). Links trims only where FKs are still empty
 * (after `catalog:link:engines` rule matches).
 *
 * Usage:
 *   npx ts-node scripts/derive-catalog-aggregates.ts
 *   npx ts-node scripts/derive-catalog-aggregates.ts --dry-run
 *   MAKE=hyundai npx ts-node scripts/derive-catalog-aggregates.ts
 */
import { PrismaClient } from '../generated/client';
import {
  isPlausibleGearCount,
  normalizeTransmissionLabel,
  resolveEngineLabel,
  slugify,
} from '../src/modules/catalog/engine-trim.utils';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const MAKE_FILTER = process.env.MAKE?.trim().toLowerCase() || null;
const SOURCE = 'autoria_derived';
const BATCH = 80;

type EngineBucket = {
  makeSlug: string;
  makeName: string;
  engineLabel: string;
  powerHp: number | null;
  fuelType: string | null;
  aspiration: string | null;
  displacementCc: number | null;
  famSlug: string;
  unitSlug: string;
  trimIds: string[];
};

type TxBucket = {
  tx: string;
  type: string;
  gears: number | null;
  famSlug: string;
  unitSlug: string;
  trimIds: string[];
};

function engineUnitSlug(makeSlug: string, engineLabel: string, powerHp: number | null): string {
  const base = slugify(engineLabel) || 'engine';
  const power = powerHp != null && Number.isFinite(powerHp) ? `-${powerHp}` : '';
  return `derived-${makeSlug}-${base}${power}`;
}

function engineFamilySlug(makeSlug: string, engineLabel: string): string {
  const base = slugify(engineLabel) || 'engine';
  return `derived-${makeSlug}-${base}`;
}

function transmissionUnitSlug(tx: string): string {
  return `derived-${slugify(tx) || 'gearbox'}`;
}

function transmissionFamilySlug(tx: string): string {
  return `derived-${transmissionType(tx)}`;
}

function transmissionFamilyDisplayName(type: string): string {
  switch (type) {
    case 'manual':
      return 'Manual';
    case 'automatic':
      return 'Automat';
    case 'dct':
      return 'DCT / DSG';
    case 'cvt':
      return 'CVT';
    case 'amt':
      return 'AMT';
    default:
      return type.toUpperCase();
  }
}

function transmissionType(tx: string): string {
  if (/DCT|DSG/i.test(tx)) return 'dct';
  if (/CVT|IVT/i.test(tx)) return 'cvt';
  if (/AMT/i.test(tx)) return 'amt';
  if (/MT/i.test(tx)) return 'manual';
  if (/AT/i.test(tx)) return 'automatic';
  return 'other';
}

function transmissionGears(tx: string): number | null {
  const m = tx.match(/^(\d+)(MT|AT|CVT|DCT|DSG|AMT|IVT)$/i);
  if (!m) return null;
  const gears = Number(m[1]);
  const type = m[2].toUpperCase();
  return isPlausibleGearCount(type, gears) ? gears : null;
}

function displayEngineName(engineLabel: string, powerHp: number | null): string {
  if (powerHp != null && Number.isFinite(powerHp)) {
    return `${engineLabel} ${powerHp} KM`;
  }
  return engineLabel;
}

async function mapInBatches<T>(
  items: T[],
  size: number,
  fn: (chunk: T[]) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}

export type DeriveResult = {
  engineFamiliesUpserted: number;
  enginesUpserted: number;
  transmissionFamiliesUpserted: number;
  transmissionsUpserted: number;
  trimsLinkedEngine: number;
  trimsLinkedTransmission: number;
  skippedCuratedEngine: number;
  skippedCuratedTransmission: number;
  transmissionsSanitized: number;
  prunedBogusTransmissions: number;
};

export async function deriveCatalogAggregates(options?: {
  dryRun?: boolean;
  makeSlug?: string | null;
  prisma?: PrismaClient;
}): Promise<DeriveResult> {
  const db = options?.prisma ?? prisma;
  const dryRun = options?.dryRun ?? false;
  const makeSlug = options?.makeSlug ?? null;

  const trims = await db.catalogTrim.findMany({
    where: {
      generation: {
        isSupported: true,
        ...(makeSlug ? { model: { make: { slug: makeSlug } } } : {}),
      },
    },
    select: {
      id: true,
      engine: true,
      displayName: true,
      powerHp: true,
      fuelType: true,
      aspiration: true,
      displacementCc: true,
      transmission: true,
      engineId: true,
      transmissionId: true,
      engineFamilyId: true,
      transmissionFamilyId: true,
      generation: {
        select: {
          model: { select: { make: { select: { slug: true, name: true } } } },
        },
      },
    },
  });

  // Repair AMG badges stored as gearboxes ("63AT" → "AT") before deriving stubs.
  // Scope: all trims (including unsupported) so the index stays clean.
  let transmissionsSanitized = 0;
  if (!dryRun) {
    const allTxTrims = await db.catalogTrim.findMany({
      where: { transmission: { not: null } },
      select: { id: true, transmission: true },
    });
    const repairs = new Map<string, string[]>();
    const trimTxById = new Map(trims.map((t) => [t.id, t]));
    for (const row of allTxTrims) {
      if (!row.transmission) continue;
      const sanitized = normalizeTransmissionLabel(row.transmission);
      if (!sanitized || sanitized === row.transmission) continue;
      const list = repairs.get(sanitized) ?? [];
      list.push(row.id);
      repairs.set(sanitized, list);
      const inScope = trimTxById.get(row.id);
      if (inScope) inScope.transmission = sanitized;
      transmissionsSanitized += 1;
    }
    for (const [transmission, ids] of repairs) {
      await mapInBatches(ids, 200, async (chunk) => {
        await db.catalogTrim.updateMany({
          where: { id: { in: chunk } },
          data: { transmission, transmissionId: null, transmissionFamilyId: null },
        });
      });
    }
  } else {
    for (const trim of trims) {
      if (!trim.transmission) continue;
      const sanitized = normalizeTransmissionLabel(trim.transmission);
      if (sanitized && sanitized !== trim.transmission) {
        transmissionsSanitized += 1;
        trim.transmission = sanitized;
      }
    }
  }

  const engineBuckets = new Map<string, EngineBucket>();
  const txBuckets = new Map<string, TxBucket>();

  for (const trim of trims) {
    const make = trim.generation.model.make;
    const engineLabel = resolveEngineLabel(trim);
    if (engineLabel) {
      const famSlug = engineFamilySlug(make.slug, engineLabel);
      const unitSlug = engineUnitSlug(make.slug, engineLabel, trim.powerHp);
      const key = unitSlug;
      const bucket = engineBuckets.get(key);
      if (bucket) {
        bucket.trimIds.push(trim.id);
        if (bucket.displacementCc == null && trim.displacementCc != null) {
          bucket.displacementCc = trim.displacementCc;
        }
        if (!bucket.fuelType && trim.fuelType) bucket.fuelType = trim.fuelType;
        if (!bucket.aspiration && trim.aspiration) bucket.aspiration = trim.aspiration;
      } else {
        engineBuckets.set(key, {
          makeSlug: make.slug,
          makeName: make.name,
          engineLabel,
          powerHp: trim.powerHp,
          fuelType: trim.fuelType,
          aspiration: trim.aspiration,
          displacementCc: trim.displacementCc,
          famSlug,
          unitSlug,
          trimIds: [trim.id],
        });
      }
    }

    const tx = normalizeTransmissionLabel(trim.transmission);
    if (tx) {
      const famSlug = transmissionFamilySlug(tx);
      const unitSlug = transmissionUnitSlug(tx);
      const bucket = txBuckets.get(unitSlug);
      if (bucket) bucket.trimIds.push(trim.id);
      else {
        txBuckets.set(unitSlug, {
          tx,
          type: transmissionType(tx),
          gears: transmissionGears(tx),
          famSlug,
          unitSlug,
          trimIds: [trim.id],
        });
      }
    }
  }

  const existingEngines = await db.catalogEngine.findMany({
    select: { id: true, slug: true, source: true, familyId: true },
  });
  const existingEngineFamilies = await db.catalogEngineFamily.findMany({
    select: { id: true, slug: true, source: true },
  });
  const existingTransmissions = await db.catalogTransmission.findMany({
    select: { id: true, slug: true, source: true, familyId: true },
  });
  const existingTxFamilies = await db.catalogTransmissionFamily.findMany({
    select: { id: true, slug: true, source: true },
  });

  const engineBySlug = new Map(existingEngines.map((r) => [r.slug, r]));
  const engineFamBySlug = new Map(existingEngineFamilies.map((r) => [r.slug, r]));
  const txBySlug = new Map(existingTransmissions.map((r) => [r.slug, r]));
  const txFamBySlug = new Map(existingTxFamilies.map((r) => [r.slug, r]));

  const canTouch = (source: string | null | undefined) =>
    source == null || source === SOURCE;

  let skippedCuratedEngine = 0;
  let skippedCuratedTransmission = 0;
  let engineFamiliesUpserted = 0;
  let enginesUpserted = 0;
  let transmissionFamiliesUpserted = 0;
  let transmissionsUpserted = 0;

  const now = new Date();
  const engineIdBySlug = new Map<string, string>();
  const engineFamilyIdBySlug = new Map<string, string>();
  const transmissionIdBySlug = new Map<string, string>();
  const transmissionFamilyIdBySlug = new Map<string, string>();

  for (const row of existingEngineFamilies) engineFamilyIdBySlug.set(row.slug, row.id);
  for (const row of existingEngines) engineIdBySlug.set(row.slug, row.id);
  for (const row of existingTxFamilies) transmissionFamilyIdBySlug.set(row.slug, row.id);
  for (const row of existingTransmissions) transmissionIdBySlug.set(row.slug, row.id);

  // --- Engine families ---
  const famCreates: Array<{
    slug: string;
    displayName: string;
    manufacturer: string;
    displacementCc: number | null;
    fuelType: string | null;
    aspiration: string | null;
  }> = [];
  const famUpdates: EngineBucket[] = [];
  const seenFam = new Set<string>();

  for (const bucket of engineBuckets.values()) {
    if (seenFam.has(bucket.famSlug)) continue;
    seenFam.add(bucket.famSlug);
    const existing = engineFamBySlug.get(bucket.famSlug);
    if (existing && !canTouch(existing.source)) {
      skippedCuratedEngine += 1;
      continue;
    }
    if (!existing) {
      famCreates.push({
        slug: bucket.famSlug,
        displayName: `${bucket.makeName} ${bucket.engineLabel}`,
        manufacturer: bucket.makeName,
        displacementCc: bucket.displacementCc,
        fuelType: bucket.fuelType,
        aspiration: bucket.aspiration,
      });
    } else {
      famUpdates.push(bucket);
    }
  }

  if (!dryRun) {
    await mapInBatches(famCreates, BATCH, async (chunk) => {
      await db.catalogEngineFamily.createMany({
        data: chunk.map((row) => ({
          ...row,
          reviewStatus: 'approved',
          reviewedAt: now,
          source: SOURCE,
        })),
        skipDuplicates: true,
      });
    });
    const createdFams = await db.catalogEngineFamily.findMany({
      where: { slug: { in: famCreates.map((f) => f.slug) } },
      select: { id: true, slug: true },
    });
    for (const row of createdFams) engineFamilyIdBySlug.set(row.slug, row.id);

    await mapInBatches(famUpdates, BATCH, async (chunk) => {
      await Promise.all(
        chunk.map((bucket) =>
          db.catalogEngineFamily.update({
            where: { slug: bucket.famSlug },
            data: {
              displayName: `${bucket.makeName} ${bucket.engineLabel}`,
              manufacturer: bucket.makeName,
              displacementCc: bucket.displacementCc,
              fuelType: bucket.fuelType,
              aspiration: bucket.aspiration,
              reviewStatus: 'approved',
              reviewedAt: now,
              source: SOURCE,
            },
          }),
        ),
      );
    });
  }
  engineFamiliesUpserted = famCreates.length + famUpdates.length;

  // Refresh family ids for creates in dry-run / after createMany
  if (!dryRun && famCreates.length > 0) {
    const allDerivedFams = await db.catalogEngineFamily.findMany({
      where: { source: SOURCE },
      select: { id: true, slug: true },
    });
    for (const row of allDerivedFams) engineFamilyIdBySlug.set(row.slug, row.id);
  }

  // --- Engines ---
  const engineCreates: Array<{
    familyId: string;
    slug: string;
    displayName: string;
    displacementCc: number | null;
    fuelType: string | null;
    aspiration: string | null;
    powerHp: number | null;
  }> = [];
  const engineUpdates: EngineBucket[] = [];

  for (const bucket of engineBuckets.values()) {
    const existing = engineBySlug.get(bucket.unitSlug);
    if (existing && !canTouch(existing.source)) {
      skippedCuratedEngine += 1;
      continue;
    }
    const familyId = engineFamilyIdBySlug.get(bucket.famSlug);
    if (!familyId && !dryRun) continue;

    if (!existing) {
      if (familyId) {
        engineCreates.push({
          familyId,
          slug: bucket.unitSlug,
          displayName: displayEngineName(bucket.engineLabel, bucket.powerHp),
          displacementCc: bucket.displacementCc,
          fuelType: bucket.fuelType,
          aspiration: bucket.aspiration,
          powerHp: bucket.powerHp,
        });
      } else if (dryRun) {
        enginesUpserted += 1;
      }
    } else {
      engineUpdates.push(bucket);
    }
  }

  if (!dryRun) {
    await mapInBatches(engineCreates, BATCH, async (chunk) => {
      await db.catalogEngine.createMany({
        data: chunk.map((row) => ({
          ...row,
          reviewStatus: 'approved',
          reviewedAt: now,
          source: SOURCE,
        })),
        skipDuplicates: true,
      });
    });
    await mapInBatches(engineUpdates, BATCH, async (chunk) => {
      await Promise.all(
        chunk.map((bucket) => {
          const familyId = engineFamilyIdBySlug.get(bucket.famSlug);
          return db.catalogEngine.update({
            where: { slug: bucket.unitSlug },
            data: {
              ...(familyId ? { familyId } : {}),
              displayName: displayEngineName(bucket.engineLabel, bucket.powerHp),
              displacementCc: bucket.displacementCc,
              fuelType: bucket.fuelType,
              aspiration: bucket.aspiration,
              powerHp: bucket.powerHp,
              reviewStatus: 'approved',
              reviewedAt: now,
              source: SOURCE,
            },
          });
        }),
      );
    });
    const derivedEngines = await db.catalogEngine.findMany({
      where: { source: SOURCE },
      select: { id: true, slug: true },
    });
    for (const row of derivedEngines) engineIdBySlug.set(row.slug, row.id);
  }
  enginesUpserted = engineCreates.length + engineUpdates.length;
  if (dryRun) enginesUpserted = [...engineBuckets.values()].filter((b) => {
    const existing = engineBySlug.get(b.unitSlug);
    return !existing || canTouch(existing.source);
  }).length;

  // --- Transmission families ---
  const txFamCreates: Array<{
    slug: string;
    displayName: string;
    type: string;
    gears: number | null;
  }> = [];
  const txFamUpdates: TxBucket[] = [];
  const seenTxFam = new Set<string>();

  for (const bucket of txBuckets.values()) {
    if (seenTxFam.has(bucket.famSlug)) continue;
    seenTxFam.add(bucket.famSlug);
    const existing = txFamBySlug.get(bucket.famSlug);
    if (existing && !canTouch(existing.source)) {
      skippedCuratedTransmission += 1;
      continue;
    }
    if (!existing) {
      txFamCreates.push({
        slug: bucket.famSlug,
        displayName: transmissionFamilyDisplayName(bucket.type),
        type: bucket.type,
        gears: null,
      });
    } else {
      txFamUpdates.push(bucket);
    }
  }

  if (!dryRun) {
    await mapInBatches(txFamCreates, BATCH, async (chunk) => {
      await db.catalogTransmissionFamily.createMany({
        data: chunk.map((row) => ({
          ...row,
          reviewStatus: 'approved',
          reviewedAt: now,
          source: SOURCE,
        })),
        skipDuplicates: true,
      });
    });
    const created = await db.catalogTransmissionFamily.findMany({
      where: { slug: { in: txFamCreates.map((f) => f.slug) } },
      select: { id: true, slug: true },
    });
    for (const row of created) transmissionFamilyIdBySlug.set(row.slug, row.id);

    await mapInBatches(txFamUpdates, BATCH, async (chunk) => {
      await Promise.all(
        chunk.map((bucket) =>
          db.catalogTransmissionFamily.update({
            where: { slug: bucket.famSlug },
            data: {
              displayName: transmissionFamilyDisplayName(bucket.type),
              type: bucket.type,
              gears: null,
              reviewStatus: 'approved',
              reviewedAt: now,
              source: SOURCE,
            },
          }),
        ),
      );
    });

    const allTxFams = await db.catalogTransmissionFamily.findMany({
      where: { source: SOURCE },
      select: { id: true, slug: true },
    });
    for (const row of allTxFams) transmissionFamilyIdBySlug.set(row.slug, row.id);
  }
  transmissionFamiliesUpserted = txFamCreates.length + txFamUpdates.length;

  // --- Transmissions ---
  const txCreates: Array<{
    familyId: string;
    slug: string;
    displayName: string;
    type: string;
    gears: number | null;
  }> = [];
  const txUpdates: TxBucket[] = [];

  for (const bucket of txBuckets.values()) {
    const existing = txBySlug.get(bucket.unitSlug);
    if (existing && !canTouch(existing.source)) {
      skippedCuratedTransmission += 1;
      continue;
    }
    const familyId = transmissionFamilyIdBySlug.get(bucket.famSlug);
    const displayName =
      bucket.gears != null
        ? `${bucket.gears}-bieg. ${bucket.type === 'manual' ? 'manual' : bucket.tx}`
        : bucket.tx;

    if (!existing) {
      if (familyId) {
        txCreates.push({
          familyId,
          slug: bucket.unitSlug,
          displayName,
          type: bucket.type,
          gears: bucket.gears,
        });
      }
    } else {
      txUpdates.push(bucket);
    }
  }

  if (!dryRun) {
    await mapInBatches(txCreates, BATCH, async (chunk) => {
      await db.catalogTransmission.createMany({
        data: chunk.map((row) => ({
          ...row,
          reviewStatus: 'approved',
          reviewedAt: now,
          source: SOURCE,
        })),
        skipDuplicates: true,
      });
    });
    await mapInBatches(txUpdates, BATCH, async (chunk) => {
      await Promise.all(
        chunk.map((bucket) => {
          const familyId = transmissionFamilyIdBySlug.get(bucket.famSlug);
          const displayName =
            bucket.gears != null
              ? `${bucket.gears}-bieg. ${bucket.type === 'manual' ? 'manual' : bucket.tx}`
              : bucket.tx;
          return db.catalogTransmission.update({
            where: { slug: bucket.unitSlug },
            data: {
              ...(familyId ? { familyId } : {}),
              displayName,
              type: bucket.type,
              gears: bucket.gears,
              reviewStatus: 'approved',
              reviewedAt: now,
              source: SOURCE,
            },
          });
        }),
      );
    });
    const derivedTx = await db.catalogTransmission.findMany({
      where: { source: SOURCE },
      select: { id: true, slug: true },
    });
    for (const row of derivedTx) transmissionIdBySlug.set(row.slug, row.id);
  }
  transmissionsUpserted = dryRun
    ? txBuckets.size
    : txCreates.length + txUpdates.length;

  // --- Gap-fill trim FKs (batch by target unit) ---
  let trimsLinkedEngine = 0;
  let trimsLinkedTransmission = 0;

  const engineLinks = new Map<string, { engineId: string; familyId?: string; trimIds: string[] }>();
  const txLinks = new Map<
    string,
    { transmissionId: string; familyId?: string; trimIds: string[] }
  >();

  for (const trim of trims) {
    const makeSlugRow = trim.generation.model.make.slug;
    const engineLabel = resolveEngineLabel(trim);
    const tx = normalizeTransmissionLabel(trim.transmission);

    if (!trim.engineId && engineLabel) {
      const unitSlug = engineUnitSlug(makeSlugRow, engineLabel, trim.powerHp);
      const famSlug = engineFamilySlug(makeSlugRow, engineLabel);
      const engineId = engineIdBySlug.get(unitSlug);
      const familyId = engineFamilyIdBySlug.get(famSlug);
      if (engineId) {
        const key = `${engineId}:${familyId ?? ''}:${trim.engineFamilyId ? 'keepFam' : 'setFam'}`;
        const entry = engineLinks.get(key) ?? {
          engineId,
          familyId: !trim.engineFamilyId ? familyId : undefined,
          trimIds: [],
        };
        entry.trimIds.push(trim.id);
        engineLinks.set(key, entry);
        trimsLinkedEngine += 1;
      }
    }

    if (!trim.transmissionId && tx) {
      const unitSlug = transmissionUnitSlug(tx);
      const famSlug = transmissionFamilySlug(tx);
      const transmissionId = transmissionIdBySlug.get(unitSlug);
      const familyId = transmissionFamilyIdBySlug.get(famSlug);
      if (transmissionId) {
        const key = `${transmissionId}:${familyId ?? ''}:${trim.transmissionFamilyId ? 'keepFam' : 'setFam'}`;
        const entry = txLinks.get(key) ?? {
          transmissionId,
          familyId: !trim.transmissionFamilyId ? familyId : undefined,
          trimIds: [],
        };
        entry.trimIds.push(trim.id);
        txLinks.set(key, entry);
        trimsLinkedTransmission += 1;
      }
    }
  }

  if (!dryRun) {
    for (const link of engineLinks.values()) {
      await mapInBatches(link.trimIds, 200, async (ids) => {
        await db.catalogTrim.updateMany({
          where: { id: { in: ids }, engineId: null },
          data: {
            engineId: link.engineId,
            ...(link.familyId ? { engineFamilyId: link.familyId } : {}),
          },
        });
      });
    }
    for (const link of txLinks.values()) {
      await mapInBatches(link.trimIds, 200, async (ids) => {
        await db.catalogTrim.updateMany({
          where: { id: { in: ids }, transmissionId: null },
          data: {
            transmissionId: link.transmissionId,
            ...(link.familyId ? { transmissionFamilyId: link.familyId } : {}),
          },
        });
      });
    }
  }

  // Drop derived stubs that were AMG badges misread as gear counts (63AT, 45DCT…).
  let prunedBogusTransmissions = 0;
  const derivedTx = await db.catalogTransmission.findMany({
    where: { source: SOURCE },
    select: { id: true, slug: true, gears: true, type: true },
  });
  const bogusIds: string[] = [];
  for (const row of derivedTx) {
    const m = row.slug.replace(/^derived-/, '').match(/^(\d+)(mt|at|cvt|dct|dsg|amt|ivt)$/i);
    if (!m) continue;
    const gears = Number(m[1]);
    const type = m[2].toUpperCase();
    if (!isPlausibleGearCount(type, gears)) {
      bogusIds.push(row.id);
    }
  }
  if (!dryRun && bogusIds.length > 0) {
    await db.catalogTrim.updateMany({
      where: { transmissionId: { in: bogusIds } },
      data: { transmissionId: null },
    });
    await db.catalogTransmission.deleteMany({ where: { id: { in: bogusIds } } });
  }
  prunedBogusTransmissions = bogusIds.length;

  return {
    engineFamiliesUpserted,
    enginesUpserted,
    transmissionFamiliesUpserted,
    transmissionsUpserted,
    trimsLinkedEngine,
    trimsLinkedTransmission,
    skippedCuratedEngine,
    skippedCuratedTransmission,
    transmissionsSanitized,
    prunedBogusTransmissions,
  };
}

async function main() {
  const started = Date.now();
  const result = await deriveCatalogAggregates({
    dryRun: DRY_RUN,
    makeSlug: MAKE_FILTER,
  });

  console.log(DRY_RUN ? '── DERIVE AGGREGATES (dry-run) ──' : '── DERIVE AGGREGATES ──');
  if (MAKE_FILTER) console.log(`make filter: ${MAKE_FILTER}`);
  console.log(`engine families upserted: ${result.engineFamiliesUpserted}`);
  console.log(`engines upserted:         ${result.enginesUpserted}`);
  console.log(`tx families upserted:     ${result.transmissionFamiliesUpserted}`);
  console.log(`transmissions upserted:   ${result.transmissionsUpserted}`);
  console.log(`trims linked → engine:    ${result.trimsLinkedEngine}`);
  console.log(`trims linked → gearbox:   ${result.trimsLinkedTransmission}`);
  console.log(`tx labels sanitized:      ${result.transmissionsSanitized}`);
  console.log(`pruned bogus gearboxes:   ${result.prunedBogusTransmissions}`);
  console.log(`skipped curated engines:  ${result.skippedCuratedEngine}`);
  console.log(`skipped curated gearboxes:${result.skippedCuratedTransmission}`);
  console.log(`elapsed ms:               ${Date.now() - started}`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
