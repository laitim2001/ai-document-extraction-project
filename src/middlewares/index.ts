/**
 * @fileoverview 中間件模組統一導出
 * @module src/middleware
 * @since Epic 6 - Story 6.2
 * @lastModified 2025-12-20
 */

// City Filter Middleware
export {
  withCityFilter,
  validateRequestedCities,
  buildCityWhereClause,
  extractCitiesFromRequest,
  getClientIp,
  type CityFilterContext,
  type CityValidationResult,
} from './city-filter'

// Resource Access Middleware
export {
  validateResourceAccess,
  withResourceAccess,
  type ResourceType,
  type ResourceAccessResult,
} from './resource-access'

// Audit Log Middleware (Story 8.1)
export {
  withAuditLog,
  withAuditLogParams,
  logAuditEntry,
  type AuditConfig,
  type ApiHandler,
  type ApiHandlerWithParams,
} from './audit-log.middleware'

// External API Auth Middleware (Story 11.1)
export {
  externalApiAuthMiddleware,
  generateTraceId,
  getClientIpFromRequest,
  getClientInfo,
  isValidApiKeyFormat,
  type ExternalApiAuthResult,
  type ClientInfo,
} from './external-api-auth'
