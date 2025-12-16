# Story 3.2: 並排 PDF 對照審核界面

**Status:** ready-for-dev

---

## Story

**As a** 數據處理員,
**I want** 在同一畫面看到原始 PDF 和提取結果的對照,
**So that** 我可以快速核對提取的準確性。

---

## Acceptance Criteria

### AC1: 並排佈局

**Given** 用戶進入發票審核頁面
**When** 頁面載入完成
**Then** 左側顯示原始 PDF 文件（可縮放、翻頁）
**And** 右側顯示提取結果表單

### AC2: 欄位-來源聯動

**Given** 審核界面顯示
**When** 用戶選中某個提取欄位
**Then** PDF 視圖自動滾動並高亮對應的來源位置

### AC3: PDF 翻頁功能

**Given** PDF 文件多頁
**When** 用戶翻頁
**Then** PDF 視圖支援快速翻頁導航
**And** 顯示當前頁碼 / 總頁數

### AC4: 響應式佈局

**Given** 用戶調整視窗大小
**When** 螢幕寬度變化
**Then** 並排佈局自適應調整比例

---

## Tasks / Subtasks

- [ ] **Task 1: 審核詳情頁面** (AC: #1)
  - [ ] 1.1 創建 `src/app/(dashboard)/review/[id]/page.tsx`
  - [ ] 1.2 實現並排佈局結構
  - [ ] 1.3 載入文件和提取結果

- [ ] **Task 2: PDF 檢視器組件** (AC: #1, #3)
  - [ ] 2.1 創建 `PdfViewer.tsx` 組件
  - [ ] 2.2 使用 react-pdf 庫
  - [ ] 2.3 實現縮放功能
  - [ ] 2.4 實現翻頁功能

- [ ] **Task 3: 欄位高亮功能** (AC: #2)
  - [ ] 3.1 解析欄位來源位置
  - [ ] 3.2 在 PDF 上繪製高亮框
  - [ ] 3.3 實現自動滾動定位

- [ ] **Task 4: 提取結果面板** (AC: #1)
  - [ ] 4.1 創建 `ReviewPanel.tsx` 組件
  - [ ] 4.2 分組顯示欄位
  - [ ] 4.3 可展開/收合欄位組

- [ ] **Task 5: 響應式佈局** (AC: #4)
  - [ ] 5.1 實現可拖動分隔線
  - [ ] 5.2 適應不同螢幕尺寸
  - [ ] 5.3 小螢幕切換為標籤頁

- [ ] **Task 6: 審核 API** (AC: #1)
  - [ ] 6.1 創建 GET `/api/review/[id]`
  - [ ] 6.2 返回文件、提取結果、PDF URL

- [ ] **Task 7: 驗證與測試** (AC: #1-4)
  - [ ] 7.1 測試 PDF 載入和顯示
  - [ ] 7.2 測試欄位高亮聯動
  - [ ] 7.3 測試響應式佈局

---

## Dev Notes

### 依賴項

- **Story 3.1**: 待審核列表

### Library Requirements

```bash
npm install react-pdf @react-pdf/renderer
```

### Architecture Compliance

```typescript
// src/components/features/review/PdfViewer.tsx
import { Document, Page, pdfjs } from 'react-pdf'

interface PdfViewerProps {
  url: string
  highlightPosition?: { page: number; x: number; y: number; width: number; height: number }
  onPageChange?: (page: number) => void
}

export function PdfViewer({ url, highlightPosition, onPageChange }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1)

  // 高亮指定位置
  useEffect(() => {
    if (highlightPosition) {
      setCurrentPage(highlightPosition.page)
      // 繪製高亮框邏輯
    }
  }, [highlightPosition])

  return (
    <div className="pdf-viewer">
      <div className="toolbar">
        <button onClick={() => setScale(s => s - 0.1)}>-</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(s => s + 0.1)}>+</button>
        <span>{currentPage} / {numPages}</span>
      </div>
      <Document file={url} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
        <Page pageNumber={currentPage} scale={scale} />
      </Document>
    </div>
  )
}
```

### References

- [Source: docs/03-epics/sections/epic-3-invoice-review-correction-workflow.md#story-32]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR10]
- [Source: docs/04-ux-design/sections/ux-03-review-interface.md]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 3.2 |
| Story Key | 3-2-side-by-side-pdf-review-interface |
| Epic | Epic 3: 發票審核與修正工作流 |
| FR Coverage | FR10, UX-03 |
| Dependencies | Story 3.1 |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
