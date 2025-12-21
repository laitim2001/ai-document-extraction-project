/**
 * @fileoverview Theme Provider 組件
 * @description
 *   提供應用程式主題切換功能，支援淺色、深色和系統主題模式。
 *   使用 next-themes 實現主題持久化和無閃爍切換。
 *
 * @module src/providers/ThemeProvider
 * @since CHANGE-001 - Dashboard Layout Redesign
 * @lastModified 2025-12-21
 *
 * @dependencies
 *   - next-themes - 主題管理套件
 */

'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

/**
 * @component ThemeProvider
 * @description 主題提供者組件，包裝 next-themes 的 ThemeProvider
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
