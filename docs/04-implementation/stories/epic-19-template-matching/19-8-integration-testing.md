# Story 19.8: 模版匹配整合測試與驗證

**Status:** done

---

## Story

**As a** 開發者/測試者,
**I want** 有一個整合測試頁面來驗證完整的模版匹配流程,
**So that** 我可以確保從文件處理到模版導出的端到端流程正確運作。

---

## 背景說明

### 問題陳述

Epic 19 包含多個相互依賴的 Stories，需要一個整合測試頁面來：

1. 驗證完整的端到端流程
2. 提供開發階段的測試工具
3. 展示功能給用戶進行 UAT

### 測試流程

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 整合測試流程                                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  Step 1: 準備測試數據                                                                   │
│  ├── 選擇已處理完成的 Documents（有 mappedFields）                                       │
│  ├── 或使用模擬數據                                                                     │
│  └── 顯示原始欄位數據預覽                                                               │
│                                                                                         │
│  Step 2: 選擇數據模版                                                                   │
│  ├── 從現有 DataTemplate 中選擇                                                         │
│  └── 顯示模版欄位定義                                                                   │
│                                                                                         │
│  Step 3: 查看映射規則                                                                   │
│  ├── 顯示解析後的 TemplateFieldMapping                                                  │
│  ├── 顯示三層優先級來源                                                                 │
│  └── 允許臨時調整測試                                                                   │
│                                                                                         │
│  Step 4: 執行匹配                                                                       │
│  ├── 創建/選擇 TemplateInstance                                                         │
│  ├── 執行 matchDocuments                                                                │
│  └── 顯示執行進度                                                                       │
│                                                                                         │
│  Step 5: 檢視結果                                                                       │
│  ├── 顯示匹配統計（成功/失敗行數）                                                       │
│  ├── 顯示填充後的模版數據                                                               │
│  ├── 高亮顯示驗證錯誤                                                                   │
│  └── 允許修正錯誤行                                                                     │
│                                                                                         │
│  Step 6: 導出測試                                                                       │
│  ├── 導出為 Excel                                                                       │
│  ├── 導出為 CSV                                                                         │
│  └── 驗證導出文件內容                                                                   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

### AC1: 測試頁面入口

**Given** /admin/test/template-matching 頁面
**When** 訪問頁面
**Then** 顯示整合測試向導

### AC2: 測試數據選擇

**Given** 測試頁面 Step 1
**When** 選擇測試數據
**Then**:
  - 可從現有 Documents 中選擇（篩選 status=COMPLETED）
  - 可使用預設模擬數據
  - 顯示選中數據的 mappedFields 預覽

### AC3: 模版和映射預覽

**Given** 測試頁面 Step 2-3
**When** 選擇數據模版
**Then**:
  - 顯示模版欄位定義
  - 自動載入相關的 TemplateFieldMapping
  - 顯示映射規則的來源（GLOBAL/COMPANY/FORMAT）
  - 允許臨時修改映射進行測試

### AC4: 匹配執行

**Given** 測試頁面 Step 4
**When** 點擊執行匹配
**Then**:
  - 顯示執行進度
  - 顯示每個文件的匹配結果
  - 統計成功/失敗數量

### AC5: 結果檢視

**Given** 測試頁面 Step 5
**When** 匹配完成
**Then**:
  - 以表格形式顯示填充後的數據
  - 高亮顯示驗證錯誤的欄位
  - 允許點擊編輯單一行
  - 顯示來源 Document 連結

### AC6: 導出測試

**Given** 測試頁面 Step 6
**When** 執行導出
**Then**:
  - 支援 Excel 和 CSV 格式
  - 下載生成的文件
  - 顯示導出文件大小和行數

### AC7: 測試報告生成

**Given** 完成所有測試步驟
**When** 點擊生成報告
**Then**:
  - 生成測試報告（包含每步驟結果）
  - 支援複製到剪貼板
  - 支援下載為 Markdown

### AC8: 錯誤場景測試

**Given** 測試頁面
**When** 故意製造錯誤場景
**Then**:
  - 缺少必填欄位的錯誤處理
  - 類型不匹配的錯誤處理
  - 無映射規則的情況處理

---

## Tasks / Subtasks

- [ ] **Task 1: 測試頁面框架** (AC: #1)
  - [ ] 1.1 新增 `/admin/test/template-matching/page.tsx`
  - [ ] 1.2 實現多步驟向導框架
  - [ ] 1.3 實現步驟導航

- [ ] **Task 2: 數據選擇步驟** (AC: #2)
  - [ ] 2.1 實現 `TestDataSelector` 組件
  - [ ] 2.2 實現 Document 選擇器
  - [ ] 2.3 實現模擬數據生成
  - [ ] 2.4 實現數據預覽

- [ ] **Task 3: 模版和映射步驟** (AC: #3)
  - [ ] 3.1 實現 `TemplateSelector` 組件
  - [ ] 3.2 實現映射規則預覽
  - [ ] 3.3 實現臨時映射編輯

- [ ] **Task 4: 執行和結果步驟** (AC: #4, #5)
  - [ ] 4.1 實現 `MatchExecutor` 組件
  - [ ] 4.2 實現進度顯示
  - [ ] 4.3 實現結果表格
  - [ ] 4.4 實現行編輯功能

- [ ] **Task 5: 導出測試步驟** (AC: #6)
  - [ ] 5.1 實現 `ExportTester` 組件
  - [ ] 5.2 整合導出功能
  - [ ] 5.3 實現文件預覽

- [ ] **Task 6: 測試報告** (AC: #7)
  - [ ] 6.1 實現 `TestReportGenerator` 組件
  - [ ] 6.2 實現報告格式化
  - [ ] 6.3 實現複製和下載

- [ ] **Task 7: 錯誤場景** (AC: #8)
  - [ ] 7.1 實現錯誤注入選項
  - [ ] 7.2 實現錯誤處理展示

---

## Dev Notes

### 依賴項

- **Story 19-1 ~ 18-7**: 所有前置 Stories

### 新增文件

```
src/
└── app/[locale]/(dashboard)/admin/test/template-matching/
    ├── page.tsx                           # 新增：主頁面
    └── components/
        ├── TestWizard.tsx                 # 新增：向導框架
        ├── TestDataSelector.tsx           # 新增：數據選擇
        ├── TemplatePreview.tsx            # 新增：模版預覽
        ├── MappingPreview.tsx             # 新增：映射預覽
        ├── MatchExecutor.tsx              # 新增：執行匹配
        ├── ResultViewer.tsx               # 新增：結果查看
        ├── ExportTester.tsx               # 新增：導出測試
        └── TestReportGenerator.tsx        # 新增：報告生成
```

### 頁面設計

```typescript
// page.tsx

'use client';

import { useState } from 'react';
import { TestWizard } from './components/TestWizard';

type TestStep =
  | 'select-data'      // Step 1: 選擇測試數據
  | 'select-template'  // Step 2: 選擇數據模版
  | 'review-mapping'   // Step 3: 查看映射規則
  | 'execute-match'    // Step 4: 執行匹配
  | 'view-results'     // Step 5: 檢視結果
  | 'test-export';     // Step 6: 導出測試

interface TestState {
  selectedDocuments: string[];
  selectedTemplate: string | null;
  resolvedMappings: TemplateFieldMappingRule[];
  instanceId: string | null;
  matchResult: MatchResult | null;
  exportResult: ExportResult | null;
}

export default function TemplateMatchingTestPage() {
  const [currentStep, setCurrentStep] = useState<TestStep>('select-data');
  const [testState, setTestState] = useState<TestState>({
    selectedDocuments: [],
    selectedTemplate: null,
    resolvedMappings: [],
    instanceId: null,
    matchResult: null,
    exportResult: null,
  });

  const steps = [
    { id: 'select-data', title: '選擇測試數據', component: TestDataSelector },
    { id: 'select-template', title: '選擇數據模版', component: TemplatePreview },
    { id: 'review-mapping', title: '查看映射規則', component: MappingPreview },
    { id: 'execute-match', title: '執行匹配', component: MatchExecutor },
    { id: 'view-results', title: '檢視結果', component: ResultViewer },
    { id: 'test-export', title: '導出測試', component: ExportTester },
  ];

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">模版匹配整合測試</h1>

      <TestWizard
        steps={steps}
        currentStep={currentStep}
        testState={testState}
        onStepChange={setCurrentStep}
        onStateChange={setTestState}
      />
    </div>
  );
}
```

### 模擬數據生成

```typescript
// 提供預設的測試數據，方便快速測試

const MOCK_DOCUMENTS = [
  {
    id: 'mock-1',
    mappedFields: {
      invoice_number: 'INV-2026-001',
      invoice_date: '2026-01-15',
      vendor_name: 'DHL Express',
      sea_freight: 500,
      terminal_handling: 100,
      documentation_fee: 50,
      total_amount: 650,
      shipment_no: 'S001',
    },
  },
  {
    id: 'mock-2',
    mappedFields: {
      invoice_number: 'INV-2026-002',
      invoice_date: '2026-01-16',
      vendor_name: 'Maersk',
      sea_freight: 450,
      terminal_handling: 120,
      documentation_fee: 45,
      total_amount: 615,
      shipment_no: 'S002',
    },
  },
  {
    id: 'mock-3',
    mappedFields: {
      invoice_number: 'INV-2026-003',
      invoice_date: '2026-01-17',
      vendor_name: 'CMA CGM',
      sea_freight: 480,
      // 缺少 terminal_handling - 用於測試錯誤場景
      documentation_fee: 55,
      total_amount: null, // 缺少 total_amount - 用於測試必填欄位
      shipment_no: 'S003',
    },
  },
];
```

### 測試報告格式

```markdown
# 模版匹配整合測試報告

**測試時間**: 2026-01-22 15:30:45
**測試者**: admin@example.com

## 測試配置

- **測試數據**: 3 個 Documents (mock-1, mock-2, mock-3)
- **目標模版**: 海運費用報表
- **映射配置**: GLOBAL 預設映射

## 測試結果

### Step 1: 數據選擇 ✅
- 選中 3 個文件
- 所有文件有有效的 mappedFields

### Step 2: 模版選擇 ✅
- 選中模版: 海運費用報表
- 模版欄位數: 8

### Step 3: 映射解析 ✅
- 解析映射規則: 6 條
- 來源: GLOBAL

### Step 4: 執行匹配 ⚠️
- 總文件數: 3
- 成功行數: 2
- 錯誤行數: 1
- 錯誤詳情:
  - S003: total_amount 為必填欄位

### Step 5: 結果驗證 ✅
- 有效行正確顯示
- 錯誤行高亮標記
- 編輯功能正常

### Step 6: 導出測試 ✅
- Excel 導出成功 (15.2 KB)
- CSV 導出成功 (3.1 KB)

## 總結

測試通過率: 5/6 (83%)
需要關注: 錯誤處理和驗證邏輯
```

---

## Implementation Notes

### 完成日期
2026-01-23

### 實現概要

實現了完整的 6 步驟測試向導頁面，用於驗證模版匹配的端到端流程。

### 新增文件

```
src/app/[locale]/(dashboard)/admin/test/template-matching/
├── page.tsx                                    # 主頁面（Server Component）
├── types.ts                                    # 類型定義
└── components/
    ├── index.ts                                # 組件導出
    ├── TemplateMatchingTestClient.tsx          # 客戶端主組件
    ├── TestWizard.tsx                          # 向導框架（步驟指示器、導航）
    ├── TestDataSelector.tsx                    # Step 1: 數據選擇（文件/模擬）
    ├── TemplateSelector.tsx                    # Step 2: 模版選擇
    ├── MappingPreview.tsx                      # Step 3: 映射規則預覽
    ├── MatchExecutor.tsx                       # Step 4: 匹配執行
    ├── ResultViewer.tsx                        # Step 5: 結果檢視
    ├── ExportTester.tsx                        # Step 6: 導出測試
    └── TestReportGenerator.tsx                 # 測試報告生成

messages/
├── en/templateMatchingTest.json                # English 翻譯
├── zh-TW/templateMatchingTest.json             # 繁體中文翻譯
└── zh-CN/templateMatchingTest.json             # 简体中文翻譯
```

### 主要功能

1. **TestWizard**: 6 步驟向導框架，支援步驟導航、進度追蹤
2. **TestDataSelector**: 支援選擇現有文件或使用模擬數據（含錯誤場景）
3. **TemplateSelector**: 從現有 DataTemplate 選擇，顯示欄位預覽
4. **MappingPreview**: 顯示解析後的 TemplateFieldMapping，包含來源標識
5. **MatchExecutor**: 執行匹配操作，顯示進度和統計
6. **ResultViewer**: 表格顯示結果，支援錯誤高亮、行編輯
7. **ExportTester**: Excel/CSV 導出測試，顯示文件大小和行數
8. **TestReportGenerator**: 生成 Markdown 格式測試報告，支援複製/下載

### 模擬數據

提供 3 個預設模擬文件，其中包含一個錯誤場景（缺少必填欄位）用於測試錯誤處理。

### 測試報告格式

報告包含：
- 測試配置（數據來源、模版、映射配置）
- 各步驟結果（通過/失敗/警告）
- 匹配統計（有效/無效/錯誤行數）
- 導出測試結果
- 總結和建議

### Story Points
5 points

---

## Related Files

- `src/app/[locale]/(dashboard)/admin/test/template-matching/` - 新增
