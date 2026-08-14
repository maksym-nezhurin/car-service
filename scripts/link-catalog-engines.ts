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
import {
  normalizeTransmissionLabel,
  parseGearCount,
  preferGearSpecificSlug,
  transmissionKey,
} from '../src/modules/catalog/engine-trim.utils';
import {
  MatchRule,
  ruleInScope,
  rulePowerMatches,
  TrimScope,
  unanimous,
  validateRule,
} from '../src/modules/catalog/match-rules.utils';

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
  return raw.map((rule, i) => validateRule(rule, i));
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
      // Upgrade a generic manufacturer-wide MT family to a gear-count-specific one when this
      // trim's own label confirms the gear count and that family is already in the KB.
      const resolvedTxSlug = txSlug
        ? preferGearSpecificSlug(
            txSlug,
            parseGearCount(normalizeTransmissionLabel(trim.transmission)),
            transmissionFamilyBySlug,
          )
        : txSlug;
      const transmission = resolvedTxSlug ? transmissionBySlug.get(resolvedTxSlug) : undefined;
      const transmissionFamilyId =
        transmission?.familyId ??
        (resolvedTxSlug ? transmissionFamilyBySlug.get(resolvedTxSlug)?.id : undefined) ??
        unanimous(txSlugs.map((slug) => (slug ? transmissionBySlug.get(slug)?.familyId : null)));

      if (!engineFamilyId) {
        const key = `${makeSlug} | ${trim.engine ?? '—'} | ${trim.powerHp ?? '—'} KM | ${txKey ?? '—'}`;
        unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
        // No KB rule match — leave FKs alone (may already be filled by catalog:derive:aggregates).
        continue;
      }

      const family = familyById.get(engineFamilyId);
      const next = {
        engineId: engine?.id ?? null,
        transmissionId: transmission?.id ?? null,
        engineFamilyId,
        transmissionFamilyId: transmissionFamilyId ?? null,
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
      else linkedEngineFamilies += 1;
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
