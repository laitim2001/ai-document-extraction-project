/**
 * @fileoverview Next.js Middleware 路由保護
 * @description
 *   本模組實現 Next.js 中間件，用於保護需要認證的路由。
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
 * @module src/middleware
 * @author Development Team
 * @since Epic 1 - Story 1.1 (Azure AD SSO Login)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 認證狀態檢查
 *   - 自動重定向邏輯
 *   - 靜態資源排除
 *
 * @dependencies
 *   - next-auth - NextAuth v5 核心
 *
 * @related
 *   - src/lib/auth.ts - NextAuth 配置
 *   - src/app/(auth)/auth/login/page.tsx - 登入頁面
 *   - src/app/(dashboard)/dashboard/page.tsx - 儀表板頁面
 */

import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * 公開路由列表（不需要認證）
 */
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/error',
  '/api/auth',
]

/**
 * 靜態資源路徑前綴（跳過中間件）
 */
const STATIC_PATHS = [
  '/_next',
  '/favicon.ico',
  '/images',
  '/fonts',
]

/**
 * 檢查路徑是否為公開路由
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * 檢查路徑是否為靜態資源
 */
function isStaticPath(pathname: string): boolean {
  return STATIC_PATHS.some(path => pathname.startsWith(path))
}

/**
 * Next.js Middleware 入口
 * 處理認證狀態檢查和路由保護
 */
export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth

  // 跳過靜態資源
  if (isStaticPath(pathname)) {
    return NextResponse.next()
  }

  // 根路徑處理
  if (pathname === '/') {
    const redirectUrl = isAuthenticated ? '/dashboard' : '/auth/login'
    return NextResponse.redirect(new URL(redirectUrl, req.url))
  }

  // 公開路由處理
  if (isPublicRoute(pathname)) {
    // 已登入用戶訪問登入頁面，重定向至儀表板
    if (isAuthenticated && pathname === '/auth/login') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  }

  // 受保護路由：未認證用戶重定向至登入頁面
  if (!isAuthenticated) {
    const loginUrl = new URL('/auth/login', req.url)
    // 保存原始請求路徑，登入後重定向
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

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
