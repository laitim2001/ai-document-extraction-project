/**
 * @fileoverview Dashboard Filter Type Definitions
 * @description
 *   Unified type definitions for dashboard filtering:
 *   - Combined date range and forwarder filter state
 *   - URL parameter synchronization types
 *   - Filter context interface
 *
 * @module src/types/dashboard-filter
 * @since Epic 7 - Story 7.3 (Forwarder Filter)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - src/types/date-range.ts - Date range types
 *   - src/types/forwarder-filter.ts - Forwarder filter types
 *
 * @related
 *   - src/contexts/DashboardFilterContext.tsx - Filter context provider
 *   - src/components/dashboard/DashboardFilters.tsx - Filter UI wrapper
 */

import type { PresetRange, DateRange, DateRangeValidation } from './date-range';
import type { ForwarderOption, ForwarderFilterMode } from './forwarder-filter';

// ============================================================
// URL Parameter Types
// ============================================================

/**
 * URL query parameters for filter state persistence
 * Used for bookmarking and sharing filter configurations
 */
export interface DashboardFilterParams {
  /** Date range preset or 'custom' */
  range?: PresetRange | 'custom';
  /** Custom start date (ISO format) */
  from?: string;
  /** Custom end date (ISO format) */
  to?: string;
  /** Comma-separated forwarder IDs */
  forwarders?: string;
}

// ============================================================
// Filter State Types
// ============================================================

/**
 * Complete dashboard filter state
 * Combines date range and forwarder filters
 */
export interface DashboardFilterState {
  // Date Range State
  /** Selected preset range */
  preset: PresetRange;
  /** Current date range */
  dateRange: DateRange;
  /** Whether using custom date range */
  isCustomRange: boolean;
  /** Date validation result */
  validation: DateRangeValidation;

  // Forwarder Filter State
  /** Selected forwarder IDs */
  selectedForwarderIds: string[];
  /** Available forwarders for selection */
  availableForwarders: ForwarderOption[];
  /** Forwarder filter mode */
  forwarderMode: ForwarderFilterMode;
  /** Loading state for forwarder list */
  isForwardersLoading: boolean;
}

// ============================================================
// Filter Actions Types
// ============================================================

/**
 * Dashboard filter actions for context
 */
export interface DashboardFilterActions {
  // Date Range Actions
  /** Set preset range */
  setPreset: (preset: PresetRange) => void;
  /** Set custom date range */
  setCustomRange: (from: Date, to: Date) => void;
  /** Reset to default date range */
  resetDateRange: () => void;

  // Forwarder Filter Actions
  /** Set selected forwarder IDs */
  setSelectedForwarders: (ids: string[]) => void;
  /** Toggle single forwarder selection */
  toggleForwarder: (id: string) => void;
  /** Select all forwarders */
  selectAllForwarders: () => void;
  /** Clear all forwarder selections */
  clearForwarderSelection: () => void;
  /** Set forwarder filter mode */
  setForwarderMode: (mode: ForwarderFilterMode) => void;

  // Combined Actions
  /** Reset all filters to default */
  resetAllFilters: () => void;
  /** Update filters from URL params */
  updateFromParams: (params: DashboardFilterParams) => void;
}

// ============================================================
// Context Types
// ============================================================

/**
 * Complete dashboard filter context type
 * Combines state and actions
 */
export interface DashboardFilterContextType extends DashboardFilterState, DashboardFilterActions {
  /** Current URL query string */
  queryString: string;
  /** Whether filters have been modified from default */
  hasActiveFilters: boolean;
  /** Get selected forwarder objects */
  getSelectedForwarders: () => ForwarderOption[];
}

// ============================================================
// API Request Types
// ============================================================

/**
 * API request parameters for dashboard data
 * Used by dashboard API endpoints
 */
export interface DashboardApiParams {
  /** Start date (ISO format) */
  from: string;
  /** End date (ISO format) */
  to: string;
  /** Forwarder IDs (optional, empty = all) */
  forwarderIds?: string[];
}

/**
 * Build API params from filter state
 */
export function buildDashboardApiParams(state: DashboardFilterState): DashboardApiParams {
  return {
    from: state.dateRange.startDate.toISOString(),
    to: state.dateRange.endDate.toISOString(),
    forwarderIds: state.selectedForwarderIds.length > 0 ? state.selectedForwarderIds : undefined,
  };
}

// ============================================================
// Constants
// ============================================================

/**
 * Default filter state values
 */
export const DEFAULT_DASHBOARD_FILTER_STATE: Omit<
  DashboardFilterState,
  'dateRange' | 'validation' | 'availableForwarders'
> = {
  preset: 'thisMonth',
  isCustomRange: false,
  selectedForwarderIds: [],
  forwarderMode: 'multiple',
  isForwardersLoading: false,
};

/**
 * URL parameter names
 */
export const FILTER_URL_PARAMS = {
  RANGE: 'range',
  FROM: 'from',
  TO: 'to',
  FORWARDERS: 'forwarders',
} as const;
