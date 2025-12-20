/**
 * @fileoverview 文件來源類型常數定義
 * @description
 *   定義文件來源類型的配置常數，包含：
 *   - 來源類型顯示配置
 *   - 圖表顏色
 *   - 篩選選項
 *
 * @module src/lib/constants/source-types
 * @author Development Team
 * @since Epic 9 - Story 9.5 (自動獲取來源追蹤)
 * @lastModified 2025-12-20
 *
 * @dependencies
 *   - @prisma/client - DocumentSourceType enum
 *
 * @related
 *   - src/types/document-source.types.ts - 類型定義
 *   - src/services/document-source.service.ts - 業務邏輯
 */

import { DocumentSourceType } from '@prisma/client'

/**
 * 來源類型配置
 */
export const SOURCE_TYPE_CONFIG: Record<
  DocumentSourceType,
  {
    label: string
    labelEn: string
    icon: string
    color: string
    bgColor: string
    borderColor: string
  }
> = {
  MANUAL_UPLOAD: {
    label: '手動上傳',
    labelEn: 'Manual Upload',
    icon: 'Upload',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  },
  SHAREPOINT: {
    label: 'SharePoint',
    labelEn: 'SharePoint',
    icon: 'FileSpreadsheet',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
  },
  OUTLOOK: {
    label: 'Outlook 郵件',
    labelEn: 'Outlook',
    icon: 'Mail',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    borderColor: 'border-cyan-300',
  },
  API: {
    label: '外部 API',
    labelEn: 'External API',
    icon: 'Globe',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
  },
}

/**
 * 圖表顏色
 */
export const SOURCE_TYPE_CHART_COLORS: Record<DocumentSourceType, string> = {
  MANUAL_UPLOAD: '#6b7280',
  SHAREPOINT: '#3b82f6',
  OUTLOOK: '#06b6d4',
  API: '#8b5cf6',
}

/**
 * 來源類型選項 (用於篩選器)
 */
export const SOURCE_TYPE_OPTIONS = [
  { value: '', label: '所有來源' },
  { value: 'MANUAL_UPLOAD', label: '手動上傳' },
  { value: 'SHAREPOINT', label: 'SharePoint' },
  { value: 'OUTLOOK', label: 'Outlook 郵件' },
  { value: 'API', label: '外部 API' },
] as const

/**
 * 取得來源類型配置
 */
export function getSourceTypeConfig(sourceType: DocumentSourceType) {
  return (
    SOURCE_TYPE_CONFIG[sourceType] || {
      label: '未知',
      labelEn: 'Unknown',
      icon: 'HelpCircle',
      color: 'text-gray-400',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-300',
    }
  )
}

/**
 * 取得來源類型圖表顏色
 */
export function getSourceTypeChartColor(sourceType: DocumentSourceType): string {
  return SOURCE_TYPE_CHART_COLORS[sourceType] || '#94a3b8'
}
