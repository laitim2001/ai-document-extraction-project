'use client'

/**
 * @fileoverview React Query Provider
 * @description
 *   提供 TanStack Query (React Query) 的全局配置：
 *   - QueryClient 實例化
 *   - 預設查詢選項設定
 *   - 開發環境 DevTools 整合
 *
 * @module src/providers/QueryProvider
 * @author Development Team
 * @since Epic 7 - Story 7.1 (Processing Statistics Dashboard)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *
 * @related
 *   - src/app/layout.tsx - 根佈局
 *   - src/hooks/use-documents.ts - 文件查詢 hook
 */

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ============================================================
// Types
// ============================================================

interface QueryProviderProps {
  children: React.ReactNode
}

// ============================================================
// Component
// ============================================================

/**
 * React Query Provider 組件
 *
 * @description
 *   封裝 QueryClientProvider 並設定全局預設選項。
 *   使用 useState 確保 QueryClient 在伺服器和客戶端之間保持一致。
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 分鐘
            gcTime: 5 * 60 * 1000, // 5 分鐘（舊稱 cacheTime）
            refetchOnWindowFocus: false,
            retry: 2,
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
