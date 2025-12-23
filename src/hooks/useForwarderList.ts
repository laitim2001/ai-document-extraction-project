/**
 * @fileoverview Forwarder List Hook (Deprecated)
 * @description
 *   此文件已棄用，請使用 useCompanyList.ts
 *   保留此文件以維持向後相容性
 *
 * @module src/hooks/useForwarderList
 * @deprecated Use useCompanyList.ts instead (REFACTOR-001: Forwarder → Company)
 * @since Epic 4 - Story 4.1 (映射規則列表與查看)
 * @lastModified 2025-12-22 (REFACTOR-001)
 *
 * @related
 *   - src/hooks/useCompanyList.ts - 新版 Company list hook
 */

// ============================================================
// REFACTOR-001: Re-export from useCompanyList.ts
// ============================================================

export {
  // Hook
  useCompanyList as useForwarderList,

  // Types
  type CompanyOption as ForwarderOption,

  // Query Keys & Constants
  COMPANY_LIST_QUERY_KEY as FORWARDER_LIST_QUERY_KEY,
  companyListKeys as forwarderListKeys,

  // Helper Functions
  getCompanyById as getForwarderById,
  getCompaniesByIds as getForwardersByIds,
  getCompanyByCode as getForwarderByCode,
} from './useCompanyList';
