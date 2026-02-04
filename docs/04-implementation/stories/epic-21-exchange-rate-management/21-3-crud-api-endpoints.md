# Story 21.3: CRUD API 端點

**Status:** pending

---

## Story

**As a** API 使用者,
**I want** 通過 RESTful API 管理匯率記錄,
**So that** 可以建立、查詢、更新、刪除匯率資料。

---

## 背景說明

### 問題陳述

需要建立完整的 CRUD API 端點供前端和外部系統使用，包含：
- 列表查詢（分頁、篩選、排序）
- 單一查詢
- 建立（含反向匯率選項）
- 更新
- 刪除
- 切換啟用狀態

---

## Acceptance Criteria

### AC1: 列表查詢 API

**Given** GET /api/v1/exchange-rates
**When** 查詢匯率列表
**Then**:
  - 支援分頁（page, limit）
  - 支援篩選（year, fromCurrency, toCurrency, isActive, source）
  - 支援排序（sortBy, sortOrder）
  - 返回標準分頁格式

### AC2: 單一查詢 API

**Given** GET /api/v1/exchange-rates/:id
**When** 查詢單一記錄
**Then** 返回完整記錄資訊（含反向記錄關聯）

### AC3: 建立 API

**Given** POST /api/v1/exchange-rates
**When** 建立新記錄
**Then**:
  - 驗證必填欄位
  - 如果 createInverse = true，同時建立反向記錄
  - 返回新建記錄

### AC4: 更新 API

**Given** PATCH /api/v1/exchange-rates/:id
**When** 更新記錄
**Then**:
  - 只更新提供的欄位
  - 返回更新後的記錄

### AC5: 刪除 API

**Given** DELETE /api/v1/exchange-rates/:id
**When** 刪除記錄
**Then**:
  - 執行軟刪除（isActive = false）
  - 如果有自動產生的反向記錄，一併處理

### AC6: 切換狀態 API

**Given** POST /api/v1/exchange-rates/:id/toggle
**When** 切換啟用狀態
**Then** isActive 在 true/false 之間切換

---

## Tasks / Subtasks

- [ ] **Task 1: 列表與建立 API** (AC: #1, #3)
  - [ ] 1.1 新增 `/api/v1/exchange-rates/route.ts`
  - [ ] 1.2 實現 GET（列表查詢）
  - [ ] 1.3 實現 POST（建立記錄）

- [ ] **Task 2: 單一記錄 API** (AC: #2, #4, #5)
  - [ ] 2.1 新增 `/api/v1/exchange-rates/[id]/route.ts`
  - [ ] 2.2 實現 GET（單一查詢）
  - [ ] 2.3 實現 PATCH（更新）
  - [ ] 2.4 實現 DELETE（刪除）

- [ ] **Task 3: 切換狀態 API** (AC: #6)
  - [ ] 3.1 新增 `/api/v1/exchange-rates/[id]/toggle/route.ts`
  - [ ] 3.2 實現 POST（切換狀態）

- [ ] **Task 4: React Query Hooks**
  - [ ] 4.1 新增 `src/hooks/use-exchange-rates.ts`
  - [ ] 4.2 實現 useExchangeRates（列表）
  - [ ] 4.3 實現 useExchangeRate（單一）
  - [ ] 4.4 實現 useCreateExchangeRate
  - [ ] 4.5 實現 useUpdateExchangeRate
  - [ ] 4.6 實現 useDeleteExchangeRate
  - [ ] 4.7 實現 useToggleExchangeRate

---

## Dev Notes

### 依賴項

- **Story 21-2**: 核心服務層

### 新增文件

```
src/
├── app/api/v1/exchange-rates/
│   ├── route.ts                     # 新增：GET list, POST create
│   └── [id]/
│       ├── route.ts                 # 新增：GET, PATCH, DELETE
│       └── toggle/route.ts          # 新增：POST toggle
└── hooks/
    └── use-exchange-rates.ts        # 新增
```

### API 響應格式

**列表響應：**
```json
{
  "success": true,
  "data": [
    {
      "id": "cuid...",
      "fromCurrency": "HKD",
      "toCurrency": "USD",
      "rate": "0.12800000",
      "effectiveYear": 2026,
      "isActive": true,
      "source": "MANUAL",
      "inverseOfId": null,
      "hasInverse": true,
      "createdAt": "2026-02-04T..."
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

**錯誤響應（RFC 7807）：**
```json
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Error",
  "status": 400,
  "detail": "來源和目標貨幣不能相同",
  "errors": {
    "toCurrency": ["來源和目標貨幣不能相同"]
  }
}
```

---

## Implementation Notes

（開發完成後填寫）

---

## Related Files

- `src/app/api/v1/exchange-rates/route.ts` - 新增
- `src/app/api/v1/exchange-rates/[id]/route.ts` - 新增
- `src/app/api/v1/exchange-rates/[id]/toggle/route.ts` - 新增
- `src/hooks/use-exchange-rates.ts` - 新增
