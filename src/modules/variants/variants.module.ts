import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VariantsController } from './variants.controller';
import { VariantsService } from './variants.service';

@Module({
  imports: [HttpModule],
  controllers: [VariantsController],
  providers: [VariantsService],
})
export class VariantsModule {}
