# 實作模式與一致性規則

## 命名模式

### Prisma Schema 命名

```prisma
// 模型使用 PascalCase 單數
model Invoice { ... }
model ForwarderProfile { ... }
model MappingRule { ... }

// 欄位使用 camelCase，資料庫欄位使用 snake_case + @map
model Invoice {
  id            String   @id @default(uuid())
  invoiceNumber String   @map("invoice_number")
  forwarderId   String   @map("forwarder_id")
  confidence    Float
  status        InvoiceStatus @default(PENDING)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // 關聯
  forwarder     Forwarder @relation(fields: [forwarderId], references: [id])
  items         InvoiceItem[]

  // 索引與表名
  @@map("invoices")
  @@index([status])
  @@index([forwarderId])
}

// 枚舉使用 PascalCase + SCREAMING_SNAKE_CASE 值
enum InvoiceStatus {
  PENDING
  PROCESSING
  REVIEW_REQUIRED
  APPROVED
  REJECTED
}

enum ConfidenceLevel {
  HIGH      // > 90%
  MEDIUM    // 70-90%
  LOW       // < 70%
}
```

### API 命名

| 類別 | 模式 | 範例 |
|------|------|------|
| API Routes | `/api/[resource]/[action]` | `/api/invoices/extract` |
| Query Params | camelCase | `?forwarderId=xxx&status=pending` |
| Request Body | camelCase | `{ invoiceNumber, forwarderId }` |
| Response Body | camelCase | `{ data, meta, error }` |

### 代碼命名

| 類別 | 模式 | 範例 |
|------|------|------|
| React Components | PascalCase | `InvoiceReviewPanel.tsx` |
| Hooks | camelCase + use | `useInvoiceExtraction.ts` |
| Utilities | camelCase | `formatCurrency.ts` |
| Constants | SCREAMING_SNAKE | `MAX_BATCH_SIZE` |
| Types | PascalCase | `InvoiceExtractResult` |

## 結構模式

### 專案目錄結構

```
ai-document-extraction/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # 認證相關頁面群組
│   │   ├── (dashboard)/        # 主功能頁面群組
│   │   ├── api/                # API Routes (BFF)
│   │   │   ├── invoices/
│   │   │   ├── forwarders/
│   │   │   └── rules/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 組件
│   │   ├── features/           # 業務功能組件
│   │   │   ├── invoice/
│   │   │   ├── review/
│   │   │   └── dashboard/
│   │   └── layouts/            # 佈局組件
│   ├── lib/
│   │   ├── prisma.ts           # Prisma 客戶端單例
│   │   ├── auth.ts             # NextAuth 配置
│   │   ├── api-client.ts       # API 客戶端
│   │   └── utils.ts            # 工具函數
│   ├── hooks/                  # 自定義 Hooks
│   ├── stores/                 # Zustand Stores
│   ├── types/                  # TypeScript 類型
│   └── middleware.ts           # Next.js 中間件
├── prisma/
│   ├── schema.prisma           # 資料庫 Schema
│   ├── migrations/             # 遷移文件
│   └── seed.ts                 # 種子數據
├── python-services/            # Python AI 服務
│   ├── extraction/
│   ├── mapping/
│   └── learning/
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

### 功能模組結構

```
features/invoice/
├── components/
│   ├── InvoiceList.tsx
│   ├── InvoiceDetail.tsx
│   └── InvoiceReviewPanel.tsx
├── hooks/
│   ├── useInvoiceList.ts
│   └── useInvoiceExtraction.ts
├── api/
│   └── invoice.service.ts
├── types/
│   └── invoice.types.ts
└── index.ts                    # 統一導出
```

## 格式模式

### API 響應格式

```typescript
// 成功響應
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

// 錯誤響應（RFC 7807）
interface ErrorResponse {
  success: false;
  error: {
    type: string;
    title: string;
    status: number;
    detail: string;
    instance?: string;
  };
}
```

### Prisma 查詢模式

```typescript
// lib/prisma.ts - 客戶端單例
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 服務層查詢範例
export async function getInvoiceById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      forwarder: true,
      items: true,
      extractionResults: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })
}

// 分頁查詢範例
export async function getInvoices(params: {
  page: number;
  pageSize: number;
  status?: InvoiceStatus;
  forwarderId?: string;
}) {
  const { page, pageSize, status, forwarderId } = params;

  const where = {
    ...(status && { status }),
    ...(forwarderId && { forwarderId }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { forwarder: { select: { name: true } } }
    }),
    prisma.invoice.count({ where })
  ]);

  return { data, total, page, pageSize };
}
```

## 通信模式

### 狀態管理分層

```typescript
// stores/invoice.store.ts - Zustand（UI 狀態）
import { create } from 'zustand';

interface InvoiceUIState {
  selectedInvoiceId: string | null;
  filterStatus: InvoiceStatus | 'all';
  viewMode: 'list' | 'grid';
  setSelectedInvoice: (id: string | null) => void;
  setFilterStatus: (status: InvoiceStatus | 'all') => void;
}

export const useInvoiceStore = create<InvoiceUIState>((set) => ({
  selectedInvoiceId: null,
  filterStatus: 'all',
  viewMode: 'list',
  setSelectedInvoice: (id) => set({ selectedInvoiceId: id }),
  setFilterStatus: (status) => set({ filterStatus: status }),
}));

// hooks/useInvoices.ts - React Query（伺服器狀態）
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useInvoices(params: InvoiceQueryParams) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => invoiceService.getInvoices(params),
    staleTime: 30 * 1000, // 30 秒
  });
}

export function useApproveInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: invoiceService.approveInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
```

## 流程模式

### 錯誤處理

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public type: string,
    public title: string,
    public status: number,
    public detail: string,
  ) {
    super(detail);
  }
}

// API Route 錯誤處理
export function withErrorHandler(handler: NextApiHandler): NextApiHandler {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.status).json({
          success: false,
          error: {
            type: error.type,
            title: error.title,
            status: error.status,
            detail: error.detail,
          },
        });
      }
      // 未預期錯誤
      console.error('Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: {
          type: 'internal_error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'An unexpected error occurred',
        },
      });
    }
  };
}
```

### 載入狀態模式

```typescript
// components/features/invoice/InvoiceList.tsx
export function InvoiceList() {
  const { data, isLoading, error } = useInvoices(queryParams);

  if (isLoading) {
    return <InvoiceListSkeleton />;
  }

  if (error) {
    return <ErrorDisplay error={error} retry={() => refetch()} />;
  }

  if (!data?.data.length) {
    return <EmptyState message="沒有找到發票" />;
  }

  return (
    <div className="space-y-4">
      {data.data.map((invoice) => (
        <InvoiceCard key={invoice.id} invoice={invoice} />
      ))}
    </div>
  );
}
```

## 強制規則

AI Agent 實作時必須遵守：

| 規則 | 說明 | 驗證方式 |
|------|------|----------|
| Prisma 單例 | 全域只能有一個 PrismaClient 實例 | lib/prisma.ts 單例模式 |
| 類型安全 | 所有 API 使用 TypeScript 類型 | Prisma 生成的類型 |
| 錯誤格式 | 所有錯誤遵循 RFC 7807 | ErrorResponse interface |
| 狀態分離 | UI 狀態用 Zustand，伺服器狀態用 React Query | 無混用 |
| 命名一致 | 遵循既定命名規範 | ESLint 規則 |
| 遷移管理 | 資料庫變更透過 Prisma Migrate | 禁止手動修改 |

---
