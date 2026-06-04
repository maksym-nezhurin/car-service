-- CreateTable
CREATE TABLE "catalog_makes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_makes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_models" (
    "id" TEXT NOT NULL,
    "make_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_generations" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "external_model_id" TEXT,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "year_from" INTEGER,
    "year_to" INTEGER,
    "cover_image_url" TEXT,
    "short_description" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_trims" (
    "id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "model_year" INTEGER,
    "engine" TEXT,
    "fuel_type" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_trims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_makes_slug_key" ON "catalog_makes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_models_make_id_slug_key" ON "catalog_models"("make_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_generations_model_id_slug_key" ON "catalog_generations"("model_id", "slug");

-- CreateIndex
CREATE INDEX "catalog_generations_external_model_id_idx" ON "catalog_generations"("external_model_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_trims_generation_id_slug_key" ON "catalog_trims"("generation_id", "slug");

-- AddForeignKey
ALTER TABLE "catalog_models" ADD CONSTRAINT "catalog_models_make_id_fkey" FOREIGN KEY ("make_id") REFERENCES "catalog_makes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_generations" ADD CONSTRAINT "catalog_generations_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "catalog_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_trims" ADD CONSTRAINT "catalog_trims_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "catalog_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
