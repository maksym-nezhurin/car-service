import { Module } from '@nestjs/common';
import { GarageController } from './garage.controller';
import { GarageService } from './garage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { VehicleProfileAccessService } from './vehicle-profile-access.service';
import { VehicleImportAdapterRegistry } from './vehicle-import/vehicle-import-adapter.registry';
import { MockVehicleImportAdapter } from './vehicle-import/mock-vehicle-import.adapter';

@Module({
  imports: [CloudinaryModule],
  controllers: [GarageController],
  providers: [
    GarageService,
    PrismaService,
    VehicleProfileAccessService,
    MockVehicleImportAdapter,
    VehicleImportAdapterRegistry,
  ],
})
export class GarageModule {}
