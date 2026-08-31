import { Module } from '@nestjs/common';
import { GarageController } from './garage.controller';
import { GarageService } from './garage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { CatalogModule } from '../catalog/catalog.module';
import { VehicleProfileAccessService } from './vehicle-profile-access.service';
import { VehicleImportAdapterRegistry } from './vehicle-import/vehicle-import-adapter.registry';
import { MockVehicleImportAdapter } from './vehicle-import/mock-vehicle-import.adapter';
import { OcrVehicleImportAdapter } from './vehicle-import/ocr-vehicle-import.adapter';
import { DocumentAiClient } from './vehicle-import/document-ai.client';

@Module({
  imports: [CloudinaryModule, CatalogModule],
  controllers: [GarageController],
  providers: [
    GarageService,
    PrismaService,
    VehicleProfileAccessService,
    MockVehicleImportAdapter,
    OcrVehicleImportAdapter,
    DocumentAiClient,
    VehicleImportAdapterRegistry,
  ],
})
export class GarageModule {}
