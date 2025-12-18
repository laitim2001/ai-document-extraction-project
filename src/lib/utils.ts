/**
 * @fileoverview 通用工具函數庫
 * @description
 *   本模組提供項目中常用的工具函數集合。
 *   主要包含 CSS 類名合併和其他通用輔助函數。
 *
 * @module src/lib/utils
 * @author Development Team
 * @since Epic 1 - Story 1.0 (Project Init Foundation)
 * @lastModified 2025-12-17
 *
 * @features
 *   - Tailwind CSS 類名智能合併
 *
 * @dependencies
 *   - clsx - 條件類名處理
 *   - tailwind-merge - Tailwind 類名衝突解決
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合併 CSS 類名並解決 Tailwind CSS 衝突
 *
 * @description
 *   結合 clsx 的條件類名處理和 tailwind-merge 的衝突解決能力。
 *   例如：cn('px-2', 'px-4') 會返回 'px-4'（後者覆蓋前者）
 *
 * @param inputs - 要合併的類名（支援字符串、物件、陣列）
 * @returns 合併後的類名字符串
 *
 * @example
 *   cn('px-2 py-1', isActive && 'bg-primary', { 'text-white': isActive })
 *   // 返回: 'px-2 py-1 bg-primary text-white'（當 isActive 為 true 時）
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
