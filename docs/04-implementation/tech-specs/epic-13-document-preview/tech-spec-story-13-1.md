# Tech Spec: Story 13.1 - 文件預覽組件與欄位高亮

> **Version**: 1.0.0
> **Created**: 2026-01-02
> **Status**: Draft
> **Story Key**: STORY-13-1

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 13.1 |
| **Epic** | Epic 13 - 文件預覽與欄位映射 |
| **Estimated Effort** | 8 Story Points |
| **Dependencies** | Epic 0（DocumentFormat 模型）, Epic 2（文件提取結果） |
| **Blocking** | Story 13.2（欄位提取結果面板） |
| **FR Coverage** | FR9, FR10（審核相關功能） |

---

## Objective

實現基於 react-pdf 的 PDF 預覽組件，支援：
- PDF 文件渲染與導航控制
- 欄位位置高亮（bounding box 覆蓋層）
- 座標系統轉換（PDF 座標 → 螢幕座標）
- 欄位點擊互動與聯動

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-13.1.1 | PDF 預覽使用 react-pdf 渲染 | PDFViewer 組件整合 react-pdf |
| AC-13.1.2 | 支援縮放、翻頁、導航控制 | PDFControls 組件提供控制按鈕 |
| AC-13.1.3 | 欄位位置疊加高亮框 | FieldHighlightOverlay 組件渲染 bounding box |
| AC-13.1.4 | 點擊高亮區域觸發聯動 | onFieldClick 回調通知父組件 |
| AC-13.1.5 | PDF 載入時間 < 2 秒 | 分頁懶加載 + 預載入策略 |
| AC-13.1.6 | 高亮渲染延遲 < 100ms | Canvas 批量渲染 + requestAnimationFrame |

---

## Implementation Guide

### Phase 1: PDF 渲染基礎組件 (3 points)

#### 1.1 安裝依賴

```bash
npm install react-pdf pdfjs-dist
```

#### 1.2 PDFViewer 組件

```typescript
// src/components/features/document-preview/PDFViewer.tsx

/**
 * @fileoverview PDF 文件預覽組件
 * @module src/components/features/document-preview
 * @since Epic 13 - Story 13.1
 */

'use client';

import * as React from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// 設置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export interface BoundingBox {
  fieldId: string;
  fieldName: string;
  page: number;
  x: number;      // PDF 座標 (左上角)
  y: number;      // PDF 座標 (左上角)
  width: number;  // PDF 單位
  height: number; // PDF 單位
  confidence: number;
}

export interface PDFViewerProps {
  /** PDF 文件 URL 或 Blob */
  file: string | Blob;
  /** 欄位高亮框資料 */
  boundingBoxes?: BoundingBox[];
  /** 當前選中的欄位 ID */
  selectedFieldId?: string | null;
  /** 欄位點擊回調 */
  onFieldClick?: (fieldId: string) => void;
  /** 初始頁碼 */
  initialPage?: number;
  /** 初始縮放比例 */
  initialScale?: number;
  /** 類名 */
  className?: string;
}

export function PDFViewer({
  file,
  boundingBoxes = [],
  selectedFieldId,
  onFieldClick,
  initialPage = 1,
  initialScale = 1.0,
  className,
}: PDFViewerProps) {
  const [numPages, setNumPages] = React.useState<number>(0);
  const [currentPage, setCurrentPage] = React.useState(initialPage);
  const [scale, setScale] = React.useState(initialScale);
  const [pageSize, setPageSize] = React.useState({ width: 0, height: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = React.useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
    },
    []
  );

  const onPageLoadSuccess = React.useCallback(
    ({ width, height }: { width: number; height: number }) => {
      setPageSize({ width, height });
    },
    []
  );

  // 過濾當前頁面的 bounding boxes
  const currentPageBoxes = React.useMemo(
    () => boundingBoxes.filter((box) => box.page === currentPage),
    [boundingBoxes, currentPage]
  );

  return (
    <div className={cn('relative flex flex-col', className)}>
      {/* PDF 控制列 */}
      <PDFControls
        currentPage={currentPage}
        numPages={numPages}
        scale={scale}
        onPageChange={setCurrentPage}
        onScaleChange={setScale}
      />

      {/* PDF 渲染區域 */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto bg-gray-100"
      >
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<PDFLoadingSkeleton />}
          error={<PDFErrorDisplay />}
        >
          <div className="relative inline-block">
            <Page
              pageNumber={currentPage}
              scale={scale}
              onLoadSuccess={onPageLoadSuccess}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />

            {/* 欄位高亮覆蓋層 */}
            <FieldHighlightOverlay
              boxes={currentPageBoxes}
              pageSize={pageSize}
              scale={scale}
              selectedFieldId={selectedFieldId}
              onFieldClick={onFieldClick}
            />
          </div>
        </Document>
      </div>
    </div>
  );
}
```

#### 1.3 PDF 控制組件

```typescript
// src/components/features/document-preview/PDFControls.tsx

export interface PDFControlsProps {
  currentPage: number;
  numPages: number;
  scale: number;
  onPageChange: (page: number) => void;
  onScaleChange: (scale: number) => void;
}

const SCALE_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export function PDFControls({
  currentPage,
  numPages,
  scale,
  onPageChange,
  onScaleChange,
}: PDFControlsProps) {
  const handlePrevPage = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < numPages) onPageChange(currentPage + 1);
  };

  const handleZoomIn = () => {
    const nextScale = SCALE_OPTIONS.find((s) => s > scale) ?? scale;
    onScaleChange(nextScale);
  };

  const handleZoomOut = () => {
    const prevScale = [...SCALE_OPTIONS].reverse().find((s) => s < scale) ?? scale;
    onScaleChange(prevScale);
  };

  return (
    <div className="flex items-center justify-between border-b bg-white px-4 py-2">
      {/* 頁碼導航 */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <span className="text-sm">
          {currentPage} / {numPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={handleNextPage}
          disabled={currentPage >= numPages}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* 縮放控制 */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={handleZoomOut}>
          <ZoomOutIcon className="h-4 w-4" />
        </Button>
        <Select
          value={String(scale)}
          onValueChange={(v) => onScaleChange(Number(v))}
        >
          <SelectTrigger className="w-24">
            <SelectValue>{Math.round(scale * 100)}%</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SCALE_OPTIONS.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {Math.round(s * 100)}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={handleZoomIn}>
          <ZoomInIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

### Phase 2: 欄位高亮覆蓋層 (3 points)

#### 2.1 座標轉換工具

```typescript
// src/lib/pdf/coordinate-transform.ts

/**
 * @fileoverview PDF 座標系統轉換工具
 * @description
 *   PDF 座標系統：原點在左下角，Y 軸向上
 *   螢幕座標系統：原點在左上角，Y 軸向下
 */

export interface PDFCoordinate {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenCoordinate {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PageDimensions {
  width: number;
  height: number;
}

/**
 * 將 PDF 座標轉換為螢幕座標
 * @param pdfCoord - PDF 座標（左下角原點）
 * @param pageSize - 頁面尺寸
 * @param scale - 縮放比例
 * @returns 螢幕座標（左上角原點）
 */
export function pdfToScreen(
  pdfCoord: PDFCoordinate,
  pageSize: PageDimensions,
  scale: number
): ScreenCoordinate {
  // PDF Y 座標是從底部開始的，需要翻轉
  const top = (pageSize.height - pdfCoord.y - pdfCoord.height) * scale;
  const left = pdfCoord.x * scale;
  const width = pdfCoord.width * scale;
  const height = pdfCoord.height * scale;

  return { left, top, width, height };
}

/**
 * 將螢幕座標轉換為 PDF 座標
 * @param screenCoord - 螢幕座標（左上角原點）
 * @param pageSize - 頁面尺寸
 * @param scale - 縮放比例
 * @returns PDF 座標（左下角原點）
 */
export function screenToPdf(
  screenCoord: ScreenCoordinate,
  pageSize: PageDimensions,
  scale: number
): PDFCoordinate {
  const x = screenCoord.left / scale;
  const width = screenCoord.width / scale;
  const height = screenCoord.height / scale;
  const y = pageSize.height - screenCoord.top / scale - height;

  return { x, y, width, height };
}
```

#### 2.2 欄位高亮覆蓋層組件

```typescript
// src/components/features/document-preview/FieldHighlightOverlay.tsx

/**
 * @fileoverview 欄位高亮覆蓋層組件
 * @description 在 PDF 頁面上渲染欄位的 bounding box 高亮
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { pdfToScreen, type PageDimensions } from '@/lib/pdf/coordinate-transform';
import type { BoundingBox } from './PDFViewer';

export interface FieldHighlightOverlayProps {
  boxes: BoundingBox[];
  pageSize: PageDimensions;
  scale: number;
  selectedFieldId?: string | null;
  onFieldClick?: (fieldId: string) => void;
}

/** 根據信心度獲取顏色 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'border-green-500 bg-green-500/10';
  if (confidence >= 0.7) return 'border-yellow-500 bg-yellow-500/10';
  return 'border-red-500 bg-red-500/10';
}

export function FieldHighlightOverlay({
  boxes,
  pageSize,
  scale,
  selectedFieldId,
  onFieldClick,
}: FieldHighlightOverlayProps) {
  // 使用 requestAnimationFrame 優化渲染
  const [renderedBoxes, setRenderedBoxes] = React.useState<BoundingBox[]>([]);

  React.useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setRenderedBoxes(boxes);
    });
    return () => cancelAnimationFrame(frameId);
  }, [boxes]);

  if (pageSize.width === 0 || pageSize.height === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      {renderedBoxes.map((box) => {
        const screenCoord = pdfToScreen(
          { x: box.x, y: box.y, width: box.width, height: box.height },
          pageSize,
          scale
        );

        const isSelected = box.fieldId === selectedFieldId;
        const colorClass = getConfidenceColor(box.confidence);

        return (
          <div
            key={box.fieldId}
            className={cn(
              'pointer-events-auto absolute cursor-pointer border-2 transition-all',
              colorClass,
              isSelected && 'ring-2 ring-blue-500 ring-offset-2'
            )}
            style={{
              left: `${screenCoord.left}px`,
              top: `${screenCoord.top}px`,
              width: `${screenCoord.width}px`,
              height: `${screenCoord.height}px`,
            }}
            onClick={() => onFieldClick?.(box.fieldId)}
            title={`${box.fieldName} (${Math.round(box.confidence * 100)}%)`}
          >
            {/* Tooltip 標籤 */}
            {isSelected && (
              <div className="absolute -top-6 left-0 whitespace-nowrap rounded bg-blue-500 px-2 py-0.5 text-xs text-white">
                {box.fieldName}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

### Phase 3: 效能優化與載入狀態 (2 points)

#### 3.1 載入骨架屏

```typescript
// src/components/features/document-preview/PDFLoadingSkeleton.tsx

export function PDFLoadingSkeleton() {
  return (
    <div className="flex h-96 w-full items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-4">
        <Loader2Icon className="h-8 w-8 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">載入 PDF 中...</span>
      </div>
    </div>
  );
}
```

#### 3.2 錯誤顯示組件

```typescript
// src/components/features/document-preview/PDFErrorDisplay.tsx

export function PDFErrorDisplay() {
  return (
    <div className="flex h-96 w-full items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertCircleIcon className="h-12 w-12 text-red-500" />
        <div>
          <p className="font-medium text-gray-900">無法載入 PDF</p>
          <p className="text-sm text-gray-500">
            請確認文件格式正確，或稍後重試
          </p>
        </div>
      </div>
    </div>
  );
}
```

#### 3.3 預載入 Hook

```typescript
// src/hooks/use-pdf-preload.ts

/**
 * @fileoverview PDF 預載入 Hook
 * @description 預先載入相鄰頁面以提升翻頁體驗
 */

export function usePDFPreload(
  file: string | Blob,
  currentPage: number,
  numPages: number,
  preloadRange: number = 2
) {
  const preloadedPages = React.useRef<Set<number>>(new Set());

  React.useEffect(() => {
    const pagesToPreload: number[] = [];

    for (let i = 1; i <= preloadRange; i++) {
      if (currentPage + i <= numPages) {
        pagesToPreload.push(currentPage + i);
      }
      if (currentPage - i >= 1) {
        pagesToPreload.push(currentPage - i);
      }
    }

    pagesToPreload.forEach((page) => {
      if (!preloadedPages.current.has(page)) {
        preloadedPages.current.add(page);
        // 預載入邏輯由 react-pdf 內部處理
        // 這裡只做狀態追蹤
      }
    });
  }, [currentPage, numPages, preloadRange]);

  return preloadedPages.current;
}
```

---

## Project Structure

```
src/
├── components/
│   └── features/
│       └── document-preview/
│           ├── index.ts                    # 模組導出
│           ├── PDFViewer.tsx               # PDF 預覽主組件
│           ├── PDFControls.tsx             # 控制列組件
│           ├── FieldHighlightOverlay.tsx   # 欄位高亮覆蓋層
│           ├── PDFLoadingSkeleton.tsx      # 載入骨架屏
│           └── PDFErrorDisplay.tsx         # 錯誤顯示
├── lib/
│   └── pdf/
│       ├── index.ts                        # PDF 工具導出
│       └── coordinate-transform.ts         # 座標轉換工具
└── hooks/
    └── use-pdf-preload.ts                  # PDF 預載入 Hook
```

---

## API Endpoints

此 Story 主要是前端組件實現，無需新增 API 端點。

### 依賴的現有 API

| 端點 | 方法 | 用途 |
|------|------|------|
| `/api/v1/files/:id/download` | GET | 獲取 PDF 文件 |
| `/api/v1/files/:id/extraction` | GET | 獲取欄位提取結果（含 bounding box） |

---

## Verification Checklist

### 功能驗證

- [ ] PDF 文件可正常渲染顯示
- [ ] 翻頁控制正常工作（上一頁/下一頁）
- [ ] 頁碼跳轉功能正常
- [ ] 縮放控制正常工作（放大/縮小/預設比例）
- [ ] Bounding box 正確顯示在欄位位置上
- [ ] 座標轉換正確（高亮框與實際欄位位置對齊）
- [ ] 點擊高亮框觸發 onFieldClick 回調
- [ ] 選中狀態正確顯示（藍色外框）
- [ ] 信心度顏色編碼正確（綠/黃/紅）

### 效能驗證

- [ ] PDF 載入時間 < 2 秒（10 頁以內）
- [ ] 高亮渲染延遲 < 100ms
- [ ] 翻頁響應流暢無卡頓
- [ ] 縮放操作流暢

### 相容性驗證

- [ ] Chrome 最新版本
- [ ] Edge 最新版本
- [ ] Firefox 最新版本（可選）

---

## Dependencies

| 依賴 | 版本 | 用途 |
|------|------|------|
| react-pdf | ^7.x | PDF 渲染 |
| pdfjs-dist | ^3.x | PDF.js 核心庫 |

---

## Risk Mitigation

| 風險 | 機率 | 影響 | 緩解措施 |
|------|------|------|----------|
| PDF.js worker 載入失敗 | 低 | 高 | 使用 CDN 備援 + 本地 fallback |
| 大型 PDF 記憶體溢出 | 中 | 高 | 實現分頁載入，限制預載入範圍 |
| Bounding box 座標不準確 | 中 | 中 | 詳細測試各種 PDF 類型 |
| 跨瀏覽器相容性問題 | 低 | 中 | 使用 polyfill + 瀏覽器檢測 |

---

*Tech Spec 建立日期: 2026-01-02*
*狀態: Draft*
