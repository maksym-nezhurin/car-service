import { Injectable } from '@nestjs/common';
import { VehicleProfileTier } from '../../prisma/generated-client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VehicleProfileAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveTier(
    requestedTier: VehicleProfileTier,
    vehicleId: string,
    userId?: string,
  ): Promise<VehicleProfileTier> {
    if (!userId) return VehicleProfileTier.PUBLIC;

    if (requestedTier === VehicleProfileTier.OWNER) {
      const isOwner = await this.isOwner(userId, vehicleId);
      return isOwner ? VehicleProfileTier.OWNER : VehicleProfileTier.PUBLIC;
    }

    if (requestedTier === VehicleProfileTier.PAID) {
      const isOwner = await this.isOwner(userId, vehicleId);
      if (isOwner) return VehicleProfileTier.OWNER;

      const hasPaidAccess = await this.hasPaidAccess(userId, vehicleId);
      return hasPaidAccess ? VehicleProfileTier.PAID : VehicleProfileTier.PUBLIC;
    }

    return VehicleProfileTier.PUBLIC;
  }

  async isOwner(userId: string, vehicleId: string): Promise<boolean> {
    const ownership = await this.prisma.vehicleOwnership.findFirst({
      where: { ownerUserId: userId, vehicleId, isCurrent: true },
      select: { id: true },
    });
    return Boolean(ownership);
  }

  async hasPaidAccess(userId: string, vehicleId: string): Promise<boolean> {
    const now = new Date();
    const grant = await this.prisma.vehicleReportAccessGrant.findFirst({
      where: {
        userId,
        vehicleId,
        accessLevel: VehicleProfileTier.PAID,
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      select: { id: true },
    });
    return Boolean(grant);
  }
}
