/**
 * Sync catalog model / generation hero images from Wikimedia Commons (CC / PD).
 *
 * Writes:
 *   apps/client/public/catalog/models/{make}/{model}.webp
 *   apps/client/public/catalog/models/{make}/{model}/{generation}.webp   (--generations)
 *   apps/client/public/catalog/models/manifest.json
 *
 * Model sync also stamps coverImageUrl on the newest generation (fallback).
 * Generation sync stamps coverImageUrl on each generation it downloads.
 *
 * Overrides (data/catalog-model-images/overrides.json):
 *   search / file keys: "make/model" or "make/model/generationSlug"
 *
 * Usage:
 *   npx ts-node scripts/sync-model-images-wikimedia.ts
 *   npx ts-node scripts/sync-model-images-wikimedia.ts --generations
 *   npx ts-node scripts/sync-model-images-wikimedia.ts --dry-run
 *   npx ts-node scripts/sync-model-images-wikimedia.ts --force
 *   MAKE=opel MODEL=mokka npx ts-node scripts/sync-model-images-wikimedia.ts --generations --force
 *
 * Wikimedia requires a descriptive User-Agent with contact.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '../generated/client';

type Overrides = {
  search?: Record<string, string>;
  file?: Record<string, string>;
};

type ManifestEntry = {
  makeSlug: string;
  modelSlug: string;
  generationSlug?: string;
  localPath: string;
  commonsTitle: string;
  commonsUrl: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  credit: string;
  sourceUrl: string;
  width: number | null;
  height: number | null;
  syncedAt: string;
};

type Manifest = {
  updatedAt: string;
  source: 'wikimedia_commons';
  models: Record<string, ManifestEntry>;
  generations?: Record<string, ManifestEntry>;
};

type CommonsCandidate = {
  title: string;
  thumbUrl: string;
  descriptionUrl: string;
  width: number;
  height: number;
  author: string;
  license: string;
  licenseUrl: string | null;
};

const USER_AGENT =
  'AutivoCatalogBot/1.0 (https://autivo.com.pl; catalog-images@autivo.com.pl)';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const TARGET_WIDTH = 1200;
const MIN_WIDTH = 640;
const RATE_MS = 1100;

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const SYNC_GENERATIONS = process.argv.includes('--generations');
const MAKE_FILTER = process.env.MAKE?.trim().toLowerCase() || null;
const MODEL_FILTER = process.env.MODEL?.trim().toLowerCase() || null;

const ROOT = path.resolve(__dirname, '..');
const MONOREPO = path.resolve(ROOT, '../..');
const OUT_DIR = path.resolve(MONOREPO, 'apps/client/public/catalog/models');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');
const DATA_DIR = path.resolve(ROOT, 'data/catalog-model-images');
const OVERRIDES_PATH = path.join(DATA_DIR, 'overrides.json');
const REJECT_PATH = path.join(DATA_DIR, 'reject.json');

const SKIP_TITLE =
  /logo|badge|emblem|icon|diagram|engine|cutaway|interior|dashboard|cockpit|wheel|tyre|tire|map|flag|svg|drawing|silhouette|blueprint|schematic|patent|chassis|transmission|gearbox|airport|security|police|policij|polizei|rally|btcc|dtm|wrc|racing|kit car|medical car|tuned by|yaris cross|yaris verso|peugeot rcz|pontiac|solstice|holden|barina|streetview|street view|\.pdf$/i;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function modelKey(makeSlug: string, modelSlug: string) {
  return `${makeSlug}/${modelSlug}`;
}

function generationKey(makeSlug: string, modelSlug: string, generationSlug: string) {
  return `${makeSlug}/${modelSlug}/${generationSlug}`;
}

function loadJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

function isAllowedLicense(license: string): boolean {
  const l = license.toLowerCase();
  if (!l) return false;
  if (/\bnc\b|noncommercial|non-commercial|nd\b|noderiv|no deriv/i.test(l)) {
    return false;
  }
  if (/public domain|pd[- ]|cc0|creative commons.?zero/i.test(l)) return true;
  if (/cc[- ]?by[- ]?sa/i.test(l)) return true;
  if (/cc[- ]?by(?![- ]?nc|[- ]?nd)/i.test(l)) return true;
  if (/^by[- ]?sa\b|^by\b/i.test(l)) return true;
  return false;
}

async function commonsGet(params: Record<string, string>): Promise<unknown> {
  const url = new URL(COMMONS_API);
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Commons HTTP ${res.status} for ${url.searchParams.get('action')}`);
  }
  return res.json();
}

function parseCandidate(page: {
  title?: string;
  imageinfo?: Array<{
    thumburl?: string;
    url?: string;
    descriptionurl?: string;
    width?: number;
    height?: number;
    thumbwidth?: number;
    thumbheight?: number;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}): CommonsCandidate | null {
  const info = page.imageinfo?.[0];
  if (!info || !page.title) return null;
  if (SKIP_TITLE.test(page.title)) return null;

  const mime = (info.mime ?? '').toLowerCase();
  if (mime && !/^image\/(jpeg|jpg|png|webp)$/.test(mime)) return null;

  const width = info.width ?? info.thumbwidth ?? 0;
  const height = info.height ?? info.thumbheight ?? 0;
  if (width < MIN_WIDTH) return null;
  if (height > 0 && width < height) return null; // skip portrait shots

  const meta = info.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value ?? meta.UsageTerms?.value ?? '');
  if (!isAllowedLicense(license)) return null;

  const author = stripHtml(meta.Artist?.value ?? meta.Credit?.value ?? 'Unknown');
  const licenseUrl = stripHtml(meta.LicenseUrl?.value ?? '') || null;
  const thumbUrl = info.thumburl ?? info.url;
  if (!thumbUrl) return null;

  return {
    title: page.title,
    thumbUrl,
    descriptionUrl:
      info.descriptionurl ??
      `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    width,
    height,
    author: author || 'Unknown',
    license,
    licenseUrl,
  };
}

async function searchCommons(
  query: string,
  reject: Set<string>,
  makeName: string,
  modelName: string,
  makeSlug: string,
  modelSlug: string,
  years?: { yearFrom: number | null; yearTo: number | null },
  generationSlug?: string,
): Promise<CommonsCandidate | null> {
  const data = (await commonsGet({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '24',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(TARGET_WIDTH),
  })) as {
    query?: { pages?: Record<string, unknown> };
  };

  const makeTokens = [
    ...tokenize(makeName),
    ...tokenize(makeSlug.replace(/-/g, ' ')),
  ];
  const modelTokens = [
    ...tokenize(modelName),
    ...tokenize(modelSlug.replace(/-/g, ' ')),
    // Mercedes / BMW style: "c-class" → also match "c-klasse", "c klasse"
    ...(modelSlug.endsWith('-class')
      ? [`${modelSlug[0]}-klasse`, `${modelSlug[0]} klasse`, `${modelSlug[0]}-class`]
      : []),
    ...(modelSlug.endsWith('-series')
      ? [`${modelSlug.replace('-series', '')}er`, `${modelSlug[0]}er`]
      : []),
  ];
  const uniqueMake = [...new Set(makeTokens)];
  const uniqueModel = [...new Set(modelTokens.filter((t) => t.length >= 1))];

  const pages = Object.values(data.query?.pages ?? {}) as Array<Parameters<typeof parseCandidate>[0]>;
  const scored: Array<{ c: CommonsCandidate; score: number }> = [];
  for (const page of pages) {
    const c = parseCandidate(page);
    if (!c) continue;
    if (reject.has(c.title) || reject.has(c.title.replace(/^File:/i, ''))) continue;
    const titleLower = c.title.toLowerCase().replace(/[_\-]/g, ' ');
    let titleScore = 0;
    for (const t of uniqueMake) {
      if (titleLower.includes(t)) titleScore += 5;
    }
    for (const t of uniqueModel) {
      if (t.length >= 2 && titleLower.includes(t)) titleScore += 10;
    }
    // single-letter class markers: " a " / " c " near mercedes
    if (modelSlug.match(/^[a-z]-class$/)) {
      const letter = modelSlug[0];
      if (
        new RegExp(`\\b${letter}[- ]?(class|klasse)\\b`, 'i').test(c.title) ||
        new RegExp(`\\b${letter}-klasse\\b`, 'i').test(c.title)
      ) {
        titleScore += 15;
      }
    }
    if (modelSlug.match(/^\d+-series$/)) {
      const num = modelSlug.split('-')[0];
      if (new RegExp(`\\b${num}[- ]?(series|er)\\b`, 'i').test(c.title)) {
        titleScore += 15;
      }
    }
    // Prefer photos whose filename mentions a year inside the generation window.
    if (years?.yearFrom != null) {
      const yTo = years.yearTo ?? new Date().getFullYear();
      const yearHits = [...titleLower.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0]));
      if (yearHits.some((y) => y >= years.yearFrom! && y <= yTo)) {
        titleScore += 12;
      } else if (yearHits.length > 0) {
        titleScore -= 6;
      }
    }
    // Chassis / platform codes from generation slug (W205, G20, B9, 8V…)
    const chassis = chassisTokensFromSlug(generationSlug);
    for (const code of chassis) {
      const re = new RegExp(`\\b${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(c.title) || titleLower.includes(code.toLowerCase())) {
        titleScore += code.length >= 3 ? 18 : 10;
      }
    }
    if (titleScore < 5) continue;
    const aspect = c.width / Math.max(c.height, 1);
    const score = titleScore * 1_000_000 + c.width * aspect;
    scored.push({ c, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.c ?? null;
}

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 || /^\d+$/.test(t));
}

async function resolveFileTitle(title: string): Promise<CommonsCandidate | null> {
  const fileTitle = title.startsWith('File:') ? title : `File:${title}`;
  const data = (await commonsGet({
    action: 'query',
    titles: fileTitle,
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(TARGET_WIDTH),
  })) as {
    query?: { pages?: Record<string, unknown> };
  };
  const page = Object.values(data.query?.pages ?? {})[0] as Parameters<typeof parseCandidate>[0];
  return parseCandidate(page);
}

function loadSharp(): typeof import('sharp') | null {
  const candidates = [
    path.resolve(MONOREPO, 'node_modules/sharp'),
    path.resolve(MONOREPO, 'node_modules/.pnpm/sharp@0.34.4/node_modules/sharp'),
    'sharp',
  ];
  for (const id of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(id);
    } catch {
      /* try next */
    }
  }
  return null;
}

async function downloadAsWebp(
  thumbUrl: string,
  dest: string,
): Promise<{ width: number | null; height: number | null }> {
  const res = await fetch(thumbUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const sharpFn = loadSharp();
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (!sharpFn) {
    throw new Error(
      'sharp is required to convert Commons images to WebP (pnpm add -D sharp in services/car)',
    );
  }

  const out = await sharpFn(buf)
    .rotate()
    .resize(TARGET_WIDTH, null, { withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 82 })
    .toBuffer();
  fs.writeFileSync(dest, out);
  const meta = await sharpFn(out).metadata();
  return { width: meta.width ?? null, height: meta.height ?? null };
}

function buildCredit(author: string, license: string): string {
  const a = author.length > 80 ? `${author.slice(0, 77)}…` : author;
  return `Photo: ${a} · ${license} · Wikimedia Commons`;
}

/**
 * Pull chassis / platform tokens from AUTO.RIA generation slugs, e.g.
 *   a4-b9-8w → ["B9","8W"], c-class-w205 → ["W205"], 3-series-g20 → ["G20"]
 */
function chassisTokensFromSlug(generationSlug?: string): string[] {
  if (!generationSlug) return [];
  const parts = generationSlug.toLowerCase().split('-');
  const out: string[] = [];
  for (const p of parts) {
    if (
      /^(e|f|g|w|x|c|a|s|h|v)\d{2,3}$/i.test(p) || // BMW E90 / MB W205 / Audi-ish
      /^(8[a-z]{0,2}|b\d)$/i.test(p) || // Audi 8V / 8PA / B9
      /^mk\d$/i.test(p) ||
      /^t\d{2}$/i.test(p) || // Nissan T32
      /^xv\d{2}$/i.test(p) || // Toyota XV70
      /^typ$/i.test(p)
    ) {
      if (p === 'typ') continue;
      out.push(p.toUpperCase());
    }
  }
  // typ-8d → keep 8D already captured; also "8pa", "8p"
  return [...new Set(out)];
}

function searchQuery(
  makeName: string,
  modelName: string,
  key: string,
  overrides: Overrides,
  years?: { yearFrom: number | null; yearTo: number | null },
  generationSlug?: string,
): string {
  const custom = overrides.search?.[key];
  if (custom?.trim()) return withBitmap(`${custom.trim()} car`);
  const chassis = chassisTokensFromSlug(generationSlug);
  if (chassis.length) {
    // Prefer strongest platform code first (longer / letter+digits).
    const code = [...chassis].sort((a, b) => b.length - a.length)[0];
    return withBitmap(`${makeName} ${modelName} ${code} car`);
  }
  if (years?.yearFrom != null) {
    const yTo = years.yearTo ?? years.yearFrom;
    // Mid-window year tends to match Commons filenames better than the full range.
    const mid = Math.round((years.yearFrom + yTo) / 2);
    return withBitmap(`${makeName} ${modelName} ${mid} car`);
  }
  return withBitmap(`${makeName} ${modelName} car`);
}

/** Commons search often ranks PDFs / docs above photos without this. */
function withBitmap(q: string): string {
  return /\bfiletype:bitmap\b/i.test(q) ? q : `${q} filetype:bitmap`;
}

/** Alternate queries when the primary Commons search scores nothing usable. */
function fallbackQueries(target: SyncTarget, overrides: Overrides): string[] {
  const out: string[] = [];
  const chassis = chassisTokensFromSlug(target.generationSlug);
  const code = [...chassis].sort((a, b) => b.length - a.length)[0];
  if (code) {
    out.push(withBitmap(`${target.makeName} ${code}`));
    // BMW / Mercedes short forms
    if (target.modelSlug.endsWith('-series')) {
      out.push(withBitmap(`${target.makeName} ${code} sedan`));
    }
    if (target.modelSlug.endsWith('-class')) {
      out.push(withBitmap(`${target.makeName} ${code}`));
      const letter = target.modelSlug[0]?.toUpperCase();
      if (letter) out.push(withBitmap(`${target.makeName} ${letter}-Klasse ${code}`));
    }
  }
  if (target.yearFrom != null) {
    const yTo = target.yearTo ?? target.yearFrom;
    const mid = Math.round((target.yearFrom + yTo) / 2);
    out.push(withBitmap(`${target.makeName} ${target.modelName} ${mid}`));
  }
  // Model-level search override as last resort (often names a modern chassis).
  const modelKeyStr = modelKey(target.makeSlug, target.modelSlug);
  const modelSearch = overrides.search?.[modelKeyStr];
  if (modelSearch?.trim()) out.push(withBitmap(`${modelSearch.trim()} car`));
  out.push(withBitmap(`${target.makeName} ${target.modelName}`));
  return [...new Set(out)];
}

type SyncTarget = {
  key: string;
  makeSlug: string;
  makeName: string;
  modelSlug: string;
  modelName: string;
  generationSlug?: string;
  generationId?: string;
  yearFrom: number | null;
  yearTo: number | null;
  localRel: string;
  dest: string;
  manifestBucket: 'models' | 'generations';
};

async function resolveCandidate(
  target: SyncTarget,
  overrides: Overrides,
  reject: Set<string>,
): Promise<CommonsCandidate | null> {
  const fileOverride = overrides.file?.[target.key];
  if (fileOverride) {
    const pinned = await resolveFileTitle(fileOverride);
    if (pinned) return pinned;
    console.warn(`  ! override file not usable: ${target.key} → ${fileOverride}`);
  }
  const years = { yearFrom: target.yearFrom, yearTo: target.yearTo };
  const primary = searchQuery(
    target.makeName,
    target.modelName,
    target.key,
    overrides,
    years,
    target.generationSlug,
  );
  const queries = [primary, ...fallbackQueries(target, overrides)];
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await sleep(RATE_MS);
    const hit = await searchCommons(
      queries[i],
      reject,
      target.makeName,
      target.modelName,
      target.makeSlug,
      target.modelSlug,
      years,
      target.generationSlug,
    );
    if (hit) return hit;
  }
  return null;
}

async function main() {
  const prisma = new PrismaClient();
  const overrides = loadJson<Overrides>(OVERRIDES_PATH, { search: {}, file: {} });
  const rejectList = loadJson<string[]>(REJECT_PATH, []);
  const reject = new Set(rejectList.map((t) => (t.startsWith('File:') ? t : `File:${t}`)));

  const existing: Manifest = fs.existsSync(MANIFEST_PATH)
    ? loadJson<Manifest>(MANIFEST_PATH, {
        updatedAt: '',
        source: 'wikimedia_commons',
        models: {},
        generations: {},
      })
    : { updatedAt: '', source: 'wikimedia_commons', models: {}, generations: {} };
  if (!existing.generations) existing.generations = {};

  const makes = await prisma.catalogMake.findMany({
    where: MAKE_FILTER ? { slug: MAKE_FILTER } : undefined,
    orderBy: { slug: 'asc' },
    select: {
      slug: true,
      name: true,
      models: {
        where: MODEL_FILTER ? { slug: MODEL_FILTER } : undefined,
        orderBy: { slug: 'asc' },
        select: {
          id: true,
          slug: true,
          name: true,
          generations: {
            orderBy: [{ yearFrom: 'desc' }, { slug: 'desc' }],
            select: {
              id: true,
              slug: true,
              yearFrom: true,
              yearTo: true,
              coverImageUrl: true,
              _count: { select: { trims: true } },
            },
          },
        },
      },
    },
  });

  const targets: SyncTarget[] = [];
  for (const make of makes) {
    for (const model of make.models) {
      if (SYNC_GENERATIONS) {
        for (const gen of model.generations) {
          if (gen._count.trims === 0) continue;
          targets.push({
            key: generationKey(make.slug, model.slug, gen.slug),
            makeSlug: make.slug,
            makeName: make.name,
            modelSlug: model.slug,
            modelName: model.name,
            generationSlug: gen.slug,
            generationId: gen.id,
            yearFrom: gen.yearFrom,
            yearTo: gen.yearTo,
            localRel: `/catalog/models/${make.slug}/${model.slug}/${gen.slug}.webp`,
            dest: path.join(OUT_DIR, make.slug, model.slug, `${gen.slug}.webp`),
            manifestBucket: 'generations',
          });
        }
      } else {
        const newest = model.generations[0];
        targets.push({
          key: modelKey(make.slug, model.slug),
          makeSlug: make.slug,
          makeName: make.name,
          modelSlug: model.slug,
          modelName: model.name,
          generationId: newest?.id,
          yearFrom: newest?.yearFrom ?? null,
          yearTo: newest?.yearTo ?? null,
          localRel: `/catalog/models/${make.slug}/${model.slug}.webp`,
          dest: path.join(OUT_DIR, make.slug, `${model.slug}.webp`),
          manifestBucket: 'models',
        });
      }
    }
  }

  const stats = { synced: 0, skipped: 0, failed: 0, unmatched: 0 };
  const unmatched: string[] = [];

  console.log(
    DRY_RUN
      ? '── CATALOG IMAGES (Wikimedia) dry-run ──'
      : '── CATALOG IMAGES (Wikimedia) ──',
  );
  console.log({
    mode: SYNC_GENERATIONS ? 'generations' : 'models',
    targets: targets.length,
    force: FORCE,
    outDir: OUT_DIR,
  });

  for (const target of targets) {
    const bucket =
      target.manifestBucket === 'generations' ? existing.generations! : existing.models;
    const hasFile = fs.existsSync(target.dest);
    const hasManifest = Boolean(bucket[target.key]);
    const currentTitle = bucket[target.key]?.commonsTitle;
    const rejectedCurrent = currentTitle
      ? reject.has(currentTitle) || reject.has(currentTitle.replace(/^File:/i, ''))
      : false;

    if (!FORCE && hasFile && hasManifest && !rejectedCurrent) {
      stats.skipped += 1;
      continue;
    }

    if (rejectedCurrent && hasFile) {
      try {
        fs.unlinkSync(target.dest);
      } catch {
        /* ignore */
      }
    }

    await sleep(RATE_MS);

    try {
      const candidate = await resolveCandidate(target, overrides, reject);
      if (!candidate) {
        stats.unmatched += 1;
        unmatched.push(target.key);
        console.log(`  ✗ ${target.key} — no Commons match`);
        continue;
      }

      console.log(
        `  ${DRY_RUN ? '~' : '✓'} ${target.key} ← ${candidate.title} (${candidate.license})`,
      );

      let width = candidate.width;
      let height = candidate.height;
      if (!DRY_RUN) {
        const dims = await downloadAsWebp(candidate.thumbUrl, target.dest);
        width = dims.width ?? width;
        height = dims.height ?? height;

        if (target.generationId) {
          await prisma.catalogGeneration.update({
            where: { id: target.generationId },
            data: { coverImageUrl: target.localRel },
          });
        }

        bucket[target.key] = {
          makeSlug: target.makeSlug,
          modelSlug: target.modelSlug,
          generationSlug: target.generationSlug,
          localPath: target.localRel,
          commonsTitle: candidate.title,
          commonsUrl: candidate.descriptionUrl,
          author: candidate.author,
          license: candidate.license,
          licenseUrl: candidate.licenseUrl,
          credit: buildCredit(candidate.author, candidate.license),
          sourceUrl: candidate.thumbUrl,
          width,
          height,
          syncedAt: new Date().toISOString(),
        };
      }
      stats.synced += 1;
    } catch (err) {
      stats.failed += 1;
      console.error(`  ✗ ${target.key}:`, err instanceof Error ? err.message : err);
    }
  }

  if (!DRY_RUN) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    existing.updatedAt = new Date().toISOString();
    existing.source = 'wikimedia_commons';
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(existing, null, 2)}\n`);
  }

  console.log('\nDone.', stats);
  if (unmatched.length) {
    console.log('\nUnmatched:');
    for (const u of unmatched.slice(0, 40)) console.log(`  - ${u}`);
    if (unmatched.length > 40) console.log(`  …+${unmatched.length - 40} more`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
