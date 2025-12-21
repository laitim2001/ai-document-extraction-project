/**
 * @fileoverview Health Monitoring Types
 * @description
 *   Type definitions for system health monitoring including:
 *   - Service health check results
 *   - Overall system status
 *   - Service availability metrics
 *   - API request/response types
 *
 * @module src/types/monitoring
 * @since Epic 12 - Story 12-1
 * @lastModified 2025-12-21
 */

import { ServiceType, HealthStatus } from '@prisma/client';

// ============================================================
// Service Configuration Types
// ============================================================

/**
 * Service health check configuration
 */
export interface ServiceConfig {
  /** Service identifier */
  name: string;
  /** Service type from Prisma enum */
  type: ServiceType;
  /** Health check endpoint or identifier */
  endpoint: string;
  /** Check timeout in milliseconds */
  timeout: number;
  /** Check interval in milliseconds */
  checkInterval: number;
}

// ============================================================
// Health Check Result Types
// ============================================================

/**
 * Single service health check result
 */
export interface ServiceHealthResult {
  /** Service name identifier */
  serviceName: string;
  /** Service type */
  serviceType: ServiceType;
  /** Current health status */
  status: HealthStatus;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Error message if unhealthy */
  errorMessage?: string;
  /** Error code if applicable */
  errorCode?: string;
  /** Additional check details */
  details?: Record<string, unknown>;
  /** When the check was performed */
  checkedAt: Date;
}

/**
 * Health check internal result
 */
export interface HealthCheckDetailResult {
  /** Health status */
  status: HealthStatus;
  /** Check details */
  details: Record<string, unknown>;
}

// ============================================================
// Overall System Status Types
// ============================================================

/**
 * System overall health status
 */
export interface OverallHealthStatus {
  /** Overall system health status */
  status: HealthStatus;
  /** Individual service statuses */
  services: ServiceHealthResult[];
  /** Number of active users (last 15 min) */
  activeUsers: number;
  /** 24-hour availability percentage */
  availability24h: number;
  /** Last status update time */
  lastUpdated: Date;
}

/**
 * Services status summary
 */
export interface ServicesSummary {
  /** Count of healthy services */
  healthy: number;
  /** Count of degraded services */
  degraded: number;
  /** Count of unhealthy services */
  unhealthy: number;
}

// ============================================================
// Service Details Types
// ============================================================

/**
 * Service health history entry
 */
export interface ServiceHistoryEntry {
  /** When the check was performed */
  checkedAt: Date;
  /** Health status at that time */
  status: HealthStatus;
  /** Response time in milliseconds */
  responseTime: number | null;
}

/**
 * Service error log entry
 */
export interface ServiceErrorLogEntry {
  /** When the error occurred */
  checkedAt: Date;
  /** Error message */
  errorMessage: string | null;
  /** Error code */
  errorCode: string | null;
}

/**
 * Service performance metrics
 */
export interface ServiceMetrics {
  /** Average response time in milliseconds */
  avgResponseTime: number;
  /** Maximum response time in milliseconds */
  maxResponseTime: number;
  /** Minimum response time in milliseconds */
  minResponseTime: number;
  /** Error rate percentage */
  errorRate: number;
}

/**
 * Complete service health details
 */
export interface ServiceHealthDetails {
  /** Current service status */
  service: ServiceHealthResult | null;
  /** Status history */
  history: ServiceHistoryEntry[];
  /** Recent error logs */
  errorLogs: ServiceErrorLogEntry[];
  /** Performance metrics */
  metrics: ServiceMetrics;
}

// ============================================================
// API Request/Response Types
// ============================================================

/**
 * GET /api/admin/health response
 */
export interface GetHealthResponse {
  data: OverallHealthStatus;
}

/**
 * POST /api/admin/health response
 */
export interface TriggerHealthCheckResponse {
  data: ServiceHealthResult[];
}

/**
 * GET /api/admin/health/[serviceName] query params
 */
export interface GetServiceHealthParams {
  serviceName: string;
  hours?: number;
}

/**
 * GET /api/admin/health/[serviceName] response
 */
export interface GetServiceHealthResponse {
  data: ServiceHealthDetails;
}

// ============================================================
// WebSocket Event Types
// ============================================================

/**
 * Health status update WebSocket event
 */
export interface HealthUpdateEvent {
  type: 'health:update';
  payload: OverallHealthStatus;
}

/**
 * Service status change WebSocket event
 */
export interface ServiceChangeEvent {
  type: 'health:service_change';
  payload: {
    serviceName: string;
    oldStatus: HealthStatus;
    newStatus: HealthStatus;
    timestamp: string;
  };
}

/**
 * All health WebSocket event types
 */
export type HealthWebSocketEvent = HealthUpdateEvent | ServiceChangeEvent;

// ============================================================
// Constants
// ============================================================

/**
 * Default health check interval in milliseconds
 */
export const DEFAULT_HEALTH_CHECK_INTERVAL = 30000;

/**
 * Default health check timeout in milliseconds
 */
export const DEFAULT_HEALTH_CHECK_TIMEOUT = 10000;

/**
 * Active user time threshold in minutes
 */
export const ACTIVE_USER_THRESHOLD_MINUTES = 15;

/**
 * Status color mapping for UI
 */
export const STATUS_COLORS: Record<HealthStatus, string> = {
  HEALTHY: 'bg-green-500',
  DEGRADED: 'bg-yellow-500',
  UNHEALTHY: 'bg-red-500',
  UNKNOWN: 'bg-gray-500',
  UNCONFIGURED: 'bg-gray-400',
};

/**
 * Status label mapping for UI (Traditional Chinese)
 */
export const STATUS_LABELS: Record<HealthStatus, string> = {
  HEALTHY: '正常',
  DEGRADED: '降級',
  UNHEALTHY: '異常',
  UNKNOWN: '未知',
  UNCONFIGURED: '未配置',
};

/**
 * Service type icons mapping
 */
export const SERVICE_TYPE_ICONS: Record<ServiceType, string> = {
  WEB_APP: 'server',
  AI_SERVICE: 'cpu',
  DATABASE: 'database',
  STORAGE: 'cloud',
  N8N: 'workflow',
  CACHE: 'zap',
  EXTERNAL_API: 'globe',
};

/**
 * Service display names (Traditional Chinese)
 */
export const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  web: 'Web 應用',
  ai: 'AI 服務',
  database: '資料庫',
  storage: '儲存服務',
  n8n: 'n8n 工作流',
  cache: 'Redis 快取',
};
