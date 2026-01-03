# Tech Spec: Story 13-6 文件預覽整合測試頁面

## 1. Overview

### 1.1 Story 概述
建立一個完整的文件預覽整合測試頁面，整合 Epic 13 所有已完成的組件（PDF 預覽、欄位高亮、提取欄位面板、映射配置），提供端到端的功能測試環境。

### 1.2 目標
- 整合 Epic 13 的 5 個 Story 組件到單一頁面
- 提供完整的文件預覽和映射配置工作流程
- 作為功能驗證和 Demo 展示的基礎

### 1.3 範圍

| 項目 | 描述 |
|------|------|
| **包含** | 頁面路由、三欄佈局、組件整合、狀態管理、文件上傳 |
| **不包含** | 新 API 開發、新組件設計、生產環境審核功能 |

---

## 2. Acceptance Criteria Mapping

| AC ID | 驗收標準 | 實現方式 | 驗證方法 |
|-------|----------|----------|----------|
| AC1 | 頁面路由與權限 | Next.js App Router + 權限中間件 | 訪問測試、角色驗證 |
| AC2 | 文件上傳區塊 | react-dropzone + API 整合 | 上傳測試、格式驗證 |
| AC3 | PDF 預覽整合 | DynamicPDFViewer 組件 | 渲染測試、控制驗證 |
| AC4 | 提取欄位面板整合 | ExtractedFieldsPanel 組件 | 欄位顯示、篩選驗證 |
| AC5 | 映射配置面板整合 | MappingConfigPanel 組件 | 配置操作、預覽驗證 |
| AC6 | 組件互動協調 | Zustand store 狀態管理 | 聯動測試 |
| AC7 | 測試數據支援 | 範例載入 API | 數據載入驗證 |

---

## 3. Implementation Guide

### Phase 1: 頁面基礎架構 [AC1]

#### 3.1.1 建立頁面路由

**檔案**: `src/app/(dashboard)/admin/document-preview-test/page.tsx`

```typescript
/**
 * @fileoverview 文件預覽整合測試頁面
 * @module src/app/(dashboard)/admin/document-preview-test
 * @since Epic 13 - Story 13-6
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DocumentPreviewTestPage } from './DocumentPreviewTestPage';

export const metadata: Metadata = {
  title: '文件預覽整合測試 | Admin',
  description: 'Epic 13 組件整合測試頁面',
};

export default async function Page() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  return <DocumentPreviewTestPage />;
}
```

#### 3.1.2 建立頁面主組件

**檔案**: `src/app/(dashboard)/admin/document-preview-test/DocumentPreviewTestPage.tsx`

```typescript
'use client';

import * as React from 'react';
import { useDocumentPreviewTestStore } from '@/stores/document-preview-test-store';

// 組件導入
import { DynamicPDFViewer, FieldHighlightOverlay, ExtractedFieldsPanel } from '@/components/features/document-preview';
import { MappingConfigPanel } from '@/components/features/mapping-config';
import { TestFileUploader } from './components/TestFileUploader';
import { TestToolbar } from './components/TestToolbar';

export function DocumentPreviewTestPage() {
  const { currentFile, processingStatus, reset } = useDocumentPreviewTestStore();

  return (
    <div className="flex flex-col h-screen">
      {/* 頂部工具列 */}
      <TestToolbar />

      {/* 三欄佈局 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左側：欄位面板 */}
        <aside className="w-[300px] border-r overflow-auto">
          <ExtractedFieldsPanel />
        </aside>

        {/* 中間：PDF 預覽 */}
        <main className="flex-1 overflow-auto relative">
          {currentFile ? (
            <div className="relative">
              <DynamicPDFViewer fileUrl={currentFile.url} />
              <FieldHighlightOverlay />
            </div>
          ) : (
            <TestFileUploader />
          )}
        </main>

        {/* 右側：映射配置 */}
        <aside className="w-[400px] border-l overflow-auto">
          <MappingConfigPanel />
        </aside>
      </div>
    </div>
  );
}
```

#### 3.1.3 建立狀態管理 Store

**檔案**: `src/stores/document-preview-test-store.ts`

```typescript
/**
 * @fileoverview 文件預覽測試頁面狀態管理
 * @module src/stores/document-preview-test-store
 * @since Epic 13 - Story 13-6
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ExtractedField, MappingRule } from '@/types';

interface UploadedFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

interface DocumentPreviewTestState {
  // 文件狀態
  currentFile: UploadedFile | null;
  processingStatus: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  processingError: string | null;

  // 提取結果
  extractedFields: ExtractedField[];
  selectedFieldId: string | null;

  // 映射配置
  currentScope: 'GLOBAL' | 'COMPANY' | 'FORMAT';
  selectedCompanyId: string | null;
  selectedFormatId: string | null;
  mappingRules: MappingRule[];

  // PDF 狀態
  currentPage: number;
  totalPages: number;
  zoomLevel: number;

  // Actions
  setCurrentFile: (file: UploadedFile | null) => void;
  setProcessingStatus: (status: DocumentPreviewTestState['processingStatus']) => void;
  setExtractedFields: (fields: ExtractedField[]) => void;
  setSelectedField: (fieldId: string | null) => void;
  setCurrentScope: (scope: DocumentPreviewTestState['currentScope']) => void;
  setMappingRules: (rules: MappingRule[]) => void;
  setCurrentPage: (page: number) => void;
  setZoomLevel: (level: number) => void;
  reset: () => void;
}

const initialState = {
  currentFile: null,
  processingStatus: 'idle' as const,
  processingError: null,
  extractedFields: [],
  selectedFieldId: null,
  currentScope: 'GLOBAL' as const,
  selectedCompanyId: null,
  selectedFormatId: null,
  mappingRules: [],
  currentPage: 1,
  totalPages: 0,
  zoomLevel: 100,
};

export const useDocumentPreviewTestStore = create<DocumentPreviewTestState>()(
  devtools(
    (set) => ({
      ...initialState,

      setCurrentFile: (file) => set({ currentFile: file }),
      setProcessingStatus: (status) => set({ processingStatus: status }),
      setExtractedFields: (fields) => set({ extractedFields: fields }),
      setSelectedField: (fieldId) => set({ selectedFieldId: fieldId }),
      setCurrentScope: (scope) => set({ currentScope: scope }),
      setMappingRules: (rules) => set({ mappingRules: rules }),
      setCurrentPage: (page) => set({ currentPage: page }),
      setZoomLevel: (level) => set({ zoomLevel: level }),
      reset: () => set(initialState),
    }),
    { name: 'document-preview-test-store' }
  )
);
```

### Phase 2: 文件上傳模組 [AC2]

#### 3.2.1 建立上傳組件

**檔案**: `src/app/(dashboard)/admin/document-preview-test/components/TestFileUploader.tsx`

```typescript
'use client';

import * as React from 'react';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocumentPreviewTestStore } from '@/stores/document-preview-test-store';
import { useToast } from '@/hooks/use-toast';

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

export function TestFileUploader() {
  const { processingStatus, setCurrentFile, setProcessingStatus, setExtractedFields } = useDocumentPreviewTestStore();
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setProcessingStatus('uploading');

    try {
      // 上傳文件
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('上傳失敗');

      const { data: uploadedFile } = await uploadRes.json();
      setCurrentFile(uploadedFile);
      setProcessingStatus('processing');

      // 輪詢處理狀態
      await pollProcessingStatus(uploadedFile.id);

    } catch (error) {
      setProcessingStatus('error');
      toast({
        title: '上傳失敗',
        description: error instanceof Error ? error.message : '未知錯誤',
        variant: 'destructive',
      });
    }
  }, [setCurrentFile, setProcessingStatus, toast]);

  const pollProcessingStatus = async (fileId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const res = await fetch(`/api/v1/documents/${fileId}`);
      const { data } = await res.json();

      if (data.status === 'COMPLETED') {
        setExtractedFields(data.extractedFields || []);
        setProcessingStatus('completed');
        return;
      }

      if (data.status === 'ERROR') {
        throw new Error(data.errorMessage || '處理失敗');
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('處理超時');
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    disabled: processingStatus === 'uploading' || processingStatus === 'processing',
  });

  const isLoading = processingStatus === 'uploading' || processingStatus === 'processing';

  return (
    <div className="flex items-center justify-center h-full p-8">
      <Card
        {...getRootProps()}
        className={`w-full max-w-lg cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-dashed'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <input {...getInputProps()} />

          {isLoading ? (
            <>
              <Loader2 className="h-12 w-12 text-muted-foreground animate-spin mb-4" />
              <p className="text-lg font-medium">
                {processingStatus === 'uploading' ? '上傳中...' : '處理中...'}
              </p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                {isDragActive ? '放開以上傳文件' : '拖放文件至此處'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                或點擊選擇文件（PDF、PNG、JPG）
              </p>
              <Button variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                選擇文件
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Phase 3: 工具列與輔助功能 [AC7]

#### 3.3.1 建立工具列組件

**檔案**: `src/app/(dashboard)/admin/document-preview-test/components/TestToolbar.tsx`

```typescript
'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, FileInput, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentPreviewTestStore } from '@/stores/document-preview-test-store';
import { useToast } from '@/hooks/use-toast';

export function TestToolbar() {
  const { currentFile, reset } = useDocumentPreviewTestStore();
  const { toast } = useToast();

  const handleLoadSample = async () => {
    try {
      // 載入範例數據
      const res = await fetch('/api/v1/test/sample-document');
      if (!res.ok) throw new Error('載入範例失敗');

      const { data } = await res.json();
      // 更新 store 狀態
      toast({ title: '已載入範例文件' });
    } catch (error) {
      toast({
        title: '載入失敗',
        description: error instanceof Error ? error.message : '未知錯誤',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    reset();
    toast({ title: '已重置測試環境' });
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b bg-background">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回管理後台
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">🔧 文件預覽整合測試</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleLoadSample}>
          <FileInput className="mr-2 h-4 w-4" />
          載入範例
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={!currentFile}>
          <RotateCcw className="mr-2 h-4 w-4" />
          重置
        </Button>
      </div>
    </header>
  );
}
```

---

## 4. Project Structure

```
src/
├── app/(dashboard)/admin/document-preview-test/
│   ├── page.tsx                      # 頁面入口（權限檢查）
│   ├── DocumentPreviewTestPage.tsx   # 頁面主組件
│   └── components/
│       ├── TestFileUploader.tsx      # 文件上傳組件
│       ├── TestToolbar.tsx           # 頂部工具列
│       └── index.ts                  # 組件導出
│
├── stores/
│   └── document-preview-test-store.ts  # 頁面狀態管理
│
└── components/features/
    ├── document-preview/             # Story 13-1, 13-2 組件（已存在）
    └── mapping-config/               # Story 13-3 組件（已存在）
```

---

## 5. API Endpoints Used

### 5.1 文件上傳與處理

| 端點 | 方法 | 用途 | 狀態 |
|------|------|------|------|
| `/api/v1/documents/upload` | POST | 上傳文件 | 已存在 |
| `/api/v1/documents/[id]` | GET | 獲取文件詳情 | 已存在 |

### 5.2 映射配置

| 端點 | 方法 | 用途 | 狀態 |
|------|------|------|------|
| `/api/v1/field-mapping-configs` | GET | 獲取配置列表 | 已存在 |
| `/api/v1/field-mapping-configs/[id]/test` | POST | 測試配置 | 已存在 |

### 5.3 測試輔助（可選新增）

| 端點 | 方法 | 用途 | 狀態 |
|------|------|------|------|
| `/api/v1/test/sample-document` | GET | 獲取範例文件 | 新增 |

---

## 6. Verification Checklist

### 6.1 功能驗證

- [ ] 頁面可正常訪問 `/admin/document-preview-test`
- [ ] 非 ADMIN 用戶被重定向
- [ ] 文件上傳功能正常
- [ ] PDF 預覽正確顯示
- [ ] 欄位高亮正確渲染
- [ ] 欄位面板顯示提取結果
- [ ] 欄位點擊觸發 PDF 高亮
- [ ] 映射配置面板功能正常
- [ ] 三層作用域切換正常
- [ ] 重置功能正常

### 6.2 整合驗證

- [ ] DynamicPDFViewer 正確載入
- [ ] FieldHighlightOverlay 正確覆蓋
- [ ] ExtractedFieldsPanel 正確顯示
- [ ] MappingConfigPanel 正確運作
- [ ] Zustand store 狀態同步正確
- [ ] 組件間通訊無阻塞

### 6.3 代碼品質

- [ ] TypeScript 類型檢查通過
- [ ] ESLint 檢查通過
- [ ] 無 console.log 殘留
- [ ] 標準 JSDoc 註釋完整

---

## 7. Dependencies

### 7.1 前置完成項

| Story | 狀態 | 依賴組件 |
|-------|------|----------|
| 13-1 | ✅ | PDFViewer, FieldHighlightOverlay |
| 13-2 | ✅ | ExtractedFieldsPanel, FieldCard |
| 13-3 | ✅ | MappingConfigPanel, RuleEditor |
| 13-4 | ✅ | 自動高亮規則引擎 |
| 13-5 | ✅ | 預覽快取優化 |

### 7.2 技術依賴

| 套件 | 版本 | 用途 |
|------|------|------|
| react-pdf | ^7.x | PDF 渲染 |
| react-dropzone | ^14.x | 文件拖放上傳 |
| zustand | ^4.x | 狀態管理 |
| @dnd-kit/core | ^6.x | 拖放排序 |

---

## 8. Risk Mitigation

| 風險 | 影響 | 緩解措施 |
|------|------|----------|
| 組件版本不相容 | 中 | 使用現有已測試組件，不做修改 |
| 狀態管理衝突 | 中 | 建立獨立 store，避免與現有 store 衝突 |
| 大文件處理緩慢 | 低 | 使用 Story 13-5 的快取優化 |
| 權限繞過 | 高 | Server Component 權限檢查 |

---

## 9. Metadata

| 項目 | 值 |
|------|-----|
| Tech Spec 版本 | 1.0.0 |
| Story ID | 13-6 |
| 建立日期 | 2026-01-03 |
| 作者 | Development Team |
| 審核狀態 | Draft |
