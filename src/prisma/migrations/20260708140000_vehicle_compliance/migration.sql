-- CreateEnum
CREATE TYPE "InsurancePolicyType" AS ENUM ('OC', 'AC');

-- CreateTable
CREATE TABLE "vehicle_technical_inspections" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "station_name" TEXT,
    "certificate_no" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_technical_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_insurance_policies" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "type" "InsurancePolicyType" NOT NULL,
    "insurer_name" TEXT NOT NULL,
    "policy_number" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "premium_amount" DECIMAL(12,2),
    "premium_currency" TEXT DEFAULT 'PLN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_technical_inspections_vehicle_id_key" ON "vehicle_technical_inspections"("vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_inspection_owner_idx" ON "vehicle_technical_inspections"("owner_user_id");

-- CreateIndex
CREATE INDEX "vehicle_insurance_vehicle_type_active_idx" ON "vehicle_insurance_policies"("vehicle_id", "type", "is_active");

-- AddForeignKey
ALTER TABLE "vehicle_technical_inspections" ADD CONSTRAINT "vehicle_technical_inspections_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_insurance_policies" ADD CONSTRAINT "vehicle_insurance_policies_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
