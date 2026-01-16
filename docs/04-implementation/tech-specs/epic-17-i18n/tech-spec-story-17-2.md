# Story 17-2: 核心 UI 文字國際化 - Technical Specification

**Version:** 1.0
**Created:** 2026-01-16
**Status:** Ready for Development
**Story Key:** 17-2-core-ui-text-internationalization

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 17.2 |
| Epic | Epic 17: i18n 國際化 |
| Estimated Effort | Large (12-16h) |
| Dependencies | Story 17.1 |
| Blocking | Story 17.5 |

---

## Objective

將核心用戶介面的硬編碼文字替換為國際化翻譯，包括發票列表頁、審核頁面、導航組件和通用 UI 元素。預計處理約 400-500 個翻譯字串，涵蓋 P0 優先級的所有用戶可見文字。

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | 通用組件文字國際化 | 建立 `common.json` 擴展、更新 Button/Dialog 組件 |
| AC2 | 發票列表頁國際化 | 建立 `invoices.json`、更新 page.tsx 和子組件 |
| AC3 | 審核頁面國際化 | 建立 `review.json`、更新審核相關組件 |
| AC4 | 導航和佈局國際化 | 建立 `navigation.json`、更新 Sidebar/Header |
| AC5 | 對話框和表單國際化 | 建立 `dialogs.json`、更新通用對話框組件 |

---

## Implementation Guide

### Phase 1: 建立模組翻譯檔案 (60 min)

#### Step 1.1: 建立發票模組翻譯檔案

Create `messages/zh-TW/invoices.json`:

```json
{
  "page": {
    "title": "發票文件",
    "description": "管理和追蹤上傳的發票處理狀態"
  },
  "stats": {
    "total": "總計",
    "processing": "處理中",
    "completed": "已完成",
    "failed": "失敗"
  },
  "filters": {
    "searchPlaceholder": "搜尋文件名稱...",
    "allStatus": "所有狀態",
    "status": {
      "uploading": "上傳中",
      "ocrProcessing": "OCR 處理中",
      "mappingProcessing": "映射中",
      "pendingReview": "待審核",
      "completed": "已完成",
      "ocrFailed": "OCR 失敗",
      "failed": "處理失敗"
    }
  },
  "table": {
    "columns": {
      "filename": "文件名稱",
      "status": "狀態",
      "uploadedAt": "上傳時間",
      "processingPath": "處理路徑",
      "confidence": "信心度",
      "company": "公司",
      "actions": "操作"
    },
    "empty": "沒有找到發票文件",
    "emptyDescription": "上傳新的發票文件開始處理"
  },
  "processingPath": {
    "autoApprove": "自動通過",
    "quickReview": "快速審核",
    "fullReview": "完整審核",
    "manualRequired": "需人工處理"
  },
  "upload": {
    "title": "上傳發票",
    "dragDrop": "拖放文件到此處，或點擊選擇文件",
    "supportedFormats": "支援格式：PDF、JPG、PNG",
    "maxSize": "最大文件大小：{size}MB",
    "uploading": "上傳中...",
    "uploadSuccess": "上傳成功",
    "uploadFailed": "上傳失敗"
  }
}
```

Create `messages/en/invoices.json`:

```json
{
  "page": {
    "title": "Invoice Documents",
    "description": "Manage and track uploaded invoice processing status"
  },
  "stats": {
    "total": "Total",
    "processing": "Processing",
    "completed": "Completed",
    "failed": "Failed"
  },
  "filters": {
    "searchPlaceholder": "Search by filename...",
    "allStatus": "All Status",
    "status": {
      "uploading": "Uploading",
      "ocrProcessing": "OCR Processing",
      "mappingProcessing": "Mapping",
      "pendingReview": "Pending Review",
      "completed": "Completed",
      "ocrFailed": "OCR Failed",
      "failed": "Failed"
    }
  },
  "table": {
    "columns": {
      "filename": "Filename",
      "status": "Status",
      "uploadedAt": "Uploaded At",
      "processingPath": "Processing Path",
      "confidence": "Confidence",
      "company": "Company",
      "actions": "Actions"
    },
    "empty": "No invoices found",
    "emptyDescription": "Upload a new invoice to get started"
  },
  "processingPath": {
    "autoApprove": "Auto Approve",
    "quickReview": "Quick Review",
    "fullReview": "Full Review",
    "manualRequired": "Manual Required"
  },
  "upload": {
    "title": "Upload Invoice",
    "dragDrop": "Drag and drop files here, or click to select",
    "supportedFormats": "Supported formats: PDF, JPG, PNG",
    "maxSize": "Maximum file size: {size}MB",
    "uploading": "Uploading...",
    "uploadSuccess": "Upload successful",
    "uploadFailed": "Upload failed"
  }
}
```

#### Step 1.2: 建立審核模組翻譯檔案

Create `messages/zh-TW/review.json`:

```json
{
  "page": {
    "title": "待審核發票",
    "description": "審核和修正 AI 提取結果"
  },
  "filters": {
    "company": "公司/Forwarder",
    "processingPath": "處理路徑",
    "confidenceRange": "信心度範圍",
    "clearFilters": "清除篩選",
    "allCompanies": "所有公司",
    "allPaths": "所有路徑"
  },
  "confidence": {
    "low": "低信心度",
    "medium": "中信心度",
    "high": "高信心度",
    "range": "{min}% - {max}%"
  },
  "actions": {
    "approve": "批准",
    "reject": "拒絕",
    "correct": "修正並批准",
    "viewDetails": "查看詳情",
    "escalate": "提交上級"
  },
  "detail": {
    "extractedFields": "提取欄位",
    "originalDocument": "原始文件",
    "correctionHistory": "修正歷史",
    "noCorrections": "尚無修正記錄"
  },
  "dialog": {
    "approveTitle": "確認批准",
    "approveMessage": "確定要批准此發票的提取結果嗎？",
    "rejectTitle": "拒絕原因",
    "rejectPlaceholder": "請輸入拒絕原因...",
    "escalateTitle": "提交上級審核",
    "escalateMessage": "請說明需要上級審核的原因"
  },
  "empty": {
    "title": "沒有待審核的發票",
    "description": "所有發票都已處理完成"
  }
}
```

Create `messages/en/review.json`:

```json
{
  "page": {
    "title": "Pending Review",
    "description": "Review and correct AI extraction results"
  },
  "filters": {
    "company": "Company/Forwarder",
    "processingPath": "Processing Path",
    "confidenceRange": "Confidence Range",
    "clearFilters": "Clear Filters",
    "allCompanies": "All Companies",
    "allPaths": "All Paths"
  },
  "confidence": {
    "low": "Low Confidence",
    "medium": "Medium Confidence",
    "high": "High Confidence",
    "range": "{min}% - {max}%"
  },
  "actions": {
    "approve": "Approve",
    "reject": "Reject",
    "correct": "Correct & Approve",
    "viewDetails": "View Details",
    "escalate": "Escalate"
  },
  "detail": {
    "extractedFields": "Extracted Fields",
    "originalDocument": "Original Document",
    "correctionHistory": "Correction History",
    "noCorrections": "No corrections yet"
  },
  "dialog": {
    "approveTitle": "Confirm Approval",
    "approveMessage": "Are you sure you want to approve this extraction result?",
    "rejectTitle": "Rejection Reason",
    "rejectPlaceholder": "Please enter rejection reason...",
    "escalateTitle": "Escalate for Review",
    "escalateMessage": "Please explain why this needs supervisor review"
  },
  "empty": {
    "title": "No invoices pending review",
    "description": "All invoices have been processed"
  }
}
```

---

### Phase 2: 更新 i18n 請求配置以支援多命名空間 (15 min)

#### Step 2.1: 更新 request.ts 載入多個翻譯檔案

Update `src/i18n/request.ts`:

```typescript
/**
 * @fileoverview next-intl Server-side 請求配置
 * @description
 *   配置 next-intl 的 Server-side 翻譯載入邏輯。
 *   支援多個命名空間的翻譯檔案合併載入。
 *
 * @module src/i18n/request
 * @author Development Team
 * @since Epic 17 - Story 17.1 (i18n Infrastructure Setup)
 * @lastModified 2026-01-16
 */

import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, isValidLocale } from './config';

// 定義所有命名空間
const namespaces = [
  'common',
  'invoices',
  'review',
  'navigation',
  'dialogs',
  'validation',
  'errors',
] as const;

export default getRequestConfig(async ({ locale }) => {
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;

  // 載入所有命名空間的翻譯檔案
  const messagesPromises = namespaces.map(async (ns) => {
    try {
      const module = await import(`../../messages/${validLocale}/${ns}.json`);
      return { [ns]: module.default };
    } catch {
      // 如果找不到檔案，嘗試從預設語言載入
      try {
        const fallbackModule = await import(`../../messages/${defaultLocale}/${ns}.json`);
        return { [ns]: fallbackModule.default };
      } catch {
        return { [ns]: {} };
      }
    }
  });

  const messagesArray = await Promise.all(messagesPromises);
  const messages = messagesArray.reduce((acc, curr) => ({ ...acc, ...curr }), {});

  return {
    locale: validLocale,
    messages,
    timeZone: 'Asia/Taipei',
    onError: (error) => {
      console.error('[i18n] Translation error:', error);
    },
    getMessageFallback: ({ namespace, key }) => {
      return `[Missing: ${namespace}.${key}]`;
    },
  };
});
```

---

### Phase 3: 重構發票列表頁 (90 min)

#### Step 3.1: 更新發票列表頁

Update `src/app/[locale]/(dashboard)/invoices/page.tsx`:

```typescript
/**
 * @fileoverview 發票列表頁面（國際化版本）
 * @description
 *   顯示所有發票文件，支援搜尋、篩選和分頁。
 *   已整合 i18n 國際化支援。
 *
 * @module src/app/[locale]/(dashboard)/invoices/page
 * @author Development Team
 * @since Epic 2 - Story 2.7, Epic 17 - Story 17.2
 * @lastModified 2026-01-16
 */

'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { InvoiceListTable } from '@/components/features/invoice/InvoiceListTable';
import { useDocuments } from '@/hooks/use-documents';

export default function InvoicesPage() {
  const t = useTranslations('invoices');
  const tc = useTranslations('common');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useDocuments({
    search,
    status: status === 'all' ? undefined : status,
    page,
    limit: 20,
  });

  const stats = data?.meta?.stats || {
    total: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <div>
        <h1 className="text-2xl font-bold">{t('page.title')}</h1>
        <p className="text-gray-500">{t('page.description')}</p>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {t('stats.total')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-500">
              {t('stats.processing')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-500">
              {t('stats.completed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500">
              {t('stats.failed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* 篩選控制 */}
      <div className="flex items-center gap-4">
        <Input
          placeholder={t('filters.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('filters.allStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatus')}</SelectItem>
            <SelectItem value="UPLOADING">{t('filters.status.uploading')}</SelectItem>
            <SelectItem value="OCR_PROCESSING">{t('filters.status.ocrProcessing')}</SelectItem>
            <SelectItem value="MAPPING_PROCESSING">{t('filters.status.mappingProcessing')}</SelectItem>
            <SelectItem value="PENDING_REVIEW">{t('filters.status.pendingReview')}</SelectItem>
            <SelectItem value="COMPLETED">{t('filters.status.completed')}</SelectItem>
            <SelectItem value="OCR_FAILED">{t('filters.status.ocrFailed')}</SelectItem>
            <SelectItem value="FAILED">{t('filters.status.failed')}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {tc('actions.refresh')}
        </Button>
      </div>

      {/* 發票表格 */}
      <InvoiceListTable
        data={data?.data || []}
        isLoading={isLoading}
        pagination={{
          page,
          totalPages: data?.meta?.pagination?.totalPages || 1,
          onPageChange: setPage,
        }}
      />

      {/* 分頁控制 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {tc('pagination.showing', {
            start: ((page - 1) * 20) + 1,
            end: Math.min(page * 20, data?.meta?.pagination?.total || 0),
            total: data?.meta?.pagination?.total || 0,
          })}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {tc('pagination.previous')}
          </Button>
          <Button
            variant="outline"
            disabled={page >= (data?.meta?.pagination?.totalPages || 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            {tc('pagination.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

### Phase 4: 重構導航組件 (60 min)

#### Step 4.1: 建立導航翻譯檔案

Create `messages/zh-TW/navigation.json`:

```json
{
  "sidebar": {
    "dashboard": "儀表板",
    "invoices": "發票文件",
    "review": "待審核",
    "rules": "映射規則",
    "companies": "公司管理",
    "formats": "格式管理",
    "reports": "報表分析",
    "admin": "系統管理",
    "settings": "設定"
  },
  "admin": {
    "users": "用戶管理",
    "roles": "角色管理",
    "backup": "備份管理",
    "config": "系統配置",
    "monitoring": "系統監控",
    "logs": "系統日誌"
  },
  "reports": {
    "dashboard": "統計儀表板",
    "costs": "成本報表",
    "audit": "審計報告"
  },
  "user": {
    "profile": "個人資料",
    "preferences": "偏好設定",
    "logout": "登出"
  },
  "breadcrumb": {
    "home": "首頁"
  }
}
```

Create `messages/en/navigation.json`:

```json
{
  "sidebar": {
    "dashboard": "Dashboard",
    "invoices": "Invoices",
    "review": "Review Queue",
    "rules": "Mapping Rules",
    "companies": "Companies",
    "formats": "Formats",
    "reports": "Reports",
    "admin": "Admin",
    "settings": "Settings"
  },
  "admin": {
    "users": "Users",
    "roles": "Roles",
    "backup": "Backup",
    "config": "Configuration",
    "monitoring": "Monitoring",
    "logs": "System Logs"
  },
  "reports": {
    "dashboard": "Statistics",
    "costs": "Cost Reports",
    "audit": "Audit Reports"
  },
  "user": {
    "profile": "Profile",
    "preferences": "Preferences",
    "logout": "Logout"
  },
  "breadcrumb": {
    "home": "Home"
  }
}
```

#### Step 4.2: 更新 Sidebar 組件使用翻譯

```typescript
// src/components/layouts/Sidebar.tsx
'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Settings,
  Building2,
  FileType,
  BarChart3,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const t = useTranslations('navigation');
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: t('sidebar.dashboard'), icon: LayoutDashboard },
    { href: '/invoices', label: t('sidebar.invoices'), icon: FileText },
    { href: '/review', label: t('sidebar.review'), icon: CheckSquare },
    { href: '/rules', label: t('sidebar.rules'), icon: Settings },
    { href: '/companies', label: t('sidebar.companies'), icon: Building2 },
    { href: '/formats', label: t('sidebar.formats'), icon: FileType },
    { href: '/reports', label: t('sidebar.reports'), icon: BarChart3 },
    { href: '/admin', label: t('sidebar.admin'), icon: Shield },
  ];

  return (
    <aside className="w-64 border-r bg-white">
      <nav className="space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.includes(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

---

## Verification Checklist

### Translation Loading Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 發票頁面（zh-TW） | 訪問 `/zh-TW/invoices` | 所有文字顯示繁體中文 | [ ] |
| 發票頁面（en） | 訪問 `/en/invoices` | 所有文字顯示英文 | [ ] |
| 審核頁面（zh-TW） | 訪問 `/zh-TW/review` | 所有文字顯示繁體中文 | [ ] |
| 導航側邊欄 | 切換語言 | 所有導航項目正確翻譯 | [ ] |
| 統計卡片 | 查看發票頁面 | 標題根據語言切換 | [ ] |
| 篩選選項 | 展開狀態選擇器 | 選項根據語言切換 | [ ] |
| 分頁文字 | 查看分頁控制 | 「顯示 X-Y of Z」正確翻譯 | [ ] |

### Component Functionality Verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 搜尋功能 | 輸入搜尋關鍵字 | 功能正常，placeholder 已翻譯 | [ ] |
| 篩選功能 | 選擇狀態篩選 | 功能正常，選項已翻譯 | [ ] |
| 刷新按鈕 | 點擊刷新 | 功能正常，按鈕文字已翻譯 | [ ] |
| 分頁功能 | 點擊上/下一頁 | 功能正常，按鈕已翻譯 | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `messages/zh-TW/invoices.json` | 發票模組繁體中文翻譯 |
| `messages/en/invoices.json` | 發票模組英文翻譯 |
| `messages/zh-TW/review.json` | 審核模組繁體中文翻譯 |
| `messages/en/review.json` | 審核模組英文翻譯 |
| `messages/zh-TW/navigation.json` | 導航繁體中文翻譯 |
| `messages/en/navigation.json` | 導航英文翻譯 |
| `src/i18n/request.ts` | 更新：支援多命名空間 |
| `src/app/[locale]/(dashboard)/invoices/page.tsx` | 更新：使用 i18n |
| `src/components/layouts/Sidebar.tsx` | 更新：使用 i18n |

---

## Next Steps

完成 Story 17-2 後：
1. 繼續擴展其他模組的翻譯（admin, reports, companies）
2. 進入 **Story 17-3**（驗證訊息與錯誤處理國際化）
3. 進入 **Story 17-5**（語言偏好設置與切換 UI）

---

*Generated by BMAD Method - Create Tech Spec Workflow*
