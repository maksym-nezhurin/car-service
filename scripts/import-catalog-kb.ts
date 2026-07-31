/**
 * Import the curated engine / transmission knowledge base from data/kb/*.json.
 *
 * Layout:
 *   data/kb/engine-families/<slug>.json        → catalog_engine_families
 *   data/kb/engines/<slug>.json                → catalog_engines        (familySlug → family)
 *   data/kb/transmission-families/<slug>.json  → catalog_transmission_families
 *   data/kb/transmissions/<slug>.json          → catalog_transmissions  (familySlug → family)
 *
 * Texts are our own PL descriptions; `source` / `externalRef` only record where the
 * facts were verified. Upsert by slug, so re-running is safe.
 *
 * Usage:
 *   npx ts-node scripts/import-catalog-kb.ts
 *   npx ts-node scripts/import-catalog-kb.ts --prune   # drop KB rows missing from files
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '../generated/client';

const prisma = new PrismaClient();

const PRUNE = process.argv.includes('--prune');
const KB_DIR = path.resolve(__dirname, '..', 'data', 'kb');

type Json = Record<string, unknown>;

function readDir(dir: string): Array<{ file: string; data: Json }> {
  const full = path.join(KB_DIR, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => ({
      file: `${dir}/${file}`,
      data: JSON.parse(fs.readFileSync(path.join(full, file), 'utf8')) as Json,
    }));
}

function requireString(entry: { file: string; data: Json }, key: string): string {
  const value = entry.data[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${entry.file}: "${key}" is required and must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(entry: { file: string; data: Json }, key: string): string | null {
  const value = entry.data[key];
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw new Error(`${entry.file}: "${key}" must be a string`);
  }
  return value.trim() || null;
}

function optionalInt(entry: { file: string; data: Json }, key: string): number | null {
  const value = entry.data[key];
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${entry.file}: "${key}" must be a number`);
  }
  return Math.round(value);
}

function stringArray(entry: { file: string; data: Json }, key: string): string[] {
  const value = entry.data[key];
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(`${entry.file}: "${key}" must be an array of strings`);
  }
  return value as string[];
}

function reviewStatus(entry: { file: string; data: Json }): string {
  const value = optionalString(entry, 'reviewStatus') ?? 'approved';
  if (!['approved', 'draft', 'rejected'].includes(value)) {
    throw new Error(`${entry.file}: unknown reviewStatus "${value}"`);
  }
  return value;
}

async function importEngineFamilies(now: Date): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const entry of readDir('engine-families')) {
    const slug = requireString(entry, 'slug');
    const data = {
      displayName: requireString(entry, 'displayName'),
      manufacturer: optionalString(entry, 'manufacturer'),
      displacementCc: optionalInt(entry, 'displacementCc'),
      fuelType: optionalString(entry, 'fuelType'),
      aspiration: optionalString(entry, 'aspiration'),
      engineCodes: stringArray(entry, 'engineCodes'),
      shortDescription: optionalString(entry, 'shortDescription'),
      reviewStatus: reviewStatus(entry),
      reviewedAt: now,
      source: optionalString(entry, 'source'),
    };
    const row = await prisma.catalogEngineFamily.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
      select: { id: true },
    });
    ids.set(slug, row.id);
  }
  return ids;
}

async function importEngines(now: Date, familyIds: Map<string, string>): Promise<string[]> {
  const slugs: string[] = [];
  for (const entry of readDir('engines')) {
    const slug = requireString(entry, 'slug');
    const familySlug = requireString(entry, 'familySlug');
    const familyId = familyIds.get(familySlug);
    if (!familyId) {
      throw new Error(`${entry.file}: unknown familySlug "${familySlug}"`);
    }
    const data = {
      familyId,
      code: optionalString(entry, 'code'),
      displayName: requireString(entry, 'displayName'),
      displacementCc: optionalInt(entry, 'displacementCc'),
      fuelType: optionalString(entry, 'fuelType'),
      aspiration: optionalString(entry, 'aspiration'),
      powerHp: optionalInt(entry, 'powerHp'),
      powerKw: optionalInt(entry, 'powerKw'),
      torqueNm: optionalInt(entry, 'torqueNm'),
      cylinders: optionalInt(entry, 'cylinders'),
      injection: optionalString(entry, 'injection'),
      euroStandard: optionalString(entry, 'euroStandard'),
      yearFrom: optionalInt(entry, 'yearFrom'),
      yearTo: optionalInt(entry, 'yearTo'),
      shortDescription: optionalString(entry, 'shortDescription'),
      reliabilityNotes: optionalString(entry, 'reliabilityNotes'),
      reviewStatus: reviewStatus(entry),
      reviewedAt: now,
      source: optionalString(entry, 'source'),
      externalRef: optionalString(entry, 'externalRef'),
    };
    await prisma.catalogEngine.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });
    slugs.push(slug);
  }
  return slugs;
}

async function importTransmissionFamilies(now: Date): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const entry of readDir('transmission-families')) {
    const slug = requireString(entry, 'slug');
    const data = {
      displayName: requireString(entry, 'displayName'),
      type: optionalString(entry, 'type'),
      gears: optionalInt(entry, 'gears'),
      manufacturer: optionalString(entry, 'manufacturer'),
      shortDescription: optionalString(entry, 'shortDescription'),
      reviewStatus: reviewStatus(entry),
      reviewedAt: now,
      source: optionalString(entry, 'source'),
    };
    const row = await prisma.catalogTransmissionFamily.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
      select: { id: true },
    });
    ids.set(slug, row.id);
  }
  return ids;
}

async function importTransmissions(
  now: Date,
  familyIds: Map<string, string>,
): Promise<string[]> {
  const slugs: string[] = [];
  for (const entry of readDir('transmissions')) {
    const slug = requireString(entry, 'slug');
    const familySlug = requireString(entry, 'familySlug');
    const familyId = familyIds.get(familySlug);
    if (!familyId) {
      throw new Error(`${entry.file}: unknown familySlug "${familySlug}"`);
    }
    const data = {
      familyId,
      code: optionalString(entry, 'code'),
      displayName: requireString(entry, 'displayName'),
      type: optionalString(entry, 'type'),
      gears: optionalInt(entry, 'gears'),
      drive: optionalString(entry, 'drive'),
      maxTorqueNm: optionalInt(entry, 'maxTorqueNm'),
      yearFrom: optionalInt(entry, 'yearFrom'),
      yearTo: optionalInt(entry, 'yearTo'),
      shortDescription: optionalString(entry, 'shortDescription'),
      reliabilityNotes: optionalString(entry, 'reliabilityNotes'),
      reviewStatus: reviewStatus(entry),
      reviewedAt: now,
      source: optionalString(entry, 'source'),
      externalRef: optionalString(entry, 'externalRef'),
    };
    await prisma.catalogTransmission.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });
    slugs.push(slug);
  }
  return slugs;
}

async function prune(kept: {
  engineFamilies: string[];
  engines: string[];
  transmissionFamilies: string[];
  transmissions: string[];
}) {
  const engines = await prisma.catalogEngine.deleteMany({
    where: { slug: { notIn: kept.engines } },
  });
  const transmissions = await prisma.catalogTransmission.deleteMany({
    where: { slug: { notIn: kept.transmissions } },
  });
  const engineFamilies = await prisma.catalogEngineFamily.deleteMany({
    where: { slug: { notIn: kept.engineFamilies } },
  });
  const transmissionFamilies = await prisma.catalogTransmissionFamily.deleteMany({
    where: { slug: { notIn: kept.transmissionFamilies } },
  });
  console.log('Pruned rows missing from data/kb:', {
    engineFamilies: engineFamilies.count,
    engines: engines.count,
    transmissionFamilies: transmissionFamilies.count,
    transmissions: transmissions.count,
  });
}

async function main() {
  const now = new Date();

  const engineFamilyIds = await importEngineFamilies(now);
  const engineSlugs = await importEngines(now, engineFamilyIds);
  const transmissionFamilyIds = await importTransmissionFamilies(now);
  const transmissionSlugs = await importTransmissions(now, transmissionFamilyIds);

  console.log('Imported KB:', {
    engineFamilies: engineFamilyIds.size,
    engines: engineSlugs.length,
    transmissionFamilies: transmissionFamilyIds.size,
    transmissions: transmissionSlugs.length,
  });

  if (PRUNE) {
    await prune({
      engineFamilies: [...engineFamilyIds.keys()],
      engines: engineSlugs,
      transmissionFamilies: [...transmissionFamilyIds.keys()],
      transmissions: transmissionSlugs,
    });
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
