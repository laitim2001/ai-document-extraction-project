/**
 * @fileoverview 版本差異查看器組件
 * @description
 *   顯示兩個版本之間的差異，包含：
 *   - 欄位差異表格
 *   - Pattern 差異高亮顯示
 *   - 差異摘要
 *   - 版本元數據對比
 *
 * @module src/components/features/rule-version/VersionDiffViewer
 * @since Epic 4 - Story 4.7 (規則版本歷史管理)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - diff - 文字差異計算
 *   - @/lib/utils - 工具函數
 *   - @/types/version - 類型定義
 */

'use client'

import { diffLines, Change } from 'diff'
import { cn } from '@/lib/utils'
import type {
  VersionDetail,
  FieldDifference,
  PatternDiff,
  ExtractionPattern,
} from '@/types/version'

// ============================================================
// Helper Functions
// ============================================================

/**
 * 格式化日期時間
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 將 ExtractionPattern 序列化為字符串用於顯示
 */
function serializePattern(pattern: ExtractionPattern | null): string {
  if (!pattern) return '(無 Pattern)'
  return JSON.stringify(pattern, null, 2)
}

// ============================================================
// Types
// ============================================================

interface VersionDiffViewerProps {
  /** 版本 1 詳情 */
  version1: VersionDetail
  /** 版本 2 詳情 */
  version2: VersionDetail
  /** 欄位差異列表 */
  differences: FieldDifference[]
  /** Pattern 差異分析 */
  patternDiff: PatternDiff
}

// ============================================================
// Component
// ============================================================

/**
 * 版本差異查看器
 *
 * @description
 *   顯示兩個版本之間的所有差異，包含欄位級別差異和 Pattern 差異。
 *   使用不同顏色高亮顯示變更、新增和移除的內容。
 *
 * @example
 * ```tsx
 * <VersionDiffViewer
 *   version1={data.version1}
 *   version2={data.version2}
 *   differences={data.differences}
 *   patternDiff={data.patternDiff}
 * />
 * ```
 */
export function VersionDiffViewer({
  version1,
  version2,
  differences,
  patternDiff,
}: VersionDiffViewerProps) {
  // 計算 Pattern 的行級差異用於高亮顯示
  const pattern1Str = serializePattern(version1.extractionPattern)
  const pattern2Str = serializePattern(version2.extractionPattern)
  const patternChanges = diffLines(pattern1Str, pattern2Str)

  return (
    <div className="space-y-6">
      {/* 欄位差異表格 */}
      <div>
        <h4 className="font-medium mb-3">欄位差異</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium">
                  欄位
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium">
                  版本 {version1.version}
                </th>
                <th className="px-4 py-2 text-left text-sm font-medium">
                  版本 {version2.version}
                </th>
              </tr>
            </thead>
            <tbody>
              {differences.map((diff) => (
                <tr
                  key={diff.field}
                  className={cn(
                    'border-t',
                    diff.changed && 'bg-yellow-50 dark:bg-yellow-900/10'
                  )}
                >
                  <td className="px-4 py-2 text-sm font-medium">
                    {diff.label}
                    {diff.changed && (
                      <span className="ml-2 text-xs text-yellow-600">
                        已變更
                      </span>
                    )}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-sm',
                      diff.changed && 'text-red-600 line-through'
                    )}
                  >
                    {String(diff.value1)}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-sm',
                      diff.changed && 'text-green-600 font-medium'
                    )}
                  >
                    {String(diff.value2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pattern 差異 */}
      <div>
        <h4 className="font-medium mb-3">Pattern 差異</h4>
        <div className="grid grid-cols-2 gap-4">
          {/* 版本 1 Pattern */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-muted-foreground">
                版本 {version1.version}
              </h5>
              <span className="text-xs text-muted-foreground">
                {formatDate(version1.createdAt)}
              </span>
            </div>
            <pre className="bg-muted p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap max-h-48">
              {pattern1Str}
            </pre>
          </div>

          {/* 版本 2 Pattern */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-muted-foreground">
                版本 {version2.version}
              </h5>
              <span className="text-xs text-muted-foreground">
                {formatDate(version2.createdAt)}
              </span>
            </div>
            <pre className="bg-muted p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap max-h-48">
              {pattern2Str}
            </pre>
          </div>
        </div>

        {/* 統一差異視圖 */}
        <div className="mt-4 border rounded-lg p-4">
          <h5 className="text-sm font-medium text-muted-foreground mb-2">
            差異高亮
          </h5>
          <pre className="bg-muted p-3 rounded text-sm overflow-x-auto max-h-64">
            {patternChanges.map((part: Change, index: number) => (
              <span
                key={index}
                className={cn(
                  part.added &&
                    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                  part.removed &&
                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                )}
              >
                {part.value}
              </span>
            ))}
          </pre>
        </div>

        {/* Pattern 差異摘要 */}
        {(patternDiff.added.length > 0 || patternDiff.removed.length > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {patternDiff.removed.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <h6 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                  移除的內容
                </h6>
                <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                  {patternDiff.removed.slice(0, 5).map((line, i) => (
                    <li key={i} className="font-mono truncate">
                      - {line}
                    </li>
                  ))}
                  {patternDiff.removed.length > 5 && (
                    <li className="text-xs">
                      ...還有 {patternDiff.removed.length - 5} 項
                    </li>
                  )}
                </ul>
              </div>
            )}
            {patternDiff.added.length > 0 && (
              <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                <h6 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                  新增的內容
                </h6>
                <ul className="text-sm text-green-600 dark:text-green-400 space-y-1">
                  {patternDiff.added.slice(0, 5).map((line, i) => (
                    <li key={i} className="font-mono truncate">
                      + {line}
                    </li>
                  ))}
                  {patternDiff.added.length > 5 && (
                    <li className="text-xs">
                      ...還有 {patternDiff.added.length - 5} 項
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 版本元數據 */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="p-3 bg-muted rounded-lg">
          <h5 className="font-medium mb-2">版本 {version1.version} 資訊</h5>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">建立者</dt>
              <dd>{version1.createdBy.name || version1.createdBy.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">建立時間</dt>
              <dd>{formatDate(version1.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">變更原因</dt>
              <dd className="text-right max-w-[200px] truncate">
                {version1.changeReason || '-'}
              </dd>
            </div>
          </dl>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <h5 className="font-medium mb-2">版本 {version2.version} 資訊</h5>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">建立者</dt>
              <dd>{version2.createdBy.name || version2.createdBy.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">建立時間</dt>
              <dd>{formatDate(version2.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">變更原因</dt>
              <dd className="text-right max-w-[200px] truncate">
                {version2.changeReason || '-'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
