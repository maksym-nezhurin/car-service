-- Engine metadata on catalog trims (VARIANT = engine, not trim package name).
ALTER TABLE "catalog_trims" ADD COLUMN IF NOT EXISTS "power_hp" INTEGER;
ALTER TABLE "catalog_trims" ADD COLUMN IF NOT EXISTS "aspiration" VARCHAR(32);
