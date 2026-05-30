import { PrismaClient } from './generated-client';

const prisma = new PrismaClient();

async function main() {
  // 1️⃣ Створюємо категорію Cars
  const carsCategory = await prisma.category.upsert({
    where: { slug: 'cars' },
    update: {},
    create: {
      name: 'Cars',
      slug: 'cars',
    },
  });

  // 2️⃣ Створюємо атрибути для Cars
  const carAttributes = [
    {
      name: 'Brand',
      key: 'brand',
      type: 'STRING',
    },
    {
      name: 'Model',
      key: 'model',
      type: 'STRING',
    },
    {
      name: 'Year',
      key: 'year',
      type: 'NUMBER',
      unit: 'year',
    },
    {
      name: 'Mileage',
      key: 'mileage',
      type: 'NUMBER',
      unit: 'km',
    },
    {
      name: 'Transmission',
      key: 'transmission',
      type: 'ENUM',
    },
    {
      name: 'Fuel Type',
      key: 'fuelType',
      type: 'ENUM',
    },
    {
      name: 'Engine Volume',
      key: 'engineVolume',
      type: 'NUMBER',
      unit: 'L',
    },
    {
      name: 'Power',
      key: 'power',
      type: 'NUMBER',
      unit: 'HP',
    },
    {
      name: 'Drive',
      key: 'drive',
      type: 'ENUM',
    },
    {
      name: 'Color',
      key: 'color',
      type: 'STRING',
    },
    {
      name: 'Condition',
      key: 'condition',
      type: 'ENUM',
    },
    {
      name: 'Body Type',
      key: 'bodyType',
      type: 'ENUM',
    },
    {
      name: 'Doors',
      key: 'doors',
      type: 'NUMBER',
    },
    {
      name: 'VIN',
      key: 'vin',
      type: 'STRING',
    },
    {
      name: 'Owners',
      key: 'owners',
      type: 'NUMBER',
    },
    {
      name: 'Customs Cleared',
      key: 'customsCleared',
      type: 'BOOLEAN',
    },
  ];

  for (const attr of carAttributes) {
    await prisma.attribute.upsert({
      where: { categoryId_name: { categoryId: carsCategory.id, name: attr.name } },
      update: {},
      create: {
        categoryId: carsCategory.id,
        name: attr.name,
        key: attr.key,
        type: attr.type as any,
        unit: attr.unit || null,
      },
    })
  }

  // 3️⃣ Додаємо ENUM-опції для певних атрибутів
  const enums: Record<string, string[]> = {
    'Transmission': ['Manual', 'Automatic', 'CVT', 'Robotic'],
    'Fuel Type': ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG'],
    'Drive': ['FWD', 'RWD', 'AWD', '4WD'],
    'Body Type': ['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Convertible', 'Wagon'],
    'Condition': ['New', 'Used', 'Damaged'],
  };

  for (const [attrName, options] of Object.entries(enums)) {
    const attribute = await prisma.attribute.findFirst({
      where: { categoryId: carsCategory.id, name: attrName },
    })

    if (!attribute) continue

    for (const value of options) {
      await prisma.attributeOption.upsert({
        where: { attributeId_value: { attributeId: attribute.id, value } },
        update: {},
        create: {
          attributeId: attribute.id,
          value,
        },
      })
    }
  }

  console.log('✅ Seed for Cars category completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
