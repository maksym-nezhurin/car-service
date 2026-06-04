-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('ENGINE_OIL', 'OIL_FILTER', 'AIR_FILTER', 'CABIN_FILTER', 'SPARK_PLUGS', 'BRAKE_PADS', 'BRAKE_FLUID', 'COOLANT', 'TIMING_BELT', 'TIRE_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "RegistrationEventType" AS ENUM ('REGISTERED', 'DEREGISTERED', 'OWNERSHIP_CHANGED', 'IMPORTED', 'EXPORTED', 'OTHER');

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "year" INTEGER,
    "plateNumber" TEXT,
    "brandId" TEXT,
    "modelId" TEXT,
    "variantId" TEXT,
    "currentMileageKm" INTEGER,
    "countryCode" TEXT DEFAULT 'PL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleOwnership" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "mileageKm" INTEGER NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "costAmount" DECIMAL(12,2),
    "costCurrency" TEXT DEFAULT 'PLN',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleRegistrationEvent" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "eventType" "RegistrationEventType" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "countryCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleRegistrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleSaleContract" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "buyerUserId" TEXT,
    "sellerSnapshot" JSONB NOT NULL,
    "buyerSnapshot" JSONB NOT NULL,
    "salePriceAmount" DECIMAL(12,2),
    "salePriceCurrency" TEXT DEFAULT 'PLN',
    "contractDate" TIMESTAMP(3) NOT NULL,
    "generatedText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleSaleContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");

-- CreateIndex
CREATE INDEX "vehicle_brand_model_variant_idx" ON "Vehicle"("brandId", "modelId", "variantId");

-- CreateIndex
CREATE INDEX "ownership_owner_current_idx" ON "VehicleOwnership"("ownerUserId", "isCurrent");

-- CreateIndex
CREATE INDEX "ownership_vehicle_current_idx" ON "VehicleOwnership"("vehicleId", "isCurrent");

-- CreateIndex
CREATE INDEX "maintenance_vehicle_mileage_idx" ON "MaintenanceRecord"("vehicleId", "mileageKm");

-- CreateIndex
CREATE INDEX "maintenance_vehicle_date_idx" ON "MaintenanceRecord"("vehicleId", "performedAt");

-- CreateIndex
CREATE INDEX "vehicle_registration_event_idx" ON "VehicleRegistrationEvent"("vehicleId", "eventDate");

-- CreateIndex
CREATE INDEX "vehicle_sale_contract_idx" ON "VehicleSaleContract"("vehicleId", "contractDate");

-- AddForeignKey
ALTER TABLE "VehicleOwnership" ADD CONSTRAINT "VehicleOwnership_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleRegistrationEvent" ADD CONSTRAINT "VehicleRegistrationEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleSaleContract" ADD CONSTRAINT "VehicleSaleContract_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
