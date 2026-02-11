# CHANGE-037: Data Template 匹配流程完善

> **日期**: 2026-02-11
> **狀態**: ⏳ 待實作
> **優先級**: High
> **類型**: Feature Enhancement
> **影響範圍**: Data Template 匹配與導出端到端流程

---

## 變更背景

### 現有問題

Data Template 匹配系統（Epic 19）的所有組件已實現（6 服務 + 17 API + 9 前端頁面），但端到端流程存在 4 個缺口，導致自動匹配 → 導出無法順暢運作。

**完整數據流**：
```
上傳文件 → V3.1 pipeline 處理 → 處理完成
  → autoMatch 觸發（需要 companyId + defaultTemplate 配置）
  → resolveDefaultTemplate(companyId, formatId?)
  → getOrCreateInstance(templateId) → 建立 DRAFT 實例
  → matchDocuments() → 轉換欄位 → 寫入 TemplateInstanceRow
  → ❌ 缺口：實例停留在 DRAFT，無法自動轉為 COMPLETED
  → 手動改狀態 COMPLETED → 導出 Excel/CSV
```

### 缺口清單

| # | 嚴重度 | 缺口 | 位置 | 影響 |
|---|--------|------|------|------|
| 1 | 🔴 | DRAFT → COMPLETED 無自動轉換 | `auto-template-matching.service.ts` L362-393 | 每次自動匹配後都需手動改狀態才能導出 |
| 2 | 🟡 | 配置前置條件無引導 | `Company.defaultTemplateId` 需預先設定 | 用戶不知道需要配置什麼，autoMatch 靜默失敗 |
| 3 | 🟡 | FORMAT 級別自動匹配未啟用 | `auto-template-matching.service.ts` L348-352 | `resolveDefaultTemplate()` 傳入 `formatId = undefined`，FORMAT 層永遠不生效 |
| 4 | 🟢 | unmatch 不清理行數據 | `auto-template-matching.service.ts` L547-580 | 取消匹配時 `TemplateInstanceRow` 保留，產生 orphan 數據 |

### 目標

完善端到端流程，使得：
1. 自動匹配完成後，實例可根據配置自動轉為 COMPLETED，無需手動操作
2. 用戶清楚知道需要配置什麼才能使用自動匹配
3. FORMAT 級別的 defaultTemplate 能正確生效
4. 取消匹配時正確清理相關行數據

---

## 變更內容

### 1. 自動狀態轉換：DRAFT → COMPLETED（🔴 關鍵缺口）

#### 現有行為

`autoMatch()` 方法（`auto-template-matching.service.ts` L313-393）在匹配完成後：
1. 呼叫 `getOrCreateInstance()` → 建立/查找 DRAFT 實例（L362）
2. 呼叫 `templateMatchingEngineService.matchDocuments()` → 轉換欄位並寫入行（L365-371）
3. 更新 `Document.templateInstanceId`（L374-379）
4. **結束** — 實例保持 DRAFT 狀態

導出 API（`template-instances/[id]/export/route.ts` L103-117）明確檢查：
```typescript
if (!['COMPLETED', 'EXPORTED'].includes(instance.status)) {
  // 返回 409 Conflict
}
```

因此 DRAFT 狀態的實例**無法導出**。

#### 狀態機現狀

`STATUS_TRANSITIONS`（`src/types/template-instance.ts` L304-310）：
```
DRAFT → PROCESSING
PROCESSING → COMPLETED | ERROR
COMPLETED → EXPORTED
EXPORTED → (終態)
ERROR → PROCESSING (重試)
```

**問題**：DRAFT 無法直接轉為 COMPLETED，必須經過 PROCESSING。

#### 設計方案

**方案 A — 擴展狀態機**（推薦）：

1. 在 `STATUS_TRANSITIONS` 中新增 `DRAFT → COMPLETED` 的直接轉換路徑
2. 在 `autoMatch()` 結束時，根據匹配結果和配置決定是否自動完成
3. 新增 `autoCompleteOnMatch` 配置選項（Company 級別或 DataTemplate 級別）

**自動完成判斷邏輯**：
```
匹配完成後：
  1. 檢查是否啟用 autoCompleteOnMatch（預設: true）
  2. 執行 validateAllRows() 驗證所有行
  3. 如果 errorRowCount === 0（所有行通過驗證）：
     → 自動轉換 DRAFT → COMPLETED
  4. 如果有驗證錯誤：
     → 保持 DRAFT，等待人工修正後手動完成
```

**方案 B — 簡化為兩步**（備選）：

讓 `autoMatch()` 在匹配完成後直接走 `DRAFT → PROCESSING → COMPLETED` 兩步：
```typescript
await templateInstanceService.changeStatus(instance.id, 'PROCESSING');
// ... 匹配邏輯 ...
if (matchResult.errorRows === 0) {
  await templateInstanceService.changeStatus(instance.id, 'COMPLETED');
} else {
  await templateInstanceService.changeStatus(instance.id, 'ERROR');
}
```

**推薦方案 A**，因為更直觀，且允許用戶配置是否自動完成。

### 2. 配置引導與驗證（🟡 配置缺口）

#### 現有行為

自動匹配需要以下前置條件（按 `resolveDefaultTemplate()` 的三層優先級）：
1. **FORMAT 級別**：`DocumentFormat.defaultTemplateId`（目前未啟用，見缺口 3）
2. **COMPANY 級別**：`Company.defaultTemplateId`（L192-208）
3. **GLOBAL 級別**：`SystemConfig` 中的 `global_default_template_id`（L211-218）

若三層都未配置，`autoMatch()` 返回 `{ success: false, error: '沒有配置預設模版' }`，但此錯誤僅在 console.log 中記錄，**前端完全無感知**。

#### 設計方案

1. **Company 編輯頁面增加配置提示**：
   - 在 Company 詳情/編輯頁面中，若 `defaultTemplateId` 為空，顯示提示訊息：「尚未設定預設資料模板，自動匹配功能將無法使用」
   - 提供下拉選單讓用戶選擇預設模板

2. **新增配置檢查 API**：
   - `GET /api/v1/template-matching/check-config?companyId=xxx`
   - 返回該公司的配置完整度（是否有 defaultTemplate、是否有映射規則）

3. **文件詳情頁面增加匹配狀態提示**：
   - 若文件已處理完成但未匹配，顯示原因（如「公司未配置預設模板」）

### 3. FORMAT 級別自動匹配啟用（🟡 功能缺口）

#### 現有行為

`autoMatch()` 方法（L348-352）明確寫了：
```typescript
// 2. 解析預設模版（目前只支援 COMPANY 和 GLOBAL 級別）
// 注意：FORMAT 級別需要 Document 有 formatId 欄位，目前未實現
const resolved = await this.resolveDefaultTemplate(
  document.companyId,
  undefined // formatId 暫不支援
);
```

問題在於 `Document` model 沒有 `documentFormatId` 欄位。但 V3.1 pipeline 的 Stage 2（`stage-2-format.service.ts`）已能識別文件格式，結果存儲在 `ExtractionResult.stage2Result` JSON 中。

#### 設計方案

**方案 A — 從 ExtractionResult 解析 formatId**（推薦）：

不需要在 Document model 新增欄位，而是從 ExtractionResult 的 stage2Result 中提取 formatId：

```typescript
async autoMatch(documentId: string): Promise<AutoMatchResult> {
  // ... 現有邏輯 ...

  // 從 ExtractionResult 取得 formatId
  const extractionResult = await prisma.extractionResult.findUnique({
    where: { documentId },
    select: { stage2Result: true },
  });
  const stage2 = extractionResult?.stage2Result as Record<string, unknown> | null;
  const formatId = stage2?.matchedFormatId as string | undefined;

  // 傳入 formatId
  const resolved = await this.resolveDefaultTemplate(
    document.companyId,
    formatId
  );
  // ...
}
```

**方案 B — Document model 新增 formatId**（備選）：

在 `Document` model 新增 `documentFormatId` 欄位，在 Stage 2 完成時回寫。此方案需要 Prisma migration，且需要修改 processing-result-persistence 服務。

**推薦方案 A**，因為不需要 migration，且 formatId 資訊已存在於 ExtractionResult 中。

### 4. unmatch 清理機制（🟢 數據清理）

#### 現有行為

`unmatch()` 方法（L547-580）只清除 `Document.templateInstanceId` 和 `templateMatchedAt`，但**不刪除 `TemplateInstanceRow` 中的數據**。

L542-543 的註釋明確記載：
```typescript
/**
 * 取消匹配
 * @description
 *   移除文件與模版實例的關聯
 *   不會刪除 TemplateInstanceRow 中的數據
 */
```

問題：
- `TemplateInstanceRow.sourceDocumentIds` 仍包含已 unmatch 的 documentId
- 若該行只有一個 sourceDocumentId（即此文件），整行變成 orphan
- 統計數據（rowCount, validRowCount 等）不準確

#### 設計方案

在 `unmatch()` 和 `batchUnmatch()` 方法中，增加清理邏輯：

```
unmatch(documentId) 時：
  1. 查找所有 TemplateInstanceRow 中 sourceDocumentIds 包含此 documentId 的行
  2. 對每行：
     a. 從 sourceDocumentIds 中移除此 documentId
     b. 若移除後 sourceDocumentIds 為空 → 刪除整行
     c. 若仍有其他 documentId → 保留行，但可能需要重新驗證欄位值
  3. 更新實例統計數據（updateStatistics）
```

**PostgreSQL 陣列操作**：
```sql
-- 查找包含特定 documentId 的行
WHERE document_id = ANY(source_document_ids)

-- 從陣列中移除元素
UPDATE template_instance_rows
SET source_document_ids = array_remove(source_document_ids, $1)
WHERE template_instance_id = $2
```

---

## 技術設計

### 修改範圍

| # | 文件 | 變更類型 | 說明 |
|---|------|----------|------|
| 1 | `src/types/template-instance.ts` | 🔧 修改 | 擴展 `STATUS_TRANSITIONS`：DRAFT → COMPLETED |
| 2 | `src/services/auto-template-matching.service.ts` | 🔧 修改 | autoMatch 增加自動完成邏輯、FORMAT 級別支援、unmatch 清理 |
| 3 | `src/services/template-instance.service.ts` | 🔧 修改 | 新增 `autoComplete()` 方法 |
| 4 | `src/app/api/v1/template-matching/check-config/route.ts` | ✨ 新增 | 配置檢查 API |
| 5 | `src/components/features/company/CompanyEditForm.tsx` | 🔧 修改 | 新增 defaultTemplate 配置提示 |
| 6 | `messages/en/companies.json` | 🔧 修改 | 新增配置提示翻譯 |
| 7 | `messages/zh-TW/companies.json` | 🔧 修改 | 同上 |
| 8 | `messages/zh-CN/companies.json` | 🔧 修改 | 同上 |
| 9 | `messages/en/templateInstance.json` | 🔧 修改 | 新增自動完成相關翻譯 |
| 10 | `messages/zh-TW/templateInstance.json` | 🔧 修改 | 同上 |
| 11 | `messages/zh-CN/templateInstance.json` | 🔧 修改 | 同上 |

### 詳細設計

#### 1. 擴展狀態機（`src/types/template-instance.ts`）

```typescript
// 修改前
export const STATUS_TRANSITIONS: Record<TemplateInstanceStatus, TemplateInstanceStatus[]> = {
  DRAFT: ['PROCESSING'],
  PROCESSING: ['COMPLETED', 'ERROR'],
  COMPLETED: ['EXPORTED'],
  EXPORTED: [],
  ERROR: ['PROCESSING'],
};

// 修改後
export const STATUS_TRANSITIONS: Record<TemplateInstanceStatus, TemplateInstanceStatus[]> = {
  DRAFT: ['PROCESSING', 'COMPLETED'],  // 新增 DRAFT → COMPLETED 直接路徑
  PROCESSING: ['COMPLETED', 'ERROR'],
  COMPLETED: ['EXPORTED'],
  EXPORTED: [],
  ERROR: ['PROCESSING'],
};
```

#### 2. autoMatch 自動完成（`src/services/auto-template-matching.service.ts`）

在 `autoMatch()` 方法的步驟 5（L374-379）之後，新增步驟 6：

```typescript
// 6. 自動完成（如果配置啟用且所有行通過驗證）
const shouldAutoComplete = await this.shouldAutoComplete(resolved.templateId);
if (shouldAutoComplete && matchResult.errorRows === 0 && matchResult.validRows > 0) {
  try {
    await templateInstanceService.changeStatus(instance.id, 'COMPLETED');
  } catch {
    // 自動完成失敗不影響匹配結果
  }
}
```

#### 3. FORMAT 級別支援（`src/services/auto-template-matching.service.ts`）

修改 `autoMatch()` 方法中的 formatId 解析：

```typescript
// 修改前（L348-352）
const resolved = await this.resolveDefaultTemplate(
  document.companyId,
  undefined // formatId 暫不支援
);

// 修改後
const formatId = await this.resolveFormatId(documentId);
const resolved = await this.resolveDefaultTemplate(
  document.companyId,
  formatId
);
```

新增私有方法：
```typescript
private async resolveFormatId(documentId: string): Promise<string | undefined> {
  const extraction = await prisma.extractionResult.findUnique({
    where: { documentId },
    select: { stage2Result: true },
  });
  if (!extraction?.stage2Result) return undefined;
  const stage2 = extraction.stage2Result as Record<string, unknown>;
  return (stage2.matchedFormatId ?? stage2.formatId) as string | undefined;
}
```

#### 4. unmatch 清理邏輯（`src/services/auto-template-matching.service.ts`）

修改 `unmatch()` 方法：

```typescript
async unmatch(params: UnmatchParams): Promise<UnmatchResult> {
  const { documentId } = params;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { templateInstanceId: true },
  });

  if (!document) {
    return { success: false, error: '文件不存在' };
  }

  const previousInstanceId = document.templateInstanceId || undefined;

  // 清除匹配關聯
  await prisma.document.update({
    where: { id: documentId },
    data: { templateInstanceId: null, templateMatchedAt: null },
  });

  // 🆕 清理 TemplateInstanceRow 中的相關數據
  if (previousInstanceId) {
    await this.cleanupRowsForDocument(previousInstanceId, documentId);
  }

  return { success: true, previousInstanceId };
}

private async cleanupRowsForDocument(
  instanceId: string,
  documentId: string
): Promise<void> {
  // 查找包含此 documentId 的所有行
  const rows = await prisma.templateInstanceRow.findMany({
    where: {
      templateInstanceId: instanceId,
      sourceDocumentIds: { has: documentId },
    },
  });

  for (const row of rows) {
    const updatedIds = row.sourceDocumentIds.filter((id) => id !== documentId);

    if (updatedIds.length === 0) {
      // 該行只有這一個文件，刪除整行
      await prisma.templateInstanceRow.delete({ where: { id: row.id } });
    } else {
      // 仍有其他文件，僅移除此 documentId
      await prisma.templateInstanceRow.update({
        where: { id: row.id },
        data: { sourceDocumentIds: updatedIds },
      });
    }
  }

  // 更新實例統計
  await templateInstanceService.updateStatistics(instanceId);
}
```

#### 5. 配置檢查 API

新增 `src/app/api/v1/template-matching/check-config/route.ts`：

```typescript
// GET /api/v1/template-matching/check-config?companyId=xxx
// 返回：
{
  success: true,
  data: {
    companyId: "xxx",
    hasDefaultTemplate: true,
    defaultTemplateId: "yyy",
    defaultTemplateName: "Standard Invoice Template",
    source: "COMPANY",  // FORMAT | COMPANY | GLOBAL
    hasMappingRules: true,
    mappingRuleCount: 12,
    missingRequiredFields: [],
    isReady: true,  // 所有條件都滿足
  }
}
```

---

## i18n 影響

### 新增翻譯 Key

| 命名空間 | Key | en | zh-TW |
|----------|-----|-----|-------|
| `companies` | `form.defaultTemplate.hint` | `Set a default data template for auto-matching. Documents from this company will be automatically matched to this template.` | `設定預設資料模板以啟用自動匹配功能。此公司的文件將自動匹配到此模板。` |
| `companies` | `form.defaultTemplate.notConfigured` | `Default template not configured. Auto-matching will not work for this company.` | `尚未設定預設模板，此公司的自動匹配功能將無法使用。` |
| `templateInstance` | `status.autoCompleted` | `Auto-completed after matching` | `匹配完成後自動完成` |
| `templateInstance` | `status.draftWithErrors` | `Draft - has validation errors, manual review required` | `草稿 - 有驗證錯誤，需要手動審查` |
| `templateInstance` | `actions.completeManually` | `Complete Manually` | `手動完成` |

### 需要在 `src/i18n/request.ts` 確認

`companies` 和 `templateInstance` 命名空間應已存在。若 `templateInstance` 不存在，需要新增到 `namespaces` 陣列。

---

## 資料庫影響

**不需要 Prisma migration**。

本次變更不修改任何資料庫 model：
- `STATUS_TRANSITIONS` 是 TypeScript 常量，不影響 DB schema
- `TemplateInstance.status` 欄位已是 enum 類型，`COMPLETED` 值已存在
- unmatch 清理使用現有的 `sourceDocumentIds` 陣列欄位
- FORMAT 級別匹配從 `ExtractionResult.stage2Result` JSON 讀取，無需新欄位

---

## 設計決策

| # | 決策 | 選擇 | 理由 |
|---|------|------|------|
| 1 | DRAFT → COMPLETED 轉換路徑 | 擴展狀態機（方案 A） | 比走 DRAFT → PROCESSING → COMPLETED 更直觀，且允許配置控制 |
| 2 | autoComplete 觸發條件 | errorRows === 0 且 validRows > 0 | 有驗證錯誤的實例不應自動完成，需人工修正；空實例也不應完成 |
| 3 | autoComplete 預設值 | 預設啟用（`true`） | 減少用戶操作步驟，符合「自動化率 90-95%」的目標 |
| 4 | FORMAT 級別 formatId 來源 | 從 ExtractionResult.stage2Result 解析 | 不需要 migration，資料已存在，避免在 Document model 新增冗餘欄位 |
| 5 | unmatch 清理策略 | 移除 documentId，空行刪除 | 保持數據一致性，避免 orphan 行影響統計和導出 |
| 6 | 配置引導方式 | Company 編輯頁面提示 + API | 在用戶最可能配置的位置提供引導，API 支援程式化檢查 |
| 7 | batchUnmatch 清理 | 同步清理 | 批量取消匹配同樣需要清理，避免大量 orphan 數據 |

---

## 影響範圍評估

### 對現有功能的影響

| 功能 | 影響 | 說明 |
|------|------|------|
| 手動匹配（matchSingle） | ⚠️ 需要評估 | 手動匹配是否也應觸發自動完成？建議：手動匹配不自動完成，因為用戶可能要繼續添加更多文件 |
| 批量匹配（batchMatch） | ⚠️ 需要評估 | 批量匹配完成後是否自動完成？建議：提供選項讓用戶決定 |
| 導出 API | ✅ 不受影響 | 導出仍然只允許 COMPLETED/EXPORTED 狀態 |
| 手動狀態變更 | ✅ 不受影響 | 現有手動 changeStatus API 不變 |
| 實例刪除 | ✅ 不受影響 | 只有 DRAFT 可刪除的規則不變 |
| 模板匹配引擎 | ✅ 不受影響 | matchDocuments() 介面不變 |

### 向後兼容性

- **狀態機擴展**: `DRAFT → COMPLETED` 是新增路徑，不影響現有轉換
- **autoMatch 行為**: 舊行為（保持 DRAFT）在 `autoCompleteOnMatch = false` 時仍可用
- **unmatch 行為**: 新增清理邏輯是增強，不影響 Document 層面的解除匹配
- **API**: 新增 check-config API 不影響現有端點

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 自動完成 | 自動匹配後，若所有行驗證通過，實例自動轉為 COMPLETED | 🔴 High |
| 2 | 驗證失敗保留 DRAFT | 自動匹配後，若有驗證錯誤行，實例保持 DRAFT | 🔴 High |
| 3 | 導出可用 | 自動完成的實例可直接通過導出 API 下載 Excel/CSV | 🔴 High |
| 4 | FORMAT 級別匹配 | 若 DocumentFormat 配置了 defaultTemplateId，autoMatch 使用該模板 | 🟡 Medium |
| 5 | 三層優先級 | FORMAT > COMPANY > GLOBAL 優先級正確 | 🟡 Medium |
| 6 | unmatch 清理 | 取消匹配後，orphan TemplateInstanceRow 被正確清理 | 🟡 Medium |
| 7 | 統計更新 | unmatch 清理後，實例統計數據（rowCount 等）正確更新 | 🟡 Medium |
| 8 | 配置檢查 API | check-config API 正確返回配置完整度 | 🟡 Medium |
| 9 | 配置提示 UI | Company 編輯頁面顯示 defaultTemplate 配置提示 | 🟢 Low |
| 10 | i18n 完整 | 新增翻譯 key 在 en/zh-TW/zh-CN 三語言文件中同步更新 | 🟡 Medium |

---

## 測試場景

| # | 場景 | 測試步驟 | 預期結果 |
|---|------|----------|----------|
| 1 | 自動匹配 + 自動完成 | 1. Company 配置 defaultTemplate<br>2. 上傳文件並處理<br>3. 處理完成觸發 autoMatch | 實例狀態為 COMPLETED，可直接導出 |
| 2 | 自動匹配 + 驗證失敗 | 1. 配置一個有必填欄位的模板<br>2. 上傳缺少必填欄位的文件<br>3. autoMatch 觸發 | 實例保持 DRAFT，errorRowCount > 0 |
| 3 | FORMAT 級別優先 | 1. Company 設定 defaultTemplate A<br>2. DocumentFormat 設定 defaultTemplate B<br>3. 文件匹配到該 Format<br>4. autoMatch 觸發 | 使用 Template B（FORMAT 優先於 COMPANY） |
| 4 | 無配置靜默處理 | 1. Company 未設定 defaultTemplate<br>2. 全局也未設定<br>3. autoMatch 觸發 | autoMatch 返回 success: false，不影響 pipeline |
| 5 | unmatch 清理 — 單文件行 | 1. 文件 A 匹配並建立行 R1（sourceDocumentIds: [A]）<br>2. unmatch 文件 A | 行 R1 被刪除，實例 rowCount 減少 |
| 6 | unmatch 清理 — 多文件行 | 1. 文件 A、B 匹配到同一行 R1（sourceDocumentIds: [A, B]）<br>2. unmatch 文件 A | R1 保留，sourceDocumentIds 變為 [B] |
| 7 | 批量 unmatch 清理 | 1. 多個文件匹配到多行<br>2. batchUnmatch 所有文件 | 所有相關行被正確清理，統計更新 |
| 8 | 配置檢查 — 已配置 | GET /api/v1/template-matching/check-config?companyId=xxx<br>（Company 已配置 defaultTemplate） | 返回 isReady: true |
| 9 | 配置檢查 — 未配置 | GET /api/v1/template-matching/check-config?companyId=xxx<br>（Company 未配置） | 返回 isReady: false，列出缺失項 |
| 10 | 手動匹配不自動完成 | 1. 用戶手動 matchSingle<br>2. 匹配完成 | 實例保持 DRAFT（手動匹配不觸發自動完成） |
| 11 | 空匹配不自動完成 | 1. autoMatch 觸發<br>2. 文件沒有 mappedFields | 實例保持 DRAFT，validRows === 0 |

---

## 實作順序建議

| 階段 | 內容 | 預估工時 |
|------|------|----------|
| Phase 1 | 🔴 狀態機擴展 + autoComplete 核心邏輯 | 2-3 小時 |
| Phase 2 | 🟡 FORMAT 級別支援（resolveFormatId） | 1 小時 |
| Phase 3 | 🟡 unmatch 清理邏輯 | 1-2 小時 |
| Phase 4 | 🟡 配置檢查 API + Company 頁面提示 | 2 小時 |
| Phase 5 | 🟡 i18n 翻譯同步 | 0.5 小時 |
| Phase 6 | 🟢 測試驗證 | 1-2 小時 |

**預估總工時**: 8-10 小時
