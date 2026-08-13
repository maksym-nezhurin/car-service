/**
 * Export CarQuery make → model index for offline FE fallback (optional).
 * Primary browse source remains car-service DB after `pnpm catalog:sync`.
 *
 * Usage:
 *   CARQUERY_API_URL=https://www.carqueryapi.com/api/0.3/ \
 *   OUTPUT_PATH=../../apps/client/data/catalog-browse-index.json \
 *   npx ts-node scripts/export-catalog-browse-index.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { slugify } from '../src/modules/catalog/engine-trim.utils';
import { carqueryFetchJson } from './carquery-client';

type ExportMake = {
  slug: string;
  name: string;
  models: Array<{ slug: string; name: string }>;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const apiUrl = process.env.CARQUERY_API_URL;
  if (!apiUrl) {
    throw new Error('CARQUERY_API_URL is required');
  }

  const outputPath =
    process.env.OUTPUT_PATH ||
    path.join(__dirname, '..', 'data', 'catalog-browse-index.json');
  const delayMs = Number(process.env.SYNC_DELAY_MS || '200');
  const makeLimit = Number(process.env.SYNC_MAKE_LIMIT || '0') || undefined;

  const makesRaw = await carqueryFetchJson(`${apiUrl}?cmd=getMakes`);
  const makes = (makesRaw.Makes || makesRaw.makes || []) as Array<Record<string, string>>;
  const slice = makeLimit ? makes.slice(0, makeLimit) : makes;

  const exportMakes: ExportMake[] = [];

  for (const make of slice) {
    const makeId = String(make.make_id ?? make.id ?? '');
    const makeName = String(make.make_display ?? make.name ?? makeId);
    if (!makeId) continue;

    const makeSlug = slugify(makeName) || makeId;
    await sleep(delayMs);

    const modelsRaw = await carqueryFetchJson(
      `${apiUrl}?cmd=getModels&make=${encodeURIComponent(makeId)}`,
    );
    const models = (modelsRaw.Models || modelsRaw.models || []) as Array<
      Record<string, string>
    >;

    exportMakes.push({
      slug: makeSlug,
      name: makeName,
      models: models.map((model) => {
        const modelName = String(model.model_name ?? model.name ?? '');
        const modelId = String(model.model_id ?? model.id ?? '');
        return {
          slug: slugify(modelName) || modelId,
          name: modelName,
        };
      }),
    });

    console.log(`  ✓ ${makeName} (${models.length} models)`);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    yearCutoff: 2004,
    makes: exportMakes.sort((a, b) => a.name.localeCompare(b.name)),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${exportMakes.length} makes → ${outputPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
