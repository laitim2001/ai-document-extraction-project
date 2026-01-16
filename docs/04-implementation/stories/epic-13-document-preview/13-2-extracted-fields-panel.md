# Story 13-2: 欄位提取結果面板

**Status:** backlog

---

## Story

**As a** 系統管理員,
**I want** 看到 AI 提取的欄位結果列表，包含欄位值和信心度,
**So that** 可以快速了解提取結果並驗證準確性。

---

## 背景說明

### 問題陳述

Story 13-1 實現了文件預覽和欄位高亮功能，但用戶還需要一個結構化的面板來：
- 查看所有提取的欄位及其值
- 了解每個欄位的信心度
- 點擊欄位跳轉到文件中的對應位置
- 展開查看子欄位（如 lineItems 的明細）

### 參考設計

參考 Azure Document Intelligence Portal 的右側面板設計：
- **Fields** 標籤：顯示所有識別的欄位
- **Content** 標籤：顯示原始文字內容
- **Result** 標籤：顯示 JSON 結果
- **Code** 標籤：顯示 API 調用代碼

本 Story 專注於 **Fields** 標籤的實現。

---

## Acceptance Criteria

### AC1: 欄位列表顯示

**Given** 文件已完成 AI 提取處理
**When** 用戶查看欄位面板
**Then**：
  - 顯示所有提取的欄位列表
  - 每個欄位顯示：名稱、值、信心度百分比
  - 欄位按類別分組（Header、Vendor、Customer、Items、Totals）
  - 信心度使用顏色標記（綠色 ≥90%、黃色 70-89%、紅色 <70%）

### AC2: 欄位點擊互動

**Given** 欄位面板顯示欄位列表
**When** 用戶點擊某個欄位
**Then**：
  - 該欄位高亮顯示為選中狀態
  - 左側文件預覽自動滾動到該欄位位置
  - 該欄位在文件中的高亮框變為選中狀態

### AC3: 子欄位展開

**Given** 欄位有子項目（如 lineItems）
**When** 用戶點擊展開按鈕
**Then**：
  - 展開顯示所有子項目
  - 每個子項目顯示：索引、描述、金額等
  - 點擊子項目同樣可以跳轉到文件位置

### AC4: 信心度篩選

**Given** 欄位列表包含不同信心度的欄位
**When** 用戶選擇信心度篩選選項
**Then**：
  - 可以只顯示低信心度欄位（<70%）
  - 可以只顯示需要審核的欄位（<90%）
  - 可以顯示所有欄位（預設）

### AC5: 欄位搜尋

**Given** 欄位列表包含多個欄位
**When** 用戶在搜尋框輸入關鍵字
**Then**：
  - 即時篩選匹配的欄位名稱或值
  - 搜尋結果高亮匹配文字
  - 清空搜尋恢復顯示所有欄位

---

## Tasks / Subtasks

- [ ] **Task 1: 欄位面板基礎組件** (AC: #1)
  - [ ] 1.1 創建 `src/components/features/field-mapping/ExtractedFieldsPanel.tsx`
  - [ ] 1.2 實現欄位列表渲染邏輯
  - [ ] 1.3 創建 `FieldItem.tsx` 單個欄位組件
  - [ ] 1.4 實現信心度顏色標記邏輯
  - [ ] 1.5 實現欄位分組邏輯

- [ ] **Task 2: 欄位互動功能** (AC: #2)
  - [ ] 2.1 實現欄位點擊選中狀態
  - [ ] 2.2 連接到 DocumentPreview 的滾動功能
  - [ ] 2.3 實現雙向綁定（面板選中 ⇄ 預覽高亮）
  - [ ] 2.4 添加懸停預覽效果

- [ ] **Task 3: 子欄位展開** (AC: #3)
  - [ ] 3.1 創建 `FieldItemGroup.tsx` 可展開組件
  - [ ] 3.2 實現 lineItems 子項目渲染
  - [ ] 3.3 處理嵌套欄位的展開/收合
  - [ ] 3.4 子項目點擊跳轉邏輯

- [ ] **Task 4: 篩選與搜尋** (AC: #4, #5)
  - [ ] 4.1 創建篩選下拉選單組件
  - [ ] 4.2 實現信心度篩選邏輯
  - [ ] 4.3 創建搜尋輸入框組件
  - [ ] 4.4 實現即時搜尋和高亮

- [ ] **Task 5: 類型定義和 Hook** (AC: #1-5)
  - [ ] 5.1 創建 `src/types/extracted-fields.ts`
  - [ ] 5.2 創建 `src/hooks/use-extracted-fields.ts`
  - [ ] 5.3 定義欄位分組和排序邏輯

- [ ] **Task 6: 樣式和動畫** (AC: #1-5)
  - [ ] 6.1 使用 Tailwind CSS 設計面板樣式
  - [ ] 6.2 添加展開/收合動畫
  - [ ] 6.3 添加選中狀態過渡效果
  - [ ] 6.4 響應式設計適配

- [ ] **Task 7: 驗證與測試** (AC: #1-5)
  - [ ] 7.1 TypeScript 類型檢查通過
  - [ ] 7.2 ESLint 檢查通過
  - [ ] 7.3 單元測試：欄位分組邏輯
  - [ ] 7.4 整合測試：面板與預覽互動

---

## Dev Notes

### 依賴項

- **Story 13-1**: 文件預覽組件（提供 `onFieldClick`、`selectedFieldId` 接口）

### 組件結構

```
src/components/features/field-mapping/
├── ExtractedFieldsPanel.tsx      # 主面板組件
├── FieldItem.tsx                  # 單個欄位項目
├── FieldItemGroup.tsx             # 可展開的欄位組
├── FieldConfidenceBadge.tsx       # 信心度標記
├── FieldSearchInput.tsx           # 搜尋輸入框
├── FieldFilterDropdown.tsx        # 篩選下拉選單
└── index.ts                       # 導出
```

### 類型定義

```typescript
// src/types/extracted-fields.ts

export type FieldCategory =
  | 'header'      // 發票頭資訊（發票號、日期）
  | 'vendor'      // 供應商資訊
  | 'customer'    // 客戶資訊
  | 'items'       // 明細項目
  | 'totals'      // 金額總計
  | 'other';      // 其他欄位

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ExtractedField {
  id: string;
  fieldName: string;           // Azure DI 原始欄位名
  displayLabel: string;        // 顯示用標籤
  value: string | number | null;
  confidence: number;          // 0-100
  confidenceLevel: ConfidenceLevel;
  category: FieldCategory;
  boundingBox?: BoundingBox;
  page?: number;
  children?: ExtractedField[]; // 子欄位（如 lineItems）
  metadata?: Record<string, unknown>;
}

export interface ExtractedFieldsGroup {
  category: FieldCategory;
  label: string;
  fields: ExtractedField[];
  isExpanded: boolean;
}

export interface ExtractedFieldsPanelProps {
  fields: ExtractedField[];
  selectedFieldId?: string | null;
  onFieldSelect?: (fieldId: string) => void;
  onFieldHover?: (fieldId: string | null) => void;
  filterLevel?: 'all' | 'review' | 'low';
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onFilterChange?: (level: 'all' | 'review' | 'low') => void;
  className?: string;
}
```

### 信心度顏色映射

```typescript
// src/lib/field-mapping/confidence-utils.ts

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 90) return 'high';
  if (confidence >= 70) return 'medium';
  return 'low';
}

export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'text-green-600 bg-green-100';
    case 'medium':
      return 'text-yellow-600 bg-yellow-100';
    case 'low':
      return 'text-red-600 bg-red-100';
  }
}

export function getConfidenceLabel(confidence: number): string {
  return `${confidence.toFixed(1)}%`;
}
```

### 欄位分組邏輯

```typescript
// src/lib/field-mapping/field-grouping.ts

const FIELD_CATEGORY_MAP: Record<string, FieldCategory> = {
  // Header fields
  'InvoiceId': 'header',
  'InvoiceDate': 'header',
  'InvoiceTotal': 'totals',
  'DueDate': 'header',
  'PurchaseOrder': 'header',

  // Vendor fields
  'VendorName': 'vendor',
  'VendorAddress': 'vendor',
  'VendorTaxId': 'vendor',

  // Customer fields
  'CustomerName': 'customer',
  'CustomerAddress': 'customer',
  'CustomerTaxId': 'customer',
  'BillingAddress': 'customer',
  'ShippingAddress': 'customer',

  // Items
  'Items': 'items',

  // Totals
  'SubTotal': 'totals',
  'TotalTax': 'totals',
  'AmountDue': 'totals',
  'PreviousUnpaidBalance': 'totals',
};

const CATEGORY_ORDER: FieldCategory[] = [
  'header',
  'vendor',
  'customer',
  'items',
  'totals',
  'other',
];

const CATEGORY_LABELS: Record<FieldCategory, string> = {
  header: '發票資訊',
  vendor: '供應商',
  customer: '客戶',
  items: '明細項目',
  totals: '金額總計',
  other: '其他欄位',
};

export function groupFieldsByCategory(
  fields: ExtractedField[]
): ExtractedFieldsGroup[] {
  const groups: Map<FieldCategory, ExtractedField[]> = new Map();

  // Initialize groups
  CATEGORY_ORDER.forEach(category => {
    groups.set(category, []);
  });

  // Categorize fields
  fields.forEach(field => {
    const category = FIELD_CATEGORY_MAP[field.fieldName] || 'other';
    groups.get(category)!.push(field);
  });

  // Build result
  return CATEGORY_ORDER
    .map(category => ({
      category,
      label: CATEGORY_LABELS[category],
      fields: groups.get(category) || [],
      isExpanded: true,
    }))
    .filter(group => group.fields.length > 0);
}
```

### Hook 實現

```typescript
// src/hooks/use-extracted-fields.ts

import { useState, useMemo, useCallback } from 'react';
import type { ExtractedField, ConfidenceLevel } from '@/types/extracted-fields';
import { groupFieldsByCategory } from '@/lib/field-mapping/field-grouping';
import { getConfidenceLevel } from '@/lib/field-mapping/confidence-utils';

interface UseExtractedFieldsOptions {
  fields: ExtractedField[];
  initialFilterLevel?: 'all' | 'review' | 'low';
}

export function useExtractedFields({
  fields,
  initialFilterLevel = 'all',
}: UseExtractedFieldsOptions) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState(initialFilterLevel);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['header', 'vendor', 'customer', 'items', 'totals', 'other'])
  );

  // Filter fields by confidence level
  const filteredFields = useMemo(() => {
    return fields.filter(field => {
      const level = getConfidenceLevel(field.confidence);

      switch (filterLevel) {
        case 'low':
          return level === 'low';
        case 'review':
          return level !== 'high';
        default:
          return true;
      }
    });
  }, [fields, filterLevel]);

  // Search fields
  const searchedFields = useMemo(() => {
    if (!searchQuery.trim()) return filteredFields;

    const query = searchQuery.toLowerCase();
    return filteredFields.filter(field => {
      const nameMatch = field.displayLabel.toLowerCase().includes(query);
      const valueMatch = String(field.value || '').toLowerCase().includes(query);
      return nameMatch || valueMatch;
    });
  }, [filteredFields, searchQuery]);

  // Group fields
  const groupedFields = useMemo(() => {
    return groupFieldsByCategory(searchedFields);
  }, [searchedFields]);

  // Toggle group expansion
  const toggleGroup = useCallback((category: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Select field
  const selectField = useCallback((fieldId: string | null) => {
    setSelectedFieldId(fieldId);
  }, []);

  // Get statistics
  const statistics = useMemo(() => {
    const total = fields.length;
    const highConfidence = fields.filter(f => f.confidence >= 90).length;
    const mediumConfidence = fields.filter(f => f.confidence >= 70 && f.confidence < 90).length;
    const lowConfidence = fields.filter(f => f.confidence < 70).length;

    return {
      total,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      averageConfidence: fields.length > 0
        ? fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length
        : 0,
    };
  }, [fields]);

  return {
    // State
    selectedFieldId,
    hoveredFieldId,
    searchQuery,
    filterLevel,
    expandedGroups,

    // Derived data
    groupedFields,
    statistics,

    // Actions
    selectField,
    setHoveredFieldId,
    setSearchQuery,
    setFilterLevel,
    toggleGroup,
  };
}
```

### 組件實現範例

```tsx
// src/components/features/field-mapping/ExtractedFieldsPanel.tsx

'use client';

import * as React from 'react';
import { Search, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useExtractedFields } from '@/hooks/use-extracted-fields';
import { FieldItem } from './FieldItem';
import { FieldConfidenceBadge } from './FieldConfidenceBadge';
import type { ExtractedField, ExtractedFieldsPanelProps } from '@/types/extracted-fields';

/**
 * @component ExtractedFieldsPanel
 * @description 顯示 AI 提取的欄位結果面板，支援分組、篩選、搜尋
 */
export function ExtractedFieldsPanel({
  fields,
  selectedFieldId,
  onFieldSelect,
  onFieldHover,
  className,
}: ExtractedFieldsPanelProps) {
  const {
    groupedFields,
    statistics,
    searchQuery,
    filterLevel,
    expandedGroups,
    setSearchQuery,
    setFilterLevel,
    toggleGroup,
  } = useExtractedFields({ fields });

  const filterLabels = {
    all: '所有欄位',
    review: '需審核',
    low: '低信心度',
  };

  return (
    <div className={cn('flex flex-col h-full bg-background border-l', className)}>
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">提取欄位</h3>
          <span className="text-sm text-muted-foreground">
            {statistics.total} 個欄位
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋欄位..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Filter className="h-4 w-4" />
                {filterLabels[filterLevel]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterLevel('all')}>
                所有欄位
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterLevel('review')}>
                需審核 ({statistics.mediumConfidence + statistics.lowConfidence})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterLevel('low')}>
                低信心度 ({statistics.lowConfidence})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Statistics badges */}
          <div className="flex gap-1 text-xs">
            <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">
              {statistics.highConfidence}
            </span>
            <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
              {statistics.mediumConfidence}
            </span>
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">
              {statistics.lowConfidence}
            </span>
          </div>
        </div>
      </div>

      {/* Field List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {groupedFields.map((group) => (
            <div key={group.category} className="mb-2">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.category)}
                className="flex items-center gap-1 w-full p-2 text-sm font-medium
                           text-muted-foreground hover:bg-muted rounded"
              >
                {expandedGroups.has(group.category) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {group.label}
                <span className="ml-auto text-xs">
                  {group.fields.length}
                </span>
              </button>

              {/* Group Fields */}
              {expandedGroups.has(group.category) && (
                <div className="ml-4 space-y-1">
                  {group.fields.map((field) => (
                    <FieldItem
                      key={field.id}
                      field={field}
                      isSelected={selectedFieldId === field.id}
                      searchQuery={searchQuery}
                      onClick={() => onFieldSelect?.(field.id)}
                      onHover={(isHovered) =>
                        onFieldHover?.(isHovered ? field.id : null)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
```

### 與 Story 13-1 整合

```tsx
// 整合範例：欄位映射配置頁面

'use client';

import { useState } from 'react';
import { DocumentPreview } from '@/components/features/field-mapping/DocumentPreview';
import { ExtractedFieldsPanel } from '@/components/features/field-mapping/ExtractedFieldsPanel';
import type { ExtractedField } from '@/types/extracted-fields';

export function FieldMappingPage() {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);

  // 從 API 獲取的欄位資料
  const fields: ExtractedField[] = [...];
  const fileUrl = '/api/documents/123/preview';

  // 將 ExtractedField 轉換為 FieldAnnotation
  const annotations = fields
    .filter(f => f.boundingBox)
    .map(f => ({
      fieldId: f.id,
      fieldName: f.fieldName,
      displayLabel: f.displayLabel,
      value: f.value,
      boundingBox: f.boundingBox!,
      page: f.page || 1,
      color: getFieldColor(f.fieldName),
      confidence: f.confidence,
    }));

  return (
    <div className="flex h-screen">
      {/* 左側：文件預覽 */}
      <div className="flex-1">
        <DocumentPreview
          fileUrl={fileUrl}
          fileType="pdf"
          annotations={annotations}
          selectedFieldId={selectedFieldId}
          onFieldClick={setSelectedFieldId}
          onFieldHover={setHoveredFieldId}
        />
      </div>

      {/* 右側：欄位面板 */}
      <div className="w-96">
        <ExtractedFieldsPanel
          fields={fields}
          selectedFieldId={selectedFieldId}
          onFieldSelect={setSelectedFieldId}
          onFieldHover={setHoveredFieldId}
        />
      </div>
    </div>
  );
}
```

### 技術考量

1. **效能優化**
   - 使用 `useMemo` 緩存分組和篩選結果
   - 虛擬滾動處理大量欄位（可選）
   - 防抖處理搜尋輸入

2. **無障礙設計**
   - 鍵盤導航支援
   - ARIA 標籤標記可展開區域
   - 焦點管理

3. **響應式設計**
   - 面板寬度可調整
   - 移動端收合為抽屜模式

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 13-2 |
| Story Key | 13-2-extracted-fields-panel |
| Epic | Epic 13: 欄位映射配置介面 |
| Dependencies | Story 13-1 |
| Estimated Points | 5 |

---

*Story created: 2026-01-02*
*Status: backlog*
