'use client'

/**
 * @fileoverview Forwarder List React Query Hook (Deprecated)
 * @description
 *   此文件已棄用，請使用 use-companies.ts
 *   保留此文件以維持向後相容性
 *
 * @module src/hooks/use-forwarders
 * @deprecated Use use-companies.ts instead (REFACTOR-001: Forwarder → Company)
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2025-12-22 (REFACTOR-001)
 *
 * @related
 *   - src/hooks/use-companies.ts - 新版 Company hooks
 */

// ============================================================
// REFACTOR-001: Re-export from use-companies.ts
// ============================================================

export {
  // Hook
  useCompanies as useForwarders,
  useCompanyOptions as useForwarderOptions,

  // Types
  type UseCompaniesParams as UseForwardersParams,

  // Query Keys
  companiesQueryKeys as forwardersQueryKeys,
} from './use-companies'
