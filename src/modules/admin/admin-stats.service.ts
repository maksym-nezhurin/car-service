import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      vehiclesTotal,
      vehiclesLast7Days,
      vehiclesLast30Days,
      garageEntriesTotal,
      garageEntriesLast7Days,
      garageEntriesLast30Days,
      saleListingsActive,
    ] = await Promise.all([
      this.prisma.vehicle.count(),
      this.prisma.vehicle.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.vehicle.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.vehicleOwnership.count({ where: { isCurrent: true } }),
      this.prisma.vehicleOwnership.count({
        where: { isCurrent: true, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.vehicleOwnership.count({
        where: { isCurrent: true, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.vehicleSaleListing.count({
        where: { status: 'ACTIVE' },
      }),
    ]);

    return {
      vehicles: {
        total: vehiclesTotal,
        last7Days: vehiclesLast7Days,
        last30Days: vehiclesLast30Days,
      },
      garage: {
        /** Aktywne powiązania użytkownik → auto w garażu */
        entriesTotal: garageEntriesTotal,
        last7Days: garageEntriesLast7Days,
        last30Days: garageEntriesLast30Days,
      },
      saleListings: {
        active: saleListingsActive,
      },
    };
  }
}
