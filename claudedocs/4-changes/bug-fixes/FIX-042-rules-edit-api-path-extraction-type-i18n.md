# FIX-042: Rules Edit 頁面 API 路徑錯誤 + Extraction Type UI 缺失 + i18n/Forwarder 術語遷移

> **建立日期**: 2026-02-22
> **發現方式**: 代碼審查 + 用戶回報
> **影響頁面/功能**: `/rules/[id]/edit`（映射規則編輯頁面）
> **優先級**: 高
> **狀態**: ✅ 已修復

---

## 問題描述

`/rules/[id]/edit` 頁面（page.tsx + RuleEditForm.tsx）建於 Epic 5（2025-12-19），早於 Epic 17 i18n 實施和 REFACTOR-001 Forwarder→Company 重構，存在多個致命和中度問題：

| # | 問題 | 嚴重度 | 影響 |
|---|------|--------|------|
| BUG-1 | Edit 頁面呼叫不存在的 API `/api/v1/rules/[id]`，導致 404 | 高 | 頁面完全無法載入規則數據 |
| BUG-2 | `useRuleEdit` Hook 使用 `/api/companies/${forwarderId}/rules/` 路徑，Tier 1 通用規則 forwarderId=null 時 URL 錯誤 | 高 | 通用規則無法提交編輯 |
| BUG-3 | RuleData interface 缺少 `extractionType` 從 API 映射的邏輯，`/api/rules/[id]` 返回 `extractionPattern.method` 而非獨立的 `extractionType` 字段 | 中 | Extraction Type Tabs 無法正確初始化 |
| BUG-4 | Edit 頁面使用 `next/link` 而非 `@/i18n/routing` 的 Link | 低 | 導航時丟失 locale 前綴 |
| BUG-5 | Forwarder 術語殘留（RuleData.forwarderId、handleSubmit、useRuleEdit Hook） | 中 | 與 REFACTOR-001 不一致 |

---

## 重現步驟

### BUG-1: API 404

1. 前往 `http://localhost:3005/en/rules`
2. 點擊任一規則進入詳情頁
3. 點擊「Edit」按鈕進入 `/rules/[id]/edit`
4. 觀察現象：頁面顯示載入中後出現錯誤提示（Failed to fetch rule）
5. 檢查 Network tab：`GET /api/v1/rules/xxx` 返回 404

### BUG-2: 通用規則編輯失敗

1. 即使修復了 BUG-1，編輯一條通用規則（companyId=null）
2. 點擊提交
3. 觀察現象：`PUT /api/companies/null/rules/xxx` → 404

---

## 根本原因

### BUG-1: API 路徑不存在

`rules/[id]/edit/page.tsx:59` 呼叫：
```typescript
const response = await fetch(`/api/v1/rules/${ruleId}`)
```

但系統中只有 `/api/rules/[id]`（無 `v1` 前綴）。`/api/v1/rules/` 路由從未建立。

### BUG-2: useRuleEdit Hook 使用 forwarderId 構建路徑

`useRuleEdit.ts:155` 中更新規則的 API 路徑為：
```typescript
const response = await fetch(`/api/companies/${forwarderId}/rules/${ruleId}`, { method: 'PUT' })
```

對於 Tier 1 通用規則，`forwarderId`（實際應為 `companyId`）值為 `null`，導致實際 URL 變成 `/api/companies/null/rules/xxx`。

### BUG-3: extractionType 映射缺失

`/api/rules/[id]` API 返回的 `RuleDetail` 結構中：
- `extractionPattern` 是一個 JSON blob（含 `method: 'regex' | 'keyword' | 'azure_field' | ...`）
- 沒有獨立的 `extractionType` 字段

但 Edit 頁面的 `RuleData` interface 期望：
```typescript
interface RuleData {
  extractionType: string  // 期望 'REGEX' | 'KEYWORD' 等
  extractionPattern: Record<string, unknown>
}
```

需要在頁面層或 API 層添加 `extractionType` 的映射邏輯（從 `extractionPattern.method` 推導）。

### BUG-4: next/link 而非 i18n Link

`rules/[id]/edit/page.tsx:26` 使用：
```typescript
import Link from 'next/link'
```
應使用 `@/i18n/routing` 的 Link 以保留 locale 前綴。

### BUG-5: Forwarder 術語殘留

`RuleEditForm.tsx` 和 `useRuleEdit.ts` 中大量使用 `forwarderId`：
- `RuleData.forwarderId` (edit/page.tsx:51, RuleEditForm.tsx:132)
- `UpdateRuleRequest.forwarderId` (useRuleEdit.ts:50)
- `handleSubmit` 傳遞 `forwarderId` (RuleEditForm.tsx:468)
- API 路徑使用 `forwarderId` (useRuleEdit.ts:155, 196)

---

## 解決方案

### BUG-1 修復：修正 API 路徑 + 數據映射

**方案（推薦）**：在 edit page 中修正 fetch URL 並添加 `extractionType` 映射

```typescript
// rules/[id]/edit/page.tsx
async function fetchRule(ruleId: string): Promise<RuleData> {
  const response = await fetch(`/api/rules/${ruleId}`)  // 移除 /v1/
  if (!response.ok) throw new Error('Failed to fetch rule')
  const data = await response.json()
  const rule = data.data

  // 從 extractionPattern.method 推導 extractionType
  const methodToType: Record<string, string> = {
    regex: 'REGEX',
    keyword: 'KEYWORD',
    position: 'POSITION',
    azure_field: 'REGEX',  // azure_field 在 UI 中映射為 REGEX
    ai_prompt: 'AI_PROMPT',
  }
  const pattern = rule.extractionPattern as Record<string, unknown>
  const extractionType = methodToType[(pattern?.method as string) ?? ''] ?? 'REGEX'

  return {
    id: rule.id,
    fieldName: rule.fieldName,
    fieldLabel: rule.fieldLabel,
    extractionType,
    extractionPattern: pattern,
    priority: rule.priority,
    confidence: rule.confidence,
    description: rule.description,
    companyId: rule.company?.id ?? null,
  }
}
```

### BUG-2 修復：useRuleEdit Hook 路徑修正

改用 `/api/rules/[id]` 端點（需新增 PATCH 方法）或保留 companies 路徑但處理 null companyId：

```typescript
// useRuleEdit.ts - 更新 API 路徑
async function updateRule(request: UpdateRuleRequest): Promise<...> {
  const { companyId, ruleId, updates, reason } = request

  // 使用 /api/rules/[id] 端點（無需 companyId 路徑參數）
  const response = await fetch(`/api/rules/${ruleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...updates, reason }),
  })
  // ...
}
```

> **注意**：需檢查 `/api/rules/[id]/route.ts` 是否已有 PATCH handler，如無則需新增。

### BUG-3 修復：extractionType 推導邏輯

在 BUG-1 修復中已包含。`extractionPattern.method` → `extractionType` 的映射在 `fetchRule` 函數中處理。

### BUG-4 修復：Link 遷移

```typescript
// rules/[id]/edit/page.tsx
- import Link from 'next/link'
+ import { Link } from '@/i18n/routing'
```

### BUG-5 修復：Forwarder→Company 術語統一

| 位置 | 舊名 | 新名 |
|------|------|------|
| `edit/page.tsx` RuleData | `forwarderId` | `companyId` |
| `RuleEditForm.tsx` RuleData | `forwarderId` | `companyId` |
| `RuleEditForm.tsx` handleSubmit | `forwarderId: rule.forwarderId` | `companyId: rule.companyId` |
| `useRuleEdit.ts` UpdateRuleRequest | `forwarderId` | `companyId` |
| `useRuleEdit.ts` CreateRuleRequest | `forwarderId` | `companyId` |
| `useRuleEdit.ts` ruleKeys.list | `forwarderId` | `companyId` |
| `useRuleEdit.ts` API 路徑 | `/api/companies/${forwarderId}/rules/` | `/api/rules/${ruleId}` |

---

## 修改的檔案

| 檔案 | 修改內容 |
|------|----------|
| `src/app/[locale]/(dashboard)/rules/[id]/edit/page.tsx` | API 路徑修正 `/api/v1/rules/` → `/api/rules/`、extractionType 從 extractionPattern.method 映射、Link 遷移 `@/i18n/routing`、useRouter→useI18nRouter、forwarderId→companyId |
| `src/components/features/rules/RuleEditForm.tsx` | RuleData.forwarderId→companyId、handleSubmit 傳遞 companyId |
| `src/components/features/rules/RuleEditDialog.tsx` | RuleData.forwarderId→companyId（共用 RuleEditForm 的 RuleData 型別） |
| `src/hooks/useRuleEdit.ts` | UpdateRuleRequest/CreateRuleRequest forwarderId→companyId、API 路徑改用 `/api/rules/${ruleId}` PATCH、useCreateForwarderRule→useCreateCompanyRule、ruleKeys.list 支援 null |
| `src/app/api/rules/[id]/route.ts` | 新增 PATCH handler（從 DB 查詢 companyId，無需 URL 路徑參數） |

---

## 修復優先級

| 順序 | Bug | 原因 |
|------|-----|------|
| 1 | BUG-1 | 頁面完全不可用，必須優先修復 |
| 2 | BUG-3 | 與 BUG-1 一起修復（同在 fetchRule 中） |
| 3 | BUG-2 | 修正提交路徑，否則表單提交仍會失敗 |
| 4 | BUG-5 | 與 BUG-2 一起修復（同在 useRuleEdit 中） |
| 5 | BUG-4 | 最低風險，獨立修復 |

---

## 測試驗證

修復完成後需驗證：

- [ ] `/en/rules/[id]/edit` 頁面可正常載入規則數據
- [ ] `/zh-TW/rules/[id]/edit` 頁面可正常載入
- [ ] Extraction Type Tabs 正確顯示當前規則的提取類型
- [ ] 編輯通用規則（companyId=null）可正常提交
- [ ] 編輯公司特定規則（companyId!=null）可正常提交
- [ ] Pattern 編輯器根據 Extraction Type 正確渲染（REGEX/KEYWORD 各有不同 UI）
- [ ] 返回按鈕保留 locale 前綴（如 `/zh-TW/rules/xxx`）
- [ ] TypeScript 編譯無錯誤
- [ ] ESLint 檢查通過

---

*文件建立日期: 2026-02-22*
*最後更新: 2026-02-22（已修復）*
