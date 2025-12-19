/**
 * @fileoverview NextAuth v5 認證配置
 * @description
 *   本模組配置 NextAuth v5 與 Azure AD (Entra ID) 整合，提供企業級 SSO 認證。
 *
 *   設計考量：
 *   - 使用 JWT 策略以支援無狀態認證
 *   - 8 小時 session 最大時效
 *   - 自動建立用戶記錄於首次登入
 *   - 擴展 session 包含角色、權限和用戶狀態
 *   - 整合城市權限系統支援多城市資料隔離 (Story 6.1)
 *
 * @module src/lib/auth
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-19
 *
 * @features
 *   - Azure AD (Entra ID) SSO 整合
 *   - JWT session 策略
 *   - 自動用戶建立/更新
 *   - 多角色 RBAC 權限系統
 *   - 用戶狀態檢查
 *   - 城市權限載入 (Story 6.1)
 *   - 全域管理員/區域管理員識別 (Story 6.1)
 *
 * @dependencies
 *   - next-auth - NextAuth v5 核心
 *   - @auth/prisma-adapter - Prisma 資料庫適配器
 *   - @prisma/client - Prisma ORM 客戶端
 *   - @/services/city-access.service - 城市權限服務
 *
 * @related
 *   - src/app/api/auth/[...nextauth]/route.ts - API 路由
 *   - src/middleware.ts - 路由保護中間件
 *   - src/types/next-auth.d.ts - 類型擴展
 *   - src/types/role.ts - 角色類型定義
 *   - src/services/role.service.ts - 角色服務
 *   - src/services/city-access.service.ts - 城市權限服務
 */

import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import type { SessionRole } from '@/types/role'
import { DEFAULT_ROLE } from '@/types/role-permissions'
import { assignRoleToUser, getRoleByName } from '@/services/role.service'
import { CityAccessService } from '@/services/city-access.service'

/**
 * Session 最大存活時間（秒）
 * 8 小時 = 8 * 60 * 60 = 28800 秒
 */
const SESSION_MAX_AGE = 8 * 60 * 60

/**
 * 獲取用戶的角色和權限
 * @param userId - 用戶 ID
 * @returns 用戶的角色列表（含權限）
 */
async function getUserRoles(userId: string): Promise<SessionRole[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        select: {
          id: true,
          name: true,
          permissions: true,
        },
      },
    },
  })

  return userRoles.map((ur) => ({
    id: ur.role.id,
    name: ur.role.name,
    permissions: ur.role.permissions,
  }))
}

/**
 * NextAuth v5 配置
 */
export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),

  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      authorization: {
        params: {
          scope: 'openid profile email User.Read',
        },
      },
    }),
  ],

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
     * JWT callback - 在 JWT 建立/更新時調用
     * 將用戶角色、權限、城市權限和 azureAdId 加入 token
     *
     * @description
     *   Story 6.1: 新增城市權限載入
     *   - 從資料庫載入用戶可存取的城市代碼列表
     *   - 載入用戶的主要城市代碼
     *   - 識別全域管理員和區域管理員身份
     *   - 載入區域管理員負責的區域代碼
     */
    async jwt({ token, account }) {
      // 首次登入時，從 account 取得 Azure AD ID
      if (account) {
        token.azureAdId = account.providerAccountId
      }

      // 從資料庫獲取最新的用戶資訊（包括角色變更）
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            azureAdId: true,
            status: true,
            isGlobalAdmin: true,
            isRegionalManager: true,
          },
        })

        if (dbUser) {
          token.azureAdId = dbUser.azureAdId ?? undefined
          token.status = dbUser.status

          // Story 6.1: 設置管理員身份
          token.isGlobalAdmin = dbUser.isGlobalAdmin
          token.isRegionalManager = dbUser.isRegionalManager
        }

        // 獲取用戶角色和權限
        token.roles = await getUserRoles(token.sub)

        // Story 6.1: 獲取城市權限資訊
        token.cityCodes = await CityAccessService.getUserCityCodes(token.sub)
        token.primaryCityCode = await CityAccessService.getPrimaryCityCode(token.sub)

        // Story 6.1: 如果是區域管理員，獲取管理的區域代碼
        if (token.isRegionalManager) {
          token.regionCodes = await CityAccessService.getManagedRegionCodes(token.sub)
        }
      }

      return token
    },

    /**
     * Session callback - 在取得 session 時調用
     * 將 token 中的資料加入 session
     *
     * @description
     *   Story 6.1: 新增城市權限資料傳遞
     *   - 將城市代碼列表加入 session
     *   - 將主要城市代碼加入 session
     *   - 傳遞管理員身份標識
     *   - 傳遞區域管理員的區域代碼
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.azureAdId = token.azureAdId
        session.user.status = token.status ?? 'ACTIVE'
        session.user.roles = token.roles ?? []

        // Story 6.1: 城市權限資料
        session.user.cityCodes = token.cityCodes ?? []
        session.user.primaryCityCode = token.primaryCityCode ?? null
        session.user.isGlobalAdmin = token.isGlobalAdmin ?? false
        session.user.isRegionalManager = token.isRegionalManager ?? false
        session.user.regionCodes = token.regionCodes
      }
      return session
    },

    /**
     * SignIn callback - 在用戶登入時調用
     * 檢查用戶狀態是否允許登入
     *
     * @description
     *   Story 1.6: 停用的用戶嘗試登入時，將被重導至錯誤頁面
     *   而非顯示通用的登入失敗訊息。
     *
     *   狀態處理：
     *   - ACTIVE: 允許登入
     *   - INACTIVE: 重導至 /auth/error?error=AccountDisabled
     *   - SUSPENDED: 重導至 /auth/error?error=AccountSuspended
     */
    async signIn({ user }) {
      if (user.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { status: true },
        })

        // 如果用戶存在但非 ACTIVE 狀態，重導至錯誤頁面
        if (dbUser && dbUser.status !== 'ACTIVE') {
          // 根據不同狀態重導至相應錯誤頁面
          if (dbUser.status === 'SUSPENDED') {
            return '/auth/error?error=AccountSuspended'
          }
          // INACTIVE 或其他非 ACTIVE 狀態
          return '/auth/error?error=AccountDisabled'
        }

        // 更新最後登入時間
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })
      }

      return true
    },
  },

  events: {
    /**
     * 建立用戶時設置預設值和預設角色
     */
    async createUser({ user }) {
      if (user.id) {
        // 設置用戶狀態為 ACTIVE
        await prisma.user.update({
          where: { id: user.id },
          data: {
            status: 'ACTIVE',
          },
        })

        // 分配預設角色
        const defaultRole = await getRoleByName(DEFAULT_ROLE)
        if (defaultRole) {
          await assignRoleToUser(user.id, defaultRole.id)
        }
      }
    },
  },

  // 開發模式下啟用調試日誌
  debug: process.env.NODE_ENV === 'development',
}

/**
 * NextAuth 實例導出
 * 提供 handlers、auth、signIn、signOut 方法
 */
export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig)
