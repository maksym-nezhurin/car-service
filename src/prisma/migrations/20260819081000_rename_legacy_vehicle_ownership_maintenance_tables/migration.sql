-- AUT-15 step 2/3 — snake_case @@map/@map for the Vehicle + ownership/maintenance
-- "epoch 1" models: Vehicle, VehiclePhoto, OdometerLog, VehicleOwnership,
-- MaintenanceRecord, MaintenanceAttachment. Pure rename — no data change, no column
-- type change. Explicitly-named indexes (e.g. "vehicle_brand_model_variant_idx",
-- "odometer_vehicle_date_idx") already follow the snake_case convention and are left
-- untouched — Postgres tracks the underlying column rename automatically without
-- needing the index object itself renamed. See docs/DATA_MODEL_STANDARDS.md §3.1,
-- §7 step 2 and Linear AUT-15.
--
-- Constraint/index names below assume the default Prisma-generated names for these
-- tables (never overridden before this migration) — verify against the target database
-- before applying.

-- 1. Tables
ALTER TABLE "Vehicle" RENAME TO "vehicles";
ALTER TABLE "VehiclePhoto" RENAME TO "vehicle_photos";
ALTER TABLE "OdometerLog" RENAME TO "odometer_logs";
ALTER TABLE "VehicleOwnership" RENAME TO "vehicle_ownerships";
ALTER TABLE "MaintenanceRecord" RENAME TO "maintenance_records";
ALTER TABLE "MaintenanceAttachment" RENAME TO "maintenance_attachments";

-- 2. Columns
ALTER TABLE "vehicles" RENAME COLUMN "plateNumber" TO "plate_number";
ALTER TABLE "vehicles" RENAME COLUMN "brandId" TO "brand_id";
ALTER TABLE "vehicles" RENAME COLUMN "modelId" TO "model_id";
ALTER TABLE "vehicles" RENAME COLUMN "variantId" TO "variant_id";
ALTER TABLE "vehicles" RENAME COLUMN "vehicleType" TO "vehicle_type";
ALTER TABLE "vehicles" RENAME COLUMN "fuelType" TO "fuel_type";
ALTER TABLE "vehicles" RENAME COLUMN "currentMileageKm" TO "current_mileage_km";
ALTER TABLE "vehicles" RENAME COLUMN "countryCode" TO "country_code";
ALTER TABLE "vehicles" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "vehicles" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "vehicle_photos" RENAME COLUMN "vehicleId" TO "vehicle_id";
ALTER TABLE "vehicle_photos" RENAME COLUMN "ownerUserId" TO "owner_user_id";
ALTER TABLE "vehicle_photos" RENAME COLUMN "publicId" TO "public_id";
ALTER TABLE "vehicle_photos" RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "odometer_logs" RENAME COLUMN "vehicleId" TO "vehicle_id";
ALTER TABLE "odometer_logs" RENAME COLUMN "ownerUserId" TO "owner_user_id";
ALTER TABLE "odometer_logs" RENAME COLUMN "mileageKm" TO "mileage_km";
ALTER TABLE "odometer_logs" RENAME COLUMN "recordedAt" TO "recorded_at";

ALTER TABLE "vehicle_ownerships" RENAME COLUMN "vehicleId" TO "vehicle_id";
ALTER TABLE "vehicle_ownerships" RENAME COLUMN "ownerUserId" TO "owner_user_id";
ALTER TABLE "vehicle_ownerships" RENAME COLUMN "cloudFolder" TO "cloud_folder";
ALTER TABLE "vehicle_ownerships" RENAME COLUMN "startedAt" TO "started_at";
ALTER TABLE "vehicle_ownerships" RENAME COLUMN "endedAt" TO "ended_at";
ALTER TABLE "vehicle_ownerships" RENAME COLUMN "isCurrent" TO "is_current";
ALTER TABLE "vehicle_ownerships" RENAME COLUMN "isPrimary" TO "is_primary";
ALTER TABLE "vehicle_ownerships" RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "maintenance_records" RENAME COLUMN "vehicleId" TO "vehicle_id";
ALTER TABLE "maintenance_records" RENAME COLUMN "ownerUserId" TO "owner_user_id";
ALTER TABLE "maintenance_records" RENAME COLUMN "mileageKm" TO "mileage_km";
ALTER TABLE "maintenance_records" RENAME COLUMN "performedAt" TO "performed_at";
ALTER TABLE "maintenance_records" RENAME COLUMN "costAmount" TO "cost_amount";
ALTER TABLE "maintenance_records" RENAME COLUMN "costCurrency" TO "cost_currency";
ALTER TABLE "maintenance_records" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "maintenance_records" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "maintenance_attachments" RENAME COLUMN "maintenanceRecordId" TO "maintenance_record_id";
ALTER TABLE "maintenance_attachments" RENAME COLUMN "ownerUserId" TO "owner_user_id";
ALTER TABLE "maintenance_attachments" RENAME COLUMN "publicId" TO "public_id";
ALTER TABLE "maintenance_attachments" RENAME COLUMN "originalName" TO "original_name";
ALTER TABLE "maintenance_attachments" RENAME COLUMN "mimeType" TO "mime_type";
ALTER TABLE "maintenance_attachments" RENAME COLUMN "sizeBytes" TO "size_bytes";
ALTER TABLE "maintenance_attachments" RENAME COLUMN "createdAt" TO "created_at";

-- 3. Primary key constraints
ALTER TABLE "vehicles" RENAME CONSTRAINT "Vehicle_pkey" TO "vehicles_pkey";
ALTER TABLE "vehicle_photos" RENAME CONSTRAINT "VehiclePhoto_pkey" TO "vehicle_photos_pkey";
ALTER TABLE "odometer_logs" RENAME CONSTRAINT "OdometerLog_pkey" TO "odometer_logs_pkey";
ALTER TABLE "vehicle_ownerships" RENAME CONSTRAINT "VehicleOwnership_pkey" TO "vehicle_ownerships_pkey";
ALTER TABLE "maintenance_records" RENAME CONSTRAINT "MaintenanceRecord_pkey" TO "maintenance_records_pkey";
ALTER TABLE "maintenance_attachments" RENAME CONSTRAINT "MaintenanceAttachment_pkey" TO "maintenance_attachments_pkey";

-- 4. Unique indexes
ALTER INDEX "Vehicle_vin_key" RENAME TO "vehicles_vin_key";

-- 5. Foreign key constraints
ALTER TABLE "vehicle_photos" RENAME CONSTRAINT "VehiclePhoto_vehicleId_fkey" TO "vehicle_photos_vehicle_id_fkey";
ALTER TABLE "odometer_logs" RENAME CONSTRAINT "OdometerLog_vehicleId_fkey" TO "odometer_logs_vehicle_id_fkey";
ALTER TABLE "vehicle_ownerships" RENAME CONSTRAINT "VehicleOwnership_vehicleId_fkey" TO "vehicle_ownerships_vehicle_id_fkey";
ALTER TABLE "maintenance_records" RENAME CONSTRAINT "MaintenanceRecord_vehicleId_fkey" TO "maintenance_records_vehicle_id_fkey";
ALTER TABLE "maintenance_attachments" RENAME CONSTRAINT "MaintenanceAttachment_maintenanceRecordId_fkey" TO "maintenance_attachments_maintenance_record_id_fkey";
