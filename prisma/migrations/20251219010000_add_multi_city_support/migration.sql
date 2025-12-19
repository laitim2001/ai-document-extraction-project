-- Story 6.1: City Data Model and RLS Configuration
-- This migration adds multi-city support with Row Level Security

-- ============================================
-- 1. Create Enums
-- ============================================
CREATE TYPE "RegionStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');
CREATE TYPE "AccessLevel" AS ENUM ('READ_ONLY', 'FULL');

-- ============================================
-- 2. Create regions table
-- ============================================
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "RegionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "regions_code_key" ON "regions"("code");
CREATE INDEX "regions_parent_id_idx" ON "regions"("parent_id");
CREATE INDEX "regions_status_idx" ON "regions"("status");

-- Self-referential foreign key for region hierarchy
ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "regions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 3. Update cities table (if exists, add new columns)
-- ============================================
-- Add region_id column to cities
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "region_id" TEXT;
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en-US';
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "status" "CityStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "config" JSONB;

-- Add indexes for cities
CREATE INDEX IF NOT EXISTS "cities_region_id_idx" ON "cities"("region_id");
CREATE INDEX IF NOT EXISTS "cities_status_idx" ON "cities"("status");
CREATE INDEX IF NOT EXISTS "cities_code_idx" ON "cities"("code");

-- Add foreign key constraint for region_id (after we have regions)
ALTER TABLE "cities" ADD CONSTRAINT "cities_region_id_fkey"
    FOREIGN KEY ("region_id") REFERENCES "regions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 4. Create user_city_access table
-- ============================================
CREATE TABLE "user_city_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "access_level" "AccessLevel" NOT NULL DEFAULT 'FULL',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "granted_by" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "user_city_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_city_access_user_id_city_id_key" ON "user_city_access"("user_id", "city_id");
CREATE INDEX "user_city_access_user_id_idx" ON "user_city_access"("user_id");
CREATE INDEX "user_city_access_city_id_idx" ON "user_city_access"("city_id");
CREATE INDEX "user_city_access_expires_at_idx" ON "user_city_access"("expires_at");

-- Add foreign key constraints
ALTER TABLE "user_city_access" ADD CONSTRAINT "user_city_access_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_city_access" ADD CONSTRAINT "user_city_access_city_id_fkey"
    FOREIGN KEY ("city_id") REFERENCES "cities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_city_access" ADD CONSTRAINT "user_city_access_granted_by_fkey"
    FOREIGN KEY ("granted_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 5. Add columns to users table
-- ============================================
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_global_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_regional_manager" BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- 6. Add city_code to documents table
-- ============================================
-- First, add as nullable to allow existing records
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "city_code" TEXT;

-- Add foreign key constraint
ALTER TABLE "documents" ADD CONSTRAINT "documents_city_code_fkey"
    FOREIGN KEY ("city_code") REFERENCES "cities"("code")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add index
CREATE INDEX IF NOT EXISTS "documents_city_code_idx" ON "documents"("city_code");

-- ============================================
-- 7. Add city_code to audit_logs table
-- ============================================
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "city_code" TEXT;

-- Add foreign key constraint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_city_code_fkey"
    FOREIGN KEY ("city_code") REFERENCES "cities"("code")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index
CREATE INDEX IF NOT EXISTS "audit_logs_city_code_idx" ON "audit_logs"("city_code");

-- ============================================
-- 8. Add city_code to processing_queues table
-- ============================================
ALTER TABLE "processing_queues" ADD COLUMN IF NOT EXISTS "city_code" TEXT;

-- Add index
CREATE INDEX IF NOT EXISTS "processing_queues_city_code_idx" ON "processing_queues"("city_code");

-- ============================================
-- 9. Enable Row Level Security (RLS)
-- ============================================

-- Enable RLS on business tables
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "processing_queues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extraction_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "corrections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "escalations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners too (important for security)
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
ALTER TABLE "processing_queues" FORCE ROW LEVEL SECURITY;
ALTER TABLE "extraction_results" FORCE ROW LEVEL SECURITY;
ALTER TABLE "corrections" FORCE ROW LEVEL SECURITY;
ALTER TABLE "escalations" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

-- ============================================
-- 10. Create RLS helper function
-- ============================================
CREATE OR REPLACE FUNCTION user_has_city_access(check_city_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    is_admin BOOLEAN;
    user_cities TEXT[];
BEGIN
    -- Get session variables
    is_admin := COALESCE(
        current_setting('app.is_global_admin', true)::BOOLEAN,
        false
    );

    -- Global admin bypasses all restrictions
    IF is_admin THEN
        RETURN true;
    END IF;

    -- Get user's authorized city codes
    user_cities := string_to_array(
        COALESCE(current_setting('app.user_city_codes', true), ''),
        ','
    );

    -- Check if city is in user's authorized list
    RETURN check_city_code = ANY(user_cities);
EXCEPTION
    WHEN OTHERS THEN
        -- Fail closed on any error
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 11. Create RLS policies for documents
-- ============================================
CREATE POLICY documents_city_isolation_select ON "documents"
    FOR SELECT
    USING (user_has_city_access(city_code) OR city_code IS NULL);

CREATE POLICY documents_city_isolation_insert ON "documents"
    FOR INSERT
    WITH CHECK (user_has_city_access(city_code) OR city_code IS NULL);

CREATE POLICY documents_city_isolation_update ON "documents"
    FOR UPDATE
    USING (user_has_city_access(city_code) OR city_code IS NULL)
    WITH CHECK (user_has_city_access(city_code) OR city_code IS NULL);

CREATE POLICY documents_city_isolation_delete ON "documents"
    FOR DELETE
    USING (user_has_city_access(city_code) OR city_code IS NULL);

-- ============================================
-- 12. Create RLS policies for processing_queues
-- ============================================
CREATE POLICY processing_queue_city_isolation ON "processing_queues"
    FOR ALL
    USING (user_has_city_access(city_code) OR city_code IS NULL)
    WITH CHECK (user_has_city_access(city_code) OR city_code IS NULL);

-- ============================================
-- 13. Create RLS policies for extraction_results
-- (via document relationship)
-- ============================================
CREATE POLICY extraction_results_city_isolation ON "extraction_results"
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM "documents" d
            WHERE d.id = extraction_results.document_id
            AND (user_has_city_access(d.city_code) OR d.city_code IS NULL)
        )
    );

-- ============================================
-- 14. Create RLS policies for corrections
-- (via document relationship)
-- ============================================
CREATE POLICY corrections_city_isolation ON "corrections"
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM "documents" d
            WHERE d.id = corrections.document_id
            AND (user_has_city_access(d.city_code) OR d.city_code IS NULL)
        )
    );

-- ============================================
-- 15. Create RLS policies for escalations
-- (via document relationship)
-- ============================================
CREATE POLICY escalations_city_isolation ON "escalations"
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM "documents" d
            WHERE d.id = escalations.document_id
            AND (user_has_city_access(d.city_code) OR d.city_code IS NULL)
        )
    );

-- ============================================
-- 16. Create RLS policies for audit_logs
-- ============================================
CREATE POLICY audit_logs_city_isolation ON "audit_logs"
    FOR ALL
    USING (
        city_code IS NULL  -- Global logs visible to all
        OR user_has_city_access(city_code)
    );

-- ============================================
-- 17. Create composite indexes for common queries
-- ============================================
-- Note: Removed CONCURRENTLY as it cannot run inside a transaction block
CREATE INDEX IF NOT EXISTS idx_documents_city_status ON "documents"("city_code", "status");
CREATE INDEX IF NOT EXISTS idx_documents_city_created ON "documents"("city_code", "created_at" DESC);
CREATE INDEX IF NOT EXISTS idx_processing_queue_city_status ON "processing_queues"("city_code", "status");
CREATE INDEX IF NOT EXISTS idx_audit_logs_city_created ON "audit_logs"("city_code", "created_at" DESC);

-- Partial indexes for active records only
-- Note: Changed to simple index as CURRENT_TIMESTAMP is not IMMUTABLE for partial indexes
CREATE INDEX IF NOT EXISTS idx_user_city_access_active
    ON "user_city_access"("user_id", "city_id")
    WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cities_active
    ON "cities"("code")
    WHERE status = 'ACTIVE';
