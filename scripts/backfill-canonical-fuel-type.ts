#!/usr/bin/env npx ts-node
/**
 * Backfills canonicalFuelType/canonicalAspiration on catalog_engine_families, catalog_engines,
 * and catalog_trims from their existing raw fuelType/aspiration strings (AUT-33).
 *
 * Separate from catalog:derive:aggregates on purpose — that script derives *new* engine/
 * transmission entities from trim labels, a different and much larger job. This one only
 * annotates rows that already exist, using the same matching rules as formatFuelLabel()
 * (see canonical-fuel-type.utils.ts).
 *
 * Idempotent — re-running only touches rows whose canonical value would change, safe to
 * re-run after any update to the matching rules.
 *
 * Usage:
 *   npx ts-node scripts/backfill-canonical-fuel-type.ts
 *   npx ts-node scripts/backfill-canonical-fuel-type.ts --dry-run
 */
import { PrismaClient } from '../generated/client';
import {
  deriveCanonicalAspiration,
  deriveCanonicalFuelType,
} from '../src/modules/catalog/canonical-fuel-type.utils';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH = 200;

async function backfillEngineFamilies() {
  const rows = await prisma.catalogEngineFamily.findMany({
    select: {
      id: true,
      fuelType: true,
      aspiration: true,
      canonicalFuelType: true,
      canonicalAspiration: true,
    },
  });

  let updated = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (const row of batch) {
      const canonicalFuelType = deriveCanonicalFuelType(
        row.fuelType,
        row.aspiration,
      );
      const canonicalAspiration = deriveCanonicalAspiration(row.aspiration);
      if (
        row.canonicalFuelType === canonicalFuelType &&
        row.canonicalAspiration === canonicalAspiration
      ) {
        continue;
      }
      updated++;
      if (!DRY_RUN) {
        await prisma.catalogEngineFamily.update({
          where: { id: row.id },
          data: { canonicalFuelType, canonicalAspiration },
        });
      }
    }
  }
  console.log(
    `catalog_engine_families: ${updated}/${rows.length} rows ${DRY_RUN ? 'would be updated' : 'updated'}`,
  );
}

async function backfillEngines() {
  const rows = await prisma.catalogEngine.findMany({
    select: {
      id: true,
      fuelType: true,
      aspiration: true,
      canonicalFuelType: true,
    },
  });

  let updated = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (const row of batch) {
      const canonicalFuelType = deriveCanonicalFuelType(
        row.fuelType,
        row.aspiration,
      );
      if (row.canonicalFuelType === canonicalFuelType) continue;
      updated++;
      if (!DRY_RUN) {
        await prisma.catalogEngine.update({
          where: { id: row.id },
          data: { canonicalFuelType },
        });
      }
    }
  }
  console.log(
    `catalog_engines: ${updated}/${rows.length} rows ${DRY_RUN ? 'would be updated' : 'updated'}`,
  );
}

async function backfillTrims() {
  const rows = await prisma.catalogTrim.findMany({
    select: {
      id: true,
      fuelType: true,
      aspiration: true,
      canonicalFuelType: true,
    },
  });

  let updated = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (const row of batch) {
      const canonicalFuelType = deriveCanonicalFuelType(
        row.fuelType,
        row.aspiration,
      );
      if (row.canonicalFuelType === canonicalFuelType) continue;
      updated++;
      if (!DRY_RUN) {
        await prisma.catalogTrim.update({
          where: { id: row.id },
          data: { canonicalFuelType },
        });
      }
    }
  }
  console.log(
    `catalog_trims: ${updated}/${rows.length} rows ${DRY_RUN ? 'would be updated' : 'updated'}`,
  );
}

async function main() {
  console.log(
    `=== Backfilling canonical fuel type / aspiration${DRY_RUN ? ' (dry run)' : ''} ===`,
  );
  await backfillEngineFamilies();
  await backfillEngines();
  await backfillTrims();
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
