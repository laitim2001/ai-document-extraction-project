# Story 20.4: 導入/導出與驗證 API

**Status:** draft

---

## Story

**As a** 系統管理員,
**I want** 批次導入/導出 Reference Number 記錄，並提供驗證 API,
**So that** 可以快速維護大量資料，並供文件處理時匹配檢查。

---

## 背景說明

### 問題陳述

系統需要支援批次導入/導出功能以便大量資料維護，同時需要提供驗證 API 供文件處理流程檢查號碼是否存在。

### 設計決策

- **使用 code 識別**：Import 時使用 code 匹配現有記錄，而非 UUID
- **Region 使用 regionCode**：Import 時使用 region.code 而非 regionId
- **驗證 API**：支援批次驗證，返回匹配結果

---

## Acceptance Criteria

### AC1: Import API

**Given** `/api/v1/reference-numbers/import`
**When** POST 請求
**Then**:
  - 接受 JSON 格式的批次資料
  - 使用 code 匹配現有記錄
  - 使用 regionCode 關聯地區
  - 支援 overwriteExisting 選項
  - 返回導入統計（imported, updated, skipped, errors）

### AC2: Export API

**Given** `/api/v1/reference-numbers/export`
**When** GET 請求
**Then**:
  - 支援篩選條件（year, regionId, type）
  - 返回 JSON 格式，使用 code 和 regionCode
  - 包含 exportVersion 和 exportedAt

### AC3: Validate API

**Given** `/api/v1/reference-numbers/validate`
**When** POST 請求包含號碼列表
**Then**:
  - 返回每個號碼的匹配結果
  - 支援可選的篩選條件（year, regionId）
  - 匹配成功時自動增加 matchCount

### AC4: Import 錯誤處理

**Given** Import 請求包含無效資料
**When** 執行導入
**Then**:
  - skipInvalid = true 時跳過無效記錄
  - skipInvalid = false 時整批失敗
  - 返回詳細的錯誤資訊（index, error）

### AC5: 驗證結果結構

**Given** Validate API 響應
**When** 驗證完成
**Then** 返回：
  - results: 每個號碼的 found 狀態和 matches
  - summary: total, found, notFound

---

## Tasks / Subtasks

- [ ] **Task 1: Import/Export Schema** (AC: #1, #2)
  - [ ] 1.1 定義 importReferenceNumbersSchema
  - [ ] 1.2 定義 exportReferenceNumbersQuerySchema
  - [ ] 1.3 定義導入/導出 JSON 格式

- [ ] **Task 2: Validate Schema** (AC: #3, #5)
  - [ ] 2.1 定義 validateReferenceNumbersSchema
  - [ ] 2.2 定義 ValidateResult 類型

- [ ] **Task 3: 服務層擴展** (AC: #1, #2, #3)
  - [ ] 3.1 實現 importReferenceNumbers
  - [ ] 3.2 實現 exportReferenceNumbers
  - [ ] 3.3 實現 validateReferenceNumbers
  - [ ] 3.4 實現 incrementMatchCount

- [ ] **Task 4: API 端點** (AC: #1, #2, #3, #4)
  - [ ] 4.1 新增 `/api/v1/reference-numbers/import/route.ts`
  - [ ] 4.2 新增 `/api/v1/reference-numbers/export/route.ts`
  - [ ] 4.3 新增 `/api/v1/reference-numbers/validate/route.ts`

- [ ] **Task 5: Hooks 擴展** (AC: #1, #3)
  - [ ] 5.1 實現 useImportReferenceNumbers
  - [ ] 5.2 實現 useExportReferenceNumbers
  - [ ] 5.3 實現 useValidateReferenceNumbers

---

## Dev Notes

### 依賴項

- **Story 20-3**: Reference Number CRUD API（必須先完成）

### 新增文件

```
src/app/api/v1/reference-numbers/
├── import/route.ts                   # 新增
├── export/route.ts                   # 新增
└── validate/route.ts                 # 新增
```

### Import JSON 格式

```typescript
interface ImportReferenceNumbersRequest {
  exportVersion?: string;
  items: Array<{
    code?: string;              // 可選，用於更新現有記錄
    number: string;
    type: ReferenceNumberType;
    year: number;
    regionCode: string;         // 使用 region.code
    description?: string;
    validFrom?: string;
    validUntil?: string;
    isActive?: boolean;
  }>;
  options?: {
    overwriteExisting?: boolean;  // 預設 false
    skipInvalid?: boolean;        // 預設 false
  };
}

interface ImportReferenceNumbersResponse {
  success: true;
  data: {
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{
      index: number;
      error: string;
    }>;
  };
}
```

### Export JSON 格式

```typescript
interface ExportReferenceNumbersResponse {
  exportVersion: '1.0';
  exportedAt: string;
  totalCount: number;
  items: Array<{
    code: string;
    number: string;
    type: ReferenceNumberType;
    status: ReferenceNumberStatus;
    year: number;
    regionCode: string;
    description?: string;
    validFrom?: string;
    validUntil?: string;
    matchCount: number;
    isActive: boolean;
  }>;
}
```

### Validate API

```typescript
interface ValidateReferenceNumbersRequest {
  numbers: Array<{
    value: string;
    type?: ReferenceNumberType;
  }>;
  options?: {
    year?: number;
    regionId?: string;
  };
}

interface ValidateReferenceNumbersResponse {
  success: true;
  data: {
    results: Array<{
      value: string;
      found: boolean;
      matches: Array<{
        id: string;
        number: string;
        type: ReferenceNumberType;
        year: number;
        regionCode: string;
        status: ReferenceNumberStatus;
      }>;
    }>;
    summary: {
      total: number;
      found: number;
      notFound: number;
    };
  };
}
```

### 匹配計數更新

```typescript
// 驗證成功時更新 matchCount
await prisma.referenceNumber.update({
  where: { id },
  data: {
    matchCount: { increment: 1 },
    lastMatchedAt: new Date(),
  },
});
```

---

## Implementation Notes

（開發完成後填寫）

---

## Related Files

- `src/services/reference-number.service.ts` - 更新
- `src/app/api/v1/reference-numbers/import/route.ts` - 新增
- `src/app/api/v1/reference-numbers/export/route.ts` - 新增
- `src/app/api/v1/reference-numbers/validate/route.ts` - 新增
