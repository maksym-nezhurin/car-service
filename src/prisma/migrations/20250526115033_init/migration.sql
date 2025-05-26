-- CreateTable
CREATE TABLE "Car" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "complectation" TEXT NOT NULL,
    "engine" DOUBLE PRECISION NOT NULL,
    "model" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "year" INTEGER NOT NULL,
    "mileage" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT,
    "images" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);
