'use client'

/**
 * @fileoverview Forwarder Detail React Query Hooks (Deprecated)
 * @description
 *   此文件已棄用，請使用 use-company-detail.ts
 *   保留此文件以維持向後相容性
 *
 * @module src/hooks/use-forwarder-detail
 * @deprecated Use use-company-detail.ts instead (REFACTOR-001: Forwarder → Company)
 * @since Epic 5 - Story 5.2 (Forwarder Detail Config View)
 * @lastModified 2025-12-22 (REFACTOR-001)
 *
 * @related
 *   - src/hooks/use-company-detail.ts - 新版 Company detail hooks
 */

// ============================================================
// REFACTOR-001: Re-export from use-company-detail.ts
// ============================================================

export {
  // Hooks
  useCompanyDetail as useForwarderDetail,
  useCompanyRules as useForwarderRules,
  useCompanyStats as useForwarderStats,
  useCompanyDocuments as useForwarderDocuments,
  prefetchCompanyDetail as prefetchForwarderDetail,

  // Types
  type UseCompanyRulesParams as UseForwarderRulesParams,

  // Query Keys
  companyDetailQueryKeys as forwarderDetailQueryKeys,
} from './use-company-detail'
