# CHANGE-036: 專案詳情頁欄位增強

> **建立日期**: 2025-12-18
> **完成日期**: 2025-12-18
> **狀態**: ✅ 已完成
> **優先級**: Medium
> **類型**: 現有功能增強

## 1. 變更概述

專案模型在 FEAT-001、FEAT-006、FEAT-010 中新增了多個欄位，這些欄位已在專案編輯頁 (`/projects/[id]/edit`) 中實現，但專案詳情頁 (`/projects/[id]`) 尚未顯示這些新欄位。

**目標**: 在專案詳情頁中展示所有新增欄位的資訊，讓用戶無需進入編輯模式即可查看完整專案資訊。

## 2. 現況分析

### 編輯頁已有欄位 (ProjectForm)

| 欄位分組 | 欄位名稱 | 來源 | 詳情頁狀態 |
|----------|----------|------|------------|
| **基本資訊** | id, name, description | 原始 | ✅ 已顯示 |
| | budgetPoolId | 原始 | ✅ 已顯示 |
| | managerId, supervisorId | 原始 | ✅ 已顯示 |
| | startDate, endDate | 原始 | ✅ 已顯示 |
| | status | 原始 | ✅ 已顯示 |
| **FEAT-001 欄位** | projectCode | FEAT-001 | ✅ 已顯示 |
| | globalFlag | FEAT-001 | ✅ 已顯示 |
| | priority | FEAT-001 | ✅ 已顯示 |
| | currencyId | FEAT-001 | ✅ 已顯示 |
| **FEAT-006 欄位** | projectCategory | FEAT-006 | ❌ 缺少 |
| | projectType | FEAT-006 | ❌ 缺少 |
| | expenseType | FEAT-006 | ❌ 缺少 |
| | chargeBackToOpCo | FEAT-006 | ❌ 缺少 |
| | chargeOutOpCoIds | FEAT-006 | ❌ 缺少 |
| | chargeOutMethod | FEAT-006 | ❌ 缺少 |
| | probability | FEAT-006 | ❌ 缺少 |
| | team | FEAT-006 | ❌ 缺少 |
| | personInCharge | FEAT-006 | ❌ 缺少 |
| **FEAT-010 欄位** | isCdoReviewRequired | FEAT-010 | ❌ 缺少 |
| | isManagerConfirmed | FEAT-010 | ❌ 缺少 |
| | payForWhat | FEAT-010 | ❌ 缺少 |
| | payToWhom | FEAT-010 | ❌ 缺少 |
| | fiscalYear | FEAT-010 | ❌ 缺少 |

### 缺少的欄位總計: 14 個

## 3. UI/UX 設計

### 建議佈局方案

將新欄位組織成 **分組卡片** 形式，保持與現有頁面風格一致：

```
┌─────────────────────────────────────────────────────────────┐
│ 專案詳情頁                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─── 基本資訊 ─────────────────────────────────────────────┐│
│ │ 專案名稱 | 專案代碼 | 全球標識 | 優先級 | 幣別 | 狀態   ││
│ │ 預算池   | 專案經理 | 主管     | 開始日期 | 結束日期    ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─── 專案分類 (FEAT-006) ──────────────────────────────────┐│
│ │ 專案類別  | 專案類型  | 費用類型  | 機率                 ││
│ │ Category  | Type      | Expense   | Probability          ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─── 費用分攤 (FEAT-006) ──────────────────────────────────┐│
│ │ 分攤至營運公司 | 分攤方式  | 分攤對象                    ││
│ │ ChargeBack     | Method    | OpCo List                   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─── 團隊資訊 (FEAT-006) ──────────────────────────────────┐│
│ │ 團隊        | 負責人                                     ││
│ │ Team        | Person In Charge                           ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─── 審核與財務 (FEAT-010) ────────────────────────────────┐│
│ │ CDO 審核  | 經理確認  | 會計年度                         ││
│ │ Required  | Confirmed | Fiscal Year                      ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─── 付款資訊 (FEAT-010) ──────────────────────────────────┐│
│ │ 付款目的 (Pay For What)                                  ││
│ │ 付款對象 (Pay To Whom)                                   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                             │
│ [其他現有區塊: 提案、採購單、費用等...]                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 欄位顯示規則

| 欄位類型 | 顯示方式 |
|----------|----------|
| Boolean (`isCdoReviewRequired`, `isManagerConfirmed`) | Badge (是/否 或 ✓/✗) |
| Enum (`projectCategory`, `projectType`, etc.) | Badge 或純文字 |
| 數字 (`probability`) | 百分比格式 (如 "75%") |
| 文字 (`team`, `personInCharge`, `payForWhat`, `payToWhom`) | 純文字，空值顯示 "-" |
| 關聯 (`chargeOutOpCoIds`) | 列表或 Badge 群組 |

### 響應式考量

- **桌面**: 2-4 列網格佈局
- **平板**: 2 列網格佈局
- **手機**: 單列堆疊佈局

## 4. 技術設計

### 修改的檔案

1. **`apps/web/src/app/[locale]/projects/[id]/page.tsx`**
   - 新增欄位顯示區塊
   - 新增分組卡片
   - 確保 API 回傳所有需要的欄位

2. **翻譯檔案** (如需要)
   - `apps/web/src/messages/en.json`
   - `apps/web/src/messages/zh-TW.json`
   - 新增欄位標籤翻譯 (部分可能已存在於 form 區塊)

### API 檢查

確認 `project.getById` 回傳的資料包含所有新欄位：
- `projectCategory`
- `projectType`
- `expenseType`
- `chargeBackToOpCo`
- `chargeOutOpCos` (關聯資料)
- `chargeOutMethod`
- `probability`
- `team`
- `personInCharge`
- `isCdoReviewRequired`
- `isManagerConfirmed`
- `payForWhat`
- `payToWhom`
- `fiscalYear`

### 程式碼範例

```tsx
{/* FEAT-006: 專案分類區塊 */}
<Card className="mt-6">
  <CardHeader>
    <CardTitle>{t('sections.projectClassification')}</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div>
        <dt className="text-sm font-medium text-muted-foreground">
          {t('fields.projectCategory')}
        </dt>
        <dd className="mt-1">
          {project.projectCategory ? (
            <Badge variant="outline">{project.projectCategory}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </dd>
      </div>
      {/* ... 其他欄位 */}
    </div>
  </CardContent>
</Card>

{/* FEAT-010: 審核與財務區塊 */}
<Card className="mt-6">
  <CardHeader>
    <CardTitle>{t('sections.reviewAndFinance')}</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div>
        <dt className="text-sm font-medium text-muted-foreground">
          {t('fields.isCdoReviewRequired')}
        </dt>
        <dd className="mt-1">
          <Badge variant={project.isCdoReviewRequired ? 'default' : 'secondary'}>
            {project.isCdoReviewRequired ? t('common.yes') : t('common.no')}
          </Badge>
        </dd>
      </div>
      {/* ... 其他欄位 */}
    </div>
  </CardContent>
</Card>
```

## 5. 影響範圍

- **頁面**: `apps/web/src/app/[locale]/projects/[id]/page.tsx`
- **翻譯**: 可能需要新增 section 標題翻譯
- **API**: 無需修改（已包含所有欄位）
- **風險**: 低（純前端顯示增強）

## 6. 驗收標準

- [x] 專案詳情頁顯示所有 FEAT-006 欄位
- [x] 專案詳情頁顯示所有 FEAT-010 欄位
- [x] 空值欄位顯示 "-" 或適當的佔位符
- [x] Boolean 欄位以 Badge 形式顯示
- [x] 分攤對象顯示營運公司名稱列表
- [x] 機率以 Badge 格式顯示（含翻譯）
- [x] 響應式佈局使用 grid-cols-2/grid-cols-3
- [x] 翻譯使用現有 form fields 翻譯 key

## 7. 實施計劃

| 階段 | 任務 | 預估時間 |
|------|------|----------|
| 1 | 確認 API 資料結構 | 15 分鐘 |
| 2 | 新增分組卡片結構 | 30 分鐘 |
| 3 | 實現所有欄位顯示 | 60 分鐘 |
| 4 | 新增/確認翻譯 key | 20 分鐘 |
| 5 | 響應式調整和測試 | 30 分鐘 |
| **總計** | | **2.5 小時** |

## 8. 相關文檔

- FEAT-001: 專案欄位擴展
- FEAT-006: Project Summary Tab
- FEAT-010: Project 數據導入
- `apps/web/src/app/[locale]/projects/[id]/edit/page.tsx` - 編輯頁參考

## 9. 設計決策待確認

### Q1: 欄位分組方式
**選項**:
- A) 按功能特性分組（如上述設計）
- B) 按來源 Feature 分組 (FEAT-006 / FEAT-010)
- C) 全部放在同一個區塊

**建議**: A) 按功能特性分組 - 更符合用戶認知

### Q2: 空值處理
**選項**:
- A) 顯示 "-"
- B) 完全隱藏空值欄位
- C) 顯示 "未設定"

**建議**: A) 顯示 "-" - 保持佈局一致性

### Q3: 卡片位置
**選項**:
- A) 放在現有「基本資訊」卡片下方（如上述設計）
- B) 與基本資訊合併成一個大卡片
- C) 放在頁面側邊欄

**建議**: A) 放在下方 - 保持清晰的視覺層級

---

## 10. 實施記錄

### 10.1 完成日期
2025-12-18

### 10.2 實施內容

#### 修改的檔案
1. **`apps/web/src/app/[locale]/projects/[id]/page.tsx`**
   - 第 90 行：添加 `tForm = useTranslations('projects.form')` 翻譯命名空間
   - 第 566-722 行：新增 5 個 Card 區塊，顯示 14 個欄位

2. **`apps/web/src/messages/zh-TW.json`**
   - 添加 `common.yes: "是"` 和 `common.no: "否"` 翻譯

3. **`apps/web/src/messages/en.json`**
   - 添加 `common.yes: "Yes"` 和 `common.no: "No"` 翻譯

#### 新增 Card 區塊

| 區塊 | 翻譯 Key | 欄位 |
|------|----------|------|
| 專案分類 | `projects.detail.projectClassification` | projectCategory, projectType, expenseType, probability |
| 費用分攤資訊 | `projects.detail.chargeOutInfo` | chargeBackToOpCo, chargeOutMethod, chargeOutOpCos |
| 團隊資訊 | `projects.detail.projectTeam` | team, personInCharge |
| 審核與財務 | `projects.detail.reviewAndFinance` | isCdoReviewRequired, isManagerConfirmed, fiscalYear |
| 付款資訊 | `projects.detail.paymentInfo` | payForWhat, payToWhom |

#### 欄位顯示處理

- **Boolean 欄位** (`chargeBackToOpCo`, `isCdoReviewRequired`, `isManagerConfirmed`): 使用 Badge 顯示「是/否」
- **Enum 欄位** (`projectType`, `expenseType`, `probability`): 使用翻譯 key 顯示本地化值
- **關聯欄位** (`chargeOutOpCos`): 使用 Badge 群組顯示營運公司 code + name
- **文字欄位**: 空值顯示 "-"

### 10.3 驗證結果

- ✅ TypeScript 編譯通過（無新增錯誤）
- ✅ i18n 驗證通過（2601 keys）
- ✅ 所有 14 個欄位已正確顯示在專案詳情頁

### 10.4 技術細節

**chargeOutOpCos 資料結構處理**:
```typescript
// Prisma 關聯返回結構：{ opCo: { id, code, name } }[]
{project.chargeOutOpCos.map((item) => (
  <Badge key={item.opCo.id} variant="secondary">
    {item.opCo.code} - {item.opCo.name}
  </Badge>
))}
```

### 10.5 設計決策

- **欄位分組方式**: 採用選項 A - 按功能特性分組
- **空值處理**: 採用選項 A - 顯示 "-"
- **卡片位置**: 採用選項 A - 放在現有「基本資訊」卡片下方
