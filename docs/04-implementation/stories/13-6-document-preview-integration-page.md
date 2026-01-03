# Story 13-6: 文件預覽整合測試頁面

## Story

**As a** 系統管理員或開發人員
**I want** 一個完整的文件預覽整合頁面，整合 PDF 預覽、欄位高亮、提取欄位面板和映射配置功能
**So that** 我可以在單一介面中測試和驗證 Epic 13 的所有功能，並作為未來審核流程的整合基礎

---

## Background / 背景說明

### 問題陳述

Epic 13 已完成 5 個 Story（13-1 至 13-5），實現了：
- **Story 13-1**: PDF 預覽與欄位高亮組件（PDFViewer, FieldHighlightOverlay）
- **Story 13-2**: 提取欄位面板（ExtractedFieldsPanel, FieldCard, FieldFilters）
- **Story 13-3**: 映射配置 UI（MappingConfigPanel, RuleEditor, ConfigSelector）
- **Story 13-4**: 自動高亮規則引擎
- **Story 13-5**: 預覽快取優化

然而，這些組件目前分散在各自的目錄中，**缺少一個整合頁面**來展示和測試完整的工作流程。

### 業務價值

1. **功能驗證**: 提供完整的 E2E 測試環境
2. **開發參考**: 作為組件整合的參考實現
3. **Demo 展示**: 可用於向利益相關者展示系統能力
4. **審核基礎**: 為 Epic 3（審核工作流）提供可重用的預覽介面

### 範圍定義

| 包含 | 不包含 |
|------|--------|
| 整合現有 Epic 13 組件 | 新增全新功能 |
| 管理員測試頁面 | 生產環境審核頁面 |
| 文件上傳與處理觸發 | 修改現有 API 邏輯 |
| 三層映射配置切換 | 新增映射規則引擎 |

---

## Acceptance Criteria / 驗收標準

### AC1: 頁面路由與權限
- [ ] 頁面路徑為 `/admin/document-preview-test`
- [ ] 僅限 ADMIN 角色可訪問
- [ ] 頁面標題顯示「文件預覽整合測試」
- [ ] 包含返回管理後台的導航連結

### AC2: 文件上傳區塊
- [ ] 提供文件上傳區域（支援拖放）
- [ ] 支援 PDF、PNG、JPG 格式
- [ ] 顯示上傳進度指示器
- [ ] 上傳後自動觸發 OCR 處理

### AC3: PDF 預覽整合
- [ ] 使用 `DynamicPDFViewer` 組件顯示文件
- [ ] 支援縮放控制（50%-200%）
- [ ] 支援多頁導航
- [ ] 欄位高亮覆蓋層正確渲染

### AC4: 提取欄位面板整合
- [ ] 使用 `ExtractedFieldsPanel` 顯示提取結果
- [ ] 支援欄位篩選（來源、信心度）
- [ ] 點擊欄位時高亮對應 PDF 區域
- [ ] 顯示欄位信心度指標

### AC5: 映射配置面板整合
- [ ] 使用 `MappingConfigPanel` 進行映射配置
- [ ] 支援 GLOBAL / COMPANY / FORMAT 三層切換
- [ ] 支援規則拖放排序
- [ ] 即時預覽映射結果

### AC6: 組件互動協調
- [ ] PDF 預覽與欄位面板雙向聯動
- [ ] 映射配置變更即時反映在預覽中
- [ ] 提供全域狀態管理（Zustand store）
- [ ] 支援重置和清除操作

### AC7: 測試數據支援
- [ ] 提供載入範例文件按鈕
- [ ] 支援載入既有批次處理結果
- [ ] 顯示處理狀態和錯誤訊息

---

## Tasks / 開發任務

### Task 1: 頁面基礎架構 [3 pts]

#### Subtask 1.1: 建立頁面路由
- 建立 `src/app/(dashboard)/admin/document-preview-test/page.tsx`
- 配置 ADMIN 角色權限檢查
- 設置頁面 metadata

#### Subtask 1.2: 建立頁面佈局
- 三欄式佈局：左（欄位面板）、中（PDF 預覽）、右（映射配置）
- 響應式設計（可折疊側邊欄）
- 固定頂部操作工具列

#### Subtask 1.3: 建立狀態管理
- 建立 `src/stores/document-preview-test-store.ts`
- 管理：當前文件、提取欄位、選中欄位、映射配置

### Task 2: 文件上傳模組 [2 pts]

#### Subtask 2.1: 建立上傳組件
- 建立 `TestFileUploader` 組件
- 整合 react-dropzone
- 支援拖放和點擊上傳

#### Subtask 2.2: 處理觸發邏輯
- 上傳後調用 `/api/v1/documents/upload`
- 觸發 OCR 處理
- 輪詢處理狀態直到完成

### Task 3: 預覽區塊整合 [2 pts]

#### Subtask 3.1: PDF 預覽整合
- 整合 `DynamicPDFViewer` 組件
- 配置縮放和頁面控制
- 整合 `FieldHighlightOverlay`

#### Subtask 3.2: 欄位高亮互動
- 訂閱 store 中的 selectedField
- 高亮顯示選中欄位
- 支援點擊高亮區域選擇欄位

### Task 4: 欄位面板整合 [2 pts]

#### Subtask 4.1: 欄位面板整合
- 整合 `ExtractedFieldsPanel` 組件
- 配置欄位點擊回調
- 整合篩選功能

#### Subtask 4.2: 雙向聯動
- 欄位點擊 → 更新 store → PDF 高亮
- PDF 區域點擊 → 更新 store → 欄位選中

### Task 5: 映射配置整合 [3 pts]

#### Subtask 5.1: 映射面板整合
- 整合 `MappingConfigPanel` 組件
- 配置三層作用域切換
- 整合規則編輯器

#### Subtask 5.2: 即時預覽
- 配置變更觸發預覽更新
- 整合 `MappingPreview` 組件
- 顯示映射結果差異

### Task 6: 測試輔助功能 [1 pt]

#### Subtask 6.1: 範例數據載入
- 提供載入範例文件按鈕
- 從既有批次載入測試數據
- 支援清除/重置功能

---

## Story Points: 13

---

## Dev Notes / 開發備註

### 現有組件索引

```typescript
// 文件預覽組件 (Story 13-1, 13-2)
import {
  PDFViewer,
  DynamicPDFViewer,
  PDFControls,
  FieldHighlightOverlay,
  ExtractedFieldsPanel,
  FieldCard,
  FieldFilters,
} from '@/components/features/document-preview';

// 映射配置組件 (Story 13-3)
import {
  MappingConfigPanel,
  ConfigSelector,
  SourceFieldSelector,
  TargetFieldSelector,
  MappingRuleList,
  RuleEditor,
  MappingPreview,
  TransformConfigPanel,
} from '@/components/features/mapping-config';
```

### API 端點

| 端點 | 方法 | 用途 |
|------|------|------|
| `/api/v1/documents/upload` | POST | 上傳文件 |
| `/api/v1/documents/[id]` | GET | 獲取文件詳情 |
| `/api/v1/field-mapping-configs` | GET | 獲取映射配置列表 |
| `/api/v1/field-mapping-configs/[id]/test` | POST | 測試映射配置 |

### 頁面佈局參考

```
┌──────────────────────────────────────────────────────────────────┐
│ 🔧 文件預覽整合測試                    [上傳文件] [載入範例] [重置] │
├──────────────┬──────────────────────────────┬────────────────────┤
│              │                              │                    │
│  欄位面板    │      PDF 預覽區域            │   映射配置面板     │
│  (300px)     │      (自適應)                │   (400px)          │
│              │                              │                    │
│  - 篩選器    │   ┌─────────────────────┐    │   - 作用域選擇    │
│  - 欄位列表  │   │                     │    │   - 規則列表      │
│  - 信心度    │   │     PDF + 高亮      │    │   - 規則編輯      │
│              │   │                     │    │   - 即時預覽      │
│              │   └─────────────────────┘    │                    │
│              │   [◀] [1/5] [▶] [🔍 100%]   │                    │
└──────────────┴──────────────────────────────┴────────────────────┘
```

### 狀態管理結構

```typescript
interface DocumentPreviewTestState {
  // 文件狀態
  currentFile: UploadedFile | null;
  processingStatus: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

  // 提取結果
  extractedFields: ExtractedField[];
  selectedFieldId: string | null;
  fieldFilters: FieldFilters;

  // 映射配置
  currentScope: 'GLOBAL' | 'COMPANY' | 'FORMAT';
  selectedCompanyId: string | null;
  selectedFormatId: string | null;
  mappingRules: MappingRule[];

  // PDF 狀態
  currentPage: number;
  totalPages: number;
  zoomLevel: number;

  // Actions
  setCurrentFile: (file: UploadedFile | null) => void;
  setSelectedField: (fieldId: string | null) => void;
  updateMappingRules: (rules: MappingRule[]) => void;
  reset: () => void;
}
```

---

## UI/UX Design Notes

### 設計原則
1. **整合優先**: 重用現有組件，不重新設計
2. **測試導向**: 提供清晰的測試操作流程
3. **狀態可見**: 處理狀態和錯誤訊息明確顯示
4. **響應式**: 支援不同螢幕尺寸

### 互動流程
1. 上傳文件 → 顯示上傳進度
2. 處理完成 → 自動載入 PDF 預覽和提取欄位
3. 點擊欄位 → PDF 高亮對應區域
4. 配置映射 → 即時預覽映射結果
5. 測試映射 → 顯示完整映射輸出

---

## Dependencies / 依賴

### 前置 Story
- [x] Story 13-1: PDF 預覽與欄位高亮
- [x] Story 13-2: 提取欄位面板
- [x] Story 13-3: 映射配置 UI
- [x] Story 13-4: 自動高亮規則引擎
- [x] Story 13-5: 預覽快取優化

### 技術依賴
- react-pdf (已安裝)
- @dnd-kit/core (已安裝)
- zustand (已安裝)
- react-dropzone (已安裝)

---

## Metadata

| 項目 | 值 |
|------|-----|
| Epic | Epic 13 - 文件預覽與欄位映射配置介面 |
| Story ID | 13-6 |
| 優先級 | P2 |
| Story Points | 13 |
| 預估工時 | 2-3 天 |
| 狀態 | Ready for Dev |
| 建立日期 | 2026-01-03 |
| 作者 | Development Team |
