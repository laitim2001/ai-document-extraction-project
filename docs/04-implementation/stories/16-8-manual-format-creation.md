# Story 16.8: 手動建立格式

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 在公司詳情頁面主動為公司建立文件格式,
**So that** 我可以提前配置格式的識別規則和欄位映射，而不需要等待文件上傳後自動識別。

---

## 背景說明

### 問題陳述

目前 `DocumentFormat` 只能在文件上傳處理時自動建立：
- 當公司沒有任何已識別的格式時，格式 Tab 顯示「尚無已識別的格式」
- 用戶無法提前建立格式
- 無法預先配置識別規則
- 無法提前設定格式專屬的映射規則

### 解決方案

新增手動建立格式功能：
1. 在格式 Tab 添加「建立格式」按鈕
2. 提供對話框表單選擇類型和子類型
3. 可選擇自動建立關聯配置（FieldMappingConfig、PromptConfig）
4. 建立成功後列表自動刷新

---

## Acceptance Criteria

### AC1: 格式 Tab 顯示「建立格式」按鈕

**Given** 公司詳情頁格式 Tab
**When** 訪問頁面
**Then**:
  - 空狀態時顯示「建立格式」按鈕
  - 有格式時在統計資訊旁顯示按鈕

### AC2: 可選擇文件類型和子類型

**Given** 建立格式對話框
**When** 開啟對話框
**Then**:
  - 顯示文件類型下拉選單（8 種類型）
  - 顯示文件子類型下拉選單（6 種子類型）
  - 兩者都為必填

### AC3: 可輸入自定義格式名稱

**Given** 建立格式對話框
**When** 填寫表單
**Then**:
  - 格式名稱為選填
  - 留空時自動生成「公司名 - 子類型類型」

### AC4: 可選擇自動建立配置

**Given** 建立格式對話框進階選項
**When** 展開進階選項
**Then**:
  - 可切換「建立欄位映射配置」開關
  - 可切換「建立 Prompt 配置」開關

### AC5: 建立成功後列表自動刷新

**Given** 建立格式成功
**When** 對話框關閉
**Then**:
  - 顯示成功 Toast 通知
  - 格式列表自動刷新
  - 新格式出現在列表中

### AC6: 重複格式顯示友善錯誤

**Given** 嘗試建立重複格式
**When** 提交表單
**Then** 顯示「此公司已存在相同類型的格式」錯誤

### AC7: API 端點

**Given** POST /api/v1/formats
**When** 請求建立格式
**Then**:
  - 201: 建立成功
  - 400: 驗證錯誤
  - 404: 公司不存在
  - 409: 格式已存在

---

## Tasks / Subtasks

- [x] **Task 1: 擴展驗證 Schema** (AC: #2, #3)
  - [x] 1.1 新增 `createDocumentFormatSchema`
  - [x] 1.2 支援 autoCreateConfigs 選項

- [x] **Task 2: 服務層方法** (AC: #4, #5, #6)
  - [x] 2.1 新增 `createDocumentFormatManually()` 方法
  - [x] 2.2 驗證公司存在
  - [x] 2.3 檢查唯一約束
  - [x] 2.4 使用事務建立格式和配置

- [x] **Task 3: API 端點** (AC: #7)
  - [x] 3.1 新增 POST handler
  - [x] 3.2 實現錯誤處理（404, 409, 400）

- [x] **Task 4: React Query Hook** (AC: #5)
  - [x] 4.1 新增 `useCreateFormat()` mutation hook
  - [x] 4.2 實現 cache invalidation
  - [x] 4.3 實現 Toast 通知

- [x] **Task 5: UI 組件** (AC: #1, #2, #3, #4)
  - [x] 5.1 建立 `CreateFormatDialog.tsx`
  - [x] 5.2 實現表單驗證
  - [x] 5.3 實現進階選項展開

- [x] **Task 6: 整合到 FormatList** (AC: #1)
  - [x] 6.1 修改 FormatListEmpty 添加按鈕
  - [x] 6.2 在統計資訊旁添加按鈕

- [x] **Task 7: 驗證與測試** (AC: #1-7)
  - [x] 7.1 TypeScript 類型檢查通過
  - [x] 7.2 ESLint 檢查通過

---

## Dev Notes

### 依賴項

- **Story 16-1**: FormatList 組件
- **Story 13-4**: FieldMappingConfig 模型
- **Epic 14**: PromptConfig 模型

### 修改/新增文件

```
src/
├── validations/
│   └── document-format.ts           # 更新：新增 createDocumentFormatSchema
├── services/
│   └── document-format.service.ts   # 更新：新增 createDocumentFormatManually
├── app/api/v1/formats/
│   └── route.ts                     # 更新：新增 POST handler
├── hooks/
│   └── use-company-formats.ts       # 更新：新增 useCreateFormat
├── components/features/formats/
│   ├── CreateFormatDialog.tsx       # 新增
│   ├── FormatList.tsx               # 更新：整合建立按鈕
│   └── index.ts                     # 更新：導出新組件
```

### API 設計

#### POST /api/v1/formats

**Request:**
```json
{
  "companyId": "cuid-string",
  "documentType": "INVOICE",
  "documentSubtype": "OCEAN_FREIGHT",
  "name": "自定義名稱（選填）",
  "autoCreateConfigs": {
    "fieldMapping": true,
    "promptConfig": false
  }
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "format": {
      "id": "format-id",
      "name": "Company - 海運發票"
    },
    "createdConfigs": {
      "fieldMappingConfig": { "id": "...", "name": "..." }
    }
  }
}
```

### 錯誤處理

| 錯誤類型 | HTTP 狀態 | 訊息 |
|----------|-----------|------|
| COMPANY_NOT_FOUND | 404 | 指定的公司不存在 |
| FORMAT_ALREADY_EXISTS | 409 | 此公司已存在相同類型的格式 |
| Zod 驗證失敗 | 400 | 請求資料驗證失敗 |

---

## Implementation Notes

### 完成日期
2026-01-14

### 實現摘要
- **驗證 Schema**: `createDocumentFormatSchema` 支援類型、子類型、名稱、自動配置
- **服務層**: `createDocumentFormatManually()` 使用 Prisma 事務確保原子性
- **API 端點**: POST /api/v1/formats 支援完整錯誤處理
- **UI 組件**: `CreateFormatDialog` 支援進階選項展開
- **整合**: FormatList 空狀態和統計資訊旁都有建立按鈕

### 技術決策
1. 使用 Prisma `$transaction` 確保格式和配置建立的原子性
2. 格式唯一約束：companyId + documentType + documentSubtype
3. 自動生成名稱格式：`{公司名} - {子類型}{類型}`

---

## Related Files

- `src/validations/document-format.ts` - 更新
- `src/services/document-format.service.ts` - 更新
- `src/app/api/v1/formats/route.ts` - 更新
- `src/hooks/use-company-formats.ts` - 更新
- `src/components/features/formats/CreateFormatDialog.tsx` - 新增
- `src/components/features/formats/FormatList.tsx` - 更新
- `docs/04-implementation/tech-specs/epic-16-format-management/tech-spec-story-16-8.md` - 參考
