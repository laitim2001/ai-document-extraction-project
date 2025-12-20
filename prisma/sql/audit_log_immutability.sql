-- ============================================================
-- Story 8-1: Audit Log Immutability Triggers
-- ============================================================
--
-- This SQL file creates PostgreSQL triggers to prevent
-- UPDATE and DELETE operations on the audit_logs table,
-- ensuring audit log immutability for compliance.
--
-- @since Epic 8 - Story 8.1
-- @lastModified 2025-12-20
-- ============================================================

-- ============================================================
-- Function: Prevent UPDATE on audit_logs
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the tampering attempt to security_logs
  INSERT INTO security_logs (
    id,
    user_id,
    event_type,
    severity,
    description,
    details,
    ip_address,
    created_at
  ) VALUES (
    gen_random_uuid(),
    COALESCE(current_setting('app.current_user_id', true), 'unknown'),
    'TAMPERING_ATTEMPT',
    'CRITICAL',
    'Attempted to modify audit log record',
    jsonb_build_object(
      'audit_log_id', OLD.id,
      'attempted_action', 'UPDATE',
      'attempted_at', NOW(),
      'user_id_attempted', OLD.user_id
    ),
    current_setting('app.current_ip', true),
    NOW()
  );

  -- Raise exception to prevent the update
  RAISE EXCEPTION 'Audit logs cannot be modified. This attempt has been logged.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: Prevent DELETE on audit_logs
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the tampering attempt to security_logs
  INSERT INTO security_logs (
    id,
    user_id,
    event_type,
    severity,
    description,
    details,
    ip_address,
    created_at
  ) VALUES (
    gen_random_uuid(),
    COALESCE(current_setting('app.current_user_id', true), 'unknown'),
    'TAMPERING_ATTEMPT',
    'CRITICAL',
    'Attempted to delete audit log record',
    jsonb_build_object(
      'audit_log_id', OLD.id,
      'attempted_action', 'DELETE',
      'attempted_at', NOW(),
      'user_id_affected', OLD.user_id,
      'action_affected', OLD.action
    ),
    current_setting('app.current_ip', true),
    NOW()
  );

  -- Raise exception to prevent the delete
  RAISE EXCEPTION 'Audit logs cannot be deleted. This attempt has been logged.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Trigger: Prevent UPDATE on audit_logs
-- ============================================================
DROP TRIGGER IF EXISTS audit_log_no_update ON audit_logs;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_update();

-- ============================================================
-- Trigger: Prevent DELETE on audit_logs
-- ============================================================
DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_logs;

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_delete();

-- ============================================================
-- Grant Permissions (Optional - adjust based on your setup)
-- ============================================================
-- Remove UPDATE and DELETE permissions for the application user
-- REVOKE UPDATE, DELETE ON audit_logs FROM app_user;
-- GRANT INSERT, SELECT ON audit_logs TO app_user;

-- ============================================================
-- Verification Query
-- ============================================================
-- Run this to verify triggers are created:
-- SELECT tgname, tgrelid::regclass, tgtype
-- FROM pg_trigger
-- WHERE tgrelid = 'audit_logs'::regclass;
