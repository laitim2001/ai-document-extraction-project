# Component Registry (元件註冊表)

本文件追蹤專案中所有已實作的 React 元件，幫助 AI 助手和開發者避免重複實作並促進元件重用。

> **維護指南**: 每當新增或修改元件時，請更新此文件。

---

## 目錄

- [UI 基礎元件](#ui-基礎元件)
- [表單元件](#表單元件)
- [表格元件](#表格元件)
- [圖表元件](#圖表元件)
- [佈局元件](#佈局元件)
- [業務元件](#業務元件)
- [待實作元件](#待實作元件)

---

## UI 基礎元件

> 基於 shadcn/ui 的基礎元件，位於 `src/components/ui/`

| 元件名稱 | 檔案路徑 | 描述 | 使用範例 |
|----------|----------|------|----------|
| Button | `ui/button.tsx` | 按鈕元件，支援多種變體 | `<Button variant="primary">Click</Button>` |
| Input | `ui/input.tsx` | 輸入框元件 | `<Input placeholder="Enter..." />` |
| Select | `ui/select.tsx` | 下拉選擇元件 | `<Select options={...} />` |
| Dialog | `ui/dialog.tsx` | 對話框/Modal 元件 | `<Dialog open={...}>...</Dialog>` |
| Card | `ui/card.tsx` | 卡片容器元件 | `<Card>...</Card>` |
| Badge | `ui/badge.tsx` | 標籤/徽章元件 | `<Badge variant="success">Active</Badge>` |
| Avatar | `ui/avatar.tsx` | 頭像元件 | `<Avatar src={...} fallback="JD" />` |
| Tooltip | `ui/tooltip.tsx` | 工具提示元件 | `<Tooltip content="...">...</Tooltip>` |
| Tabs | `ui/tabs.tsx` | 標籤頁元件 | `<Tabs defaultValue="tab1">...</Tabs>` |
| Alert | `ui/alert.tsx` | 警告/通知元件 | `<Alert variant="warning">...</Alert>` |
| Progress | `ui/progress.tsx` | 進度條元件 | `<Progress value={50} />` |
| Skeleton | `ui/skeleton.tsx` | 骨架屏載入元件 | `<Skeleton className="h-4 w-full" />` |
| Switch | `ui/switch.tsx` | 開關切換元件 | `<Switch checked={...} />` |
| Checkbox | `ui/checkbox.tsx` | 核取方塊元件 | `<Checkbox checked={...} />` |
| RadioGroup | `ui/radio-group.tsx` | 單選按鈕組元件 | `<RadioGroup value={...}>...</RadioGroup>` |
| Textarea | `ui/textarea.tsx` | 多行文字輸入元件 | `<Textarea rows={4} />` |
| Label | `ui/label.tsx` | 標籤元件 | `<Label htmlFor="email">Email</Label>` |
| Separator | `ui/separator.tsx` | 分隔線元件 | `<Separator />` |
| ScrollArea | `ui/scroll-area.tsx` | 自定義捲動區域 | `<ScrollArea className="h-72">...</ScrollArea>` |
| Popover | `ui/popover.tsx` | 彈出框元件 | `<Popover>...</Popover>` |
| DropdownMenu | `ui/dropdown-menu.tsx` | 下拉選單元件 | `<DropdownMenu>...</DropdownMenu>` |
| Command | `ui/command.tsx` | 命令選單/搜尋元件 | `<Command>...</Command>` |
| Calendar | `ui/calendar.tsx` | 日曆元件 | `<Calendar selected={date} />` |
| DatePicker | `ui/date-picker.tsx` | 日期選擇器 | `<DatePicker value={...} onChange={...} />` |

---

## 表單元件

> 表單相關元件，位於 `src/components/forms/`

| 元件名稱 | 檔案路徑 | 描述 | 相關 Story |
|----------|----------|------|------------|
| FormField | `forms/form-field.tsx` | 通用表單欄位包裝器 | - |
| FormError | `forms/form-error.tsx` | 表單錯誤訊息顯示 | - |
| SearchInput | `forms/search-input.tsx` | 搜尋輸入框 (含防抖) | 1-3 |
| CitySelector | `forms/city-selector.tsx` | 城市選擇器 | 6-2 |
| RoleSelector | `forms/role-selector.tsx` | 角色選擇器 | 1-4 |
| DateRangePicker | `forms/date-range-picker.tsx` | 日期範圍選擇器 | 7-2 |
| FileUpload | `forms/file-upload.tsx` | 檔案上傳元件 | 2-1 |

---

## 表格元件

> 資料表格相關元件，位於 `src/components/tables/`

| 元件名稱 | 檔案路徑 | 描述 | 相關 Story |
|----------|----------|------|------------|
| DataTable | `tables/data-table.tsx` | 通用資料表格 (基於 TanStack Table) | - |
| DataTablePagination | `tables/pagination.tsx` | 表格分頁元件 | - |
| DataTableToolbar | `tables/toolbar.tsx` | 表格工具列 (搜尋、篩選) | - |
| DataTableColumnHeader | `tables/column-header.tsx` | 可排序欄位標題 | - |
| DataTableFacetedFilter | `tables/faceted-filter.tsx` | 多選篩選器 | - |
| DataTableRowActions | `tables/row-actions.tsx` | 行操作選單 | - |

---

## 圖表元件

> 資料視覺化元件，位於 `src/components/charts/`

| 元件名稱 | 檔案路徑 | 描述 | 相關 Story |
|----------|----------|------|------------|
| LineChart | `charts/line-chart.tsx` | 折線圖 | 7-1 |
| BarChart | `charts/bar-chart.tsx` | 長條圖 | 7-1 |
| PieChart | `charts/pie-chart.tsx` | 圓餅圖 | 7-1 |
| AreaChart | `charts/area-chart.tsx` | 區域圖 | 7-7 |
| MetricCard | `charts/metric-card.tsx` | 指標卡片 | 7-1, 12-1 |
| ChartTooltip | `charts/chart-tooltip.tsx` | 圖表工具提示 | - |
| ChartLegend | `charts/chart-legend.tsx` | 圖表圖例 | - |

---

## 佈局元件

> 頁面佈局相關元件，位於 `src/components/layout/`

| 元件名稱 | 檔案路徑 | 描述 | 相關 Story |
|----------|----------|------|------------|
| AppShell | `layout/app-shell.tsx` | 應用程式外殼 (導覽+內容) | 1-0 |
| Sidebar | `layout/sidebar.tsx` | 側邊導覽列 | 1-0 |
| Header | `layout/header.tsx` | 頂部導覽列 | 1-0 |
| PageHeader | `layout/page-header.tsx` | 頁面標題區 | - |
| ContentArea | `layout/content-area.tsx` | 主內容區域 | - |
| Breadcrumb | `layout/breadcrumb.tsx` | 麵包屑導覽 | - |
| EmptyState | `layout/empty-state.tsx` | 空狀態顯示 | - |
| LoadingState | `layout/loading-state.tsx` | 載入狀態顯示 | - |
| ErrorBoundary | `layout/error-boundary.tsx` | 錯誤邊界元件 | - |

---

## 業務元件

> 特定業務邏輯元件

### 使用者管理 (Epic 1)
| 元件名稱 | 檔案路徑 | 描述 | 相關 Story |
|----------|----------|------|------------|
| UserList | `users/user-list.tsx` | 使用者列表 | 1-3 |
| UserDetail | `users/user-detail.tsx` | 使用者詳情 | 1-5 |
| AddUserDialog | `users/add-user-dialog.tsx` | 新增使用者對話框 | 1-4 |
| RolePermissionMatrix | `users/role-permission-matrix.tsx` | 角色權限矩陣 | 1-7 |

### 發票處理 (Epic 2-3)
| 元件名稱 | 檔案路徑 | 描述 | 相關 Story |
|----------|----------|------|------------|
| InvoiceUploader | `invoices/invoice-uploader.tsx` | 發票上傳元件 | 2-1 |
| ProcessingStatus | `invoices/processing-status.tsx` | 處理狀態顯示 | 2-7 |
| InvoiceReviewList | `invoices/review-list.tsx` | 待審核發票列表 | 3-1 |
| SideBySideViewer | `invoices/side-by-side-viewer.tsx` | 並排檢視器 (PDF+資料) | 3-2 |
| ConfidenceIndicator | `invoices/confidence-indicator.tsx` | 信心度指示器 | 3-3 |
| FieldCorrector | `invoices/field-corrector.tsx` | 欄位修正元件 | 3-5 |

### 規則管理 (Epic 4-5)
| 元件名稱 | 檔案路徑 | 描述 | 相關 Story |
|----------|----------|------|------------|
| MappingRuleList | `rules/mapping-rule-list.tsx` | 映射規則列表 | 4-1 |
| RuleEditor | `rules/rule-editor.tsx` | 規則編輯器 | 5-3 |
| RuleTestPanel | `rules/rule-test-panel.tsx` | 規則測試面板 | 5-4 |
| ForwarderList | `forwarders/forwarder-list.tsx` | Forwarder 列表 | 5-1 |
| ForwarderDetail | `forwarders/forwarder-detail.tsx` | Forwarder 詳情 | 5-2 |

### 報表儀表板 (Epic 7)
| 元件名稱 | 檔案路徑 | 描述 | 相關 Story |
|----------|----------|------|------------|
| StatsDashboard | `dashboard/stats-dashboard.tsx` | 統計儀表板 | 7-1 |
| FilterPanel | `dashboard/filter-panel.tsx` | 篩選面板 | 7-2, 7-3 |
| ExportDialog | `dashboard/export-dialog.tsx` | 匯出對話框 | 7-4 |
| CostSummaryCard | `dashboard/cost-summary-card.tsx` | 成本摘要卡片 | 7-6 |

### 文件來源追蹤 (Epic 9)
| 元件名稱 | 檔案路徑 | 描述 | 相關 Story |
|----------|----------|------|------------|
| SourceInfoCard | `features/document-source/SourceInfoCard.tsx` | 文件來源資訊卡片 | 9-5 |
| SourceTypeBadge | `features/document-source/SourceTypeBadge.tsx` | 來源類型標籤 | 9-5 |
| SourceTypeStats | `features/document-source/SourceTypeStats.tsx` | 來源類型統計圓餅圖 | 9-5 |
| SourceTypeTrend | `features/document-source/SourceTypeTrend.tsx` | 來源類型趨勢長條圖 | 9-5 |
| SourceSearchFilter | `features/document-source/SourceSearchFilter.tsx` | 來源搜尋篩選面板 | 9-5 |

### 系統管理 (Epic 12)
| 元件名稱 | 檔案路徑 | 描述 | 相關 Story |
|----------|----------|------|------------|
| HealthDashboard | `admin/health-dashboard.tsx` | 系統健康儀表板 | 12-1 |
| MetricsChart | `admin/metrics-chart.tsx` | 效能指標圖表 | 12-2 |
| AlertConfigPanel | `admin/alert-config-panel.tsx` | 警報配置面板 | 12-3 |
| SystemConfigEditor | `admin/system-config-editor.tsx` | 系統配置編輯器 | 12-4 |
| BackupManagement | `features/backup/BackupManagement.tsx` | 備份管理主元件（含標籤頁切換） | 12-5 |
| BackupStatusCard | `features/backup/BackupStatusCard.tsx` | 備份狀態摘要卡片 | 12-5 |
| StorageUsageCard | `features/backup/StorageUsageCard.tsx` | 儲存空間使用量卡片（含進度條） | 12-5 |
| BackupList | `features/backup/BackupList.tsx` | 備份列表（含篩選、分頁、操作） | 12-5 |
| BackupScheduleList | `features/backup/BackupScheduleList.tsx` | 排程列表 | 12-5 |
| CreateBackupDialog | `features/backup/CreateBackupDialog.tsx` | 建立備份對話框 | 12-5 |
| ScheduleDialog | `features/backup/ScheduleDialog.tsx` | 排程新增/編輯對話框 | 12-5 |
| RestoreManagement | `features/admin/restore/RestoreManagement.tsx` | 數據恢復管理主元件（含標籤頁） | 12-6 |
| RestoreDialog | `features/admin/restore/RestoreDialog.tsx` | 新建恢復對話框（含備份選擇、範圍配置） | 12-6 |
| RestoreDetailDialog | `features/admin/restore/RestoreDetailDialog.tsx` | 恢復詳情對話框（含日誌、回滾操作） | 12-6 |
| RestoreList | `features/admin/restore/RestoreList.tsx` | 恢復記錄列表（含篩選、分頁、取消操作） | 12-6 |
| LogViewer | `admin/log-viewer.tsx` | 日誌檢視器 | 12-7 |

### Prompt 配置管理 (Epic 14)
| 元件名稱 | 檔案路徑 | 描述 | 相關 Story |
|----------|----------|------|------------|
| PromptConfigList | `features/prompt-config/PromptConfigList.tsx` | 配置列表（按類型分組） | 14-2 |
| PromptConfigFilters | `features/prompt-config/PromptConfigFilters.tsx` | 配置篩選器 | 14-2 |
| PromptEditor | `features/prompt-config/PromptEditor.tsx` | Prompt 編輯器（支援變數插入） | 14-2 |
| PromptTester | `features/prompt-config/PromptTester.tsx` | Prompt 測試器（文件上傳+結果顯示） | 14-2 |
| PromptConfigForm | `features/prompt-config/PromptConfigForm.tsx` | 配置表單（完整 CRUD） | 14-2 |

---

## 待實作元件

> 根據 Tech Specs 需要實作但尚未開發的元件

| 元件名稱 | 預計路徑 | 描述 | 相關 Story | 優先級 |
|----------|----------|------|------------|--------|
| (開發時填寫) | | | | |

---

## 元件開發指南

### 命名慣例
- 元件檔案: `kebab-case.tsx` (例: `user-list.tsx`)
- 元件名稱: `PascalCase` (例: `UserList`)
- Props 類型: `ComponentNameProps` (例: `UserListProps`)

### 檔案結構
```tsx
// user-list.tsx
'use client';

import { useState } from 'react';
import { User } from '@/types';

export interface UserListProps {
  users: User[];
  onSelect?: (user: User) => void;
}

export function UserList({ users, onSelect }: UserListProps) {
  // 實作
  return (
    // JSX
  );
}
```

### Props 設計原則
1. 必要的 props 放前面，可選的放後面
2. 回調函數以 `on` 開頭 (例: `onSelect`, `onChange`)
3. 布林值以 `is` 或 `has` 開頭 (例: `isLoading`, `hasError`)
4. 提供合理的預設值

### 元件分類標準
- **ui/**: 純展示元件，無業務邏輯
- **forms/**: 表單相關元件
- **tables/**: 表格相關元件
- **charts/**: 圖表相關元件
- **layout/**: 佈局相關元件
- **其他資料夾**: 特定業務領域元件

---

*最後更新: 2025-12-21*
*請在每次新增元件後更新此文件*
