-- AUT-15 step 1/3 — snake_case @@map/@map for the "epoch 1" legacy marketplace models
-- (Category/Ad/Attribute*/Media). Pure rename: table, column, constraint and index
-- identifiers only — no data change, no column type change. Prisma client property
-- names are driven by the model/field name in schema.prisma, not by the underlying
-- table/column name, so no application code (CarsService/CarsController/seed.ts) needs
-- to change. See docs/DATA_MODEL_STANDARDS.md §3.1, §7 step 2 and Linear AUT-15.
--
-- Constraint/index names below assume the default Prisma-generated names for these
-- tables (never overridden before this migration, since none of them had @@map/@map
-- until now) — verify against the target database before applying; if any name differs
-- (e.g. from a manual DB change outside Prisma), adjust the RENAME source name accordingly.

-- 1. Tables
ALTER TABLE "Category" RENAME TO "categories";
ALTER TABLE "Ad" RENAME TO "ads";
ALTER TABLE "Attribute" RENAME TO "attributes";
ALTER TABLE "AttributeOption" RENAME TO "attribute_options";
ALTER TABLE "AttributeValue" RENAME TO "attribute_values";
ALTER TABLE "Media" RENAME TO "media";

-- 2. Columns
ALTER TABLE "categories" RENAME COLUMN "parentId" TO "parent_id";

ALTER TABLE "ads" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "ads" RENAME COLUMN "categoryId" TO "category_id";
ALTER TABLE "ads" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "ads" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "ads" RENAME COLUMN "publishedAt" TO "published_at";

ALTER TABLE "attributes" RENAME COLUMN "categoryId" TO "category_id";

ALTER TABLE "attribute_options" RENAME COLUMN "attributeId" TO "attribute_id";

ALTER TABLE "attribute_values" RENAME COLUMN "adId" TO "ad_id";
ALTER TABLE "attribute_values" RENAME COLUMN "attributeId" TO "attribute_id";

ALTER TABLE "media" RENAME COLUMN "adId" TO "ad_id";

-- 3. Primary key constraints
ALTER TABLE "categories" RENAME CONSTRAINT "Category_pkey" TO "categories_pkey";
ALTER TABLE "ads" RENAME CONSTRAINT "Ad_pkey" TO "ads_pkey";
ALTER TABLE "attributes" RENAME CONSTRAINT "Attribute_pkey" TO "attributes_pkey";
ALTER TABLE "attribute_options" RENAME CONSTRAINT "AttributeOption_pkey" TO "attribute_options_pkey";
ALTER TABLE "attribute_values" RENAME CONSTRAINT "AttributeValue_pkey" TO "attribute_values_pkey";
ALTER TABLE "media" RENAME CONSTRAINT "Media_pkey" TO "media_pkey";

-- 4. Unique indexes (Prisma implements @unique/@@unique as CREATE UNIQUE INDEX, not a
-- table constraint — see e.g. catalog_makes_slug_key in 20260605120000_add_vehicle_catalog_mirror)
ALTER INDEX "Category_slug_key" RENAME TO "categories_slug_key";
-- The @@unique(..., name: "categoryId_name") / "attributeId_value" params in schema.prisma
-- are Prisma Client query aliases, not the actual DB object name — without an explicit
-- map:, Postgres still got Prisma's default compound-unique name. Confirmed via
-- pg_indexes against the live DB after this migration first failed on the wrong name.
ALTER INDEX "Attribute_categoryId_name_key" RENAME TO "attributes_category_id_name_key";
ALTER INDEX "AttributeOption_attributeId_value_key" RENAME TO "attribute_options_attribute_id_value_key";

-- 5. Foreign key constraints
ALTER TABLE "categories" RENAME CONSTRAINT "Category_parentId_fkey" TO "categories_parent_id_fkey";
ALTER TABLE "ads" RENAME CONSTRAINT "Ad_categoryId_fkey" TO "ads_category_id_fkey";
ALTER TABLE "attributes" RENAME CONSTRAINT "Attribute_categoryId_fkey" TO "attributes_category_id_fkey";
ALTER TABLE "attribute_options" RENAME CONSTRAINT "AttributeOption_attributeId_fkey" TO "attribute_options_attribute_id_fkey";
ALTER TABLE "attribute_values" RENAME CONSTRAINT "AttributeValue_adId_fkey" TO "attribute_values_ad_id_fkey";
ALTER TABLE "attribute_values" RENAME CONSTRAINT "AttributeValue_attributeId_fkey" TO "attribute_values_attribute_id_fkey";
ALTER TABLE "media" RENAME CONSTRAINT "Media_adId_fkey" TO "media_ad_id_fkey";
