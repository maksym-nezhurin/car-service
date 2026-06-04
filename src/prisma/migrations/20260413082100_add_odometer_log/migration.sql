-- CreateTable
CREATE TABLE "OdometerLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "mileageKm" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',

    CONSTRAINT "OdometerLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "odometer_vehicle_date_idx" ON "OdometerLog"("vehicleId", "recordedAt");

-- CreateIndex
CREATE INDEX "odometer_vehicle_mileage_idx" ON "OdometerLog"("vehicleId", "mileageKm");

-- AddForeignKey
ALTER TABLE "OdometerLog" ADD CONSTRAINT "OdometerLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
