# Story 13-7: Field Mapping 後台管理頁面

## Story

**As a** 系統管理員
**I want** 一個專屬的後台頁面來管理三層欄位映射規則
**So that** 我可以直觀地配置 GLOBAL/COMPANY/FORMAT 三層級的映射設定

---

## Background / 背景說明

### 問題陳述

Epic 13 已完成 6 個 Story（13-1 至 13-6），實現了：
- **Story 13-1**: PDF 預覽與欄位高亮組件
- **Story 13-2**: 提取欄位面板
- **Story 13-3**: 映射配置 UI 組件（MappingConfigPanel, RuleEditor 等）
- **Story 13-4**: 映射配置 API（完整 CRUD 端點）
- **Story 13-5**: 動態欄位映射服務整合
- **Story 13-6**: 文件預覽整合測試頁面

然而，雖然前端組件和 API 端點都已完成，**缺少一個獨立的後台管理頁面**讓管理員直接管理三層映射配置。目前只能在測試頁面（/admin/document-preview-test）中使用 MappingConfigPanel。

### 業務價值

1. **獨立管理介面**: 提供專門的配置管理入口
2. **完整 CRUD 操作**: 列表查看、新增、編輯、刪除配置
3. **三層級支援**: 完整支援 GLOBAL → COMPANY → FORMAT 優先級
4. **用戶體驗**: 無需進入測試頁面即可管理配置

### 範圍定義

| 包含 | 不包含 |
|------|--------|
| 後台管理頁面（列表/新增/編輯） | 修改現有 API 邏輯 |
| React Query Hooks 整合 | 修改現有 UI 組件 |
| 使用現有 MappingConfigPanel 組件 | 新增映射轉換類型 |
| 配置列表篩選功能 | 權限細粒度控制 |

---

## Acceptance Criteria / 驗收標準

### AC1: 頁面路由與權限
- [ ] 頁面路徑為 `/admin/field-mapping-configs`
- [ ] 僅限 ADMIN 角色可訪問
- [ ] 頁面標題顯示「欄位映射配置管理」
- [ ] 包含返回管理後台的導航連結

### AC2: 配置列表頁
- [ ] 顯示所有映射配置（表格形式）
- [ ] 顯示欄位：名稱、範圍、公司、格式、規則數、狀態、更新時間
- [ ] 支援篩選：範圍(GLOBAL/COMPANY/FORMAT)、公司、格式、狀態
- [ ] 支援搜尋（名稱、描述）
- [ ] 每行提供操作按鈕：編輯、刪除

### AC3: 新增配置頁
- [ ] 頁面路徑為 `/admin/field-mapping-configs/new`
- [ ] 使用現有 `MappingConfigPanel` 組件
- [ ] 支援選擇配置範圍（GLOBAL/COMPANY/FORMAT）
- [ ] 支援新增多條映射規則
- [ ] 保存成功後導航回列表頁

### AC4: 編輯配置頁
- [ ] 頁面路徑為 `/admin/field-mapping-configs/[id]`
- [ ] 載入並顯示現有配置資料
- [ ] 使用現有 `MappingConfigPanel` 組件
- [ ] 支援規則的新增、編輯、刪除、排序
- [ ] 支援版本控制（樂觀鎖）
- [ ] 保存成功後導航回列表頁

### AC5: 刪除功能
- [ ] 點擊刪除按鈕顯示確認對話框
- [ ] 確認後調用 DELETE API
- [ ] 刪除成功後刷新列表
- [ ] 顯示適當的成功/錯誤提示

### AC6: 操作反饋
- [ ] 新增/編輯/刪除成功顯示 toast 提示
- [ ] 錯誤時顯示錯誤訊息
- [ ] 載入中顯示載入狀態

### AC7: React Query 整合
- [ ] 使用 React Query 管理伺服器狀態
- [ ] 支援樂觀更新
- [ ] 支援錯誤重試
- [ ] 正確處理快取失效

---

## Tasks / 開發任務

### Task 1: React Query Hooks [3 pts]

#### Subtask 1.1: 建立 Hooks 文件
- 建立 `src/hooks/use-field-mapping-configs.ts`
- 參考 `use-prompt-configs.ts` 結構

#### Subtask 1.2: 查詢 Hooks
- `useFieldMappingConfigs(params)` - 配置列表
- `useFieldMappingConfig(id)` - 單一配置詳情
- `useCompaniesForFieldMapping()` - 公司選項
- `useDocumentFormatsForFieldMapping(companyId)` - 格式選項

#### Subtask 1.3: 變更 Hooks
- `useCreateFieldMappingConfig()` - 建立配置
- `useUpdateFieldMappingConfig()` - 更新配置
- `useDeleteFieldMappingConfig()` - 刪除配置

#### Subtask 1.4: 規則 Hooks
- `useCreateFieldMappingRule(configId)` - 建立規則
- `useUpdateFieldMappingRule(configId)` - 更新規則
- `useDeleteFieldMappingRule(configId)` - 刪除規則
- `useReorderFieldMappingRules(configId)` - 重排序規則

### Task 2: 列表頁 [3 pts]

#### Subtask 2.1: 建立頁面路由
- 建立 `src/app/(dashboard)/admin/field-mapping-configs/page.tsx`
- 配置 ADMIN 角色權限檢查
- 設置頁面 metadata

#### Subtask 2.2: 配置列表表格
- 使用 shadcn/ui Table 組件
- 顯示配置資訊和操作按鈕
- 整合分頁功能

#### Subtask 2.3: 篩選功能
- 範圍篩選（GLOBAL/COMPANY/FORMAT）
- 公司/格式篩選
- 狀態篩選
- 搜尋功能

### Task 3: 新增頁 [2 pts]

#### Subtask 3.1: 建立頁面路由
- 建立 `src/app/(dashboard)/admin/field-mapping-configs/new/page.tsx`
- 配置權限檢查

#### Subtask 3.2: 整合 MappingConfigPanel
- 使用現有組件進行配置編輯
- 處理保存邏輯（創建配置 + 批量創建規則）

### Task 4: 編輯頁 [3 pts]

#### Subtask 4.1: 建立頁面路由
- 建立 `src/app/(dashboard)/admin/field-mapping-configs/[id]/page.tsx`
- 配置權限檢查

#### Subtask 4.2: 數據載入與轉換
- 載入現有配置
- 轉換 API 格式為 UI 格式

#### Subtask 4.3: 規則同步邏輯
- 比較原有規則與新規則
- 分別處理新增、更新、刪除操作

### Task 5: 整合測試 [2 pts]

#### Subtask 5.1: 功能驗證
- 測試完整 CRUD 流程
- 測試三層範圍切換
- 測試規則排序

#### Subtask 5.2: 錯誤處理驗證
- 測試網路錯誤處理
- 測試版本衝突處理

---

## Story Points: 13

---

## Dev Notes / 開發備註

### 現有組件索引

```typescript
// 映射配置組件 (Story 13-3)
import {
  MappingConfigPanel,
  ConfigSelector,
  MappingRuleList,
  SortableRuleItem,
  RuleEditor,
  SourceFieldSelector,
  TargetFieldSelector,
  TransformConfigPanel,
  MappingPreview,
} from '@/components/features/mapping-config';

// 類型定義 (已存在)
import type {
  FieldMappingConfig,
  FieldMappingRule,
  ConfigScope,
  TransformType,
  VisualMappingConfig,
  VisualMappingRule,
} from '@/types/field-mapping';
```

### API 端點

| 端點 | 方法 | 用途 |
|------|------|------|
| `/api/v1/field-mapping-configs` | GET | 列表查詢 |
| `/api/v1/field-mapping-configs` | POST | 創建配置 |
| `/api/v1/field-mapping-configs/[id]` | GET | 單一配置 |
| `/api/v1/field-mapping-configs/[id]` | PATCH | 更新配置 |
| `/api/v1/field-mapping-configs/[id]` | DELETE | 刪除配置 |
| `/api/v1/field-mapping-configs/[id]/rules` | POST | 創建規則 |
| `/api/v1/field-mapping-configs/[id]/rules/[ruleId]` | PATCH | 更新規則 |
| `/api/v1/field-mapping-configs/[id]/rules/[ruleId]` | DELETE | 刪除規則 |
| `/api/v1/field-mapping-configs/[id]/rules/reorder` | POST | 規則排序 |
| `/api/v1/field-mapping-configs/[id]/test` | POST | 測試配置 |

### 頁面佈局參考

```
┌──────────────────────────────────────────────────────────────────┐
│ 欄位映射配置管理                           [新增配置] [重新整理] │
├──────────────────────────────────────────────────────────────────┤
│ 篩選: [範圍 ▼] [公司 ▼] [格式 ▼] [狀態 ▼]   [搜尋...        ]   │
├──────────────────────────────────────────────────────────────────┤
│ | 名稱        | 範圍   | 公司   | 規則數 | 狀態  | 操作        | │
│ |-------------|--------|--------|--------|-------|-------------|│
│ | Global基礎  | GLOBAL | -      | 5      | 啟用  | [編輯][刪除]| │
│ | DHL專用     | COMPANY| DHL    | 8      | 啟用  | [編輯][刪除]| │
│ | Invoice格式 | FORMAT | DHL    | 3      | 停用  | [編輯][刪除]| │
└──────────────────────────────────────────────────────────────────┘
```

### 數據格式轉換

```typescript
// API → UI 轉換
function transformToVisualConfig(apiData: FieldMappingConfigDTO): VisualMappingConfig {
  return {
    id: apiData.id,
    scope: apiData.scope as ConfigScope,
    companyId: apiData.companyId,
    formatId: apiData.documentFormatId,
    name: apiData.name,
    description: apiData.description,
    rules: apiData.rules.map(transformToVisualRule),
    isActive: apiData.isActive,
    version: apiData.version,
  };
}

// UI → API 轉換
function transformToApiPayload(visualConfig: VisualMappingConfig): CreatePayload {
  // ...
}
```

---

## UI/UX Design Notes

### 設計原則
1. **一致性**: 參考 prompt-configs 頁面的設計風格
2. **重用組件**: 最大化使用現有 MappingConfigPanel 組件
3. **清晰反饋**: 所有操作都有明確的成功/錯誤提示
4. **響應式**: 支援不同螢幕尺寸

### 互動流程
1. 進入列表頁 → 查看所有配置
2. 點擊「新增配置」→ 進入新增頁
3. 配置範圍和規則 → 保存
4. 點擊「編輯」→ 進入編輯頁
5. 修改配置 → 保存
6. 點擊「刪除」→ 確認對話框 → 刪除

---

## Dependencies / 依賴

### 前置 Story
- [x] Story 13-3: 映射配置 UI 組件
- [x] Story 13-4: 映射配置 API
- [x] Story 13-5: 動態欄位映射服務整合

### 技術依賴
- @tanstack/react-query (已安裝)
- @dnd-kit/core (已安裝)
- shadcn/ui (已安裝)
- zustand (已安裝)

---

## Metadata

| 項目 | 值 |
|------|-----|
| Epic | Epic 13 - 文件預覽與欄位映射配置介面 |
| Story ID | 13-7 |
| 優先級 | P1 (High) |
| Story Points | 13 |
| 預估工時 | 2-3 天 |
| 狀態 | Done |
| 建立日期 | 2026-01-07 |
| 作者 | Development Team |
