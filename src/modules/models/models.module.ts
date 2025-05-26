import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

@Module({
  imports: [HttpModule],
  controllers: [ModelsController],
  providers: [ModelsService],
})
export class ModelsModule {}
