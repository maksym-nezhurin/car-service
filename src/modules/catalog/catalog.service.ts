import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CATALOG_YEAR_CUTOFF } from './catalog-public.utils';
import {
  buildEngineVariantKey,
  formatEngineDisplaySubtitle,
  isTrimPackageName,
  resolveEngineLabel,
} from './engine-trim.utils';

type PublicListOptions = {
  includeLegacy?: boolean;
  /** All makes/models in DB; inactive = no supported generation yet */
  full?: boolean;
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private supportedGenerationWhere(
    includeLegacy?: boolean,
  ): Prisma.CatalogGenerationWhereInput {
    if (includeLegacy) {
      return {};
    }
    return {
      isSupported: true,
      OR: [{ yearTo: null }, { yearTo: { gte: CATALOG_YEAR_CUTOFF } }],
    };
  }

  async getPublicStats() {
    const makesCount = await this.prisma.catalogMake.count({
      where: {
        models: {
          some: {
            generations: { some: this.supportedGenerationWhere() },
          },
        },
      },
    });

    const generationsCount = await this.prisma.catalogGeneration.count({
      where: this.supportedGenerationWhere(),
    });

    return { makesCount, generationsCount };
  }

  async listMakes(options?: PublicListOptions) {
    const supportedWhere = this.supportedGenerationWhere(options?.includeLegacy);

    if (options?.full) {
      const makes = await this.prisma.catalogMake.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          _count: { select: { models: true } },
          models: {
            where: { generations: { some: supportedWhere } },
            take: 1,
            select: { id: true },
          },
        },
      });

      return makes.map((m) => ({
        id: m.id,
        slug: m.slug,
        name: m.name,
        logoUrl: m.logoUrl,
        active: m.models.length > 0,
        modelCount: m._count.models,
      }));
    }

    return this.prisma.catalogMake.findMany({
      where: {
        models: {
          some: {
            generations: { some: this.supportedGenerationWhere(options?.includeLegacy) },
          },
        },
      },
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, logoUrl: true },
    });
  }

  async listModelsByMakeSlug(makeSlug: string, options?: PublicListOptions) {
    const make = await this.prisma.catalogMake.findUnique({
      where: { slug: makeSlug },
      select: { id: true, slug: true, name: true, logoUrl: true },
    });
    if (!make) {
      throw new NotFoundException('Make not found');
    }

    const supportedWhere = this.supportedGenerationWhere(options?.includeLegacy);

    if (options?.full) {
      const models = await this.prisma.catalogModel.findMany({
        where: { makeId: make.id },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          slug: true,
          name: true,
          generations: {
            where: supportedWhere,
            orderBy: [{ yearFrom: 'desc' }, { displayName: 'asc' }],
            take: 1,
            select: { coverImageUrl: true },
          },
          _count: {
            select: {
              generations: { where: supportedWhere },
            },
          },
        },
      });

      return {
        make,
        models: models.map((m) => ({
          id: m.id,
          slug: m.slug,
          name: m.name,
          generationCount: m._count.generations,
          coverImageUrl: m.generations[0]?.coverImageUrl ?? null,
          active: m._count.generations > 0,
        })),
      };
    }

    const models = await this.prisma.catalogModel.findMany({
      where: {
        makeId: make.id,
        generations: { some: this.supportedGenerationWhere(options?.includeLegacy) },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        generations: {
          where: this.supportedGenerationWhere(options?.includeLegacy),
          orderBy: [{ yearFrom: 'desc' }, { displayName: 'asc' }],
          take: 1,
          select: { coverImageUrl: true },
        },
        _count: {
          select: {
            generations: {
              where: this.supportedGenerationWhere(options?.includeLegacy),
            },
          },
        },
      },
    });

    return {
      make,
      models: models.map((m) => ({
        id: m.id,
        slug: m.slug,
        name: m.name,
        generationCount: m._count.generations,
        coverImageUrl: m.generations[0]?.coverImageUrl ?? null,
      })),
    };
  }

  async listGenerationsByModelPath(
    makeSlug: string,
    modelSlug: string,
    options?: PublicListOptions,
  ) {
    const model = await this.prisma.catalogModel.findFirst({
      where: { slug: modelSlug, make: { slug: makeSlug } },
      include: { make: true },
    });
    if (!model) {
      throw new NotFoundException('Model not found');
    }

    const generations = await this.prisma.catalogGeneration.findMany({
      where: {
        modelId: model.id,
        ...this.supportedGenerationWhere(options?.includeLegacy),
      },
      orderBy: [{ yearFrom: 'asc' }, { displayName: 'asc' }],
      select: {
        id: true,
        slug: true,
        displayName: true,
        yearFrom: true,
        yearTo: true,
        coverImageUrl: true,
        shortDescription: true,
        contentKey: true,
        supportTier: true,
        _count: { select: { trims: true } },
      },
    });

    return {
      make: {
        id: model.make.id,
        slug: model.make.slug,
        name: model.make.name,
        logoUrl: model.make.logoUrl,
      },
      model: { id: model.id, slug: model.slug, name: model.name },
      generations: generations.map((g) => ({
        id: g.id,
        slug: g.slug,
        displayName: g.displayName,
        yearFrom: g.yearFrom,
        yearTo: g.yearTo,
        coverImageUrl: g.coverImageUrl,
        shortDescription: g.shortDescription,
        contentKey: g.contentKey,
        supportTier: g.supportTier,
        trimCount: g._count.trims,
      })),
    };
  }

  async getGenerationByPath(
    makeSlug: string,
    modelSlug: string,
    generationSlug: string,
    options?: PublicListOptions,
  ) {
    const generation = await this.prisma.catalogGeneration.findFirst({
      where: {
        slug: generationSlug,
        model: { slug: modelSlug, make: { slug: makeSlug } },
        ...this.supportedGenerationWhere(options?.includeLegacy),
      },
      include: {
        model: { include: { make: true } },
        trims: {
          orderBy: { displayName: 'asc' },
          include: {
            engineFamily: true,
            transmissionFamily: true,
            engineUnit: { include: { family: true } },
            transmissionUnit: { include: { family: true } },
          },
        },
      },
    });
    if (!generation) {
      throw new NotFoundException('Generation not found');
    }
    return this.mapGenerationDetail(generation);
  }

  async getTrimByPath(
    makeSlug: string,
    modelSlug: string,
    generationSlug: string,
    trimSlug: string,
    options?: PublicListOptions,
  ) {
    const trim = await this.prisma.catalogTrim.findFirst({
      where: {
        slug: trimSlug,
        generation: {
          slug: generationSlug,
          model: { slug: modelSlug, make: { slug: makeSlug } },
          ...this.supportedGenerationWhere(options?.includeLegacy),
        },
      },
      include: this.trimDetailInclude(),
    });
    if (!trim) {
      throw new NotFoundException('Trim not found');
    }
    return this.mapTrimDetail(trim);
  }

  async getTrimById(trimId: string) {
    const trim = await this.prisma.catalogTrim.findUnique({
      where: { id: trimId },
      include: this.trimDetailInclude(),
    });
    if (!trim) {
      throw new NotFoundException('Trim not found');
    }
    if (!trim.generation.isSupported) {
      const yearTo = trim.generation.yearTo;
      if (yearTo != null && yearTo < CATALOG_YEAR_CUTOFF) {
        throw new NotFoundException('Trim not found');
      }
    }
    return this.mapTrimDetail(trim);
  }

  private trimDetailInclude() {
    return {
      engineFamily: true,
      transmissionFamily: true,
      engineUnit: { include: { family: true } },
      transmissionUnit: { include: { family: true } },
      generation: {
        include: {
          model: { include: { make: true } },
        },
      },
    } as const;
  }

  private mapApprovedEngineFamily(
    family: {
      id: string;
      slug: string;
      displayName: string;
      manufacturer: string | null;
      displacementCc: number | null;
      fuelType: string | null;
      aspiration: string | null;
      engineCodes: string[];
      shortDescription: string | null;
      reviewStatus: string;
    } | null,
  ) {
    if (!family || family.reviewStatus !== 'approved') {
      return null;
    }
    return {
      id: family.id,
      slug: family.slug,
      displayName: family.displayName,
      manufacturer: family.manufacturer,
      displacementCc: family.displacementCc,
      fuelType: family.fuelType,
      aspiration: family.aspiration,
      engineCodes: family.engineCodes,
      shortDescription: family.shortDescription,
    };
  }

  private mapApprovedTransmissionFamily(
    family: {
      id: string;
      slug: string;
      displayName: string;
      type: string | null;
      gears: number | null;
      manufacturer: string | null;
      shortDescription: string | null;
      reviewStatus: string;
    } | null,
  ) {
    if (!family || family.reviewStatus !== 'approved') {
      return null;
    }
    return {
      id: family.id,
      slug: family.slug,
      displayName: family.displayName,
      type: family.type,
      gears: family.gears,
      manufacturer: family.manufacturer,
      shortDescription: family.shortDescription,
    };
  }

  /** Curated engine unit (D4FD 116 KM) — hidden until both unit and family are approved. */
  private mapApprovedEngineUnit(
    unit: Prisma.CatalogEngineGetPayload<{ include: { family: true } }> | null,
  ) {
    if (!unit || unit.reviewStatus !== 'approved') {
      return null;
    }
    const family = this.mapApprovedEngineFamily(unit.family);
    if (!family) {
      return null;
    }
    return {
      id: unit.id,
      slug: unit.slug,
      code: unit.code,
      displayName: unit.displayName,
      displacementCc: unit.displacementCc,
      fuelType: unit.fuelType,
      aspiration: unit.aspiration,
      powerHp: unit.powerHp,
      powerKw: unit.powerKw,
      torqueNm: unit.torqueNm,
      cylinders: unit.cylinders,
      injection: unit.injection,
      euroStandard: unit.euroStandard,
      yearFrom: unit.yearFrom,
      yearTo: unit.yearTo,
      shortDescription: unit.shortDescription,
      reliabilityNotes: unit.reliabilityNotes,
      family,
    };
  }

  /** Curated gearbox unit (D7UF1) — hidden until both unit and family are approved. */
  private mapApprovedTransmissionUnit(
    unit: Prisma.CatalogTransmissionGetPayload<{ include: { family: true } }> | null,
  ) {
    if (!unit || unit.reviewStatus !== 'approved') {
      return null;
    }
    const family = this.mapApprovedTransmissionFamily(unit.family);
    if (!family) {
      return null;
    }
    return {
      id: unit.id,
      slug: unit.slug,
      code: unit.code,
      displayName: unit.displayName,
      type: unit.type ?? family.type,
      gears: unit.gears ?? family.gears,
      drive: unit.drive,
      maxTorqueNm: unit.maxTorqueNm,
      yearFrom: unit.yearFrom,
      yearTo: unit.yearTo,
      shortDescription: unit.shortDescription,
      reliabilityNotes: unit.reliabilityNotes,
      family,
    };
  }

  /**
   * Short gearbox label for tables: curated Otoba family wins over AUTO.RIA "AT".
   * e.g. type=dct gears=7 → "7DCT"; type=manual gears=6 → "6MT".
   */
  private transmissionShortLabel(
    raw: string | null,
    family: {
      slug: string;
      displayName: string;
      type: string | null;
      gears: number | null;
    } | null,
  ): string | null {
    if (family) {
      const type = (family.type ?? '').toLowerCase();
      const gears = family.gears;
      if (type === 'dct' || type === 'dsg') {
        return gears != null ? `${gears}DCT` : 'DCT';
      }
      if (type === 'manual') {
        return gears != null ? `${gears}MT` : 'MT';
      }
      if (type === 'automatic' || type === 'at') {
        return gears != null ? `${gears}AT` : 'AT';
      }
      if (type === 'cvt') return 'CVT';
      // slug fallback: hyundai-7dct → 7DCT
      const slugMatch = family.slug.match(/(\d+)?(dct|dsg|mt|at|cvt)/i);
      if (slugMatch) {
        return `${slugMatch[1] ?? ''}${slugMatch[2].toUpperCase()}`;
      }
      return family.displayName;
    }
    return raw;
  }

  private mapGenerationDetail(
    generation: Prisma.CatalogGenerationGetPayload<{
      include: {
        model: { include: { make: true } };
        trims: {
          include: {
            engineFamily: true;
            transmissionFamily: true;
            engineUnit: { include: { family: true } };
            transmissionUnit: { include: { family: true } };
          };
        };
      };
    }>,
  ) {
    const model = generation.model;
    const make = model.make;
    return {
      id: generation.id,
      slug: generation.slug,
      displayName: generation.displayName,
      yearFrom: generation.yearFrom,
      yearTo: generation.yearTo,
      coverImageUrl: generation.coverImageUrl,
      shortDescription: generation.shortDescription,
      contentKey: generation.contentKey,
      supportTier: generation.supportTier,
      model: {
        id: model.id,
        slug: model.slug,
        name: model.name,
        make: {
          id: make.id,
          slug: make.slug,
          name: make.name,
          logoUrl: make.logoUrl,
        },
      },
      trims: generation.trims.map((trim) => {
        const transmissionFamily = this.mapApprovedTransmissionFamily(
          trim.transmissionFamily,
        );
        const engineFamily = this.mapApprovedEngineFamily(trim.engineFamily);
        const engineUnit = this.mapApprovedEngineUnit(trim.engineUnit);
        const transmissionUnit = this.mapApprovedTransmissionUnit(
          trim.transmissionUnit,
        );
        return {
          id: trim.id,
          slug: trim.slug,
          displayName: trim.displayName,
          engine: trim.engine,
          fuelType: trim.fuelType,
          aspiration: trim.aspiration,
          powerHp: trim.powerHp,
          /** Raw AUTO.RIA token (AT / MT / …). */
          transmission: trim.transmission,
          /** Curated short label when a gearbox unit/family is linked. */
          transmissionLabel: this.transmissionShortLabel(
            trim.transmission,
            transmissionUnit ?? transmissionFamily,
          ),
          engineUnit: engineUnit
            ? {
                slug: engineUnit.slug,
                code: engineUnit.code,
                displayName: engineUnit.displayName,
              }
            : null,
          transmissionUnit: transmissionUnit
            ? {
                slug: transmissionUnit.slug,
                code: transmissionUnit.code,
                displayName: transmissionUnit.displayName,
              }
            : null,
          engineFamily: engineFamily
            ? {
                slug: engineFamily.slug,
                displayName: engineFamily.displayName,
              }
            : null,
          transmissionFamily: transmissionFamily
            ? {
                slug: transmissionFamily.slug,
                displayName: transmissionFamily.displayName,
                type: transmissionFamily.type,
                gears: transmissionFamily.gears,
              }
            : null,
        };
      }),
    };
  }

  private mapTrimDetail(
    trim: Prisma.CatalogTrimGetPayload<{
      include: ReturnType<CatalogService['trimDetailInclude']>;
    }>,
  ) {
    const generation = trim.generation;
    const model = generation.model;
    const make = model.make;

    return {
      id: trim.id,
      slug: trim.slug,
      displayName: trim.displayName,
      engine: trim.engine,
      fuelType: trim.fuelType,
      aspiration: trim.aspiration,
      powerHp: trim.powerHp,
      transmission: trim.transmission,
      /** Prefer curated short label (7DCT) over AUTO.RIA AT when a unit is linked. */
      transmissionLabel: this.transmissionShortLabel(
        trim.transmission,
        this.mapApprovedTransmissionUnit(trim.transmissionUnit) ??
          this.mapApprovedTransmissionFamily(trim.transmissionFamily),
      ),
      engineCode: trim.engineCode,
      displacementCc: trim.displacementCc,
      contentKey: trim.contentKey,
      engineUnit: this.mapApprovedEngineUnit(trim.engineUnit),
      transmissionUnit: this.mapApprovedTransmissionUnit(trim.transmissionUnit),
      engineFamily: this.mapApprovedEngineFamily(trim.engineFamily),
      transmissionFamily: this.mapApprovedTransmissionFamily(trim.transmissionFamily),
      generation: {
        id: generation.id,
        slug: generation.slug,
        displayName: generation.displayName,
        yearFrom: generation.yearFrom,
        yearTo: generation.yearTo,
        contentKey: generation.contentKey,
        supportTier: generation.supportTier,
        model: {
          id: model.id,
          slug: model.slug,
          name: model.name,
          make: {
            id: make.id,
            slug: make.slug,
            name: make.name,
            logoUrl: make.logoUrl,
          },
        },
      },
    };
  }

  /** Engine encyclopedia index — approved units only. */
  async listEngines() {
    const engines = await this.prisma.catalogEngine.findMany({
      where: { reviewStatus: 'approved', family: { reviewStatus: 'approved' } },
      include: { family: true, _count: { select: { trims: true } } },
      orderBy: [{ family: { displayName: 'asc' } }, { powerHp: 'asc' }],
    });

    return {
      count: engines.length,
      engines: engines
        .map((unit) => {
          const mapped = this.mapApprovedEngineUnit(unit);
          if (!mapped) return null;
          return { ...mapped, trimCount: unit._count.trims };
        })
        .filter((row): row is NonNullable<typeof row> => row != null),
    };
  }

  async getEngineBySlug(slug: string) {
    const unit = await this.prisma.catalogEngine.findUnique({
      where: { slug },
      include: { family: true },
    });
    const mapped = this.mapApprovedEngineUnit(unit);
    if (!mapped) {
      throw new NotFoundException('Engine not found');
    }

    const siblings = await this.prisma.catalogEngine.findMany({
      where: {
        familyId: unit!.familyId,
        reviewStatus: 'approved',
        NOT: { id: unit!.id },
      },
      orderBy: { powerHp: 'asc' },
      select: { slug: true, displayName: true, code: true, powerHp: true },
    });

    return {
      engine: mapped,
      familyVariants: siblings,
      usedIn: await this.trimUsage({ engineId: unit!.id }),
    };
  }

  /** Gearbox encyclopedia index — approved units only. */
  async listTransmissions() {
    const transmissions = await this.prisma.catalogTransmission.findMany({
      where: { reviewStatus: 'approved', family: { reviewStatus: 'approved' } },
      include: { family: true, _count: { select: { trims: true } } },
      orderBy: [{ family: { displayName: 'asc' } }, { gears: 'asc' }],
    });

    return {
      count: transmissions.length,
      transmissions: transmissions
        .map((unit) => {
          const mapped = this.mapApprovedTransmissionUnit(unit);
          if (!mapped) return null;
          return { ...mapped, trimCount: unit._count.trims };
        })
        .filter((row): row is NonNullable<typeof row> => row != null),
    };
  }

  async getTransmissionBySlug(slug: string) {
    const unit = await this.prisma.catalogTransmission.findUnique({
      where: { slug },
      include: { family: true },
    });
    const mapped = this.mapApprovedTransmissionUnit(unit);
    if (!mapped) {
      throw new NotFoundException('Transmission not found');
    }

    return {
      transmission: mapped,
      usedIn: await this.trimUsage({ transmissionId: unit!.id }),
    };
  }

  /** Back-links for an aggregate page: which cars carry this engine / gearbox. */
  private async trimUsage(where: { engineId?: string; transmissionId?: string }) {
    const trims = await this.prisma.catalogTrim.findMany({
      where: {
        ...where,
        generation: this.supportedGenerationWhere(),
      },
      select: {
        slug: true,
        displayName: true,
        powerHp: true,
        transmission: true,
        generation: {
          select: {
            slug: true,
            displayName: true,
            yearFrom: true,
            yearTo: true,
            model: {
              select: {
                slug: true,
                name: true,
                make: { select: { slug: true, name: true, logoUrl: true } },
              },
            },
          },
        },
      },
      orderBy: [{ powerHp: 'asc' }, { displayName: 'asc' }],
      take: 300,
    });

    return trims.map((trim) => {
      const generation = trim.generation;
      const model = generation.model;
      return {
        make: {
          slug: model.make.slug,
          name: model.make.name,
          logoUrl: model.make.logoUrl,
        },
        model: { slug: model.slug, name: model.name },
        generation: {
          slug: generation.slug,
          displayName: generation.displayName,
          yearFrom: generation.yearFrom,
          yearTo: generation.yearTo,
        },
        trim: {
          slug: trim.slug,
          displayName: trim.displayName,
          powerHp: trim.powerHp,
          transmission: trim.transmission,
        },
      };
    });
  }

  async listGenerations(filters?: { makeId?: string; q?: string }) {
    return this.prisma.catalogGeneration.findMany({
      where: {
        ...(filters?.makeId
          ? { model: { makeId: filters.makeId } }
          : {}),
        ...(filters?.q
          ? {
              displayName: { contains: filters.q, mode: 'insensitive' },
            }
          : {}),
      },
      include: {
        model: { include: { make: true } },
        _count: { select: { trims: true } },
      },
      orderBy: [{ model: { make: { name: 'asc' } } }, { displayName: 'asc' }],
      take: 200,
    });
  }

  async getGeneration(id: string) {
    const row = await this.prisma.catalogGeneration.findUnique({
      where: { id },
      include: {
        model: { include: { make: true } },
        trims: { orderBy: { displayName: 'asc' } },
      },
    });
    if (!row) {
      throw new NotFoundException('Generation not found');
    }
    return row;
  }

  /** Flat export for user-service community seed (no CarQuery at runtime). */
  async exportForCommunitySeed() {
    const generations = await this.prisma.catalogGeneration.findMany({
      include: {
        model: { include: { make: true } },
        trims: { orderBy: { displayName: 'asc' } },
      },
      orderBy: [{ model: { make: { name: 'asc' } } }, { displayName: 'asc' }],
    });

    return {
      syncedAt: new Date().toISOString(),
      count: generations.length,
      generations: generations.map((g) => ({
        catalogGenerationId: g.id,
        brandKey: g.model.make.slug,
        modelKey: g.model.slug,
        displayBrand: g.model.make.name,
        displayModel: g.model.name,
        displayTitle: g.displayName,
        yearFrom: g.yearFrom,
        yearTo: g.yearTo,
        coverImageUrl: g.coverImageUrl,
        shortDescription: g.shortDescription,
        variants: g.trims
          .filter((t) => {
            const label = resolveEngineLabel(t);
            return Boolean(label) && !isTrimPackageName(t.displayName);
          })
          .map((t) => ({
            catalogVariantId: t.id,
            variantKey: buildEngineVariantKey(t),
            displaySubtitle: formatEngineDisplaySubtitle(t),
            engine: resolveEngineLabel(t),
            fuelType: t.fuelType,
            powerHp: t.powerHp,
            transmission: t.transmission,
          })),
      })),
    };
  }
}
