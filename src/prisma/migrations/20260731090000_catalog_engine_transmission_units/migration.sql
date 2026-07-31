-- Engine / transmission units: concrete code + power variant inside a curated family.

CREATE TABLE IF NOT EXISTS "catalog_engines" (
  "id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "code" TEXT,
  "display_name" TEXT NOT NULL,
  "displacement_cc" INTEGER,
  "fuel_type" TEXT,
  "aspiration" TEXT,
  "power_hp" INTEGER,
  "power_kw" INTEGER,
  "torque_nm" INTEGER,
  "cylinders" INTEGER,
  "injection" TEXT,
  "euro_standard" TEXT,
  "year_from" INTEGER,
  "year_to" INTEGER,
  "specs_json" JSONB,
  "short_description" TEXT,
  "reliability_notes" TEXT,
  "review_status" TEXT NOT NULL DEFAULT 'approved',
  "reviewed_at" TIMESTAMP(3),
  "source" TEXT,
  "external_ref" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_engines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_engines_slug_key" ON "catalog_engines"("slug");
CREATE INDEX IF NOT EXISTS "catalog_engines_family_id_idx" ON "catalog_engines"("family_id");
CREATE INDEX IF NOT EXISTS "catalog_engines_code_idx" ON "catalog_engines"("code");

CREATE TABLE IF NOT EXISTS "catalog_transmissions" (
  "id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "code" TEXT,
  "display_name" TEXT NOT NULL,
  "type" TEXT,
  "gears" INTEGER,
  "drive" TEXT,
  "max_torque_nm" INTEGER,
  "year_from" INTEGER,
  "year_to" INTEGER,
  "specs_json" JSONB,
  "short_description" TEXT,
  "reliability_notes" TEXT,
  "review_status" TEXT NOT NULL DEFAULT 'approved',
  "reviewed_at" TIMESTAMP(3),
  "source" TEXT,
  "external_ref" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_transmissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_transmissions_slug_key" ON "catalog_transmissions"("slug");
CREATE INDEX IF NOT EXISTS "catalog_transmissions_family_id_idx" ON "catalog_transmissions"("family_id");
CREATE INDEX IF NOT EXISTS "catalog_transmissions_code_idx" ON "catalog_transmissions"("code");

ALTER TABLE "catalog_engines"
  ADD CONSTRAINT "catalog_engines_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "catalog_engine_families"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "catalog_transmissions"
  ADD CONSTRAINT "catalog_transmissions_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "catalog_transmission_families"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "catalog_trims" ADD COLUMN IF NOT EXISTS "engine_id" TEXT;
ALTER TABLE "catalog_trims" ADD COLUMN IF NOT EXISTS "transmission_id" TEXT;

CREATE INDEX IF NOT EXISTS "catalog_trims_engine_id_idx" ON "catalog_trims"("engine_id");
CREATE INDEX IF NOT EXISTS "catalog_trims_transmission_id_idx" ON "catalog_trims"("transmission_id");

ALTER TABLE "catalog_trims"
  ADD CONSTRAINT "catalog_trims_engine_id_fkey"
  FOREIGN KEY ("engine_id") REFERENCES "catalog_engines"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "catalog_trims"
  ADD CONSTRAINT "catalog_trims_transmission_id_fkey"
  FOREIGN KEY ("transmission_id") REFERENCES "catalog_transmissions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
