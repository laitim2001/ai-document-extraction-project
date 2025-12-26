# Tech Spec: Story 0.8 - 文件發行者識別

**Version:** 1.0
**Created:** 2025-12-25
**Story:** [0-8-document-issuer-identification](../../stories/0-8-document-issuer-identification.md)

---

## 1. Overview

### 1.1 Purpose
從文件的 Logo、標題、頁首等視覺元素識別文件發行公司，區別於交易對象（vendor/shipper/consignee）。

### 1.2 Scope
- GPT Vision Prompt 擴展（documentIssuer 提取）
- Prisma Schema 擴展（IssuerIdentificationMethod、FileTransactionParty）
- 發行者識別服務
- 批量處理整合

### 1.3 Dependencies
- Story 0.2: 智能處理路由（GPT Vision 處理）
- Story 0.3: 即時公司 Profile 建立（公司匹配邏輯）
- Story 0.6: 批量處理公司識別整合

---

## 2. Technical Design

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     文件處理流程                              │
├─────────────────────────────────────────────────────────────┤
│  1. 文件上傳 → 2. Azure DI OCR → 3. GPT-5.2 Vision 提取      │
│                                        ↓                     │
│                              ┌─────────────────────┐         │
│                              │   提取結果處理       │         │
│                              ├─────────────────────┤         │
│                              │ documentIssuer      │ ← 新增  │
│                              │ transactionParties  │ ← 新增  │
│                              │ lineItems           │ 現有    │
│                              │ metadata            │ 現有    │
│                              └─────────────────────┘         │
│                                        ↓                     │
│                    ┌──────────────────────────────────┐     │
│                    │    發行者識別服務                  │     │
│                    ├──────────────────────────────────┤     │
│                    │ 1. 提取 documentIssuer           │     │
│                    │ 2. 三層公司匹配                   │     │
│                    │ 3. 關聯/創建公司 Profile          │     │
│                    │ 4. 處理 transactionParties       │     │
│                    └──────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Model Extensions

```prisma
// prisma/schema.prisma

// ========== 新增枚舉 ==========

// 發行者識別方法
enum IssuerIdentificationMethod {
  LOGO           // 從 Logo 識別
  HEADER         // 從文件標題識別
  LETTERHEAD     // 從信頭紙識別
  FOOTER         // 從頁尾識別
  AI_INFERENCE   // AI 推斷（無明確視覺線索）
}

// 交易對象角色
enum TransactionPartyRole {
  VENDOR         // 供應商
  SHIPPER        // 發貨人
  CONSIGNEE      // 收貨人
  CARRIER        // 承運人
  BUYER          // 買方
  SELLER         // 賣方
  NOTIFY_PARTY   // 通知方
  OTHER          // 其他
}

// ========== 擴展 HistoricalFile ==========

model HistoricalFile {
  // ... 現有欄位 ...

  // 文件發行者（發出文件的公司）
  documentIssuerId           String?  @map("document_issuer_id")
  documentIssuer             Company? @relation("FileDocumentIssuer", fields: [documentIssuerId], references: [id])
  issuerIdentificationMethod IssuerIdentificationMethod? @map("issuer_identification_method")
  issuerConfidence           Float?   @map("issuer_confidence")

  // 交易對象（多對多關聯）
  transactionParties FileTransactionParty[]
}

// ========== 新增模型 ==========

// 文件-交易對象關聯表
model FileTransactionParty {
  id        String   @id @default(cuid())

  fileId    String   @map("file_id")
  file      HistoricalFile @relation(fields: [fileId], references: [id], onDelete: Cascade)

  companyId String   @map("company_id")
  company   Company  @relation(fields: [companyId], references: [id])

  role      TransactionPartyRole @map("role")

  createdAt DateTime @default(now()) @map("created_at")

  @@unique([fileId, companyId, role])
  @@index([fileId])
  @@index([companyId])
  @@map("file_transaction_parties")
}

// ========== 擴展 Company ==========

model Company {
  // ... 現有欄位 ...

  // 作為發行者的文件
  issuedFiles           HistoricalFile[] @relation("FileDocumentIssuer")

  // 作為交易對象的文件
  transactionPartyFiles FileTransactionParty[]
}
```

### 2.3 GPT Vision Prompt Extension

```typescript
// src/lib/prompts/extraction-prompt.ts

export const DOCUMENT_ISSUER_SECTION = `
## Document Issuer Identification (文件發行者識別)

**CRITICAL**: Identify the COMPANY THAT ISSUED/CREATED this document, NOT the transaction parties.

### Where to Look (Priority Order):
1. **Company Logo** - Top-left or top-center area
2. **Document Header** - Company name in header/title section
3. **Letterhead** - Official branded letterhead
4. **Footer** - Company contact info at bottom

### Extract:
{
  "documentIssuer": {
    "name": "Full company name as shown on document",
    "identificationMethod": "LOGO" | "HEADER" | "LETTERHEAD" | "FOOTER",
    "confidence": 0-100,
    "rawText": "Original text exactly as seen",
    "additionalInfo": {
      "address": "Company address if visible",
      "phone": "Contact phone if visible",
      "email": "Contact email if visible",
      "registration": "Business registration number if visible"
    }
  }
}

### IMPORTANT DISTINCTION:
- **documentIssuer**: The company that CREATED and SENT this document
  - Example: DHL issues an invoice → documentIssuer = "DHL"
- **vendor/shipper/consignee**: The parties INVOLVED in the transaction
  - These are transaction parties, NOT the document issuer

### Example:
A DHL invoice for shipping goods from ABC Corp to XYZ Ltd:
- documentIssuer: "DHL Express" (company logo/header)
- vendor: "ABC Corp" or "DHL Express" (depends on invoice structure)
- shipper: "ABC Corp"
- consignee: "XYZ Ltd"
`;
```

### 2.4 Service Implementation

```typescript
// src/services/document-issuer.service.ts

/**
 * @fileoverview 文件發行者識別服務
 * @description
 *   從 GPT Vision 提取結果中識別文件發行公司，
 *   區別於交易對象（vendor/shipper/consignee）
 *
 * @module src/services/document-issuer
 * @since Epic 0 - Story 0.8
 * @lastModified 2025-12-25
 */

import { prisma } from '@/lib/prisma';
import { matchCompanyName, type MatchResult } from './company-matcher.service';
import type {
  ExtractionResult,
  DocumentIssuerData,
  IssuerIdentificationMethod,
  TransactionPartyRole,
} from '@/types';

// ========== Types ==========

export interface DocumentIssuerResult {
  name: string;
  identificationMethod: IssuerIdentificationMethod;
  confidence: number;
  rawText?: string;
  companyId?: string;
  isNewCompany: boolean;
  additionalInfo?: {
    address?: string;
    phone?: string;
    email?: string;
    registration?: string;
  };
}

export interface ProcessIssuerOptions {
  confidenceThreshold?: number;  // 預設 70
  createCompanyIfNotFound?: boolean;  // 預設 true
}

// ========== Main Functions ==========

/**
 * 從提取結果中識別文件發行者
 */
export async function extractDocumentIssuer(
  extractionResult: ExtractionResult,
  options: ProcessIssuerOptions = {}
): Promise<DocumentIssuerResult | null> {
  const { confidenceThreshold = 70, createCompanyIfNotFound = true } = options;

  const issuerData = extractionResult.documentIssuer;

  if (!issuerData?.name) {
    return null;
  }

  // 信心度過低，不自動關聯
  if (issuerData.confidence < confidenceThreshold) {
    return {
      name: issuerData.name,
      identificationMethod: issuerData.identificationMethod || 'AI_INFERENCE',
      confidence: issuerData.confidence,
      rawText: issuerData.rawText,
      isNewCompany: false,
      additionalInfo: issuerData.additionalInfo,
    };
  }

  // 三層公司匹配
  const matchResult = await matchCompanyName(issuerData.name, {
    fuzzyThreshold: 0.9,
    createIfNotFound: createCompanyIfNotFound,
    source: 'DOCUMENT_ISSUER',
  });

  return {
    name: issuerData.name,
    identificationMethod: issuerData.identificationMethod || 'AI_INFERENCE',
    confidence: issuerData.confidence,
    rawText: issuerData.rawText,
    companyId: matchResult.companyId,
    isNewCompany: matchResult.isNew,
    additionalInfo: issuerData.additionalInfo,
  };
}

/**
 * 處理交易對象（vendor/shipper/consignee 等）
 */
export async function processTransactionParties(
  fileId: string,
  extractionResult: ExtractionResult
): Promise<void> {
  const parties: Array<{ role: TransactionPartyRole; name: string }> = [];

  // 收集所有交易對象
  const partyFields: Array<{ field: string; role: TransactionPartyRole }> = [
    { field: 'vendor', role: 'VENDOR' },
    { field: 'shipper', role: 'SHIPPER' },
    { field: 'consignee', role: 'CONSIGNEE' },
    { field: 'carrier', role: 'CARRIER' },
    { field: 'buyer', role: 'BUYER' },
    { field: 'seller', role: 'SELLER' },
    { field: 'notifyParty', role: 'NOTIFY_PARTY' },
  ];

  for (const { field, role } of partyFields) {
    const data = extractionResult[field as keyof ExtractionResult];
    if (data && typeof data === 'object' && 'name' in data && data.name) {
      parties.push({ role, name: data.name as string });
    }
  }

  // 為每個交易對象匹配/創建公司 Profile
  for (const party of parties) {
    try {
      const matchResult = await matchCompanyName(party.name, {
        fuzzyThreshold: 0.9,
        createIfNotFound: true,
        source: 'TRANSACTION_PARTY',
      });

      await prisma.fileTransactionParty.upsert({
        where: {
          fileId_companyId_role: {
            fileId,
            companyId: matchResult.companyId,
            role: party.role,
          },
        },
        create: {
          fileId,
          companyId: matchResult.companyId,
          role: party.role,
        },
        update: {},
      });
    } catch (error) {
      console.error(`Failed to process transaction party: ${party.name}`, error);
      // 繼續處理其他交易對象
    }
  }
}

/**
 * 更新文件的發行者資訊
 */
export async function updateFileIssuer(
  fileId: string,
  issuerResult: DocumentIssuerResult
): Promise<void> {
  await prisma.historicalFile.update({
    where: { id: fileId },
    data: {
      documentIssuerId: issuerResult.companyId,
      issuerIdentificationMethod: issuerResult.identificationMethod,
      issuerConfidence: issuerResult.confidence,
    },
  });
}

/**
 * 完整處理文件的發行者和交易對象
 */
export async function processDocumentParties(
  fileId: string,
  extractionResult: ExtractionResult,
  options?: ProcessIssuerOptions
): Promise<{
  issuer: DocumentIssuerResult | null;
  transactionPartiesCount: number;
}> {
  // 1. 處理發行者
  const issuerResult = await extractDocumentIssuer(extractionResult, options);

  if (issuerResult?.companyId) {
    await updateFileIssuer(fileId, issuerResult);
  }

  // 2. 處理交易對象
  await processTransactionParties(fileId, extractionResult);

  // 獲取交易對象數量
  const transactionPartiesCount = await prisma.fileTransactionParty.count({
    where: { fileId },
  });

  return {
    issuer: issuerResult,
    transactionPartiesCount,
  };
}
```

### 2.5 Batch Processing Integration

```typescript
// src/services/batch-processor.service.ts (修改)

import { processDocumentParties } from './document-issuer.service';

/**
 * 處理單個文件（擴展）
 */
async function processFile(file: HistoricalFile): Promise<ProcessResult> {
  try {
    // ... 現有 OCR 和 GPT 處理邏輯 ...

    // 新增：處理發行者和交易對象
    const { issuer, transactionPartiesCount } = await processDocumentParties(
      file.id,
      extractionResult,
      {
        confidenceThreshold: batch.config?.issuerConfidenceThreshold ?? 70,
        createCompanyIfNotFound: true,
      }
    );

    return {
      success: true,
      fileId: file.id,
      issuer,
      transactionPartiesCount,
    };
  } catch (error) {
    // ... 錯誤處理 ...
  }
}
```

---

## 3. API Endpoints

### 3.1 Get File Issuer Info

```typescript
// GET /api/v1/historical-files/:id/issuer

interface IssuerInfoResponse {
  documentIssuer: {
    id: string;
    name: string;
    identificationMethod: string;
    confidence: number;
  } | null;
  transactionParties: Array<{
    role: string;
    company: {
      id: string;
      name: string;
    };
  }>;
}
```

### 3.2 Update File Issuer

```typescript
// PATCH /api/v1/historical-files/:id/issuer

interface UpdateIssuerRequest {
  documentIssuerId: string;
  issuerIdentificationMethod?: IssuerIdentificationMethod;
  issuerConfidence?: number;
}
```

### 3.3 Batch Statistics

```typescript
// GET /api/v1/batches/:id/issuer-stats

interface IssuerStatsResponse {
  totalFiles: number;
  identifiedCount: number;
  identificationMethods: Record<IssuerIdentificationMethod, number>;
  topIssuers: Array<{
    company: { id: string; name: string };
    fileCount: number;
  }>;
  lowConfidenceCount: number;
}
```

---

## 4. UI Components

### 4.1 Issuer Display Component

```tsx
// src/components/features/files/IssuerBadge.tsx

interface IssuerBadgeProps {
  issuer: {
    name: string;
    identificationMethod: IssuerIdentificationMethod;
    confidence: number;
  } | null;
}

export function IssuerBadge({ issuer }: IssuerBadgeProps) {
  if (!issuer) {
    return <Badge variant="outline">未識別發行者</Badge>;
  }

  const methodIcons: Record<IssuerIdentificationMethod, string> = {
    LOGO: '🏷️',
    HEADER: '📄',
    LETTERHEAD: '📜',
    FOOTER: '📝',
    AI_INFERENCE: '🤖',
  };

  return (
    <div className="flex items-center gap-2">
      <span>{methodIcons[issuer.identificationMethod]}</span>
      <span className="font-medium">{issuer.name}</span>
      <Badge variant={issuer.confidence >= 90 ? 'success' : 'warning'}>
        {issuer.confidence}%
      </Badge>
    </div>
  );
}
```

### 4.2 Batch Config Extension

```tsx
// src/components/features/batches/CreateBatchDialog.tsx (擴展)

interface BatchConfig {
  // ... 現有配置 ...
  enableIssuerIdentification: boolean;  // 預設 true
  issuerConfidenceThreshold: number;    // 預設 70
  issuerMethodPriority: IssuerIdentificationMethod[];  // 優先順序
}
```

---

## 5. Testing Strategy

### 5.1 Unit Tests

```typescript
// tests/unit/services/document-issuer.test.ts

describe('DocumentIssuerService', () => {
  describe('extractDocumentIssuer', () => {
    it('should extract issuer from logo identification', async () => {
      const result = {
        documentIssuer: {
          name: 'DHL Express',
          identificationMethod: 'LOGO',
          confidence: 95,
        },
      };

      const issuer = await extractDocumentIssuer(result);

      expect(issuer?.name).toBe('DHL Express');
      expect(issuer?.identificationMethod).toBe('LOGO');
    });

    it('should not auto-match when confidence below threshold', async () => {
      const result = {
        documentIssuer: {
          name: 'Unknown Corp',
          identificationMethod: 'AI_INFERENCE',
          confidence: 50,
        },
      };

      const issuer = await extractDocumentIssuer(result, {
        confidenceThreshold: 70,
      });

      expect(issuer?.companyId).toBeUndefined();
    });
  });

  describe('processTransactionParties', () => {
    it('should create FileTransactionParty records', async () => {
      const result = {
        vendor: { name: 'ABC Corp' },
        shipper: { name: 'XYZ Ltd' },
        consignee: { name: 'DEF Inc' },
      };

      await processTransactionParties('file-123', result);

      const parties = await prisma.fileTransactionParty.findMany({
        where: { fileId: 'file-123' },
      });

      expect(parties).toHaveLength(3);
    });
  });
});
```

### 5.2 Integration Tests

```typescript
// tests/integration/issuer-identification.test.ts

describe('Issuer Identification Integration', () => {
  it('should identify issuer during batch processing', async () => {
    // 1. 上傳測試文件
    // 2. 執行批量處理
    // 3. 驗證 documentIssuerId 已設置
    // 4. 驗證 FileTransactionParty 已創建
  });
});
```

---

## 6. Migration Plan

### 6.1 Database Migration

```sql
-- 20250125_add_document_issuer_fields.sql

-- 1. 添加 IssuerIdentificationMethod 枚舉
CREATE TYPE "IssuerIdentificationMethod" AS ENUM (
  'LOGO',
  'HEADER',
  'LETTERHEAD',
  'FOOTER',
  'AI_INFERENCE'
);

-- 2. 添加 TransactionPartyRole 枚舉
CREATE TYPE "TransactionPartyRole" AS ENUM (
  'VENDOR',
  'SHIPPER',
  'CONSIGNEE',
  'CARRIER',
  'BUYER',
  'SELLER',
  'NOTIFY_PARTY',
  'OTHER'
);

-- 3. 擴展 historical_files 表
ALTER TABLE "historical_files"
ADD COLUMN "document_issuer_id" TEXT,
ADD COLUMN "issuer_identification_method" "IssuerIdentificationMethod",
ADD COLUMN "issuer_confidence" DOUBLE PRECISION;

-- 4. 創建 file_transaction_parties 表
CREATE TABLE "file_transaction_parties" (
  "id" TEXT NOT NULL,
  "file_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "role" "TransactionPartyRole" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "file_transaction_parties_pkey" PRIMARY KEY ("id")
);

-- 5. 添加索引和外鍵
CREATE UNIQUE INDEX "file_transaction_parties_file_id_company_id_role_key"
ON "file_transaction_parties"("file_id", "company_id", "role");

CREATE INDEX "file_transaction_parties_file_id_idx"
ON "file_transaction_parties"("file_id");

CREATE INDEX "file_transaction_parties_company_id_idx"
ON "file_transaction_parties"("company_id");

ALTER TABLE "historical_files"
ADD CONSTRAINT "historical_files_document_issuer_id_fkey"
FOREIGN KEY ("document_issuer_id") REFERENCES "companies"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "file_transaction_parties"
ADD CONSTRAINT "file_transaction_parties_file_id_fkey"
FOREIGN KEY ("file_id") REFERENCES "historical_files"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "file_transaction_parties"
ADD CONSTRAINT "file_transaction_parties_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
```

---

## 7. Performance Considerations

1. **無額外 API 調用**: documentIssuer 提取整合到現有 GPT Vision 調用中
2. **批量處理**: 交易對象處理使用 upsert 避免重複查詢
3. **索引優化**: file_id 和 company_id 都有索引
4. **錯誤隔離**: 單個交易對象處理失敗不影響其他處理

---

## 8. Rollback Plan

1. 移除 file_transaction_parties 表
2. 移除 historical_files 的新欄位
3. 移除枚舉類型
4. 恢復原有的 extraction-prompt.ts

---

*Tech Spec Version: 1.0*
*Last Updated: 2025-12-25*
