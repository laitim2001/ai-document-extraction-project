# AI Document Extraction Project - 編碼規範

> 本文件定義項目的編碼標準和最佳實踐，確保代碼質量和團隊協作效率。

---

## 目錄

1. [文件註釋規範](#1-文件註釋規範)
2. [命名規範](#2-命名規範)
3. [TypeScript 規範](#3-typescript-規範)
4. [React/Next.js 規範](#4-reactnextjs-規範)
5. [API 設計規範](#5-api-設計規範)
6. [資料庫規範](#6-資料庫規範)
7. [測試規範](#7-測試規範)
8. [Git 規範](#8-git-規範)
9. [目錄結構規範](#9-目錄結構規範)

---

## 1. 文件註釋規範

### 1.1 文件頭部註釋（必須）

所有業務邏輯文件必須包含標準 JSDoc 頭部註釋。此規範確保代碼可讀性和可維護性。

#### 完整模板

```typescript
/**
 * @fileoverview [文件的主要目的和功能概述 - 一句話說明]
 * @description
 *   [更詳細的描述，包含：]
 *   - 主要功能說明
 *   - 設計決策說明（如：為什麼選擇這種實現方式）
 *   - 重要注意事項和限制
 *   - 與其他模組的交互關係
 *
 * @module [模組路徑，如 src/services/mapping]
 * @author [作者或團隊名稱]
 * @since [Epic X - Story X.X (功能名稱)]
 * @lastModified [最後修改日期 YYYY-MM-DD]
 *
 * @features
 *   - [功能點 1]
 *   - [功能點 2]
 *   - [功能點 3]
 *
 * @dependencies
 *   - [依賴包名] - [用途說明]
 *   - [依賴包名] - [用途說明]
 *
 * @related
 *   - [相關文件路徑 1] - [關係說明]
 *   - [相關文件路徑 2] - [關係說明]
 *
 * @example
 *   // 可選：展示基本使用方式
 *   import { functionName } from '@/services/example';
 *   const result = await functionName(params);
 */
```

#### 實際範例

```typescript
/**
 * @fileoverview 三層映射服務核心實現
 * @description
 *   本模組實現了 AI Document Extraction 系統的核心映射邏輯，
 *   採用三層架構處理發票術語到統一 Header 的映射：
 *   - Tier 1: Universal Mapping（通用映射）
 *   - Tier 2: Forwarder-Specific Override（特定覆蓋）
 *   - Tier 3: LLM Classification（AI 智能分類）
 *
 *   設計考量：
 *   - 採用分層架構降低維護成本（從 9000 條規則降至約 800 條）
 *   - 每層獨立可測試，便於調試和優化
 *   - 信心度評分機制確保人工審核效率
 *
 * @module src/services/mapping
 * @author Development Team
 * @since Epic 6 - Story 6.1 (AI Classification Engine)
 * @lastModified 2025-12-17
 *
 * @features
 *   - 三層映射查詢邏輯
 *   - 信心度評分計算
 *   - 映射結果快取機制
 *   - 人工修正學習接口
 *
 * @dependencies
 *   - prisma - 資料庫訪問
 *   - openai - GPT-5.2 API 調用
 *   - zod - 輸入驗證
 *
 * @related
 *   - src/services/ocr/index.ts - OCR 提取服務（上游）
 *   - src/services/review/index.ts - 審核服務（下游）
 *   - src/types/mapping.ts - 類型定義
 */
```

### 1.2 適用範圍矩陣

| 文件位置 | 文件類型 | 註釋要求 | 範例 |
|---------|---------|---------|------|
| `src/services/` | 業務邏輯服務 | ✅ 完整頭部 | `mapping-service.ts` |
| `src/app/api/` | API 路由 | ✅ 完整頭部 | `route.ts` |
| `src/hooks/` | 自定義 Hooks | ✅ 完整頭部 | `use-documents.ts` |
| `src/lib/` | 工具函數 | ✅ 完整頭部 | `confidence-calculator.ts` |
| `src/components/features/` | 功能組件 | ✅ 完整頭部 | `DocumentUploadForm.tsx` |
| `src/components/ui/` | UI 基礎組件 | ❌ 不需要 | shadcn/ui 組件 |
| `src/types/` | 類型定義 | ⚠️ 簡化版 | `mapping.ts` |
| `src/validations/` | Zod Schema | ⚠️ 簡化版 | `document.ts` |
| `src/stores/` | Zustand Store | ✅ 完整頭部 | `document-store.ts` |
| `tests/` | 測試文件 | ⚠️ 簡化版 | `*.test.ts` |

### 1.3 簡化版頭部（用於類型文件）

```typescript
/**
 * @fileoverview 文件映射相關的 TypeScript 類型定義
 * @module src/types/mapping
 * @since Epic 6 - Story 6.1
 */
```

### 1.4 函數/方法註釋

#### 公開函數（必須）

```typescript
/**
 * 計算映射結果的信心度評分
 *
 * @description
 *   根據映射來源層級和匹配程度計算 0-100 的信心度評分。
 *   評分邏輯：
 *   - Tier 1 (Universal): 基礎分 85-100
 *   - Tier 2 (Forwarder-Specific): 基礎分 90-100
 *   - Tier 3 (LLM): 基於模型返回的置信度，範圍 50-95
 *
 * @param mappingResult - 映射查詢結果
 * @param matchDetails - 匹配詳情（模糊匹配程度、上下文相關性）
 * @returns 0-100 的信心度評分
 *
 * @throws {ValidationError} 當 mappingResult 格式無效時
 *
 * @example
 *   const score = calculateConfidenceScore(result, details);
 *   if (score >= 90) {
 *     // 自動通過
 *   }
 */
export function calculateConfidenceScore(
  mappingResult: MappingResult,
  matchDetails: MatchDetails
): number {
  // 實現...
}
```

#### 私有函數（建議）

```typescript
/**
 * 從快取獲取映射結果（內部使用）
 * @internal
 */
function getCachedMapping(key: string): MappingResult | null {
  // 實現...
}
```

### 1.5 段落/區塊註釋

```typescript
// ============================================================
// 三層映射查詢邏輯
// ============================================================

// --- Tier 1: Universal Mapping ---
const universalResult = await queryUniversalMapping(term);

// --- Tier 2: Forwarder-Specific Override ---
if (!universalResult || universalResult.confidence < threshold) {
  const forwarderResult = await queryForwarderMapping(term, forwarderId);
}

// --- Tier 3: LLM Classification (Fallback) ---
if (needLLMFallback) {
  // 使用 GPT-5.2 進行智能分類
  // 注意：此操作會產生 API 費用
  const llmResult = await classifyWithLLM(term, context);
}
```

### 1.6 TODO 註釋格式

```typescript
// TODO(username): 描述需要做的事情
// TODO(username, 2025-01-15): 帶截止日期的待辦
// FIXME(username): 需要修復的問題
// HACK(username): 臨時解決方案，需要重構
// NOTE: 重要說明
// OPTIMIZE: 可以優化的地方
```

---

## 2. 命名規範

### 2.1 文件命名

| 類型 | 規範 | 範例 |
|------|------|------|
| 組件文件 | PascalCase | `DocumentUploadForm.tsx` |
| Hook 文件 | kebab-case，use- 前綴 | `use-document-upload.ts` |
| 工具函數 | kebab-case | `confidence-calculator.ts` |
| 服務文件 | kebab-case | `mapping-service.ts` |
| 類型文件 | kebab-case | `document.types.ts` |
| 測試文件 | kebab-case，.test 後綴 | `mapping-service.test.ts` |
| API 路由 | route.ts（Next.js 約定） | `route.ts` |

### 2.2 變數和函數命名

```typescript
// 變數：camelCase
const documentList: Document[] = [];
const isProcessing: boolean = false;
const totalCount: number = 0;

// 函數：camelCase，動詞開頭
function calculateConfidence() {}
function validateDocument() {}
async function fetchDocuments() {}

// 事件處理器：handle + 事件名
function handleSubmit() {}
function handleFileChange() {}
function handleRowClick() {}

// 布林值：is/has/can/should 前綴
const isLoading = true;
const hasError = false;
const canEdit = true;
const shouldRefresh = false;
```

### 2.3 常數命名

```typescript
// 全局常數：UPPER_SNAKE_CASE
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const CONFIDENCE_THRESHOLD_HIGH = 90;
export const CONFIDENCE_THRESHOLD_MEDIUM = 70;
export const API_VERSION = 'v1';

// 配置物件：PascalCase + 全大寫屬性
export const ConfidenceThresholds = {
  AUTO_APPROVE: 90,
  QUICK_REVIEW: 70,
  FULL_REVIEW: 0,
} as const;
```

### 2.4 類型和介面命名

```typescript
// Interface：PascalCase，名詞
interface Document {
  id: string;
  fileName: string;
}

// Type alias：PascalCase
type DocumentStatus = 'pending' | 'processing' | 'completed' | 'error';
type ConfidenceLevel = 'high' | 'medium' | 'low';

// Props 類型：組件名 + Props
interface DocumentCardProps {
  document: Document;
  onSelect: (id: string) => void;
}

// Enum：PascalCase，值為 UPPER_SNAKE_CASE
enum UserRole {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  OPERATOR = 'OPERATOR',
}

// API 響應類型：響應名 + Response
interface DocumentListResponse {
  documents: Document[];
  pagination: Pagination;
}
```

---

## 3. TypeScript 規範

### 3.1 類型定義優先級

```typescript
// 1. 優先使用 interface（可擴展）
interface Document {
  id: string;
  fileName: string;
  createdAt: Date;
}

// 2. 使用 type 定義聯合類型、交叉類型
type Status = 'pending' | 'completed' | 'error';
type DocumentWithMeta = Document & { metadata: Metadata };

// 3. 使用 Zod 進行運行時驗證
const DocumentSchema = z.object({
  id: z.string().cuid(),
  fileName: z.string().min(1).max(255),
  status: z.enum(['pending', 'completed', 'error']),
});
type DocumentInput = z.infer<typeof DocumentSchema>;
```

### 3.2 嚴格模式規則

```typescript
// ❌ 禁止使用 any
function process(data: any) { }

// ✅ 使用具體類型
function process(data: Document) { }

// ✅ 使用 unknown + 類型守衛
function process(data: unknown) {
  if (isDocument(data)) {
    // data 現在是 Document 類型
  }
}

// ❌ 禁止非空斷言（除非確定安全）
const value = obj!.property;

// ✅ 使用可選鏈和空值合併
const value = obj?.property ?? defaultValue;

// ❌ 禁止隱式 any
function process(data) { }

// ✅ 明確類型聲明
function process(data: Document): ProcessResult { }
```

### 3.3 泛型使用

```typescript
// 有意義的泛型名稱
interface ApiResponse<TData, TError = ApiError> {
  success: boolean;
  data?: TData;
  error?: TError;
}

// 泛型約束
function getProperty<T extends object, K extends keyof T>(
  obj: T,
  key: K
): T[K] {
  return obj[key];
}

// 泛型工具類型
type Nullable<T> = T | null;
type Optional<T> = T | undefined;
```

### 3.4 類型守衛

```typescript
// 類型守衛函數
function isDocument(value: unknown): value is Document {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'fileName' in value
  );
}

// 使用 Zod 進行類型守衛
function isValidDocument(value: unknown): value is Document {
  return DocumentSchema.safeParse(value).success;
}
```

---

## 4. React/Next.js 規範

### 4.1 組件結構

```typescript
'use client'; // 客戶端組件聲明（如需要）

// ============================================================
// Imports（按順序排列）
// ============================================================

// 1. React/Next.js
import * as React from 'react';
import { useRouter } from 'next/navigation';

// 2. 第三方庫
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// 3. 本地組件
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// 4. Hooks
import { useDocuments } from '@/hooks/use-documents';

// 5. Utils/Services
import { cn } from '@/lib/utils';
import { documentApi } from '@/lib/api/documents';

// 6. Types
import type { Document } from '@/types/document';

// ============================================================
// Types
// ============================================================

interface DocumentCardProps {
  document: Document;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

// ============================================================
// Component
// ============================================================

/**
 * @component DocumentCard
 * @description 文件卡片組件，顯示單個文件的基本信息
 */
export function DocumentCard({
  document,
  isSelected = false,
  onSelect,
}: DocumentCardProps) {
  // --- Hooks ---
  const router = useRouter();

  // --- State ---
  const [isHovered, setIsHovered] = React.useState(false);

  // --- Handlers ---
  const handleClick = React.useCallback(() => {
    onSelect?.(document.id);
  }, [document.id, onSelect]);

  // --- Render ---
  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-colors',
        isSelected && 'ring-2 ring-primary',
        isHovered && 'bg-accent'
      )}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <h3>{document.fileName}</h3>
      {/* ... */}
    </Card>
  );
}
```

### 4.2 Server Components vs Client Components

```typescript
// ✅ Server Component（預設）- 數據獲取
// src/app/documents/page.tsx
import { prisma } from '@/lib/prisma';
import { DocumentList } from '@/components/features/document-list';

export default async function DocumentsPage() {
  const documents = await prisma.document.findMany();
  return <DocumentList documents={documents} />;
}

// ✅ Client Component - 互動邏輯
// src/components/features/document-list.tsx
'use client';

import { useState } from 'react';

export function DocumentList({ documents }: { documents: Document[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  // 互動邏輯...
}
```

### 4.3 Hooks 規範

```typescript
/**
 * @fileoverview 文件列表數據獲取 Hook
 * @module src/hooks/use-documents
 * @since Epic 2 - Story 2.1
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentApi } from '@/lib/api/documents';
import type { Document, DocumentFilters } from '@/types/document';

/**
 * 獲取文件列表
 */
export function useDocuments(filters?: DocumentFilters) {
  return useQuery({
    queryKey: ['documents', filters],
    queryFn: () => documentApi.list(filters),
    staleTime: 5 * 60 * 1000, // 5 分鐘
  });
}

/**
 * 刪除文件
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: documentApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
```

---

## 5. API 設計規範

### 5.1 路由結構

```
src/app/api/
├── v1/
│   ├── documents/
│   │   ├── route.ts              # GET /api/v1/documents (list)
│   │   │                         # POST /api/v1/documents (create)
│   │   ├── [id]/
│   │   │   ├── route.ts          # GET /api/v1/documents/:id
│   │   │   │                     # PATCH /api/v1/documents/:id
│   │   │   │                     # DELETE /api/v1/documents/:id
│   │   │   └── review/
│   │   │       └── route.ts      # POST /api/v1/documents/:id/review
│   │   └── upload/
│   │       └── route.ts          # POST /api/v1/documents/upload
│   ├── forwarders/
│   └── mappings/
```

### 5.2 API Route 模板

```typescript
/**
 * @fileoverview 文件管理 API 端點
 * @module src/app/api/v1/documents/route
 * @since Epic 2 - Story 2.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { documentListSchema, documentCreateSchema } from '@/validations/document';
import { createApiError, createApiResponse } from '@/lib/api/response';

/**
 * GET /api/v1/documents
 * 獲取文件列表（支援分頁和過濾）
 */
export async function GET(request: NextRequest) {
  try {
    // 解析查詢參數
    const searchParams = request.nextUrl.searchParams;
    const params = documentListSchema.parse({
      page: Number(searchParams.get('page') ?? 1),
      limit: Number(searchParams.get('limit') ?? 20),
      status: searchParams.get('status'),
    });

    // 查詢數據
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        where: params.status ? { status: params.status } : undefined,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.count(),
    ]);

    // 返回成功響應
    return NextResponse.json(
      createApiResponse(documents, {
        pagination: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.ceil(total / params.limit),
        },
      })
    );
  } catch (error) {
    // 錯誤處理
    return NextResponse.json(
      createApiError(error),
      { status: getErrorStatus(error) }
    );
  }
}

/**
 * POST /api/v1/documents
 * 創建新文件記錄
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = documentCreateSchema.parse(body);

    const document = await prisma.document.create({
      data,
    });

    return NextResponse.json(
      createApiResponse(document),
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      createApiError(error),
      { status: getErrorStatus(error) }
    );
  }
}
```

### 5.3 響應格式

```typescript
// 成功響應
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// 錯誤響應（RFC 7807）
interface ApiErrorResponse {
  type: string;        // 錯誤類型 URI
  title: string;       // 人類可讀的標題
  status: number;      // HTTP 狀態碼
  detail: string;      // 詳細錯誤描述
  instance: string;    // 請求路徑
  errors?: Record<string, string[]>;  // 驗證錯誤詳情
}

// 範例
// 成功
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "fileName": "invoice.pdf"
  }
}

// 錯誤
{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Error",
  "status": 400,
  "detail": "One or more fields failed validation",
  "instance": "/api/v1/documents",
  "errors": {
    "fileName": ["File name is required", "File name must be less than 255 characters"]
  }
}
```

---

## 6. 資料庫規範

### 6.1 Prisma Schema 規範

```prisma
// 文件：prisma/schema.prisma

// ============================================================
// 模型定義規範
// ============================================================

/**
 * 文件記錄模型
 * 儲存上傳的發票文件信息和處理狀態
 */
model Document {
  // --- 主鍵 ---
  id            String   @id @default(cuid())

  // --- 業務欄位 ---
  fileName      String   @map("file_name")
  fileType      String   @map("file_type")
  fileSize      Int      @map("file_size")
  status        DocumentStatus @default(PENDING)

  // --- 時間戳 ---
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  processedAt   DateTime? @map("processed_at")

  // --- 關聯 ---
  forwarderId   String   @map("forwarder_id")
  forwarder     Forwarder @relation(fields: [forwarderId], references: [id])

  uploadedById  String   @map("uploaded_by_id")
  uploadedBy    User     @relation(fields: [uploadedById], references: [id])

  // --- 索引 ---
  @@index([status])
  @@index([forwarderId])
  @@index([createdAt])

  // --- 表名映射 ---
  @@map("documents")
}

enum DocumentStatus {
  PENDING
  PROCESSING
  PENDING_REVIEW
  COMPLETED
  ERROR
}
```

### 6.2 遷移命名規範

```bash
# 格式：動作_對象_描述
npx prisma migrate dev --name create_documents_table
npx prisma migrate dev --name add_status_to_documents
npx prisma migrate dev --name add_index_on_documents_forwarder_id
npx prisma migrate dev --name rename_file_path_to_file_url
```

---

## 7. 測試規範

### 7.1 測試文件結構

```
tests/
├── unit/                        # 單元測試
│   ├── services/
│   │   └── mapping-service.test.ts
│   └── utils/
│       └── confidence-calculator.test.ts
├── integration/                 # 整合測試
│   └── api/
│       └── documents.test.ts
└── e2e/                         # 端到端測試
    └── document-workflow.spec.ts
```

### 7.2 測試模板

```typescript
/**
 * @fileoverview 映射服務單元測試
 * @module tests/unit/services/mapping-service.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MappingService } from '@/services/mapping';

describe('MappingService', () => {
  let service: MappingService;

  beforeEach(() => {
    service = new MappingService();
    vi.clearAllMocks();
  });

  describe('calculateConfidenceScore', () => {
    it('should return high confidence for exact universal match', () => {
      // Arrange
      const mappingResult = { tier: 'universal', matchType: 'exact' };

      // Act
      const score = service.calculateConfidenceScore(mappingResult);

      // Assert
      expect(score).toBeGreaterThanOrEqual(90);
    });

    it('should return medium confidence for fuzzy match', () => {
      // Arrange
      const mappingResult = { tier: 'universal', matchType: 'fuzzy' };

      // Act
      const score = service.calculateConfidenceScore(mappingResult);

      // Assert
      expect(score).toBeGreaterThanOrEqual(70);
      expect(score).toBeLessThan(90);
    });
  });
});
```

### 7.3 測試覆蓋率要求

| 類型 | 覆蓋率目標 | 範圍 |
|------|-----------|------|
| 單元測試 | ≥ 80% | 核心業務邏輯、工具函數 |
| 整合測試 | ≥ 70% | API 端點、服務集成 |
| E2E 測試 | 關鍵流程 | 文件上傳、審核流程 |

---

## 8. Git 規範

### 8.1 分支策略

```
main                              # 生產分支（受保護）
├── develop                       # 開發分支
│   ├── feature/epic-1-story-1    # 功能分支
│   ├── feature/epic-2-story-3    # 功能分支
│   └── fix/issue-123             # 修復分支
└── hotfix/critical-bug           # 緊急修復
```

### 8.2 分支命名

```bash
# 功能分支
feature/epic-<epic_number>-story-<story_number>
feature/epic-3-story-2-mapping-service

# 修復分支
fix/<issue-number>-<description>
fix/123-file-upload-validation

# 緊急修復
hotfix/<description>
hotfix/production-memory-leak
```

### 8.3 Commit Message 格式

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Type 類型：**
| Type | 說明 | 範例 |
|------|------|------|
| `feat` | 新功能 | `feat(document): add file upload API` |
| `fix` | Bug 修復 | `fix(mapping): correct confidence calculation` |
| `docs` | 文檔更新 | `docs(readme): update installation guide` |
| `style` | 代碼格式 | `style(api): format with prettier` |
| `refactor` | 重構 | `refactor(services): extract common utils` |
| `perf` | 性能優化 | `perf(query): add database index` |
| `test` | 測試相關 | `test(mapping): add edge case tests` |
| `chore` | 構建/工具 | `chore(deps): upgrade prisma to v5` |
| `ci` | CI/CD | `ci(github): add test workflow` |

**完整範例：**
```
feat(document): add three-tier mapping service

- Implement Universal Mapping layer (Tier 1)
- Add Forwarder-Specific Override (Tier 2)
- Integrate GPT-5.2 for LLM Classification (Tier 3)
- Add confidence score calculation logic
- Create comprehensive unit tests

Breaking Change: MappingResult interface updated
Relates to: Epic-6, Story-6.1
```

---

## 9. 目錄結構規範

### 9.1 完整項目結構

```
ai-document-extraction-project/
├── .github/                      # GitHub 配置
│   └── workflows/                # GitHub Actions
├── docs/                         # 項目文檔
│   ├── 00-discovery/             # 產品探索
│   ├── 01-planning/              # 規劃文檔
│   │   ├── prd/                  # 產品需求
│   │   └── ux/                   # UX 設計
│   ├── 02-architecture/          # 架構設計
│   ├── 03-stories/               # 用戶故事
│   │   └── tech-specs/           # 技術規格
│   └── 04-implementation/        # 實施文檔
├── prisma/                       # 資料庫
│   ├── schema.prisma             # Schema 定義
│   └── migrations/               # 遷移文件
├── public/                       # 靜態資源
├── scripts/                      # 工具腳本
├── src/                          # 源代碼
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # 認證頁面組
│   │   │   ├── login/
│   │   │   └── logout/
│   │   ├── (dashboard)/          # 儀表板頁面組
│   │   │   ├── documents/
│   │   │   ├── mappings/
│   │   │   └── settings/
│   │   ├── api/                  # API 路由
│   │   │   └── v1/
│   │   ├── layout.tsx            # 根佈局
│   │   └── page.tsx              # 首頁
│   ├── components/               # React 組件
│   │   ├── ui/                   # shadcn/ui 基礎組件
│   │   ├── features/             # 功能組件
│   │   │   ├── documents/
│   │   │   ├── mappings/
│   │   │   └── review/
│   │   └── layouts/              # 佈局組件
│   │       ├── header.tsx
│   │       ├── sidebar.tsx
│   │       └── footer.tsx
│   ├── hooks/                    # 自定義 Hooks
│   │   ├── use-documents.ts
│   │   └── use-mappings.ts
│   ├── lib/                      # 工具庫
│   │   ├── api/                  # API 客戶端
│   │   ├── auth/                 # 認證邏輯
│   │   ├── prisma.ts             # Prisma 客戶端
│   │   └── utils.ts              # 通用工具
│   ├── services/                 # 業務邏輯
│   │   ├── mapping/              # 映射服務
│   │   ├── ocr/                  # OCR 服務
│   │   └── review/               # 審核服務
│   ├── stores/                   # Zustand 狀態
│   ├── types/                    # TypeScript 類型
│   └── validations/              # Zod Schema
├── tests/                        # 測試文件
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env                          # 環境變數（不提交）
├── .env.example                  # 環境變數範例
├── CLAUDE.md                     # AI 開發指引
├── docker-compose.yml            # Docker 配置
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

### 9.2 新文件放置規則

| 文件類型 | 放置位置 | 範例 |
|---------|---------|------|
| 頁面組件 | `src/app/(group)/page-name/` | `src/app/(dashboard)/documents/` |
| API 路由 | `src/app/api/v1/resource/` | `src/app/api/v1/documents/` |
| UI 組件 | `src/components/ui/` | 由 shadcn/ui 管理 |
| 功能組件 | `src/components/features/domain/` | `src/components/features/documents/` |
| 業務服務 | `src/services/domain/` | `src/services/mapping/` |
| 自定義 Hook | `src/hooks/` | `src/hooks/use-documents.ts` |
| 類型定義 | `src/types/` | `src/types/document.ts` |
| Zod Schema | `src/validations/` | `src/validations/document.ts` |
| 單元測試 | `tests/unit/path/to/module.test.ts` | `tests/unit/services/mapping.test.ts` |

---

## 附錄：VS Code 配置建議

### 推薦擴展

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "ms-azuretools.vscode-docker"
  ]
}
```

### 工作區設定

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "non-relative"
}
```

---

## 版本記錄

| 版本 | 日期 | 說明 |
|------|------|------|
| 1.0.0 | 2025-12-17 | 初始版本 |
