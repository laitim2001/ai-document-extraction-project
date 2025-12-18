/**
 * @fileoverview 審核詳情頁面佈局組件
 * @description
 *   根據螢幕尺寸提供兩種佈局模式：
 *   - 桌面版：可調整大小的並排面板（PDF 左側 / 審核面板右側）
 *   - 行動版：Tab 切換模式（PDF 標籤 / 審核標籤）
 *
 * @module src/components/features/review
 * @since Epic 3 - Story 3.2 (並排 PDF 審核介面)
 * @lastModified 2025-12-18
 *
 * @dependencies
 *   - react-resizable-panels - 可調整大小的面板
 *   - @/hooks/useMediaQuery - 響應式斷點偵測
 *   - @/components/ui/tabs - Tab 組件（行動版）
 *   - @/components/ui/resizable - 可調整面板組件
 */

'use client'

import type { ReactNode } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { FileText, ClipboardList } from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface ReviewDetailLayoutProps {
  /** PDF 檢視器組件 */
  pdfViewer: ReactNode
  /** 審核面板組件 */
  reviewPanel: ReactNode
}

// ============================================================
// Constants
// ============================================================

/**
 * 小螢幕斷點（1024px 以下使用 Tab 模式）
 */
const SMALL_SCREEN_BREAKPOINT = '(max-width: 1024px)'

/**
 * 面板預設大小比例
 */
const DEFAULT_PANEL_SIZE = {
  pdf: 60, // 60%
  review: 40, // 40%
}

/**
 * 面板最小大小比例
 */
const MIN_PANEL_SIZE = {
  pdf: 30, // 最小 30%
  review: 25, // 最小 25%
}

// ============================================================
// Component
// ============================================================

/**
 * 審核詳情頁面佈局組件
 *
 * @description
 *   根據螢幕尺寸自動切換佈局模式：
 *   - 寬度 > 1024px: 並排可調整面板
 *   - 寬度 ≤ 1024px: Tab 切換模式
 *
 * @example
 * ```tsx
 * <ReviewDetailLayout
 *   pdfViewer={<PdfViewer url={pdfUrl} pageCount={10} />}
 *   reviewPanel={<ReviewPanel data={reviewData} {...handlers} />}
 * />
 * ```
 */
export function ReviewDetailLayout({
  pdfViewer,
  reviewPanel,
}: ReviewDetailLayoutProps) {
  const isSmallScreen = useMediaQuery(SMALL_SCREEN_BREAKPOINT)

  // --- 行動版：Tab 切換模式 ---
  if (isSmallScreen) {
    return (
      <Tabs defaultValue="pdf" className="flex flex-col h-full">
        <TabsList className="grid w-full grid-cols-2 shrink-0">
          <TabsTrigger value="pdf" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            PDF 檢視
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            審核欄位
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pdf" className="flex-1 mt-0 overflow-hidden">
          <div className="h-full" data-testid="layout-pdf-tab">
            {pdfViewer}
          </div>
        </TabsContent>

        <TabsContent value="review" className="flex-1 mt-0 overflow-hidden">
          <div className="h-full" data-testid="layout-review-tab">
            {reviewPanel}
          </div>
        </TabsContent>
      </Tabs>
    )
  }

  // --- 桌面版：並排可調整面板 ---
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full rounded-lg border"
      data-testid="layout-resizable"
    >
      {/* PDF 檢視器面板 */}
      <ResizablePanel
        defaultSize={DEFAULT_PANEL_SIZE.pdf}
        minSize={MIN_PANEL_SIZE.pdf}
        className="min-h-0"
      >
        <div className="h-full overflow-hidden" data-testid="layout-pdf-panel">
          {pdfViewer}
        </div>
      </ResizablePanel>

      {/* 可拖拉分隔線 */}
      <ResizableHandle withHandle />

      {/* 審核面板 */}
      <ResizablePanel
        defaultSize={DEFAULT_PANEL_SIZE.review}
        minSize={MIN_PANEL_SIZE.review}
        className="min-h-0"
      >
        <div
          className="h-full overflow-hidden bg-background"
          data-testid="layout-review-panel"
        >
          {reviewPanel}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
