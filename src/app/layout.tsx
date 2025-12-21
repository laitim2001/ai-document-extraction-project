/**
 * @fileoverview 應用程式根佈局組件
 * @description
 *   Next.js App Router 的根佈局文件，定義了整個應用程式的基本 HTML 結構。
 *   包含全局字體配置、語言設定和共用樣式。
 *
 *   設計考量：
 *   - 使用 Inter 字體確保跨平台一致性
 *   - 設定 zh-TW 語言屬性優化 SEO 和可訪問性
 *   - 統一導入全局 CSS 樣式
 *
 * @module src/app/layout
 * @author Development Team
 * @since Epic 1 - Story 1.0 (Project Init Foundation)
 * @lastModified 2025-12-17
 *
 * @features
 *   - 全局字體配置
 *   - SEO 元數據設定
 *   - 應用程式基礎結構
 *
 * @related
 *   - src/app/globals.css - 全局樣式
 *   - src/app/page.tsx - 首頁
 */

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { QueryProvider } from '@/providers/QueryProvider'
import { AuthProvider } from '@/providers/AuthProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Document Extraction',
  description: 'AI-powered document extraction and processing system for SCM invoice management',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <QueryProvider>{children}</QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
