-- AlterEnum
ALTER TYPE "PlanTier" ADD VALUE 'ULTIMATE';

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "trialUsed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "defaultUnit" TEXT;
