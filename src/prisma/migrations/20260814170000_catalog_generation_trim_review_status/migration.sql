-- Extend the reviewStatus gate (already on catalog_engine_families / catalog_engines /
-- catalog_transmission_families / catalog_transmissions) to catalog_generations and
-- catalog_trims, so the public catalog can hide a bad AUTO.RIA-derived generation/trim
-- without deleting it. Defaults to 'approved' so every existing row — and every row a
-- future catalog:sync:autoria run inserts, until an admin flow sets it otherwise —
-- keeps showing publicly exactly as it does today. See docs/V1_7_VEHICLE_ENCYCLOPEDIA.md
-- §12 open question #8.

ALTER TABLE "catalog_generations" ADD COLUMN IF NOT EXISTS "review_status" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "catalog_generations" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);

ALTER TABLE "catalog_trims" ADD COLUMN IF NOT EXISTS "review_status" TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE "catalog_trims" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);
