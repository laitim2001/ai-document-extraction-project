# FIX-047: Audit Log 頁面角色名稱不匹配導致無法訪問

> **建立日期**: 2026-02-26
> **發現方式**: 代碼審查 — 角色名稱與資料庫實際值不一致
> **影響頁面/功能**: `/audit/query` — 審計查詢頁面
> **優先級**: P1 (High)
> **狀態**: ✅ 已修復
> **相關**: Epic 8 - Story 8.3（處理記錄查詢）

---

## 問題描述

審計查詢頁面 `src/app/[locale]/(dashboard)/audit/query/page.tsx` 的存取控制使用了錯誤的角色名稱進行權限檢查，導致具有正確角色的用戶無法訪問頁面，一律被重定向到 `/dashboard`。

### 具體不匹配

| 代碼中使用的值 | 資料庫實際角色名稱 | 問題 |
|----------------|-------------------|------|
| `'AUDITOR'` | `'Auditor'` | 大小寫不匹配（A vs a） |
| `'GLOBAL_ADMIN'` | `'System Admin'` | 名稱完全不同 |

### 復現步驟

1. 以 Auditor 或 System Admin 角色登入系統
2. 導航至 `/audit/query`
3. **預期**: 成功進入審計查詢頁面
4. **實際**: 被重定向至 `/dashboard`（權限檢查失敗）

---

## 根本原因

`page.tsx` 第 50-52 行的權限檢查硬編碼了錯誤的角色名稱：

```typescript
// 修復前（錯誤）
const hasAuditAccess = session?.user?.roles?.some(r =>
  ['AUDITOR', 'GLOBAL_ADMIN'].includes(r.name)
)
```

角色名稱使用了 UPPER_SNAKE_CASE 格式（`'AUDITOR'`、`'GLOBAL_ADMIN'`），但資料庫中的角色 `name` 欄位實際儲存的是 PascalCase/自然語言格式（`'Auditor'`、`'System Admin'`）。由於 `String.includes()` 是大小寫敏感的比對，檢查永遠失敗。

---

## 修復方案

將角色名稱修正為資料庫實際值，並增加 `Super User` 角色和 `isGlobalAdmin` 布爾值檢查作為額外保障：

```typescript
// 修復後（正確）
const hasAuditAccess = session?.user?.roles?.some(r =>
  ['Auditor', 'System Admin', 'Super User'].includes(r.name)
) || session?.user?.isGlobalAdmin === true
```

### 修正說明

| 修正項目 | 說明 |
|----------|------|
| `'AUDITOR'` → `'Auditor'` | 使用資料庫實際角色名稱 |
| `'GLOBAL_ADMIN'` → `'System Admin'` | 使用資料庫實際角色名稱 |
| 新增 `'Super User'` | 超級用戶理應擁有審計權限 |
| 新增 `isGlobalAdmin` 檢查 | 額外的布爾值檢查作為保險 |

同步更新了 JSDoc 註釋中的角色名稱引用，確保文檔與代碼一致。

---

## 修改檔案

| # | 檔案 | 改動說明 |
|---|------|----------|
| 1 | `src/app/[locale]/(dashboard)/audit/query/page.tsx` | 修正角色名稱 + 更新 JSDoc 註釋 |

---

## 影響範圍

| 項目 | 影響 |
|------|------|
| 審計查詢頁面 | 直接修復 — Auditor / System Admin / Super User 可正常訪問 |
| 其他頁面 | 無影響 — 本次僅修正 audit/query/page.tsx |
| `GLOBAL_ADMIN` 全局問題 | **未處理** — 另有 61 個文件使用 `GLOBAL_ADMIN`，屬另一個 CHANGE 範圍 |

---

## 風險評估

| 風險 | 嚴重度 | 說明 |
|------|--------|------|
| 修正後仍無法訪問 | 極低 | 角色名稱已與資料庫一致，且增加了 `isGlobalAdmin` 保險 |
| 影響其他頁面 | 無 | 修改範圍僅限於一個文件 |

---

## 驗證方式

1. 以 Auditor 角色登入 → 導航至 `/audit/query` → 應可正常訪問
2. 以 System Admin 角色登入 → 導航至 `/audit/query` → 應可正常訪問
3. 以 Super User 角色登入 → 導航至 `/audit/query` → 應可正常訪問
4. 以一般用戶（無上述角色）登入 → 導航至 `/audit/query` → 應被重定向至 `/dashboard`
