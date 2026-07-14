/**
 * Phase C smoke seed — curated engine / transmission families + trim links.
 * Run after seed-catalog-smoke.ts (or any catalog with Hyundai/Kia trims).
 *
 * Usage: npx ts-node scripts/seed-catalog-engine-families.ts
 */
import { PrismaClient } from '../generated/client';
import { buildTrimContentKey } from '../src/modules/catalog/catalog-public.utils';

const prisma = new PrismaClient();

type EngineSeed = {
  slug: string;
  displayName: string;
  manufacturer: string;
  displacementCc: number;
  fuelType: string;
  aspiration: string | null;
  engineCodes: string[];
  shortDescription: string;
  source: string;
};

type TransmissionSeed = {
  slug: string;
  displayName: string;
  type: string;
  gears: number;
  manufacturer: string;
  shortDescription: string;
  source: string;
};

const ENGINE_FAMILIES: EngineSeed[] = [
  {
    slug: 'hyundai-kappa-16-gdi',
    displayName: 'Hyundai Kappa 1.6 GDI',
    manufacturer: 'Hyundai',
    displacementCc: 1591,
    fuelType: 'petrol',
    aspiration: 'atmo',
    engineCodes: ['G4FD'],
    shortDescription:
      'Atmosferyczny 1.6 GDI — prostsza konstrukcja, niższe koszty serwisu niż turbo. Typowy w Tucsonie TL i podobnych modelach grupy Hyundai–Kia.',
    source: 'curated_smoke',
  },
  {
    slug: 'hyundai-gamma-16-tgdi',
    displayName: 'Hyundai Gamma 1.6 T-GDI',
    manufacturer: 'Hyundai',
    displacementCc: 1591,
    fuelType: 'petrol',
    aspiration: 'turbo',
    engineCodes: ['G4FJ'],
    shortDescription:
      'Turbo 1.6 T-GDI (Gamma) — lepsza dynamika, wyższe spalanie przy jeździe miejskiej. W Sportage QL i Tucsonie TL często z DCT.',
    source: 'curated_smoke',
  },
  {
    slug: 'hyundai-u2-17-crdi',
    displayName: 'Hyundai U2 1.7 CRDi',
    manufacturer: 'Hyundai',
    displacementCc: 1685,
    fuelType: 'diesel',
    aspiration: null,
    engineCodes: ['D4FD'],
    shortDescription:
      'Diesel 1.7 CRDi — oszczędny na trasie, wymaga regularnych tras dla DPF. Manualna skrzynia w tańszych wersjach.',
    source: 'curated_smoke',
  },
  {
    slug: 'hyundai-r-20-crdi',
    displayName: 'Hyundai R 2.0 CRDi',
    manufacturer: 'Hyundai',
    displacementCc: 1995,
    fuelType: 'diesel',
    aspiration: null,
    engineCodes: ['D4HA', 'D4HB'],
    shortDescription:
      'Diesel 2.0 CRDi — popularny w SUV-ach segmentu C; wersje 136 i 185 KM różnią się mapą ECU i turbo. Sprawdź historię DPF i EGR przy zakupie używanego.',
    source: 'curated_smoke',
  },
];

const TRANSMISSION_FAMILIES: TransmissionSeed[] = [
  {
    slug: 'manual-6mt',
    displayName: 'Manualna 6-biegowa',
    type: 'manual',
    gears: 6,
    manufacturer: 'generic',
    shortDescription: 'Klasyczna manualna skrzynia — niższe koszty utrzymania, typowa przy dieslach w wersjach podstawowych.',
    source: 'curated_smoke',
  },
  {
    slug: 'hyundai-7dct',
    displayName: 'Hyundai/Kia 7DCT (mokra sprzęgła)',
    type: 'dct',
    gears: 7,
    manufacturer: 'Hyundai',
    shortDescription:
      'Dwusprzęgłowa DCT 7-biegowa — płynniejsza w ruchu, w korku może „szarpać”. Wymaga regularnej wymiany oleju w skrzyni według harmonogramu producenta.',
    source: 'curated_smoke',
  },
];

/** Match trim engine label + power to a family slug. */
function resolveEngineFamilySlug(engine: string, powerHp: number | null): string | null {
  const label = engine.toLowerCase();
  if (label.includes('1.6 gdi') && powerHp === 132) return 'hyundai-kappa-16-gdi';
  if (label.includes('1.6 t-gdi') && powerHp === 177) return 'hyundai-gamma-16-tgdi';
  if (label.includes('1.7 crdi') && powerHp === 116) return 'hyundai-u2-17-crdi';
  if (label.includes('2.0 crdi') && (powerHp === 136 || powerHp === 185)) {
    return 'hyundai-r-20-crdi';
  }
  return null;
}

function resolveTransmissionSlug(engineFamilySlug: string | null): string | null {
  if (!engineFamilySlug) return null;
  if (engineFamilySlug === 'hyundai-gamma-16-tgdi') return 'hyundai-7dct';
  return 'manual-6mt';
}

async function main() {
  const now = new Date();

  for (const row of ENGINE_FAMILIES) {
    await prisma.catalogEngineFamily.upsert({
      where: { slug: row.slug },
      create: {
        slug: row.slug,
        displayName: row.displayName,
        manufacturer: row.manufacturer,
        displacementCc: row.displacementCc,
        fuelType: row.fuelType,
        aspiration: row.aspiration,
        engineCodes: row.engineCodes,
        shortDescription: row.shortDescription,
        reviewStatus: 'approved',
        reviewedAt: now,
        source: row.source,
      },
      update: {
        displayName: row.displayName,
        manufacturer: row.manufacturer,
        displacementCc: row.displacementCc,
        fuelType: row.fuelType,
        aspiration: row.aspiration,
        engineCodes: row.engineCodes,
        shortDescription: row.shortDescription,
        reviewStatus: 'approved',
        reviewedAt: now,
        source: row.source,
      },
    });
  }

  for (const row of TRANSMISSION_FAMILIES) {
    await prisma.catalogTransmissionFamily.upsert({
      where: { slug: row.slug },
      create: {
        slug: row.slug,
        displayName: row.displayName,
        type: row.type,
        gears: row.gears,
        manufacturer: row.manufacturer,
        shortDescription: row.shortDescription,
        reviewStatus: 'approved',
        reviewedAt: now,
        source: row.source,
      },
      update: {
        displayName: row.displayName,
        type: row.type,
        gears: row.gears,
        manufacturer: row.manufacturer,
        shortDescription: row.shortDescription,
        reviewStatus: 'approved',
        reviewedAt: now,
        source: row.source,
      },
    });
  }

  const engineBySlug = new Map(
    (await prisma.catalogEngineFamily.findMany()).map((r) => [r.slug, r.id]),
  );
  const transBySlug = new Map(
    (await prisma.catalogTransmissionFamily.findMany()).map((r) => [r.slug, r.id]),
  );

  const trims = await prisma.catalogTrim.findMany({
    include: {
      generation: {
        include: { model: { include: { make: true } } },
      },
    },
  });

  let linked = 0;
  for (const trim of trims) {
    const makeSlug = trim.generation.model.make.slug;
    const modelSlug = trim.generation.model.slug;
    const generationSlug = trim.generation.slug;
    const engineFamilySlug = resolveEngineFamilySlug(trim.engine ?? '', trim.powerHp);
    const transmissionSlug = resolveTransmissionSlug(engineFamilySlug);

    const engineFamily = ENGINE_FAMILIES.find((e) => e.slug === engineFamilySlug);

    await prisma.catalogTrim.update({
      where: { id: trim.id },
      data: {
        contentKey: buildTrimContentKey(makeSlug, modelSlug, generationSlug, trim.slug),
        engineCode: engineFamily?.engineCodes[0] ?? null,
        displacementCc: engineFamily?.displacementCc ?? null,
        transmission: trim.transmission ?? (transmissionSlug === 'hyundai-7dct' ? '7DCT' : 'Manual 6MT'),
        engineFamilyId: engineFamilySlug ? engineBySlug.get(engineFamilySlug) : null,
        transmissionFamilyId: transmissionSlug ? transBySlug.get(transmissionSlug) : null,
      },
    });
    if (engineFamilySlug) linked += 1;
  }

  console.log('Engine/transmission KB seeded.', {
    engineFamilies: ENGINE_FAMILIES.length,
    transmissionFamilies: TRANSMISSION_FAMILIES.length,
    trimsLinked: linked,
    trimsTotal: trims.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
