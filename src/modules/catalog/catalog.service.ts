import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildEngineVariantKey,
  formatEngineDisplaySubtitle,
  isTrimPackageName,
  resolveEngineLabel,
} from './engine-trim.utils';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listMakes() {
    return this.prisma.catalogMake.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, logoUrl: true },
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
          })),
      })),
    };
  }
}
