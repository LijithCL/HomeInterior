-- CreateEnum
CREATE TYPE "RenderTier" AS ENUM ('PREVIEW', 'HQ');

-- CreateEnum
CREATE TYPE "RenderStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "render_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "tier" "RenderTier" NOT NULL,
    "status" "RenderStatus" NOT NULL DEFAULT 'QUEUED',
    "outputKey" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "render_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "render_jobs_projectId_idx" ON "render_jobs"("projectId");
