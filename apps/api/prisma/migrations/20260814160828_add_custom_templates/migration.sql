-- CreateTable
CREATE TABLE "custom_templates" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "document" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_templates_ownerId_idx" ON "custom_templates"("ownerId");

-- AddForeignKey
ALTER TABLE "custom_templates" ADD CONSTRAINT "custom_templates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
