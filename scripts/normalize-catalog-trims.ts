/**
 * Re-parse stored engine labels — no API quota spent.
 *
 * Rows synced before the parser fixes kept gearbox and drivetrain tokens inside the
 * engine column ("2.0 CRDi AT AWD") and missed hybrid/diesel detection. The raw
 * AUTO.RIA string is not stored, so the engine column is the source here.
 * Also recomputes the variant slug (engine + power + gearbox) and merges duplicates
 * that existed while the slug ignored the gearbox.
 *
 * Dry-run by default.
 *
 * Usage:
 *   npx ts-node scripts/normalize-catalog-trims.ts
 *   npx ts-node scripts/normalize-catalog-trims.ts --apply
 */
import { PrismaClient } from '../generated/client';
import { buildTrimContentKey } from '../src/modules/catalog/catalog-public.utils';
import {
  buildEngineVariantKey,
  formatEngineDisplaySubtitle,
  normalizeTransmissionLabel,
  parseAutoriaModification,
} from '../src/modules/catalog/engine-trim.utils';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

type TrimRow = {
  id: string;
  slug: string;
  displayName: string;
  engine: string | null;
  fuelType: string | null;
  aspiration: string | null;
  powerHp: number | null;
  transmission: string | null;
  contentKey: string | null;
  generationId: string;
  generation: {
    slug: string;
    model: { slug: string; make: { slug: string } };
  };
};

type Plan = {
  trim: TrimRow;
  path: string;
  targetSlug: string;
  engine: string | null;
  displayName: string;
  fuelType: string | null;
  aspiration: string | null;
  powerHp: number | null;
  transmission: string | null;
  contentKey: string;
};

/** Score for picking a survivor when two rows collapse into one slug. */
function completeness(trim: TrimRow): number {
  let score = 0;
  if (trim.powerHp != null) score += 4;
  if (trim.transmission) score += 2;
  if (trim.engine) score += 1;
  if (trim.id.startsWith('autoria-')) score += 8;
  return score;
}

/**
 * Rebuild a parseable label from the stored columns.
 *
 * An earlier parser split displacement across the two columns — "1.8 MT" was stored as
 * engine "1." plus gearbox "8MT". Moving the stray digit back is deterministic.
 */
function parseSource(trim: TrimRow): string {
  let engine = trim.engine?.trim() || (trim.displayName ?? '').split('·')[0].trim();
  let transmission = trim.transmission?.trim() ?? '';

  if (/\d\.$/.test(engine) && /^\d/.test(transmission)) {
    engine += transmission[0];
    transmission = transmission.slice(1);
  }

  return `${engine} ${transmission}`.trim();
}

function buildPlan(trim: TrimRow): Plan {
  const parsed = parseAutoriaModification(parseSource(trim));

  const engine = parsed.engine ?? trim.engine ?? null;
  const powerHp = trim.powerHp ?? parsed.powerHp ?? null;
  const transmission =
    parsed.transmission ?? normalizeTransmissionLabel(trim.transmission);
  const fuelType = parsed.fuelType ?? trim.fuelType ?? null;
  const aspiration = parsed.aspiration ?? trim.aspiration ?? null;

  const row = { engine, fuelType, aspiration, powerHp, transmission };
  const targetSlug = buildEngineVariantKey({
    ...row,
    displayName: trim.displayName,
  });

  const makeSlug = trim.generation.model.make.slug;
  const modelSlug = trim.generation.model.slug;

  return {
    trim,
    path: `${makeSlug}/${modelSlug}/${trim.generation.slug}`,
    targetSlug,
    engine,
    displayName: formatEngineDisplaySubtitle(row),
    fuelType,
    aspiration,
    powerHp,
    transmission,
    contentKey: buildTrimContentKey(
      makeSlug,
      modelSlug,
      trim.generation.slug,
      targetSlug,
    ),
  };
}

function hasFieldChanges(plan: Plan): boolean {
  const t = plan.trim;
  return (
    plan.engine !== t.engine ||
    plan.displayName !== t.displayName ||
    plan.fuelType !== t.fuelType ||
    plan.aspiration !== t.aspiration ||
    plan.powerHp !== t.powerHp ||
    plan.transmission !== t.transmission ||
    plan.contentKey !== t.contentKey
  );
}

async function main() {
  console.log(
    APPLY
      ? '── TRIM NORMALIZATION (APPLY) ──'
      : '── TRIM NORMALIZATION (dry-run — pass --apply to write) ──',
  );

  const trims = (await prisma.catalogTrim.findMany({
    select: {
      id: true,
      slug: true,
      displayName: true,
      engine: true,
      fuelType: true,
      aspiration: true,
      powerHp: true,
      transmission: true,
      contentKey: true,
      generationId: true,
      generation: {
        select: {
          slug: true,
          model: { select: { slug: true, make: { select: { slug: true } } } },
        },
      },
    },
  })) as TrimRow[];

  console.log(`Trims in catalog: ${trims.length}`);

  const plans = trims.map(buildPlan);

  // Collisions inside one generation → keep the most complete row, drop the rest.
  const byTarget = new Map<string, Plan[]>();
  for (const plan of plans) {
    const key = `${plan.trim.generationId}::${plan.targetSlug}`;
    const list = byTarget.get(key);
    if (list) list.push(plan);
    else byTarget.set(key, [plan]);
  }

  const survivors: Plan[] = [];
  const duplicates: Array<{ winner: Plan; losers: Plan[] }> = [];
  for (const group of byTarget.values()) {
    if (group.length === 1) {
      survivors.push(group[0]);
      continue;
    }
    const sorted = [...group].sort(
      (a, b) => completeness(b.trim) - completeness(a.trim),
    );
    survivors.push(sorted[0]);
    duplicates.push({ winner: sorted[0], losers: sorted.slice(1) });
  }

  const renames = survivors.filter((p) => p.targetSlug !== p.trim.slug);
  const fieldUpdates = survivors.filter(hasFieldChanges);
  const powerRecovered = survivors.filter(
    (p) => p.trim.powerHp == null && p.powerHp != null,
  );
  const txRecovered = survivors.filter(
    (p) => !p.trim.transmission && p.transmission,
  );
  const stillNoPower = survivors.filter((p) => p.powerHp == null);
  const stillNoTx = survivors.filter((p) => !p.transmission);

  console.log(`\nSlug changes:        ${renames.length}`);
  console.log(`Field updates:       ${fieldUpdates.length}`);
  console.log(`Power recovered:     ${powerRecovered.length}`);
  console.log(`Gearbox recovered:   ${txRecovered.length}`);
  console.log(
    `Duplicates merged:   ${duplicates.reduce((n, d) => n + d.losers.length, 0)} rows in ${duplicates.length} groups`,
  );
  console.log(`Still without power: ${stillNoPower.length}`);
  console.log(`Still without gearbox: ${stillNoTx.length}`);

  for (const dup of duplicates.slice(0, 15)) {
    console.log(
      `  merge ${dup.winner.path}/${dup.winner.targetSlug} ← ` +
        dup.losers.map((l) => l.trim.slug).join(', '),
    );
  }
  if (duplicates.length > 15) console.log(`  …+${duplicates.length - 15} groups`);

  if (stillNoPower.length > 0) {
    console.log('\nSamples without power (raw display_name):');
    for (const p of stillNoPower.slice(0, 15)) {
      console.log(`  ${p.path}: "${p.trim.displayName}"`);
    }
  }
  if (stillNoTx.length > 0) {
    console.log('\nSamples without gearbox (raw display_name):');
    for (const p of stillNoTx.slice(0, 15)) {
      console.log(`  ${p.path}: "${p.trim.displayName}"`);
    }
  }

  if (!APPLY) {
    console.log('\nDry-run only — nothing written. Re-run with --apply.');
    return;
  }

  console.log('\nWriting…');

  const loserIds = duplicates.flatMap((d) => d.losers.map((l) => l.trim.id));
  if (loserIds.length > 0) {
    await prisma.catalogTrim.deleteMany({ where: { id: { in: loserIds } } });
  }

  // Two-phase rename: a target slug may still be held by another row being renamed.
  for (const plan of renames) {
    await prisma.catalogTrim.update({
      where: { id: plan.trim.id },
      data: { slug: `tmp-${plan.trim.id}`, contentKey: null },
    });
  }

  let updated = 0;
  for (const plan of survivors) {
    if (plan.targetSlug === plan.trim.slug && !hasFieldChanges(plan)) continue;
    await prisma.catalogTrim.update({
      where: { id: plan.trim.id },
      data: {
        slug: plan.targetSlug,
        engine: plan.engine,
        displayName: plan.displayName,
        fuelType: plan.fuelType,
        aspiration: plan.aspiration,
        powerHp: plan.powerHp,
        transmission: plan.transmission,
        contentKey: plan.contentKey,
      },
    });
    updated += 1;
  }

  console.log(`Deleted duplicates: ${loserIds.length}`);
  console.log(`Updated trims:      ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
