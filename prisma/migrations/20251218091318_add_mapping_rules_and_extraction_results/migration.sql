-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "mapping_rules" (
    "id" TEXT NOT NULL,
    "forwarder_id" TEXT,
    "field_name" TEXT NOT NULL,
    "field_label" TEXT NOT NULL,
    "extraction_pattern" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "validation_pattern" TEXT,
    "default_value" TEXT,
    "category" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapping_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_results" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "forwarder_id" TEXT,
    "field_mappings" JSONB NOT NULL,
    "total_fields" INTEGER NOT NULL,
    "mapped_fields" INTEGER NOT NULL,
    "unmapped_fields" INTEGER NOT NULL,
    "average_confidence" DOUBLE PRECISION NOT NULL,
    "processing_time" INTEGER,
    "rules_applied" INTEGER NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "unmapped_field_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mapping_rules_forwarder_id_idx" ON "mapping_rules"("forwarder_id");

-- CreateIndex
CREATE INDEX "mapping_rules_field_name_idx" ON "mapping_rules"("field_name");

-- CreateIndex
CREATE INDEX "mapping_rules_category_idx" ON "mapping_rules"("category");

-- CreateIndex
CREATE INDEX "mapping_rules_is_active_idx" ON "mapping_rules"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "mapping_rules_forwarder_id_field_name_key" ON "mapping_rules"("forwarder_id", "field_name");

-- CreateIndex
CREATE UNIQUE INDEX "extraction_results_document_id_key" ON "extraction_results"("document_id");

-- CreateIndex
CREATE INDEX "extraction_results_document_id_idx" ON "extraction_results"("document_id");

-- CreateIndex
CREATE INDEX "extraction_results_forwarder_id_idx" ON "extraction_results"("forwarder_id");

-- CreateIndex
CREATE INDEX "extraction_results_status_idx" ON "extraction_results"("status");

-- CreateIndex
CREATE INDEX "extraction_results_average_confidence_idx" ON "extraction_results"("average_confidence");

-- CreateIndex
CREATE INDEX "extraction_results_created_at_idx" ON "extraction_results"("created_at");

-- AddForeignKey
ALTER TABLE "mapping_rules" ADD CONSTRAINT "mapping_rules_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "forwarders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_results" ADD CONSTRAINT "extraction_results_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_results" ADD CONSTRAINT "extraction_results_forwarder_id_fkey" FOREIGN KEY ("forwarder_id") REFERENCES "forwarders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
