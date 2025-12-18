-- CreateTable
CREATE TABLE "ocr_results" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "raw_result" JSONB NOT NULL,
    "extracted_text" TEXT NOT NULL,
    "invoice_data" JSONB,
    "processing_time" INTEGER,
    "page_count" INTEGER,
    "confidence" DOUBLE PRECISION,
    "error_code" TEXT,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocr_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ocr_results_document_id_key" ON "ocr_results"("document_id");

-- CreateIndex
CREATE INDEX "ocr_results_created_at_idx" ON "ocr_results"("created_at");

-- AddForeignKey
ALTER TABLE "ocr_results" ADD CONSTRAINT "ocr_results_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
