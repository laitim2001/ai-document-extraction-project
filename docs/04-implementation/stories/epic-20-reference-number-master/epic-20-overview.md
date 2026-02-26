# Epic 20: Reference Number Master Setup

**Status:** draft

---

## Epic 概述

### 背景

SCM 部門在處理 Freight Invoice 時，需要驗證文件中提取的 Shipment/Delivery Number 是否為有效記錄。目前系統缺少一個集中管理這些參考號碼的功能。

### 目標

1. **建立 Reference Number 主檔管理**：支援不同年份、號碼、地區的記錄
2. **提供地區管理功能**：可擴展的地區列表（預設 + 管理員可新增）
3. **支援批次導入/導出**：方便大量資料維護
4. **提供驗證 API**：供文件處理流程檢查號碼是否存在

### 業務價值

- **數據準確性**：確保處理的文件包含有效的參考號碼
- **靈活管理**：按地區、年份、類型分類管理
- **批量維護**：支援 JSON 格式的批次導入/導出

---

## 架構設計

### 數據模型

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           數據模型關係                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Region（地區）                     ReferenceNumber（參考號碼）          │
│  ├── id: String                    ├── id: String                       │
│  ├── code: String (唯一)           ├── code: String (唯一，導入導出用)   │
│  ├── name: String                  ├── number: String                   │
│  ├── isDefault: Boolean            ├── type: SHIPMENT|DELIVERY|...      │
│  └── isActive: Boolean             ├── status: ACTIVE|EXPIRED|CANCELLED │
│         │                          ├── year: Int                        │
│         │                          ├── regionId: String (必填)          │
│         └──────────────────────────┼── description: String?             │
│                                    ├── validFrom: DateTime?             │
│                                    ├── validUntil: DateTime?            │
│                                    ├── matchCount: Int                  │
│                                    └── isActive: Boolean                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 唯一約束

- Region: `code` 唯一
- ReferenceNumber: `(number, type, year, regionId)` 組合唯一

---

## Stories 列表

| Story ID | 名稱 | 估計工時 | 依賴 | 狀態 |
|----------|------|----------|------|------|
| 20-1 | 資料庫模型與基礎設施 | 4 SP | - | draft |
| 20-2 | Region 管理 API 與 UI | 4 SP | 20-1 | draft |
| 20-3 | Reference Number CRUD API | 6 SP | 20-1 | draft |
| 20-4 | 導入/導出與驗證 API | 6 SP | 20-3 | draft |
| 20-5 | 管理頁面 - 列表與篩選 | 6 SP | 20-2, 20-3 | draft |
| 20-6 | 管理頁面 - 表單與導入 | 6 SP | 20-4, 20-5 | draft |

**總計：32 Story Points**

---

## 依賴關係

```
Story 20-1 (資料庫模型)
    │
    ├──────────────────┐
    │                  │
    ▼                  ▼
Story 20-2         Story 20-3
(Region API)       (CRUD API)
    │                  │
    │                  ▼
    │              Story 20-4
    │              (Import/Export/Validate)
    │                  │
    └──────────────────┼──────────────────┐
                       │                  │
                       ▼                  ▼
                  Story 20-5         Story 20-6
                  (列表 UI)          (表單/導入 UI)
```

---

## 技術考量

### API 設計

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/v1/regions` | GET, POST | 地區列表、建立 |
| `/api/v1/regions/:id` | GET, PATCH, DELETE | 地區詳情、更新、刪除 |
| `/api/v1/reference-numbers` | GET, POST | 列表（分頁）、建立 |
| `/api/v1/reference-numbers/:id` | GET, PATCH, DELETE | 詳情、更新、刪除 |
| `/api/v1/reference-numbers/import` | POST | 批次導入 |
| `/api/v1/reference-numbers/export` | GET | 批次導出 |
| `/api/v1/reference-numbers/validate` | POST | 驗證號碼 |

### 預設地區

系統初始化時建立以下預設地區：
- APAC - Asia Pacific
- EMEA - Europe, Middle East, Africa
- AMER - Americas
- GLOBAL - Global

---

## 驗收標準概覽

1. ✅ 可以新增/修改/刪除地區
2. ✅ 可以 CRUD Reference Number 記錄
3. ✅ 可以按年份、地區、類型篩選
4. ✅ 可以批次導入/導出 JSON
5. ✅ Validate API 可正確匹配號碼
6. ✅ 匹配成功時自動增加 matchCount

---

## 相關文檔

- [Epic 19: 數據模版匹配與輸出](../epic-19-template-matching/epic-19-overview.md)
- [Epic 16: 文件格式管理](../epic-16-format-management/epic-16-overview.md)

---

## 修訂記錄

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| 1.0.0 | 2026-02-04 | 初版建立 |
