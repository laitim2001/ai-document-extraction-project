/**
 * @fileoverview 公司管理組件匯出
 * @description
 *   集中匯出所有公司相關組件。
 *
 * @module src/components/features/companies
 * @since Epic 0 - Story 0.3
 * @lastModified 2025-12-23
 *
 * @features
 *   - CompanyTypeSelector - 公司類型選擇器
 *   - CompanyTypeBadge - 公司類型徽章
 *   - CompanyMergeDialog - 公司合併對話框
 *
 * @related
 *   - src/app/(dashboard)/admin/companies/review/page.tsx - 審核頁面
 */

// 公司類型選擇器和徽章
export {
  CompanyTypeSelector,
  CompanyTypeBadge,
  COMPANY_TYPE_CONFIG,
} from './CompanyTypeSelector'

// 公司合併對話框
export { CompanyMergeDialog } from './CompanyMergeDialog'
