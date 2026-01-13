# Epic 16: 文件格式管理

**Status:** 🚧 規劃中

---

## Epic 概覽

### 目標

提供文件格式的可視化管理和識別規則配置，讓用戶可以查看、編輯和配置每個公司的文件格式。

### 問題陳述

目前系統：
1. **缺乏格式管理界面**: 無法查看/編輯已識別的格式
2. **識別規則不可配置**: 格式識別邏輯是硬編碼的
3. **專屬配置不直觀**: 無法直接為格式配置專屬的 Prompt 和映射

### 解決方案

1. **格式列表 Tab**: 在公司詳情頁新增格式管理 Tab
2. **格式詳情頁**: 查看/編輯格式，管理識別規則
3. **配置關聯**: 直觀地關聯 Prompt 和映射配置

---

## 架構設計

### UI 入口設計

```
/companies/[id]
├─ 總覽 Tab
├─ 規則 Tab      (現有)
├─ 格式 Tab      (新增) ← 文件格式管理
├─ 統計 Tab
└─ 文件 Tab
```

### 格式詳情頁結構

```
/companies/[id]/formats/[formatId]
├─ 基本資訊 Tab    - 名稱、類型、子類型
├─ 識別規則 Tab    - Logo、關鍵字、版面特徵
├─ 常見術語 Tab    - 術語列表（可編輯）
├─ 專屬配置 Tab    - 關聯的 Prompt 和映射規則
└─ 文件列表 Tab    - 屬於此格式的文件
```

### 數據流設計

```
文件上傳
    ↓
GPT Vision 初步識別
    ↓
【識別規則匹配】 ← 新功能
├─ 遍歷該公司的所有格式
├─ 按 priority 排序
├─ 匹配 keywords + logoPatterns
├─ 計算匹配分數
    ↓
├─ 如果找到高信心度匹配 → 使用該格式
├─ 如果找到低信心度匹配 → 標記需審核
└─ 如果未找到 → 使用 GPT Vision 結果創建新格式
    ↓
應用格式專屬配置
├─ PromptConfig (scope=FORMAT)
└─ FieldMappingConfig (scope=FORMAT)
    ↓
執行提取
```

---

## 與其他 Epic 的關係

| Epic | 關係 | 說明 |
|------|------|------|
| **Epic 0** | 上游 | 使用 Epic 0 建立的 DocumentFormat 模型 |
| **Epic 13** | 互補 | Epic 13 處理欄位映射，Epic 16 處理格式管理 |
| **Epic 14** | 互補 | Epic 14 處理 Prompt 配置，Epic 16 提供 FORMAT 級配置關聯 |
| **Epic 15** | 下游 | Epic 15 的統一處理流程會使用 Epic 16 的識別規則 |

---

## Stories 列表

| Story ID | 標題 | 估點 | 狀態 |
|----------|------|------|------|
| 16-1 | 格式列表 Tab | 5 | backlog |
| 16-2 | 格式詳情與編輯 | 5 | backlog |
| 16-3 | 識別規則配置 | 8 | backlog |
| 16-4 | 專屬配置關聯 | 5 | backlog |

**總估點**: 23 點

---

## Story 摘要

### Story 16-1: 格式列表 Tab

在公司詳情頁新增「格式」Tab，顯示該公司所有已識別的文件格式。

**關鍵產出**:
- `FormatList` 組件
- `FormatCard` 組件
- 篩選和排序功能

### Story 16-2: 格式詳情與編輯

建立格式詳情頁面，支援查看和編輯格式基本信息。

**關鍵產出**:
- `FormatDetailView` 組件
- `FormatForm` 組件
- `GET/PATCH /api/v1/formats/[id]` API

### Story 16-3: 識別規則配置

新增可配置的格式識別規則，支援 Logo、關鍵字、版面特徵。

**關鍵產出**:
- Prisma 欄位: `identificationRules`
- `IdentificationRulesEditor` 組件
- 識別邏輯整合

### Story 16-4: 專屬配置關聯

在格式頁面顯示和管理關聯的 Prompt 和映射配置。

**關鍵產出**:
- `FormatConfigPanel` 組件
- `LinkedPromptConfig` 組件
- `LinkedMappingConfig` 組件

---

## 技術重點

### 新增 Prisma 欄位

```prisma
model DocumentFormat {
  // ... 現有欄位

  // 新增：識別規則
  identificationRules   Json?   @map("identification_rules")
  // 結構:
  // {
  //   logoPatterns: [{ position: "top-left", description: "DHL Logo" }],
  //   keywords: ["Ocean Freight", "B/L No", "Shipper"],
  //   layoutHints: "表格式發票，表頭包含公司資訊",
  //   priority: 100  // 識別優先級
  // }
}
```

### 新增 API

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/v1/formats/[id]` | 詳情（需新增） |
| `PATCH` | `/api/v1/formats/[id]` | 更新（需新增） |
| `POST` | `/api/v1/formats` | 創建（需新增） |
| `DELETE` | `/api/v1/formats/[id]` | 刪除（需新增） |
| `GET` | `/api/v1/formats/[id]/files` | 文件（需新增） |
| `GET` | `/api/v1/formats/[id]/configs` | 關聯配置（需新增） |

### 組件結構

```
src/components/features/formats/
├── FormatList.tsx           # 格式列表
├── FormatCard.tsx           # 格式卡片
├── FormatDetailView.tsx     # 格式詳情視圖
├── FormatForm.tsx           # 格式表單（創建/編輯）
├── FormatBasicInfo.tsx      # 基本資訊 Tab
├── FormatTermsTable.tsx     # 常見術語表格
├── IdentificationRulesEditor.tsx  # 識別規則編輯器
├── FormatConfigPanel.tsx    # 專屬配置面板
├── LinkedPromptConfig.tsx   # 關聯的 Prompt 配置
├── LinkedMappingConfig.tsx  # 關聯的映射配置
└── FormatFilesTable.tsx     # 文件列表表格
```

---

## 驗收標準

### 功能驗收
- [ ] `/companies/[id]` 頁面有「格式」Tab
- [ ] 能查看公司的所有格式
- [ ] 能編輯格式名稱
- [ ] 能配置識別規則
- [ ] 能查看關聯的配置

### 技術驗收
- [ ] 所有 API 返回正確的響應格式
- [ ] 識別規則影響格式匹配流程
- [ ] 組件通過 TypeScript 類型檢查
- [ ] 通過 ESLint 檢查

---

**建立日期**: 2026-01-12
**狀態**: 規劃中
