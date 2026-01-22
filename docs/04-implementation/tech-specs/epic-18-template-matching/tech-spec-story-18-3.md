# Tech Spec: Story 18.3 - 模版匹配引擎服務

> **Version**: 1.0.0
> **Created**: 2026-01-22
> **Status**: Draft
> **Story Key**: STORY-18-3

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 18.3 |
| **Epic** | Epic 18 - 數據模版匹配與輸出 |
| **Estimated Effort** | 10 Story Points |
| **Dependencies** | Story 18-1, 18-2 |
| **Blocking** | Story 18-5, 18-6, 18-7 |

---

## Objective

建立核心的模版匹配引擎，負責將 Document.mappedFields 轉換並填入 TemplateInstance。

---

## Implementation Guide

### Phase 1: 核心引擎架構

```typescript
// src/services/template-matching-engine.service.ts

export interface MatchDocumentsParams {
  documentIds: string[];
  templateInstanceId: string;
  options?: {
    rowKeyField?: string;      // 預設 'shipment_no'
    companyId?: string;
    formatId?: string;
    batchSize?: number;        // 預設 100
    skipValidation?: boolean;
    onProgress?: (progress: MatchProgress) => void;
  };
}

export interface MatchResult {
  instanceId: string;
  totalDocuments: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  results: RowResult[];
}

export class TemplateMatchingEngineService {
  constructor(
    private fieldMappingService: TemplateFieldMappingService,
    private instanceService: TemplateInstanceService,
    private transformExecutor: TransformExecutor,
  ) {}

  async matchDocuments(params: MatchDocumentsParams): Promise<MatchResult>;
  private async processBatch(batch, instance, template, mappingConfig, options): Promise<RowResult[]>;
  private async transformFields(sourceFields, mappings): Promise<Record<string, unknown>>;
  private async upsertRow(tx, params): Promise<TemplateInstanceRow>;
  private extractRowKey(doc, rowKeyField): string;
  private mergeFieldValues(existing, newValues): Record<string, unknown>;
}
```

### Phase 2: 轉換器模組

```typescript
// src/services/transform/transform-executor.ts

export interface Transform {
  execute(value: unknown, params?: TransformParams, context?: Record<string, unknown>): Promise<unknown>;
}

export class TransformExecutor {
  private transforms: Map<FieldTransformType, Transform>;

  constructor() {
    this.transforms.set('DIRECT', new DirectTransform());
    this.transforms.set('FORMULA', new FormulaTransform());
    this.transforms.set('LOOKUP', new LookupTransform());
  }

  async execute(value, type, params?, context?): Promise<unknown>;
}

// Direct Transform - 直接映射
export class DirectTransform implements Transform {
  async execute(value: unknown): Promise<unknown> {
    return value;
  }
}

// Formula Transform - 公式計算
export class FormulaTransform implements Transform {
  async execute(value, params: FormulaTransformParams, context): Promise<unknown> {
    let formula = params.formula;
    // 替換 {field} 變數
    for (const [key, val] of Object.entries(context || {})) {
      formula = formula.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val || 0));
    }
    return this.safeEval(formula);
  }

  private safeEval(expr: string): number {
    // 安全計算：只允許數字和基本運算符
    if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr)) {
      throw new Error('Invalid formula');
    }
    return Function(`"use strict"; return (${expr})`)();
  }
}

// Lookup Transform - 查表映射
export class LookupTransform implements Transform {
  async execute(value, params: LookupTransformParams): Promise<unknown> {
    const key = String(value);
    return params.lookupTable[key] ?? params.defaultValue ?? value;
  }
}
```

### Phase 3: 批量處理邏輯

```typescript
// 處理流程
async matchDocuments(params: MatchDocumentsParams): Promise<MatchResult> {
  const { documentIds, templateInstanceId, options = {} } = params;

  // 1. 獲取實例和模版
  const instance = await this.instanceService.getById(templateInstanceId);
  const template = await this.getDataTemplate(instance.dataTemplateId);

  // 2. 解析映射規則
  const mappingConfig = await this.fieldMappingService.resolveMapping({
    dataTemplateId: instance.dataTemplateId,
    companyId: options.companyId,
    formatId: options.formatId,
  });

  // 3. 載入文件
  const documents = await this.loadDocuments(documentIds);

  // 4. 分批處理
  const results: RowResult[] = [];
  const batches = this.createBatches(documents, options.batchSize || 100);

  for (const batch of batches) {
    const batchResults = await this.processBatch(batch, instance, template, mappingConfig, options);
    results.push(...batchResults);

    // 進度回調
    options.onProgress?.({ processed: results.length, total: documents.length });
  }

  // 5. 更新統計
  await this.instanceService.updateStatistics(templateInstanceId);

  return {
    instanceId: templateInstanceId,
    totalDocuments: documents.length,
    totalRows: results.length,
    validRows: results.filter(r => r.status === 'VALID').length,
    invalidRows: results.filter(r => r.status === 'INVALID').length,
    results,
  };
}
```

### Phase 4: API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/v1/template-matching/execute | 執行匹配 |
| POST | /api/v1/template-matching/preview | 預覽匹配結果 |
| POST | /api/v1/template-matching/validate | 驗證映射配置 |

---

## File Structure

```
src/services/
├── template-matching-engine.service.ts
└── transform/
    ├── index.ts
    ├── direct.transform.ts
    ├── formula.transform.ts
    ├── lookup.transform.ts
    └── transform-executor.ts

src/app/api/v1/template-matching/
├── execute/route.ts
├── preview/route.ts
└── validate/route.ts
```

---

## Testing Checklist

- [ ] DIRECT 轉換正確
- [ ] FORMULA 轉換正確計算
- [ ] LOOKUP 轉換正確查表
- [ ] 批量處理正常
- [ ] 同 rowKey 合併正確
- [ ] 驗證錯誤記錄正確
- [ ] 事務一致性正確
