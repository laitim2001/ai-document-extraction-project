-- Initialize database extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions (if needed)
GRANT ALL PRIVILEGES ON DATABASE ai_document_extraction TO postgres;

-- Log initialization
DO $$
BEGIN
  RAISE NOTICE 'Database initialization completed successfully';
END $$;
