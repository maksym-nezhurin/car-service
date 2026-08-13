#!/usr/bin/env npx ts-node
/**
 * Probe AUTO.RIA API — verify key + inspect taxonomy for a sample model.
 *
 * Usage (from services/car):
 *   pnpm catalog:probe:autoria
 *   pnpm catalog:probe:autoria hyundai tucson
 *
 * Env: AUTO_RIA_API_KEY in .env (never commit).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  autoriaListGenerationsByModel,
  autoriaListMarks,
  autoriaListModifications,
  autoriaListModels,
  autoriaListNewGenerations,
  autoriaListNewModels,
  dedupeMarksByEng,
  findByEngOrName,
  requireAutoriaApiKey,
} from './autoria-client';

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('.env');

async function main() {
  const makeNeedle = process.argv[2]?.toLowerCase() ?? 'hyundai';
  const modelNeedle = process.argv[3]?.toLowerCase() ?? 'tucson';

  requireAutoriaApiKey();
  console.log('AUTO.RIA probe — key OK (masked)\n');

  const rawMarks = await autoriaListMarks();
  const marks = dedupeMarksByEng(rawMarks);
  console.log(`Marks (category 1): ${rawMarks.length} raw → ${marks.length} unique by eng`);

  const make = findByEngOrName(marks, makeNeedle);
  if (!make) {
    console.error(`Make not found: ${makeNeedle}`);
    process.exit(1);
  }
  console.log(`\nMake: ${make.name} (id=${make.value}, eng=${make.eng})`);

  const models = await autoriaListModels(make.value);
  console.log(`Models: ${models.length}`);
  const model = findByEngOrName(models, modelNeedle);
  if (!model) {
    console.error(`Model not found: ${modelNeedle}`);
    console.log(
      'Sample models:',
      models.slice(0, 12).map((m) => `${m.name} (${m.eng ?? '?'})`).join(', '),
    );
    process.exit(1);
  }
  console.log(`Model: ${model.name} (id=${model.value}, eng=${model.eng ?? model.name})`);

  console.log('\n--- Used cars: generations ---');
  const usedGen = await autoriaListGenerationsByModel(model.value);
  console.log(JSON.stringify(usedGen, null, 2).slice(0, 2500));

  const firstGenId =
    usedGen[0]?.generations?.[0]?.generationId ??
    usedGen[0]?.generations?.[0]?.id;

  if (firstGenId) {
    console.log(`\n--- Used cars: modifications (generation ${firstGenId}) ---`);
    const mods = await autoriaListModifications(firstGenId);
    console.log(
      mods.slice(0, 8).map((m) => `${m.name} (${m.value})`).join('\n') ||
        '(empty — try body-specific endpoint later)',
    );
    if (mods.length > 8) console.log(`… +${mods.length - 8} more`);
  }

  console.log('\n--- New cars catalog: generations ---');
  const newModels = await autoriaListNewModels(make.value);
  const newModel = findByEngOrName(newModels, modelNeedle);
  if (newModel) {
    const newGen = await autoriaListNewGenerations(newModel.value);
    console.log(
      newGen.map((g) => `${g.name} (${g.year_from}–${g.year_to || '…'}) [${g.generation_id}]`).join('\n') ||
        '(none)',
    );
  } else {
    console.log('Model not in new-cars catalog API');
  }

  console.log('\n✓ Probe complete — safe to start sync-autoria-catalog.ts');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
