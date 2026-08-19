/**
 * Delete existing trims for a make/model so AUTO.RIA force-sync can rebuild
 * without CarAPI/smoke leftovers blocking SYNC (existingTrimCount > 0).
 *
 * Usage:
 *   MAKE=hyundai MODEL=tucson npx ts-node scripts/clear-catalog-trims.ts
 */
import { PrismaClient } from '../generated/client';

const prisma = new PrismaClient();

async function main() {
  const makeSlug = (process.env.MAKE ?? 'hyundai').trim().toLowerCase();
  const modelSlug = (process.env.MODEL ?? 'tucson').trim().toLowerCase();

  const model = await prisma.catalogModel.findFirst({
    where: { slug: modelSlug, make: { slug: makeSlug } },
    select: { id: true, name: true },
  });
  if (!model) {
    throw new Error(`Model not found: ${makeSlug}/${modelSlug}`);
  }

  const result = await prisma.catalogTrim.deleteMany({
    where: { generation: { modelId: model.id } },
  });
  console.log(`Deleted ${result.count} trims for ${makeSlug}/${modelSlug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
