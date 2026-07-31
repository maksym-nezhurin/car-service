/**
 * Link catalog trims to curated engine / transmission units (data/kb/match-rules.json).
 *
 * Rules are declarative so adding a new engine means editing JSON, not this file:
 *   { makes, models, yearFrom, yearTo, enginePattern, notEnginePattern, powerHp,
 *     engineSlug, transmissions: { MT: slug, AT: slug } }
 *
 * AUTO.RIA omits power for ~15% of trims, and the same label ("2.0 CRDi") covers
 * different engines across models and years. So matching runs in two tiers: an exact
 * unit link when the rule pins the power, and a family-level link when power is
 * unknown but every candidate rule agrees on the family. Ambiguity leaves the trim
 * unlinked rather than guessing.
 *
 * A rule may also target a family outright via engineFamilySlug — the honest option for
 * ranges like VAG 2.0 TDI, where the label plus years identify EA189 but not the code.
 * The first matching rule wins, so keep unit rules above the broader family rules.
 *
 * Writes by default (it only sets foreign keys). Unmatched engine/gearbox combos are
 * printed grouped by frequency — that list is the backlog for new KB entries.
 *
 * Usage:
 *   npx ts-node scripts/link-catalog-engines.ts
 *   npx ts-node scripts/link-catalog-engines.ts --dry-run
 *   MAKE=hyundai npx ts-node scripts/link-catalog-engines.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '../generated/client';
import { normalizeTransmissionLabel } from '../src/modules/catalog/engine-trim.utils';

type MatchRule = {
  makes?: string[];
  models?: string[];
  yearFrom?: number;
  yearTo?: number;
  /** Require the generation to sit fully inside the window instead of merely overlapping it. */
  yearsStrict?: boolean;
  enginePattern: string;
  notEnginePattern?: string;
  powerHp?: number[];
  /** Exactly one of the two: a concrete unit, or a family when the code stays unknown. */
  engineSlug?: string;
  engineFamilySlug?: string;
  /** Gearbox key (MT/AT/DCT/…) → transmission unit slug, or a family slug when the unit is unknown. */
  transmissions?: Record<string, string>;
};

type LinkOptions = {
  apply?: boolean;
  makeSlug?: string;
  prisma?: PrismaClient;
  quiet?: boolean;
};

export type LinkResult = {
  trims: number;
  linkedEngines: number;
  linkedEngineFamilies: number;
  linkedTransmissions: number;
  linkedTransmissionFamilies: number;
  cleared: number;
  unmatched: Array<{ key: string; count: number }>;
};

const RULES_PATH = path.resolve(__dirname, '..', 'data', 'kb', 'match-rules.json');

function loadRules(): MatchRule[] {
  const raw = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8')) as MatchRule[];
  return raw.map((rule, i) => {
    if (!rule.enginePattern) {
      throw new Error(`match-rules.json[${i}]: enginePattern is required`);
    }
    if (!rule.engineSlug === !rule.engineFamilySlug) {
      throw new Error(
        `match-rules.json[${i}]: set exactly one of engineSlug / engineFamilySlug`,
      );
    }
    if (rule.yearFrom != null && rule.yearTo != null && rule.yearFrom > rule.yearTo) {
      throw new Error(`match-rules.json[${i}]: yearFrom ${rule.yearFrom} is after yearTo ${rule.yearTo}`);
    }
    return rule;
  });
}

/** "7DCT" → "DCT", "6MT" → "MT" — rule keys are family-agnostic. */
function transmissionKey(raw: string | null): string | null {
  const tx = normalizeTransmissionLabel(raw);
  if (!tx) return null;
  const match = tx.match(/^(\d*)(MT|AT|CVT|DCT|DSG|AMT|IVT)(\d*)$/);
  return match ? match[2] : tx;
}

type TrimScope = {
  makeSlug: string;
  modelSlug: string;
  yearFrom: number | null;
  yearTo: number | null;
};

/**
 * Make / model / production-years gate — everything except the engine label itself.
 *
 * Default year check is an overlap. `yearsStrict` demands containment instead, which is
 * what separates engine eras: a 2003–2010 generation belongs to the PD era, while one
 * straddling the 2008 switch to common rail matches neither rule and stays unlinked.
 */
function ruleInScope(rule: MatchRule, scope: TrimScope): boolean {
  if (rule.makes && !rule.makes.includes(scope.makeSlug)) return false;
  if (rule.models && !rule.models.includes(scope.modelSlug)) return false;

  if (rule.yearsStrict) {
    const genTo = scope.yearTo ?? new Date().getFullYear();
    if (rule.yearFrom != null && (scope.yearFrom == null || scope.yearFrom < rule.yearFrom)) {
      return false;
    }
    if (rule.yearTo != null && genTo > rule.yearTo) return false;
    return true;
  }

  if (rule.yearFrom != null && scope.yearTo != null && scope.yearTo < rule.yearFrom) return false;
  if (rule.yearTo != null && scope.yearFrom != null && scope.yearFrom > rule.yearTo) return false;
  return true;
}

function rulePowerMatches(rule: MatchRule, powerHp: number | null): boolean {
  if (!rule.powerHp?.length) return true;
  return powerHp != null && rule.powerHp.includes(powerHp);
}

/** Single value shared by every entry, or null when they disagree / the list is empty. */
function unanimous<T>(values: Array<T | null | undefined>): T | null {
  const first = values[0];
  if (first == null) return null;
  return values.every((v) => v === first) ? first : null;
}

export async function linkCatalogEngines(options: LinkOptions = {}): Promise<LinkResult> {
  const prisma = options.prisma ?? new PrismaClient();
  const ownPrisma = !options.prisma;
  const apply = options.apply ?? true;
  const log = options.quiet ? () => {} : console.log;

  try {
    const rules = loadRules();

    const engines = await prisma.catalogEngine.findMany({
      select: {
        id: true,
        slug: true,
        familyId: true,
        code: true,
        displacementCc: true,
        family: { select: { displacementCc: true } },
      },
    });
    const transmissions = await prisma.catalogTransmission.findMany({
      select: { id: true, slug: true, familyId: true },
    });
    const engineFamilies = await prisma.catalogEngineFamily.findMany({
      select: { id: true, slug: true, displacementCc: true },
    });
    const transmissionFamilies = await prisma.catalogTransmissionFamily.findMany({
      select: { id: true, slug: true },
    });
    const engineBySlug = new Map(engines.map((e) => [e.slug, e]));
    const transmissionBySlug = new Map(transmissions.map((t) => [t.slug, t]));
    const engineFamilyBySlug = new Map(engineFamilies.map((f) => [f.slug, f]));
    const transmissionFamilyBySlug = new Map(transmissionFamilies.map((f) => [f.slug, f]));
    const familyById = new Map(engineFamilies.map((f) => [f.id, f]));

    /** Family a rule ultimately points at, whether it names a unit or the family itself. */
    const ruleFamilyId = (rule: MatchRule): string | undefined =>
      rule.engineSlug
        ? engineBySlug.get(rule.engineSlug)?.familyId
        : engineFamilyBySlug.get(rule.engineFamilySlug!)?.id;

    for (const rule of rules) {
      if (rule.engineSlug && !engineBySlug.has(rule.engineSlug)) {
        throw new Error(
          `match-rules.json: engineSlug "${rule.engineSlug}" is not in the KB — run catalog:import:kb first`,
        );
      }
      if (rule.engineFamilySlug && !engineFamilyBySlug.has(rule.engineFamilySlug)) {
        throw new Error(
          `match-rules.json: engineFamilySlug "${rule.engineFamilySlug}" is not in the KB — run catalog:import:kb first`,
        );
      }
      for (const slug of Object.values(rule.transmissions ?? {})) {
        if (!transmissionBySlug.has(slug) && !transmissionFamilyBySlug.has(slug)) {
          throw new Error(
            `match-rules.json: transmission slug "${slug}" matches neither a unit nor a family in the KB`,
          );
        }
      }
    }

    const trims = await prisma.catalogTrim.findMany({
      where: options.makeSlug
        ? { generation: { model: { make: { slug: options.makeSlug } } } }
        : undefined,
      select: {
        id: true,
        engine: true,
        powerHp: true,
        transmission: true,
        engineId: true,
        transmissionId: true,
        engineFamilyId: true,
        transmissionFamilyId: true,
        engineCode: true,
        displacementCc: true,
        generation: {
          select: {
            yearFrom: true,
            yearTo: true,
            model: { select: { slug: true, make: { select: { slug: true } } } },
          },
        },
      },
    });

    let linkedEngines = 0;
    let linkedEngineFamilies = 0;
    let linkedTransmissions = 0;
    let linkedTransmissionFamilies = 0;
    let cleared = 0;
    const unmatched = new Map<string, number>();

    for (const trim of trims) {
      const makeSlug = trim.generation.model.make.slug;
      const scope: TrimScope = {
        makeSlug,
        modelSlug: trim.generation.model.slug,
        yearFrom: trim.generation.yearFrom,
        yearTo: trim.generation.yearTo,
      };
      const txKey = transmissionKey(trim.transmission);

      const candidates = trim.engine
        ? rules.filter(
            (r) =>
              ruleInScope(r, scope) &&
              new RegExp(r.enginePattern, 'i').test(trim.engine!) &&
              !(r.notEnginePattern && new RegExp(r.notEnginePattern, 'i').test(trim.engine!)),
          )
        : [];
      const exact = candidates.find((r) => rulePowerMatches(r, trim.powerHp));

      // Power is the only discriminator between same-displacement variants. When it is
      // missing we can still name the family, provided every candidate points at one.
      const fallback =
        !exact && trim.powerHp == null && candidates.length > 0
          ? unanimous(candidates.map(ruleFamilyId))
          : null;

      const engine = exact?.engineSlug ? engineBySlug.get(exact.engineSlug) : undefined;
      const engineFamilyId = (exact ? ruleFamilyId(exact) : fallback) ?? null;

      const txSlugs = txKey
        ? (exact ? [exact] : fallback ? candidates : []).map((r) => r.transmissions?.[txKey])
        : [];
      const txSlug = unanimous(txSlugs);
      const transmission = txSlug ? transmissionBySlug.get(txSlug) : undefined;
      const transmissionFamilyId =
        transmission?.familyId ??
        (txSlug ? transmissionFamilyBySlug.get(txSlug)?.id : undefined) ??
        unanimous(txSlugs.map((slug) => (slug ? transmissionBySlug.get(slug)?.familyId : null)));

      if (!engineFamilyId) {
        const key = `${makeSlug} | ${trim.engine ?? '—'} | ${trim.powerHp ?? '—'} KM | ${txKey ?? '—'}`;
        unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
      }

      const family = engineFamilyId ? familyById.get(engineFamilyId) : undefined;
      const next = {
        engineId: engine?.id ?? null,
        transmissionId: transmission?.id ?? null,
        engineFamilyId,
        transmissionFamilyId,
        engineCode: engine?.code ?? null,
        displacementCc: engine?.displacementCc ?? family?.displacementCc ?? null,
      };

      const changed =
        next.engineId !== trim.engineId ||
        next.transmissionId !== trim.transmissionId ||
        next.engineFamilyId !== trim.engineFamilyId ||
        next.transmissionFamilyId !== trim.transmissionFamilyId ||
        next.engineCode !== trim.engineCode ||
        next.displacementCc !== trim.displacementCc;

      if (engine) linkedEngines += 1;
      else if (engineFamilyId) linkedEngineFamilies += 1;
      if (transmission) linkedTransmissions += 1;
      else if (transmissionFamilyId) linkedTransmissionFamilies += 1;
      if (!engine && trim.engineId) cleared += 1;

      if (changed && apply) {
        await prisma.catalogTrim.update({ where: { id: trim.id }, data: next });
      }
    }

    const unmatchedSorted = [...unmatched.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    log(
      apply
        ? '── ENGINE / TRANSMISSION LINKING ──'
        : '── ENGINE / TRANSMISSION LINKING (dry-run) ──',
    );
    log({
      trims: trims.length,
      linkedEngines,
      linkedEngineFamilies,
      linkedTransmissions,
      linkedTransmissionFamilies,
      clearedStaleLinks: cleared,
      unmatchedCombos: unmatchedSorted.length,
    });

    if (unmatchedSorted.length > 0) {
      log('\nTop unmatched combos (make | engine | power | gearbox):');
      for (const row of unmatchedSorted.slice(0, 25)) {
        log(`  ${String(row.count).padStart(4)} × ${row.key}`);
      }
      if (unmatchedSorted.length > 25) {
        log(`  …+${unmatchedSorted.length - 25} more combos`);
      }
    }

    return {
      trims: trims.length,
      linkedEngines,
      linkedEngineFamilies,
      linkedTransmissions,
      linkedTransmissionFamilies,
      cleared,
      unmatched: unmatchedSorted,
    };
  } finally {
    if (ownPrisma) await prisma.$disconnect();
  }
}

if (require.main === module) {
  linkCatalogEngines({
    apply: !process.argv.includes('--dry-run'),
    makeSlug: process.env.MAKE?.trim().toLowerCase() || undefined,
  }).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
