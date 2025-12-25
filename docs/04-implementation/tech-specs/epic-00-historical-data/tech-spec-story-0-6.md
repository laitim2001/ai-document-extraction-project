# Tech Spec: Story 0.6 - 批量處理公司識別整合

| 屬性 | 值 |
|------|------|
| Story ID | 0.6 |
| Story Key | 0-6-batch-company-integration |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.3 (公司 Profile), Story 0.4 (進度追蹤) |
| 預估工時 | 2-3 天 |
| 優先級 | P0 (必要) |

---

## 目標

將現有的公司識別服務 (`company-auto-create.service.ts`) 整合到批量處理流程中，使得每個文件處理完成後自動識別和建立相關公司 Profile，無需手動操作。

---

## 驗收標準對應

| AC# | 驗收標準 | 實現方式 |
|-----|---------|---------|
| AC1 | 批量處理時自動識別公司 | 修改 `batch-processor.service.ts` 整合公司識別 |
| AC2 | 三層公司匹配策略 | 使用現有 `company-matcher.service.ts` |
| AC3 | 批量結果包含公司統計 | 擴展批量詳情 API 和 UI |
| AC4 | 公司識別可配置 | 擴展 `HistoricalBatch` 配置欄位 |

---

## 數據模型

### Prisma Schema 擴展

```prisma
// prisma/schema.prisma

// === 擴展 HistoricalBatch 配置 ===
model HistoricalBatch {
  // 現有欄位...

  // 公司識別配置
  enableCompanyIdentification Boolean @default(true) @map("enable_company_identification")
  fuzzyMatchThreshold         Float   @default(0.9) @map("fuzzy_match_threshold")
  autoMergeSimilar            Boolean @default(false) @map("auto_merge_similar")

  // 公司統計
  companiesIdentified Int @default(0) @map("companies_identified")
  newCompaniesCreated Int @default(0) @map("new_companies_created")
}

// === 擴展 HistoricalFile 關聯 ===
model HistoricalFile {
  // 現有欄位...

  // 識別到的公司
  identifiedCompanyId String?  @map("identified_company_id")
  identifiedCompany   Company? @relation("FileIdentifiedCompany", fields: [identifiedCompanyId], references: [id])

  // 識別元數據
  companyMatchType    String?  @map("company_match_type") // EXACT, VARIANT, FUZZY, NEW
  companyMatchScore   Float?   @map("company_match_score")
}
```

---

## 類型定義

```typescript
// src/types/batch-company.ts

/**
 * @fileoverview 批量處理公司識別類型定義
 * @module src/types/batch-company
 * @since Epic 0 - Story 0.6
 */

/**
 * 公司匹配類型
 */
export type CompanyMatchType = 'EXACT' | 'VARIANT' | 'FUZZY' | 'NEW';

/**
 * 文件公司識別結果
 */
export interface FileCompanyIdentification {
  fileId: string;
  companyId: string;
  companyName: string;
  matchType: CompanyMatchType;
  matchScore: number;
  isNew: boolean;
}

/**
 * 批量公司識別配置
 */
export interface BatchCompanyConfig {
  enabled: boolean;
  fuzzyThreshold: number;
  autoMergeSimilar: boolean;
}

/**
 * 批量公司統計
 */
export interface BatchCompanyStats {
  totalIdentified: number;
  newCreated: number;
  existingMatched: number;
  matchTypeBreakdown: {
    exact: number;
    variant: number;
    fuzzy: number;
    new: number;
  };
  companyBreakdown: {
    companyId: string;
    companyName: string;
    fileCount: number;
    isNew: boolean;
  }[];
}
```

---

## 實現指南

### Phase 1: 整合到批量處理服務

#### 1.1 修改 batch-processor.service.ts

```typescript
// src/services/batch-processor.service.ts

import { identifyCompaniesFromExtraction } from './company-auto-create.service';
import { prisma } from '@/lib/prisma';

/**
 * 處理單個文件（擴展版本）
 */
async function processFileWithCompanyIdentification(
  file: HistoricalFile,
  batchConfig: BatchCompanyConfig
): Promise<ProcessedResult> {
  // 1. 執行現有的 OCR 處理
  const extractionResult = await performOCR(file);

  // 2. 公司識別（如果啟用）
  let companyIdentification: FileCompanyIdentification | null = null;

  if (batchConfig.enabled && extractionResult) {
    try {
      companyIdentification = await identifyCompanyForFile(
        file.id,
        extractionResult,
        batchConfig.fuzzyThreshold
      );

      // 更新文件記錄
      await prisma.historicalFile.update({
        where: { id: file.id },
        data: {
          identifiedCompanyId: companyIdentification.companyId,
          companyMatchType: companyIdentification.matchType,
          companyMatchScore: companyIdentification.matchScore,
        },
      });
    } catch (error) {
      console.error(`Company identification failed for file ${file.id}:`, error);
      // 不中斷主流程
    }
  }

  return {
    ...extractionResult,
    companyIdentification,
  };
}

/**
 * 識別文件的公司
 */
async function identifyCompanyForFile(
  fileId: string,
  extractionResult: ExtractionResult,
  fuzzyThreshold: number
): Promise<FileCompanyIdentification> {
  // 從提取結果中獲取公司名稱（shipper 或 vendor）
  const companyName = extractionResult.vendor?.name
    || extractionResult.shipper?.name
    || extractionResult.documentInfo?.vendorName;

  if (!companyName) {
    throw new Error('No company name found in extraction result');
  }

  // 調用現有的公司識別服務
  const result = await identifyCompaniesFromExtraction(extractionResult);

  // 返回第一個識別結果
  const primaryCompany = result[0];

  return {
    fileId,
    companyId: primaryCompany.companyId,
    companyName: primaryCompany.companyName,
    matchType: primaryCompany.matchType as CompanyMatchType,
    matchScore: primaryCompany.matchScore,
    isNew: primaryCompany.isNew,
  };
}
```

### Phase 2: 批量配置 UI

#### 2.1 擴展批量上傳對話框

```tsx
// src/components/features/historical-data/BatchUploadDialog.tsx (修改)

interface BatchUploadDialogProps {
  // 現有 props...
}

export function BatchUploadDialog({ ... }: BatchUploadDialogProps) {
  // 新增公司識別配置狀態
  const [companyConfig, setCompanyConfig] = React.useState<BatchCompanyConfig>({
    enabled: true,
    fuzzyThreshold: 0.9,
    autoMergeSimilar: false,
  });

  return (
    <Dialog>
      {/* 現有內容... */}

      {/* 新增公司識別配置區塊 */}
      <div className="space-y-4 border-t pt-4 mt-4">
        <h4 className="font-medium">公司識別設定</h4>

        <div className="flex items-center justify-between">
          <Label>自動識別公司</Label>
          <Switch
            checked={companyConfig.enabled}
            onCheckedChange={(checked) =>
              setCompanyConfig(prev => ({ ...prev, enabled: checked }))
            }
          />
        </div>

        {companyConfig.enabled && (
          <>
            <div className="space-y-2">
              <Label>模糊匹配閾值: {Math.round(companyConfig.fuzzyThreshold * 100)}%</Label>
              <Slider
                value={[companyConfig.fuzzyThreshold]}
                onValueChange={([value]) =>
                  setCompanyConfig(prev => ({ ...prev, fuzzyThreshold: value }))
                }
                min={0.7}
                max={1}
                step={0.05}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>自動合併相似公司</Label>
              <Switch
                checked={companyConfig.autoMergeSimilar}
                onCheckedChange={(checked) =>
                  setCompanyConfig(prev => ({ ...prev, autoMergeSimilar: checked }))
                }
              />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
```

### Phase 3: 公司統計 API

#### 3.1 批量公司統計 API

```typescript
// src/app/api/admin/historical-data/[batchId]/company-stats/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { BatchCompanyStats } from '@/types/batch-company';

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { batchId } = params;

    // 獲取公司統計
    const files = await prisma.historicalFile.findMany({
      where: { batchId },
      select: {
        identifiedCompanyId: true,
        companyMatchType: true,
        identifiedCompany: {
          select: { id: true, name: true, createdAt: true },
        },
      },
    });

    // 聚合統計
    const companyMap = new Map<string, {
      companyId: string;
      companyName: string;
      fileCount: number;
      isNew: boolean;
    }>();

    const matchTypeCount = { exact: 0, variant: 0, fuzzy: 0, new: 0 };

    for (const file of files) {
      if (!file.identifiedCompanyId || !file.identifiedCompany) continue;

      const matchType = (file.companyMatchType?.toLowerCase() ?? 'new') as keyof typeof matchTypeCount;
      matchTypeCount[matchType]++;

      if (!companyMap.has(file.identifiedCompanyId)) {
        companyMap.set(file.identifiedCompanyId, {
          companyId: file.identifiedCompanyId,
          companyName: file.identifiedCompany.name,
          fileCount: 0,
          isNew: file.companyMatchType === 'NEW',
        });
      }
      companyMap.get(file.identifiedCompanyId)!.fileCount++;
    }

    const stats: BatchCompanyStats = {
      totalIdentified: files.filter(f => f.identifiedCompanyId).length,
      newCreated: matchTypeCount.new,
      existingMatched: matchTypeCount.exact + matchTypeCount.variant + matchTypeCount.fuzzy,
      matchTypeBreakdown: matchTypeCount,
      companyBreakdown: Array.from(companyMap.values())
        .sort((a, b) => b.fileCount - a.fileCount),
    };

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching company stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company stats' },
      { status: 500 }
    );
  }
}
```

### Phase 4: 公司統計 UI

#### 4.1 公司統計卡片

```tsx
// src/components/features/historical-data/BatchCompanyStats.tsx

'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, CheckCircle2, Plus, Search } from 'lucide-react';
import type { BatchCompanyStats } from '@/types/batch-company';

interface BatchCompanyStatsProps {
  stats: BatchCompanyStats | null;
  isLoading: boolean;
}

export function BatchCompanyStats({ stats, isLoading }: BatchCompanyStatsProps) {
  if (isLoading) {
    return <div>載入中...</div>;
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 統計卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">識別公司總數</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalIdentified}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">新建公司</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.newCreated}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">匹配現有公司</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.existingMatched}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">匹配類型</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Badge variant="outline">精確 {stats.matchTypeBreakdown.exact}</Badge>
              <Badge variant="outline">變體 {stats.matchTypeBreakdown.variant}</Badge>
              <Badge variant="outline">模糊 {stats.matchTypeBreakdown.fuzzy}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 公司列表 */}
      <Card>
        <CardHeader>
          <CardTitle>公司分佈</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stats.companyBreakdown.slice(0, 10).map((company) => (
              <div
                key={company.companyId}
                className="flex items-center justify-between p-2 rounded border"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{company.companyName}</span>
                  {company.isNew && (
                    <Badge variant="secondary" className="text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      新建
                    </Badge>
                  )}
                </div>
                <Badge>{company.fileCount} 文件</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 驗證清單

### 功能驗證

- [ ] **AC1 批量處理時自動識別公司**
  - [ ] 每個文件處理後識別公司
  - [ ] 識別結果正確關聯到文件
  - [ ] 識別失敗不影響主流程

- [ ] **AC2 三層公司匹配策略**
  - [ ] Exact Match 正確識別
  - [ ] Variant Match 正確識別
  - [ ] Fuzzy Match 使用配置的閾值

- [ ] **AC3 批量結果包含公司統計**
  - [ ] 統計數據準確
  - [ ] UI 正確顯示統計

- [ ] **AC4 公司識別可配置**
  - [ ] 可啟用/禁用識別
  - [ ] 可調整模糊匹配閾值
  - [ ] 配置正確儲存和讀取

### 技術驗證

- [ ] TypeScript 類型檢查通過
- [ ] ESLint 檢查通過
- [ ] Prisma Migration 成功
- [ ] 整合測試通過

---

## 文件清單

### 新增文件

| 文件路徑 | 說明 |
|---------|------|
| `src/types/batch-company.ts` | 批量公司類型定義 |
| `src/app/api/admin/historical-data/[batchId]/company-stats/route.ts` | 公司統計 API |
| `src/components/features/historical-data/BatchCompanyStats.tsx` | 公司統計組件 |

### 修改文件

| 文件路徑 | 說明 |
|---------|------|
| `prisma/schema.prisma` | 擴展 HistoricalBatch 和 HistoricalFile |
| `src/services/batch-processor.service.ts` | 整合公司識別 |
| `src/components/features/historical-data/BatchUploadDialog.tsx` | 添加配置 UI |

---

*Tech Spec 建立日期: 2025-12-25*
*Story Status: backlog*
