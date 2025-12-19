/**
 * @fileoverview Forwarder Filter Type Definitions
 * @description
 *   Type definitions for forwarder filtering functionality:
 *   - ForwarderOption for dropdown selections
 *   - API response types for forwarder list
 *   - Comparison data structures for multi-forwarder analysis
 *
 * @module src/types/forwarder-filter
 * @since Epic 7 - Story 7.3 (Forwarder Filter)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - Prisma Forwarder model for field alignment
 *
 * @related
 *   - src/types/dashboard-filter.ts - Dashboard filter integration
 *   - src/contexts/DashboardFilterContext.tsx - Filter context consumer
 *   - src/components/dashboard/ForwarderMultiSelect.tsx - UI component
 */

// ============================================================
// Forwarder Option Types
// ============================================================

/**
 * Forwarder option for dropdown selection
 * Used in ForwarderMultiSelect component
 */
export interface ForwarderOption {
  /** Unique identifier (CUID) */
  id: string;
  /** Forwarder code (e.g., "DHL", "FEDEX") */
  code: string;
  /** Full name */
  name: string;
  /** Display name for UI */
  displayName: string;
}

/**
 * API response for forwarder list endpoint
 */
export interface ForwarderListResponse {
  success: boolean;
  data: ForwarderOption[];
  meta?: {
    total: number;
    cached: boolean;
    cachedAt?: string;
  };
}

// ============================================================
// Forwarder Comparison Types
// ============================================================

/**
 * Forwarder comparison data for charts
 * Contains aggregated metrics for a single forwarder
 */
export interface ForwarderComparisonData {
  /** Forwarder identifier */
  forwarderId: string;
  /** Forwarder display name */
  forwarderName: string;
  /** Forwarder code for short display */
  forwarderCode: string;
  /** Total document count in period */
  documentCount: number;
  /** Auto-approved documents */
  autoApprovedCount: number;
  /** Documents requiring review */
  reviewRequiredCount: number;
  /** Average confidence score (0-100) */
  averageConfidence: number;
  /** Average processing time in seconds */
  averageProcessingTime: number;
  /** Total amount processed */
  totalAmount: number;
  /** Currency code */
  currency: string;
}

/**
 * API response for forwarder comparison endpoint
 */
export interface ForwarderComparisonResponse {
  success: boolean;
  data: ForwarderComparisonData[];
  meta?: {
    dateRange: {
      from: string;
      to: string;
    };
    total: number;
  };
}

// ============================================================
// Forwarder Filter State Types
// ============================================================

/**
 * Forwarder filter state for context
 */
export interface ForwarderFilterState {
  /** Currently selected forwarder IDs */
  selectedIds: string[];
  /** Available forwarders for selection */
  availableForwarders: ForwarderOption[];
  /** Loading state for forwarder list */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

/**
 * Filter mode for forwarder selection
 */
export type ForwarderFilterMode = 'single' | 'multiple' | 'comparison';

/**
 * Forwarder filter configuration
 */
export interface ForwarderFilterConfig {
  /** Filter mode */
  mode: ForwarderFilterMode;
  /** Maximum number of selections (for comparison mode) */
  maxSelections?: number;
  /** Whether to show all forwarders option */
  showAllOption?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

// ============================================================
// Constants
// ============================================================

/**
 * Default forwarder filter configuration
 */
export const DEFAULT_FORWARDER_FILTER_CONFIG: ForwarderFilterConfig = {
  mode: 'multiple',
  maxSelections: 5,
  showAllOption: true,
  placeholder: '選擇貨代商...',
};

/**
 * Maximum forwarders for comparison view
 */
export const MAX_COMPARISON_FORWARDERS = 5;

/**
 * Cache TTL for forwarder list in milliseconds (5 minutes)
 */
export const FORWARDER_LIST_CACHE_TTL = 5 * 60 * 1000;
