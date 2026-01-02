# Tech Spec: Story 13.3 - 欄位映射配置介面

> **Version**: 1.0.0
> **Created**: 2026-01-02
> **Status**: Draft
> **Story Key**: STORY-13-3

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 13.3 |
| **Epic** | Epic 13 - 文件預覽與欄位映射 |
| **Estimated Effort** | 8 Story Points |
| **Dependencies** | Story 13.4（映射配置 API） |
| **Blocking** | Story 13.5（動態映射服務整合） |
| **FR Coverage** | 擴展 Epic 2 處理流程 |

---

## Objective

實現可視化的欄位映射配置介面，讓管理員可以：
- 查看和管理 Company/DocumentFormat 的映射規則
- 配置來源欄位到目標欄位的映射
- 設定轉換類型和參數
- 使用 drag-drop 調整規則執行順序

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-13.3.1 | 選擇 Company 或 DocumentFormat 顯示映射規則 | ConfigSelector + MappingRuleList |
| AC-13.3.2 | 支援新增、編輯、刪除規則 | RuleEditor 彈窗組件 |
| AC-13.3.3 | 選擇轉換類型和配置參數 | TransformConfigPanel |
| AC-13.3.4 | 使用 drag-drop 重新排序規則 | @dnd-kit 套件實現 |
| AC-13.3.5 | 規則按新順序執行 | 儲存時更新 priority 欄位 |

---

## Implementation Guide

### Phase 1: 配置選擇器與規則列表 (3 points)

#### 1.1 類型定義

```typescript
// src/types/field-mapping.ts

/**
 * @fileoverview 欄位映射配置類型定義
 * @module src/types
 * @since Epic 13 - Story 13.3
 */

export type TransformType =
  | 'DIRECT'     // 直接映射
  | 'CONCAT'     // 串接多個欄位
  | 'SPLIT'      // 拆分欄位
  | 'LOOKUP'     // 查表轉換
  | 'CUSTOM';    // 自定義函數

export type ConfigScope = 'GLOBAL' | 'COMPANY' | 'FORMAT';

export interface FieldMappingRule {
  id: string;
  configId: string;
  sourceFields: string[];        // 來源欄位（可多個）
  targetField: string;           // 目標欄位
  transformType: TransformType;
  transformParams: TransformParams;
  priority: number;              // 執行順序
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransformParams {
  // CONCAT 參數
  separator?: string;

  // SPLIT 參數
  delimiter?: string;
  index?: number;

  // LOOKUP 參數
  lookupTable?: Record<string, string>;
  defaultValue?: string;

  // CUSTOM 參數
  expression?: string;
}

export interface FieldMappingConfig {
  id: string;
  scope: ConfigScope;
  companyId?: string | null;
  documentFormatId?: string | null;
  name: string;
  description?: string;
  rules: FieldMappingRule[];
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceField {
  name: string;
  displayName: string;
  source: 'AZURE_DI' | 'GPT_VISION';
  dataType: 'string' | 'number' | 'date' | 'currency';
}

export interface TargetField {
  name: string;
  displayName: string;
  category: string;
  required: boolean;
  dataType: 'string' | 'number' | 'date' | 'currency';
}
```

#### 1.2 MappingConfigPanel 主組件

```typescript
// src/components/features/mapping-config/MappingConfigPanel.tsx

/**
 * @fileoverview 欄位映射配置面板
 * @description 管理員用於配置 Company/Format 級別的欄位映射規則
 */

'use client';

import * as React from 'react';
import { ConfigSelector } from './ConfigSelector';
import { MappingRuleList } from './MappingRuleList';
import { RuleEditor } from './RuleEditor';
import { useMappingConfig } from '@/hooks/use-mapping-config';
import type { FieldMappingConfig, FieldMappingRule, ConfigScope } from '@/types/field-mapping';

export interface MappingConfigPanelProps {
  initialScope?: ConfigScope;
  initialCompanyId?: string;
  initialFormatId?: string;
}

export function MappingConfigPanel({
  initialScope = 'GLOBAL',
  initialCompanyId,
  initialFormatId,
}: MappingConfigPanelProps) {
  const [scope, setScope] = React.useState<ConfigScope>(initialScope);
  const [companyId, setCompanyId] = React.useState(initialCompanyId);
  const [formatId, setFormatId] = React.useState(initialFormatId);

  const [editingRule, setEditingRule] = React.useState<FieldMappingRule | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);

  const {
    config,
    isLoading,
    createRule,
    updateRule,
    deleteRule,
    reorderRules,
  } = useMappingConfig({ scope, companyId, formatId });

  const handleSaveRule = async (rule: Partial<FieldMappingRule>) => {
    if (editingRule) {
      await updateRule(editingRule.id, rule);
    } else {
      await createRule(rule);
    }
    setEditingRule(null);
    setIsCreating(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* 配置選擇器 */}
      <div className="border-b bg-white p-4">
        <ConfigSelector
          scope={scope}
          companyId={companyId}
          formatId={formatId}
          onScopeChange={setScope}
          onCompanyChange={setCompanyId}
          onFormatChange={setFormatId}
        />
      </div>

      {/* 工具列 */}
      <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2">
        <div className="text-sm text-gray-600">
          {config ? (
            <>
              {config.rules.length} 個映射規則
              <span className="ml-2 text-gray-400">
                版本 {config.version}
              </span>
            </>
          ) : (
            '尚未建立配置'
          )}
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          新增規則
        </Button>
      </div>

      {/* 規則列表 */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <MappingConfigSkeleton />
        ) : config ? (
          <MappingRuleList
            rules={config.rules}
            onEdit={setEditingRule}
            onDelete={deleteRule}
            onReorder={reorderRules}
          />
        ) : (
          <EmptyConfigState onCreateFirst={() => setIsCreating(true)} />
        )}
      </div>

      {/* 規則編輯器彈窗 */}
      <RuleEditor
        open={isCreating || !!editingRule}
        rule={editingRule}
        onSave={handleSaveRule}
        onClose={() => {
          setEditingRule(null);
          setIsCreating(false);
        }}
      />
    </div>
  );
}
```

#### 1.3 ConfigSelector 組件

```typescript
// src/components/features/mapping-config/ConfigSelector.tsx

/**
 * @fileoverview 配置範圍選擇器
 */

'use client';

import * as React from 'react';
import { useCompanies } from '@/hooks/use-companies';
import { useDocumentFormats } from '@/hooks/use-document-formats';
import type { ConfigScope } from '@/types/field-mapping';

export interface ConfigSelectorProps {
  scope: ConfigScope;
  companyId?: string;
  formatId?: string;
  onScopeChange: (scope: ConfigScope) => void;
  onCompanyChange: (id: string | undefined) => void;
  onFormatChange: (id: string | undefined) => void;
}

export function ConfigSelector({
  scope,
  companyId,
  formatId,
  onScopeChange,
  onCompanyChange,
  onFormatChange,
}: ConfigSelectorProps) {
  const { data: companies } = useCompanies();
  const { data: formats } = useDocumentFormats(companyId);

  return (
    <div className="space-y-4">
      {/* 範圍選擇 */}
      <div>
        <Label className="mb-2">配置範圍</Label>
        <RadioGroup
          value={scope}
          onValueChange={(v) => {
            onScopeChange(v as ConfigScope);
            if (v === 'GLOBAL') {
              onCompanyChange(undefined);
              onFormatChange(undefined);
            }
          }}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="GLOBAL" id="scope-global" />
            <Label htmlFor="scope-global">全域</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="COMPANY" id="scope-company" />
            <Label htmlFor="scope-company">公司級別</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="FORMAT" id="scope-format" />
            <Label htmlFor="scope-format">格式級別</Label>
          </div>
        </RadioGroup>
      </div>

      {/* 公司選擇 */}
      {(scope === 'COMPANY' || scope === 'FORMAT') && (
        <div>
          <Label className="mb-2">選擇公司</Label>
          <Select
            value={companyId ?? ''}
            onValueChange={(v) => {
              onCompanyChange(v || undefined);
              onFormatChange(undefined);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="選擇公司..." />
            </SelectTrigger>
            <SelectContent>
              {companies?.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 格式選擇 */}
      {scope === 'FORMAT' && companyId && (
        <div>
          <Label className="mb-2">選擇文件格式</Label>
          <Select
            value={formatId ?? ''}
            onValueChange={(v) => onFormatChange(v || undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="選擇格式..." />
            </SelectTrigger>
            <SelectContent>
              {formats?.map((format) => (
                <SelectItem key={format.id} value={format.id}>
                  {format.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
```

### Phase 2: 規則列表與拖放排序 (3 points)

#### 2.1 安裝 dnd-kit

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

#### 2.2 MappingRuleList 組件

```typescript
// src/components/features/mapping-config/MappingRuleList.tsx

/**
 * @fileoverview 映射規則列表（支援拖放排序）
 */

'use client';

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableRuleItem } from './SortableRuleItem';
import type { FieldMappingRule } from '@/types/field-mapping';

export interface MappingRuleListProps {
  rules: FieldMappingRule[];
  onEdit: (rule: FieldMappingRule) => void;
  onDelete: (ruleId: string) => Promise<void>;
  onReorder: (ruleIds: string[]) => Promise<void>;
}

export function MappingRuleList({
  rules,
  onEdit,
  onDelete,
  onReorder,
}: MappingRuleListProps) {
  const [items, setItems] = React.useState(rules);
  const [isReordering, setIsReordering] = React.useState(false);

  React.useEffect(() => {
    setItems(rules);
  }, [rules]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);

      setItems(newItems);
      setIsReordering(true);

      try {
        await onReorder(newItems.map((item) => item.id));
      } catch (error) {
        // 回滾
        setItems(rules);
        toast.error('重新排序失敗');
      } finally {
        setIsReordering(false);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={cn('space-y-2', isReordering && 'opacity-50')}>
          {items.map((rule, index) => (
            <SortableRuleItem
              key={rule.id}
              rule={rule}
              index={index}
              onEdit={() => onEdit(rule)}
              onDelete={() => onDelete(rule.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

#### 2.3 SortableRuleItem 組件

```typescript
// src/components/features/mapping-config/SortableRuleItem.tsx

/**
 * @fileoverview 可拖放的規則項目
 */

'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FieldMappingRule, TransformType } from '@/types/field-mapping';

const TRANSFORM_LABELS: Record<TransformType, string> = {
  DIRECT: '直接映射',
  CONCAT: '串接',
  SPLIT: '拆分',
  LOOKUP: '查表',
  CUSTOM: '自定義',
};

export interface SortableRuleItemProps {
  rule: FieldMappingRule;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function SortableRuleItem({
  rule,
  index,
  onEdit,
  onDelete,
}: SortableRuleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-white p-3',
        isDragging && 'opacity-50 shadow-lg',
        !rule.isActive && 'opacity-60'
      )}
    >
      {/* 拖動把手 */}
      <button
        className="cursor-grab text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="h-5 w-5" />
      </button>

      {/* 序號 */}
      <span className="w-8 text-center text-sm text-gray-500">
        {index + 1}
      </span>

      {/* 規則資訊 */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {rule.sourceFields.join(' + ')}
          </span>
          <ArrowRightIcon className="h-4 w-4 text-gray-400" />
          <span className="font-medium text-blue-600">
            {rule.targetField}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
          <Badge variant="outline">
            {TRANSFORM_LABELS[rule.transformType]}
          </Badge>
          {rule.description && <span>{rule.description}</span>}
        </div>
      </div>

      {/* 操作按鈕 */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <PencilIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-red-500 hover:text-red-600"
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

### Phase 3: 規則編輯器 (2 points)

#### 3.1 RuleEditor 組件

```typescript
// src/components/features/mapping-config/RuleEditor.tsx

/**
 * @fileoverview 映射規則編輯器彈窗
 */

'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SourceFieldSelector } from './SourceFieldSelector';
import { TargetFieldSelector } from './TargetFieldSelector';
import { TransformConfigPanel } from './TransformConfigPanel';
import type { FieldMappingRule, TransformType } from '@/types/field-mapping';

const ruleSchema = z.object({
  sourceFields: z.array(z.string()).min(1, '請選擇至少一個來源欄位'),
  targetField: z.string().min(1, '請選擇目標欄位'),
  transformType: z.enum(['DIRECT', 'CONCAT', 'SPLIT', 'LOOKUP', 'CUSTOM']),
  transformParams: z.record(z.unknown()).optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type RuleFormData = z.infer<typeof ruleSchema>;

export interface RuleEditorProps {
  open: boolean;
  rule: FieldMappingRule | null;
  onSave: (data: Partial<FieldMappingRule>) => Promise<void>;
  onClose: () => void;
}

export function RuleEditor({ open, rule, onSave, onClose }: RuleEditorProps) {
  const isEditing = !!rule;

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      sourceFields: rule?.sourceFields ?? [],
      targetField: rule?.targetField ?? '',
      transformType: rule?.transformType ?? 'DIRECT',
      transformParams: rule?.transformParams ?? {},
      description: rule?.description ?? '',
      isActive: rule?.isActive ?? true,
    },
  });

  React.useEffect(() => {
    if (rule) {
      form.reset({
        sourceFields: rule.sourceFields,
        targetField: rule.targetField,
        transformType: rule.transformType,
        transformParams: rule.transformParams,
        description: rule.description ?? '',
        isActive: rule.isActive,
      });
    } else {
      form.reset({
        sourceFields: [],
        targetField: '',
        transformType: 'DIRECT',
        transformParams: {},
        description: '',
        isActive: true,
      });
    }
  }, [rule, form]);

  const transformType = form.watch('transformType');

  const handleSubmit = async (data: RuleFormData) => {
    await onSave(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? '編輯映射規則' : '新增映射規則'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* 來源欄位 */}
          <div>
            <Label>來源欄位</Label>
            <SourceFieldSelector
              value={form.watch('sourceFields')}
              onChange={(fields) => form.setValue('sourceFields', fields)}
              multiple={transformType === 'CONCAT'}
            />
            {form.formState.errors.sourceFields && (
              <p className="mt-1 text-sm text-red-500">
                {form.formState.errors.sourceFields.message}
              </p>
            )}
          </div>

          {/* 目標欄位 */}
          <div>
            <Label>目標欄位</Label>
            <TargetFieldSelector
              value={form.watch('targetField')}
              onChange={(field) => form.setValue('targetField', field)}
            />
            {form.formState.errors.targetField && (
              <p className="mt-1 text-sm text-red-500">
                {form.formState.errors.targetField.message}
              </p>
            )}
          </div>

          {/* 轉換類型 */}
          <div>
            <Label>轉換類型</Label>
            <Select
              value={transformType}
              onValueChange={(v) => {
                form.setValue('transformType', v as TransformType);
                form.setValue('transformParams', {});
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DIRECT">直接映射</SelectItem>
                <SelectItem value="CONCAT">串接多個欄位</SelectItem>
                <SelectItem value="SPLIT">拆分欄位</SelectItem>
                <SelectItem value="LOOKUP">查表轉換</SelectItem>
                <SelectItem value="CUSTOM">自定義表達式</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 轉換參數 */}
          <TransformConfigPanel
            type={transformType}
            params={form.watch('transformParams') ?? {}}
            onChange={(params) => form.setValue('transformParams', params)}
          />

          {/* 描述 */}
          <div>
            <Label>規則描述（選填）</Label>
            <Input {...form.register('description')} placeholder="描述此規則的用途..." />
          </div>

          {/* 啟用狀態 */}
          <div className="flex items-center gap-2">
            <Switch
              checked={form.watch('isActive')}
              onCheckedChange={(checked) => form.setValue('isActive', checked)}
            />
            <Label>啟用此規則</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? '儲存中...' : '儲存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Project Structure

```
src/
├── components/
│   └── features/
│       └── mapping-config/
│           ├── index.ts                    # 模組導出
│           ├── MappingConfigPanel.tsx      # 主面板
│           ├── ConfigSelector.tsx          # 配置選擇器
│           ├── MappingRuleList.tsx         # 規則列表
│           ├── SortableRuleItem.tsx        # 可拖放規則項
│           ├── RuleEditor.tsx              # 規則編輯器
│           ├── SourceFieldSelector.tsx     # 來源欄位選擇器
│           ├── TargetFieldSelector.tsx     # 目標欄位選擇器
│           └── TransformConfigPanel.tsx    # 轉換參數配置
├── hooks/
│   └── use-mapping-config.ts               # 配置管理 Hook
└── types/
    └── field-mapping.ts                    # 類型定義
```

---

## Dependencies

| 依賴 | 版本 | 用途 |
|------|------|------|
| @dnd-kit/core | ^6.x | 拖放核心功能 |
| @dnd-kit/sortable | ^7.x | 排序功能 |
| @dnd-kit/utilities | ^3.x | 工具函數 |

---

## Verification Checklist

### 功能驗證

- [ ] 配置範圍切換正常（全域/公司/格式）
- [ ] 公司/格式選擇器正確載入選項
- [ ] 規則列表正確顯示
- [ ] 新增規則功能正常
- [ ] 編輯規則功能正常
- [ ] 刪除規則功能正常
- [ ] 拖放排序功能正常
- [ ] 排序結果正確保存
- [ ] 表單驗證正常
- [ ] 各轉換類型參數配置正常

---

*Tech Spec 建立日期: 2026-01-02*
*狀態: Draft*
