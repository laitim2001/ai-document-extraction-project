-- CreateEnum
CREATE TYPE "EscalationReason" AS ENUM ('UNKNOWN_FORWARDER', 'RULE_NOT_APPLICABLE', 'POOR_QUALITY', 'OTHER');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'ESCALATED';

-- CreateTable
CREATE TABLE "escalations" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "escalated_by" TEXT NOT NULL,
    "reason" "EscalationReason" NOT NULL,
    "reason_detail" TEXT,
    "status" "EscalationStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to" TEXT,
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escalations_document_id_key" ON "escalations"("document_id");

-- CreateIndex
CREATE INDEX "escalations_status_idx" ON "escalations"("status");

-- CreateIndex
CREATE INDEX "escalations_assigned_to_idx" ON "escalations"("assigned_to");

-- CreateIndex
CREATE INDEX "escalations_escalated_by_idx" ON "escalations"("escalated_by");

-- CreateIndex
CREATE INDEX "escalations_created_at_idx" ON "escalations"("created_at");

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_escalated_by_fkey" FOREIGN KEY ("escalated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
