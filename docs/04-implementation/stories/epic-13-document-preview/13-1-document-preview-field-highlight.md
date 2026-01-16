# Story 13.1: 文件預覽組件與欄位高亮

**Status:** backlog

---

## Story

**As a** 系統管理員,
**I want** 在網頁上預覽上傳的文件，並看到 AI 識別的欄位位置被高亮顯示,
**So that** 我可以直觀地了解 AI 在文件的哪些位置識別到了數據，便於驗證和配置映射規則。

---

## 背景說明

### 問題陳述

目前系統處理文件後，用戶只能看到提取的結構化數據，但無法：
- 看到原始文件的視覺呈現
- 了解每個欄位數據來自文件的哪個位置
- 驗證 AI 識別的位置是否正確

### 解決方案

參考 Azure Document Intelligence Portal 的設計，提供：
- PDF 文件在網頁內嵌預覽
- 識別的欄位以彩色邊框高亮標記
- 點擊高亮區域可查看對應欄位詳情
- 支援多頁文件導航

### 參考設計

![Azure DI Portal](azure_DI_Portal_preview_document_content_and_fieldmapping_v1.png)

---

## Acceptance Criteria

### AC1: PDF 文件內嵌預覽

**Given** 一份已處理的 PDF 文件
**When** 用戶進入文件詳情頁面
**Then**：
  - PDF 在頁面左側區域完整顯示
  - 支援縮放（zoom in/out）
  - 支援拖曳移動視圖
  - 顯示當前頁碼和總頁數

### AC2: 多頁文件導航

**Given** 一份多頁 PDF 文件（如 "1 of 2"）
**When** 用戶查看文件
**Then**：
  - 顯示頁面導航器（上一頁/下一頁按鈕）
  - 顯示頁碼輸入框可直接跳轉
  - 顯示縮圖列表供快速導航
  - 切換頁面時同步更新欄位高亮

### AC3: 欄位高亮顯示

**Given** Azure DI 返回的欄位座標資訊（boundingBox）
**When** PDF 渲染完成後
**Then**：
  - 每個識別的欄位以彩色半透明邊框標記
  - 不同欄位類型使用不同顏色區分
  - 高亮框不遮擋原始文件內容
  - 高亮框隨頁面縮放自動調整大小

### AC4: 高亮互動功能

**Given** 文件預覽區域的欄位高亮
**When** 用戶與高亮區域互動
**Then**：
  - 滑鼠懸停：顯示 Tooltip 包含欄位名稱和提取值
  - 點擊高亮：右側面板滾動到對應欄位並高亮
  - 選中狀態：當前選中的欄位高亮框加粗顯示

### AC5: 圖片文件支援

**Given** 一份圖片格式的文件（PNG, JPG, TIFF）
**When** 用戶進入文件詳情頁面
**Then**：
  - 圖片正常顯示在預覽區域
  - 欄位高亮功能正常運作
  - 支援縮放和拖曳

---

## Tasks / Subtasks

- [ ] **Task 1: PDF 渲染組件** (AC: #1, #2)
  - [ ] 1.1 安裝 `@react-pdf-viewer/core` 套件
  - [ ] 1.2 建立 `src/components/features/document-preview/PdfViewer.tsx`
  - [ ] 1.3 實現縮放控制（zoom slider）
  - [ ] 1.4 實現頁面導航（上一頁/下一頁/頁碼輸入）
  - [ ] 1.5 實現頁面縮圖側邊欄

- [ ] **Task 2: 高亮 Overlay 層** (AC: #3)
  - [ ] 2.1 建立 `src/components/features/document-preview/FieldHighlightOverlay.tsx`
  - [ ] 2.2 實現 Canvas 或 SVG overlay 層
  - [ ] 2.3 實現 boundingBox 座標轉換（Azure DI → 像素）
  - [ ] 2.4 實現欄位顏色映射邏輯
  - [ ] 2.5 實現高亮框隨縮放自動調整

- [ ] **Task 3: 互動功能** (AC: #4)
  - [ ] 3.1 實現滑鼠懸停 Tooltip
  - [ ] 3.2 實現點擊選中功能
  - [ ] 3.3 實現選中狀態視覺效果
  - [ ] 3.4 實現與右側面板的雙向聯動

- [ ] **Task 4: 圖片文件支援** (AC: #5)
  - [ ] 4.1 建立 `src/components/features/document-preview/ImageViewer.tsx`
  - [ ] 4.2 實現圖片縮放和拖曳
  - [ ] 4.3 複用 FieldHighlightOverlay 組件

- [ ] **Task 5: 整合組件** (AC: #1-5)
  - [ ] 5.1 建立 `src/components/features/document-preview/DocumentPreview.tsx`
  - [ ] 5.2 實現文件類型自動判斷（PDF vs 圖片）
  - [ ] 5.3 實現 loading 和 error 狀態
  - [ ] 5.4 匯出組件到 `src/components/features/document-preview/index.ts`

- [ ] **Task 6: 類型定義** (AC: #3, #4)
  - [ ] 6.1 建立 `src/types/document-preview.ts`
  - [ ] 6.2 定義 FieldAnnotation interface
  - [ ] 6.3 定義 BoundingBox interface
  - [ ] 6.4 定義 DocumentPreviewProps interface

- [ ] **Task 7: 驗證與測試** (AC: #1-5)
  - [ ] 7.1 TypeScript 類型檢查通過
  - [ ] 7.2 ESLint 檢查通過
  - [ ] 7.3 使用測試 PDF 驗證高亮準確度
  - [ ] 7.4 多頁 PDF 導航測試
  - [ ] 7.5 響應式設計測試

---

## Dev Notes

### 依賴項

- **Azure DI API**: 提供 boundingBox 座標數據
- **Story 2-2**: OCR 提取服務（提供原始文件存取）

### 推薦套件

```bash
# PDF 渲染
npm install @react-pdf-viewer/core @react-pdf-viewer/default-layout pdfjs-dist

# 或使用 react-pdf
npm install react-pdf
```

### 類型定義

```typescript
// src/types/document-preview.ts

export interface BoundingBox {
  /** 左上角 X 座標 (0-1 normalized) */
  x: number;
  /** 左上角 Y 座標 (0-1 normalized) */
  y: number;
  /** 寬度 (0-1 normalized) */
  width: number;
  /** 高度 (0-1 normalized) */
  height: number;
}

export interface FieldAnnotation {
  /** 唯一識別符 */
  fieldId: string;
  /** 欄位名稱 (e.g., "InvoiceId", "VendorName") */
  fieldName: string;
  /** 欄位顯示標籤 */
  displayLabel: string;
  /** 提取的值 */
  value: string | number | null;
  /** Azure DI 返回的邊界框 */
  boundingBox: BoundingBox;
  /** 頁碼 (1-based) */
  page: number;
  /** 高亮顏色 */
  color: string;
  /** 信心度 (0-100) */
  confidence: number;
}

export interface DocumentPreviewProps {
  /** 文件 URL 或 Base64 */
  fileUrl: string;
  /** 文件類型 */
  fileType: 'pdf' | 'image';
  /** 欄位標註列表 */
  annotations: FieldAnnotation[];
  /** 當前選中的欄位 ID */
  selectedFieldId?: string | null;
  /** 欄位點擊回調 */
  onFieldClick?: (fieldId: string) => void;
  /** 欄位懸停回調 */
  onFieldHover?: (fieldId: string | null) => void;
  /** 頁面變更回調 */
  onPageChange?: (page: number) => void;
  /** 類名 */
  className?: string;
}
```

### 欄位顏色映射

```typescript
// src/lib/constants/field-colors.ts

export const FIELD_COLOR_MAP: Record<string, string> = {
  // 金額相關 - 紅色系
  InvoiceTotal: '#EF4444',
  SubTotal: '#F87171',
  TotalTax: '#FCA5A5',
  AmountDue: '#DC2626',

  // 日期相關 - 藍色系
  InvoiceDate: '#3B82F6',
  DueDate: '#60A5FA',

  // 編號相關 - 綠色系
  InvoiceId: '#10B981',
  PurchaseOrder: '#34D399',

  // 地址相關 - 黃色系
  VendorAddress: '#F59E0B',
  CustomerAddress: '#FBBF24',

  // 公司名稱 - 紫色系
  VendorName: '#8B5CF6',
  CustomerName: '#A78BFA',

  // 預設顏色
  default: '#6B7280',
};

export function getFieldColor(fieldName: string): string {
  return FIELD_COLOR_MAP[fieldName] || FIELD_COLOR_MAP.default;
}
```

### 座標轉換邏輯

```typescript
// src/lib/utils/bounding-box.ts

/**
 * 將 Azure DI normalized 座標轉換為像素座標
 * Azure DI 返回的座標是 0-1 範圍的 normalized 值
 */
export function normalizedToPixels(
  boundingBox: BoundingBox,
  containerWidth: number,
  containerHeight: number
): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    left: boundingBox.x * containerWidth,
    top: boundingBox.y * containerHeight,
    width: boundingBox.width * containerWidth,
    height: boundingBox.height * containerHeight,
  };
}

/**
 * Azure DI polygon 格式轉換為 BoundingBox
 * Azure DI 有時返回 polygon 陣列而非 boundingBox
 */
export function polygonToBoundingBox(
  polygon: number[]
): BoundingBox {
  // polygon 格式: [x1, y1, x2, y2, x3, y3, x4, y4] (四個角)
  const xs = [polygon[0], polygon[2], polygon[4], polygon[6]];
  const ys = [polygon[1], polygon[3], polygon[5], polygon[7]];

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
```

### 組件結構

```typescript
// src/components/features/document-preview/DocumentPreview.tsx

'use client';

import * as React from 'react';
import { PdfViewer } from './PdfViewer';
import { ImageViewer } from './ImageViewer';
import { FieldHighlightOverlay } from './FieldHighlightOverlay';
import type { DocumentPreviewProps } from '@/types/document-preview';

export function DocumentPreview({
  fileUrl,
  fileType,
  annotations,
  selectedFieldId,
  onFieldClick,
  onFieldHover,
  onPageChange,
  className,
}: DocumentPreviewProps) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [scale, setScale] = React.useState(1);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);
  };

  // 過濾當前頁面的 annotations
  const currentPageAnnotations = annotations.filter(
    (a) => a.page === currentPage
  );

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* 文件渲染層 */}
      {fileType === 'pdf' ? (
        <PdfViewer
          fileUrl={fileUrl}
          currentPage={currentPage}
          scale={scale}
          onPageChange={handlePageChange}
          onTotalPagesChange={setTotalPages}
          onScaleChange={setScale}
        />
      ) : (
        <ImageViewer
          fileUrl={fileUrl}
          scale={scale}
          onScaleChange={setScale}
        />
      )}

      {/* 高亮 Overlay 層 */}
      <FieldHighlightOverlay
        annotations={currentPageAnnotations}
        selectedFieldId={selectedFieldId}
        scale={scale}
        onFieldClick={onFieldClick}
        onFieldHover={onFieldHover}
      />

      {/* 頁面導航 */}
      {fileType === 'pdf' && totalPages > 1 && (
        <PageNavigation
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}

      {/* 縮放控制 */}
      <ZoomControls
        scale={scale}
        onScaleChange={setScale}
      />
    </div>
  );
}
```

### 高亮 Overlay 組件

```typescript
// src/components/features/document-preview/FieldHighlightOverlay.tsx

'use client';

import * as React from 'react';
import { normalizedToPixels, getFieldColor } from '@/lib/utils/bounding-box';
import type { FieldAnnotation } from '@/types/document-preview';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FieldHighlightOverlayProps {
  annotations: FieldAnnotation[];
  selectedFieldId?: string | null;
  scale: number;
  containerWidth: number;
  containerHeight: number;
  onFieldClick?: (fieldId: string) => void;
  onFieldHover?: (fieldId: string | null) => void;
}

export function FieldHighlightOverlay({
  annotations,
  selectedFieldId,
  scale,
  containerWidth,
  containerHeight,
  onFieldClick,
  onFieldHover,
}: FieldHighlightOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {annotations.map((annotation) => {
        const pixels = normalizedToPixels(
          annotation.boundingBox,
          containerWidth * scale,
          containerHeight * scale
        );

        const isSelected = annotation.fieldId === selectedFieldId;

        return (
          <Tooltip key={annotation.fieldId}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'absolute border-2 cursor-pointer pointer-events-auto transition-all',
                  'hover:bg-opacity-20',
                  isSelected && 'border-4 shadow-lg'
                )}
                style={{
                  left: pixels.left,
                  top: pixels.top,
                  width: pixels.width,
                  height: pixels.height,
                  borderColor: annotation.color,
                  backgroundColor: `${annotation.color}20`,
                }}
                onClick={() => onFieldClick?.(annotation.fieldId)}
                onMouseEnter={() => onFieldHover?.(annotation.fieldId)}
                onMouseLeave={() => onFieldHover?.(null)}
              />
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <p className="font-medium">{annotation.displayLabel}</p>
                <p className="text-muted-foreground">{annotation.value}</p>
                <p className="text-xs text-muted-foreground">
                  信心度: {annotation.confidence}%
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
```

### 技術考量

1. **PDF.js Worker**: 需要正確配置 PDF.js worker 路徑
2. **效能**: 大型 PDF 需要 lazy loading，只渲染可見頁面
3. **座標系統**: Azure DI 座標為 normalized (0-1)，需轉換為像素
4. **響應式**: 容器大小變化時需重新計算高亮框位置

---

## UI/UX 設計

### 佈局設計

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  [◀ 上一頁]  頁面 1 / 2  [下一頁 ▶]    [🔍 75% ▼]          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │                    ┌──────────────┐                         │ │
│ │                    │ Invoice #    │ ← 高亮框 (綠色)         │ │
│ │                    └──────────────┘                         │ │
│ │                                                             │ │
│ │    ┌─────────────────────┐                                  │ │
│ │    │ DHL Express         │ ← 高亮框 (紫色)                  │ │
│ │    │ Company Logo        │                                  │ │
│ │    └─────────────────────┘                                  │ │
│ │                                                             │ │
│ │           ┌────────────┐                                    │ │
│ │           │ HKD 208.10 │ ← 高亮框 (紅色)                    │ │
│ │           └────────────┘                                    │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 顏色規範

| 欄位類型 | 顏色 | Hex |
|----------|------|-----|
| 金額 | 紅色 | #EF4444 |
| 日期 | 藍色 | #3B82F6 |
| 編號 | 綠色 | #10B981 |
| 地址 | 黃色 | #F59E0B |
| 公司名稱 | 紫色 | #8B5CF6 |

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 13.1 |
| Story Key | 13-1-document-preview-field-highlight |
| Epic | Epic 13: 欄位映射配置介面 |
| Dependencies | Story 2-2 (OCR 提取服務) |
| Estimated Points | 8 |

---

*Story created: 2026-01-02*
*Status: backlog*
