'use client'

/**
 * @fileoverview NextAuth Session Provider
 * @description
 *   提供 NextAuth v5 的 SessionProvider，讓客戶端組件可以使用 useSession。
 *
 *   注意：
 *   - 這是一個客戶端組件（'use client'）
 *   - 必須包裹在應用程式的根層級
 *   - 支援 useSession, signIn, signOut 等客戶端函數
 *
 * @module src/providers/AuthProvider
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-21
 *
 * @dependencies
 *   - next-auth/react - NextAuth 客戶端函數
 *
 * @related
 *   - src/app/layout.tsx - 根佈局
 *   - src/lib/auth.ts - NextAuth 配置
 *   - src/hooks/useUserCity.ts - 使用 useSession 的 hook
 */

import * as React from 'react'
import { SessionProvider } from 'next-auth/react'

// ============================================================
// Types
// ============================================================

interface AuthProviderProps {
  children: React.ReactNode
}

// ============================================================
// Component
// ============================================================

/**
 * NextAuth Session Provider 組件
 *
 * @description
 *   包裝 next-auth 的 SessionProvider，讓所有子組件可以使用 useSession hook。
 *   此組件必須放在客戶端組件中，並包裹在應用程式的根層級。
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return <SessionProvider>{children}</SessionProvider>
}
