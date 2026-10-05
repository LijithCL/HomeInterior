-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('DOOR', 'WINDOW', 'FURNITURE', 'KITCHEN', 'BATHROOM', 'ELECTRICAL', 'DECORATION', 'EXTERIOR');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "defaultWidthMm" INTEGER NOT NULL,
    "defaultDepthMm" INTEGER NOT NULL,
    "defaultHeightMm" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_category_idx" ON "assets"("category");
