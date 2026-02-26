# Story 21.4: 轉換計算 API

**Status:** done

---

## Story

**As a** API 使用者,
**I want** 通過 API 進行貨幣轉換計算,
**So that** 可以快速獲得匯率轉換結果，無需手動查詢和計算。

---

## 背景說明

### 問題陳述

需要提供貨幣轉換 API，支援：
- 單一金額轉換
- 批次查詢多個貨幣對的匯率
- 自動 Fallback 邏輯（直接 → 反向 → 交叉）

### Convert Fallback 邏輯

```
1. 直接查詢：HKD → USD（找到則返回）
2. 反向計算：USD → HKD 存在，計算 1/rate
3. 交叉匯率：HKD → USD → EUR（通過 USD 中轉）
4. 找不到：返回錯誤
```

---

## Acceptance Criteria

### AC1: 單一轉換 API

**Given** POST /api/v1/exchange-rates/convert
**When** 提供 fromCurrency, toCurrency, amount
**Then**:
  - 返回轉換後的金額
  - 返回使用的匯率
  - 返回轉換路徑（direct/inverse/cross）

### AC2: 批次查詢 API

**Given** POST /api/v1/exchange-rates/batch
**When** 提供多個貨幣對
**Then** 返回每個貨幣對的匯率和轉換路徑

### AC3: Fallback 邏輯

**Given** Convert API
**When** 直接匯率不存在
**Then**:
  - 先嘗試反向計算
  - 再嘗試通過 USD 交叉匯率
  - 都失敗則返回明確錯誤

### AC4: 年份參數

**Given** Convert API
**When** 未指定 year 參數
**Then** 預設使用當前年份

### AC5: 精度處理

**Given** 匯率計算
**When** 執行轉換
**Then** 使用 Decimal 精度，結果保留適當小數位

---

## Tasks / Subtasks

- [ ] **Task 1: Convert API** (AC: #1, #3, #4, #5)
  - [ ] 1.1 新增 `/api/v1/exchange-rates/convert/route.ts`
  - [ ] 1.2 實現 POST 端點
  - [ ] 1.3 處理 Fallback 邏輯
  - [ ] 1.4 處理精度計算

- [ ] **Task 2: Batch API** (AC: #2)
  - [ ] 2.1 新增 `/api/v1/exchange-rates/batch/route.ts`
  - [ ] 2.2 實現 POST 端點
  - [ ] 2.3 優化批次查詢效能

- [ ] **Task 3: React Query Hooks**
  - [ ] 3.1 新增 useConvertCurrency hook
  - [ ] 3.2 新增 useBatchRates hook

---

## Dev Notes

### 依賴項

- **Story 21-2**: 核心服務層（convert, batchGetRates 方法）

### 新增文件

```
src/app/api/v1/exchange-rates/
├── convert/route.ts                 # 新增
└── batch/route.ts                   # 新增
```

### Convert API 請求/響應

**請求：**
```json
{
  "fromCurrency": "HKD",
  "toCurrency": "USD",
  "amount": 1000,
  "year": 2026
}
```

**響應：**
```json
{
  "success": true,
  "data": {
    "fromCurrency": "HKD",
    "toCurrency": "USD",
    "amount": 1000,
    "convertedAmount": 128.00,
    "rate": 0.128,
    "path": "direct",
    "rateId": "cuid...",
    "effectiveYear": 2026
  }
}
```

**交叉匯率響應：**
```json
{
  "success": true,
  "data": {
    "fromCurrency": "HKD",
    "toCurrency": "EUR",
    "amount": 1000,
    "convertedAmount": 118.28,
    "rate": 0.11828,
    "path": "cross:HKD→USD→EUR",
    "rateIds": ["cuid1...", "cuid2..."],
    "effectiveYear": 2026
  }
}
```

### Batch API 請求/響應

**請求：**
```json
{
  "pairs": [
    { "fromCurrency": "HKD", "toCurrency": "USD" },
    { "fromCurrency": "USD", "toCurrency": "EUR" },
    { "fromCurrency": "HKD", "toCurrency": "JPY" }
  ],
  "year": 2026
}
```

**響應：**
```json
{
  "success": true,
  "data": {
    "rates": [
      {
        "fromCurrency": "HKD",
        "toCurrency": "USD",
        "rate": 0.128,
        "path": "direct",
        "found": true
      },
      {
        "fromCurrency": "USD",
        "toCurrency": "EUR",
        "rate": 0.924,
        "path": "direct",
        "found": true
      },
      {
        "fromCurrency": "HKD",
        "toCurrency": "JPY",
        "rate": 19.84,
        "path": "cross:HKD→USD→JPY",
        "found": true
      }
    ],
    "effectiveYear": 2026
  }
}
```

### 錯誤響應

```json
{
  "type": "https://api.example.com/errors/rate-not-found",
  "title": "Exchange Rate Not Found",
  "status": 404,
  "detail": "找不到 HKD → EUR 的匯率記錄（年份：2026）"
}
```

---

## Implementation Notes

### 完成日期: 2026-02-05

### 實現摘要

1. **Convert API** (`src/app/api/v1/exchange-rates/convert/route.ts`)
   - POST 端點，接收 fromCurrency, toCurrency, amount, year
   - 調用 service 層 `convert()` 方法，自帶三層 Fallback 邏輯
   - 返回 convertedAmount, rate, path (direct/inverse/cross:X→USD→Y)
   - 404 錯誤回應使用 RFC 7807 格式

2. **Batch API** (`src/app/api/v1/exchange-rates/batch/route.ts`)
   - POST 端點，接收 pairs 陣列 (最多 50 組) 和 year
   - 調用 service 層 `batchGetRates()` 方法，並行查詢
   - 失敗的貨幣對返回 found: false，不影響其他結果

3. **React Query Hooks** (`src/hooks/use-exchange-rates.ts`)
   - `useConvertCurrency()`: useMutation hook，呼叫 convert API
   - `useBatchRates()`: useMutation hook，呼叫 batch API
   - 包含完整的 TypeScript 類型定義

### 設計決策
- Convert 和 Batch 均為 useMutation（非 useQuery），因為它們是帶參數的 POST 操作
- Batch API 的 effectiveYear 在 API 層計算預設值，與 service 層一致
- 錯誤處理遵循現有 exchange-rate API 路由的模式

---

## Related Files

- `src/app/api/v1/exchange-rates/convert/route.ts` - 新增
- `src/app/api/v1/exchange-rates/batch/route.ts` - 新增
