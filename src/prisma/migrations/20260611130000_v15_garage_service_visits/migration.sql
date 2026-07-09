-- CreateEnum
CREATE TYPE "VisitVerifiedBy" AS ENUM ('OWNER', 'PARTNER');

-- CreateEnum
CREATE TYPE "PartPurchasedBy" AS ENUM ('OWNER', 'WORKSHOP');

-- CreateTable
CREATE TABLE "garage_service_visits" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL,
    "odometer_km" INTEGER,
    "total_cost" DECIMAL(12,2),
    "cost_currency" TEXT DEFAULT 'PLN',
    "notes" TEXT,
    "organization_id" TEXT,
    "draft_company_id" TEXT,
    "provider_snapshot" JSONB NOT NULL,
    "verified_by" "VisitVerifiedBy" NOT NULL DEFAULT 'OWNER',
    "work_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garage_service_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_service_line_items" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "labor_cost" DECIMAL(12,2),
    "parts_cost" DECIMAL(12,2),
    "line_total" DECIMAL(12,2),

    CONSTRAINT "garage_service_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_service_parts" (
    "id" TEXT NOT NULL,
    "line_item_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purchased_by" "PartPurchasedBy" NOT NULL,
    "brand" TEXT,
    "product_url" TEXT,
    "part_number" TEXT,
    "cost" DECIMAL(12,2),

    CONSTRAINT "garage_service_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garage_service_visit_attachments" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "public_id" TEXT,
    "original_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "garage_service_visit_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "garage_visit_vehicle_date_idx" ON "garage_service_visits"("vehicle_id", "performed_at");

-- CreateIndex
CREATE INDEX "garage_visit_owner_idx" ON "garage_service_visits"("owner_user_id");

-- CreateIndex
CREATE INDEX "garage_line_item_visit_idx" ON "garage_service_line_items"("visit_id", "sort_order");

-- CreateIndex
CREATE INDEX "garage_part_line_item_idx" ON "garage_service_parts"("line_item_id");

-- CreateIndex
CREATE INDEX "garage_visit_attachment_visit_idx" ON "garage_service_visit_attachments"("visit_id");

-- AddForeignKey
ALTER TABLE "garage_service_visits" ADD CONSTRAINT "garage_service_visits_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_service_line_items" ADD CONSTRAINT "garage_service_line_items_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "garage_service_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_service_parts" ADD CONSTRAINT "garage_service_parts_line_item_id_fkey" FOREIGN KEY ("line_item_id") REFERENCES "garage_service_line_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_service_visit_attachments" ADD CONSTRAINT "garage_service_visit_attachments_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "garage_service_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
