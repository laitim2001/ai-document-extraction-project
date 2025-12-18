-- CreateEnum
CREATE TYPE "IdentificationStatus" AS ENUM ('PENDING', 'IDENTIFIED', 'NEEDS_REVIEW', 'UNIDENTIFIED', 'FAILED');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "forwarder_id" TEXT;

-- CreateTable
CREATE TABLE "forwarders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "identification_patterns" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forwarders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forwarder_identifications" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "forwarder_id" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "match_method" TEXT NOT NULL,
    "matched_patterns" TEXT[],
    "match_details" JSONB,
    "is_auto_matched" BOOLEAN NOT NULL DEFAULT true,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "manual_assigned_by" TEXT,
    "manual_assigned_at" TIMESTAMP(3),
    "status" "IdentificationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forwarder_identifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forwarders_name_key" ON "forwarders"("name");

-- CreateIndex
CREATE UNIQUE INDEX "forwarders_code_key" ON "forwarders"("code");

-- CreateIndex
CREATE INDEX "forwarders_code_idx" ON "forwarders"("code");

-- CreateIndex
CREATE INDEX "forwarders_is_active_idx" ON "forwarders"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "forwarder_identifications_document_id_key" ON "forwarder_identifications"("document_id");

-- CreateIndex
CREATE INDEX "forwarder_identifications_document_id_idx" ON "forwarder_identifications"("document_id");

-- CreateIndex
CREATE INDEX "forwarder_identifications_forwarder_id_idx" ON "forwarder_identifications"("forwarder_id");

-- CreateIndex
CREATE INDEX "forwarder_identifications_status_idx" ON "forwarder_identifications"("status");

-- CreateIndex
CREATE INDEX "forwarder_identifications_confidence_idx" ON "forwarder_identifications"("confidence");

-- CreateIndex
CREATE INDEX "documents_forwarder_id_idx" ON "documents"("forwarder_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "forwarders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwarder_identifications" ADD CONSTRAINT "forwarder_identifications_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwarder_identifications" ADD CONSTRAINT "forwarder_identifications_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "forwarders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forwarder_identifications" ADD CONSTRAINT "forwarder_identifications_manual_assigned_by_fkey" FOREIGN KEY ("manual_assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
