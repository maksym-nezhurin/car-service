import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BrandsController } from './brands.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandsService } from './brands.service';

@Module({
  imports: [HttpModule],
  controllers: [BrandsController],
  providers: [BrandsService, PrismaService],
})
export class BrandsModule {}
