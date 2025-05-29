import { Module } from '@nestjs/common';
import { CarsController } from './cars.controller';
import { CarsService } from './cars.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module'; // <-- ДОДАЙТЕ ІМПОРТ

@Module({
  imports: [CloudinaryModule],
  controllers: [CarsController],
  providers: [CarsService, PrismaService],
  exports: [CarsService],
})
export class CarsModule {}
