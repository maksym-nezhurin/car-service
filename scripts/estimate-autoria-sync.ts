#!/usr/bin/env npx ts-node
/**
 * Estimate AUTO.RIA API cost for PL sync plan (no API calls).
 *
 * Usage:
 *   pnpm catalog:estimate:autoria
 *   pnpm catalog:estimate:autoria structure
 *   pnpm catalog:estimate:autoria trims-pilot
 */
import {
  AUTORIA_PL_TRIM_PILOT,
  countPlPlan,
  estimatePlSyncRequests,
} from './catalog-autoria-pl-plan';

const phaseArg = (process.argv[2]?.trim().toLowerCase() || 'all') as
  | 'structure'
  | 'trims'
  | 'trims-pilot'
  | 'full'
  | 'all';

const phases: Array<'structure' | 'trims-pilot' | 'trims' | 'full'> =
  phaseArg === 'all'
    ? ['structure', 'trims-pilot', 'trims']
    : [phaseArg as 'structure' | 'trims-pilot' | 'trims' | 'full'];

const { makes, models } = countPlPlan();

console.log('AUTO.RIA PL sync — request estimate (live API, cache misses)\n');
console.log(`Plan: ${makes} makes, ${models} curated models (SYNC_PLAN=pl)\n`);

let cumulative = 0;
for (const phase of phases) {
  const est = estimatePlSyncRequests({ phase, avgGenerationsPerModel: 6 });
  cumulative += est.total;
  console.log(`Phase "${phase}":`);
  console.log(`  marks:          ${est.marks}`);
  console.log(`  model lists:    ${est.modelLists}`);
  console.log(`  generations:    ${est.generations}`);
  console.log(`  modifications:  ${est.modifications}`);
  console.log(`  subtotal:       ~${est.total} requests`);
  console.log(`  ${est.note}\n`);
}

if (phaseArg === 'all') {
  console.log(`Recommended month 1 (structure + trims-pilot + partial trims): ~${estimatePlSyncRequests({ phase: 'structure' }).total + estimatePlSyncRequests({ phase: 'trims-pilot' }).total}–450 req`);
  console.log(`Full PL plan with all trims (all ${models} models): ~${estimatePlSyncRequests({ phase: 'full' }).total} req (avg 6 gen/model)\n`);
}

console.log('Pilot trim models:', AUTORIA_PL_TRIM_PILOT.map((p) => `${p.makeSlug}/${p.modelSlug}`).join(', '));
console.log('\nLimits: ~30 live API calls/hour + ~1000/month. Default SYNC_HOURLY_MAX=25 when SYNC_PLAN=pl.');
console.log('Structure (~85 req) ≈ 4 hourly runs (25+25+25+10), not one session.');
console.log('\nResume hourly (same command):');
console.log('  SYNC_PLAN=pl SYNC_PHASE=structure SYNC_REQUEST_BUDGET=969 SYNC_DELAY_MS=800 pnpm catalog:sync:autoria');
