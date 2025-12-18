/**
 * @fileoverview Auth 模組入口
 * @description
 *   統一導出認證和權限相關的函數。
 *
 * @module src/lib/auth
 * @author Development Team
 * @since Epic 1 - Story 1.8 (City Manager User Management)
 * @lastModified 2025-12-18
 */

// 主要認證配置
export { auth, authConfig, handlers } from '../auth'

// 城市權限中間件
export {
  checkCityManagePermission,
  checkCityCreatePermission,
  checkCityEditPermission,
  getCityFilter,
  hasViewPermission,
  getManagedCityIds,
  hasPermission,
  type CityPermissionResult,
} from './city-permission'
