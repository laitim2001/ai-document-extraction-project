/**
 * @fileoverview PDF 載入骨架屏組件
 * @description
 *   在 PDF 文件載入期間顯示的載入狀態佔位組件，
 *   提供視覺回饋以改善用戶體驗。
 *
 * @module src/components/features/document-preview
 * @since Epic 13 - Story 13.1 (文件預覽組件與欄位高亮)
 * @lastModified 2025-01-02
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Loader2 } from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface PDFLoadingSkeletonProps {
  /** 自定義 CSS 類名 */
  className?: string
  /** 載入提示文字 */
  loadingText?: string
  /** 是否顯示載入圖示 */
  showIcon?: boolean
}

// ============================================================
// Component
// ============================================================

/**
 * @component PDFLoadingSkeleton
 * @description PDF 載入骨架屏，在文件載入時提供視覺回饋
 */
export function PDFLoadingSkeleton({
  className,
  loadingText = '載入文件中...',
  showIcon = true,
}: PDFLoadingSkeletonProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'w-full h-full min-h-[400px]',
        'bg-muted/30 rounded-lg',
        className
      )}
    >
      {/* 文件圖示 */}
      {showIcon && (
        <div className="relative mb-4">
          <FileText className="h-16 w-16 text-muted-foreground/50" />
          <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 text-primary animate-spin" />
        </div>
      )}

      {/* 載入文字 */}
      <p className="text-sm text-muted-foreground mb-4">{loadingText}</p>

      {/* 骨架屏模擬文件內容 */}
      <div className="w-full max-w-md space-y-3 px-8">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <div className="pt-4">
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  )
}

PDFLoadingSkeleton.displayName = 'PDFLoadingSkeleton'
