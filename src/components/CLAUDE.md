# Components 目錄 - React 組件庫

> **組件數量**: 250+ 組件文件
> **最後更新**: 2026-01-18
> **版本**: 1.2.0

---

## 概述

本目錄包含所有 React 組件，採用 Next.js 15 App Router 架構。組件層遵循以下原則：
- **組件分層**: UI 基礎組件 → 功能組件 → 頁面組件
- **Client/Server 分離**: 明確區分客戶端和伺服器組件
- **狀態管理**: Zustand (UI) + React Query (Server State)
- **樣式系統**: Tailwind CSS + shadcn/ui

---

## 目錄結構

```
src/components/
├── ui/                 # shadcn/ui 基礎組件（35 個，不可修改）
├── features/           # 功能性業務組件（26 個子目錄）
├── layouts/            # 頁面佈局組件
├── layout/             # 通用佈局元件
├── admin/              # 管理員專用組件
├── analytics/          # 分析相關組件
├── audit/              # 審計相關組件
├── auth/               # 認證相關組件
├── dashboard/          # 儀表板組件
├── export/             # 匯出功能組件
├── filters/            # 篩選器組件
└── reports/            # 報表組件
```

---

## 組件分類

### 1. UI 基礎組件 (shadcn/ui)

> **重要**: 這些組件由 shadcn/ui CLI 生成，**不可直接修改**。如需自定義，請在 `features/` 建立包裝組件。

| 組件 | 說明 |
|------|------|
| `accordion.tsx` | 手風琴展開/收合 |
| `alert.tsx` | 警示訊息 |
| `alert-dialog.tsx` | 確認對話框 |
| `avatar.tsx` | 用戶頭像 |
| `badge.tsx` | 標籤徽章 |
| `button.tsx` | 按鈕 |
| `calendar.tsx` | 日曆選擇器 |
| `card.tsx` | 卡片容器 |
| `checkbox.tsx` | 核取方塊 |
| `collapsible.tsx` | 可收合區塊 |
| `command.tsx` | 命令選單 |
| `dialog.tsx` | 模態對話框 |
| `dropdown-menu.tsx` | 下拉選單 |
| `form.tsx` | 表單容器（React Hook Form 整合）|
| `input.tsx` | 輸入框 |
| `label.tsx` | 標籤 |
| `month-picker.tsx` | 月份選擇器 |
| `pagination.tsx` | 分頁 |
| `popover.tsx` | 彈出框 |
| `progress.tsx` | 進度條 |
| `radio-group.tsx` | 單選群組 |
| `resizable.tsx` | 可調整大小面板 |
| `scroll-area.tsx` | 捲動區域 |
| `select.tsx` | 下拉選擇 |
| `separator.tsx` | 分隔線 |
| `skeleton.tsx` | 載入骨架 |
| `slider.tsx` | 滑桿 |
| `switch.tsx` | 開關 |
| `table.tsx` | 表格 |
| `tabs.tsx` | 頁籤 |
| `textarea.tsx` | 多行輸入 |
| `toast.tsx` | 通知提示 |
| `toaster.tsx` | Toast 容器 |
| `tooltip.tsx` | 工具提示 |

### 2. 功能組件 (Features)

#### 2.1 管理員組件 (`features/admin/`) - Epic 1, 12

| 子目錄 | 說明 | 組件 |
|--------|------|------|
| `alerts/` | 警報管理 | AlertDashboard, AlertHistory, AlertRuleManagement |
| `api-keys/` | API 金鑰 | ApiKeyManagement, ApiKeyTable, CreateApiKeyDialog |
| `backup/` | 備份管理 | BackupList, BackupManagement, BackupScheduleList |
| `config/` | 系統配置 | ConfigEditDialog, ConfigHistoryDialog, ConfigManagement |
| `logs/` | 日誌檢視 | LogViewer, LogDetailDialog, LogStreamPanel |
| `monitoring/` | 健康監控 | HealthDashboard |
| `restore/` | 還原管理 | RestoreList, RestoreDialog, RestoreManagement |
| `roles/` | 角色管理 | RoleList, AddRoleDialog, PermissionSelector |
| - | 用戶管理 | UserList, UserTable, UserFilters, AddUserDialog |

#### 2.2 審計組件 (`features/audit/`) - Epic 8

| 組件 | 說明 |
|------|------|
| `AuditReportExportDialog.tsx` | 審計報表匯出 |
| `AuditReportJobList.tsx` | 審計任務列表 |
| `ReportIntegrityDialog.tsx` | 報表完整性驗證 |

#### 2.3 公司組件 (`features/companies/`) - Epic 5

| 組件 | 說明 |
|------|------|
| `CompanyForm.tsx` | 公司表單 |
| `CompanyTable.tsx` | 公司列表 |
| `CompanyMappingEditor.tsx` | 公司映射編輯器 |
| `DetectCompanyDialog.tsx` | 公司識別對話框 |

> **注意**: 因 REFACTOR-001，原 forwarders 組件已逐步遷移至 companies

#### 2.4 信心度組件 (`features/confidence/`) - Epic 2

| 組件 | 說明 |
|------|------|
| `ConfidenceBadge.tsx` | 信心度徽章（顏色編碼）|
| `ConfidenceBreakdown.tsx` | 信心度分解詳情 |
| `ConfidenceIndicator.tsx` | 信心度指示器 |

#### 2.5 文件來源組件 (`features/document-source/`) - Epic 9

| 組件 | 說明 |
|------|------|
| `DocumentSourceBadge.tsx` | 來源徽章（Manual/Outlook/SharePoint）|
| `DocumentSourceDetails.tsx` | 來源詳情 |
| `SourceTypeFilter.tsx` | 來源類型篩選 |
| `SourceTypeStats.tsx` | 來源統計 |
| `SourceTypeTrend.tsx` | 來源趨勢圖 |

#### 2.6 升級組件 (`features/escalation/`) - Epic 3

| 組件 | 說明 |
|------|------|
| `EscalationFilters.tsx` | 升級篩選器 |
| `EscalationStatusBadge.tsx` | 升級狀態徽章 |
| `ResolveDialog.tsx` | 解決升級對話框 |

#### 2.7 格式分析組件 (`features/format-analysis/`) - Epic 0

| 組件 | 說明 |
|------|------|
| `FormatAnalysisPanel.tsx` | 格式分析面板 |
| `FormatDistributionChart.tsx` | 格式分布圖 |

#### 2.8 Forwarder 組件 (`features/forwarders/`) - Epic 5

| 組件 | 說明 |
|------|------|
| `ForwarderForm.tsx` | Forwarder 表單 |
| `ForwarderFilters.tsx` | Forwarder 篩選器 |
| `ForwarderRulesTable.tsx` | 規則表格 |
| `ForwarderStatsPanel.tsx` | 統計面板 |
| `LogoUploader.tsx` | Logo 上傳器 |

> **注意**: 向後兼容組件，新開發請使用 companies 組件

#### 2.9 全域組件 (`features/global/`) - Epic 6, 7

| 組件 | 說明 |
|------|------|
| `CityRankings.tsx` | 城市排名 |
| `GlobalStats.tsx` | 全域統計 |
| `GlobalTrend.tsx` | 全域趨勢 |
| `RegionView.tsx` | 區域檢視 |

#### 2.10 歷史組件 (`features/history/`) - Epic 8

| 組件 | 說明 |
|------|------|
| `ChangeHistoryTimeline.tsx` | 變更歷史時間軸 |
| `HistoryVersionCompareDialog.tsx` | 版本比較對話框 |

#### 2.11 歷史數據組件 (`features/historical-data/`) - Epic 0

| 組件 | 說明 |
|------|------|
| `BatchUploadPanel.tsx` | 批次上傳面板 |
| `BatchProgressTracker.tsx` | 批次進度追蹤 |
| `TermAggregationView.tsx` | 術語聚合檢視 |

#### 2.12 發票組件 (`features/invoice/`) - Epic 2

| 組件 | 說明 |
|------|------|
| `FileUploader.tsx` | 文件上傳器（拖放支援）|
| `InvoiceListTable.tsx` | 發票列表表格 |
| `ProcessingStatus.tsx` | 處理狀態顯示 |
| `RetryButton.tsx` | 重試按鈕 |

#### 2.13 Outlook 組件 (`features/outlook/`) - Epic 9

| 組件 | 說明 |
|------|------|
| `OutlookConfigForm.tsx` | Outlook 配置表單 |
| `OutlookConfigList.tsx` | 配置列表 |
| `OutlookFilterRulesEditor.tsx` | 過濾規則編輯器 |

#### 2.14 報表組件 (`features/reports/`) - Epic 7

| 組件 | 說明 |
|------|------|
| `AiCostCard.tsx` | AI 成本卡片 |
| `CityCostTable.tsx` | 城市成本表格 |
| `CostAnomalyDialog.tsx` | 成本異常對話框 |

#### 2.15 資料保留組件 (`features/retention/`) - Epic 12

| 組件 | 說明 |
|------|------|
| `ArchiveRecordList.tsx` | 歸檔記錄列表 |
| `RetentionPolicyEditor.tsx` | 保留策略編輯器 |

#### 2.16 審核組件 (`features/review/`) - Epic 3

| 組件 | 說明 |
|------|------|
| `ReviewQueue.tsx` | 審核隊列 |
| `ReviewDetailPanel.tsx` | 審核詳情面板 |
| `ApproveRejectButtons.tsx` | 批准/拒絕按鈕 |
| `FieldCorrectionForm.tsx` | 欄位修正表單 |

#### 2.17 規則組件 (`features/rules/`) - Epic 4

| 組件 | 說明 |
|------|------|
| `RuleEditor.tsx` | 規則編輯器 |
| `RuleTestPanel.tsx` | 規則測試面板 |
| `ImpactAnalysisView.tsx` | 影響分析檢視 |
| `RuleAccuracyChart.tsx` | 規則準確度圖表 |

#### 2.18 規則審核組件 (`features/rule-review/`) - Epic 4

| 組件 | 說明 |
|------|------|
| `RuleSuggestionList.tsx` | 規則建議列表 |
| `RuleSuggestionDetail.tsx` | 建議詳情 |
| `ApprovalWorkflow.tsx` | 審批工作流 |

#### 2.19 規則版本組件 (`features/rule-version/`) - Epic 4

| 組件 | 說明 |
|------|------|
| `RuleVersionHistory.tsx` | 規則版本歷史 |
| `VersionDiffViewer.tsx` | 版本差異檢視器 |

#### 2.20 SharePoint 組件 (`features/sharepoint/`) - Epic 9

| 組件 | 說明 |
|------|------|
| `SharePointConfigForm.tsx` | SharePoint 配置表單 |
| `SharePointConfigList.tsx` | 配置列表 |

#### 2.21 建議組件 (`features/suggestions/`) - Epic 4

| 組件 | 說明 |
|------|------|
| `SuggestionCard.tsx` | 建議卡片 |
| `SuggestionSimulator.tsx` | 建議模擬器 |

#### 2.22 術語分析組件 (`features/term-analysis/`) - Epic 0

| 組件 | 說明 |
|------|------|
| `TermAggregationPanel.tsx` | 術語聚合面板 |
| `TermClassificationView.tsx` | 術語分類檢視 |
| `HierarchicalTermTree.tsx` | 階層術語樹 |

#### 2.23 API 文檔組件 (`features/docs/`) - Epic 11

| 組件 | 說明 |
|------|------|
| `CodeBlock.tsx` | 代碼區塊 |
| `LanguageTabs.tsx` | 語言切換頁籤 |
| `SDKExamplesContent.tsx` | SDK 範例內容 |
| `SwaggerUIWrapper.tsx` | Swagger UI 包裝器 |

#### 2.24 文件預覽組件 (`features/document-preview/`) - Epic 13

**Story 13-1: PDF 預覽與欄位高亮**

| 組件 | 說明 |
|------|------|
| `PDFViewer.tsx` | PDF 預覽器主組件 (react-pdf 整合) |
| `DynamicPDFViewer.tsx` | SSR 安全的動態載入版本 |
| `PDFControls.tsx` | 導航和縮放控制工具列 |
| `FieldHighlightOverlay.tsx` | 欄位高亮覆蓋層 (座標轉換 + 信心度色碼) |
| `PDFLoadingSkeleton.tsx` | 載入骨架屏 |
| `PDFErrorDisplay.tsx` | 錯誤顯示組件 |

**Story 13-2: 欄位提取結果面板**

| 組件 | 說明 |
|------|------|
| `FieldCard.tsx` | 欄位卡片組件 (內聯編輯、信心度色碼、來源標籤) |
| `FieldFilters.tsx` | 過濾器組件 (搜尋、篩選、排序控制) |
| `ExtractedFieldsPanel.tsx` | 欄位提取結果主面板 (統計、分組、過濾)

#### 2.25 國際化組件 (`features/locale/`) - Epic 17

> **Story 17-5**: 語言偏好設定

| 組件 | 說明 |
|------|------|
| `LocaleSwitcher.tsx` | 語言切換下拉選單（支援 en, zh-TW, zh-CN）|

**使用範例**:
```typescript
import { LocaleSwitcher } from '@/components/features/locale';

// 僅圖標模式
<LocaleSwitcher />

// 顯示語言名稱
<LocaleSwitcher showLabel />
```

### 3. 佈局組件

#### 3.1 Layout (`layout/`)

| 組件 | 說明 |
|------|------|
| `Header.tsx` | 頁面標頭 |
| `Sidebar.tsx` | 側邊導航欄 |
| `MainLayout.tsx` | 主要佈局容器 |

#### 3.2 Layouts (`layouts/`)

| 組件 | 說明 |
|------|------|
| `DashboardLayout.tsx` | 儀表板佈局 |
| `AuthLayout.tsx` | 認證頁面佈局 |

### 4. 儀表板組件 (`dashboard/`) - Epic 7

| 組件 | 說明 |
|------|------|
| `DashboardStats.tsx` | 統計數據展示 |
| `DashboardFilters.tsx` | 儀表板篩選器 |
| `DateRangePicker.tsx` | 日期範圍選擇器 |
| `DateRangeQuickSelect.tsx` | 快速日期選擇 |
| `ForwarderComparisonChart.tsx` | Forwarder 比較圖表 |
| `StatCard.tsx` | 統計卡片 |

### 5. 認證組件 (`auth/`) - Epic 1

| 組件 | 說明 |
|------|------|
| `CityRestricted.tsx` | 城市存取限制 |

### 6. 分析組件 (`analytics/`) - Epic 7

| 組件 | 說明 |
|------|------|
| `CityComparison.tsx` | 城市比較分析 |

---

## 組件設計模式

### 標準組件結構

```typescript
'use client';  // 如果需要客戶端互動

/**
 * @fileoverview [組件功能描述]
 * @module src/components/features/[name]
 * @since Epic X - Story X.X
 */

import * as React from 'react';
// 1. React/Next.js imports
// 2. 第三方庫
// 3. 本地組件
// 4. Hooks
// 5. Utils
// 6. Types

// ============================================================
// Types
// ============================================================

interface ComponentProps {
  /** Prop 描述 */
  prop1: string;
  /** 可選 prop */
  prop2?: number;
}

// ============================================================
// Component
// ============================================================

/**
 * @component ComponentName
 * @description 組件描述
 */
export function ComponentName({ prop1, prop2 }: ComponentProps) {
  // --- Hooks ---
  const [state, setState] = React.useState();

  // --- Effects ---
  React.useEffect(() => {
    // ...
  }, []);

  // --- Handlers ---
  const handleClick = React.useCallback(() => {
    // ...
  }, []);

  // --- Render ---
  return (
    <div>...</div>
  );
}
```

### Server vs Client Components

```typescript
// Server Component（預設）- 數據獲取
// src/app/documents/page.tsx
import { prisma } from '@/lib/prisma';

export default async function DocumentsPage() {
  const documents = await prisma.document.findMany();
  return <DocumentList documents={documents} />;
}

// Client Component - 互動邏輯
// src/components/features/invoice/InvoiceListTable.tsx
'use client';

export function InvoiceListTable({ documents }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  // 互動邏輯...
}
```

### 狀態管理

```typescript
// UI 狀態 - Zustand
import { useUIStore } from '@/stores/ui-store';

// 伺服器狀態 - React Query
import { useDocuments } from '@/hooks/use-documents';

// 表單狀態 - React Hook Form + Zod
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
```

### 國際化（i18n）

> **完整規範**: 請參考 `.claude/rules/i18n.md`

```typescript
'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';

export function MyComponent() {
  const t = useTranslations('namespace');
  const locale = useLocale();

  return (
    <div>
      <h1>{t('title')}</h1>
      <Link href="/dashboard">Dashboard</Link>
    </div>
  );
}
```

**日期/數字格式化**:
```typescript
import { formatShortDate, formatRelativeTime } from '@/lib/i18n-date';
import { formatNumber, formatPercent } from '@/lib/i18n-number';

formatShortDate(date, locale);     // 2026/01/18
formatNumber(1234567, locale);     // 1,234,567
```

---

## 注意事項

### 必須遵守

- ❌ **不要修改** `src/components/ui/` 下的 shadcn 組件
- ✅ 如需自定義，在 `src/components/features/` 建立包裝組件
- ✅ 組件保持在 **300 行以內**
- ✅ 使用 `useMemo` / `useCallback` 優化性能
- ✅ 所有功能組件必須包含標準 JSDoc 頭部

### 樣式規範

```typescript
// 使用 cn() 合併類名
import { cn } from '@/lib/utils';

<Button
  className={cn(
    'base-styles',
    isActive && 'active-styles',
    className
  )}
/>
```

---

## 新增組件指南

1. **確定組件類型**: UI / Feature / Layout
2. **選擇正確目錄**: 根據功能領域選擇 features 子目錄
3. **建立組件文件**: 使用標準模板
4. **添加 JSDoc 註釋**: 包含 `@fileoverview`, `@module`, `@since`
5. **更新本文檔**: 將新組件加入對應分類表格

---

## 相關文檔

- [CLAUDE.md (根目錄)](../../CLAUDE.md) - 項目總指南
- [.claude/rules/components.md](../../.claude/rules/components.md) - 組件開發規範
- [.claude/rules/i18n.md](../../.claude/rules/i18n.md) - 國際化開發規範
- [src/hooks/CLAUDE.md](../hooks/CLAUDE.md) - 自定義 Hooks
- [src/stores/](../stores/) - Zustand 狀態管理
- [src/i18n/](../i18n/) - 國際化配置

---

**維護者**: Development Team
**最後更新**: 2026-01-18
**版本**: 1.2.0
