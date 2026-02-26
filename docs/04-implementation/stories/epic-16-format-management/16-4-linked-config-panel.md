# Story 16.4: 專屬配置關聯

**Status:** done

---

## Story

**As a** 系統管理員,
**I want** 直接在格式頁面查看和配置專屬的 Prompt 和映射規則,
**So that** 我可以方便地管理格式的提取配置。

---

## 背景說明

### 問題陳述

目前系統支援 FORMAT 級別的 Prompt 和 FieldMappingConfig 配置，但：
- 在格式頁面無法直接查看關聯的配置
- 需要切換到其他頁面才能配置
- 配置與格式的關聯不直觀

### 解決方案

在格式詳情頁新增「專屬配置」Tab，顯示：
- 已關聯的 PromptConfig（scope=FORMAT）
- 已關聯的 FieldMappingConfig（scope=FORMAT）
- 快速創建/編輯入口

---

## Acceptance Criteria

### AC1: 專屬配置 Tab

**Given** 格式詳情頁
**When** 點擊「專屬配置」Tab
**Then**:
  - 顯示 Prompt 配置區塊
  - 顯示映射配置區塊
  - 顯示配置繼承關係說明

### AC2: Prompt 配置顯示

**Given** 專屬配置 Tab
**When** 查看 Prompt 配置區塊
**Then**:
  - 如果已有配置：顯示配置名稱、類型、狀態
  - 如果無配置：顯示「尚未配置」+ 創建按鈕

### AC3: 映射配置顯示

**Given** 專屬配置 Tab
**When** 查看映射配置區塊
**Then**:
  - 如果已有配置：顯示配置名稱、規則數量、狀態
  - 如果無配置：顯示「尚未配置」+ 創建按鈕

### AC4: 快速創建入口

**Given** 無專屬配置
**When** 點擊創建按鈕
**Then**:
  - 跳轉到對應的配置頁面
  - 預填格式信息（companyId, documentFormatId）

### AC5: 編輯入口

**Given** 已有專屬配置
**When** 點擊編輯按鈕
**Then**:
  - 跳轉到對應配置的編輯頁面

### AC6: 配置繼承說明

**Given** 專屬配置 Tab
**When** 查看繼承關係
**Then** 顯示：
  - FORMAT 配置優先級最高
  - 如無 FORMAT 配置，使用 COMPANY 配置
  - 如無 COMPANY 配置，使用 GLOBAL 配置

---

## Tasks / Subtasks

- [x] **Task 1: 新增 API 端點** (AC: #2, #3)
  - [x] 1.1 建立 `src/app/api/v1/formats/[id]/configs/route.ts`
  - [x] 1.2 實現 GET 方法：返回關聯的 Prompt 和 Mapping 配置
  - [x] 1.3 更新服務層

- [x] **Task 2: 建立專屬配置面板** (AC: #1)
  - [x] 2.1 建立 `src/components/features/formats/FormatConfigPanel.tsx`
  - [x] 2.2 實現面板佈局

- [x] **Task 3: 建立 Prompt 配置卡片** (AC: #2, #4, #5)
  - [x] 3.1 建立 `src/components/features/formats/LinkedPromptConfig.tsx`
  - [x] 3.2 實現已配置狀態 UI
  - [x] 3.3 實現未配置狀態 UI
  - [x] 3.4 實現創建/編輯按鈕

- [x] **Task 4: 建立映射配置卡片** (AC: #3, #4, #5)
  - [x] 4.1 建立 `src/components/features/formats/LinkedMappingConfig.tsx`
  - [x] 4.2 實現已配置狀態 UI
  - [x] 4.3 實現未配置狀態 UI
  - [x] 4.4 實現創建/編輯按鈕

- [x] **Task 5: 實現繼承說明** (AC: #6)
  - [x] 5.1 建立 `src/components/features/formats/ConfigInheritanceInfo.tsx`
  - [x] 5.2 實現視覺化繼承關係

- [x] **Task 6: 整合到格式詳情頁** (AC: #1)
  - [x] 6.1 新增「專屬配置」Tab
  - [x] 6.2 整合所有子組件

- [x] **Task 7: 驗證與測試** (AC: #1-6)
  - [x] 7.1 TypeScript 類型檢查通過
  - [x] 7.2 ESLint 檢查通過
  - [x] 7.3 API 功能測試
  - [x] 7.4 UI 功能驗證

---

## Dev Notes

### 依賴項

- **Story 16-2**: 格式詳情與編輯（基礎架構）
- **Epic 14**: PromptConfig（已存在）
- **Story 13-4**: FieldMappingConfig（已存在）

### API 設計

#### GET /api/v1/formats/[id]/configs

```typescript
// 響應
{
  success: true,
  data: {
    promptConfigs: [
      {
        id: string,
        name: string,
        promptType: PromptType,
        scope: 'FORMAT',
        isActive: boolean,
        updatedAt: Date
      }
    ],
    fieldMappingConfigs: [
      {
        id: string,
        name: string,
        scope: 'FORMAT',
        rulesCount: number,
        isActive: boolean,
        updatedAt: Date
      }
    ],
    inheritance: {
      hasFormatConfig: boolean,
      hasCompanyConfig: boolean,
      hasGlobalConfig: boolean,
      effectiveLevel: 'FORMAT' | 'COMPANY' | 'GLOBAL' | 'NONE'
    }
  }
}
```

### 組件結構

```
src/components/features/formats/
├── FormatConfigPanel.tsx       # 專屬配置面板
├── LinkedPromptConfig.tsx      # Prompt 配置卡片
├── LinkedMappingConfig.tsx     # 映射配置卡片
└── ConfigInheritanceInfo.tsx   # 繼承說明
```

### UI 參考

```
┌─────────────────────────────────────────────────────────────┐
│ 專屬配置                                                    │
├─────────────────────────────────────────────────────────────┤
│ 📌 配置優先級說明                                           │
│ FORMAT > COMPANY > GLOBAL                                   │
├─────────────────────────────────────────────────────────────┤
│ Prompt 配置                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✅ 欄位提取 Prompt                                       │ │
│ │ 類型: FIELD_EXTRACTION                                   │ │
│ │ 更新: 2026-01-10                    [查看] [編輯]       │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 映射配置                                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ❌ 尚未配置                                              │ │
│ │                                        [創建配置]       │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Notes

### 完成日期
2026-01-12

### 實現摘要
- **API 端點**: 建立 `GET /api/v1/formats/[id]/configs` 返回關聯配置和繼承資訊
- **組件實現**:
  - `FormatConfigPanel.tsx` - 主面板，使用 React Query 獲取配置資料
  - `LinkedPromptConfig.tsx` - Prompt 配置卡片，支援創建/編輯跳轉
  - `LinkedMappingConfig.tsx` - 映射配置卡片，支援創建/編輯跳轉
  - `ConfigInheritanceInfo.tsx` - 配置優先級說明
- **整合**: FormatDetailView 新增「專屬配置」Tab

### 技術決策
1. 使用並行查詢（Promise.all）獲取各層級配置以提升效能
2. 創建按鈕跳轉時預填 scope=FORMAT、companyId、documentFormatId
3. 繼承說明使用 Badge 視覺化不同層級

### 文件結構
```
src/
├── app/api/v1/formats/[id]/
│   └── configs/
│       └── route.ts              # 新增
├── components/features/formats/
│   ├── FormatConfigPanel.tsx     # 新增
│   ├── LinkedPromptConfig.tsx    # 新增
│   ├── LinkedMappingConfig.tsx   # 新增
│   ├── ConfigInheritanceInfo.tsx # 新增
│   └── FormatDetailView.tsx      # 更新（新增 Tab）
```

---

## Related Files

- `src/services/prompt-resolver.service.ts` - 參考
- `src/types/prompt-config.ts` - 類型定義
- `src/types/field-mapping.ts` - 類型定義
