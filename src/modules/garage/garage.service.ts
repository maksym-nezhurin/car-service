import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DistributionPlatform,
  InsurancePolicyType,
  ListingDistributionStatus,
  Prisma,
  SaleListingStatus,
  VehicleProfileTier,
  VehicleReportStatus,
} from '../../prisma/generated-client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { AddMaintenanceRecordDto } from './dto/add-maintenance-record.dto';
import { AddRegistrationEventDto } from './dto/add-registration-event.dto';
import { CreateSaleContractDto } from './dto/create-sale-contract.dto';
import { AddOdometerLogDto } from './dto/add-odometer-log.dto';
import { CreateServiceVisitDto } from './dto/create-service-visit.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateSaleListingDto } from './dto/create-sale-listing.dto';
import { PublishSaleListingDto } from './dto/publish-sale-listing.dto';
import { UpsertTechnicalInspectionDto } from './dto/upsert-technical-inspection.dto';
import { UpsertInsurancePolicyDto } from './dto/upsert-insurance-policy.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { VehicleProfileAccessService } from './vehicle-profile-access.service';

type RecommendationLevel = 'ok' | 'due_soon' | 'overdue';

type GarageRecommendation = {
  category: 'maintenance' | 'compliance';
  type: string;
  title: string;
  currentMileageKm: number;
  lastServiceMileageKm: number | null;
  kmSinceLastService: number;
  recommendedIntervalKm: number;
  level: RecommendationLevel;
  daysUntilExpiry: number | null;
  expiresAt: string | null;
};

const MARKET_PLATFORMS: Record<string, DistributionPlatform[]> = {
  PL: [
    DistributionPlatform.OUR_SITE,
    DistributionPlatform.OTOMOTO,
    DistributionPlatform.FACEBOOK_MARKETPLACE,
    DistributionPlatform.OLX,
  ],
  SK: [
    DistributionPlatform.OUR_SITE,
    DistributionPlatform.FACEBOOK_MARKETPLACE,
    DistributionPlatform.AUTOBAZAR_SK,
  ],
  UA: [DistributionPlatform.OUR_SITE, DistributionPlatform.AUTORIA],
};

@Injectable()
export class GarageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly vehicleProfileAccessService: VehicleProfileAccessService,
  ) {}

  async createVehicle(ownerUserId: string, dto: CreateVehicleDto) {
    const vin = dto.vin.trim().toUpperCase();
    const existingVehicle = await this.prisma.vehicle.findUnique({
      where: { vin },
      select: { id: true },
    });
    const createdNewVehicle = !existingVehicle;

    const vehicle = await this.prisma.vehicle.upsert({
      where: { vin },
      create: {
        vin,
        year: dto.year,
        plateNumber: dto.plateNumber,
        brandId: dto.brandId,
        modelId: dto.modelId,
        variantId: dto.variantId,
        vehicleType: dto.vehicleType,
        color: dto.color,
        engine: dto.engine,
        transmission: dto.transmission,
        fuelType: dto.fuelType,
        currentMileageKm: dto.currentMileageKm,
        countryCode: dto.countryCode ?? 'PL',
      },
      update: {
        year: dto.year ?? undefined,
        plateNumber: dto.plateNumber ?? undefined,
        brandId: dto.brandId ?? undefined,
        modelId: dto.modelId ?? undefined,
        variantId: dto.variantId ?? undefined,
        vehicleType: dto.vehicleType ?? undefined,
        color: dto.color ?? undefined,
        engine: dto.engine ?? undefined,
        transmission: dto.transmission ?? undefined,
        fuelType: dto.fuelType ?? undefined,
        currentMileageKm: dto.currentMileageKm ?? undefined,
        countryCode: dto.countryCode ?? undefined,
      },
    });
    await this.cloudinaryService.ensureFolder(`cars/${vin}`);

    const existingOwnership = await this.prisma.vehicleOwnership.findFirst({
      where: {
        vehicleId: vehicle.id,
        ownerUserId,
        isCurrent: true,
      },
    });
    if (existingOwnership) {
      return {
        ...vehicle,
        createdNewVehicle,
        createdNewOwnership: false,
      };
    }

    const existingPrimaryCount = await this.prisma.vehicleOwnership.count({
      where: { ownerUserId, isCurrent: true, isPrimary: true },
    });

    const ownership = await this.prisma.vehicleOwnership.create({
      data: {
        vehicleId: vehicle.id,
        ownerUserId,
        isCurrent: true,
        isPrimary: existingPrimaryCount === 0,
        source: 'manual',
      },
    });
    const ownershipFolder = `cars/${vin}/owners/${ownerUserId}/ownerships/${ownership.id}`;
    await this.cloudinaryService.ensureFolder(ownershipFolder);
    await this.prisma.vehicleOwnership.update({
      where: { id: ownership.id },
      data: { cloudFolder: ownershipFolder },
    });

    return {
      ...vehicle,
      createdNewVehicle,
      createdNewOwnership: true,
    };
  }

  async listMyVehicles(ownerUserId: string) {
    const items = await this.prisma.vehicleOwnership.findMany({
      where: { ownerUserId, isCurrent: true },
      include: {
        vehicle: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { startedAt: 'desc' }],
    });

    const hasPrimary = items.some((item) => item.isPrimary);
    if (!hasPrimary && items.length === 1) {
      const updated = await this.prisma.vehicleOwnership.update({
        where: { id: items[0].id },
        data: { isPrimary: true },
        include: { vehicle: true },
      });
      return [updated];
    }

    return items;
  }

  async setPrimaryVehicle(ownerUserId: string, vehicleId: string) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    await this.prisma.$transaction([
      this.prisma.vehicleOwnership.updateMany({
        where: { ownerUserId, isCurrent: true },
        data: { isPrimary: false },
      }),
      this.prisma.vehicleOwnership.updateMany({
        where: { ownerUserId, vehicleId, isCurrent: true },
        data: { isPrimary: true },
      }),
    ]);

    const ownership = await this.prisma.vehicleOwnership.findFirst({
      where: { ownerUserId, vehicleId, isCurrent: true },
      include: { vehicle: true },
    });

    if (!ownership) {
      throw new NotFoundException('Vehicle ownership not found');
    }

    return ownership;
  }

  async getVehicleDetails(ownerUserId: string, vehicleId: string) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        ownerships: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
        maintenance: {
          orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
          take: 50,
          include: {
            attachments: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        odometerLogs: {
          orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
          take: 50,
        },
        registrationEvents: {
          orderBy: { eventDate: 'desc' },
          take: 50,
        },
        photos: {
          where: { ownerUserId },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
        saleContracts: {
          orderBy: { contractDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!vehicle) throw new NotFoundException('Vehicle not found.');
    return vehicle;
  }

  async updateVehicle(ownerUserId: string, vehicleId: string, dto: UpdateVehicleDto) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    const updates: Prisma.VehicleUpdateInput = {
      year: dto.year ?? undefined,
      plateNumber: dto.plateNumber ?? undefined,
      brandId: dto.brandId ?? undefined,
      modelId: dto.modelId ?? undefined,
      variantId: dto.variantId ?? undefined,
      vehicleType: dto.vehicleType ?? undefined,
      color: dto.color ?? undefined,
      engine: dto.engine ?? undefined,
      transmission: dto.transmission ?? undefined,
      fuelType: dto.fuelType ?? undefined,
      currentMileageKm: dto.currentMileageKm ?? undefined,
      countryCode: dto.countryCode ?? undefined,
    };

    if (dto.vin) {
      const vin = dto.vin.trim().toUpperCase();
      const conflictVehicle = await this.prisma.vehicle.findFirst({
        where: {
          vin,
          id: { not: vehicleId },
        },
        select: { id: true },
      });

      if (conflictVehicle) {
        throw new BadRequestException('Vehicle with this VIN already exists.');
      }
      updates.vin = vin;
    }

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: updates,
    });
  }

  async addVehiclePhotos(ownerUserId: string, vehicleId: string, files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException('No files provided.');
    }

    const ownership = await this.getCurrentOwnership(ownerUserId, vehicleId);
    if (!ownership) {
      throw new NotFoundException('Vehicle not found for current user.');
    }

    const baseFolder = ownership.cloudFolder ?? `cars/${await this.getVinById(vehicleId)}/owners/${ownerUserId}`;
    const folder = `${baseFolder}/photos`;
    await this.cloudinaryService.ensureFolder(folder);

    const uploaded = await Promise.all(
      files.map((file) => this.cloudinaryService.uploadImage(file, folder)),
    );

    return this.prisma.$transaction(
      uploaded.map((item) =>
        this.prisma.vehiclePhoto.create({
          data: {
            vehicleId,
            ownerUserId,
            url: item.secure_url,
            publicId: item.public_id,
          },
        }),
      ),
    );
  }

  async deleteVehiclePhoto(ownerUserId: string, vehicleId: string, photoId: string) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    const photo = await this.prisma.vehiclePhoto.findFirst({
      where: { id: photoId, vehicleId, ownerUserId },
    });
    if (!photo) {
      throw new NotFoundException('Photo not found.');
    }

    if (photo.publicId) {
      try {
        await this.cloudinaryService.deleteImage(photo.publicId);
      } catch {
        // DB row is source of truth; orphan assets can be cleaned in Cloudinary later.
      }
    }

    await this.prisma.vehiclePhoto.delete({ where: { id: photoId } });
    return { deleted: true, id: photoId };
  }

  async addMaintenance(ownerUserId: string, vehicleId: string, dto: AddMaintenanceRecordDto) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    const serviceCost = dto.serviceCostAmount ?? 0;
    const partsCost = dto.partsCostAmount ?? 0;
    const totalCost =
      dto.costAmount ??
      (dto.serviceCostAmount != null || dto.partsCostAmount != null ? serviceCost + partsCost : undefined);
    const detailsBlocks = [
      dto.details?.trim(),
      dto.serviceCenter ? `Service center: ${dto.serviceCenter}` : undefined,
      dto.partsSupplier ? `Parts supplier/shop: ${dto.partsSupplier}` : undefined,
      dto.serviceCostAmount != null ? `Service labor cost: ${dto.serviceCostAmount}` : undefined,
      dto.partsCostAmount != null ? `Parts/materials cost: ${dto.partsCostAmount}` : undefined,
    ].filter(Boolean);
    const normalizedDetails = detailsBlocks.length ? detailsBlocks.join('\n') : undefined;

    const record = await this.prisma.maintenanceRecord.create({
      data: {
        vehicleId,
        ownerUserId,
        type: dto.type,
        title: dto.title,
        details: normalizedDetails,
        mileageKm: dto.mileageKm,
        performedAt: new Date(dto.performedAt),
        costAmount: totalCost,
        costCurrency: dto.costCurrency ?? 'PLN',
        source: 'manual',
      },
    });

    await this.recomputeVehicleMileageKm(vehicleId);

    return record;
  }

  async addMaintenanceAttachments(
    ownerUserId: string,
    vehicleId: string,
    maintenanceId: string,
    files: Express.Multer.File[],
  ) {
    if (!files?.length) {
      throw new BadRequestException('No files provided.');
    }

    const ownership = await this.getCurrentOwnership(ownerUserId, vehicleId);
    if (!ownership) {
      throw new NotFoundException('Vehicle not found for current user.');
    }
    const maintenanceRecord = await this.prisma.maintenanceRecord.findFirst({
      where: {
        id: maintenanceId,
        vehicleId,
        ownerUserId,
      },
    });

    if (!maintenanceRecord) {
      throw new NotFoundException('Maintenance record not found for current user.');
    }

    const baseFolder = ownership.cloudFolder ?? `cars/${await this.getVinById(vehicleId)}/owners/${ownerUserId}`;
    const folder = `${baseFolder}/maintenance/${maintenanceId}`;
    await this.cloudinaryService.ensureFolder(folder);

    const uploaded = await Promise.all(
      files.map((file) => this.cloudinaryService.uploadImage(file, folder)),
    );

    const created = await this.prisma.$transaction(
      uploaded.map((item, index) =>
        this.prisma.maintenanceAttachment.create({
          data: {
            maintenanceRecordId: maintenanceId,
            ownerUserId,
            url: item.secure_url,
            publicId: item.public_id,
            originalName: files[index]?.originalname,
            mimeType: files[index]?.mimetype,
            sizeBytes: files[index]?.size,
          },
        }),
      ),
    );

    return created;
  }

  async addOdometerLog(ownerUserId: string, vehicleId: string, dto: AddOdometerLogDto) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    const log = await this.prisma.odometerLog.create({
      data: {
        vehicleId,
        ownerUserId,
        mileageKm: dto.mileageKm,
        recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
        notes: dto.notes,
        source: 'manual',
      },
    });

    await this.recomputeVehicleMileageKm(vehicleId);

    return log;
  }

  async addRegistrationEvent(ownerUserId: string, vehicleId: string, dto: AddRegistrationEventDto) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    return this.prisma.vehicleRegistrationEvent.create({
      data: {
        vehicleId,
        ownerUserId,
        eventType: dto.eventType,
        eventDate: new Date(dto.eventDate),
        countryCode: dto.countryCode,
        notes: dto.notes,
      },
    });
  }

  async createSaleContract(ownerUserId: string, vehicleId: string, dto: CreateSaleContractDto) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    const generatedText = this.generateSaleContractText({
      vin: await this.getVinById(vehicleId),
      sellerSnapshot: dto.sellerSnapshot,
      buyerSnapshot: dto.buyerSnapshot,
      contractDate: dto.contractDate,
      price: dto.salePriceAmount,
      currency: dto.salePriceCurrency ?? 'PLN',
    });

    return this.prisma.vehicleSaleContract.create({
      data: {
        vehicleId,
        sellerUserId: ownerUserId,
        buyerUserId: dto.buyerUserId,
        sellerSnapshot: dto.sellerSnapshot as Prisma.InputJsonValue,
        buyerSnapshot: dto.buyerSnapshot as Prisma.InputJsonValue,
        salePriceAmount: dto.salePriceAmount,
        salePriceCurrency: dto.salePriceCurrency ?? 'PLN',
        contractDate: new Date(dto.contractDate),
        generatedText,
        status: 'draft',
      },
    });
  }

  async getSalePlatforms(ownerUserId: string, vehicleId: string) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { countryCode: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    const region = (vehicle.countryCode ?? 'PL').toUpperCase();
    return {
      vehicleId,
      region,
      availablePlatforms: MARKET_PLATFORMS[region] ?? [],
      plannedPlatforms: [DistributionPlatform.TIKTOK, DistributionPlatform.INSTAGRAM],
    };
  }

  async listSaleListings(ownerUserId: string, vehicleId: string) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);
    return this.prisma.vehicleSaleListing.findMany({
      where: { ownerUserId, vehicleId },
      include: { distributions: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async listPublicListings() {
    const listings = await this.prisma.vehicleSaleListing.findMany({
      where: {
        status: { in: [SaleListingStatus.READY, SaleListingStatus.ACTIVE] },
        distributions: {
          some: {
            platform: DistributionPlatform.OUR_SITE,
            status: {
              in: [
                ListingDistributionStatus.PENDING,
                ListingDistributionStatus.IN_PROGRESS,
                ListingDistributionStatus.PUBLISHED,
              ],
            },
          },
        },
      },
      include: {
        vehicle: {
          include: {
            photos: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return listings.map((listing) => this.mapSaleListingToBrowseCar(listing));
  }

  async getPublicListing(listingId: string) {
    const listing = await this.prisma.vehicleSaleListing.findFirst({
      where: {
        OR: [{ id: listingId }, { vehicleId: listingId }],
        status: { in: [SaleListingStatus.READY, SaleListingStatus.ACTIVE] },
        distributions: {
          some: {
            platform: DistributionPlatform.OUR_SITE,
            status: {
              in: [
                ListingDistributionStatus.PENDING,
                ListingDistributionStatus.IN_PROGRESS,
                ListingDistributionStatus.PUBLISHED,
              ],
            },
          },
        },
      },
      include: {
        vehicle: {
          include: {
            photos: { orderBy: { createdAt: 'desc' }, take: 20 },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!listing) throw new NotFoundException('Public listing not found.');
    return this.mapSaleListingToBrowseCar(listing);
  }

  async upsertSaleListing(ownerUserId: string, vehicleId: string, dto: CreateSaleListingDto) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    const existing = await this.prisma.vehicleSaleListing.findFirst({
      where: {
        ownerUserId,
        vehicleId,
        status: {
          in: [SaleListingStatus.DRAFT, SaleListingStatus.READY, SaleListingStatus.ACTIVE],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const nextTitle =
      dto.title ??
      `${vehicle.brandId ?? 'Vehicle'} ${vehicle.modelId ?? ''} ${vehicle.year ?? ''}`.trim();

    if (existing) {
      return this.prisma.vehicleSaleListing.update({
        where: { id: existing.id },
        data: {
          title: dto.title ?? existing.title ?? nextTitle,
          description: dto.description ?? existing.description,
          price: dto.price ?? undefined,
          currency: dto.currency ?? existing.currency ?? 'PLN',
          marketRegion: vehicle.countryCode ?? existing.marketRegion ?? 'PL',
          specsJson: dto.specs as Prisma.InputJsonValue | undefined,
          appearanceJson: dto.appearance as Prisma.InputJsonValue | undefined,
          featuresJson: dto.features as Prisma.InputJsonValue | undefined,
          contactJson: dto.contact as Prisma.InputJsonValue | undefined,
          status: existing.status === SaleListingStatus.DRAFT ? SaleListingStatus.DRAFT : existing.status,
        },
        include: { distributions: true },
      });
    }

    return this.prisma.vehicleSaleListing.create({
      data: {
        vehicleId,
        ownerUserId,
        status: SaleListingStatus.DRAFT,
        title: nextTitle,
        description: dto.description,
        price: dto.price,
        currency: dto.currency ?? 'PLN',
        marketRegion: vehicle.countryCode ?? 'PL',
        specsJson: dto.specs as Prisma.InputJsonValue | undefined,
        appearanceJson: dto.appearance as Prisma.InputJsonValue | undefined,
        featuresJson: dto.features as Prisma.InputJsonValue | undefined,
        contactJson: dto.contact as Prisma.InputJsonValue | undefined,
      },
      include: { distributions: true },
    });
  }

  async publishSaleListing(ownerUserId: string, saleListingId: string, dto: PublishSaleListingDto) {
    const listing = await this.prisma.vehicleSaleListing.findFirst({
      where: { id: saleListingId, ownerUserId },
      include: { vehicle: true },
    });
    if (!listing) throw new NotFoundException('Sale listing not found.');

    const region = (listing.marketRegion ?? listing.vehicle.countryCode ?? 'PL').toUpperCase();
    const allowed = new Set(MARKET_PLATFORMS[region] ?? []);
    const requestedPlatforms = dto.platforms?.length ? dto.platforms : [DistributionPlatform.OUR_SITE];
    const withMainSite = requestedPlatforms.includes(DistributionPlatform.OUR_SITE)
      ? requestedPlatforms
      : [DistributionPlatform.OUR_SITE, ...requestedPlatforms];
    const invalid = withMainSite.filter((platform) => !allowed.has(platform));
    if (invalid.length) {
      throw new BadRequestException(
        `Platforms not available for region ${region}: ${invalid.join(', ')}`,
      );
    }

    await this.prisma.$transaction(
      withMainSite.map((platform) =>
        this.prisma.listingDistribution.upsert({
          where: {
            sale_listing_platform_unique: {
              saleListingId: listing.id,
              platform,
            },
          },
          create: {
            saleListingId: listing.id,
            platform,
            status: ListingDistributionStatus.PENDING,
            payloadSnapshot: {
              note: 'stub_publish_pipeline',
              requestedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
          update: {
            status: ListingDistributionStatus.PENDING,
            lastError: null,
            payloadSnapshot: {
              note: 'stub_publish_pipeline',
              requestedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        }),
      ),
    );

    const updated = await this.prisma.vehicleSaleListing.update({
      where: { id: listing.id },
      data: { status: SaleListingStatus.READY, marketRegion: region },
      include: { distributions: true },
    });

    return {
      ok: true,
      listing: updated,
      message: 'Distribution jobs created in stub mode. Real platform adapters not enabled yet.',
    };
  }

  async unpublishSaleListing(ownerUserId: string, saleListingId: string) {
    const listing = await this.prisma.vehicleSaleListing.findFirst({
      where: { id: saleListingId, ownerUserId },
      include: { distributions: true },
    });
    if (!listing) throw new NotFoundException('Sale listing not found.');

    if (!listing.distributions.length) {
      const paused = await this.prisma.vehicleSaleListing.update({
        where: { id: saleListingId },
        data: { status: SaleListingStatus.PAUSED },
        include: { distributions: true },
      });
      return {
        ok: true,
        listing: paused,
        message: 'Sale listing paused. No platform placements were active.',
      };
    }

    await this.prisma.$transaction(
      listing.distributions.map((distribution) =>
        this.prisma.listingDistribution.update({
          where: { id: distribution.id },
          data: {
            status: ListingDistributionStatus.UNPUBLISHED,
            lastError: null,
            payloadSnapshot: {
              note: 'stub_unpublish_pipeline',
              requestedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        }),
      ),
    );

    const updated = await this.prisma.vehicleSaleListing.update({
      where: { id: saleListingId },
      data: { status: SaleListingStatus.PAUSED },
      include: { distributions: true },
    });

    return {
      ok: true,
      listing: updated,
      message: 'Sale cancelled on all platforms in stub mode.',
    };
  }

  async getRecommendations(ownerUserId: string, vehicleId: string) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        maintenance: {
          orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    const currentMileage = vehicle.currentMileageKm ?? 0;
    const rules = [
      { type: 'ENGINE_OIL', everyKm: 10_000, title: 'Engine oil change' },
      { type: 'BRAKE_FLUID', everyKm: 40_000, title: 'Brake fluid check/change' },
      { type: 'AIR_FILTER', everyKm: 20_000, title: 'Air filter replacement' },
    ];

    const maintenanceRecommendations: GarageRecommendation[] = rules.map((rule) => {
      const last = vehicle.maintenance.find((item) => item.type === rule.type);
      const mileageAtLast = last?.mileageKm ?? 0;
      const delta = currentMileage - mileageAtLast;
      const level: RecommendationLevel =
        delta >= rule.everyKm ? 'overdue' : delta >= rule.everyKm * 0.85 ? 'due_soon' : 'ok';

      return {
        category: 'maintenance',
        type: rule.type,
        title: rule.title,
        currentMileageKm: currentMileage,
        lastServiceMileageKm: mileageAtLast || null,
        kmSinceLastService: delta,
        recommendedIntervalKm: rule.everyKm,
        level,
        daysUntilExpiry: null,
        expiresAt: null,
      };
    });

    const complianceRecommendations = await this.getComplianceRecommendations(
      ownerUserId,
      vehicleId,
    );
    return [...maintenanceRecommendations, ...complianceRecommendations];
  }

  async getVehicleCompliance(ownerUserId: string, vehicleId: string) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { countryCode: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    const [inspection, policies] = await Promise.all([
      this.prisma.vehicleTechnicalInspection.findUnique({ where: { vehicleId } }),
      this.prisma.vehicleInsurancePolicy.findMany({
        where: { vehicleId, ownerUserId, isActive: true },
        orderBy: { endsAt: 'desc' },
      }),
    ]);

    const oc = policies.find((p) => p.type === InsurancePolicyType.OC) ?? null;
    const ac = policies.find((p) => p.type === InsurancePolicyType.AC) ?? null;
    const alerts = this.buildComplianceAlerts(vehicle.countryCode, inspection, oc, ac);

    return {
      countryCode: vehicle.countryCode,
      inspection,
      oc,
      ac,
      alerts,
    };
  }

  async upsertTechnicalInspection(
    ownerUserId: string,
    vehicleId: string,
    dto: UpsertTechnicalInspectionDto,
  ) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    const performedAt = new Date(dto.performedAt);
    const validUntil = new Date(dto.validUntil);
    if (validUntil < performedAt) {
      throw new BadRequestException('validUntil must be on or after performedAt.');
    }

    return this.prisma.vehicleTechnicalInspection.upsert({
      where: { vehicleId },
      create: {
        vehicleId,
        ownerUserId,
        performedAt,
        validUntil,
        stationName: dto.stationName?.trim() || null,
        certificateNo: dto.certificateNo?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
      update: {
        performedAt,
        validUntil,
        stationName: dto.stationName?.trim() || null,
        certificateNo: dto.certificateNo?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async upsertInsurancePolicy(
    ownerUserId: string,
    vehicleId: string,
    dto: UpsertInsurancePolicyDto,
  ) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    if (dto.isActive === false) {
      await this.prisma.vehicleInsurancePolicy.updateMany({
        where: { vehicleId, ownerUserId, type: dto.type, isActive: true },
        data: { isActive: false },
      });
      return null;
    }

    if (!dto.insurerName?.trim()) {
      throw new BadRequestException('insurerName is required.');
    }
    if (!dto.startsAt || !dto.endsAt) {
      throw new BadRequestException('startsAt and endsAt are required.');
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt < startsAt) {
      throw new BadRequestException('endsAt must be on or after startsAt.');
    }

    const existing = await this.prisma.vehicleInsurancePolicy.findFirst({
      where: { vehicleId, ownerUserId, type: dto.type, isActive: true },
    });

    const payload = {
      insurerName: dto.insurerName.trim(),
      policyNumber: dto.policyNumber?.trim() || null,
      startsAt,
      endsAt,
      premiumAmount: dto.premiumAmount ?? null,
      premiumCurrency: dto.premiumCurrency?.trim() || 'PLN',
      notes: dto.notes?.trim() || null,
      isActive: true,
    };

    if (existing) {
      return this.prisma.vehicleInsurancePolicy.update({
        where: { id: existing.id },
        data: payload,
      });
    }

    return this.prisma.vehicleInsurancePolicy.create({
      data: {
        vehicleId,
        ownerUserId,
        type: dto.type,
        ...payload,
      },
    });
  }

  private async getComplianceRecommendations(
    ownerUserId: string,
    vehicleId: string,
  ): Promise<GarageRecommendation[]> {
    const compliance = await this.getVehicleCompliance(ownerUserId, vehicleId);
    const isPl = this.isPlVehicle(compliance.countryCode);
    const items: GarageRecommendation[] = [];

    const pushItem = (
      type: string,
      title: string,
      expiresAt: Date | null,
      missing: boolean,
    ) => {
      if (missing || !expiresAt) {
        items.push({
          category: 'compliance',
          type,
          title,
          currentMileageKm: 0,
          lastServiceMileageKm: null,
          kmSinceLastService: 0,
          recommendedIntervalKm: 0,
          level: 'overdue',
          daysUntilExpiry: null,
          expiresAt: null,
        });
        return;
      }
      const daysUntil = this.daysUntilDate(expiresAt);
      items.push({
        category: 'compliance',
        type,
        title,
        currentMileageKm: 0,
        lastServiceMileageKm: null,
        kmSinceLastService: 0,
        recommendedIntervalKm: 0,
        level: this.complianceLevel(daysUntil),
        daysUntilExpiry: daysUntil,
        expiresAt: expiresAt.toISOString(),
      });
    };

    if (isPl || compliance.inspection) {
      pushItem(
        'TECHNICAL_INSPECTION',
        'Technical inspection (przegląd)',
        compliance.inspection?.validUntil ?? null,
        isPl && !compliance.inspection,
      );
    }
    if (isPl || compliance.oc) {
      pushItem(
        'INSURANCE_OC',
        'OC insurance',
        compliance.oc?.endsAt ?? null,
        isPl && !compliance.oc,
      );
    }
    if (compliance.ac) {
      pushItem('INSURANCE_AC', 'AC insurance', compliance.ac.endsAt, false);
    }

    return items;
  }

  private daysUntilDate(date: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  }

  private complianceLevel(daysUntil: number): RecommendationLevel {
    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 30) return 'due_soon';
    return 'ok';
  }

  private isPlVehicle(countryCode?: string | null): boolean {
    return countryCode?.trim().toUpperCase() === 'PL';
  }

  private buildComplianceAlerts(
    countryCode: string | null | undefined,
    inspection: { validUntil: Date } | null,
    oc: { endsAt: Date } | null,
    ac: { endsAt: Date } | null,
  ) {
    const isPl = this.isPlVehicle(countryCode);
    const alerts: Array<{
      type: string;
      severity: 'high' | 'medium' | 'low';
      title: string;
      message: string;
      daysUntil: number | null;
      expiresAt: string | null;
    }> = [];

    const push = (
      type: string,
      title: string,
      expiresAt: Date | null,
      missing: boolean,
    ) => {
      if (missing) {
        alerts.push({
          type,
          severity: 'high',
          title,
          message: 'No data on file.',
          daysUntil: null,
          expiresAt: null,
        });
        return;
      }
      if (!expiresAt) return;
      const daysUntil = this.daysUntilDate(expiresAt);
      const severity =
        daysUntil < 0 ? 'high' : daysUntil <= 7 ? 'high' : daysUntil <= 30 ? 'medium' : 'low';
      const message =
        daysUntil < 0
          ? `Expired ${Math.abs(daysUntil)} day(s) ago.`
          : daysUntil === 0
            ? 'Expires today.'
            : `Expires in ${daysUntil} day(s).`;
      alerts.push({
        type,
        severity,
        title,
        message,
        daysUntil,
        expiresAt: expiresAt.toISOString(),
      });
    };

    if (isPl || inspection) {
      push(
        'TECHNICAL_INSPECTION',
        'Technical inspection',
        inspection?.validUntil ?? null,
        isPl && !inspection,
      );
    }
    if (isPl || oc) {
      push('INSURANCE_OC', 'OC insurance', oc?.endsAt ?? null, isPl && !oc);
    }
    if (ac) {
      push('INSURANCE_AC', 'AC insurance', ac.endsAt, false);
    }

    return alerts;
  }

  async getInsights(ownerUserId: string, vehicleId: string) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        maintenance: {
          orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
        },
        odometerLogs: {
          orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
          take: 2,
        },
      },
    });

    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    const recommendations = await this.getRecommendations(ownerUserId, vehicleId);
    const alerts = recommendations
      .filter((item) => item.level !== 'ok')
      .map((item) => {
        if (item.category === 'compliance') {
          const daysUntil = item.daysUntilExpiry;
          const message =
            daysUntil == null
              ? 'No compliance data on file.'
              : daysUntil < 0
                ? `Expired ${Math.abs(daysUntil)} day(s) ago.`
                : daysUntil === 0
                  ? 'Expires today.'
                  : `Expires in ${daysUntil} day(s).`;
          return {
            severity: item.level === 'overdue' || (daysUntil != null && daysUntil <= 7) ? 'high' : 'medium',
            title: item.title,
            message,
          };
        }
        return {
          severity: item.level === 'overdue' ? 'high' : 'medium',
          title: item.title,
          message:
            item.level === 'overdue'
              ? `Service overdue by ${item.kmSinceLastService - item.recommendedIntervalKm} km.`
              : 'Service is approaching due mileage.',
        };
      });

    const [latest, previous] = vehicle.odometerLogs;
    const usageHint =
      latest && previous
        ? `You drove ${latest.mileageKm - previous.mileageKm} km between last 2 odometer updates.`
        : 'Add regular mileage logs to improve prediction quality.';

    const aiSuggestions = [
      'Track fuel and tire pressure weekly to improve maintenance accuracy.',
      'Create a maintenance record immediately after each service visit.',
      'Keep documents and invoices linked to each maintenance record.',
      usageHint,
    ];

    return {
      vehicleId: vehicle.id,
      vin: vehicle.vin,
      currentMileageKm: vehicle.currentMileageKm ?? 0,
      alerts,
      recommendations,
      aiSuggestions,
    };
  }

  async getVehicleProfile(
    vehicleId: string,
    requestedTier: VehicleProfileTier,
    viewerUserId?: string,
  ) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        ownerships: {
          where: { isCurrent: true },
          take: 1,
          orderBy: { startedAt: 'desc' },
        },
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    const resolvedTier = await this.vehicleProfileAccessService.resolveTier(
      requestedTier,
      vehicleId,
      viewerUserId,
    );

    let payload: Record<string, unknown>;
    if (resolvedTier === VehicleProfileTier.OWNER) {
      payload = await this.buildOwnerProfile(vehicleId);
    } else if (resolvedTier === VehicleProfileTier.PAID) {
      payload = await this.buildPaidProfile(vehicleId);
    } else {
      payload = this.buildPublicProfile(vehicle);
    }

    await this.prisma.vehicleProfileViewLog.create({
      data: {
        vehicleId,
        viewerUserId,
        requestedTier,
        resolvedTier,
      },
    });

    return {
      vehicleId,
      requestedTier,
      resolvedTier,
      data: payload,
    };
  }

  async purchaseReportAccess(userId: string, vehicleId: string, provider: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    const existing = await this.prisma.vehicleReportAccessGrant.findFirst({
      where: {
        userId,
        vehicleId,
        provider,
        accessLevel: VehicleProfileTier.PAID,
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
      },
    });

    if (existing) {
      return { ok: true, grant: existing, message: 'Active paid access already exists.' };
    }

    const grant = await this.prisma.vehicleReportAccessGrant.create({
      data: {
        vehicleId,
        userId,
        provider,
        accessLevel: VehicleProfileTier.PAID,
        source: 'purchase',
      },
    });

    return { ok: true, grant };
  }

  async requestReport(
    userId: string,
    vehicleId: string,
    provider: string,
    tier: VehicleProfileTier,
  ) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    const resolvedTier = await this.vehicleProfileAccessService.resolveTier(
      tier,
      vehicleId,
      userId,
    );
    if (tier === VehicleProfileTier.PAID && resolvedTier !== VehicleProfileTier.PAID && resolvedTier !== VehicleProfileTier.OWNER) {
      throw new BadRequestException('Paid access required for paid report request.');
    }

    const report = await this.prisma.vehicleReport.create({
      data: {
        vehicleId,
        provider,
        tier: resolvedTier === VehicleProfileTier.OWNER ? VehicleProfileTier.OWNER : tier,
        status: VehicleReportStatus.PENDING,
      },
    });

    return {
      ok: true,
      report,
      message: 'Report request accepted. Processing started.',
    };
  }

  async getLatestReport(vehicleId: string, provider: string, viewerUserId?: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    const paidTier = await this.vehicleProfileAccessService.resolveTier(
      VehicleProfileTier.PAID,
      vehicleId,
      viewerUserId,
    );

    let allowedTiers: VehicleProfileTier[] = [VehicleProfileTier.PUBLIC];
    if (paidTier === VehicleProfileTier.PAID) {
      allowedTiers = [VehicleProfileTier.PUBLIC, VehicleProfileTier.PAID];
    } else if (paidTier === VehicleProfileTier.OWNER) {
      allowedTiers = [VehicleProfileTier.PUBLIC, VehicleProfileTier.OWNER, VehicleProfileTier.PAID];
    }

    const report = await this.prisma.vehicleReport.findFirst({
      where: {
        vehicleId,
        provider,
        tier: { in: allowedTiers },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      vehicleId,
      provider,
      accessTier: paidTier,
      report,
    };
  }

  private async assertCurrentOwner(ownerUserId: string, vehicleId: string) {
    const ownership = await this.getCurrentOwnership(ownerUserId, vehicleId);
    if (!ownership) {
      throw new NotFoundException('Vehicle not found for current user.');
    }
  }

  private async getCurrentOwnership(ownerUserId: string, vehicleId: string) {
    return this.prisma.vehicleOwnership.findFirst({
      where: { ownerUserId, vehicleId, isCurrent: true },
    });
  }

  private async getVinById(vehicleId: string): Promise<string> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { vin: true },
    });

    if (!vehicle) throw new NotFoundException('Vehicle not found.');
    return vehicle.vin;
  }

  private buildPublicProfile(vehicle: {
    vin: string;
    year: number | null;
    plateNumber: string | null;
    brandId: string | null;
    modelId: string | null;
    variantId: string | null;
    vehicleType: string | null;
    color: string | null;
    engine: string | null;
    transmission: string | null;
    fuelType: string | null;
    currentMileageKm: number | null;
    countryCode: string | null;
  }) {
    const vinMask =
      vehicle.vin.length > 6
        ? `${vehicle.vin.slice(0, 3)}***${vehicle.vin.slice(-4)}`
        : `${vehicle.vin.slice(0, 2)}***`;
    return {
      vinMask,
      year: vehicle.year,
      plateNumber: vehicle.plateNumber,
      brandId: vehicle.brandId,
      modelId: vehicle.modelId,
      variantId: vehicle.variantId,
      vehicleType: vehicle.vehicleType,
      color: vehicle.color,
      engine: vehicle.engine,
      transmission: vehicle.transmission,
      fuelType: vehicle.fuelType,
      currentMileageKm: vehicle.currentMileageKm,
      countryCode: vehicle.countryCode,
    };
  }

  private async recomputeVehicleMileageKm(vehicleId: string): Promise<void> {
    const [latestMaint, latestOdo] = await Promise.all([
      this.prisma.maintenanceRecord.findFirst({
        where: { vehicleId },
        orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
        select: { mileageKm: true, performedAt: true },
      }),
      this.prisma.odometerLog.findFirst({
        where: { vehicleId },
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
        select: { mileageKm: true, recordedAt: true },
      }),
    ]);

    let mileageKm: number | null = null;
    if (latestMaint && latestOdo) {
      const m = latestMaint.performedAt.getTime();
      const o = latestOdo.recordedAt.getTime();
      if (o > m) {
        mileageKm = latestOdo.mileageKm;
      } else if (m > o) {
        mileageKm = latestMaint.mileageKm;
      } else {
        mileageKm = Math.max(latestMaint.mileageKm, latestOdo.mileageKm);
      }
    } else if (latestMaint) {
      mileageKm = latestMaint.mileageKm;
    } else if (latestOdo) {
      mileageKm = latestOdo.mileageKm;
    }

    if (mileageKm == null) {
      return;
    }

    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { currentMileageKm: mileageKm },
    });
  }

  private async buildOwnerProfile(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        maintenance: {
          include: { attachments: true },
          orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
        },
        photos: { orderBy: { createdAt: 'desc' }, take: 30 },
        odometerLogs: { orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }], take: 100 },
        registrationEvents: { orderBy: { eventDate: 'desc' }, take: 100 },
        reports: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');
    return vehicle;
  }

  private async buildPaidProfile(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        reports: {
          where: { tier: VehicleProfileTier.PAID, status: VehicleReportStatus.READY },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');

    return {
      public: this.buildPublicProfile(vehicle),
      paidReports: vehicle.reports,
    };
  }

  private generateSaleContractText(input: {
    vin: string;
    sellerSnapshot: Record<string, unknown>;
    buyerSnapshot: Record<string, unknown>;
    contractDate: string;
    price?: number;
    currency: string;
  }) {
    return [
      'VEHICLE SALE AGREEMENT (DRAFT)',
      `Date: ${input.contractDate}`,
      `VIN: ${input.vin}`,
      `Seller: ${JSON.stringify(input.sellerSnapshot)}`,
      `Buyer: ${JSON.stringify(input.buyerSnapshot)}`,
      `Price: ${input.price ?? 'N/A'} ${input.currency}`,
      'This draft must be reviewed before signing.',
    ].join('\n');
  }

  private mapSaleListingToBrowseCar(listing: {
    id: string;
    ownerUserId: string;
    title: string | null;
    description: string | null;
    price: Prisma.Decimal | null;
    specsJson: Prisma.JsonValue | null;
    appearanceJson: Prisma.JsonValue | null;
    featuresJson: Prisma.JsonValue | null;
    contactJson: Prisma.JsonValue | null;
    vehicle: {
      brandId: string | null;
      modelId: string | null;
      variantId: string | null;
      engine: string | null;
      vehicleType: string | null;
      year: number | null;
      currentMileageKm: number | null;
      color: string | null;
      photos: Array<{ url: string }>;
    };
  }) {
    return {
      id: listing.id,
      ownerId: listing.ownerUserId,
      brand: listing.vehicle.brandId ?? 'Unknown',
      model: listing.vehicle.modelId ?? 'Model',
      complectation: listing.vehicle.variantId ?? '',
      engine: Number(listing.vehicle.engine ?? 0),
      type: listing.vehicle.vehicleType ?? 'Unknown',
      price: Number(listing.price ?? 0),
      year: listing.vehicle.year ?? new Date().getFullYear(),
      mileage: listing.vehicle.currentMileageKm ?? 0,
      description: listing.description ?? listing.title ?? 'No description',
      color: listing.vehicle.color ?? undefined,
      images: listing.vehicle.photos.map((photo) => photo.url),
      specs: listing.specsJson ?? undefined,
      appearance: listing.appearanceJson ?? undefined,
      features: listing.featuresJson ?? undefined,
      contact: listing.contactJson ?? undefined,
      isRentable: false,
    };
  }

  async createServiceVisit(
    ownerUserId: string,
    vehicleId: string,
    dto: CreateServiceVisitDto,
  ) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    if (dto.organizationId && dto.draftCompanyId) {
      throw new BadRequestException('Link either organizationId or draftCompanyId, not both.');
    }

    const visit = await this.prisma.garageServiceVisit.create({
      data: {
        vehicleId,
        ownerUserId,
        performedAt: new Date(dto.performedAt),
        odometerKm: dto.odometerKm,
        totalCost: dto.totalCost,
        costCurrency: dto.costCurrency ?? 'PLN',
        notes: dto.notes?.trim() || null,
        organizationId: dto.organizationId ?? null,
        draftCompanyId: dto.draftCompanyId ?? null,
        providerSnapshot: dto.providerSnapshot as unknown as Prisma.InputJsonValue,
        verifiedBy: 'OWNER',
        lineItems: {
          create: dto.lineItems.map((item, index) => ({
            sortOrder: index,
            name: item.name.trim(),
            description: item.description?.trim() || null,
            laborCost: item.laborCost,
            partsCost: item.partsCost,
            lineTotal: item.lineTotal,
            parts: item.parts?.length
              ? {
                  create: item.parts.map((part) => ({
                    name: part.name.trim(),
                    purchasedBy: part.purchasedBy,
                    brand: part.brand?.trim() || null,
                    productUrl: part.productUrl?.trim() || null,
                    partNumber: part.partNumber?.trim() || null,
                    cost: part.cost,
                  })),
                }
              : undefined,
          })),
        },
      },
      include: {
        lineItems: { include: { parts: true }, orderBy: { sortOrder: 'asc' } },
        attachments: true,
      },
    });

    if (dto.odometerKm != null) {
      await this.recomputeVehicleMileageKm(vehicleId);
    }

    return visit;
  }

  async listServiceLineSuggestions(
    ownerUserId: string,
    vehicleId: string,
    query?: string,
  ): Promise<Array<{ name: string; count: number; source: 'history' }>> {
    await this.assertCurrentOwner(ownerUserId, vehicleId);

    const q = query?.trim();
    const textFilter = q
      ? { contains: q, mode: 'insensitive' as const }
      : undefined;

    const [lineItems, maintenance] = await Promise.all([
      this.prisma.garageServiceLineItem.findMany({
        where: {
          visit: { vehicleId, ownerUserId },
          ...(textFilter ? { name: textFilter } : {}),
        },
        select: {
          name: true,
          visit: { select: { performedAt: true } },
        },
        orderBy: { visit: { performedAt: 'desc' } },
        take: 120,
      }),
      this.prisma.maintenanceRecord.findMany({
        where: {
          vehicleId,
          ownerUserId,
          ...(textFilter ? { title: textFilter } : {}),
        },
        select: {
          title: true,
          performedAt: true,
        },
        orderBy: { performedAt: 'desc' },
        take: 60,
      }),
    ]);

    const byKey = new Map<string, { name: string; count: number; lastAt: number }>();

    const upsert = (rawName: string, performedAt: Date) => {
      const name = rawName.trim();
      if (!name) return;
      const key = name.toLowerCase();
      const at = performedAt.getTime();
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { name, count: 1, lastAt: at });
        return;
      }
      existing.count += 1;
      if (at >= existing.lastAt) {
        existing.lastAt = at;
      }
    };

    for (const item of lineItems) {
      upsert(item.name, item.visit.performedAt);
    }
    for (const row of maintenance) {
      upsert(row.title, row.performedAt);
    }

    return Array.from(byKey.values())
      .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
      .slice(0, 10)
      .map(({ name, count }) => ({ name, count, source: 'history' as const }));
  }

  async listServiceVisits(ownerUserId: string, vehicleId: string) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);
    return this.prisma.garageServiceVisit.findMany({
      where: { vehicleId, ownerUserId },
      include: {
        lineItems: { include: { parts: true }, orderBy: { sortOrder: 'asc' } },
        attachments: true,
      },
      orderBy: { performedAt: 'desc' },
    });
  }

  async getServiceVisit(ownerUserId: string, vehicleId: string, visitId: string) {
    await this.assertCurrentOwner(ownerUserId, vehicleId);
    const visit = await this.prisma.garageServiceVisit.findFirst({
      where: { id: visitId, vehicleId, ownerUserId },
      include: {
        lineItems: { include: { parts: true }, orderBy: { sortOrder: 'asc' } },
        attachments: true,
      },
    });
    if (!visit) {
      throw new NotFoundException('Service visit not found.');
    }
    return visit;
  }
}
