# Tech Spec: Story 16.6 - 動態欄位映射配置

> **Version**: 1.0.0
> **Created**: 2026-01-13
> **Status**: Draft
> **Story Key**: STORY-16-6

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 16.6 |
| **Epic** | Epic 16 - 文件格式管理 |
| **Estimated Effort** | 8 Story Points |
| **Dependencies** | Story 16-7（DataTemplate）, Story 13-4（FieldMappingConfig）, Epic 15（統一處理流程） |
| **Blocking** | 無 |

---

## Objective

1. **動態來源欄位**: 從 GPT 提取結果動態獲取可用欄位，結合 `invoice-fields.ts` 的 90+ 標準欄位
2. **完成 stub 實現**: 完成 `field-mapping.step.ts` 中的 `applyThreeTierMapping` 方法，調用 `DynamicMappingService`

### 問題背景

目前：
- `field-mapping.step.ts` 的 `applyThreeTierMapping` 是 stub 實現，只做直接映射
- 來源欄位是靜態定義的 22 個欄位，沒有使用 `invoice-fields.ts` 的 90+ 標準欄位
- UI 不支援動態來源欄位選擇

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-16.6.1 | 動態來源欄位 | 從 GPT 結果 + INVOICE_FIELDS 合併 |
| AC-16.6.2 | 來源欄位 UI | SourceFieldCombobox 動態下拉選單 |
| AC-16.6.3 | 三層映射完成 | 調用 DynamicMappingService.mapFields() |
| AC-16.6.4 | 映射結果存儲 | context.mappedFields 正確填充 |
| AC-16.6.5 | 未映射欄位追蹤 | context.unmappedFields 正確填充 |
| AC-16.6.6 | 自訂欄位支援 | 允許手動輸入來源欄位名稱 |
| AC-16.6.7 | 提取欄位 API | GET /api/v1/formats/:id/extracted-fields |

---

## Implementation Guide

### Phase 1: 來源欄位服務 (2 points)

#### 1.1 新增 source-field.service.ts

```typescript
// src/services/field-mapping/source-field.service.ts

/**
 * @fileoverview 來源欄位服務
 * @description
 *   提供動態來源欄位列表，合併：
 *   - 標準欄位（invoice-fields.ts 的 90+ 欄位）
 *   - 提取欄位（GPT 提取結果的欄位）
 *   - 自訂欄位（用戶手動輸入的欄位）
 *
 * @module src/services/field-mapping
 * @since Epic 16 - Story 16.6
 * @lastModified 2026-01-13
 */

import {
  INVOICE_FIELDS,
  FIELD_CATEGORIES,
  type FieldCategory,
  type InvoiceFieldDefinition,
} from '@/types/invoice-fields';

// ============================================================================
// Types
// ============================================================================

/**
 * 來源欄位選項
 */
export interface SourceFieldOption {
  /** 欄位名稱（唯一識別符） */
  name: string;
  /** 顯示標籤 */
  label: string;
  /** 分類 */
  category: string;
  /** 來源類型 */
  source: 'standard' | 'extracted' | 'custom';
  /** 資料類型（標準欄位有） */
  dataType?: string;
  /** 是否必填（標準欄位有） */
  isRequired?: boolean;
}

/**
 * 分組的來源欄位選項
 */
export interface GroupedSourceFields {
  [category: string]: SourceFieldOption[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 分類顯示名稱（中文）
 */
export const CATEGORY_LABELS: Record<FieldCategory | 'extracted' | 'custom', string> = {
  basic: '基本資訊',
  shipper: '發貨人資訊',
  consignee: '收貨人資訊',
  shipping: '運輸資訊',
  package: '包裝資訊',
  charges: '費用明細',
  reference: '參考編號',
  payment: '付款資訊',
  extracted: '提取欄位',
  custom: '自訂欄位',
};

// ============================================================================
// Functions
// ============================================================================

/**
 * 取得標準來源欄位列表
 * @returns 標準欄位選項列表
 */
export function getStandardSourceFields(): SourceFieldOption[] {
  return Object.values(INVOICE_FIELDS).map((field: InvoiceFieldDefinition) => ({
    name: field.name,
    label: field.label,
    category: field.category,
    source: 'standard' as const,
    dataType: field.dataType,
    isRequired: field.isRequired,
  }));
}

/**
 * 取得可用的來源欄位（含提取欄位）
 * @param extractedData GPT 提取的數據
 */
export function getAvailableSourceFields(
  extractedData?: Record<string, unknown>
): SourceFieldOption[] {
  const fields: SourceFieldOption[] = [];

  // 1. 標準欄位 (invoice-fields.ts)
  fields.push(...getStandardSourceFields());

  // 2. 提取的欄位 (從 GPT 結果)
  if (extractedData) {
    const standardNames = new Set(fields.map((f) => f.name));

    for (const key of Object.keys(extractedData)) {
      // 跳過已存在的標準欄位
      if (standardNames.has(key)) {
        continue;
      }
      // 跳過系統內部欄位
      if (key.startsWith('_') || key === 'confidence') {
        continue;
      }

      fields.push({
        name: key,
        label: formatExtractedFieldLabel(key),
        category: 'extracted',
        source: 'extracted',
      });
    }
  }

  return fields;
}

/**
 * 取得分組的來源欄位
 * @param extractedData GPT 提取的數據
 */
export function getGroupedSourceFields(
  extractedData?: Record<string, unknown>
): GroupedSourceFields {
  const fields = getAvailableSourceFields(extractedData);
  const grouped: GroupedSourceFields = {};

  for (const field of fields) {
    const category = field.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(field);
  }

  // 按預定義順序排序
  const orderedCategories = [
    'basic',
    'shipper',
    'consignee',
    'shipping',
    'package',
    'charges',
    'reference',
    'payment',
    'extracted',
  ];

  const result: GroupedSourceFields = {};
  for (const cat of orderedCategories) {
    if (grouped[cat] && grouped[cat].length > 0) {
      result[cat] = grouped[cat];
    }
  }

  return result;
}

/**
 * 格式化提取欄位的標籤
 */
function formatExtractedFieldLabel(fieldName: string): string {
  // 將 snake_case 或 camelCase 轉換為空格分隔
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (s) => s.toUpperCase());
}

/**
 * 搜尋欄位（用於 Combobox）
 * @param query 搜尋關鍵字
 * @param fields 欄位列表
 */
export function searchFields(
  query: string,
  fields: SourceFieldOption[]
): SourceFieldOption[] {
  if (!query) {
    return fields;
  }

  const lowerQuery = query.toLowerCase();
  return fields.filter(
    (f) =>
      f.name.toLowerCase().includes(lowerQuery) ||
      f.label.toLowerCase().includes(lowerQuery)
  );
}

/**
 * 驗證欄位名稱是否有效
 */
export function isValidFieldName(name: string): boolean {
  // 允許字母、數字、底線，不能以數字開頭
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}
```

### Phase 2: 提取欄位 API (1 point)

#### 2.1 新增 extracted-fields API

```typescript
// src/app/api/v1/formats/[id]/extracted-fields/route.ts

/**
 * @fileoverview 格式提取欄位 API
 * @description
 *   取得該格式文件曾經提取出的欄位名稱範例，
 *   用於動態來源欄位選擇器。
 *
 * @module src/app/api/v1/formats/[id]/extracted-fields
 * @since Epic 16 - Story 16.6
 * @lastModified 2026-01-13
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse, createApiError } from '@/lib/api/response';

interface ExtractedFieldInfo {
  name: string;
  occurrences: number;
  sampleValues: (string | number | null)[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 驗證格式存在
    const format = await prisma.documentFormat.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });

    if (!format) {
      return NextResponse.json(
        createApiError({
          type: 'NOT_FOUND',
          title: 'Format not found',
          status: 404,
        }),
        { status: 404 }
      );
    }

    // 查詢該格式最近 20 個已處理文件的提取結果
    const documents = await prisma.document.findMany({
      where: {
        documentFormatId: id,
        status: { in: ['COMPLETED', 'APPROVED'] },
        extractedData: { not: null },
      },
      select: {
        extractedData: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    // 合併所有欄位名稱
    const fieldMap = new Map<string, ExtractedFieldInfo>();

    for (const doc of documents) {
      const data = doc.extractedData as Record<string, unknown> | null;
      if (!data) continue;

      for (const [key, value] of Object.entries(data)) {
        // 跳過系統欄位
        if (key.startsWith('_') || key === 'confidence') {
          continue;
        }

        if (!fieldMap.has(key)) {
          fieldMap.set(key, {
            name: key,
            occurrences: 0,
            sampleValues: [],
          });
        }

        const info = fieldMap.get(key)!;
        info.occurrences++;

        // 收集樣本值（最多 3 個）
        if (
          info.sampleValues.length < 3 &&
          value !== null &&
          value !== undefined
        ) {
          const sampleValue =
            typeof value === 'string' || typeof value === 'number'
              ? value
              : null;
          if (sampleValue !== null && !info.sampleValues.includes(sampleValue)) {
            info.sampleValues.push(sampleValue);
          }
        }
      }
    }

    // 轉換為陣列，按出現頻率排序
    const fields = Array.from(fieldMap.values()).sort(
      (a, b) => b.occurrences - a.occurrences
    );

    return NextResponse.json(
      createApiResponse({
        fields,
        totalDocuments: documents.length,
      })
    );
  } catch (error) {
    console.error('[GET /api/v1/formats/[id]/extracted-fields] Error:', error);
    return NextResponse.json(
      createApiError({
        type: 'INTERNAL_ERROR',
        title: 'Internal server error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
}
```

### Phase 3: 完成 field-mapping.step.ts (2.5 points)

#### 3.1 修改 field-mapping.step.ts

```typescript
// src/services/unified-processor/steps/field-mapping.step.ts

/**
 * @fileoverview Step 8: 欄位映射
 * @description
 *   執行三層欄位映射：
 *   - Tier 1: Universal Mapping（通用層）
 *   - Tier 2: Company-Specific Override（公司特定覆蓋層）
 *   - Tier 3: LLM Classification（AI 智能分類）
 *
 *   Story 16.6: 完成 stub 實現，調用 DynamicMappingService
 *
 * @module src/services/unified-processor/steps
 * @since Epic 15 - Story 15.1 (整合 Story 13.5)
 * @lastModified 2026-01-13 (Story 16.6)
 */

import {
  ProcessingStep,
  StepPriority,
  StepConfig,
  StepResult,
  UnifiedProcessingContext,
  UnifiedProcessorFlags,
  MappedFieldValue,
  UnmappedField,
} from '@/types/unified-processor';
import { BaseStepHandler } from '../interfaces/step-handler.interface';
import { DynamicMappingService } from '@/services/dynamic-field-mapping.service';
import { prisma } from '@/lib/prisma';

/**
 * 映射結果
 */
interface MappingResult {
  mappedFields: MappedFieldValue[];
  unmappedFields: UnmappedField[];
  stats: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
}

/**
 * 欄位映射步驟
 */
export class FieldMappingStep extends BaseStepHandler {
  readonly step = ProcessingStep.FIELD_MAPPING;
  readonly priority = StepPriority.OPTIONAL;

  constructor(config: StepConfig) {
    super(config);
  }

  /**
   * 檢查是否應該執行
   */
  shouldExecute(
    context: UnifiedProcessingContext,
    flags: UnifiedProcessorFlags
  ): boolean {
    if (!super.shouldExecute(context, flags)) {
      return false;
    }

    // 需要有提取數據才能進行映射
    const hasExtractedData = Boolean(
      context.extractedData?.invoiceData ||
      context.extractedData?.gptExtraction
    );

    return hasExtractedData;
  }

  /**
   * 執行欄位映射
   */
  protected async doExecute(
    context: UnifiedProcessingContext,
    _flags: UnifiedProcessorFlags
  ): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // 準備輸入數據
      const rawData = {
        ...context.extractedData?.invoiceData,
        ...context.extractedData?.gptExtraction,
      };

      // 執行三層映射
      const mappingResult = await this.applyThreeTierMapping(
        rawData,
        context.mappingConfig,
        context.companyId,
        context.documentFormatId
      );

      // 更新上下文
      context.mappedFields = mappingResult.mappedFields;
      context.unmappedFields = mappingResult.unmappedFields;

      console.log(
        `[Step 8] Field mapping completed: ${mappingResult.mappedFields.length} mapped, ${mappingResult.unmappedFields.length} unmapped`
      );

      return this.createSuccessResult(
        {
          mappedCount: mappingResult.mappedFields.length,
          unmappedCount: mappingResult.unmappedFields.length,
          tier1Matches: mappingResult.stats.tier1,
          tier2Matches: mappingResult.stats.tier2,
          tier3Matches: mappingResult.stats.tier3,
        },
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      context.warnings.push({
        step: this.step,
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      return this.createFailedResult(startTime, err);
    }
  }

  /**
   * 執行三層欄位映射
   * @description Story 16.6: 完成實現，調用 DynamicMappingService
   */
  private async applyThreeTierMapping(
    rawData: Record<string, unknown>,
    mappingConfig: UnifiedProcessingContext['mappingConfig'],
    companyId?: string,
    documentFormatId?: string
  ): Promise<MappingResult> {
    // === 1. 嘗試使用 FieldMappingConfig ===
    if (mappingConfig?.fieldMappingConfigId) {
      console.log(
        `[Step 8] Using FieldMappingConfig: ${mappingConfig.fieldMappingConfigId}`
      );

      try {
        const result = await DynamicMappingService.mapFields({
          sourceData: rawData,
          configId: mappingConfig.fieldMappingConfigId,
          companyId,
        });

        return {
          mappedFields: result.mappedFields,
          unmappedFields: result.unmappedFields,
          stats: result.stats,
        };
      } catch (error) {
        console.warn(
          `[Step 8] DynamicMappingService failed, falling back to direct mapping:`,
          error
        );
      }
    }

    // === 2. 嘗試查找 FORMAT 級別配置 ===
    if (documentFormatId) {
      const formatConfig = await prisma.fieldMappingConfig.findFirst({
        where: {
          documentFormatId,
          scope: 'FORMAT',
          isActive: true,
        },
        select: { id: true },
      });

      if (formatConfig) {
        console.log(
          `[Step 8] Found FORMAT-level config: ${formatConfig.id}`
        );

        try {
          const result = await DynamicMappingService.mapFields({
            sourceData: rawData,
            configId: formatConfig.id,
            companyId,
          });

          return {
            mappedFields: result.mappedFields,
            unmappedFields: result.unmappedFields,
            stats: result.stats,
          };
        } catch (error) {
          console.warn(
            `[Step 8] FORMAT config mapping failed:`,
            error
          );
        }
      }
    }

    // === 3. 嘗試查找 COMPANY 級別配置 ===
    if (companyId) {
      const companyConfig = await prisma.fieldMappingConfig.findFirst({
        where: {
          companyId,
          scope: 'COMPANY',
          isActive: true,
        },
        select: { id: true },
      });

      if (companyConfig) {
        console.log(
          `[Step 8] Found COMPANY-level config: ${companyConfig.id}`
        );

        try {
          const result = await DynamicMappingService.mapFields({
            sourceData: rawData,
            configId: companyConfig.id,
            companyId,
          });

          return {
            mappedFields: result.mappedFields,
            unmappedFields: result.unmappedFields,
            stats: result.stats,
          };
        } catch (error) {
          console.warn(
            `[Step 8] COMPANY config mapping failed:`,
            error
          );
        }
      }
    }

    // === 4. 嘗試查找 GLOBAL 級別配置 ===
    const globalConfig = await prisma.fieldMappingConfig.findFirst({
      where: {
        scope: 'GLOBAL',
        isActive: true,
      },
      select: { id: true },
    });

    if (globalConfig) {
      console.log(
        `[Step 8] Found GLOBAL-level config: ${globalConfig.id}`
      );

      try {
        const result = await DynamicMappingService.mapFields({
          sourceData: rawData,
          configId: globalConfig.id,
          companyId,
        });

        return {
          mappedFields: result.mappedFields,
          unmappedFields: result.unmappedFields,
          stats: result.stats,
        };
      } catch (error) {
        console.warn(
          `[Step 8] GLOBAL config mapping failed:`,
          error
        );
      }
    }

    // === 5. 沒有配置，使用直接映射 ===
    console.log(`[Step 8] No mapping config found, using direct mapping`);
    return this.directMapping(rawData);
  }

  /**
   * 直接映射（無配置時的 fallback）
   */
  private directMapping(rawData: Record<string, unknown>): MappingResult {
    const mappedFields: MappedFieldValue[] = Object.entries(rawData)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value]) => ({
        targetField: key,
        value: typeof value === 'string' || typeof value === 'number' ? value : null,
        sourceFields: [key],
        originalValues: [typeof value === 'string' || typeof value === 'number' ? value : null],
        transformType: 'DIRECT' as const,
        success: true,
      }));

    return {
      mappedFields,
      unmappedFields: [],
      stats: {
        tier1: mappedFields.length,
        tier2: 0,
        tier3: 0,
      },
    };
  }
}
```

### Phase 4: UI 動態來源欄位 (2.5 points)

#### 4.1 新增 SourceFieldCombobox.tsx

```typescript
// src/components/features/field-mapping/SourceFieldCombobox.tsx

/**
 * @fileoverview 來源欄位選擇器
 * @description
 *   動態來源欄位選擇器，支援：
 *   - 標準欄位（90+ 發票欄位）
 *   - 提取欄位（GPT 提取的動態欄位）
 *   - 自訂欄位（手動輸入）
 *
 * @module src/components/features/field-mapping
 * @since Epic 16 - Story 16.6
 * @lastModified 2026-01-13
 */

'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import {
  getStandardSourceFields,
  getAvailableSourceFields,
  CATEGORY_LABELS,
  type SourceFieldOption,
  type GroupedSourceFields,
} from '@/services/field-mapping/source-field.service';

// ============================================================================
// Types
// ============================================================================

export interface SourceFieldComboboxProps {
  /** 選中的值 */
  value: string;
  /** 值變更回調 */
  onChange: (value: string) => void;
  /** 格式 ID（用於獲取提取欄位） */
  documentFormatId?: string;
  /** 是否允許自訂欄位 */
  allowCustom?: boolean;
  /** 佔位文字 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 類名 */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function SourceFieldCombobox({
  value,
  onChange,
  documentFormatId,
  allowCustom = true,
  placeholder = '選擇來源欄位...',
  disabled = false,
  className,
}: SourceFieldComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [customValue, setCustomValue] = React.useState('');

  // --- 獲取欄位列表 ---

  const { data: extractedFields } = useQuery({
    queryKey: ['extracted-fields', documentFormatId],
    queryFn: async () => {
      if (!documentFormatId) {
        return {};
      }
      const res = await fetch(`/api/v1/formats/${documentFormatId}/extracted-fields`);
      if (!res.ok) {
        return {};
      }
      const json = await res.json();
      // 將 API 結果轉換為 Record<string, unknown>
      const data: Record<string, unknown> = {};
      for (const field of json.data?.fields || []) {
        data[field.name] = field.sampleValues?.[0] || null;
      }
      return data;
    },
    enabled: !!documentFormatId,
  });

  const fields = React.useMemo(() => {
    return getAvailableSourceFields(extractedFields);
  }, [extractedFields]);

  // 按分類分組
  const groupedFields = React.useMemo(() => {
    const groups: GroupedSourceFields = {};
    for (const field of fields) {
      const cat = field.category;
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(field);
    }
    return groups;
  }, [fields]);

  // --- 取得選中項目的標籤 ---

  const selectedField = fields.find((f) => f.name === value);
  const displayValue = selectedField?.label || value || placeholder;

  // --- Handlers ---

  const handleSelect = (fieldName: string) => {
    onChange(fieldName);
    setOpen(false);
  };

  const handleAddCustom = () => {
    if (customValue.trim()) {
      onChange(customValue.trim());
      setCustomValue('');
      setOpen(false);
    }
  };

  // --- Render ---

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between', className)}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="搜尋欄位..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              {allowCustom ? (
                <div className="p-2">
                  <p className="text-sm text-muted-foreground mb-2">
                    找不到匹配的欄位
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-2 py-1 text-sm border rounded"
                      placeholder="輸入自訂欄位名稱"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddCustom();
                        }
                      }}
                    />
                    <Button size="sm" onClick={handleAddCustom}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                '找不到匹配的欄位'
              )}
            </CommandEmpty>

            {/* 按分類顯示 */}
            {Object.entries(groupedFields).map(([category, categoryFields]) => (
              <React.Fragment key={category}>
                <CommandGroup
                  heading={
                    CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ||
                    category
                  }
                >
                  {categoryFields.map((field) => (
                    <CommandItem
                      key={field.name}
                      value={field.name}
                      onSelect={() => handleSelect(field.name)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === field.name ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="flex-1">{field.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {field.name}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

---

## File Structure

```
src/
├── services/
│   ├── field-mapping/
│   │   └── source-field.service.ts       # 新增
│   └── unified-processor/steps/
│       └── field-mapping.step.ts         # 更新
├── components/features/field-mapping/
│   └── SourceFieldCombobox.tsx           # 新增
└── app/api/v1/formats/[id]/
    └── extracted-fields/
        └── route.ts                      # 新增
```

---

## Testing Checklist

### 單元測試
- [ ] `getStandardSourceFields` 返回 90+ 標準欄位
- [ ] `getAvailableSourceFields` 正確合併提取欄位
- [ ] `searchFields` 正確過濾欄位
- [ ] `isValidFieldName` 驗證邏輯正確

### API 測試
- [ ] GET /api/v1/formats/:id/extracted-fields 返回正確數據
- [ ] 沒有提取數據時返回空列表
- [ ] 格式不存在時返回 404

### 整合測試
- [ ] FieldMappingStep 正確調用 DynamicMappingService
- [ ] 按 FORMAT → COMPANY → GLOBAL 順序查找配置
- [ ] 沒有配置時使用直接映射

### UI 測試
- [ ] SourceFieldCombobox 正確顯示分組
- [ ] 搜尋功能正常
- [ ] 自訂欄位輸入正常
- [ ] 選擇後正確觸發 onChange

---

## Migration Notes

此 Story 不需要資料庫遷移，只涉及服務層和 UI 的更新。

---

## Dependencies

- `DynamicMappingService` - 已存在，需確保其 `mapFields` 方法正常運作
- `prisma.fieldMappingConfig` - 已存在
- `@/types/invoice-fields` - 已存在（90+ 標準欄位定義）
