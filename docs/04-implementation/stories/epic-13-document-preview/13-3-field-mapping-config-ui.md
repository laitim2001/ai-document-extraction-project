# Story 13-3: 欄位映射配置介面

**Status:** backlog

---

## Story

**As a** 系統管理員,
**I want** 透過拖放介面配置 Azure DI 欄位到系統內部欄位的映射,
**So that** 可以靈活調整不同公司/文件格式的欄位提取規則，無需修改代碼。

---

## 背景說明

### 問題陳述

目前系統的 Azure DI 欄位映射是**硬編碼**在 `azure-di.service.ts` 中：

```typescript
// 現有硬編碼映射（約第 321-347 行）
const invoiceData = {
  invoiceNumber: result.fields?.InvoiceId?.content,
  invoiceDate: result.fields?.InvoiceDate?.content,
  vendorName: result.fields?.VendorName?.content,
  // ... 更多硬編碼
};
```

這導致：
- 無法根據不同公司/文件格式調整提取欄位
- 新增欄位需要修改代碼和重新部署
- 可能遺漏某些公司特有的欄位數據

### 解決方案

提供可視化的拖放式欄位映射配置介面：
- 左側：Azure DI 可用欄位列表
- 右側：系統內部欄位列表
- 中間：拖放連接線表示映射關係
- 支援按公司/文件格式配置不同映射

---

## Acceptance Criteria

### AC1: 映射配置列表

**Given** 用戶進入映射配置管理頁面
**When** 頁面載入完成
**Then**：
  - 顯示所有現有的映射配置列表
  - 每個配置顯示：名稱、適用範圍（公司/格式）、欄位數量、狀態
  - 可以新增、編輯、刪除、啟用/停用配置
  - 支援搜尋和篩選配置

### AC2: 拖放式映射編輯器

**Given** 用戶開啟映射配置編輯器
**When** 編輯器載入完成
**Then**：
  - 左側顯示 Azure DI 所有可用欄位
  - 右側顯示系統內部欄位定義
  - 可以拖放建立欄位映射連接
  - 連接線顯示映射關係
  - 可以刪除現有映射

### AC3: 映射規則設定

**Given** 用戶建立欄位映射
**When** 點擊映射連接線或欄位
**Then**：
  - 可以設定是否必填（isRequired）
  - 可以設定預設值（defaultValue）
  - 可以選擇轉換規則（transformation）
  - 可以預覽轉換效果

### AC4: 配置適用範圍

**Given** 用戶編輯映射配置
**When** 設定適用範圍
**Then**：
  - 可以選擇適用的公司（可選）
  - 可以選擇適用的文件格式（可選）
  - 可以設定優先級
  - 顯示配置覆蓋關係預覽

### AC5: 配置驗證與儲存

**Given** 用戶完成映射配置
**When** 點擊儲存按鈕
**Then**：
  - 驗證配置完整性（必要欄位是否映射）
  - 驗證無衝突映射
  - 顯示配置預覽摘要
  - 成功儲存後更新配置列表

### AC6: 配置測試功能

**Given** 用戶完成映射配置
**When** 點擊「測試提取」按鈕
**Then**：
  - 可以上傳測試文件
  - 使用當前配置執行提取
  - 顯示提取結果對比（Azure DI 原始 vs 映射後）
  - 可以調整配置後重新測試

---

## Tasks / Subtasks

- [ ] **Task 1: 映射配置列表頁面** (AC: #1)
  - [ ] 1.1 創建 `src/app/(dashboard)/admin/settings/field-mappings/page.tsx`
  - [ ] 1.2 創建 `MappingConfigList.tsx` 列表組件
  - [ ] 1.3 實現搜尋和篩選功能
  - [ ] 1.4 實現配置狀態切換

- [ ] **Task 2: 拖放式映射編輯器** (AC: #2)
  - [ ] 2.1 創建 `MappingEditor.tsx` 主編輯器組件
  - [ ] 2.2 創建 `SourceFieldList.tsx` Azure DI 欄位列表
  - [ ] 2.3 創建 `TargetFieldList.tsx` 系統欄位列表
  - [ ] 2.4 創建 `MappingConnection.tsx` 連接線組件
  - [ ] 2.5 整合 @dnd-kit 實現拖放功能
  - [ ] 2.6 實現 SVG 連接線繪製

- [ ] **Task 3: 映射規則設定面板** (AC: #3)
  - [ ] 3.1 創建 `MappingRulePanel.tsx` 規則設定面板
  - [ ] 3.2 實現必填設定
  - [ ] 3.3 實現預設值設定
  - [ ] 3.4 實現轉換規則選擇
  - [ ] 3.5 實現轉換效果預覽

- [ ] **Task 4: 適用範圍設定** (AC: #4)
  - [ ] 4.1 創建 `ScopeSelector.tsx` 範圍選擇器
  - [ ] 4.2 整合公司選擇器
  - [ ] 4.3 整合文件格式選擇器
  - [ ] 4.4 實現優先級設定
  - [ ] 4.5 實現覆蓋關係預覽

- [ ] **Task 5: 配置驗證與儲存** (AC: #5)
  - [ ] 5.1 創建驗證邏輯 `validateMappingConfig()`
  - [ ] 5.2 創建 `ConfigPreviewDialog.tsx` 預覽對話框
  - [ ] 5.3 整合 API 儲存功能
  - [ ] 5.4 實現樂觀更新

- [ ] **Task 6: 配置測試功能** (AC: #6)
  - [ ] 6.1 創建 `TestExtractionPanel.tsx` 測試面板
  - [ ] 6.2 整合文件上傳
  - [ ] 6.3 實現測試提取 API 調用
  - [ ] 6.4 創建結果對比視圖

- [ ] **Task 7: 類型定義和狀態管理** (AC: #1-6)
  - [ ] 7.1 創建 `src/types/field-mapping-config.ts`
  - [ ] 7.2 創建 `src/stores/mapping-editor-store.ts`
  - [ ] 7.3 創建 `src/hooks/use-mapping-config.ts`

- [ ] **Task 8: 驗證與測試** (AC: #1-6)
  - [ ] 8.1 TypeScript 類型檢查通過
  - [ ] 8.2 ESLint 檢查通過
  - [ ] 8.3 單元測試：驗證邏輯
  - [ ] 8.4 整合測試：拖放互動
  - [ ] 8.5 E2E 測試：完整配置流程

---

## Dev Notes

### 依賴項

- **Story 13-1**: 文件預覽組件（測試功能使用）
- **Story 13-2**: 欄位面板組件（結果顯示使用）
- **Story 13-4**: 映射配置 API（資料持久化）

### 技術選型

- **拖放庫**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **連接線**: SVG + CSS 動畫
- **狀態管理**: Zustand（編輯器局部狀態）

### 組件結構

```
src/components/features/field-mapping/
├── config/
│   ├── MappingConfigList.tsx      # 配置列表
│   ├── MappingEditor.tsx          # 主編輯器
│   ├── SourceFieldList.tsx        # 來源欄位列表
│   ├── TargetFieldList.tsx        # 目標欄位列表
│   ├── DraggableField.tsx         # 可拖放欄位
│   ├── DroppableZone.tsx          # 放置區域
│   ├── MappingConnection.tsx      # 連接線
│   ├── MappingRulePanel.tsx       # 規則設定
│   ├── ScopeSelector.tsx          # 範圍選擇
│   ├── ConfigPreviewDialog.tsx    # 預覽對話框
│   └── TestExtractionPanel.tsx    # 測試面板
└── index.ts
```

### 類型定義

```typescript
// src/types/field-mapping-config.ts

export type TransformationType =
  | 'none'
  | 'toUpperCase'
  | 'toLowerCase'
  | 'formatDate'
  | 'formatCurrency'
  | 'extractNumber'
  | 'trim'
  | 'custom';

export interface FieldMapping {
  id: string;
  sourceField: string;        // Azure DI 欄位名
  targetField: string;        // 系統欄位名
  isRequired: boolean;
  defaultValue?: string;
  transformation: TransformationType;
  customTransformation?: string;  // 自定義轉換表達式
}

export interface FieldMappingConfig {
  id: string;
  name: string;
  description?: string;
  companyId?: string;
  documentFormatId?: string;
  mappings: FieldMapping[];
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
}

export interface AzureDIField {
  name: string;
  displayName: string;
  type: 'string' | 'date' | 'number' | 'currency' | 'array';
  description: string;
  isCommon: boolean;  // 是否為常見欄位
}

export interface SystemField {
  name: string;
  displayName: string;
  path: string;       // 如 "invoiceData.vendor.name"
  type: 'string' | 'date' | 'number' | 'currency' | 'array';
  isRequired: boolean;
  description: string;
}

export interface MappingEditorState {
  config: FieldMappingConfig | null;
  selectedMapping: FieldMapping | null;
  isDirty: boolean;
  draggedField: AzureDIField | null;
  connections: MappingConnection[];
}

export interface MappingConnection {
  id: string;
  sourceFieldId: string;
  targetFieldId: string;
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
}
```

### Azure DI 欄位定義

```typescript
// src/lib/field-mapping/azure-di-fields.ts

export const AZURE_DI_INVOICE_FIELDS: AzureDIField[] = [
  // Header fields
  { name: 'InvoiceId', displayName: '發票號碼', type: 'string', description: '發票識別號', isCommon: true },
  { name: 'InvoiceDate', displayName: '發票日期', type: 'date', description: '發票開立日期', isCommon: true },
  { name: 'DueDate', displayName: '到期日', type: 'date', description: '付款到期日', isCommon: true },
  { name: 'PurchaseOrder', displayName: '採購單號', type: 'string', description: '關聯採購單', isCommon: false },

  // Vendor fields
  { name: 'VendorName', displayName: '供應商名稱', type: 'string', description: '供應商公司名稱', isCommon: true },
  { name: 'VendorAddress', displayName: '供應商地址', type: 'string', description: '供應商地址', isCommon: true },
  { name: 'VendorAddressRecipient', displayName: '供應商收件人', type: 'string', description: '供應商收件人', isCommon: false },
  { name: 'VendorTaxId', displayName: '供應商稅號', type: 'string', description: '供應商統一編號', isCommon: false },

  // Customer fields
  { name: 'CustomerName', displayName: '客戶名稱', type: 'string', description: '客戶公司名稱', isCommon: true },
  { name: 'CustomerAddress', displayName: '客戶地址', type: 'string', description: '客戶地址', isCommon: true },
  { name: 'CustomerAddressRecipient', displayName: '客戶收件人', type: 'string', description: '客戶收件人', isCommon: false },
  { name: 'CustomerTaxId', displayName: '客戶稅號', type: 'string', description: '客戶統一編號', isCommon: false },
  { name: 'BillingAddress', displayName: '帳單地址', type: 'string', description: '帳單寄送地址', isCommon: false },
  { name: 'BillingAddressRecipient', displayName: '帳單收件人', type: 'string', description: '帳單收件人', isCommon: false },
  { name: 'ShippingAddress', displayName: '送貨地址', type: 'string', description: '貨物送達地址', isCommon: false },
  { name: 'ShippingAddressRecipient', displayName: '送貨收件人', type: 'string', description: '送貨收件人', isCommon: false },

  // Amount fields
  { name: 'SubTotal', displayName: '小計', type: 'currency', description: '稅前小計金額', isCommon: true },
  { name: 'TotalTax', displayName: '稅額', type: 'currency', description: '總稅額', isCommon: true },
  { name: 'InvoiceTotal', displayName: '發票總額', type: 'currency', description: '發票總金額', isCommon: true },
  { name: 'AmountDue', displayName: '應付金額', type: 'currency', description: '實際應付金額', isCommon: true },
  { name: 'PreviousUnpaidBalance', displayName: '前期未付餘額', type: 'currency', description: '前期未結餘額', isCommon: false },

  // Line items
  { name: 'Items', displayName: '明細項目', type: 'array', description: '發票明細行', isCommon: true },

  // Payment
  { name: 'PaymentTerm', displayName: '付款條款', type: 'string', description: '付款條件說明', isCommon: false },
  { name: 'RemittanceAddress', displayName: '匯款地址', type: 'string', description: '付款匯款地址', isCommon: false },
  { name: 'RemittanceAddressRecipient', displayName: '匯款收款人', type: 'string', description: '匯款收款人', isCommon: false },

  // Service
  { name: 'ServiceAddress', displayName: '服務地址', type: 'string', description: '服務提供地址', isCommon: false },
  { name: 'ServiceAddressRecipient', displayName: '服務地址收件人', type: 'string', description: '服務地址收件人', isCommon: false },
  { name: 'ServiceStartDate', displayName: '服務開始日', type: 'date', description: '服務起始日期', isCommon: false },
  { name: 'ServiceEndDate', displayName: '服務結束日', type: 'date', description: '服務結束日期', isCommon: false },
];

// Line item sub-fields
export const AZURE_DI_LINE_ITEM_FIELDS: AzureDIField[] = [
  { name: 'Description', displayName: '描述', type: 'string', description: '項目描述', isCommon: true },
  { name: 'Quantity', displayName: '數量', type: 'number', description: '項目數量', isCommon: true },
  { name: 'Unit', displayName: '單位', type: 'string', description: '計量單位', isCommon: false },
  { name: 'UnitPrice', displayName: '單價', type: 'currency', description: '項目單價', isCommon: true },
  { name: 'Amount', displayName: '金額', type: 'currency', description: '項目總金額', isCommon: true },
  { name: 'ProductCode', displayName: '產品代碼', type: 'string', description: '產品編號', isCommon: false },
  { name: 'Date', displayName: '日期', type: 'date', description: '項目日期', isCommon: false },
  { name: 'Tax', displayName: '稅額', type: 'currency', description: '項目稅額', isCommon: false },
  { name: 'TaxRate', displayName: '稅率', type: 'string', description: '適用稅率', isCommon: false },
];
```

### 系統欄位定義

```typescript
// src/lib/field-mapping/system-fields.ts

export const SYSTEM_INVOICE_FIELDS: SystemField[] = [
  // Header
  { name: 'invoiceNumber', displayName: '發票號碼', path: 'invoiceData.invoiceNumber', type: 'string', isRequired: true, description: '系統發票編號' },
  { name: 'invoiceDate', displayName: '發票日期', path: 'invoiceData.invoiceDate', type: 'date', isRequired: true, description: '發票日期' },
  { name: 'dueDate', displayName: '到期日', path: 'invoiceData.dueDate', type: 'date', isRequired: false, description: '付款到期日' },
  { name: 'poNumber', displayName: '採購單號', path: 'invoiceData.poNumber', type: 'string', isRequired: false, description: 'PO 編號' },

  // Vendor
  { name: 'vendorName', displayName: '供應商名稱', path: 'invoiceData.vendor.name', type: 'string', isRequired: true, description: '供應商名稱' },
  { name: 'vendorAddress', displayName: '供應商地址', path: 'invoiceData.vendor.address', type: 'string', isRequired: false, description: '供應商地址' },
  { name: 'vendorTaxId', displayName: '供應商稅號', path: 'invoiceData.vendor.taxId', type: 'string', isRequired: false, description: '供應商統編' },

  // Customer
  { name: 'customerName', displayName: '客戶名稱', path: 'invoiceData.customer.name', type: 'string', isRequired: true, description: '客戶名稱' },
  { name: 'customerAddress', displayName: '客戶地址', path: 'invoiceData.customer.address', type: 'string', isRequired: false, description: '客戶地址' },
  { name: 'customerTaxId', displayName: '客戶稅號', path: 'invoiceData.customer.taxId', type: 'string', isRequired: false, description: '客戶統編' },
  { name: 'billingAddress', displayName: '帳單地址', path: 'invoiceData.billingAddress', type: 'string', isRequired: false, description: '帳單地址' },
  { name: 'shippingAddress', displayName: '送貨地址', path: 'invoiceData.shippingAddress', type: 'string', isRequired: false, description: '送貨地址' },

  // Amounts
  { name: 'subTotal', displayName: '小計', path: 'invoiceData.subTotal', type: 'currency', isRequired: false, description: '稅前小計' },
  { name: 'taxAmount', displayName: '稅額', path: 'invoiceData.taxAmount', type: 'currency', isRequired: false, description: '稅額' },
  { name: 'totalAmount', displayName: '總額', path: 'invoiceData.totalAmount', type: 'currency', isRequired: true, description: '發票總額' },
  { name: 'amountDue', displayName: '應付金額', path: 'invoiceData.amountDue', type: 'currency', isRequired: false, description: '應付金額' },

  // Line items
  { name: 'lineItems', displayName: '明細項目', path: 'invoiceData.lineItems', type: 'array', isRequired: false, description: '發票明細' },

  // Metadata
  { name: 'currency', displayName: '幣別', path: 'invoiceData.currency', type: 'string', isRequired: false, description: '交易幣別' },
  { name: 'paymentTerms', displayName: '付款條款', path: 'invoiceData.paymentTerms', type: 'string', isRequired: false, description: '付款條件' },
];

export const SYSTEM_LINE_ITEM_FIELDS: SystemField[] = [
  { name: 'description', displayName: '描述', path: 'lineItems[].description', type: 'string', isRequired: true, description: '項目描述' },
  { name: 'quantity', displayName: '數量', path: 'lineItems[].quantity', type: 'number', isRequired: false, description: '數量' },
  { name: 'unit', displayName: '單位', path: 'lineItems[].unit', type: 'string', isRequired: false, description: '單位' },
  { name: 'unitPrice', displayName: '單價', path: 'lineItems[].unitPrice', type: 'currency', isRequired: false, description: '單價' },
  { name: 'amount', displayName: '金額', path: 'lineItems[].amount', type: 'currency', isRequired: true, description: '金額' },
  { name: 'productCode', displayName: '產品代碼', path: 'lineItems[].productCode', type: 'string', isRequired: false, description: '產品代碼' },
];
```

### 拖放編輯器實現

```tsx
// src/components/features/field-mapping/config/MappingEditor.tsx

'use client';

import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { useMappingEditorStore } from '@/stores/mapping-editor-store';
import { SourceFieldList } from './SourceFieldList';
import { TargetFieldList } from './TargetFieldList';
import { MappingConnections } from './MappingConnections';
import { MappingRulePanel } from './MappingRulePanel';
import { DraggableField } from './DraggableField';
import type { AzureDIField, FieldMapping } from '@/types/field-mapping-config';

interface MappingEditorProps {
  configId?: string;
  onSave?: (config: FieldMappingConfig) => void;
}

export function MappingEditor({ configId, onSave }: MappingEditorProps) {
  const {
    config,
    selectedMapping,
    draggedField,
    connections,
    setDraggedField,
    addMapping,
    removeMapping,
    selectMapping,
    updateMapping,
  } = useMappingEditorStore();

  const sourceListRef = React.useRef<HTMLDivElement>(null);
  const targetListRef = React.useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const field = event.active.data.current?.field as AzureDIField;
    setDraggedField(field);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedField(null);

    if (!over) return;

    const sourceField = active.data.current?.field as AzureDIField;
    const targetFieldName = over.id as string;

    // Create new mapping
    addMapping({
      id: `mapping-${Date.now()}`,
      sourceField: sourceField.name,
      targetField: targetFieldName,
      isRequired: false,
      transformation: 'none',
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full">
        {/* Source Fields (Azure DI) */}
        <div ref={sourceListRef} className="w-80 border-r overflow-auto">
          <SourceFieldList />
        </div>

        {/* Mapping Connections (SVG) */}
        <div className="flex-1 relative bg-muted/30">
          <MappingConnections
            connections={connections}
            sourceRef={sourceListRef}
            targetRef={targetListRef}
            selectedMappingId={selectedMapping?.id}
            onConnectionClick={selectMapping}
            onConnectionDelete={removeMapping}
          />
        </div>

        {/* Target Fields (System) */}
        <div ref={targetListRef} className="w-80 border-l overflow-auto">
          <TargetFieldList />
        </div>

        {/* Rule Panel (Slide-in) */}
        {selectedMapping && (
          <MappingRulePanel
            mapping={selectedMapping}
            onUpdate={updateMapping}
            onClose={() => selectMapping(null)}
          />
        )}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedField && (
          <DraggableField field={draggedField} isDragging />
        )}
      </DragOverlay>
    </DndContext>
  );
}
```

### Zustand Store

```typescript
// src/stores/mapping-editor-store.ts

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  FieldMappingConfig,
  FieldMapping,
  AzureDIField,
  MappingConnection,
} from '@/types/field-mapping-config';

interface MappingEditorState {
  // State
  config: FieldMappingConfig | null;
  selectedMapping: FieldMapping | null;
  draggedField: AzureDIField | null;
  connections: MappingConnection[];
  isDirty: boolean;

  // Actions
  setConfig: (config: FieldMappingConfig) => void;
  setDraggedField: (field: AzureDIField | null) => void;
  addMapping: (mapping: FieldMapping) => void;
  removeMapping: (mappingId: string) => void;
  updateMapping: (mappingId: string, updates: Partial<FieldMapping>) => void;
  selectMapping: (mappingId: string | null) => void;
  updateConnections: (connections: MappingConnection[]) => void;
  reset: () => void;
}

export const useMappingEditorStore = create<MappingEditorState>()(
  immer((set, get) => ({
    config: null,
    selectedMapping: null,
    draggedField: null,
    connections: [],
    isDirty: false,

    setConfig: (config) =>
      set((state) => {
        state.config = config;
        state.isDirty = false;
      }),

    setDraggedField: (field) =>
      set((state) => {
        state.draggedField = field;
      }),

    addMapping: (mapping) =>
      set((state) => {
        if (state.config) {
          state.config.mappings.push(mapping);
          state.isDirty = true;
        }
      }),

    removeMapping: (mappingId) =>
      set((state) => {
        if (state.config) {
          state.config.mappings = state.config.mappings.filter(
            (m) => m.id !== mappingId
          );
          if (state.selectedMapping?.id === mappingId) {
            state.selectedMapping = null;
          }
          state.isDirty = true;
        }
      }),

    updateMapping: (mappingId, updates) =>
      set((state) => {
        if (state.config) {
          const mapping = state.config.mappings.find((m) => m.id === mappingId);
          if (mapping) {
            Object.assign(mapping, updates);
            state.isDirty = true;
          }
        }
      }),

    selectMapping: (mappingId) =>
      set((state) => {
        if (mappingId === null) {
          state.selectedMapping = null;
        } else {
          state.selectedMapping =
            state.config?.mappings.find((m) => m.id === mappingId) || null;
        }
      }),

    updateConnections: (connections) =>
      set((state) => {
        state.connections = connections;
      }),

    reset: () =>
      set((state) => {
        state.config = null;
        state.selectedMapping = null;
        state.draggedField = null;
        state.connections = [];
        state.isDirty = false;
      }),
  }))
);
```

### 技術考量

1. **拖放效能**
   - 使用 `requestAnimationFrame` 優化連接線更新
   - 虛擬化長列表
   - 防抖處理位置計算

2. **SVG 連接線**
   - 使用貝塞爾曲線繪製平滑連接
   - 支援選中、懸停狀態
   - 點擊連接線觸發規則編輯

3. **狀態同步**
   - 使用 Zustand immer 中間件確保不可變更新
   - 離開頁面前檢查未保存變更

4. **響應式設計**
   - 面板寬度可調整
   - 移動端垂直佈局

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 13-3 |
| Story Key | 13-3-field-mapping-config-ui |
| Epic | Epic 13: 欄位映射配置介面 |
| Dependencies | Story 13-1, Story 13-2 |
| Estimated Points | 8 |

---

*Story created: 2026-01-02*
*Status: backlog*
