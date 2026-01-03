import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CarDto, AttributeValueDto } from './dto/car.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class CarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    console.log('CarsService initialized');
  }

  private async getCategoryId() {
    const category = await this.prisma.category.findUnique({ where: { slug: 'cars' } });
    if (!category) throw new Error('Cars category not found');
    return category.id;
  }

  private async getAttributeId(categoryId: string, name: string) {
    const attr = await this.prisma.attribute.findFirst({ where: { categoryId, name } });
    if (!attr) throw new Error(`Attribute "${name}" not found`);
    return attr.id;
  }

  private async enrichAds(ads: any[]) {
    // Collect all option IDs from all attributes
    const optionIds = ads
      .flatMap((ad) => ad.attributes)
      .map((attr) => attr.value)
      .filter(
        (val) => typeof val === 'string' && /^[0-9a-fA-F-]{36}$/.test(val),
      );

    // Fetch all relevant AttributeOptions
    const options = await this.prisma.attributeOption.findMany({
      where: { id: { in: optionIds } },
    });

    // Map optionId to option value for quick lookup
    const optionMap = Object.fromEntries(
      options.map((opt) => [opt.id, opt.value]),
    );

    // Enrich attributes for each ad
    return ads.map((ad) => {
      const {
        media,
        price,
        currency,
        title,
        id,
        userId,
        description,
        createdAt,
        updatedAt,
        attributes,
      } = ad;
      const attributesObj = Object.fromEntries(
        attributes.map((attr) => [
          attr.attribute?.key,
          optionMap[attr.value] ?? attr.value,
        ]),
      );

      return {
        media,
        price,
        currency,
        title,
        id,
        userId,
        description,
        createdAt,
        updatedAt,
        ...attributesObj,
      };
    });
  }

  async getAttributes() {
    const categoryId = await this.getCategoryId();
    const allowedAttributes = [
      'Mileage',
      'Engine Volume',
      'Transmission',
      'Fuel Type',
      'Body Type',
      'VIN',
      'Condition',
      'Drive',
    ];

    return this.prisma.attribute.findMany({
      where: {
        categoryId,
        name: { in: allowedAttributes },
      },
      include: {
        options: true,
      },
    });
  }

  // async findByOwner(ownerId: string) {
  //   return this.prisma.ad.findMany({
  //     where: { userId: ownerId },
  //     include: {
  //       attributes: true,
  //       media: true,
  //     },
  //   });
  // }

  async findByOwner(ownerId: string) {
    const ads = await this.prisma.ad.findMany({
      where: { userId: ownerId },
      include: {
        attributes: { include: { attribute: true } },
        media: true,
      },
    });
    return await this.enrichAds(ads);
  }

  async create(data: CarDto, images: Express.Multer.File[]) {
    const categoryId = await this.getCategoryId();

    // Завантаження файлів у Cloudinary
    const media = images?.length
      ? await Promise.all(
          images.map(async (file, idx) => {
            const res = await this.cloudinaryService.uploadImage(file);
            return { url: res.secure_url, type: 'image', position: idx + 1 };
          }),
        )
      : [];

    // Створення Ad з attributes і media
    console.log('Creating ad with data:', data);
    const {
      title,
      ownerId,
      description,
      price,
      currency = 'USD',
      ...rest
    } = data;

    const attributes: AttributeValueDto[] =
      typeof rest.attributes === 'string'
        ? (JSON.parse(rest.attributes) as AttributeValueDto[])
        : [];
    const ad = await this.prisma.ad.create({
      data: {
        title,
        description,
        price,
        currency,
        userId: ownerId,
        categoryId,
        attributes: {
          create: await Promise.all(
            attributes.map((attr) => {
              return {
                attributeId: attr.attributeId,
                value: attr.value,
              };
            }),
          ),
        },
        media: {
          create: media,
        },
      },
    });

    return ad;
  }

  async findAll(query: { page?: string; limit?: string; ownerId?: string }) {
    const page = query.page ? parseInt(query.page) : 1;
    const limit = query.limit ? parseInt(query.limit) : 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.ownerId) where.userId = query.ownerId;

    const total = await this.prisma.ad.count({ where });
    const ads = await this.prisma.ad.findMany({
      where,
      include: {
        attributes: {
          include: {
            attribute: true,
          },
        },
        media: true,
      },
      skip,
      take: limit,
    });

    return { data: await this.enrichAds(ads), total, page, limit };
  }

  async findOne(id: string) {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      include: { attributes: { include: { attribute: true } }, media: true },
    });
    console.log('Single ad:', ad);
    const predaredAd = await this.enrichAds([ad]);

    return predaredAd[0];
  }

  async update(
    id: string,
    data: Partial<CarDto>,
    images?: Express.Multer.File[],
  ) {
    const media = images?.length
      ? await Promise.all(
          images.map(async (file, idx) => {
            const res = await this.cloudinaryService.uploadImage(file);
            return { url: res.secure_url, type: 'image', position: idx + 1 };
          }),
        )
      : [];

    const ad = await this.prisma.ad.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        price: data.price,
        currency: data.currency,
        attributes: {
          // Тут можна реалізувати upsert атрибутів
          deleteMany: {}, // спочатку видаляємо старі
          // create: data.attributes?.map((attr) => ({
          //   attributeId: attr.attributeId,
          //   value: attr.value,
          // })),
        },
        media: {
          create: media,
        },
      },
    });

    return ad;
  }

  async remove(id: string) {
    const car = await this.prisma.ad.findUnique({
      where: { id },
      include: { media: true },
    });
    if (!car) throw new Error('Car not found');

    // Видалення з Cloudinary
    await Promise.all(
      car.media.map((m) => {
        const publicId = this.cloudinaryService.getPublicIdFromUrl(m.url);
        return this.cloudinaryService.deleteImage(publicId);
      }),
    );

    await this.prisma.media.deleteMany({
      where: { adId: id },
    });

    await this.prisma.attributeValue.deleteMany({
      where: { adId: id },
    });

    return this.prisma.ad.delete({ where: { id } });
  }
}
