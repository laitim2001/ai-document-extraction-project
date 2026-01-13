# Tech Spec: Story 16.4 - 專屬配置關聯

> **Version**: 1.0.0
> **Created**: 2026-01-12
> **Status**: Draft
> **Story Key**: STORY-16-4

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 16.4 |
| **Epic** | Epic 16 - 文件格式管理 |
| **Estimated Effort** | 5 Story Points |
| **Dependencies** | Story 16-2（格式詳情與編輯）, Epic 14（PromptConfig）, Story 13-4（FieldMappingConfig） |
| **Blocking** | 無 |

---

## Objective

在格式詳情頁新增「專屬配置」Tab，顯示已關聯的 PromptConfig 和 FieldMappingConfig（scope=FORMAT），並提供快速創建/編輯入口。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-16.4.1 | 專屬配置 Tab | FormatDetailView 新增 Tab |
| AC-16.4.2 | Prompt 配置顯示 | LinkedPromptConfig 組件 |
| AC-16.4.3 | 映射配置顯示 | LinkedMappingConfig 組件 |
| AC-16.4.4 | 快速創建入口 | 跳轉到配置頁面（預填參數） |
| AC-16.4.5 | 編輯入口 | 跳轉到配置編輯頁面 |
| AC-16.4.6 | 配置繼承說明 | ConfigInheritanceInfo 組件 |

---

## Implementation Guide

### Phase 1: API 端點 (1.5 points)

#### 1.1 GET /api/v1/formats/[id]/configs

```typescript
// src/app/api/v1/formats/[id]/configs/route.ts

/**
 * @fileoverview 格式關聯配置 API
 * @module src/app/api/v1/formats/[id]/configs
 * @since Epic 16 - Story 16.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createApiResponse, createApiError } from '@/lib/api/response';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const format = await prisma.documentFormat.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (!format) {
      return NextResponse.json(
        createApiError({
          type: 'NOT_FOUND',
          title: 'Format not found',
          status: 404,
        }),
        { status: 404 }
      );
    }

    // 查詢 FORMAT 級別的 Prompt 配置
    const promptConfigs = await prisma.promptConfig.findMany({
      where: {
        documentFormatId: format.id,
        scope: 'FORMAT',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        promptType: true,
        scope: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // 查詢 FORMAT 級別的 FieldMapping 配置
    const fieldMappingConfigs = await prisma.fieldMappingConfig.findMany({
      where: {
        documentFormatId: format.id,
        scope: 'FORMAT',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        scope: true,
        isActive: true,
        updatedAt: true,
        _count: {
          select: { rules: true },
        },
      },
    });

    // 查詢 COMPANY 級別配置（用於顯示繼承）
    const companyPromptConfigs = await prisma.promptConfig.findMany({
      where: {
        companyId: format.companyId,
        scope: 'COMPANY',
        isActive: true,
      },
      select: { id: true, promptType: true },
    });

    const companyMappingConfigs = await prisma.fieldMappingConfig.findMany({
      where: {
        companyId: format.companyId,
        scope: 'COMPANY',
        isActive: true,
      },
      select: { id: true },
    });

    // 查詢 GLOBAL 級別配置
    const globalPromptConfigs = await prisma.promptConfig.findMany({
      where: {
        scope: 'GLOBAL',
        isActive: true,
      },
      select: { id: true, promptType: true },
    });

    const globalMappingConfigs = await prisma.fieldMappingConfig.findMany({
      where: {
        scope: 'GLOBAL',
        isActive: true,
      },
      select: { id: true },
    });

    // 計算繼承關係
    const inheritance = {
      hasFormatPrompt: promptConfigs.length > 0,
      hasCompanyPrompt: companyPromptConfigs.length > 0,
      hasGlobalPrompt: globalPromptConfigs.length > 0,
      hasFormatMapping: fieldMappingConfigs.length > 0,
      hasCompanyMapping: companyMappingConfigs.length > 0,
      hasGlobalMapping: globalMappingConfigs.length > 0,
      effectivePromptLevel: promptConfigs.length > 0
        ? 'FORMAT'
        : companyPromptConfigs.length > 0
        ? 'COMPANY'
        : globalPromptConfigs.length > 0
        ? 'GLOBAL'
        : 'NONE',
      effectiveMappingLevel: fieldMappingConfigs.length > 0
        ? 'FORMAT'
        : companyMappingConfigs.length > 0
        ? 'COMPANY'
        : globalMappingConfigs.length > 0
        ? 'GLOBAL'
        : 'NONE',
    };

    return NextResponse.json(
      createApiResponse({
        promptConfigs: promptConfigs.map((c) => ({
          ...c,
        })),
        fieldMappingConfigs: fieldMappingConfigs.map((c) => ({
          ...c,
          rulesCount: c._count.rules,
        })),
        inheritance,
      })
    );
  } catch (error) {
    return NextResponse.json(
      createApiError(error),
      { status: 500 }
    );
  }
}
```

### Phase 2: 專屬配置面板 (1 point)

#### 2.1 FormatConfigPanel

```typescript
// src/components/features/formats/FormatConfigPanel.tsx

/**
 * @fileoverview 格式專屬配置面板
 * @module src/components/features/formats
 * @since Epic 16 - Story 16.4
 */

'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LinkedPromptConfig } from './LinkedPromptConfig';
import { LinkedMappingConfig } from './LinkedMappingConfig';
import { ConfigInheritanceInfo } from './ConfigInheritanceInfo';

export interface FormatConfigPanelProps {
  formatId: string;
  companyId: string;
}

export function FormatConfigPanel({ formatId, companyId }: FormatConfigPanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['format-configs', formatId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/formats/${formatId}/configs`);
      if (!response.ok) {
        throw new Error('Failed to fetch configs');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return <FormatConfigPanelSkeleton />;
  }

  if (error) {
    return (
      <div className="text-destructive">
        載入配置失敗: {error instanceof Error ? error.message : '未知錯誤'}
      </div>
    );
  }

  const { promptConfigs, fieldMappingConfigs, inheritance } = data.data;

  return (
    <div className="space-y-6">
      {/* 繼承說明 */}
      <ConfigInheritanceInfo inheritance={inheritance} />

      {/* Prompt 配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prompt 配置</CardTitle>
        </CardHeader>
        <CardContent>
          <LinkedPromptConfig
            configs={promptConfigs}
            formatId={formatId}
            companyId={companyId}
            effectiveLevel={inheritance.effectivePromptLevel}
          />
        </CardContent>
      </Card>

      {/* 映射配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">欄位映射配置</CardTitle>
        </CardHeader>
        <CardContent>
          <LinkedMappingConfig
            configs={fieldMappingConfigs}
            formatId={formatId}
            companyId={companyId}
            effectiveLevel={inheritance.effectiveMappingLevel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

### Phase 3: Prompt 配置卡片 (1 point)

#### 3.1 LinkedPromptConfig

```typescript
// src/components/features/formats/LinkedPromptConfig.tsx

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, ExternalLink, Plus } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export interface LinkedPromptConfigProps {
  configs: Array<{
    id: string;
    name: string;
    promptType: string;
    isActive: boolean;
    updatedAt: string;
  }>;
  formatId: string;
  companyId: string;
  effectiveLevel: 'FORMAT' | 'COMPANY' | 'GLOBAL' | 'NONE';
}

export function LinkedPromptConfig({
  configs,
  formatId,
  companyId,
  effectiveLevel,
}: LinkedPromptConfigProps) {
  const router = useRouter();

  const handleCreate = () => {
    // 跳轉到 Prompt 配置創建頁面，預填參數
    const params = new URLSearchParams({
      scope: 'FORMAT',
      companyId,
      documentFormatId: formatId,
    });
    router.push(`/admin/prompt-configs/new?${params}`);
  };

  const handleEdit = (configId: string) => {
    router.push(`/admin/prompt-configs/${configId}`);
  };

  if (configs.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <X className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-4">
          尚未配置格式專屬的 Prompt
          {effectiveLevel !== 'NONE' && (
            <span className="block mt-1">
              目前使用 <Badge variant="outline">{effectiveLevel}</Badge> 級別配置
            </span>
          )}
        </p>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          創建 Prompt 配置
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {configs.map((config) => (
        <div
          key={config.id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Check className="h-4 w-4 text-green-500" />
            <div>
              <p className="font-medium">{config.name}</p>
              <p className="text-xs text-muted-foreground">
                類型: {config.promptType} | 更新: {formatDateTime(config.updatedAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(config.id)}
            >
              編輯
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Phase 4: 映射配置卡片 (1 point)

#### 4.1 LinkedMappingConfig

```typescript
// src/components/features/formats/LinkedMappingConfig.tsx

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, ExternalLink, Plus } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export interface LinkedMappingConfigProps {
  configs: Array<{
    id: string;
    name: string;
    rulesCount: number;
    isActive: boolean;
    updatedAt: string;
  }>;
  formatId: string;
  companyId: string;
  effectiveLevel: 'FORMAT' | 'COMPANY' | 'GLOBAL' | 'NONE';
}

export function LinkedMappingConfig({
  configs,
  formatId,
  companyId,
  effectiveLevel,
}: LinkedMappingConfigProps) {
  const router = useRouter();

  const handleCreate = () => {
    // 跳轉到映射配置創建頁面，預填參數
    const params = new URLSearchParams({
      scope: 'FORMAT',
      companyId,
      documentFormatId: formatId,
    });
    router.push(`/admin/field-mapping-configs/new?${params}`);
  };

  const handleEdit = (configId: string) => {
    router.push(`/admin/field-mapping-configs/${configId}`);
  };

  if (configs.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <X className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-4">
          尚未配置格式專屬的欄位映射
          {effectiveLevel !== 'NONE' && (
            <span className="block mt-1">
              目前使用 <Badge variant="outline">{effectiveLevel}</Badge> 級別配置
            </span>
          )}
        </p>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          創建映射配置
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {configs.map((config) => (
        <div
          key={config.id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Check className="h-4 w-4 text-green-500" />
            <div>
              <p className="font-medium">{config.name}</p>
              <p className="text-xs text-muted-foreground">
                規則: {config.rulesCount} 個 | 更新: {formatDateTime(config.updatedAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(config.id)}
            >
              編輯
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Phase 5: 繼承說明組件 (0.5 points)

#### 5.1 ConfigInheritanceInfo

```typescript
// src/components/features/formats/ConfigInheritanceInfo.tsx

'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export interface ConfigInheritance {
  effectivePromptLevel: 'FORMAT' | 'COMPANY' | 'GLOBAL' | 'NONE';
  effectiveMappingLevel: 'FORMAT' | 'COMPANY' | 'GLOBAL' | 'NONE';
}

export interface ConfigInheritanceInfoProps {
  inheritance: ConfigInheritance;
}

export function ConfigInheritanceInfo({ inheritance }: ConfigInheritanceInfoProps) {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>配置優先級說明</AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-1 text-sm">
          <p>
            <strong>FORMAT</strong> &gt; <strong>COMPANY</strong> &gt; <strong>GLOBAL</strong>
          </p>
          <p>
            格式專屬配置（FORMAT）優先級最高。如未配置，會使用公司級（COMPANY）或全局（GLOBAL）配置。
          </p>
          <div className="mt-2 pt-2 border-t">
            <p>
              Prompt: 目前使用{' '}
              <strong>
                {inheritance.effectivePromptLevel === 'NONE'
                  ? '預設'
                  : inheritance.effectivePromptLevel}
              </strong>{' '}
              配置
            </p>
            <p>
              映射: 目前使用{' '}
              <strong>
                {inheritance.effectiveMappingLevel === 'NONE'
                  ? '預設'
                  : inheritance.effectiveMappingLevel}
              </strong>{' '}
              配置
            </p>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

---

## File Structure

```
src/
├── app/api/v1/formats/[id]/
│   ├── route.ts
│   └── configs/
│       └── route.ts              # 新增
├── components/features/formats/
│   ├── FormatConfigPanel.tsx     # 新增
│   ├── LinkedPromptConfig.tsx    # 新增
│   ├── LinkedMappingConfig.tsx   # 新增
│   └── ConfigInheritanceInfo.tsx # 新增
└── components/features/forwarders/
    └── ForwarderDetailView.tsx   # 更新（新增 Tab）
```

---

## Testing Checklist

- [ ] TypeScript 類型檢查通過
- [ ] ESLint 檢查通過
- [ ] API 正確返回關聯配置
- [ ] 有配置時正確顯示
- [ ] 無配置時顯示創建按鈕
- [ ] 創建按鈕正確預填參數
- [ ] 編輯按鈕正確跳轉
- [ ] 繼承說明正確顯示
