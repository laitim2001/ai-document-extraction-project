# FIX-043: FieldDefinitionSet 欄位定義未注入 Stage 3 Prompt

> **建立日期**: 2026-02-24
> **發現方式**: 用戶手動測試 CHANGE-042 功能
> **影響頁面/功能**: Stage 3 提取管線（`stage-3-extraction.service.ts`）
> **優先級**: 高
> **狀態**: ✅ 已修復
> **相關變更**: CHANGE-042（Phase 1+2+3 已完成，但核心欄位注入未生效）

---

## 問題描述

CHANGE-042 Phase 1+2 建立了 `FieldDefinitionSet` DB model 和 Stage 3 動態提取邏輯，Phase 3 建立了管理 UI。但實際測試發現 **FieldDefinitionSet 的欄位定義在 Stage 3 提取時完全沒有生效**——建立 GLOBAL scope 的 FieldDefinitionSet（含 16 個欄位）後重新處理文件，Stage 3 的 prompt 和 response 與未設定 FieldDefinitionSet 時完全相同。

| # | Bug | 嚴重度 | 影響 |
|---|-----|--------|------|
| BUG-1 | `buildExtractionPrompt()` 當 PromptConfig 提供自定義 `systemPrompt` 時，`fieldsSection` 被完全跳過 | 高 | FieldDefinitionSet 欄位永遠不會出現在 prompt 中 |
| BUG-2 | `loadPromptConfigHierarchical()` 查詢缺少 `promptType` 過濾 | 中 | Stage 3 可能載入 TERM_CLASSIFICATION 或 STAGE_1 等錯誤類型的 PromptConfig |

---

## 重現步驟

1. 在 `/admin/field-definition-sets` 建立 GLOBAL scope 的 FieldDefinitionSet（含 16 個欄位）
2. 上傳一份 DHL 發票文件進行處理
3. 等待 Stage 1 → Stage 2 → Stage 3 完成
4. 在文件詳情頁的 Processing tab 查看 Stage 3 的 processing step log
5. 觀察 `systemPrompt` 欄位 → **沒有任何 FieldDefinitionSet 相關的欄位定義出現**
6. 觀察提取結果 → **與沒有設定 FieldDefinitionSet 時完全相同**

---

## 根本原因

### BUG-1: PromptConfig 自定義 systemPrompt 覆蓋了 fieldsSection

**檔案**: `src/services/extraction-v3/stages/stage-3-extraction.service.ts`
**位置**: `buildExtractionPrompt()` method（line 700）

```typescript
// line 700-709
let systemPrompt =
  config.systemPrompt ||    // ← 如果 PromptConfig 提供了 systemPrompt，直接使用
  `You are an expert invoice data extraction specialist.
Extract all requested fields accurately from the provided invoice image.

${fieldsSection}           // ← fieldsSection 只在預設模板中使用

${mappingsSection}

Respond in valid JSON format matching the provided schema.`;
```

**問題分析**:
- 當 `config.systemPrompt` 有值（來自 PromptConfig DB 記錄）時，整個預設模板被跳過
- `fieldsSection`（line 695-698，來自 FieldDefinitionSet 的 `standardFields`/`customFields`）永遠不會被注入
- 即使 FieldDefinitionSet 解析了 16 個欄位，`buildFieldsSection()` 的結果也被丟棄
- 這是因為 PromptConfig 的 `systemPrompt` 是一個**完整替換**，不是**合併**

### BUG-2: loadPromptConfigHierarchical() 缺少 promptType 過濾

**檔案**: 同上
**位置**: `loadPromptConfigHierarchical()` method（lines 327、348、367）

```typescript
// line 327 — FORMAT 級查詢
const formatConfig = await this.prisma.promptConfig.findFirst({
  where: {
    scope: 'FORMAT',
    documentFormatId: formatId,
    companyId,
    isActive: true,
    // ← 缺少 promptType 過濾！可能載入 TERM_CLASSIFICATION 類型的 PromptConfig
  },
});

// line 348 — COMPANY 級查詢（同樣缺少 promptType）
// line 367 — GLOBAL 級查詢（同樣缺少 promptType）
```

**問題分析**:
- `PromptConfig` model 的 `promptType` 是 `PromptType` enum，包含 7 個值：
  - `ISSUER_IDENTIFICATION`, `TERM_CLASSIFICATION`, `FIELD_EXTRACTION`, `VALIDATION`
  - `STAGE_1_COMPANY_IDENTIFICATION`, `STAGE_2_FORMAT_IDENTIFICATION`, `STAGE_3_FIELD_EXTRACTION`
- 不過濾 `promptType` 的查詢可能返回 Stage 1 或 Term Classification 的 PromptConfig
- 由於使用 `findFirst()`，返回哪一個取決於資料庫排序（不確定性行為）

---

## 解決方案

### BUG-1 修復：始終注入 FieldDefinitionSet 欄位定義

**方案**: 修改 `buildExtractionPrompt()`，在變數替換完成後，自動檢測並追加 FieldDefinitionSet 的欄位定義段落。

**邏輯**:
1. 保存原始 `config.systemPrompt`（變數替換前）
2. 使用 `extractVariableNames()` 檢查原始 prompt 是否已包含欄位相關變數（`${standardFields}`、`${fieldSchema}` 等）
3. 如果**已包含** → 變數替換已處理，不需要額外注入
4. 如果**未包含** → 在 systemPrompt 末尾自動追加 "Field Extraction Requirements" 段落

**新增 2 個 private methods**:

#### `shouldInjectFieldDefinitions(rawSystemPrompt: string): boolean`

```typescript
/**
 * CHANGE-042: 判斷是否需要自動注入 FieldDefinitionSet 欄位定義
 * 檢查原始 systemPrompt 是否已包含欄位相關變數
 */
private shouldInjectFieldDefinitions(rawSystemPrompt: string): boolean {
  const fieldRelatedVars = ['standardFields', 'customFields', 'fieldSchema', 'fieldsSection'];
  const existingVars = extractVariableNames(rawSystemPrompt);
  return !fieldRelatedVars.some(v => existingVars.includes(v));
}
```

#### `buildFieldDefinitionsSection(fieldDefinitions: FieldDefinitionEntry[]): string`

```typescript
/**
 * CHANGE-042: 構建 FieldDefinitionSet 欄位定義注入段落
 */
private buildFieldDefinitionsSection(
  fieldDefinitions: FieldDefinitionEntry[]
): string {
  if (!fieldDefinitions || fieldDefinitions.length === 0) return '';

  const requiredFields = fieldDefinitions.filter(f => f.required);
  const optionalFields = fieldDefinitions.filter(f => !f.required);

  const lines: string[] = [
    '\n--- Field Extraction Requirements ---',
    `Total fields to extract: ${fieldDefinitions.length}`,
  ];

  if (requiredFields.length > 0) {
    lines.push('\nRequired Fields (MUST extract):');
    requiredFields.forEach(f => {
      const hints = f.extractionHints ? ` (Hints: ${f.extractionHints})` : '';
      const aliases = f.aliases?.length ? ` [Also known as: ${f.aliases.join(', ')}]` : '';
      lines.push(`  - ${f.label} (${f.key}, type: ${f.dataType})${aliases}${hints}`);
    });
  }

  if (optionalFields.length > 0) {
    lines.push('\nOptional Fields (extract if available):');
    optionalFields.forEach(f => {
      const hints = f.extractionHints ? ` (Hints: ${f.extractionHints})` : '';
      const aliases = f.aliases?.length ? ` [Also known as: ${f.aliases.join(', ')}]` : '';
      lines.push(`  - ${f.label} (${f.key}, type: ${f.dataType})${aliases}${hints}`);
    });
  }

  return lines.join('\n');
}
```

#### `buildExtractionPrompt()` 修改

在變數替換（line 716-722）之後、return 之前插入：

```typescript
// CHANGE-042: 自動注入 FieldDefinitionSet 欄位定義
if (
  config.systemPrompt &&
  config.fieldDefinitions &&
  config.fieldDefinitions.length > 0
) {
  if (this.shouldInjectFieldDefinitions(config.systemPrompt)) {
    const fieldDefsSection = this.buildFieldDefinitionsSection(config.fieldDefinitions);
    if (fieldDefsSection) {
      systemPrompt = systemPrompt + '\n' + fieldDefsSection;
      console.log(
        `[Stage3] Injected ${config.fieldDefinitions.length} field definitions from FieldDefinitionSet`
      );
    }
  }
}
```

**注意**: 使用 `config.systemPrompt`（替換前的原始值）做變數檢查，但注入到 `systemPrompt`（替換後的最終值）末尾。需在方法開頭保存原始引用：`const rawSystemPrompt = config.systemPrompt || '';`

### BUG-2 修復：加入 promptType 過濾

修改 `loadPromptConfigHierarchical()` 的 3 個 Prisma 查詢，加入 `promptType` 條件：

```typescript
// FORMAT 級查詢 (line 327)
where: {
  scope: 'FORMAT',
  documentFormatId: formatId,
  companyId,
  isActive: true,
  promptType: { in: ['STAGE_3_FIELD_EXTRACTION', 'FIELD_EXTRACTION'] },
},

// COMPANY 級查詢 (line 348)
where: {
  scope: 'COMPANY',
  companyId,
  isActive: true,
  promptType: { in: ['STAGE_3_FIELD_EXTRACTION', 'FIELD_EXTRACTION'] },
},

// GLOBAL 級查詢 (line 367)
where: {
  scope: 'GLOBAL',
  isActive: true,
  promptType: { in: ['STAGE_3_FIELD_EXTRACTION', 'FIELD_EXTRACTION'] },
},
```

**向下兼容**: 使用 `{ in: [...] }` 支援舊的 `FIELD_EXTRACTION` 和新的 `STAGE_3_FIELD_EXTRACTION` 兩種類型。

### 新增 import

```typescript
import { extractVariableNames } from '../utils/variable-replacer';
```

---

## 影響的檔案

| 檔案 | 操作 | 說明 |
|------|------|------|
| `src/services/extraction-v3/stages/stage-3-extraction.service.ts` | 修改 | 唯一需修改的檔案 |
| `src/services/extraction-v3/utils/variable-replacer.ts` | 引用 | 使用已存在的 `extractVariableNames()` (line 293) |

---

## 驗證步驟

1. `npm run type-check` — TypeScript 編譯通過
2. 重新處理 DHL 文件（ID: `6d474722-b7be-4d50-96ec-53e3d0f41ae1`）
3. 檢查 Stage 3 的 processing step log，確認：
   - systemPrompt 中包含 "Field Extraction Requirements" 段落
   - console log 顯示 `[Stage3] Injected X field definitions from FieldDefinitionSet`
4. 確認提取結果的 `fields` 對象包含 FieldDefinitionSet 中定義的欄位 key
5. 確認 `loadPromptConfigHierarchical()` 只載入 `FIELD_EXTRACTION` / `STAGE_3_FIELD_EXTRACTION` 類型的 PromptConfig

---

## 技術備註

### 現有相關資料

- DB 中已有 GLOBAL scope FieldDefinitionSet（16 欄位），在 Phase 3 UI 建立
- DHL 文件 `6d474722-...` 可用於重新處理驗證
- Stage 1 正確識別 DHL Express（companyId: `42e4680e-...`）
- `ExtractionConfig` 介面已在 Phase 2 加入 `fieldDefinitions` 和 `fieldDefinitionSetId`（line 119-121），無需再改

### 設計決策

- **選擇追加注入**而非修改 PromptConfig 模板：追加方式不影響現有 PromptConfig 的 systemPrompt 內容，向下兼容
- **檢查原始 prompt 的變數**：如果 systemPrompt 已使用 `${standardFields}` 等變數，則說明用戶已在模板中主動嵌入欄位，無需重複注入
- **promptType 過濾使用 `in` 而非 `equals`**：兼容兩種 PromptType enum 值

---

*建立日期: 2026-02-24*
*預計修復: 下次開發 Session*
