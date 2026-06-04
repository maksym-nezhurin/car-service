-- CreateEnum
CREATE TYPE "VehicleProfileTier" AS ENUM ('PUBLIC', 'OWNER', 'PAID');

-- CreateEnum
CREATE TYPE "VehicleReportStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "VehicleReport" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tier" "VehicleProfileTier" NOT NULL DEFAULT 'PUBLIC',
    "status" "VehicleReportStatus" NOT NULL DEFAULT 'PENDING',
    "summary" JSONB,
    "rawPayload" JSONB,
    "fetchedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleReportAccessGrant" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessLevel" "VehicleProfileTier" NOT NULL DEFAULT 'PAID',
    "source" TEXT NOT NULL DEFAULT 'purchase',
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleReportAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleProfileViewLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "viewerUserId" TEXT,
    "requestedTier" "VehicleProfileTier" NOT NULL DEFAULT 'PUBLIC',
    "resolvedTier" "VehicleProfileTier" NOT NULL DEFAULT 'PUBLIC',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleProfileViewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_report_lookup_idx" ON "VehicleReport"("vehicleId", "provider", "tier");

-- CreateIndex
CREATE INDEX "vehicle_report_access_lookup_idx" ON "VehicleReportAccessGrant"("vehicleId", "userId", "provider");

-- CreateIndex
CREATE INDEX "vehicle_profile_view_log_idx" ON "VehicleProfileViewLog"("vehicleId", "createdAt");

-- AddForeignKey
ALTER TABLE "VehicleReport" ADD CONSTRAINT "VehicleReport_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReportAccessGrant" ADD CONSTRAINT "VehicleReportAccessGrant_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleProfileViewLog" ADD CONSTRAINT "VehicleProfileViewLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
