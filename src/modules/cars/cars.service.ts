import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCarDto } from './dto/create-car.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class CarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(data: CreateCarDto, images: Express.Multer.File[]) {
    // 1. Завантажуємо всі файли у Cloudinary та отримуємо масив url-ів
    let imageUrls: string[] = [];
    if (images && images.length > 0) {
      try {
        imageUrls = await Promise.all(
          images.map(async (file) => {
            const res = await this.cloudinaryService.uploadImage(file);
            return res.secure_url;
          }),
        );
      } catch (error) {
        // Логуємо і кидаємо помилку далі, щоб контролер повернув 500
        console.error('Cloudinary upload error:', error);
        throw new Error('Image upload failed. Announcement was not created.');
      }
    }

    // Якщо все ок — створюємо запис у БД
    return this.prisma.car.create({
      data: {
        ...data,
        engine: data.engine ? Number(data.engine) : 0,
        price: data.price ? Number(data.price) : 0,
        year: data.year ? Number(data.year) : 2025,
        mileage: data.mileage ? Number(data.mileage) : 0,
        images: imageUrls,
      },
    });
  }

  findAll() {
    return this.prisma.car.findMany();
  }

  findOne(id: string) {
    return this.prisma.car.findUnique({ where: { id } });
  }

  update(id: string, data: Partial<CreateCarDto>) {
    return this.prisma.car.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.car.delete({ where: { id } });
  }

  findByOwner(ownerId: string) {
    return this.prisma.car.findMany({ where: { ownerId } });
  }
}
