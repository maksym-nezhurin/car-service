import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({
  imports: [HttpModule],
  controllers: [BrandsController],
  providers: [BrandsService],
})
export class BrandsModule {}
