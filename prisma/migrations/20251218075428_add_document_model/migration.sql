-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADING', 'UPLOADED', 'OCR_PROCESSING', 'OCR_COMPLETED', 'OCR_FAILED', 'MAPPING_PROCESSING', 'MAPPING_COMPLETED', 'PENDING_REVIEW', 'IN_REVIEW', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProcessingPath" AS ENUM ('AUTO_APPROVE', 'QUICK_REVIEW', 'FULL_REVIEW', 'MANUAL_REQUIRED');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_extension" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "blob_name" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "error_message" TEXT,
    "processing_path" "ProcessingPath",
    "routing_decision" JSONB,
    "uploaded_by" TEXT NOT NULL,
    "city_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_uploaded_by_idx" ON "documents"("uploaded_by");

-- CreateIndex
CREATE INDEX "documents_city_code_idx" ON "documents"("city_code");

-- CreateIndex
CREATE INDEX "documents_created_at_idx" ON "documents"("created_at");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
