-- v1.7 encyclopedia: support flags, Contentful content keys, trim transmission
ALTER TABLE "catalog_generations"
  ADD COLUMN "is_supported" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "support_tier" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "content_key" TEXT;

CREATE UNIQUE INDEX "catalog_generations_content_key_key" ON "catalog_generations"("content_key");

ALTER TABLE "catalog_trims"
  ADD COLUMN "transmission" TEXT;
