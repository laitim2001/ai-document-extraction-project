/**
 * @fileoverview 中間件模組統一導出
 * @module src/middleware
 * @since Epic 6 - Story 6.2
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
