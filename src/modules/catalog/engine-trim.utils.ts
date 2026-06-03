/** Engine rows for community VARIANT rooms — not trim packages (Premium, Comfort, …). */

export type CatalogEngineRow = {
  engine?: string | null;
  fuelType?: string | null;
  aspiration?: string | null;
  powerHp?: number | null;
  displayName?: string | null;
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
  if (asp === 'atmo' || asp === 'atmospheric' || asp === 'a') {
    return 'benzyna (atmosferyczny)';
  }
  if (fuel === 'petrol' || fuel === 'gasoline' || fuel === 'benzyna') {
    return asp === 'turbo' ? 'benzyna (turbo)' : 'benzyna (atmosferyczny)';
  }

  return fuel || '';
}

/** e.g. "1.6 GDI · benzyna (atmosferyczny) · 132 KM" */
export function formatEngineDisplaySubtitle(row: CatalogEngineRow): string {
  const engine = resolveEngineLabel(row);
  const fuel = formatFuelLabel(row.fuelType, row.aspiration);
  const power =
    row.powerHp != null && Number.isFinite(row.powerHp) ? `${row.powerHp} KM` : '';

  const parts = [engine, fuel, power].filter(Boolean);
  if (parts.length > 0) return parts.join(' · ');
  return row.displayName?.trim() || engine || 'Silnik';
}

export function buildEngineVariantKey(row: CatalogEngineRow): string {
  const engine = resolveEngineLabel(row);
  const base = slugify(engine || row.displayName || 'engine');
  if (row.powerHp != null && Number.isFinite(row.powerHp)) {
    return `${base}-${row.powerHp}`;
  }
  return base;
}

/** CarQuery trim row → engine fields when API provides them. */
export function parseCarQueryTrim(trim: Record<string, string>): CatalogEngineRow {
  const trimName = String(trim.model_trim ?? trim.trim_name ?? trim.name ?? '').trim();
  const engineRaw = String(
    trim.model_engine ?? trim.engine ?? trim.model_engine_type ?? '',
  ).trim();
  const fuelRaw = String(
    trim.model_engine_fuel ?? trim.model_fuel_type ?? trim.fuel_type ?? '',
  ).trim();
  const powerRaw = trim.model_engine_power_ps ?? trim.model_power_ps ?? trim.power_ps;
  const powerHp = Number(powerRaw);

  let engine = engineRaw;
  let displayName = trimName;
  if (!engine && trimName && !isTrimPackageName(trimName)) {
    engine = trimName;
  }
  if (engine && isTrimPackageName(trimName)) {
    displayName = engine;
  }

  const aspiration =
    /turbo|t-gdi|tgdi|tsi|tdi/i.test(`${engine} ${trimName}`)
      ? 'turbo'
      : /gdi|mpi|vvt/i.test(`${engine} ${trimName}`) && !/turbo|t-gdi|tgdi/i.test(engine)
        ? 'atmo'
        : null;

  const fuelType = fuelRaw
    ? fuelRaw.toLowerCase()
    : /crd|diesel/i.test(engine)
      ? 'diesel'
      : engine
        ? 'petrol'
        : null;

  return {
    engine: engine || null,
    fuelType,
    aspiration,
    powerHp: Number.isFinite(powerHp) ? powerHp : null,
    displayName,
  };
}
