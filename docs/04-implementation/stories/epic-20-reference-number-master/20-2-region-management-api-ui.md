# Story 20.2: Region 管理 API 與 UI

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 管理地區設定（新增、編輯、刪除）,
**So that** 可以根據業務需求擴展地區列表。

---

## 背景說明

### 問題陳述

系統需要一個可擴展的地區管理功能，允許管理員在預設地區之外新增自定義地區。

### 設計決策

- **簡易管理介面**：在設定頁面中內嵌，非獨立頁面
- **保護預設地區**：isDefault = true 的地區不可刪除
- **共用組件**：提供 RegionSelect 供其他功能使用

---

## Acceptance Criteria

### AC1: Region 列表 API

**Given** `/api/v1/regions`
**When** GET 請求
**Then**:
  - 返回所有地區列表
  - 支援 `isActive` 篩選
  - 按 `sortOrder` 排序

### AC2: Region 建立 API

**Given** `/api/v1/regions`
**When** POST 請求
**Then**:
  - 驗證 code 唯一性
  - 建立新地區（isDefault = false）
  - 返回建立的地區

### AC3: Region 更新 API

**Given** `/api/v1/regions/:id`
**When** PATCH 請求
**Then**:
  - 可更新 name, description, isActive, sortOrder
  - 不可更新 code（唯一識別）

### AC4: Region 刪除 API

**Given** `/api/v1/regions/:id`
**When** DELETE 請求
**Then**:
  - isDefault = true 的地區返回錯誤
  - 有關聯 ReferenceNumber 的地區返回錯誤
  - 否則軟刪除（isActive = false）

### AC5: RegionSelect 組件

**Given** RegionSelect 組件
**When** 渲染
**Then**:
  - 顯示所有啟用地區
  - 支援單選/多選模式
  - 支援搜尋過濾

### AC6: 地區管理 UI

**Given** 設定頁面
**When** 訪問地區管理區塊
**Then**:
  - 顯示地區列表
  - 可新增/編輯/刪除地區
  - 預設地區顯示鎖定圖標

---

## Tasks / Subtasks

- [x] **Task 1: Zod 驗證** (AC: #1, #2, #3)
  - [x] 1.1 新增 `src/lib/validations/region.schema.ts`
  - [x] 1.2 建立 createRegionSchema
  - [x] 1.3 建立 updateRegionSchema
  - [x] 1.4 建立 getRegionsQuerySchema

- [x] **Task 2: 服務層** (AC: #1, #2, #3, #4)
  - [x] 2.1 新增 `src/services/region.service.ts`
  - [x] 2.2 實現 list/getById/create/update/delete
  - [x] 2.3 實現刪除保護邏輯

- [x] **Task 3: API 端點** (AC: #1, #2, #3, #4)
  - [x] 3.1 新增 `/api/v1/regions/route.ts`
  - [x] 3.2 新增 `/api/v1/regions/[id]/route.ts`

- [x] **Task 4: RegionSelect 組件** (AC: #5)
  - [x] 4.1 新增 `src/components/features/region/RegionSelect.tsx`
  - [x] 4.2 實現單選模式
  - [x] 4.3 實現搜尋過濾

- [ ] **Task 5: 管理 UI** (AC: #6) - 延後至 Story 20-3
  - [ ] 5.1 新增 RegionManagementSection 組件
  - [ ] 5.2 整合到設定頁面
  - [ ] 5.3 實現 CRUD 操作

- [x] **Task 6: i18n** (AC: #5, #6)
  - [x] 6.1 新增 `messages/en/region.json`
  - [x] 6.2 新增 `messages/zh-TW/region.json`
  - [x] 6.3 新增 `messages/zh-CN/region.json`

---

## Dev Notes

### 依賴項

- **Story 20-1**: Region 模型（必須先完成）

### 新增文件

```
src/
├── lib/validations/
│   └── region.schema.ts              # 新增
├── services/
│   └── region.service.ts             # 新增
├── components/features/region/
│   ├── index.ts                      # 新增
│   ├── RegionSelect.tsx              # 新增
│   └── RegionManagementSection.tsx   # 新增
├── hooks/
│   └── use-regions.ts                # 新增
└── app/api/v1/regions/
    ├── route.ts                      # 新增
    └── [id]/route.ts                 # 新增

messages/
├── en/region.json                    # 新增
├── zh-TW/region.json                 # 新增
└── zh-CN/region.json                 # 新增
```

### API 設計

```typescript
// GET /api/v1/regions
interface GetRegionsQuery {
  isActive?: boolean;
}

// POST /api/v1/regions
interface CreateRegionInput {
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

// PATCH /api/v1/regions/:id
interface UpdateRegionInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}
```

### RegionSelect Props

```typescript
interface RegionSelectProps {
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  includeInactive?: boolean;
}
```

---

## Implementation Notes

### 完成日期
2026-02-05

### 實作摘要

**1. Zod 驗證 Schema**
- `src/lib/validations/region.schema.ts`
- createRegionSchema, updateRegionSchema, getRegionsQuerySchema
- 支援代碼唯一性檢查

**2. 服務層**
- `src/services/region.service.ts`
- CRUD 操作：getRegions, getRegionById, createRegion, updateRegion, deleteRegion
- 刪除保護邏輯：系統預設不可刪除、有關聯 ReferenceNumber 不可刪除
- 軟刪除機制（status = INACTIVE）

**3. API 端點**
- `GET /api/v1/regions` - 列表查詢（支援 isActive 篩選）
- `POST /api/v1/regions` - 建立新 Region
- `GET /api/v1/regions/:id` - 取得 Region 詳情
- `PATCH /api/v1/regions/:id` - 更新 Region
- `DELETE /api/v1/regions/:id` - 刪除 Region（軟刪除）

**4. React Query Hook**
- `src/hooks/use-regions.ts`
- useRegions, useCreateRegion, useUpdateRegion, useDeleteRegion

**5. RegionSelect 組件**
- `src/components/features/region/RegionSelect.tsx`
- 支援單選模式、載入狀態、搜尋過濾

**6. i18n 翻譯**
- `messages/en/region.json`
- `messages/zh-TW/region.json`
- `messages/zh-CN/region.json`

### 技術決策
- 使用 RegionStatus enum（ACTIVE/INACTIVE）而非布林 isActive，與現有 Region 模型一致
- 軟刪除策略：設置 status = INACTIVE，不做物理刪除
- API 響應格式遵循 RFC 7807 錯誤規範

---

## Related Files

- `src/lib/validations/region.schema.ts` - 新增
- `src/services/region.service.ts` - 新增
- `src/components/features/region/` - 新增
- `src/app/api/v1/regions/` - 新增
