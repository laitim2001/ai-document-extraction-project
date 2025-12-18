-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED');

-- AlterTable
ALTER TABLE "extraction_results" ADD COLUMN     "confidence_scores" JSONB;

-- CreateTable
CREATE TABLE "field_correction_history" (
    "id" TEXT NOT NULL,
    "forwarder_id" TEXT,
    "field_name" TEXT NOT NULL,
    "total_extractions" INTEGER NOT NULL DEFAULT 0,
    "correct_extractions" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_correction_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_queues" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "processing_path" "ProcessingPath" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "routing_reason" TEXT,
    "assigned_to" TEXT,
    "assigned_at" TIMESTAMP(3),
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "fields_reviewed" INTEGER,
    "fields_modified" INTEGER,
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_queues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_correction_history_forwarder_id_idx" ON "field_correction_history"("forwarder_id");

-- CreateIndex
CREATE INDEX "field_correction_history_field_name_idx" ON "field_correction_history"("field_name");

-- CreateIndex
CREATE INDEX "field_correction_history_period_start_idx" ON "field_correction_history"("period_start");

-- CreateIndex
CREATE UNIQUE INDEX "field_correction_history_forwarder_id_field_name_period_sta_key" ON "field_correction_history"("forwarder_id", "field_name", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "processing_queues_document_id_key" ON "processing_queues"("document_id");

-- CreateIndex
CREATE INDEX "processing_queues_processing_path_status_idx" ON "processing_queues"("processing_path", "status");

-- CreateIndex
CREATE INDEX "processing_queues_assigned_to_status_idx" ON "processing_queues"("assigned_to", "status");

-- CreateIndex
CREATE INDEX "processing_queues_priority_entered_at_idx" ON "processing_queues"("priority", "entered_at");

-- AddForeignKey
ALTER TABLE "field_correction_history" ADD CONSTRAINT "field_correction_history_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "forwarders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_queues" ADD CONSTRAINT "processing_queues_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_queues" ADD CONSTRAINT "processing_queues_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
