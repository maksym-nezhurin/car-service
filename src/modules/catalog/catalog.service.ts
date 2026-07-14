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
      orderBy: [{ yearFrom: 'desc' }, { displayName: 'asc' }],
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
        trims: { orderBy: { displayName: 'asc' } },
      },
    });
    if (!generation) {
      throw new NotFoundException('Generation not found');
    }
    return generation;
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
      engineCode: trim.engineCode,
      displacementCc: trim.displacementCc,
      contentKey: trim.contentKey,
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
