-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Aspiration" AS ENUM ('TURBO', 'ATMO', 'SUPERCHARGED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "catalog_engine_families" ADD COLUMN     "canonical_aspiration" "Aspiration",
ADD COLUMN     "canonical_fuel_type" "FuelType";

-- AlterTable
ALTER TABLE "catalog_engines" ADD COLUMN     "canonical_fuel_type" "FuelType";

-- AlterTable
ALTER TABLE "catalog_trims" ADD COLUMN     "canonical_fuel_type" "FuelType";

