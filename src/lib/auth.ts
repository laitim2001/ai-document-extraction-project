/**
 * @fileoverview NextAuth v5 認證配置
 * @description
 *   本模組配置 NextAuth v5 與 Azure AD (Entra ID) 整合，提供企業級 SSO 認證。
 *
 *   設計考量：
 *   - 使用 JWT 策略以支援無狀態認證
 *   - 8 小時 session 最大時效
 *   - 自動建立用戶記錄於首次登入
 *   - 擴展 session 包含 role 和 azureAdId
 *
 * @module src/lib/auth
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-18
 *
 * @features
 *   - Azure AD (Entra ID) SSO 整合
 *   - JWT session 策略
 *   - 自動用戶建立/更新
 *   - Role-based 權限擴展
 *
 * @dependencies
 *   - next-auth - NextAuth v5 核心
 *   - @auth/prisma-adapter - Prisma 資料庫適配器
 *   - @prisma/client - Prisma ORM 客戶端
 *
 * @related
 *   - src/app/api/auth/[...nextauth]/route.ts - API 路由
 *   - src/middleware.ts - 路由保護中間件
 *   - src/types/next-auth.d.ts - 類型擴展
 */

import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

/**
 * Session 最大存活時間（秒）
 * 8 小時 = 8 * 60 * 60 = 28800 秒
 */
const SESSION_MAX_AGE = 8 * 60 * 60

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
     * 將用戶 role 和 azureAdId 加入 token
     */
    async jwt({ token, user, account }) {
      // 首次登入時，從 user 物件取得資料
      if (user) {
        token.role = (user as { role?: UserRole }).role ?? 'OPERATOR'
        token.azureAdId = account?.providerAccountId
      }

      // 從資料庫獲取最新的用戶資訊（包括 role 變更）
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, azureAdId: true, isActive: true },
        })

        if (dbUser) {
          token.role = dbUser.role
          token.azureAdId = dbUser.azureAdId ?? undefined
          token.isActive = dbUser.isActive
        }
      }

      return token
    },

    /**
     * Session callback - 在取得 session 時調用
     * 將 token 中的資料加入 session
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as UserRole
        session.user.azureAdId = token.azureAdId as string | undefined
      }
      return session
    },

    /**
     * SignIn callback - 在用戶登入時調用
     * 檢查用戶是否被停用
     */
    async signIn({ user }) {
      if (user.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { isActive: true },
        })

        // 如果用戶存在但被停用，拒絕登入
        if (dbUser && !dbUser.isActive) {
          return false
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
     * 建立用戶時設置預設值
     */
    async createUser({ user }) {
      // 新用戶預設為 OPERATOR 角色
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            role: 'OPERATOR',
            isActive: true,
          },
        })
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
