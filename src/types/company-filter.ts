/**
 * @fileoverview Company Filter Type Definitions
 * @description
 *   Type definitions for company filtering functionality:
 *   - CompanyOption for dropdown selections
 *   - API response types for company list
 *   - Comparison data structures for multi-company analysis
 *
 * @module src/types/company-filter
 * @since REFACTOR-001: Forwarder → Company
 * @lastModified 2025-12-22
 *
 * @dependencies
 *   - Prisma Company model for field alignment
 *
 * @related
 *   - src/types/dashboard-filter.ts - Dashboard filter integration
 *   - src/contexts/DashboardFilterContext.tsx - Filter context consumer
 *   - src/components/dashboard/CompanyMultiSelect.tsx - UI component
 */

import type { CompanyType } from './company'

// ============================================================
// Company Option Types
// ============================================================

/**
 * Company option for dropdown selection
 * Used in CompanyMultiSelect component
 */
export interface CompanyOption {
  /** Unique identifier (CUID) */
  id: string
  /** Company code (e.g., "DHL", "FEDEX") - may be null for auto-created companies */
  code: string | null
  /** Full name */
  name: string
  /** Display name for UI */
  displayName: string
  /** Company type (REFACTOR-001) */
  type?: CompanyType
}

/**
 * API response for company list endpoint
 */
export interface CompanyListResponse {
  success: boolean
  data: CompanyOption[]
  meta?: {
    total: number
    cached: boolean
    cachedAt?: string
  }
}

// ============================================================
// Company Comparison Types
// ============================================================

/**
 * Company comparison data for charts
 * Contains aggregated metrics for a single company
 */
export interface CompanyComparisonData {
  /** Company identifier */
  companyId: string
  /** Company display name */
  companyName: string
  /** Company code for short display */
  companyCode: string | null
  /** Company type (REFACTOR-001) */
  companyType?: CompanyType
  /** Total document count in period */
  documentCount: number
  /** Auto-approved documents */
  autoApprovedCount: number
  /** Documents requiring review */
  reviewRequiredCount: number
  /** Average confidence score (0-100) */
  averageConfidence: number
  /** Average processing time in seconds */
  averageProcessingTime: number
  /** Total amount processed */
  totalAmount: number
  /** Currency code */
  currency: string
}

/**
 * API response for company comparison endpoint
 */
export interface CompanyComparisonResponse {
  success: boolean
  data: CompanyComparisonData[]
  meta?: {
    dateRange: {
      from: string
      to: string
    }
    total: number
  }
}

// ============================================================
// Company Filter State Types
// ============================================================

/**
 * Company filter state for context
 */
export interface CompanyFilterState {
  /** Currently selected company IDs */
  selectedIds: string[]
  /** Available companies for selection */
  availableCompanies: CompanyOption[]
  /** Loading state for company list */
  isLoading: boolean
  /** Error state */
  error: string | null
}

/**
 * Filter mode for company selection
 */
export type CompanyFilterMode = 'single' | 'multiple' | 'comparison'

/**
 * Company filter configuration
 */
export interface CompanyFilterConfig {
  /** Filter mode */
  mode: CompanyFilterMode
  /** Maximum number of selections (for comparison mode) */
  maxSelections?: number
  /** Whether to show all companies option */
  showAllOption?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Filter by company types */
  companyTypes?: CompanyType[]
}

// ============================================================
// Constants
// ============================================================

/**
 * Default company filter configuration
 */
export const DEFAULT_COMPANY_FILTER_CONFIG: CompanyFilterConfig = {
  mode: 'multiple',
  maxSelections: 5,
  showAllOption: true,
  placeholder: '選擇公司...',
}

/**
 * Maximum companies for comparison view
 */
export const MAX_COMPARISON_COMPANIES = 5

/**
 * Cache TTL for company list in milliseconds (5 minutes)
 */
export const COMPANY_LIST_CACHE_TTL = 5 * 60 * 1000

// ============================================================
// Backward Compatibility Aliases (DEPRECATED)
// ============================================================

/**
 * @deprecated Use CompanyOption instead (REFACTOR-001)
 */
export type ForwarderOption = CompanyOption

/**
 * @deprecated Use CompanyListResponse instead (REFACTOR-001)
 */
export type ForwarderListResponse = CompanyListResponse

/**
 * @deprecated Use CompanyComparisonData instead (REFACTOR-001)
 */
export type ForwarderComparisonData = CompanyComparisonData

/**
 * @deprecated Use CompanyComparisonResponse instead (REFACTOR-001)
 */
export type ForwarderComparisonResponse = CompanyComparisonResponse

/**
 * @deprecated Use CompanyFilterState instead (REFACTOR-001)
 */
export type ForwarderFilterState = CompanyFilterState

/**
 * @deprecated Use CompanyFilterMode instead (REFACTOR-001)
 */
export type ForwarderFilterMode = CompanyFilterMode

/**
 * @deprecated Use CompanyFilterConfig instead (REFACTOR-001)
 */
export type ForwarderFilterConfig = CompanyFilterConfig

/**
 * @deprecated Use DEFAULT_COMPANY_FILTER_CONFIG instead (REFACTOR-001)
 */
export const DEFAULT_FORWARDER_FILTER_CONFIG = DEFAULT_COMPANY_FILTER_CONFIG

/**
 * @deprecated Use MAX_COMPARISON_COMPANIES instead (REFACTOR-001)
 */
export const MAX_COMPARISON_FORWARDERS = MAX_COMPARISON_COMPANIES

/**
 * @deprecated Use COMPANY_LIST_CACHE_TTL instead (REFACTOR-001)
 */
export const FORWARDER_LIST_CACHE_TTL = COMPANY_LIST_CACHE_TTL
