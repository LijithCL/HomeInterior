-- CreateEnum
CREATE TYPE "AiRequestType" AS ENUM ('FULL_GENERATION', 'SCOPED_EDIT', 'IMAGE_TO_DESIGN');

-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('PENDING', 'PROPOSED', 'APPLIED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "type" "AiRequestType" NOT NULL,
    "status" "AiRequestStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT,
    "inputImageKey" TEXT,
    "baseDocument" JSONB NOT NULL,
    "proposedDocument" JSONB,
    "summary" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_requests_projectId_idx" ON "ai_requests"("projectId");
