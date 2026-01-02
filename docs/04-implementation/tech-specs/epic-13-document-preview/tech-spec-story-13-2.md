# Tech Spec: Story 13.2 - 欄位提取結果面板

> **Version**: 1.0.0
> **Created**: 2026-01-02
> **Status**: Draft
> **Story Key**: STORY-13-2

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 13.2 |
| **Epic** | Epic 13 - 文件預覽與欄位映射 |
| **Estimated Effort** | 5 Story Points |
| **Dependencies** | Story 13.1（PDF 預覽組件） |
| **Blocking** | Story 13.3（欄位映射配置介面） |
| **FR Coverage** | FR9, FR10（審核相關功能） |

---

## Objective

實現欄位提取結果的展示面板，支援：
- 欄位卡片列表展示（名稱、值、信心度、來源）
- 與 PDF 預覽的雙向聯動
- Inline 編輯功能
- 搜尋、過濾、排序功能

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-13.2.1 | 顯示所有提取欄位的卡片列表 | ExtractedFieldsPanel 組件渲染 FieldCard 列表 |
| AC-13.2.2 | 每個卡片顯示欄位名稱、提取值、信心度、來源 | FieldCard 組件佈局設計 |
| AC-13.2.3 | 點擊欄位卡片時預覽滾動到對應位置 | onFieldSelect 回調觸發 PDF 聯動 |
| AC-13.2.4 | 支援 inline 編輯模式 | FieldCard 內建編輯狀態切換 |
| AC-13.2.5 | 支援搜尋、過濾、排序 | FieldFilters 組件提供篩選功能 |

---

## Implementation Guide

### Phase 1: 欄位卡片組件 (2 points)

#### 1.1 類型定義

```typescript
// src/types/extracted-field.ts

/**
 * @fileoverview 提取欄位類型定義
 * @module src/types
 * @since Epic 13 - Story 13.2
 */

export type FieldSource = 'AZURE_DI' | 'GPT_VISION' | 'MANUAL' | 'MAPPING';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ExtractedField {
  id: string;
  fieldName: string;
  displayName: string;
  value: string | number | null;
  rawValue: string | null;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  source: FieldSource;
  boundingBox?: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isEdited: boolean;
  originalValue?: string | number | null;
  category?: string;
  validationErrors?: string[];
}

export interface FieldCategory {
  id: string;
  name: string;
  displayName: string;
  order: number;
}

export const DEFAULT_CATEGORIES: FieldCategory[] = [
  { id: 'invoice', name: 'invoice', displayName: '發票資訊', order: 1 },
  { id: 'vendor', name: 'vendor', displayName: '供應商資訊', order: 2 },
  { id: 'customer', name: 'customer', displayName: '客戶資訊', order: 3 },
  { id: 'lineItems', name: 'lineItems', displayName: '明細項目', order: 4 },
  { id: 'amounts', name: 'amounts', displayName: '金額資訊', order: 5 },
  { id: 'other', name: 'other', displayName: '其他', order: 99 },
];
```

#### 1.2 FieldCard 組件

```typescript
// src/components/features/document-preview/FieldCard.tsx

/**
 * @fileoverview 欄位卡片組件
 * @description 顯示單個提取欄位的資訊，支援編輯和聯動
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ExtractedField, FieldSource } from '@/types/extracted-field';

export interface FieldCardProps {
  field: ExtractedField;
  isSelected: boolean;
  onSelect: (fieldId: string) => void;
  onEdit: (fieldId: string, newValue: string) => void;
  className?: string;
}

const SOURCE_LABELS: Record<FieldSource, string> = {
  AZURE_DI: 'Azure DI',
  GPT_VISION: 'GPT Vision',
  MANUAL: '手動輸入',
  MAPPING: '映射規則',
};

function getConfidenceStyles(level: string): string {
  switch (level) {
    case 'HIGH':
      return 'bg-green-50 border-green-200 text-green-700';
    case 'MEDIUM':
      return 'bg-yellow-50 border-yellow-200 text-yellow-700';
    case 'LOW':
      return 'bg-red-50 border-red-200 text-red-700';
    default:
      return 'bg-gray-50 border-gray-200 text-gray-700';
  }
}

export function FieldCard({
  field,
  isSelected,
  onSelect,
  onEdit,
  className,
}: FieldCardProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(field.value ?? ''));
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 當選中時滾動到可見區域
  const cardRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditValue(String(field.value ?? ''));
  };

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onEdit(field.id, editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(String(field.value ?? ''));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'cursor-pointer rounded-lg border p-3 transition-all',
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
          : 'border-gray-200 bg-white hover:border-gray-300',
        field.isEdited && 'border-l-4 border-l-orange-500',
        className
      )}
      onClick={() => onSelect(field.id)}
      onDoubleClick={handleDoubleClick}
    >
      {/* 標題列 */}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-gray-900">
          {field.displayName}
        </span>
        <div className="flex items-center gap-2">
          {/* 信心度標籤 */}
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs font-medium',
              getConfidenceStyles(field.confidenceLevel)
            )}
          >
            {Math.round(field.confidence * 100)}%
          </span>
          {/* 來源標籤 */}
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {SOURCE_LABELS[field.source]}
          </span>
        </div>
      </div>

      {/* 值區域 */}
      <div className="min-h-[2rem]">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8"
            />
            <Button size="sm" onClick={handleSave}>
              <CheckIcon className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              <XIcon className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-gray-700">
            {field.value ?? <span className="italic text-gray-400">未提取</span>}
          </p>
        )}
      </div>

      {/* 編輯標記 */}
      {field.isEdited && (
        <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
          <PencilIcon className="h-3 w-3" />
          <span>已修改（原值：{field.originalValue}）</span>
        </div>
      )}

      {/* 驗證錯誤 */}
      {field.validationErrors && field.validationErrors.length > 0 && (
        <div className="mt-2">
          {field.validationErrors.map((error, idx) => (
            <div key={idx} className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircleIcon className="h-3 w-3" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Phase 2: 欄位列表面板 (2 points)

#### 2.1 ExtractedFieldsPanel 組件

```typescript
// src/components/features/document-preview/ExtractedFieldsPanel.tsx

/**
 * @fileoverview 欄位提取結果面板
 * @description 展示所有提取欄位，支援搜尋、過濾、分類顯示
 */

'use client';

import * as React from 'react';
import { FieldCard } from './FieldCard';
import { FieldFilters, type FilterState } from './FieldFilters';
import type { ExtractedField, FieldCategory, DEFAULT_CATEGORIES } from '@/types/extracted-field';

export interface ExtractedFieldsPanelProps {
  fields: ExtractedField[];
  categories?: FieldCategory[];
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string) => void;
  onFieldEdit: (fieldId: string, newValue: string) => void;
  className?: string;
}

export function ExtractedFieldsPanel({
  fields,
  categories = DEFAULT_CATEGORIES,
  selectedFieldId,
  onFieldSelect,
  onFieldEdit,
  className,
}: ExtractedFieldsPanelProps) {
  const [filters, setFilters] = React.useState<FilterState>({
    search: '',
    confidenceLevel: 'ALL',
    source: 'ALL',
    showEditedOnly: false,
    sortBy: 'category',
    sortOrder: 'asc',
  });

  // 過濾欄位
  const filteredFields = React.useMemo(() => {
    let result = [...fields];

    // 搜尋過濾
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (f) =>
          f.displayName.toLowerCase().includes(searchLower) ||
          String(f.value ?? '').toLowerCase().includes(searchLower)
      );
    }

    // 信心度過濾
    if (filters.confidenceLevel !== 'ALL') {
      result = result.filter((f) => f.confidenceLevel === filters.confidenceLevel);
    }

    // 來源過濾
    if (filters.source !== 'ALL') {
      result = result.filter((f) => f.source === filters.source);
    }

    // 僅顯示已編輯
    if (filters.showEditedOnly) {
      result = result.filter((f) => f.isEdited);
    }

    // 排序
    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name':
          comparison = a.displayName.localeCompare(b.displayName);
          break;
        case 'confidence':
          comparison = b.confidence - a.confidence;
          break;
        case 'category':
          const catA = categories.find((c) => c.name === a.category)?.order ?? 99;
          const catB = categories.find((c) => c.name === b.category)?.order ?? 99;
          comparison = catA - catB;
          break;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [fields, filters, categories]);

  // 按類別分組
  const groupedFields = React.useMemo(() => {
    if (filters.sortBy !== 'category') {
      return [{ category: null, fields: filteredFields }];
    }

    const groups: Map<string, ExtractedField[]> = new Map();

    filteredFields.forEach((field) => {
      const catName = field.category ?? 'other';
      if (!groups.has(catName)) {
        groups.set(catName, []);
      }
      groups.get(catName)!.push(field);
    });

    return categories
      .filter((cat) => groups.has(cat.name))
      .map((cat) => ({
        category: cat,
        fields: groups.get(cat.name)!,
      }));
  }, [filteredFields, categories, filters.sortBy]);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* 過濾器 */}
      <FieldFilters filters={filters} onChange={setFilters} />

      {/* 統計資訊 */}
      <div className="border-b bg-gray-50 px-4 py-2 text-sm text-gray-600">
        顯示 {filteredFields.length} / {fields.length} 個欄位
        {filters.showEditedOnly && (
          <span className="ml-2 text-orange-600">（僅顯示已修改）</span>
        )}
      </div>

      {/* 欄位列表 */}
      <div className="flex-1 overflow-auto p-4">
        {groupedFields.map(({ category, fields: groupFields }) => (
          <div key={category?.id ?? 'all'} className="mb-6">
            {category && (
              <h3 className="mb-3 font-semibold text-gray-900">
                {category.displayName}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({groupFields.length})
                </span>
              </h3>
            )}
            <div className="space-y-3">
              {groupFields.map((field) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  isSelected={field.id === selectedFieldId}
                  onSelect={onFieldSelect}
                  onEdit={onFieldEdit}
                />
              ))}
            </div>
          </div>
        ))}

        {filteredFields.length === 0 && (
          <div className="flex h-32 items-center justify-center text-gray-500">
            沒有符合條件的欄位
          </div>
        )}
      </div>
    </div>
  );
}
```

### Phase 3: 過濾器組件 (1 point)

#### 3.1 FieldFilters 組件

```typescript
// src/components/features/document-preview/FieldFilters.tsx

/**
 * @fileoverview 欄位過濾器組件
 */

'use client';

import * as React from 'react';

export interface FilterState {
  search: string;
  confidenceLevel: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';
  source: 'ALL' | 'AZURE_DI' | 'GPT_VISION' | 'MANUAL' | 'MAPPING';
  showEditedOnly: boolean;
  sortBy: 'name' | 'confidence' | 'category';
  sortOrder: 'asc' | 'desc';
}

export interface FieldFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

export function FieldFilters({ filters, onChange }: FieldFiltersProps) {
  const updateFilter = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="border-b bg-white p-4">
      {/* 搜尋框 */}
      <div className="mb-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="搜尋欄位名稱或值..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 過濾選項 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 信心度過濾 */}
        <Select
          value={filters.confidenceLevel}
          onValueChange={(v) => updateFilter('confidenceLevel', v as FilterState['confidenceLevel'])}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="信心度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部信心度</SelectItem>
            <SelectItem value="HIGH">高 (≥90%)</SelectItem>
            <SelectItem value="MEDIUM">中 (70-89%)</SelectItem>
            <SelectItem value="LOW">低 (&lt;70%)</SelectItem>
          </SelectContent>
        </Select>

        {/* 來源過濾 */}
        <Select
          value={filters.source}
          onValueChange={(v) => updateFilter('source', v as FilterState['source'])}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="來源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部來源</SelectItem>
            <SelectItem value="AZURE_DI">Azure DI</SelectItem>
            <SelectItem value="GPT_VISION">GPT Vision</SelectItem>
            <SelectItem value="MANUAL">手動輸入</SelectItem>
            <SelectItem value="MAPPING">映射規則</SelectItem>
          </SelectContent>
        </Select>

        {/* 排序 */}
        <Select
          value={filters.sortBy}
          onValueChange={(v) => updateFilter('sortBy', v as FilterState['sortBy'])}
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="category">類別</SelectItem>
            <SelectItem value="name">名稱</SelectItem>
            <SelectItem value="confidence">信心度</SelectItem>
          </SelectContent>
        </Select>

        {/* 排序方向 */}
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')
          }
        >
          {filters.sortOrder === 'asc' ? (
            <ArrowUpIcon className="h-4 w-4" />
          ) : (
            <ArrowDownIcon className="h-4 w-4" />
          )}
        </Button>

        {/* 僅顯示已修改 */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="showEditedOnly"
            checked={filters.showEditedOnly}
            onCheckedChange={(checked) =>
              updateFilter('showEditedOnly', checked === true)
            }
          />
          <label
            htmlFor="showEditedOnly"
            className="text-sm text-gray-700"
          >
            僅顯示已修改
          </label>
        </div>
      </div>
    </div>
  );
}
```

---

## Project Structure

```
src/
├── components/
│   └── features/
│       └── document-preview/
│           ├── index.ts                    # 更新導出
│           ├── FieldCard.tsx               # 欄位卡片組件
│           ├── ExtractedFieldsPanel.tsx    # 欄位面板組件
│           └── FieldFilters.tsx            # 過濾器組件
└── types/
    └── extracted-field.ts                  # 提取欄位類型定義
```

---

## API Endpoints

### 依賴的現有 API

| 端點 | 方法 | 用途 |
|------|------|------|
| `/api/v1/files/:id/extraction` | GET | 獲取欄位提取結果 |
| `/api/v1/files/:id/fields/:fieldId` | PATCH | 更新欄位值 |

### 響應格式

```typescript
// GET /api/v1/files/:id/extraction
interface ExtractionResponse {
  success: true;
  data: {
    fileId: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    fields: ExtractedField[];
    metadata: {
      processedAt: string;
      source: 'AZURE_DI' | 'GPT_VISION' | 'HYBRID';
      totalFields: number;
      avgConfidence: number;
    };
  };
}
```

---

## Verification Checklist

### 功能驗證

- [ ] 欄位卡片正確顯示所有資訊
- [ ] 信心度顏色編碼正確
- [ ] 來源標籤正確顯示
- [ ] 點擊卡片觸發選中狀態
- [ ] 雙擊進入編輯模式
- [ ] Enter 鍵保存編輯
- [ ] Escape 鍵取消編輯
- [ ] 已修改欄位顯示橘色標記
- [ ] 搜尋功能正常
- [ ] 信心度過濾正常
- [ ] 來源過濾正常
- [ ] 排序功能正常
- [ ] 類別分組顯示正常

### 聯動驗證

- [ ] 點擊欄位卡片時 PDF 預覽滾動到對應位置
- [ ] PDF 點擊高亮框時欄位卡片滾動到可見區域

---

## Dependencies

無額外依賴，使用現有 shadcn/ui 組件。

---

## Risk Mitigation

| 風險 | 機率 | 影響 | 緩解措施 |
|------|------|------|----------|
| 大量欄位導致性能問題 | 低 | 中 | 虛擬滾動（如需要） |
| 編輯狀態衝突 | 低 | 低 | 樂觀更新 + 錯誤回滾 |

---

*Tech Spec 建立日期: 2026-01-02*
*狀態: Draft*
