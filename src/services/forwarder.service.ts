/**
 * @fileoverview Forwarder Service (Deprecated)
 * @description
 *   此文件已棄用，請使用 company.service.ts
 *   保留此文件以維持向後相容性
 *
 * @module src/services/forwarder.service
 * @deprecated Use company.service.ts instead (REFACTOR-001: Forwarder → Company)
 * @since Epic 5 - Story 5.1 (Forwarder Profile List)
 * @lastModified 2025-12-22 (REFACTOR-001)
 *
 * @related
 *   - src/services/company.service.ts - 新版 Company 服務
 */

// ============================================================
// REFACTOR-001: Re-export from company.service.ts
// ============================================================

export {
  // 主要函數
  getCompanies as getForwarders,
  getCompaniesFromQuery as getForwardersFromQuery,
  getCompanyById as getForwarderById,
  getCompanyByCode as getForwarderByCode,
  getCompanyByName as getForwarderByName,
  getCompanyStats as getForwarderStats,
  companyExists as forwarderExists,
  companyCodeExists as forwarderCodeExists,
  companyNameExists as forwarderNameExists,
  getActiveCompanyOptions as getActiveForwarderOptions,
  getAllCompanyOptions as getAllForwarderOptions,
  getCompanyStatsById as getForwarderStatsById,
  getCompanyRecentDocuments as getForwarderRecentDocuments,
  getCompanyDetailView as getForwarderDetailView,
  getCompanyRules as getForwarderRules,
  getCompanyRulesFromQuery as getForwarderRulesFromQuery,
  createCompany as createForwarder,
  updateCompany as updateForwarder,
  deactivateCompany as deactivateForwarder,
  activateCompany as activateForwarder,
  getCompanyForEdit as getForwarderForEdit,

  // 類型
  type GetCompaniesParams as GetForwardersParams,
  type GetCompanyRulesParams as GetForwarderRulesParams,
  type CreateCompanyInput as CreateForwarderInput,
  type UpdateCompanyInput as UpdateForwarderInput,
  type CompanyOption as ForwarderOption,
} from './company.service'
