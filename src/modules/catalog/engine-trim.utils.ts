/** Engine rows for community VARIANT rooms — not trim packages (Premium, Comfort, …). */

export type CatalogEngineRow = {
  engine?: string | null;
  fuelType?: string | null;
  aspiration?: string | null;
  powerHp?: number | null;
  displayName?: string | null;
  transmission?: string | null;
};

const TRIM_PACKAGE_RE =
  /^(premium|comfort|style|executive|business|sport|luxe|luxury|base|standard|active|go|edition|ambition|inspirat|modern|classic)$/i;

const ENGINE_HINT_RE =
  /\d\.\d|crdi|gdi|tgdi|tsi|tdi|mpi|vvt|hybrid|electric|ev\b/i;

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isTrimPackageName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (ENGINE_HINT_RE.test(n)) return false;
  if (/\d\.\d/.test(n)) return false;
  return TRIM_PACKAGE_RE.test(n);
}

export function resolveEngineLabel(row: CatalogEngineRow): string {
  const engine = row.engine?.trim();
  if (engine) return engine;
  const name = row.displayName?.trim() ?? '';
  if (name && !isTrimPackageName(name)) return name;
  return '';
}

export function formatFuelLabel(fuelType?: string | null, aspiration?: string | null): string {
  const fuel = (fuelType ?? '').trim().toLowerCase();
  const asp = (aspiration ?? '').trim().toLowerCase();

  if (fuel === 'diesel' || fuel === 'd') return 'diesel';
  if (fuel === 'hybrid') return 'hybrid';
  if (fuel === 'electric' || fuel === 'ev') return 'elektryczny';

  if (asp === 'turbo' || asp === 't') return 'benzyna (turbo)';
  if (asp === 'supercharged') return 'benzyna (kompresor)';
  if (asp === 'atmo' || asp === 'atmospheric' || asp === 'a') {
    return 'benzyna (atmosferyczny)';
  }
  // German designations ("320i") name the fuel but not the charging, and guessing
  // "atmosferyczny" would be wrong for every turbo generation since 2011.
  if (fuel === 'petrol' || fuel === 'gasoline' || fuel === 'benzyna') return 'benzyna';

  return fuel || '';
}

/** e.g. "1.6 GDI · benzyna (atmosferyczny) · 132 KM · MT" */
export function formatEngineDisplaySubtitle(row: CatalogEngineRow): string {
  const engine = resolveEngineLabel(row);
  const fuel = formatFuelLabel(row.fuelType, row.aspiration);
  const power =
    row.powerHp != null && Number.isFinite(row.powerHp) ? `${row.powerHp} KM` : '';
  const tx = normalizeTransmissionLabel(row.transmission);

  const parts = [engine, fuel, power, tx].filter(Boolean);
  if (parts.length > 0) return parts.join(' · ');
  return row.displayName?.trim() || engine || 'Silnik';
}

/**
 * Normalize gearbox tokens from AUTO.RIA (Cyrillic lookalikes → Latin).
 * "АТ" / "МТ" / "7DCT" → AT / MT / 7DCT
 *
 * AMG model badges ("63 AT", "45 DCT") must not become 63-/45-speed boxes —
 * only plausible gear counts are kept.
 */
export function normalizeTransmissionLabel(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const raw = value
    .trim()
    .replace(/[Мм]/g, 'M')
    .replace(/[Аа]/g, 'A')
    .replace(/[Тт]/g, 'T')
    .replace(/\s+/g, '')
    .toUpperCase();

  const match = raw.match(/^(\d{0,2})(MT|AT|CVT|DCT|DSG|AMT|IVT)$/);
  if (!match) {
    if (raw === 'CVT' || raw === 'IVT' || raw === 'AMT') return raw;
    return raw;
  }

  const gears = match[1] ? Number(match[1]) : null;
  const type = match[2];

  if (gears == null) return type;
  if (!isPlausibleGearCount(type, gears)) return type;
  return `${gears}${type}`;
}

/** Gear counts that real passenger cars use — rejects AMG line numbers (35/43/45/63…). */
export function isPlausibleGearCount(type: string, gears: number): boolean {
  const t = type.toUpperCase();
  if (t === 'MT') return gears >= 4 && gears <= 7;
  if (t === 'AT') return gears >= 4 && gears <= 10;
  if (t === 'DCT' || t === 'DSG') return gears >= 6 && gears <= 8;
  if (t === 'AMT') return gears >= 5 && gears <= 7;
  // CVT / IVT rarely carry a digit prefix; if they do, ignore it.
  return false;
}

/** "7DCT" → "DCT", "6MT" → "MT" — match-rule keys are family-agnostic. */
export function transmissionKey(raw: string | null | undefined): string | null {
  const tx = normalizeTransmissionLabel(raw);
  if (!tx) return null;
  const match = tx.match(/^(\d*)(MT|AT|CVT|DCT|DSG|AMT|IVT)(\d*)$/);
  return match ? match[2] : tx;
}

/** Digit prefix of a normalized label ("6MT" → 6), or null when the label didn't carry one. */
export function parseGearCount(label: string | null): number | null {
  if (!label) return null;
  const match = label.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * Prefer a gear-count-specific manual-transmission family ("vag-6mt") over the generic
 * manufacturer-wide one a rule points at ("vag-mt") when the trim's own label confirms the
 * gear count and that specific family already exists in the KB. Falls back to the base slug
 * otherwise (gear count unknown on this trim, or nobody has curated that gear count for this
 * manufacturer yet) — this never invents a family, only picks a more specific one that's
 * already there. See docs/V1_7_VEHICLE_ENCYCLOPEDIA.md §4.3.2.
 */
export function preferGearSpecificSlug(
  baseSlug: string,
  gears: number | null,
  transmissionFamilyBySlug: Map<string, unknown>,
): string {
  if (gears == null) return baseSlug;
  const upgraded = baseSlug.replace(/-mt$/, `-${gears}mt`);
  if (upgraded === baseSlug) return baseSlug;
  return transmissionFamilyBySlug.has(upgraded) ? upgraded : baseSlug;
}

/**
 * Unique trim key — engine + power + gearbox.
 * Manual 1.7 CRDi 116 and AT 1.7 CRDi 141 must stay separate rows.
 */
export function buildEngineVariantKey(row: CatalogEngineRow): string {
  const engine = resolveEngineLabel(row);
  const base = slugify(engine || row.displayName || 'engine');
  const parts = [base];
  if (row.powerHp != null && Number.isFinite(row.powerHp)) {
    parts.push(String(row.powerHp));
  }
  const tx = normalizeTransmissionLabel(row.transmission);
  if (tx) {
    parts.push(slugify(tx));
  }
  return parts.join('-');
}

/** Drivetrain markers — not part of the engine variant. */
const DRIVE_TOKEN_RE =
  /\b(?:4WD|AWD|FWD|RWD|4x4|4MOTION|xDrive|sDrive|quattro|4MATIC|AllGrip)\b/gi;

/**
 * Gearbox token anywhere in the label: "AT", "6MT", "DSG7", "7DCT".
 * The lookbehind keeps displacement digits out of it — "2.3 MT" is not "3MT".
 * Gear count is limited to 4–12 so AMG badges ("63 AT", "43 AT") stay in the engine name.
 */
const TRANSMISSION_TOKEN_RE =
  /(?<![\d.,])(?:([4-9]|1[0-2])\s*)?(MT|AT|CVT|DCT|DSG|AMT|IVT)(\d{0,2})\b/i;

/** Named automatics that AUTO.RIA writes instead of "AT": 7G-Tronic, Steptronic, Tiptronic. */
const NAMED_AUTOMATIC_RE =
  /\b(?:([579])\s*)?g-?tronic\b|\bsteptronic\b|\btiptronic\b|\bs-?tronic\b|\bpowershift\b|\bmultidrive\b|\be-?cvt\b|\bhybrid\s*e-?cvt\b/i;

const ELECTRIC_RE = /\bkwh\b|elektr|\bev\b|\be-[a-z]/i;
const HYBRID_RE = /\b[pm]?hev\b|hybrid|hybryd/i;
// AUTO.RIA writes both "1.9 TDI" and "1.9TDI", so the left edge only rejects letters —
// \b would fail between a digit and the acronym. TDI also carries suffixes ("TDIe").
const DIESEL_RE =
  /crdi|\bcrd\b|(?<![a-z])tdi|cdti|tdci|ecoblue|duratorq|\bdci\b|\bhdi\b|\bjtd\b|bluetec|(?<![a-z])cdi\b|diesel|\bd4d\b|\d[.,]\d\s*td\b|\d[.,]\d\s*d\b/i;
const TURBO_RE =
  /t-gdi|tgdi|(?<![a-z])tsi\b|(?<![a-z])tfsi\b|ecoboost|turbo|\d[.,]\d\s*t\b|\bt-jet\b/i;
const ATMO_RE = /(?<![a-z])gdi\b|(?<![a-z])mpi\b|\bvvt\b|atmo|\bdohc\b/i;
const SUPERCHARGED_RE = /kompressor|kompresor|\bsupercharg/i;
// German factory designations carry the fuel in the suffix: 320d and 250TD are diesels,
// 318i and 280E are petrols. Without this the whole BMW/Mercedes catalog has no fuel at all.
const GERMAN_DIESEL_RE = /(?<![\d.,])\d{2,3}\s*[xt]?d\b/i;
const GERMAN_PETROL_RE = /(?<![\d.,])\d{2,3}\s*[ie]\b/i;

/** AUTO.RIA modification label, e.g. "1.6T-GDI MТ (177 к.с.) 4WD". */
export function parseAutoriaModification(name: string): CatalogEngineRow & {
  transmission: string | null;
} {
  const raw = name.trim();
  const powerMatch = raw.match(/(\d+)\s*(?:к\.с\.|л\.с\.|km|hp|ps)\b/i);
  const powerHp = powerMatch ? Number(powerMatch[1]) : null;

  // Latinize Cyrillic gearbox letters before tokenizing (МТ→MT, АТ→AT).
  let body = raw
    .replace(/\([^)]*\)/g, '')
    .replace(/[Мм]/g, 'M')
    .replace(/[Аа]/g, 'A')
    .replace(/[Тт]/g, 'T')
    .trim();

  let transmission: string | null = null;
  const transMatch = body.match(TRANSMISSION_TOKEN_RE);
  if (transMatch) {
    transmission = normalizeTransmissionLabel(
      `${transMatch[1] ?? ''}${transMatch[2]}${transMatch[3] ?? ''}`,
    );
    // Drop every gearbox token, not just the first — labels repeat it after a drive tag.
    body = body.replace(new RegExp(TRANSMISSION_TOKEN_RE.source, 'gi'), ' ');
  } else {
    const named = body.match(NAMED_AUTOMATIC_RE);
    if (named) {
      transmission = normalizeTransmissionLabel(named[1] ? `${named[1]}AT` : 'AT');
      body = body.replace(new RegExp(NAMED_AUTOMATIC_RE.source, 'gi'), ' ');
    }
  }

  const engine = body.replace(DRIVE_TOKEN_RE, ' ').replace(/\s+/g, ' ').trim();
  let fuelType: string | null = null;
  let aspiration: string | null = null;

  if (HYBRID_RE.test(raw)) {
    fuelType = 'hybrid';
  } else if (ELECTRIC_RE.test(raw)) {
    fuelType = 'electric';
  } else if (DIESEL_RE.test(engine) || GERMAN_DIESEL_RE.test(engine)) {
    fuelType = 'diesel';
  } else if (SUPERCHARGED_RE.test(engine)) {
    fuelType = 'petrol';
    aspiration = 'supercharged';
  } else if (TURBO_RE.test(engine)) {
    fuelType = 'petrol';
    aspiration = 'turbo';
  } else if (ATMO_RE.test(engine)) {
    fuelType = 'petrol';
    aspiration = 'atmo';
  } else if (GERMAN_PETROL_RE.test(engine)) {
    fuelType = 'petrol';
  } else if (/\d[.,]\d/.test(engine)) {
    fuelType = 'petrol';
  }

  return {
    engine: engine || null,
    fuelType,
    aspiration,
    powerHp: Number.isFinite(powerHp) ? powerHp : null,
    displayName: raw,
    transmission,
  };
}

/** Map AUTO.RIA generation eng → catalog slug (e.g. iii-pokolenie-fl → tucson-iii-fl). */
export function autoriaGenerationSlug(
  modelSlug: string,
  eng: string | undefined | null,
  displayName: string,
): string {
  const e = slugify(eng ?? '') || slugify(displayName);
  const romanMatch = e.match(/^(i{1,3}|iv|v|vi)(?:-pokolenie)?(-fl|-restyling|-facelift)?$/);
  if (romanMatch) {
    const suffix = romanMatch[2]?.replace(/^-/, '') ?? '';
    return suffix ? `${modelSlug}-${romanMatch[1]}-${suffix}` : `${modelSlug}-${romanMatch[1]}`;
  }
  if (e.startsWith(`${modelSlug}-`)) {
    return e;
  }
  return `${modelSlug}-${e}`;
}
