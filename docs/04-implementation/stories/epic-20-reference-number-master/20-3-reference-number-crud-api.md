# Story 20.3: Reference Number CRUD API

**Status:** draft

---

## Story

**As a** 系統管理員,
**I want** 透過 API 建立、查詢、更新、刪除 Reference Number 記錄,
**So that** 可以管理系統中的參考號碼主檔。

---

## 背景說明

### 問題陳述

系統需要完整的 CRUD API 來管理 Reference Number 記錄，支援分頁、篩選、排序等功能。

### 設計決策

- **code 欄位**：自動生成唯一識別碼，用於 Import/Export
- **唯一約束**：同年份、同類型、同地區的號碼唯一
- **軟刪除**：刪除操作設定 isActive = false

---

## Acceptance Criteria

### AC1: 列表查詢 API

**Given** `/api/v1/reference-numbers`
**When** GET 請求
**Then**:
  - 支援分頁（page, limit）
  - 支援篩選（year, regionId, type, status, isActive, search）
  - 支援排序（sortBy, sortOrder）
  - 返回包含 region 資訊的列表

### AC2: 單一查詢 API

**Given** `/api/v1/reference-numbers/:id`
**When** GET 請求
**Then**:
  - 返回完整 Reference Number 詳情
  - 包含 region 和 createdBy 資訊

### AC3: 建立 API

**Given** `/api/v1/reference-numbers`
**When** POST 請求
**Then**:
  - 驗證必填欄位（number, type, year, regionId）
  - 自動生成 code（如未提供）
  - 驗證 (number, type, year, regionId) 唯一
  - 返回建立的記錄

### AC4: 更新 API

**Given** `/api/v1/reference-numbers/:id`
**When** PATCH 請求
**Then**:
  - 可更新 number, type, status, year, regionId, description, validFrom, validUntil, isActive
  - 驗證更新後的唯一約束

### AC5: 刪除 API

**Given** `/api/v1/reference-numbers/:id`
**When** DELETE 請求
**Then**:
  - 軟刪除（isActive = false）
  - 返回成功狀態

### AC6: Zod 驗證

**Given** API 請求
**When** 輸入無效資料
**Then**:
  - 返回詳細的驗證錯誤
  - 錯誤格式符合 RFC 7807

---

## Tasks / Subtasks

- [ ] **Task 1: Zod 驗證** (AC: #6)
  - [ ] 1.1 新增 `src/lib/validations/reference-number.schema.ts`
  - [ ] 1.2 建立 createReferenceNumberSchema
  - [ ] 1.3 建立 updateReferenceNumberSchema
  - [ ] 1.4 建立 getReferenceNumbersQuerySchema

- [ ] **Task 2: 服務層** (AC: #1, #2, #3, #4, #5)
  - [ ] 2.1 新增 `src/services/reference-number.service.ts`
  - [ ] 2.2 實現 list（分頁、篩選、排序）
  - [ ] 2.3 實現 getById
  - [ ] 2.4 實現 create（含 code 自動生成）
  - [ ] 2.5 實現 update
  - [ ] 2.6 實現 delete（軟刪除）

- [ ] **Task 3: API 端點** (AC: #1, #2, #3, #4, #5)
  - [ ] 3.1 新增 `/api/v1/reference-numbers/route.ts`
  - [ ] 3.2 新增 `/api/v1/reference-numbers/[id]/route.ts`

- [ ] **Task 4: Hooks** (AC: #1, #2, #3, #4, #5)
  - [ ] 4.1 新增 `src/hooks/use-reference-numbers.ts`
  - [ ] 4.2 實現 useReferenceNumbers（列表）
  - [ ] 4.3 實現 useReferenceNumber（單一）
  - [ ] 4.4 實現 useCreateReferenceNumber
  - [ ] 4.5 實現 useUpdateReferenceNumber
  - [ ] 4.6 實現 useDeleteReferenceNumber

---

## Dev Notes

### 依賴項

- **Story 20-1**: ReferenceNumber 模型（必須先完成）

### 新增文件

```
src/
├── lib/validations/
│   └── reference-number.schema.ts    # 新增
├── services/
│   └── reference-number.service.ts   # 新增
├── hooks/
│   └── use-reference-numbers.ts      # 新增
└── app/api/v1/reference-numbers/
    ├── route.ts                      # 新增
    └── [id]/route.ts                 # 新增
```

### API 設計

```typescript
// GET /api/v1/reference-numbers
interface GetReferenceNumbersQuery {
  page?: number;        // 預設 1
  limit?: number;       // 預設 20, 最大 100
  year?: number;
  regionId?: string;
  type?: ReferenceNumberType;
  status?: ReferenceNumberStatus;
  isActive?: boolean;
  search?: string;      // 模糊搜尋 number
  sortBy?: 'number' | 'year' | 'createdAt' | 'updatedAt' | 'matchCount';
  sortOrder?: 'asc' | 'desc';
}

// POST /api/v1/reference-numbers
interface CreateReferenceNumberInput {
  code?: string;        // 可選，未提供時自動生成
  number: string;
  type: ReferenceNumberType;
  year: number;
  regionId: string;
  description?: string;
  validFrom?: string;
  validUntil?: string;
}

// PATCH /api/v1/reference-numbers/:id
interface UpdateReferenceNumberInput {
  number?: string;
  type?: ReferenceNumberType;
  status?: ReferenceNumberStatus;
  year?: number;
  regionId?: string;
  description?: string;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive?: boolean;
}
```

### Code 自動生成規則

```typescript
// 格式: REF-{YEAR}-{REGION}-{RANDOM}
// 範例: REF-2026-APAC-A1B2C3
function generateCode(year: number, regionCode: string): string {
  const random = nanoid(6).toUpperCase();
  return `REF-${year}-${regionCode}-${random}`;
}
```

---

## Implementation Notes

（開發完成後填寫）

---

## Related Files

- `src/lib/validations/reference-number.schema.ts` - 新增
- `src/services/reference-number.service.ts` - 新增
- `src/hooks/use-reference-numbers.ts` - 新增
- `src/app/api/v1/reference-numbers/` - 新增
