/**
 * @fileoverview NextAuth v5 類型擴展
 * @description
 *   擴展 NextAuth 的 Session 和 JWT 類型，加入自定義屬性。
 *
 *   擴展屬性：
 *   - user.id: 用戶唯一標識符
 *   - user.role: 用戶角色 (ADMIN | SUPERVISOR | OPERATOR)
 *   - user.azureAdId: Azure AD 用戶 ID
 *
 * @module src/types/next-auth
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-18
 *
 * @related
 *   - src/lib/auth.ts - NextAuth 配置
 *   - prisma/schema.prisma - 用戶模型定義
 */

import type { UserRole } from '@prisma/client'
import type { DefaultSession, DefaultUser } from 'next-auth'
import type { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  /**
   * 擴展 Session 類型
   * 在 session.user 中加入自定義屬性
   */
  interface Session {
    user: {
      id: string
      role: UserRole
      azureAdId?: string
    } & DefaultSession['user']
  }

  /**
   * 擴展 User 類型
   * 對應 Prisma User 模型的自定義欄位
   */
  interface User extends DefaultUser {
    role?: UserRole
    azureAdId?: string
    isActive?: boolean
  }
}

declare module 'next-auth/jwt' {
  /**
   * 擴展 JWT 類型
   * 在 JWT token 中存儲自定義屬性
   */
  interface JWT extends DefaultJWT {
    role?: UserRole
    azureAdId?: string
    isActive?: boolean
  }
}
