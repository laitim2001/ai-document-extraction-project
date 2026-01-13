# Tech Spec: Story 16.5 - 識別規則 Prompt 整合

> **Version**: 1.0.0
> **Created**: 2026-01-13
> **Status**: Draft
> **Story Key**: STORY-16-5

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 16.5 |
| **Epic** | Epic 16 - 文件格式管理 |
| **Estimated Effort** | 5 Story Points |
| **Dependencies** | Story 16-3（識別規則配置）, Epic 15（統一處理流程） |
| **Blocking** | 無 |

---

## Objective

將 `DocumentFormat.identificationRules` 欄位（目前只是 UI 配置，存入 DB 後未被使用）整合到 GPT Vision Prompt 中，讓 AI 能夠根據配置的規則更準確地識別文件格式。

### 問題背景

目前 Story 16-3 已實現識別規則的 UI 配置，但這些規則只存儲在 DB，未被 AI 處理流程讀取和使用。本 Story 將補完這個整合。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-16.5.1 | 讀取識別規則 | ConfigFetchingStep 讀取 identificationRules |
| AC-16.5.2 | Prompt 注入 | 將規則注入 GPT Vision 分類 Prompt |
| AC-16.5.3 | 支援 Logo 特徵 | Prompt 包含 Logo 位置和描述 |
| AC-16.5.4 | 支援關鍵字 | Prompt 包含關鍵字列表 |
| AC-16.5.5 | 支援版面特徵 | Prompt 包含 layoutHints |
| AC-16.5.6 | 優先級影響 | 高優先級格式優先匹配 |

---

## Implementation Guide

### Phase 1: 類型定義 (0.5 points)

#### 1.1 新增 FormatIdentificationRule 類型

```typescript
// src/types/unified-processor.ts (擴展)

import { DocumentType, DocumentSubtype, IdentificationRules } from './document-format';

/**
 * 格式識別規則（用於 Prompt 注入）
 * @since Epic 16 - Story 16.5
 */
export interface FormatIdentificationRule {
  /** 格式 ID */
  formatId: string;
  /** 格式名稱 */
  formatName: string;
  /** 文件類型 */
  documentType: DocumentType;
  /** 文件子類型 */
  documentSubtype: DocumentSubtype;
  /** 識別規則 */
  rules: IdentificationRules;
}

// 在 UnifiedProcessingContext 中新增
export interface UnifiedProcessingContext {
  // ... 現有欄位

  /** 格式識別規則列表（Story 16.5） */
  formatIdentificationRules?: FormatIdentificationRule[];
}
```

### Phase 2: Prompt 生成器 (1.5 points)

#### 2.1 新增 identification-rules-prompt-builder.ts

```typescript
// src/services/prompt/identification-rules-prompt-builder.ts

/**
 * @fileoverview 識別規則 Prompt 生成器
 * @description
 *   將 DocumentFormat.identificationRules 轉換為 GPT Vision 可理解的 Prompt 文本。
 *   按優先級排序，讓 AI 根據規則更準確地識別文件格式。
 *
 * @module src/services/prompt
 * @since Epic 16 - Story 16.5
 * @lastModified 2026-01-13
 */

import type { FormatIdentificationRule } from '@/types/unified-processor';
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_SUBTYPE_LABELS,
} from '@/types/document-format';

/**
 * 構建識別規則 Prompt 片段
 * @param rules 格式識別規則列表
 * @returns Prompt 文本
 */
export function buildIdentificationRulesPrompt(
  rules: FormatIdentificationRule[]
): string {
  if (!rules || rules.length === 0) {
    return '';
  }

  // 按優先級降序排序
  const sortedRules = [...rules].sort((a, b) =>
    (b.rules.priority || 50) - (a.rules.priority || 50)
  );

  // 過濾掉沒有任何規則的格式
  const validRules = sortedRules.filter((r) =>
    r.rules.logoPatterns?.length > 0 ||
    r.rules.keywords?.length > 0 ||
    r.rules.layoutHints
  );

  if (validRules.length === 0) {
    return '';
  }

  const rulesText = validRules
    .map((r, i) => formatSingleRule(r, i + 1))
    .join('\n');

  return `
## 已知文件格式識別規則

以下是此公司已知的文件格式，請根據這些規則幫助識別。如果文件符合某個格式的特徵，請優先使用該格式。

${rulesText}

請根據文件內容與上述規則，判斷最匹配的格式。如果沒有符合的格式，請根據文件本身特徵進行識別。
`;
}

/**
 * 格式化單個規則
 */
function formatSingleRule(
  rule: FormatIdentificationRule,
  index: number
): string {
  const { formatName, documentType, documentSubtype, rules } = rule;

  const typeLabel = DOCUMENT_TYPE_LABELS[documentType] || documentType;
  const subtypeLabel = DOCUMENT_SUBTYPE_LABELS[documentSubtype] || documentSubtype;

  const parts: string[] = [
    `### ${index}. ${formatName || '未命名格式'} (${typeLabel} - ${subtypeLabel})`,
    `- **識別優先級**: ${rules.priority || 50}/100`,
  ];

  // Logo 特徵
  if (rules.logoPatterns && rules.logoPatterns.length > 0) {
    const logoDesc = rules.logoPatterns
      .map((p) => `${getPositionLabel(p.position)}: ${p.description}`)
      .join('; ');
    parts.push(`- **Logo 特徵**: ${logoDesc}`);
  }

  // 關鍵字
  if (rules.keywords && rules.keywords.length > 0) {
    parts.push(`- **文件關鍵字**: ${rules.keywords.join(', ')}`);
  }

  // 版面特徵
  if (rules.layoutHints) {
    parts.push(`- **版面特徵**: ${rules.layoutHints}`);
  }

  return parts.join('\n');
}

/**
 * 取得位置標籤
 */
function getPositionLabel(position: string): string {
  const labels: Record<string, string> = {
    'top-left': '左上角',
    'top-right': '右上角',
    'top-center': '頂部中央',
    'bottom-left': '左下角',
    'bottom-right': '右下角',
    'center': '中央',
  };
  return labels[position] || position;
}

/**
 * 計算是否有有效的識別規則
 * @param rules 規則列表
 */
export function hasValidIdentificationRules(
  rules: FormatIdentificationRule[] | undefined
): boolean {
  if (!rules || rules.length === 0) {
    return false;
  }

  return rules.some((r) =>
    r.rules.logoPatterns?.length > 0 ||
    r.rules.keywords?.length > 0 ||
    r.rules.layoutHints
  );
}
```

### Phase 3: 擴展 ConfigFetchingStep (1.5 points)

#### 3.1 修改 config-fetching.step.ts

```typescript
// src/services/unified-processor/steps/config-fetching.step.ts

// 新增導入
import type { FormatIdentificationRule } from '@/types/unified-processor';
import type { IdentificationRules } from '@/types/document-format';

// 在 doExecute 方法中新增讀取識別規則的邏輯

protected async doExecute(
  context: UnifiedProcessingContext,
  _flags: UnifiedProcessorFlags
): Promise<StepResult> {
  const startTime = Date.now();

  try {
    // ... 現有的配置獲取邏輯

    // === 新增: 讀取識別規則 (Story 16.5) ===
    if (context.companyId) {
      const formatRules = await this.fetchFormatIdentificationRules(
        context.companyId
      );
      context.formatIdentificationRules = formatRules;
      console.log(
        `[Step 6] Loaded ${formatRules.length} format identification rules for company ${context.companyId}`
      );
    }

    return this.createSuccessResult(
      {
        // ... 現有結果
        formatRulesCount: context.formatIdentificationRules?.length || 0,
      },
      startTime
    );
  } catch (error) {
    // ... 錯誤處理
  }
}

/**
 * 讀取公司下所有格式的識別規則
 * @param companyId 公司 ID
 */
private async fetchFormatIdentificationRules(
  companyId: string
): Promise<FormatIdentificationRule[]> {
  const formats = await prisma.documentFormat.findMany({
    where: {
      companyId,
      identificationRules: { not: null },
    },
    select: {
      id: true,
      name: true,
      documentType: true,
      documentSubtype: true,
      identificationRules: true,
    },
  });

  return formats
    .filter((f) => f.identificationRules)
    .map((f) => ({
      formatId: f.id,
      formatName: f.name || `${f.documentType} - ${f.documentSubtype}`,
      documentType: f.documentType as DocumentType,
      documentSubtype: f.documentSubtype as DocumentSubtype,
      rules: f.identificationRules as IdentificationRules,
    }));
}
```

### Phase 4: 整合到 GPT Vision (1.5 points)

#### 4.1 修改 gpt-enhanced-extraction.step.ts

```typescript
// src/services/unified-processor/steps/gpt-enhanced-extraction.step.ts

// 新增導入
import {
  buildIdentificationRulesPrompt,
  hasValidIdentificationRules,
} from '@/services/prompt/identification-rules-prompt-builder';

// 修改 performClassification 方法
private async performClassification(
  context: UnifiedProcessingContext
): Promise<ClassificationResult> {
  // ... 現有邏輯

  // === 新增: 構建識別規則 Prompt ===
  let identificationPrompt = '';
  if (hasValidIdentificationRules(context.formatIdentificationRules)) {
    identificationPrompt = buildIdentificationRulesPrompt(
      context.formatIdentificationRules!
    );
    console.log(
      `[Step 7] Injecting identification rules for ${context.formatIdentificationRules!.length} formats`
    );
  }

  // 構建處理選項
  const options: ProcessingOptions = {
    companyId,
    documentFormatId,
    documentId: input.fileId,
    forceStaticPrompt: !resolvedPrompt?.userPromptTemplate,
    // 新增: 傳遞識別規則 Prompt
    identificationRulesPrompt: identificationPrompt,
  };

  // ... 調用 GPT Vision
}
```

#### 4.2 修改 gpt-vision.service.ts

```typescript
// src/services/gpt-vision.service.ts

// 擴展 ProcessingOptions
export interface ProcessingOptions {
  // ... 現有參數
  /** 識別規則 Prompt（Story 16.5） */
  identificationRulesPrompt?: string;
}

// 在 buildClassificationPrompt 或 buildExtractionPrompt 中注入
function buildClassificationPrompt(
  options: ProcessingOptions
): string {
  const basePrompt = `
You are a document classification expert...
`;

  // 注入識別規則
  const rulesPrompt = options.identificationRulesPrompt || '';

  return `
${basePrompt}

${rulesPrompt}

Please analyze the document and identify:
1. Document Issuer (the company that issued this document)
2. Document Format (type and subtype)
...
`;
}
```

---

## File Structure

```
src/
├── types/
│   └── unified-processor.ts          # 類型定義（更新）
├── services/
│   ├── prompt/
│   │   └── identification-rules-prompt-builder.ts  # 新增
│   ├── unified-processor/steps/
│   │   ├── config-fetching.step.ts   # 更新：讀取識別規則
│   │   └── gpt-enhanced-extraction.step.ts  # 更新：傳遞規則
│   └── gpt-vision.service.ts         # 更新：注入 Prompt
```

---

## Testing Checklist

### 單元測試
- [ ] `buildIdentificationRulesPrompt` 正確生成 Prompt
- [ ] 空規則返回空字串
- [ ] 按優先級正確排序
- [ ] Logo、關鍵字、版面特徵正確格式化

### 整合測試
- [ ] ConfigFetchingStep 正確讀取識別規則
- [ ] 規則傳遞到 GptEnhancedExtractionStep
- [ ] GPT Vision 收到包含規則的 Prompt

### E2E 測試
- [ ] 在格式詳情頁配置識別規則
- [ ] 上傳匹配該規則的文件
- [ ] 檢查 GPT 識別結果是否正確使用規則

---

## Rollback Plan

如果識別規則整合導致問題：
1. 在 `hasValidIdentificationRules` 函數中直接返回 `false`
2. 這會跳過所有規則注入，恢復原有行為
3. 不需要回滾資料庫或其他配置

---

## Future Enhancements

1. **規則效果追蹤**: 記錄規則命中率和準確度
2. **自動學習**: 根據人工修正自動調整規則優先級
3. **規則測試工具**: 提供 UI 讓用戶測試規則效果
