# Story 17-2: 核心 UI 文字國際化 - Technical Specification

**Version:** 1.1
**Created:** 2026-01-16
**Updated:** 2026-01-16
**Status:** Ready for Development
**Story Key:** 17-2-core-ui-text-internationalization

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 17.2 |
| Epic | Epic 17: i18n 國際化 |
| Estimated Effort | X-Large (20-28h) |
| Dependencies | Story 17.1 |
| Blocking | Story 17.5 |

---

## Objective

將核心用戶介面的硬編碼文字替換為國際化翻譯，涵蓋所有主要功能模組。預計處理約 **1000-1200 個翻譯字串**，包括：

| 模組 | 預估字串數 | 優先級 |
|------|-----------|--------|
| invoices | 50-60 | P0 |
| review | 40-50 | P0 |
| navigation | 30-40 | P0 |
| dialogs | 30-40 | P0 |
| **admin** | 150-200 | P1 |
| **auth** | 30-40 | P1 |
| **companies** | 100-120 | P1 |
| **rules** | 120-150 | P1 |
| **reports** | 100-130 | P1 |
| **formats** | 60-80 | P2 |
| **dashboard** | 40-60 | P2 |

> **Version 1.1 更新**：根據深度覆蓋分析，新增 admin、auth、companies、rules、reports、formats、dashboard 模組。

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | 通用組件文字國際化 | 建立 `common.json` 擴展、更新 Button/Dialog 組件 |
| AC2 | 發票列表頁國際化 | 建立 `invoices.json`、更新 page.tsx 和子組件 |
| AC3 | 審核頁面國際化 | 建立 `review.json`、更新審核相關組件 |
| AC4 | 導航和佈局國際化 | 建立 `navigation.json`、更新 Sidebar/Header |
| AC5 | 對話框和表單國際化 | 建立 `dialogs.json`、更新通用對話框組件 |
| **AC6** | **管理員頁面國際化** | 建立 `admin.json`、更新用戶/角色/系統配置頁面 |
| **AC7** | **認證頁面國際化** | 建立 `auth.json`、更新登入/登出/權限提示 |
| **AC8** | **公司管理國際化** | 建立 `companies.json`、更新公司 CRUD 頁面 |
| **AC9** | **映射規則國際化** | 建立 `rules.json`、更新規則管理頁面 |
| **AC10** | **報表分析國際化** | 建立 `reports.json`、更新統計/成本/審計報表 |

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

### Phase 5: 管理員模組翻譯 (60 min) - **NEW**

#### Step 5.1: 建立管理員翻譯檔案

Create `messages/zh-TW/admin.json`:

```json
{
  "page": {
    "title": "系統管理",
    "description": "管理用戶、角色和系統配置"
  },
  "users": {
    "title": "用戶管理",
    "description": "管理系統用戶帳號",
    "table": {
      "name": "姓名",
      "email": "電郵",
      "role": "角色",
      "city": "城市",
      "status": "狀態",
      "lastLogin": "最後登入",
      "actions": "操作"
    },
    "status": {
      "active": "啟用",
      "inactive": "停用",
      "pending": "待審核"
    },
    "actions": {
      "create": "新增用戶",
      "edit": "編輯",
      "delete": "刪除",
      "activate": "啟用",
      "deactivate": "停用",
      "resetPassword": "重設密碼"
    },
    "form": {
      "name": "姓名",
      "email": "電郵",
      "password": "密碼",
      "confirmPassword": "確認密碼",
      "role": "角色",
      "city": "城市",
      "department": "部門"
    },
    "dialog": {
      "createTitle": "新增用戶",
      "editTitle": "編輯用戶",
      "deleteTitle": "確認刪除",
      "deleteMessage": "確定要刪除用戶「{name}」嗎？此操作無法復原。",
      "resetPasswordTitle": "重設密碼",
      "resetPasswordMessage": "確定要重設用戶「{name}」的密碼嗎？"
    }
  },
  "roles": {
    "title": "角色管理",
    "description": "管理用戶角色和權限",
    "table": {
      "name": "角色名稱",
      "description": "描述",
      "permissions": "權限數量",
      "users": "用戶數量",
      "actions": "操作"
    },
    "actions": {
      "create": "新增角色",
      "edit": "編輯",
      "delete": "刪除",
      "viewPermissions": "查看權限"
    },
    "form": {
      "name": "角色名稱",
      "description": "描述",
      "permissions": "權限"
    },
    "permissions": {
      "read": "讀取",
      "write": "寫入",
      "delete": "刪除",
      "admin": "管理"
    }
  },
  "config": {
    "title": "系統配置",
    "description": "配置系統參數和設定",
    "sections": {
      "general": "一般設定",
      "security": "安全設定",
      "notifications": "通知設定",
      "integrations": "整合設定"
    },
    "general": {
      "systemName": "系統名稱",
      "defaultLanguage": "預設語言",
      "timezone": "時區",
      "dateFormat": "日期格式"
    },
    "security": {
      "sessionTimeout": "會話逾時（分鐘）",
      "passwordPolicy": "密碼政策",
      "mfaRequired": "強制雙因素認證",
      "loginAttempts": "登入嘗試次數上限"
    }
  },
  "monitoring": {
    "title": "系統監控",
    "description": "監控系統健康狀態和效能",
    "metrics": {
      "cpu": "CPU 使用率",
      "memory": "記憶體使用率",
      "disk": "磁碟使用率",
      "requests": "請求數/秒"
    },
    "status": {
      "healthy": "健康",
      "warning": "警告",
      "critical": "嚴重"
    }
  },
  "logs": {
    "title": "系統日誌",
    "description": "查看系統事件和錯誤日誌",
    "filters": {
      "level": "日誌級別",
      "source": "來源",
      "dateRange": "日期範圍"
    },
    "levels": {
      "info": "資訊",
      "warning": "警告",
      "error": "錯誤",
      "debug": "除錯"
    }
  },
  "backup": {
    "title": "備份管理",
    "description": "管理系統資料備份",
    "actions": {
      "createBackup": "建立備份",
      "restore": "還原",
      "download": "下載",
      "delete": "刪除"
    },
    "status": {
      "completed": "已完成",
      "inProgress": "進行中",
      "failed": "失敗"
    }
  }
}
```

Create `messages/en/admin.json`:

```json
{
  "page": {
    "title": "System Administration",
    "description": "Manage users, roles, and system configuration"
  },
  "users": {
    "title": "User Management",
    "description": "Manage system user accounts",
    "table": {
      "name": "Name",
      "email": "Email",
      "role": "Role",
      "city": "City",
      "status": "Status",
      "lastLogin": "Last Login",
      "actions": "Actions"
    },
    "status": {
      "active": "Active",
      "inactive": "Inactive",
      "pending": "Pending"
    },
    "actions": {
      "create": "Add User",
      "edit": "Edit",
      "delete": "Delete",
      "activate": "Activate",
      "deactivate": "Deactivate",
      "resetPassword": "Reset Password"
    },
    "form": {
      "name": "Name",
      "email": "Email",
      "password": "Password",
      "confirmPassword": "Confirm Password",
      "role": "Role",
      "city": "City",
      "department": "Department"
    },
    "dialog": {
      "createTitle": "Add User",
      "editTitle": "Edit User",
      "deleteTitle": "Confirm Deletion",
      "deleteMessage": "Are you sure you want to delete user \"{name}\"? This action cannot be undone.",
      "resetPasswordTitle": "Reset Password",
      "resetPasswordMessage": "Are you sure you want to reset the password for user \"{name}\"?"
    }
  },
  "roles": {
    "title": "Role Management",
    "description": "Manage user roles and permissions",
    "table": {
      "name": "Role Name",
      "description": "Description",
      "permissions": "Permission Count",
      "users": "User Count",
      "actions": "Actions"
    },
    "actions": {
      "create": "Add Role",
      "edit": "Edit",
      "delete": "Delete",
      "viewPermissions": "View Permissions"
    },
    "form": {
      "name": "Role Name",
      "description": "Description",
      "permissions": "Permissions"
    },
    "permissions": {
      "read": "Read",
      "write": "Write",
      "delete": "Delete",
      "admin": "Admin"
    }
  },
  "config": {
    "title": "System Configuration",
    "description": "Configure system parameters and settings",
    "sections": {
      "general": "General Settings",
      "security": "Security Settings",
      "notifications": "Notification Settings",
      "integrations": "Integration Settings"
    },
    "general": {
      "systemName": "System Name",
      "defaultLanguage": "Default Language",
      "timezone": "Timezone",
      "dateFormat": "Date Format"
    },
    "security": {
      "sessionTimeout": "Session Timeout (minutes)",
      "passwordPolicy": "Password Policy",
      "mfaRequired": "Require Two-Factor Authentication",
      "loginAttempts": "Maximum Login Attempts"
    }
  },
  "monitoring": {
    "title": "System Monitoring",
    "description": "Monitor system health and performance",
    "metrics": {
      "cpu": "CPU Usage",
      "memory": "Memory Usage",
      "disk": "Disk Usage",
      "requests": "Requests/sec"
    },
    "status": {
      "healthy": "Healthy",
      "warning": "Warning",
      "critical": "Critical"
    }
  },
  "logs": {
    "title": "System Logs",
    "description": "View system events and error logs",
    "filters": {
      "level": "Log Level",
      "source": "Source",
      "dateRange": "Date Range"
    },
    "levels": {
      "info": "Info",
      "warning": "Warning",
      "error": "Error",
      "debug": "Debug"
    }
  },
  "backup": {
    "title": "Backup Management",
    "description": "Manage system data backups",
    "actions": {
      "createBackup": "Create Backup",
      "restore": "Restore",
      "download": "Download",
      "delete": "Delete"
    },
    "status": {
      "completed": "Completed",
      "inProgress": "In Progress",
      "failed": "Failed"
    }
  }
}
```

---

### Phase 6: 認證模組翻譯 (20 min) - **NEW**

#### Step 6.1: 建立認證翻譯檔案

Create `messages/zh-TW/auth.json`:

```json
{
  "login": {
    "title": "登入",
    "subtitle": "登入以繼續使用系統",
    "email": "電郵",
    "password": "密碼",
    "rememberMe": "記住我",
    "forgotPassword": "忘記密碼？",
    "submit": "登入",
    "submitting": "登入中...",
    "ssoButton": "使用 Azure AD 登入",
    "orDivider": "或"
  },
  "logout": {
    "title": "登出",
    "message": "您確定要登出嗎？",
    "confirm": "確認登出",
    "cancel": "取消"
  },
  "session": {
    "expired": "您的登入已過期",
    "expiredMessage": "請重新登入以繼續。",
    "refreshing": "正在更新登入狀態...",
    "relogin": "重新登入"
  },
  "errors": {
    "invalidCredentials": "電郵或密碼錯誤",
    "accountLocked": "帳戶已被鎖定，請聯繫管理員",
    "accountDisabled": "帳戶已被停用",
    "sessionExpired": "登入已過期，請重新登入",
    "networkError": "網路錯誤，請檢查連線",
    "serverError": "伺服器錯誤，請稍後再試"
  },
  "permissions": {
    "denied": "存取被拒",
    "deniedMessage": "您沒有權限存取此頁面",
    "contactAdmin": "請聯繫管理員獲取存取權限",
    "goBack": "返回",
    "goHome": "回到首頁"
  }
}
```

Create `messages/en/auth.json`:

```json
{
  "login": {
    "title": "Sign In",
    "subtitle": "Sign in to continue using the system",
    "email": "Email",
    "password": "Password",
    "rememberMe": "Remember me",
    "forgotPassword": "Forgot password?",
    "submit": "Sign In",
    "submitting": "Signing in...",
    "ssoButton": "Sign in with Azure AD",
    "orDivider": "or"
  },
  "logout": {
    "title": "Sign Out",
    "message": "Are you sure you want to sign out?",
    "confirm": "Sign Out",
    "cancel": "Cancel"
  },
  "session": {
    "expired": "Your session has expired",
    "expiredMessage": "Please sign in again to continue.",
    "refreshing": "Refreshing session...",
    "relogin": "Sign In Again"
  },
  "errors": {
    "invalidCredentials": "Invalid email or password",
    "accountLocked": "Account is locked. Please contact administrator",
    "accountDisabled": "Account has been disabled",
    "sessionExpired": "Session expired. Please sign in again",
    "networkError": "Network error. Please check your connection",
    "serverError": "Server error. Please try again later"
  },
  "permissions": {
    "denied": "Access Denied",
    "deniedMessage": "You do not have permission to access this page",
    "contactAdmin": "Please contact your administrator for access",
    "goBack": "Go Back",
    "goHome": "Go to Home"
  }
}
```

---

### Phase 7: 公司管理模組翻譯 (45 min) - **NEW**

#### Step 7.1: 建立公司管理翻譯檔案

Create `messages/zh-TW/companies.json`:

```json
{
  "page": {
    "title": "公司管理",
    "description": "管理 Forwarder 公司資料和配置"
  },
  "list": {
    "searchPlaceholder": "搜尋公司名稱...",
    "filters": {
      "status": "狀態",
      "city": "城市",
      "allStatus": "所有狀態",
      "allCities": "所有城市"
    }
  },
  "table": {
    "columns": {
      "name": "公司名稱",
      "code": "公司代碼",
      "city": "城市",
      "formats": "格式數量",
      "rules": "規則數量",
      "status": "狀態",
      "createdAt": "建立時間",
      "actions": "操作"
    },
    "empty": "沒有找到公司資料",
    "emptyDescription": "建立新公司開始設定"
  },
  "status": {
    "active": "啟用",
    "inactive": "停用",
    "pending": "待設定"
  },
  "actions": {
    "create": "新增公司",
    "edit": "編輯",
    "delete": "刪除",
    "activate": "啟用",
    "deactivate": "停用",
    "viewFormats": "查看格式",
    "viewRules": "查看規則"
  },
  "form": {
    "basic": "基本資訊",
    "name": "公司名稱",
    "namePlaceholder": "輸入公司名稱",
    "code": "公司代碼",
    "codePlaceholder": "輸入唯一識別代碼",
    "city": "城市",
    "cityPlaceholder": "選擇城市",
    "description": "描述",
    "descriptionPlaceholder": "輸入公司描述（選填）",
    "contact": "聯絡資訊",
    "contactPerson": "聯絡人",
    "contactEmail": "聯絡電郵",
    "contactPhone": "聯絡電話",
    "settings": "設定",
    "autoApproveThreshold": "自動通過閾值",
    "defaultCurrency": "預設貨幣"
  },
  "dialog": {
    "createTitle": "新增公司",
    "editTitle": "編輯公司",
    "deleteTitle": "確認刪除",
    "deleteMessage": "確定要刪除公司「{name}」嗎？相關的格式和規則也會被刪除。",
    "deleteWarning": "此操作無法復原"
  },
  "detail": {
    "overview": "概覽",
    "formats": "發票格式",
    "rules": "映射規則",
    "history": "處理歷史",
    "stats": {
      "totalInvoices": "總發票數",
      "processedThisMonth": "本月處理",
      "autoApproveRate": "自動通過率",
      "avgConfidence": "平均信心度"
    }
  }
}
```

Create `messages/en/companies.json`:

```json
{
  "page": {
    "title": "Company Management",
    "description": "Manage Forwarder company data and configurations"
  },
  "list": {
    "searchPlaceholder": "Search company name...",
    "filters": {
      "status": "Status",
      "city": "City",
      "allStatus": "All Status",
      "allCities": "All Cities"
    }
  },
  "table": {
    "columns": {
      "name": "Company Name",
      "code": "Company Code",
      "city": "City",
      "formats": "Format Count",
      "rules": "Rule Count",
      "status": "Status",
      "createdAt": "Created At",
      "actions": "Actions"
    },
    "empty": "No companies found",
    "emptyDescription": "Create a new company to get started"
  },
  "status": {
    "active": "Active",
    "inactive": "Inactive",
    "pending": "Pending Setup"
  },
  "actions": {
    "create": "Add Company",
    "edit": "Edit",
    "delete": "Delete",
    "activate": "Activate",
    "deactivate": "Deactivate",
    "viewFormats": "View Formats",
    "viewRules": "View Rules"
  },
  "form": {
    "basic": "Basic Information",
    "name": "Company Name",
    "namePlaceholder": "Enter company name",
    "code": "Company Code",
    "codePlaceholder": "Enter unique identifier code",
    "city": "City",
    "cityPlaceholder": "Select city",
    "description": "Description",
    "descriptionPlaceholder": "Enter company description (optional)",
    "contact": "Contact Information",
    "contactPerson": "Contact Person",
    "contactEmail": "Contact Email",
    "contactPhone": "Contact Phone",
    "settings": "Settings",
    "autoApproveThreshold": "Auto-Approve Threshold",
    "defaultCurrency": "Default Currency"
  },
  "dialog": {
    "createTitle": "Add Company",
    "editTitle": "Edit Company",
    "deleteTitle": "Confirm Deletion",
    "deleteMessage": "Are you sure you want to delete company \"{name}\"? Related formats and rules will also be deleted.",
    "deleteWarning": "This action cannot be undone"
  },
  "detail": {
    "overview": "Overview",
    "formats": "Invoice Formats",
    "rules": "Mapping Rules",
    "history": "Processing History",
    "stats": {
      "totalInvoices": "Total Invoices",
      "processedThisMonth": "Processed This Month",
      "autoApproveRate": "Auto-Approve Rate",
      "avgConfidence": "Average Confidence"
    }
  }
}
```

---

### Phase 8: 映射規則模組翻譯 (45 min) - **NEW**

#### Step 8.1: 建立映射規則翻譯檔案

Create `messages/zh-TW/rules.json`:

```json
{
  "page": {
    "title": "映射規則",
    "description": "管理發票欄位映射規則"
  },
  "tabs": {
    "universal": "通用規則",
    "companySpecific": "公司特定規則",
    "learned": "學習規則"
  },
  "tier": {
    "universal": "通用層",
    "companyOverride": "公司覆蓋層",
    "llmClassification": "AI 智能分類"
  },
  "list": {
    "searchPlaceholder": "搜尋規則...",
    "filters": {
      "tier": "規則層級",
      "company": "公司",
      "chargeType": "費用類型",
      "status": "狀態",
      "allTiers": "所有層級",
      "allCompanies": "所有公司",
      "allTypes": "所有類型"
    }
  },
  "table": {
    "columns": {
      "sourceText": "來源文字",
      "chargeType": "費用類型",
      "tier": "層級",
      "company": "公司",
      "confidence": "信心度",
      "usageCount": "使用次數",
      "status": "狀態",
      "actions": "操作"
    },
    "empty": "沒有找到映射規則",
    "emptyDescription": "建立新規則開始設定"
  },
  "status": {
    "active": "啟用",
    "inactive": "停用",
    "pending": "待驗證",
    "rejected": "已拒絕"
  },
  "actions": {
    "create": "新增規則",
    "edit": "編輯",
    "delete": "刪除",
    "activate": "啟用",
    "deactivate": "停用",
    "approve": "批准",
    "reject": "拒絕",
    "test": "測試規則",
    "bulkImport": "批量匯入",
    "export": "匯出"
  },
  "form": {
    "sourceText": "來源文字",
    "sourceTextPlaceholder": "輸入發票上的文字（支援正則表達式）",
    "chargeType": "費用類型",
    "chargeTypePlaceholder": "選擇或輸入費用類型",
    "tier": "規則層級",
    "company": "適用公司",
    "companyPlaceholder": "選擇公司（通用規則留空）",
    "format": "適用格式",
    "formatPlaceholder": "選擇格式（選填）",
    "isRegex": "使用正則表達式",
    "caseSensitive": "區分大小寫",
    "priority": "優先級",
    "notes": "備註"
  },
  "dialog": {
    "createTitle": "新增映射規則",
    "editTitle": "編輯映射規則",
    "deleteTitle": "確認刪除",
    "deleteMessage": "確定要刪除此映射規則嗎？",
    "testTitle": "測試規則",
    "testInput": "輸入測試文字",
    "testResult": "匹配結果",
    "bulkImportTitle": "批量匯入規則",
    "bulkImportDescription": "上傳 CSV 檔案匯入多個規則"
  },
  "test": {
    "inputPlaceholder": "輸入要測試的文字...",
    "matched": "匹配成功",
    "notMatched": "未匹配",
    "matchedRule": "匹配規則",
    "confidence": "信心度"
  },
  "chargeTypes": {
    "oceanFreight": "海運費",
    "airFreight": "空運費",
    "documentFee": "文件費",
    "customsClearance": "報關費",
    "handling": "手續費",
    "insurance": "保險費",
    "storage": "倉儲費",
    "delivery": "派送費",
    "other": "其他費用"
  },
  "learning": {
    "title": "規則學習",
    "description": "從人工修正中學習的規則",
    "pendingApproval": "待批准",
    "approved": "已批准",
    "rejected": "已拒絕",
    "source": "學習來源",
    "learnedFrom": "學習自",
    "corrections": "次修正"
  }
}
```

Create `messages/en/rules.json`:

```json
{
  "page": {
    "title": "Mapping Rules",
    "description": "Manage invoice field mapping rules"
  },
  "tabs": {
    "universal": "Universal Rules",
    "companySpecific": "Company-Specific Rules",
    "learned": "Learned Rules"
  },
  "tier": {
    "universal": "Universal Tier",
    "companyOverride": "Company Override Tier",
    "llmClassification": "AI Classification"
  },
  "list": {
    "searchPlaceholder": "Search rules...",
    "filters": {
      "tier": "Rule Tier",
      "company": "Company",
      "chargeType": "Charge Type",
      "status": "Status",
      "allTiers": "All Tiers",
      "allCompanies": "All Companies",
      "allTypes": "All Types"
    }
  },
  "table": {
    "columns": {
      "sourceText": "Source Text",
      "chargeType": "Charge Type",
      "tier": "Tier",
      "company": "Company",
      "confidence": "Confidence",
      "usageCount": "Usage Count",
      "status": "Status",
      "actions": "Actions"
    },
    "empty": "No mapping rules found",
    "emptyDescription": "Create a new rule to get started"
  },
  "status": {
    "active": "Active",
    "inactive": "Inactive",
    "pending": "Pending Verification",
    "rejected": "Rejected"
  },
  "actions": {
    "create": "Add Rule",
    "edit": "Edit",
    "delete": "Delete",
    "activate": "Activate",
    "deactivate": "Deactivate",
    "approve": "Approve",
    "reject": "Reject",
    "test": "Test Rule",
    "bulkImport": "Bulk Import",
    "export": "Export"
  },
  "form": {
    "sourceText": "Source Text",
    "sourceTextPlaceholder": "Enter text from invoice (regex supported)",
    "chargeType": "Charge Type",
    "chargeTypePlaceholder": "Select or enter charge type",
    "tier": "Rule Tier",
    "company": "Applicable Company",
    "companyPlaceholder": "Select company (leave empty for universal)",
    "format": "Applicable Format",
    "formatPlaceholder": "Select format (optional)",
    "isRegex": "Use Regular Expression",
    "caseSensitive": "Case Sensitive",
    "priority": "Priority",
    "notes": "Notes"
  },
  "dialog": {
    "createTitle": "Add Mapping Rule",
    "editTitle": "Edit Mapping Rule",
    "deleteTitle": "Confirm Deletion",
    "deleteMessage": "Are you sure you want to delete this mapping rule?",
    "testTitle": "Test Rule",
    "testInput": "Enter test text",
    "testResult": "Match Result",
    "bulkImportTitle": "Bulk Import Rules",
    "bulkImportDescription": "Upload a CSV file to import multiple rules"
  },
  "test": {
    "inputPlaceholder": "Enter text to test...",
    "matched": "Matched",
    "notMatched": "Not Matched",
    "matchedRule": "Matched Rule",
    "confidence": "Confidence"
  },
  "chargeTypes": {
    "oceanFreight": "Ocean Freight",
    "airFreight": "Air Freight",
    "documentFee": "Document Fee",
    "customsClearance": "Customs Clearance",
    "handling": "Handling Fee",
    "insurance": "Insurance",
    "storage": "Storage",
    "delivery": "Delivery",
    "other": "Other"
  },
  "learning": {
    "title": "Rule Learning",
    "description": "Rules learned from manual corrections",
    "pendingApproval": "Pending Approval",
    "approved": "Approved",
    "rejected": "Rejected",
    "source": "Learning Source",
    "learnedFrom": "Learned From",
    "corrections": "corrections"
  }
}
```

---

### Phase 9: 報表分析模組翻譯 (45 min) - **NEW**

#### Step 9.1: 建立報表分析翻譯檔案

Create `messages/zh-TW/reports.json`:

```json
{
  "page": {
    "title": "報表分析",
    "description": "查看處理統計和成本分析"
  },
  "tabs": {
    "dashboard": "統計儀表板",
    "costs": "成本報表",
    "audit": "審計報告",
    "performance": "效能分析"
  },
  "dashboard": {
    "title": "處理統計",
    "period": {
      "today": "今日",
      "thisWeek": "本週",
      "thisMonth": "本月",
      "thisQuarter": "本季",
      "thisYear": "今年",
      "custom": "自訂範圍"
    },
    "metrics": {
      "totalProcessed": "總處理數",
      "autoApproved": "自動通過",
      "quickReview": "快速審核",
      "fullReview": "完整審核",
      "failed": "處理失敗",
      "avgProcessingTime": "平均處理時間",
      "avgConfidence": "平均信心度"
    },
    "charts": {
      "processingTrend": "處理趨勢",
      "statusDistribution": "狀態分佈",
      "confidenceDistribution": "信心度分佈",
      "companyComparison": "公司比較"
    }
  },
  "costs": {
    "title": "成本分析",
    "summary": {
      "totalCost": "總成本",
      "avgCostPerInvoice": "平均每張成本",
      "savingsEstimate": "預估節省",
      "manualHoursSaved": "節省人時"
    },
    "breakdown": {
      "byCompany": "按公司",
      "byChargeType": "按費用類型",
      "byMonth": "按月份"
    },
    "export": {
      "exportReport": "匯出報表",
      "format": "格式",
      "dateRange": "日期範圍"
    }
  },
  "audit": {
    "title": "審計報告",
    "filters": {
      "user": "操作用戶",
      "action": "操作類型",
      "dateRange": "日期範圍"
    },
    "actions": {
      "approve": "批准",
      "reject": "拒絕",
      "correct": "修正",
      "escalate": "提交上級"
    },
    "table": {
      "timestamp": "時間",
      "user": "用戶",
      "action": "操作",
      "document": "文件",
      "changes": "變更",
      "reason": "原因"
    }
  },
  "performance": {
    "title": "效能分析",
    "metrics": {
      "ocrAccuracy": "OCR 準確率",
      "mappingAccuracy": "映射準確率",
      "processingSpeed": "處理速度",
      "throughput": "吞吐量"
    },
    "comparison": {
      "vsLastPeriod": "較上期",
      "vsTarget": "較目標",
      "trend": "趨勢"
    }
  },
  "common": {
    "noData": "暫無數據",
    "loading": "載入中...",
    "refresh": "重新整理",
    "export": "匯出",
    "print": "列印"
  }
}
```

Create `messages/en/reports.json`:

```json
{
  "page": {
    "title": "Reports & Analytics",
    "description": "View processing statistics and cost analysis"
  },
  "tabs": {
    "dashboard": "Statistics Dashboard",
    "costs": "Cost Reports",
    "audit": "Audit Reports",
    "performance": "Performance Analysis"
  },
  "dashboard": {
    "title": "Processing Statistics",
    "period": {
      "today": "Today",
      "thisWeek": "This Week",
      "thisMonth": "This Month",
      "thisQuarter": "This Quarter",
      "thisYear": "This Year",
      "custom": "Custom Range"
    },
    "metrics": {
      "totalProcessed": "Total Processed",
      "autoApproved": "Auto Approved",
      "quickReview": "Quick Review",
      "fullReview": "Full Review",
      "failed": "Failed",
      "avgProcessingTime": "Avg Processing Time",
      "avgConfidence": "Avg Confidence"
    },
    "charts": {
      "processingTrend": "Processing Trend",
      "statusDistribution": "Status Distribution",
      "confidenceDistribution": "Confidence Distribution",
      "companyComparison": "Company Comparison"
    }
  },
  "costs": {
    "title": "Cost Analysis",
    "summary": {
      "totalCost": "Total Cost",
      "avgCostPerInvoice": "Avg Cost Per Invoice",
      "savingsEstimate": "Estimated Savings",
      "manualHoursSaved": "Manual Hours Saved"
    },
    "breakdown": {
      "byCompany": "By Company",
      "byChargeType": "By Charge Type",
      "byMonth": "By Month"
    },
    "export": {
      "exportReport": "Export Report",
      "format": "Format",
      "dateRange": "Date Range"
    }
  },
  "audit": {
    "title": "Audit Reports",
    "filters": {
      "user": "User",
      "action": "Action Type",
      "dateRange": "Date Range"
    },
    "actions": {
      "approve": "Approve",
      "reject": "Reject",
      "correct": "Correct",
      "escalate": "Escalate"
    },
    "table": {
      "timestamp": "Timestamp",
      "user": "User",
      "action": "Action",
      "document": "Document",
      "changes": "Changes",
      "reason": "Reason"
    }
  },
  "performance": {
    "title": "Performance Analysis",
    "metrics": {
      "ocrAccuracy": "OCR Accuracy",
      "mappingAccuracy": "Mapping Accuracy",
      "processingSpeed": "Processing Speed",
      "throughput": "Throughput"
    },
    "comparison": {
      "vsLastPeriod": "vs Last Period",
      "vsTarget": "vs Target",
      "trend": "Trend"
    }
  },
  "common": {
    "noData": "No data available",
    "loading": "Loading...",
    "refresh": "Refresh",
    "export": "Export",
    "print": "Print"
  }
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

### P0 - 核心模組翻譯檔案

| File Path | Description |
|-----------|-------------|
| `messages/zh-TW/invoices.json` | 發票模組繁體中文翻譯 |
| `messages/en/invoices.json` | 發票模組英文翻譯 |
| `messages/zh-TW/review.json` | 審核模組繁體中文翻譯 |
| `messages/en/review.json` | 審核模組英文翻譯 |
| `messages/zh-TW/navigation.json` | 導航繁體中文翻譯 |
| `messages/en/navigation.json` | 導航英文翻譯 |
| `messages/zh-TW/dialogs.json` | 對話框繁體中文翻譯 |
| `messages/en/dialogs.json` | 對話框英文翻譯 |

### P1 - 擴展模組翻譯檔案 (NEW)

| File Path | Description |
|-----------|-------------|
| `messages/zh-TW/admin.json` | 管理員模組繁體中文翻譯 |
| `messages/en/admin.json` | 管理員模組英文翻譯 |
| `messages/zh-TW/auth.json` | 認證模組繁體中文翻譯 |
| `messages/en/auth.json` | 認證模組英文翻譯 |
| `messages/zh-TW/companies.json` | 公司管理繁體中文翻譯 |
| `messages/en/companies.json` | 公司管理英文翻譯 |
| `messages/zh-TW/rules.json` | 映射規則繁體中文翻譯 |
| `messages/en/rules.json` | 映射規則英文翻譯 |
| `messages/zh-TW/reports.json` | 報表分析繁體中文翻譯 |
| `messages/en/reports.json` | 報表分析英文翻譯 |

### 代碼檔案更新

| File Path | Description |
|-----------|-------------|
| `src/i18n/request.ts` | 更新：支援多命名空間 |
| `src/app/[locale]/(dashboard)/invoices/page.tsx` | 更新：使用 i18n |
| `src/app/[locale]/(dashboard)/admin/*` | 更新：管理員頁面 i18n |
| `src/app/[locale]/(dashboard)/companies/*` | 更新：公司管理頁面 i18n |
| `src/app/[locale]/(dashboard)/rules/*` | 更新：映射規則頁面 i18n |
| `src/app/[locale]/(dashboard)/reports/*` | 更新：報表分析頁面 i18n |
| `src/components/layouts/Sidebar.tsx` | 更新：使用 i18n |

---

## Next Steps

完成 Story 17-2 後：
1. 進入 **Story 17-3**（驗證訊息與錯誤處理國際化）
2. 進入 **Story 17-4**（日期、數字與貨幣格式化）
3. 進入 **Story 17-5**（語言偏好設置與切換 UI）

---

*Generated by BMAD Method - Create Tech Spec Workflow*
