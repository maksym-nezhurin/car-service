import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BrandsModule } from './modules/brands/brands.module';
import { ModelsModule } from './modules/models/models.module';
import { VariantsModule } from './modules/variants/variants.module';
import { CarsModule } from './modules/cars/cars.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { UploadController } from './modules/upload/upload.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BrandsModule,
    ModelsModule,
    VariantsModule,
    CarsModule,
    CloudinaryModule,
  ],
  controllers: [AppController, UploadController],
  providers: [AppService],
})
export class AppModule {}
