/**
 * @fileoverview NextAuth v5 API 路由處理器
 * @description
 *   本模組導出 NextAuth v5 的 HTTP 處理器，處理所有認證相關的 API 請求。
 *
 *   處理的端點包括：
 *   - GET /api/auth/signin - 登入頁面
 *   - POST /api/auth/signin/:provider - 執行登入
 *   - GET /api/auth/signout - 登出頁面
 *   - POST /api/auth/signout - 執行登出
 *   - GET /api/auth/session - 取得 session
 *   - GET /api/auth/callback/:provider - OAuth callback
 *
 * @module src/app/api/auth/[...nextauth]/route
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-18
 *
 * @related
 *   - src/lib/auth.ts - NextAuth 配置
 *   - src/middleware.ts - 路由保護中間件
 */

import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
