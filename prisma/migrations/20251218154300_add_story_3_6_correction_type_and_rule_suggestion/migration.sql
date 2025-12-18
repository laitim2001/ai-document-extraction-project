-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('APPROVED', 'CORRECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "CorrectionType" AS ENUM ('NORMAL', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED');

-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'APPROVED';

-- CreateTable
CREATE TABLE "review_records" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "action" "ReviewAction" NOT NULL DEFAULT 'APPROVED',
    "reviewer_id" TEXT NOT NULL,
    "processing_path" "ProcessingPath" NOT NULL,
    "confirmed_fields" TEXT[],
    "modified_fields" JSONB,
    "notes" TEXT,
    "review_duration" INTEGER,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrections" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "original_value" TEXT,
    "corrected_value" TEXT NOT NULL,
    "correction_type" "CorrectionType" NOT NULL DEFAULT 'NORMAL',
    "exception_reason" TEXT,
    "corrected_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_suggestions" (
    "id" TEXT NOT NULL,
    "forwarder_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "suggested_pattern" TEXT NOT NULL,
    "correction_count" INTEGER NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "notes" TEXT,

    CONSTRAINT "rule_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_records_document_id_idx" ON "review_records"("document_id");

-- CreateIndex
CREATE INDEX "review_records_reviewer_id_idx" ON "review_records"("reviewer_id");

-- CreateIndex
CREATE INDEX "review_records_action_idx" ON "review_records"("action");

-- CreateIndex
CREATE INDEX "review_records_completed_at_idx" ON "review_records"("completed_at");

-- CreateIndex
CREATE INDEX "corrections_document_id_idx" ON "corrections"("document_id");

-- CreateIndex
CREATE INDEX "corrections_corrected_by_idx" ON "corrections"("corrected_by");

-- CreateIndex
CREATE INDEX "corrections_field_name_document_id_idx" ON "corrections"("field_name", "document_id");

-- CreateIndex
CREATE INDEX "corrections_correction_type_idx" ON "corrections"("correction_type");

-- CreateIndex
CREATE INDEX "rule_suggestions_forwarder_id_field_name_idx" ON "rule_suggestions"("forwarder_id", "field_name");

-- CreateIndex
CREATE INDEX "rule_suggestions_status_idx" ON "rule_suggestions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rule_suggestions_forwarder_id_field_name_suggested_pattern_key" ON "rule_suggestions"("forwarder_id", "field_name", "suggested_pattern");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- AddForeignKey
ALTER TABLE "review_records" ADD CONSTRAINT "review_records_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_records" ADD CONSTRAINT "review_records_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_corrected_by_fkey" FOREIGN KEY ("corrected_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_suggestions" ADD CONSTRAINT "rule_suggestions_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "forwarders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_suggestions" ADD CONSTRAINT "rule_suggestions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
