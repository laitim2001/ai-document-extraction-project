# Story 19.3: 模版匹配引擎服務

**Status:** done

---

## Story

**As a** 系統,
**I want** 提供核心的模版匹配引擎,
**So that** Document 記錄的提取數據可以被正確轉換並填入 TemplateInstance。

---

## 背景說明

### 問題陳述

這是 Epic 19 的核心服務，負責執行以下流程：

```
Document (mappedFields) ──► TemplateFieldMapping ──► TemplateInstance (rows)
```

### 核心功能

1. **解析映射配置**：根據 dataTemplateId、companyId、formatId 獲取合併後的映射規則
2. **執行欄位轉換**：將 mappedFields 轉換為 templateFields
3. **填入模版實例**：創建或更新 TemplateInstanceRow
4. **驗證數據**：根據 DataTemplate 的欄位定義驗證數據
5. **處理衝突**：同一 rowKey 多個來源的合併策略

### 轉換流程

```
輸入：
  - Document.mappedFields: { sea_freight: 500, terminal_handling: 100 }
  - TemplateFieldMapping: [
      { sourceField: 'sea_freight', targetField: 'shipping_cost', transformType: 'DIRECT' },
      { sourceField: 'terminal_handling', targetField: 'port_fees', transformType: 'DIRECT' }
    ]

處理：
  1. 解析映射規則
  2. 執行轉換（DIRECT / FORMULA / LOOKUP）
  3. 驗證目標欄位

輸出：
  - TemplateInstanceRow.fieldValues: { shipping_cost: 500, port_fees: 100 }
```

---

## Acceptance Criteria

### AC1: 匹配引擎服務

**Given** TemplateMatchingEngineService
**When** 調用 matchDocuments(documentIds, templateInstanceId)
**Then** 正確創建 TemplateInstanceRow 記錄

### AC2: 映射解析

**Given** 多層 TemplateFieldMapping 配置
**When** 執行匹配
**Then** 按 FORMAT → COMPANY → GLOBAL 優先級正確解析

### AC3: DIRECT 轉換

**Given** transformType = DIRECT
**When** 執行轉換
**Then** 直接複製源欄位值到目標欄位

### AC4: FORMULA 轉換

**Given** transformType = FORMULA, formula = "{sea_freight} + {terminal_handling}"
**When** 執行轉換
**Then** 計算公式並填入目標欄位

### AC5: LOOKUP 轉換

**Given** transformType = LOOKUP, lookupTable = { "AIR": "空運", "SEA": "海運" }
**When** 執行轉換
**Then** 根據源值查表並填入目標欄位

### AC6: 多文件合併

**Given** 多個 Document 有相同的 rowKey (如 shipment_no)
**When** 執行匹配
**Then**:
  - 合併到同一 TemplateInstanceRow
  - 記錄所有 sourceDocumentIds
  - 按優先級處理欄位衝突

### AC7: 驗證和錯誤處理

**Given** 轉換後的數據
**When** 驗證失敗
**Then**:
  - 記錄 validationErrors
  - 更新 row.status = INVALID
  - 更新 instance.errorRowCount

### AC8: 批量處理

**Given** 大量 Document
**When** 執行批量匹配
**Then**:
  - 使用事務確保一致性
  - 支持分批處理（避免內存溢出）
  - 提供處理進度回調

---

## Tasks / Subtasks

- [ ] **Task 1: 核心引擎服務** (AC: #1, #2)
  - [ ] 1.1 新增 `template-matching-engine.service.ts`
  - [ ] 1.2 實現 matchDocuments 主方法
  - [ ] 1.3 整合 TemplateFieldMappingService 獲取映射
  - [ ] 1.4 整合 TemplateInstanceService 管理實例

- [ ] **Task 2: 轉換器模組** (AC: #3, #4, #5)
  - [ ] 2.1 新增 `transform/direct.transform.ts`
  - [ ] 2.2 新增 `transform/formula.transform.ts`
  - [ ] 2.3 新增 `transform/lookup.transform.ts`
  - [ ] 2.4 新增 `transform/transform-executor.ts` (工廠)

- [ ] **Task 3: 合併策略** (AC: #6)
  - [ ] 3.1 實現 rowKey 提取邏輯
  - [ ] 3.2 實現同 rowKey 多文件合併
  - [ ] 3.3 實現欄位衝突解決策略
  - [ ] 3.4 實現 sourceDocumentIds 追蹤

- [ ] **Task 4: 驗證模組** (AC: #7)
  - [ ] 4.1 整合 DataTemplate 欄位驗證
  - [ ] 4.2 實現錯誤記錄機制
  - [ ] 4.3 實現批量驗證優化

- [ ] **Task 5: 批量處理優化** (AC: #8)
  - [ ] 5.1 實現事務包裝
  - [ ] 5.2 實現分批處理邏輯
  - [ ] 5.3 實現進度回調機制
  - [ ] 5.4 實現錯誤隔離（單行失敗不影響整批）

- [ ] **Task 6: API 端點**
  - [ ] 6.1 新增 `/api/v1/template-matching/execute/route.ts`
  - [ ] 6.2 新增 `/api/v1/template-matching/preview/route.ts`
  - [ ] 6.3 新增 `/api/v1/template-matching/validate/route.ts`

- [ ] **Task 7: 單元測試**
  - [ ] 7.1 各轉換器單元測試
  - [ ] 7.2 合併策略測試
  - [ ] 7.3 驗證邏輯測試
  - [ ] 7.4 批量處理測試

---

## Dev Notes

### 依賴項

- **Story 19-1**: TemplateFieldMapping（映射規則）
- **Story 19-2**: TemplateInstance（實例管理）
- **Document 模型**: mappedFields 數據來源

### 新增文件

```
src/
├── services/
│   ├── template-matching-engine.service.ts    # 新增：核心引擎
│   └── transform/                              # 新增：轉換器目錄
│       ├── index.ts
│       ├── direct.transform.ts
│       ├── formula.transform.ts
│       ├── lookup.transform.ts
│       └── transform-executor.ts
└── app/api/v1/template-matching/
    ├── execute/route.ts                        # 新增
    ├── preview/route.ts                        # 新增
    └── validate/route.ts                       # 新增
```

### 核心引擎設計

```typescript
// src/services/template-matching-engine.service.ts

export class TemplateMatchingEngineService {
  constructor(
    private fieldMappingService: TemplateFieldMappingService,
    private instanceService: TemplateInstanceService,
    private transformExecutor: TransformExecutor,
  ) {}

  /**
   * 執行文件到模版的匹配
   */
  async matchDocuments(params: MatchDocumentsParams): Promise<MatchResult> {
    const {
      documentIds,
      templateInstanceId,
      options = {},
    } = params;

    // 1. 獲取 TemplateInstance 和 DataTemplate
    const instance = await this.instanceService.getById(templateInstanceId);
    const template = await this.getDataTemplate(instance.dataTemplateId);

    // 2. 解析映射規則
    const mappingConfig = await this.fieldMappingService.resolveMapping(
      instance.dataTemplateId,
      options.companyId,
      options.formatId,
    );

    // 3. 載入 Documents
    const documents = await this.loadDocuments(documentIds);

    // 4. 分批處理
    const results: RowResult[] = [];
    const batches = this.createBatches(documents, options.batchSize || 100);

    for (const batch of batches) {
      const batchResults = await this.processBatch(
        batch,
        instance,
        template,
        mappingConfig,
        options,
      );
      results.push(...batchResults);

      // 進度回調
      if (options.onProgress) {
        options.onProgress({
          processed: results.length,
          total: documents.length,
        });
      }
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

  /**
   * 處理單批文件
   */
  private async processBatch(
    documents: Document[],
    instance: TemplateInstance,
    template: DataTemplate,
    mappingConfig: ResolvedMappingConfig,
    options: MatchOptions,
  ): Promise<RowResult[]> {
    return prisma.$transaction(async (tx) => {
      const results: RowResult[] = [];

      for (const doc of documents) {
        try {
          // 提取 rowKey
          const rowKey = this.extractRowKey(doc, options.rowKeyField || 'shipment_no');

          // 轉換欄位
          const transformedFields = await this.transformFields(
            doc.mappedFields,
            mappingConfig.mappings,
          );

          // 驗證
          const validation = await this.validate(transformedFields, template.fields);

          // 查找或創建行
          const row = await this.upsertRow(tx, {
            instanceId: instance.id,
            rowKey,
            documentId: doc.id,
            fieldValues: transformedFields,
            validation,
          });

          results.push({
            documentId: doc.id,
            rowId: row.id,
            rowKey,
            status: validation.isValid ? 'VALID' : 'INVALID',
            errors: validation.errors,
          });
        } catch (error) {
          results.push({
            documentId: doc.id,
            rowId: null,
            rowKey: null,
            status: 'ERROR',
            errors: { _system: error.message },
          });
        }
      }

      return results;
    });
  }

  /**
   * 轉換欄位值
   */
  private async transformFields(
    sourceFields: Record<string, unknown>,
    mappings: TemplateFieldMappingRule[],
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const mapping of mappings.sort((a, b) => a.order - b.order)) {
      const sourceValue = sourceFields[mapping.sourceField];

      if (sourceValue !== undefined) {
        result[mapping.targetField] = await this.transformExecutor.execute(
          sourceValue,
          mapping.transformType,
          mapping.transformParams,
          sourceFields, // 用於 FORMULA 計算
        );
      }
    }

    return result;
  }

  /**
   * 處理同 rowKey 的合併
   */
  private async upsertRow(
    tx: PrismaTransaction,
    params: UpsertRowParams,
  ): Promise<TemplateInstanceRow> {
    const existing = await tx.templateInstanceRow.findUnique({
      where: {
        templateInstanceId_rowKey: {
          templateInstanceId: params.instanceId,
          rowKey: params.rowKey,
        },
      },
    });

    if (existing) {
      // 合併策略：新值覆蓋空值，追加 documentId
      const mergedValues = this.mergeFieldValues(
        existing.fieldValues as Record<string, unknown>,
        params.fieldValues,
      );
      const mergedDocIds = [...new Set([
        ...existing.sourceDocumentIds,
        params.documentId,
      ])];

      return tx.templateInstanceRow.update({
        where: { id: existing.id },
        data: {
          fieldValues: mergedValues,
          sourceDocumentIds: mergedDocIds,
          validationErrors: params.validation.errors,
          status: params.validation.isValid ? 'VALID' : 'INVALID',
        },
      });
    } else {
      // 創建新行
      const maxIndex = await tx.templateInstanceRow.count({
        where: { templateInstanceId: params.instanceId },
      });

      return tx.templateInstanceRow.create({
        data: {
          templateInstanceId: params.instanceId,
          rowKey: params.rowKey,
          rowIndex: maxIndex + 1,
          sourceDocumentIds: [params.documentId],
          fieldValues: params.fieldValues,
          validationErrors: params.validation.errors,
          status: params.validation.isValid ? 'VALID' : 'INVALID',
        },
      });
    }
  }
}
```

### Transform 執行器設計

```typescript
// src/services/transform/transform-executor.ts

export class TransformExecutor {
  private transforms: Map<FieldTransformType, Transform> = new Map();

  constructor() {
    this.transforms.set('DIRECT', new DirectTransform());
    this.transforms.set('FORMULA', new FormulaTransform());
    this.transforms.set('LOOKUP', new LookupTransform());
  }

  async execute(
    value: unknown,
    type: FieldTransformType,
    params?: TransformParams,
    context?: Record<string, unknown>,
  ): Promise<unknown> {
    const transform = this.transforms.get(type);
    if (!transform) {
      throw new Error(`Unknown transform type: ${type}`);
    }
    return transform.execute(value, params, context);
  }
}

// Direct Transform
export class DirectTransform implements Transform {
  execute(value: unknown): unknown {
    return value;
  }
}

// Formula Transform
export class FormulaTransform implements Transform {
  execute(
    value: unknown,
    params: { formula: string },
    context: Record<string, unknown>,
  ): unknown {
    // 解析公式中的 {field} 佔位符
    let formula = params.formula;
    for (const [key, val] of Object.entries(context)) {
      formula = formula.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val || 0));
    }

    // 安全計算（使用 Function 或 mathjs）
    try {
      return this.safeEval(formula);
    } catch {
      return null;
    }
  }

  private safeEval(expr: string): number {
    // 只允許數字和基本運算符
    if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(expr)) {
      throw new Error('Invalid formula');
    }
    return Function(`"use strict"; return (${expr})`)();
  }
}

// Lookup Transform
export class LookupTransform implements Transform {
  execute(
    value: unknown,
    params: { lookupTable: Record<string, unknown>; defaultValue?: unknown },
  ): unknown {
    const key = String(value);
    return params.lookupTable[key] ?? params.defaultValue ?? value;
  }
}
```

### API 設計

```typescript
// POST /api/v1/template-matching/execute
{
  "documentIds": ["doc1", "doc2", "doc3"],
  "templateInstanceId": "inst1",
  "options": {
    "rowKeyField": "shipment_no",     // 用哪個欄位作為行主鍵
    "companyId": "company1",           // 用於解析映射規則
    "formatId": "format1",             // 用於解析映射規則
    "batchSize": 100,                  // 批量處理大小
    "skipValidation": false            // 是否跳過驗證
  }
}

// Response
{
  "success": true,
  "data": {
    "instanceId": "inst1",
    "totalDocuments": 3,
    "totalRows": 3,
    "validRows": 2,
    "invalidRows": 1,
    "results": [
      { "documentId": "doc1", "rowId": "row1", "rowKey": "S001", "status": "VALID" },
      { "documentId": "doc2", "rowId": "row2", "rowKey": "S002", "status": "VALID" },
      { "documentId": "doc3", "rowId": "row3", "rowKey": "S003", "status": "INVALID", "errors": { "total_amount": "必填欄位" } }
    ]
  }
}
```

---

## Implementation Notes

### 完成日期
2026-01-22

### 實作摘要

1. **Transform 轉換器模組** (`src/services/transform/`)
   - `types.ts` - Transform 介面和類型定義
   - `direct.transform.ts` - DIRECT 直接映射轉換器
   - `formula.transform.ts` - FORMULA 公式計算轉換器（支援 {field} 佔位符）
   - `lookup.transform.ts` - LOOKUP 查表映射轉換器
   - `concat.transform.ts` - CONCAT 字串合併轉換器
   - `split.transform.ts` - SPLIT 字串分割轉換器
   - `transform-executor.ts` - 轉換執行器（工廠模式）
   - `index.ts` - 模組導出入口

2. **核心引擎服務** (`src/services/template-matching-engine.service.ts`)
   - `matchDocuments()` - 主入口方法，執行文件到模版的匹配
   - `previewMatch()` - 預覽匹配結果（不實際創建數據）
   - `validateMapping()` - 驗證映射配置完整性
   - `processBatch()` - 批量處理（使用事務）
   - `transformFields()` - 欄位轉換
   - `upsertRow()` - 同 rowKey 合併邏輯
   - `loadDocuments()` - 從 Document + ExtractionResult 載入數據

3. **類型定義** (`src/types/template-matching-engine.ts`)
   - `MatchDocumentsParams`, `MatchResult` - 匹配參數和結果
   - `MatchProgress` - 進度回調
   - `RowResult` - 單行結果
   - `PreviewMatchParams`, `PreviewMatchResult` - 預覽類型
   - `ValidateMappingParams`, `ValidateMappingResult` - 驗證類型
   - `MatchingEngineError` - 自定義錯誤類

4. **驗證 Schema** (`src/validations/template-matching.ts`)
   - `executeMatchRequestSchema` - 執行匹配請求驗證
   - `previewMatchRequestSchema` - 預覽請求驗證
   - `validateMappingRequestSchema` - 驗證請求驗證

5. **API 端點** (`src/app/api/v1/template-matching/`)
   - `execute/route.ts` - POST 執行匹配
   - `preview/route.ts` - POST 預覽匹配
   - `validate/route.ts` - POST 驗證映射配置

### 數據來源說明

mappedFields 實際來源於 `Document.extractionResult.fieldMappings`，結構為：
```json
{
  "[fieldName]": {
    "value": "提取值",
    "rawValue": "原始值",
    "confidence": 0.95,
    ...
  }
}
```

服務會從 `fieldMappings` 中提取 `value`（或 `rawValue`）作為轉換源。

### 測試建議

- 各轉換器單元測試
- 合併策略測試（同 rowKey 多文件）
- 批量處理事務一致性測試
- API 端點整合測試

---

## Related Files

- `src/services/template-matching-engine.service.ts` - 新增
- `src/services/transform/` - 新增
- `src/app/api/v1/template-matching/` - 新增
