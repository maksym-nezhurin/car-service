/**
 * One-off seed: expand catalog_makes with a curated list of real passenger-car
 * brands from NHTSA's free, unlimited vPIC API (GetMakesForVehicleType/car),
 * filtered to drop custom-shop/kit-car/coachbuilder/robotaxi noise. Safe to
 * re-run — upserts by slug, so the 15 makes already synced from AUTO.RIA are
 * no-ops here, only genuinely new brands get inserted.
 *
 * Usage: pnpm ts-node scripts/seed-nhtsa-makes.ts
 */
import { PrismaClient } from '../generated/client';

const prisma = new PrismaClient();

const MAKES: Array<{ name: string; slug: string }> = [
  { name: 'Acura', slug: 'acura' },
  { name: 'Alfa Romeo', slug: 'alfa-romeo' },
  { name: 'AM General', slug: 'am-general' },
  { name: 'American Motors', slug: 'american-motors' },
  { name: 'Aston Martin', slug: 'aston-martin' },
  { name: 'Audi', slug: 'audi' },
  { name: 'Pininfarina', slug: 'pininfarina' },
  { name: 'Bentley', slug: 'bentley' },
  { name: 'BMW', slug: 'bmw' },
  { name: 'Bugatti', slug: 'bugatti' },
  { name: 'Buick', slug: 'buick' },
  { name: 'BYD', slug: 'byd' },
  { name: 'Cadillac', slug: 'cadillac' },
  { name: 'Checker', slug: 'checker' },
  { name: 'Chevrolet', slug: 'chevrolet' },
  { name: 'Chrysler', slug: 'chrysler' },
  { name: 'Coda', slug: 'coda' },
  { name: 'Daewoo', slug: 'daewoo' },
  { name: 'Daihatsu', slug: 'daihatsu' },
  { name: 'Datsun', slug: 'datsun' },
  { name: 'DeLorean', slug: 'delorean' },
  { name: 'Dodge', slug: 'dodge' },
  { name: 'Dongfeng', slug: 'dongfeng' },
  { name: 'Eagle', slug: 'eagle' },
  { name: 'Ferrari', slug: 'ferrari' },
  { name: 'Fiat', slug: 'fiat' },
  { name: 'Fisker', slug: 'fisker' },
  { name: 'Ford', slug: 'ford' },
  { name: 'Genesis', slug: 'genesis' },
  { name: 'Geo', slug: 'geo' },
  { name: 'Glickenhaus', slug: 'glickenhaus' },
  { name: 'GMC', slug: 'gmc' },
  { name: 'Holden', slug: 'holden' },
  { name: 'Honda', slug: 'honda' },
  { name: 'Hyundai', slug: 'hyundai' },
  { name: 'Infiniti', slug: 'infiniti' },
  { name: 'Isuzu', slug: 'isuzu' },
  { name: 'Jaguar', slug: 'jaguar' },
  { name: 'Karma', slug: 'karma' },
  { name: 'Kia', slug: 'kia' },
  { name: 'Koenigsegg', slug: 'koenigsegg' },
  { name: 'Lamborghini', slug: 'lamborghini' },
  { name: 'Lancia', slug: 'lancia' },
  { name: 'Lexus', slug: 'lexus' },
  { name: 'Lincoln', slug: 'lincoln' },
  { name: 'Lotus', slug: 'lotus' },
  { name: 'Lucid', slug: 'lucid' },
  { name: 'Maserati', slug: 'maserati' },
  { name: 'Maybach', slug: 'maybach' },
  { name: 'Mazda', slug: 'mazda' },
  { name: 'McLaren', slug: 'mclaren' },
  { name: 'Mercedes-Benz', slug: 'mercedes-benz' },
  { name: 'Mercury', slug: 'mercury' },
  { name: 'Merkur', slug: 'merkur' },
  { name: 'Mini', slug: 'mini' },
  { name: 'Mitsubishi', slug: 'mitsubishi' },
  { name: 'Moke', slug: 'moke' },
  { name: 'Morgan', slug: 'morgan' },
  { name: 'Mosler', slug: 'mosler' },
  { name: 'Nissan', slug: 'nissan' },
  { name: 'Oldsmobile', slug: 'oldsmobile' },
  { name: 'Opel', slug: 'opel' },
  { name: 'Pagani', slug: 'pagani' },
  { name: 'Panoz', slug: 'panoz' },
  { name: 'Peugeot', slug: 'peugeot' },
  { name: 'Plymouth', slug: 'plymouth' },
  { name: 'Polestar', slug: 'polestar' },
  { name: 'Pontiac', slug: 'pontiac' },
  { name: 'Porsche', slug: 'porsche' },
  { name: 'Renault', slug: 'renault' },
  { name: 'Rimac', slug: 'rimac' },
  { name: 'Rolls-Royce', slug: 'rolls-royce' },
  { name: 'Ruf', slug: 'ruf' },
  { name: 'Saab', slug: 'saab' },
  { name: 'Saleen', slug: 'saleen' },
  { name: 'Saturn', slug: 'saturn' },
  { name: 'Shelby', slug: 'shelby' },
  { name: 'Smart', slug: 'smart' },
  { name: 'Spyker', slug: 'spyker' },
  { name: 'SSC North America', slug: 'ssc-north-america' },
  { name: 'Subaru', slug: 'subaru' },
  { name: 'Suzuki', slug: 'suzuki' },
  { name: 'Tesla', slug: 'tesla' },
  { name: 'Toyota', slug: 'toyota' },
  { name: 'Triumph', slug: 'triumph' },
  { name: 'Volkswagen', slug: 'volkswagen' },
  { name: 'Volvo', slug: 'volvo' },
  { name: 'Yugo', slug: 'yugo' },
  { name: 'Zeekr', slug: 'zeekr' },
];

async function main() {
  let created = 0;
  let alreadyExisted = 0;

  for (const make of MAKES) {
    const existing = await prisma.catalogMake.findUnique({
      where: { slug: make.slug },
      select: { id: true },
    });
    if (existing) {
      alreadyExisted += 1;
      continue;
    }
    await prisma.catalogMake.create({
      data: {
        id: `nhtsa-${make.slug}`,
        slug: make.slug,
        name: make.name,
      },
    });
    created += 1;
    console.log(`+ ${make.name}`);
  }

  console.log(`\nDone. Created ${created} new makes, ${alreadyExisted} already existed.`);
  const total = await prisma.catalogMake.count();
  console.log(`catalog_makes total: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
