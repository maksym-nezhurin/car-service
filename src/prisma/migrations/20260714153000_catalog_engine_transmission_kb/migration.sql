-- Phase C: engine / transmission knowledge base families + trim links

CREATE TABLE "catalog_engine_families" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "displacement_cc" INTEGER,
    "fuel_type" TEXT,
    "aspiration" TEXT,
    "engine_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specs_json" JSONB,
    "short_description" TEXT,
    "review_status" TEXT NOT NULL DEFAULT 'approved',
    "reviewed_at" TIMESTAMP(3),
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_engine_families_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalog_engine_families_slug_key" ON "catalog_engine_families"("slug");

CREATE TABLE "catalog_transmission_families" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "type" TEXT,
    "gears" INTEGER,
    "manufacturer" TEXT,
    "specs_json" JSONB,
    "short_description" TEXT,
    "review_status" TEXT NOT NULL DEFAULT 'approved',
    "reviewed_at" TIMESTAMP(3),
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_transmission_families_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalog_transmission_families_slug_key" ON "catalog_transmission_families"("slug");

ALTER TABLE "catalog_trims" ADD COLUMN IF NOT EXISTS "engine_code" TEXT;
ALTER TABLE "catalog_trims" ADD COLUMN IF NOT EXISTS "displacement_cc" INTEGER;
ALTER TABLE "catalog_trims" ADD COLUMN IF NOT EXISTS "content_key" TEXT;
ALTER TABLE "catalog_trims" ADD COLUMN IF NOT EXISTS "engine_family_id" TEXT;
ALTER TABLE "catalog_trims" ADD COLUMN IF NOT EXISTS "transmission_family_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_trims_content_key_key" ON "catalog_trims"("content_key");
CREATE INDEX IF NOT EXISTS "catalog_trims_engine_family_id_idx" ON "catalog_trims"("engine_family_id");
CREATE INDEX IF NOT EXISTS "catalog_trims_transmission_family_id_idx" ON "catalog_trims"("transmission_family_id");

ALTER TABLE "catalog_trims" DROP CONSTRAINT IF EXISTS "catalog_trims_engine_family_id_fkey";
ALTER TABLE "catalog_trims" ADD CONSTRAINT "catalog_trims_engine_family_id_fkey"
    FOREIGN KEY ("engine_family_id") REFERENCES "catalog_engine_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "catalog_trims" DROP CONSTRAINT IF EXISTS "catalog_trims_transmission_family_id_fkey";
ALTER TABLE "catalog_trims" ADD CONSTRAINT "catalog_trims_transmission_family_id_fkey"
    FOREIGN KEY ("transmission_family_id") REFERENCES "catalog_transmission_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;
