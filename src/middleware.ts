/**
 * @fileoverview Next.js Middleware 路由保護
 * @description
 *   本模組實現 Next.js 中間件，用於保護需要認證的路由。
 *   使用 Edge-compatible 認證配置，避免 Node.js crypto 模組問題。
 *
 *   保護策略：
 *   - 未認證用戶訪問受保護路由 → 重定向至登入頁面
 *   - 已認證用戶訪問認證頁面 → 重定向至儀表板
 *   - API 路由透過 NextAuth 內建機制保護
 *
 *   路由分類：
 *   - 公開路由：/auth/*、/api/auth/*
 *   - 受保護路由：/dashboard/*、/api/v1/*
 *
 *   Edge Runtime 注意事項：
 *   - 使用 auth.config.ts 中的 Edge-compatible 配置
 *   - 不進行資料庫查詢
 *   - 只依賴 JWT token 進行授權檢查
 *
 * @module src/middleware
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-21
 *
 * @features
 *   - 認證狀態檢查（基於 JWT）
 *   - 自動重定向邏輯
 *   - 靜態資源排除
 *   - Edge Runtime 兼容
 *
 * @dependencies
 *   - next-auth - NextAuth v5 核心
 *   - @/lib/auth.config - Edge-compatible 認證配置
 *
 * @related
 *   - src/lib/auth.config.ts - Edge 認證配置
 *   - src/lib/auth.ts - 完整認證配置
 *   - src/app/(auth)/auth/login/page.tsx - 登入頁面
 *   - src/app/(dashboard)/dashboard/page.tsx - 儀表板頁面
 */

import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

/**
 * 使用 Edge-compatible 配置建立 NextAuth 實例
 * 此實例只用於 Middleware，不包含資料庫存取
 */
const { auth } = NextAuth(authConfig)

/**
 * 導出 auth 作為 middleware
 * NextAuth v5 的 authorized callback 會處理授權邏輯
 */
export default auth

/**
 * Middleware 匹配配置
 * 排除靜態資源和特定路徑
 */
export const config = {
  matcher: [
    /*
     * 匹配所有路徑除了：
     * - _next/static (靜態文件)
     * - _next/image (圖片優化)
     * - favicon.ico (網站圖標)
     * - public 資料夾中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
