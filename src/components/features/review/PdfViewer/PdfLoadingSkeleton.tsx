/**
 * @fileoverview PDF 載入骨架組件
 * @description
 *   在 PDF 載入期間顯示的佔位骨架屏：
 *   - 顯示載入動畫
 *   - 模擬 A4 比例的空間
 *
 * @module src/components/features/review/PdfViewer
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 */

import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'

// ============================================================
// Component
// ============================================================

/**
 * PDF 載入骨架組件
 *
 * @example
 * ```tsx
 * <PdfLoadingSkeleton />
 * ```
 */
export function PdfLoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">載入 PDF 中...</p>
      {/* A4 比例骨架 (約 1:1.414) */}
      <Skeleton className="w-[400px] h-[566px]" />
    </div>
  )
}
