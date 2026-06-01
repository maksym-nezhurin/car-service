-- AlterTable
ALTER TABLE "VehicleOwnership" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ownership_owner_primary_idx" ON "VehicleOwnership"("ownerUserId", "isPrimary");

-- At most one primary per user among current ownerships (partial unique)
CREATE UNIQUE INDEX "ownership_owner_one_primary_idx"
ON "VehicleOwnership"("ownerUserId")
WHERE "isCurrent" = true AND "isPrimary" = true;
