import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CarDto } from './dto/car.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class CarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(data: CarDto, images: Express.Multer.File[]) {
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
        isRentable: data.isRentable === 'true' || data.isRentable === true,
        rentPricePerDay: data.rentPricePerDay
          ? Number(data.rentPricePerDay)
          : 0,
        engine: data.engine ? Number(data.engine) : 0,
        price: data.price ? Number(data.price) : 0,
        year: data.year ? Number(data.year) : 2025,
        mileage: data.mileage ? Number(data.mileage) : 0,
        images: imageUrls,
      },
    });
  }

  findAll() {
    console.log('get all cars!');
    return this.prisma.car.findMany();
  }

  findOne(id: string) {
    return this.prisma.car.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: Partial<CarDto>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    images?: Express.Multer.File[],
  ) {
    console.log('--- data ----', data);

    const newData = {
      ...data,
      ownerId: data.ownerId ? data.ownerId : '11-11',
      isRentable: data.isRentable === 'true' || data.isRentable === true,
      rentPricePerDay: data.rentPricePerDay ? Number(data.rentPricePerDay) : 0,
      engine: data.engine ? Number(data.engine) : 0,
      price: data.price ? Number(data.price) : 0,
      year: data.year ? Number(data.year) : 2025,
      mileage: data.mileage ? Number(data.mileage) : 0,
    };

    return this.prisma.car.update({ where: { id }, data: newData });
  }

  async remove(id: string) {
    // 1. Get the car to access the image URLs
    const car = await this.prisma.car.findUnique({ where: { id } });

    if (!car) {
      throw new Error('Car not found');
    }

    // 2. Delete images from Cloudinary if any
    if (car.images && car.images.length > 0) {
      try {
        await Promise.all(
          car.images.map((url) => {
            // Extract the public_id from the URL
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            const publicId = this.cloudinaryService.getPublicIdFromUrl(url);
            console.log('publicId', publicId);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
            return this.cloudinaryService.deleteImage(publicId);
          }),
        );
      } catch (error) {
        console.error('Failed to delete images from Cloudinary:', error);
        // Continue deleting the DB record even if Cloudinary fails (optional)
      }
    }

    // 3. Delete the car from the database
    return this.prisma.car.delete({ where: { id } });
  }

  findByOwner(ownerId: string) {
    return this.prisma.car.findMany({ where: { ownerId } });
  }
}
