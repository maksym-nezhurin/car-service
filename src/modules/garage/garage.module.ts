import { Module } from '@nestjs/common';
import { GarageController } from './garage.controller';
import { GarageService } from './garage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { VehicleProfileAccessService } from './vehicle-profile-access.service';

@Module({
  imports: [CloudinaryModule],
  controllers: [GarageController],
  providers: [GarageService, PrismaService, VehicleProfileAccessService],
})
export class GarageModule {}
