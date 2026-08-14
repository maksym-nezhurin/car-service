import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CATALOG_YEAR_CUTOFF } from './catalog-public.utils';

/** Only the Prisma delegate methods CatalogService actually calls. */
function makePrismaMock() {
  return {
    catalogMake: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    catalogModel: { findMany: jest.fn(), findFirst: jest.fn() },
    catalogGeneration: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    catalogTrim: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    catalogEngine: { findMany: jest.fn(), findUnique: jest.fn() },
    catalogTransmission: { findMany: jest.fn(), findUnique: jest.fn() },
  };
}

type PrismaMock = ReturnType<typeof makePrismaMock>;

/** Access a private method without `any`-casting at every call site. */
function priv<T>(service: CatalogService, method: string, ...args: unknown[]): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (service as any)[method](...args);
}

describe('CatalogService', () => {
  let prisma: PrismaMock;
  let service: CatalogService;

  beforeEach(() => {
    prisma = makePrismaMock();
    // Only the pure/gating methods and the Prisma delegate shape are exercised here —
    // CatalogService never needs a real PrismaClient beyond that shape.
    service = new CatalogService(prisma as never);
  });

  describe('supportedGenerationWhere', () => {
    it('still gates on reviewStatus when includeLegacy is true — vintage is not a quality bypass', () => {
      expect(priv(service, 'supportedGenerationWhere', true)).toEqual({
        reviewStatus: 'approved',
      });
    });

    it('filters to reviewStatus + isSupported + the year cutoff by default', () => {
      expect(priv(service, 'supportedGenerationWhere')).toEqual({
        reviewStatus: 'approved',
        isSupported: true,
        OR: [{ yearTo: null }, { yearTo: { gte: CATALOG_YEAR_CUTOFF } }],
      });
    });

    it('filters the same way when includeLegacy is explicitly false', () => {
      expect(priv(service, 'supportedGenerationWhere', false)).toEqual({
        reviewStatus: 'approved',
        isSupported: true,
        OR: [{ yearTo: null }, { yearTo: { gte: CATALOG_YEAR_CUTOFF } }],
      });
    });
  });

  describe('approvedTrimWhere', () => {
    it('gates a trim on its own reviewStatus', () => {
      expect(priv(service, 'approvedTrimWhere')).toEqual({ reviewStatus: 'approved' });
    });
  });

  describe('mapApprovedEngineFamily', () => {
    const family = {
      id: 'f1',
      slug: 'vag-ea288',
      displayName: 'EA288',
      manufacturer: 'VAG',
      displacementCc: 2000,
      fuelType: 'diesel',
      aspiration: 'turbo',
      engineCodes: ['CRLB'],
      shortDescription: 'desc',
      reviewStatus: 'approved',
    };

    it('maps an approved family and drops the internal reviewStatus field', () => {
      const mapped = priv<Record<string, unknown>>(service, 'mapApprovedEngineFamily', family);
      expect(mapped).toMatchObject({ id: 'f1', slug: 'vag-ea288', displayName: 'EA288' });
      expect(mapped.reviewStatus).toBeUndefined();
    });

    it('hides a draft or rejected family from the public API', () => {
      expect(
        priv(service, 'mapApprovedEngineFamily', { ...family, reviewStatus: 'draft' }),
      ).toBeNull();
      expect(
        priv(service, 'mapApprovedEngineFamily', { ...family, reviewStatus: 'rejected' }),
      ).toBeNull();
    });

    it('returns null for a null family', () => {
      expect(priv(service, 'mapApprovedEngineFamily', null)).toBeNull();
    });
  });

  describe('mapApprovedTransmissionFamily', () => {
    const family = {
      id: 't1',
      slug: 'hyundai-7dct',
      displayName: 'Hyundai/Kia 7DCT',
      type: 'dct',
      gears: 7,
      manufacturer: 'Hyundai',
      shortDescription: 'desc',
      reviewStatus: 'approved',
    };

    it('maps an approved family', () => {
      expect(priv(service, 'mapApprovedTransmissionFamily', family)).toMatchObject({
        id: 't1',
        slug: 'hyundai-7dct',
        gears: 7,
      });
    });

    it('hides a non-approved family', () => {
      expect(
        priv(service, 'mapApprovedTransmissionFamily', { ...family, reviewStatus: 'draft' }),
      ).toBeNull();
    });
  });

  describe('mapApprovedEngineUnit', () => {
    const family = {
      id: 'f1',
      slug: 'vag-ea288',
      displayName: 'EA288',
      manufacturer: 'VAG',
      displacementCc: 2000,
      fuelType: 'diesel',
      aspiration: 'turbo',
      engineCodes: ['CRLB'],
      shortDescription: null,
      reviewStatus: 'approved',
    };
    const unit = {
      id: 'u1',
      slug: 'vag-crlb',
      code: 'CRLB',
      displayName: 'CRLB 2.0 TDI',
      displacementCc: 2000,
      fuelType: 'diesel',
      aspiration: 'turbo',
      powerHp: 150,
      powerKw: null,
      torqueNm: null,
      cylinders: 4,
      injection: null,
      euroStandard: null,
      yearFrom: 2012,
      yearTo: 2019,
      shortDescription: null,
      reliabilityNotes: null,
      reviewStatus: 'approved',
      family,
    };

    it('maps a unit whose family is also approved', () => {
      const mapped = priv<{ slug: string; family: { slug: string } }>(
        service,
        'mapApprovedEngineUnit',
        unit,
      );
      expect(mapped.slug).toBe('vag-crlb');
      expect(mapped.family.slug).toBe('vag-ea288');
    });

    it('hides the unit when the unit itself is not approved, regardless of family', () => {
      expect(
        priv(service, 'mapApprovedEngineUnit', { ...unit, reviewStatus: 'draft' }),
      ).toBeNull();
    });

    it('hides the unit when its family is not approved, even if the unit is', () => {
      expect(
        priv(service, 'mapApprovedEngineUnit', {
          ...unit,
          family: { ...family, reviewStatus: 'rejected' },
        }),
      ).toBeNull();
    });

    it('returns null for a null unit', () => {
      expect(priv(service, 'mapApprovedEngineUnit', null)).toBeNull();
    });
  });

  describe('transmissionShortLabel', () => {
    it('falls back to the raw AUTO.RIA token when no family is linked', () => {
      expect(priv(service, 'transmissionShortLabel', 'AT', null)).toBe('AT');
      expect(priv(service, 'transmissionShortLabel', null, null)).toBeNull();
    });

    it('prefers the curated family over the raw token, by type + gears', () => {
      expect(
        priv(service, 'transmissionShortLabel', 'AT', {
          slug: 'hyundai-7dct',
          displayName: 'x',
          type: 'dct',
          gears: 7,
        }),
      ).toBe('7DCT');
      expect(
        priv(service, 'transmissionShortLabel', 'MT', {
          slug: 'vag-6mt',
          displayName: 'x',
          type: 'manual',
          gears: 6,
        }),
      ).toBe('6MT');
      expect(
        priv(service, 'transmissionShortLabel', 'AT', {
          slug: 'bmw-zf-8hp',
          displayName: 'x',
          type: 'automatic',
          gears: 8,
        }),
      ).toBe('8AT');
      expect(
        priv(service, 'transmissionShortLabel', 'CVT', {
          slug: 'toyota-ecvt',
          displayName: 'x',
          type: 'cvt',
          gears: null,
        }),
      ).toBe('CVT');
    });

    it('omits the gear count when the family does not carry one', () => {
      expect(
        priv(service, 'transmissionShortLabel', 'AT', {
          slug: 'ford-at',
          displayName: 'x',
          type: 'at',
          gears: null,
        }),
      ).toBe('AT');
    });

    it('falls back to a slug-derived label when type is unrecognized', () => {
      expect(
        priv(service, 'transmissionShortLabel', 'AT', {
          slug: 'hyundai-7dct',
          displayName: 'Hyundai 7DCT',
          type: null,
          gears: null,
        }),
      ).toBe('7DCT');
    });

    it('falls back to the family displayName when neither type nor slug decode', () => {
      expect(
        priv(service, 'transmissionShortLabel', 'AT', {
          slug: 'renault-edc',
          displayName: 'Renault EDC',
          type: null,
          gears: null,
        }),
      ).toBe('Renault EDC');
    });
  });

  describe('listModelsByMakeSlug', () => {
    it('throws NotFoundException when the make does not exist', async () => {
      prisma.catalogMake.findUnique.mockResolvedValue(null);
      await expect(service.listModelsByMakeSlug('does-not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getGenerationByPath', () => {
    it('throws NotFoundException when no matching generation exists', async () => {
      prisma.catalogGeneration.findFirst.mockResolvedValue(null);
      await expect(
        service.getGenerationByPath('vw', 'golf', 'golf-viii'),
      ).rejects.toThrow(NotFoundException);
    });

    it('gates each trim field independently by its own review status', async () => {
      const approvedFamily = {
        id: 'ef1',
        slug: 'vag-ea288',
        displayName: 'EA288',
        manufacturer: 'VAG',
        displacementCc: 2000,
        fuelType: 'diesel',
        aspiration: 'turbo',
        engineCodes: [],
        shortDescription: null,
        reviewStatus: 'approved',
      };
      const draftEngineUnit = {
        id: 'eu1',
        slug: 'vag-crlb',
        code: 'CRLB',
        displayName: 'CRLB',
        displacementCc: 2000,
        fuelType: 'diesel',
        aspiration: 'turbo',
        powerHp: 150,
        powerKw: null,
        torqueNm: null,
        cylinders: 4,
        injection: null,
        euroStandard: null,
        yearFrom: null,
        yearTo: null,
        shortDescription: null,
        reliabilityNotes: null,
        reviewStatus: 'draft', // <- not yet approved
        family: approvedFamily,
      };

      prisma.catalogGeneration.findFirst.mockResolvedValue({
        id: 'g1',
        slug: 'golf-vii',
        displayName: 'Golf VII',
        yearFrom: 2012,
        yearTo: 2019,
        coverImageUrl: null,
        shortDescription: null,
        contentKey: 'vw/golf/golf-vii',
        supportTier: 'active',
        model: {
          id: 'm1',
          slug: 'golf',
          name: 'Golf',
          make: { id: 'mk1', slug: 'vw', name: 'Volkswagen', logoUrl: null },
        },
        trims: [
          {
            id: 'tr1',
            slug: '2-0-tdi-150',
            displayName: '2.0 TDI 150',
            engine: '2.0 TDI',
            fuelType: 'diesel',
            aspiration: 'turbo',
            powerHp: 150,
            transmission: '6MT',
            engineFamily: approvedFamily,
            transmissionFamily: null,
            engineUnit: draftEngineUnit,
            transmissionUnit: null,
          },
        ],
      });

      const result = await service.getGenerationByPath('vw', 'golf', 'golf-vii');
      const trim = result.trims[0];

      // The family surfaces (it's approved) even though the unit is still in draft.
      expect(trim.engineFamily).toMatchObject({ slug: 'vag-ea288' });
      // The unit itself must NOT leak — it's not approved yet.
      expect(trim.engineUnit).toBeNull();
      // With no transmission unit/family linked, the raw AUTO.RIA token is shown as-is.
      expect(trim.transmissionLabel).toBe('6MT');
    });
  });

  describe('getGenerationByPathAdmin', () => {
    it('throws NotFoundException when no matching generation exists', async () => {
      prisma.catalogGeneration.findFirst.mockResolvedValue(null);
      await expect(
        service.getGenerationByPathAdmin('vw', 'golf', 'golf-viii'),
      ).rejects.toThrow(NotFoundException);
    });

    it('surfaces a draft generation and its trims, unlike the public lookup', async () => {
      prisma.catalogGeneration.findFirst.mockResolvedValue({
        id: 'g1',
        slug: 'golf-vii',
        displayName: 'Golf VII',
        yearFrom: 2012,
        yearTo: 2019,
        coverImageUrl: null,
        reviewStatus: 'draft',
        isSupported: true,
        supportTier: 'active',
        model: {
          id: 'm1',
          slug: 'golf',
          name: 'Golf',
          make: { id: 'mk1', slug: 'vw', name: 'Volkswagen' },
        },
        trims: [
          {
            id: 'tr1',
            slug: '2-0-tdi-150',
            displayName: '2.0 TDI 150',
            engine: '2.0 TDI',
            fuelType: 'diesel',
            aspiration: 'turbo',
            powerHp: 150,
            transmission: '6MT',
            reviewStatus: 'rejected',
          },
        ],
      });

      const result = await service.getGenerationByPathAdmin('vw', 'golf', 'golf-vii');

      // No supportedGenerationWhere()/approvedTrimWhere() filter was applied to the query
      // above, and the mapper doesn't hide anything by status — confirmed by the mock
      // never being asked for a where clause and the result exposing both statuses as-is.
      expect(result.reviewStatus).toBe('draft');
      expect(result.trims[0]).toMatchObject({ id: 'tr1', reviewStatus: 'rejected' });
      expect(prisma.catalogGeneration.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug: 'golf-vii',
            model: { slug: 'golf', make: { slug: 'vw' } },
          },
        }),
      );
    });
  });

  describe('getTrimByPath', () => {
    it('throws NotFoundException when no matching trim exists', async () => {
      prisma.catalogTrim.findFirst.mockResolvedValue(null);
      await expect(
        service.getTrimByPath('vw', 'golf', 'golf-vii', '2-0-tdi-150'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTrimById', () => {
    function fakeTrim(overrides: {
      trimReviewStatus?: string;
      generationReviewStatus?: string;
    }) {
      return {
        id: 'tr1',
        slug: '2-0-tdi-150',
        displayName: '2.0 TDI 150',
        engine: '2.0 TDI',
        fuelType: 'diesel',
        aspiration: 'turbo',
        powerHp: 150,
        transmission: '6MT',
        engineCode: null,
        displacementCc: 2000,
        contentKey: 'vw/golf/golf-vii/2-0-tdi-150',
        reviewStatus: overrides.trimReviewStatus ?? 'approved',
        engineFamily: null,
        transmissionFamily: null,
        engineUnit: null,
        transmissionUnit: null,
        generation: {
          id: 'g1',
          slug: 'golf-vii',
          displayName: 'Golf VII',
          yearFrom: 2012,
          yearTo: 2019,
          contentKey: 'vw/golf/golf-vii',
          supportTier: 'active',
          isSupported: true,
          reviewStatus: overrides.generationReviewStatus ?? 'approved',
          model: {
            id: 'm1',
            slug: 'golf',
            name: 'Golf',
            make: { id: 'mk1', slug: 'vw', name: 'Volkswagen', logoUrl: null },
          },
        },
      };
    }

    it('throws NotFoundException when the trim does not exist', async () => {
      prisma.catalogTrim.findUnique.mockResolvedValue(null);
      await expect(service.getTrimById('does-not-exist')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the trim itself is not approved', async () => {
      prisma.catalogTrim.findUnique.mockResolvedValue(fakeTrim({ trimReviewStatus: 'draft' }));
      await expect(service.getTrimById('tr1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the trim is approved but its generation is not', async () => {
      prisma.catalogTrim.findUnique.mockResolvedValue(
        fakeTrim({ generationReviewStatus: 'rejected' }),
      );
      await expect(service.getTrimById('tr1')).rejects.toThrow(NotFoundException);
    });

    it('returns the mapped trim when both the trim and its generation are approved', async () => {
      prisma.catalogTrim.findUnique.mockResolvedValue(fakeTrim({}));
      const result = await service.getTrimById('tr1');
      expect(result.slug).toBe('2-0-tdi-150');
    });
  });

  describe('getEngineBySlug', () => {
    it('throws NotFoundException when the unit does not exist', async () => {
      prisma.catalogEngine.findUnique.mockResolvedValue(null);
      await expect(service.getEngineBySlug('does-not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for an unapproved unit instead of leaking draft data', async () => {
      prisma.catalogEngine.findUnique.mockResolvedValue({
        id: 'u1',
        slug: 'vag-crlb',
        reviewStatus: 'draft',
        family: { reviewStatus: 'approved' },
      });
      await expect(service.getEngineBySlug('vag-crlb')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTransmissionBySlug', () => {
    it('throws NotFoundException when the unit does not exist', async () => {
      prisma.catalogTransmission.findUnique.mockResolvedValue(null);
      await expect(service.getTransmissionBySlug('does-not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateGenerationAdmin', () => {
    it('throws NotFoundException when the generation does not exist', async () => {
      prisma.catalogGeneration.findUnique.mockResolvedValue(null);
      await expect(
        service.updateGenerationAdmin('does-not-exist', { reviewStatus: 'draft' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.catalogGeneration.update).not.toHaveBeenCalled();
    });

    it('stamps reviewedAt when reviewStatus changes', async () => {
      prisma.catalogGeneration.findUnique.mockResolvedValue({ id: 'g1' });
      prisma.catalogGeneration.update.mockResolvedValue({ id: 'g1' });

      await service.updateGenerationAdmin('g1', { reviewStatus: 'rejected' });

      expect(prisma.catalogGeneration.update).toHaveBeenCalledWith({
        where: { id: 'g1' },
        data: { reviewStatus: 'rejected', reviewedAt: expect.any(Date) },
      });
    });

    it('updates displayName/coverImageUrl without touching reviewStatus when unset', async () => {
      prisma.catalogGeneration.findUnique.mockResolvedValue({ id: 'g1' });
      prisma.catalogGeneration.update.mockResolvedValue({ id: 'g1' });

      await service.updateGenerationAdmin('g1', {
        displayName: 'Golf VII (corrected)',
        coverImageUrl: 'https://example.com/golf.webp',
      });

      expect(prisma.catalogGeneration.update).toHaveBeenCalledWith({
        where: { id: 'g1' },
        data: {
          displayName: 'Golf VII (corrected)',
          coverImageUrl: 'https://example.com/golf.webp',
        },
      });
    });

    it('sends an empty update when the DTO carries nothing', async () => {
      prisma.catalogGeneration.findUnique.mockResolvedValue({ id: 'g1' });
      prisma.catalogGeneration.update.mockResolvedValue({ id: 'g1' });

      await service.updateGenerationAdmin('g1', {});

      expect(prisma.catalogGeneration.update).toHaveBeenCalledWith({
        where: { id: 'g1' },
        data: {},
      });
    });
  });

  describe('updateTrimAdmin', () => {
    it('throws NotFoundException when the trim does not exist', async () => {
      prisma.catalogTrim.findUnique.mockResolvedValue(null);
      await expect(
        service.updateTrimAdmin('does-not-exist', { reviewStatus: 'draft' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.catalogTrim.update).not.toHaveBeenCalled();
    });

    it('stamps reviewedAt when flagging a trim', async () => {
      prisma.catalogTrim.findUnique.mockResolvedValue({ id: 'tr1' });
      prisma.catalogTrim.update.mockResolvedValue({ id: 'tr1' });

      await service.updateTrimAdmin('tr1', { reviewStatus: 'draft' });

      expect(prisma.catalogTrim.update).toHaveBeenCalledWith({
        where: { id: 'tr1' },
        data: { reviewStatus: 'draft', reviewedAt: expect.any(Date) },
      });
    });
  });
});
