/**
 * @fileoverview NextAuth v5 Edge-compatible 認證配置
 * @description
 *   本模組提供 Edge Runtime 兼容的認證配置，專門用於 Next.js Middleware。
 *   此配置不包含任何資料庫存取，以確保在 Edge Runtime 中正常運作。
 *
 *   Edge Runtime 限制：
 *   - 不支援 Node.js crypto 模組
 *   - 不支援 Prisma/pg 等資料庫驅動
 *   - 只能使用 Web APIs
 *
 *   設計考量：
 *   - 分離 Edge-compatible 配置和完整配置
 *   - Middleware 使用此配置進行基本認證檢查
 *   - API Routes 和 Server Components 使用完整配置
 *   - 開發模式支援 Credentials 提供者
 *
 * @module src/lib/auth.config
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-21
 *
 * @features
 *   - Edge Runtime 兼容
 *   - Azure AD (Entra ID) 提供者配置
 *   - 開發模式 Credentials 提供者
 *   - JWT session 策略
 *   - 基本頁面配置
 *
 * @related
 *   - src/lib/auth.ts - 完整認證配置（含資料庫）
 *   - src/middleware.ts - 使用此配置的中間件
 */

import type { NextAuthConfig } from 'next-auth'
import type { Provider } from 'next-auth/providers'
import Credentials from 'next-auth/providers/credentials'

/**
 * Session 最大存活時間（秒）
 * 8 小時 = 8 * 60 * 60 = 28800 秒
 */
const SESSION_MAX_AGE = 8 * 60 * 60

/**
 * 檢查 Azure AD 環境變數是否已正確配置
 */
function isAzureADConfigured(): boolean {
  const clientId = process.env.AZURE_AD_CLIENT_ID
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET
  const tenantId = process.env.AZURE_AD_TENANT_ID

  // 檢查是否為模擬值
  if (!clientId || !clientSecret || !tenantId) return false
  if (clientId.startsWith('your-') || clientId === 'placeholder') return false
  if (clientSecret.startsWith('your-') || clientSecret === 'placeholder') return false
  if (tenantId.startsWith('your-') || tenantId === 'placeholder') return false

  return true
}

/**
 * 構建認證提供者列表
 * 根據環境配置選擇適當的提供者
 */
function buildProviders(): Provider[] {
  const providers: Provider[] = []

  // 開發模式或 Azure AD 未配置時，使用 Credentials 提供者
  // ⚠️ 重要：此條件必須與 auth.ts 中的 isDevelopmentMode 保持一致
  //    auth.ts: isDevelopmentMode = NODE_ENV === 'development' || !isAzureADConfigured()
  //    如果修改此條件，請同步更新 auth.ts
  if (process.env.NODE_ENV === 'development' || !isAzureADConfigured()) {
    providers.push(
      Credentials({
        id: 'credentials',
        name: 'Development Login',
        credentials: {
          email: { label: 'Email', type: 'email', placeholder: 'test@example.com' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          // 開發模式：接受任何有效的 email 格式
          if (credentials?.email && typeof credentials.email === 'string') {
            const email = credentials.email
            // 基本 email 驗證
            if (email.includes('@')) {
              return {
                id: 'dev-user-1',
                email: email,
                name: email.split('@')[0],
                image: null,
              }
            }
          }
          return null
        },
      })
    )
  }

  // 如果 Azure AD 已配置，動態載入提供者
  if (isAzureADConfigured()) {
    // 注意：MicrosoftEntraID 在 Edge Runtime 中可能有問題
    // 這裡我們只在非 Edge 環境中添加
    // Middleware 將使用 Credentials 或現有 session
  }

  return providers
}

/**
 * Edge-compatible NextAuth 配置
 * 不包含資料庫存取，適用於 Middleware
 */
export const authConfig: NextAuthConfig = {
  providers: buildProviders(),

  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE,
  },

  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },

  callbacks: {
    /**
     * Authorized callback - 用於 Middleware 的授權檢查
     * 只檢查是否有 auth token，不進行資料庫查詢
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')
      const isOnApi = nextUrl.pathname.startsWith('/api/v1')
      const isAuthRoute = nextUrl.pathname.startsWith('/auth')
      const isApiAuth = nextUrl.pathname.startsWith('/api/auth')

      // API auth routes are always accessible
      if (isApiAuth) {
        return true
      }

      // Protected routes check
      if (isOnDashboard || isOnApi) {
        if (isLoggedIn) return true
        return false // Redirect to login
      }

      // Auth routes - redirect to dashboard if already logged in
      if (isAuthRoute) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/dashboard', nextUrl))
        }
        return true
      }

      // Root path handling
      if (nextUrl.pathname === '/') {
        if (isLoggedIn) {
          return Response.redirect(new URL('/dashboard', nextUrl))
        }
        return Response.redirect(new URL('/auth/login', nextUrl))
      }

      return true
    },
  },

  // 開發模式下啟用調試日誌
  debug: process.env.NODE_ENV === 'development',
}
