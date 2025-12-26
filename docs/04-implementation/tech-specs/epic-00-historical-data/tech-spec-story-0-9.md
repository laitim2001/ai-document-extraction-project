# Tech Spec: Story 0.9 - 文件格式識別與術語重組

**Status:** backlog
**Story:** [0-9-document-format-term-reorganization.md](../../stories/0-9-document-format-term-reorganization.md)
**Epic:** Epic 0 - 歷史數據初始化

---

## 概述

本規格定義文件格式識別與三層術語聚合架構的技術實現。通過 Azure OpenAI GPT-5.2 Vision 識別每份文件的類型和子類型，建立「公司 → 文件格式 → 術語」的三層數據結構。

### 目標
1. 識別文件類型（Invoice, Debit Note, Credit Note 等）和子類型（Ocean Freight, Air Freight 等）
2. 建立 DocumentFormat 模型，關聯公司與文件格式
3. 重構術語聚合邏輯，實現三層結構
4. 提供格式模板學習能力

### 依賴項
- **Story 0.7**: 批量術語聚合整合（提供聚合框架）
- **Story 0.8**: 文件發行者識別（提供 documentIssuerId）

---

## 系統架構

### 整體流程圖

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Document Format Identification                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Azure OpenAI GPT-5.2 Vision                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Input: Document Image/PDF                                     │    │
│  │                                                               │    │
│  │ Extract:                                                      │    │
│  │ • documentType: INVOICE | DEBIT_NOTE | CREDIT_NOTE | ...     │    │
│  │ • documentSubtype: OCEAN_FREIGHT | AIR_FREIGHT | ...         │    │
│  │ • formatConfidence: 0-100                                    │    │
│  │ • formatFeatures: { hasLineItems, currency, language }       │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Format Matching Service                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. Find existing format (companyId + type + subtype)         │    │
│  │ 2. If not found → Create new DocumentFormat                  │    │
│  │ 3. Update format statistics (fileCount)                      │    │
│  │ 4. Learn format features from patterns                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                Three-Layer Term Aggregation                          │
│                                                                       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│  │    Company      │ →  │ DocumentFormat  │ →  │     Terms       │  │
│  │  (發行公司)      │    │   (文件格式)     │    │   (術語列表)     │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                                                       │
│  Example:                                                            │
│  • DHL Express                                                       │
│    ├── Ocean Freight Invoice                                        │
│    │   ├── BAF (Bunker Adjustment Factor)                          │
│    │   ├── THC (Terminal Handling Charge)                          │
│    │   └── DOC FEE (Documentation Fee)                             │
│    └── Air Freight Invoice                                          │
│        ├── AWB FEE (Air Waybill Fee)                               │
│        ├── FSC (Fuel Surcharge)                                    │
│        └── HANDLING FEE                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### 組件關係圖

```
┌──────────────────────────────────────────────────────────────────┐
│                        Batch Processor                            │
│                    (batch-processor.service.ts)                   │
└──────────────────────────────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Document Issuer │  │  Document Format │  │    Term          │
│     Service      │  │     Service      │  │  Aggregation     │
│   (Story 0.8)    │  │   (Story 0.9)    │  │   Service        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
          │                     │                     │
          │                     ▼                     │
          │           ┌──────────────────┐           │
          │           │  DocumentFormat  │           │
          │           │      Model       │           │
          │           └──────────────────┘           │
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                ▼
                    ┌──────────────────┐
                    │ Hierarchical     │
                    │ Aggregation      │
                    │ Result           │
                    └──────────────────┘
```

---

## 資料模型

### Prisma Schema 擴展

```prisma
// prisma/schema.prisma

// ===== 新增 Enums =====

// 文件類型
enum DocumentType {
  INVOICE              // 標準發票
  DEBIT_NOTE           // 借項通知單
  CREDIT_NOTE          // 貸項通知單
  STATEMENT            // 對帳單
  QUOTATION            // 報價單
  BILL_OF_LADING       // 提單
  CUSTOMS_DECLARATION  // 報關單
  OTHER                // 其他
}

// 文件子類型（業務領域）
enum DocumentSubtype {
  OCEAN_FREIGHT        // 海運
  AIR_FREIGHT          // 空運
  LAND_TRANSPORT       // 陸運
  CUSTOMS_CLEARANCE    // 報關
  WAREHOUSING          // 倉儲
  GENERAL              // 一般/混合
}

// ===== 新增 Model =====

// 文件格式模板
model DocumentFormat {
  id              String   @id @default(cuid())

  // 關聯發行公司（來自 Story 0.8）
  companyId       String   @map("company_id")
  company         Company  @relation(fields: [companyId], references: [id])

  // 格式識別
  documentType    DocumentType    @map("document_type")
  documentSubtype DocumentSubtype @map("document_subtype")

  // 格式名稱（自動生成或用戶自定義）
  name            String?

  // 格式特徵（JSON）
  features        Json?    @map("features")
  // features 結構: {
  //   hasLineItems: boolean,
  //   hasHeaderLogo: boolean,
  //   currency: string,
  //   language: string,
  //   typicalFields: string[],
  //   layoutPattern: string
  // }

  // 常見術語（用於快速查找和學習）
  commonTerms     String[] @map("common_terms")

  // 統計
  fileCount       Int      @default(0) @map("file_count")

  // 時間戳
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // 關聯文件
  files           HistoricalFile[]

  // 唯一約束：每個公司的每種格式類型只有一個記錄
  @@unique([companyId, documentType, documentSubtype])
  @@index([companyId])
  @@index([documentType])
  @@map("document_formats")
}

// ===== 擴展 HistoricalFile =====

model HistoricalFile {
  // 現有欄位...
  id                    String   @id @default(cuid())
  // ... 其他現有欄位 ...

  // 文件發行者（來自 Story 0.8）
  documentIssuerId      String?  @map("document_issuer_id")
  documentIssuer        Company? @relation("FileDocumentIssuer", fields: [documentIssuerId], references: [id])

  // 文件格式（新增）
  documentFormatId      String?  @map("document_format_id")
  documentFormat        DocumentFormat? @relation(fields: [documentFormatId], references: [id])

  // 格式識別信心度
  formatConfidence      Float?   @map("format_confidence")

  @@index([documentFormatId])
}
```

### 類型定義

```typescript
// src/types/document-format.ts

/**
 * @fileoverview 文件格式識別相關類型定義
 * @module src/types/document-format
 * @since Epic 0 - Story 0.9
 */

// ===== 文件類型 Enums =====

export type DocumentType =
  | 'INVOICE'
  | 'DEBIT_NOTE'
  | 'CREDIT_NOTE'
  | 'STATEMENT'
  | 'QUOTATION'
  | 'BILL_OF_LADING'
  | 'CUSTOMS_DECLARATION'
  | 'OTHER';

export type DocumentSubtype =
  | 'OCEAN_FREIGHT'
  | 'AIR_FREIGHT'
  | 'LAND_TRANSPORT'
  | 'CUSTOMS_CLEARANCE'
  | 'WAREHOUSING'
  | 'GENERAL';

// ===== GPT Vision 提取結果 =====

export interface DocumentFormatExtractionResult {
  documentType: DocumentType;
  documentSubtype: DocumentSubtype;
  formatConfidence: number;  // 0-100
  formatFeatures: DocumentFormatFeatures;
}

export interface DocumentFormatFeatures {
  hasLineItems: boolean;
  hasHeaderLogo: boolean;
  currency?: string;
  language?: string;
  typicalFields?: string[];
  layoutPattern?: string;
}

// ===== 格式匹配結果 =====

export interface DocumentFormatResult {
  formatId: string;
  documentType: DocumentType;
  documentSubtype: DocumentSubtype;
  formatName: string;
  confidence: number;
  isNewFormat: boolean;
  companyId: string;
}

// ===== 三層聚合結構 =====

export interface HierarchicalTermAggregation {
  companies: CompanyTermNode[];
  summary: AggregationSummary;
}

export interface AggregationSummary {
  totalCompanies: number;
  totalFormats: number;
  totalUniqueTerms: number;
  totalTermOccurrences: number;
}

export interface CompanyTermNode {
  companyId: string;
  companyName: string;
  companyNameVariants: string[];
  fileCount: number;
  formats: FormatTermNode[];
}

export interface FormatTermNode {
  formatId: string;
  documentType: DocumentType;
  documentSubtype: DocumentSubtype;
  formatName: string;
  fileCount: number;
  terms: TermNode[];
  termCount: number;
}

export interface TermNode {
  term: string;
  normalizedTerm: string;
  frequency: number;
  suggestedCategory?: string;
  confidence?: number;
  examples?: string[];  // 原始文字範例
}

// ===== 配置類型 =====

export interface FormatIdentificationConfig {
  enabled: boolean;
  confidenceThreshold: number;  // 預設 70
  autoCreateFormat: boolean;    // 預設 true
  learnFeatures: boolean;       // 預設 true
}

// ===== API 響應類型 =====

export interface FormatListResponse {
  formats: DocumentFormatSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DocumentFormatSummary {
  id: string;
  companyId: string;
  companyName: string;
  documentType: DocumentType;
  documentSubtype: DocumentSubtype;
  name: string | null;
  fileCount: number;
  commonTerms: string[];
  createdAt: string;
  updatedAt: string;
}
```

---

## 服務實現

### GPT Vision Prompt 擴展

```typescript
// src/lib/prompts/extraction-prompt.ts

/**
 * @fileoverview GPT Vision 文件格式識別 Prompt
 * @module src/lib/prompts/extraction-prompt
 * @since Epic 0 - Story 0.9
 */

export const DOCUMENT_FORMAT_PROMPT = `
## Document Format Identification (文件格式識別)

Identify the TYPE and FORMAT of this document by analyzing its structure and content.

### Output Structure

documentFormat: {
  documentType: The main document type (REQUIRED)
    - INVOICE: Standard invoice for services/goods (發票)
    - DEBIT_NOTE: Additional charges notification (借項通知單)
    - CREDIT_NOTE: Refund or adjustment (貸項通知單)
    - STATEMENT: Account statement (對帳單)
    - QUOTATION: Price quote (報價單)
    - BILL_OF_LADING: Shipping document (提單)
    - CUSTOMS_DECLARATION: Customs paperwork (報關單)
    - OTHER: Other document types

  documentSubtype: The specific subtype based on business domain (REQUIRED)
    - OCEAN_FREIGHT: Sea shipping related (海運)
    - AIR_FREIGHT: Air shipping related (空運)
    - LAND_TRANSPORT: Ground/road transport (陸運)
    - CUSTOMS_CLEARANCE: Customs processing (報關)
    - WAREHOUSING: Storage related (倉儲)
    - GENERAL: General/mixed services (一般)

  formatConfidence: 0-100 confidence in format identification

  formatFeatures: {
    hasLineItems: boolean - Does the document contain itemized line items?
    hasHeaderLogo: boolean - Is there a company logo in the header?
    currency: detected currency code (e.g., "USD", "CNY", "HKD")
    language: primary language of document (e.g., "en", "zh-TW", "zh-CN")
    typicalFields: array of key field names found in this document
    layoutPattern: brief description of document layout
  }
}

### Identification Guidelines

1. **Document Type Detection**:
   - Look for keywords: "INVOICE", "發票", "DEBIT NOTE", "借項", "CREDIT NOTE", "貸項"
   - Check document title/header area
   - Analyze document structure and purpose

2. **Subtype Detection**:
   - Look for shipping mode indicators: "OCEAN", "SEA", "AIR", "ROAD", "RAIL"
   - Check for industry-specific terms
   - Analyze the nature of charges listed

3. **Feature Extraction**:
   - Count line items to determine hasLineItems
   - Check header area for logo presence
   - Identify currency from amounts
   - Detect primary language from text

### Example Output

{
  "documentFormat": {
    "documentType": "INVOICE",
    "documentSubtype": "OCEAN_FREIGHT",
    "formatConfidence": 92,
    "formatFeatures": {
      "hasLineItems": true,
      "hasHeaderLogo": true,
      "currency": "USD",
      "language": "en",
      "typicalFields": ["Invoice No", "B/L No", "Vessel", "POL", "POD"],
      "layoutPattern": "Header with logo, client info block, line items table, totals section"
    }
  }
}
`;

// 合併到現有的提取 prompt
export function buildExtractionPrompt(options: {
  includeIssuer?: boolean;
  includeFormat?: boolean;
  includeTerms?: boolean;
}): string {
  let prompt = BASE_EXTRACTION_PROMPT;

  if (options.includeIssuer) {
    prompt += '\n\n' + DOCUMENT_ISSUER_PROMPT;
  }

  if (options.includeFormat) {
    prompt += '\n\n' + DOCUMENT_FORMAT_PROMPT;
  }

  if (options.includeTerms) {
    prompt += '\n\n' + TERM_EXTRACTION_PROMPT;
  }

  return prompt;
}
```

### 文件格式識別服務

```typescript
// src/services/document-format.service.ts

/**
 * @fileoverview 文件格式識別服務
 * @module src/services/document-format
 * @since Epic 0 - Story 0.9
 *
 * @description
 *   處理文件格式的識別、匹配和創建。
 *   與 GPT Vision 提取結果整合，建立 DocumentFormat 記錄。
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *   - document-issuer.service - 發行者識別（Story 0.8）
 */

import { prisma } from '@/lib/prisma';
import type {
  DocumentType,
  DocumentSubtype,
  DocumentFormatExtractionResult,
  DocumentFormatResult,
  DocumentFormatFeatures,
  FormatIdentificationConfig,
} from '@/types/document-format';

// 預設配置
const DEFAULT_CONFIG: FormatIdentificationConfig = {
  enabled: true,
  confidenceThreshold: 70,
  autoCreateFormat: true,
  learnFeatures: true,
};

/**
 * 處理文件格式識別結果
 *
 * @param companyId - 發行公司 ID（來自 Story 0.8）
 * @param extractionResult - GPT Vision 提取的格式資訊
 * @param config - 識別配置
 * @returns 格式匹配/創建結果
 */
export async function processDocumentFormat(
  companyId: string,
  extractionResult: DocumentFormatExtractionResult,
  config: Partial<FormatIdentificationConfig> = {}
): Promise<DocumentFormatResult | null> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // 檢查是否啟用
  if (!mergedConfig.enabled) {
    return null;
  }

  // 檢查信心度閾值
  if (extractionResult.formatConfidence < mergedConfig.confidenceThreshold) {
    console.warn(
      `Format confidence ${extractionResult.formatConfidence} below threshold ${mergedConfig.confidenceThreshold}`
    );
    return null;
  }

  // 嘗試匹配現有格式
  const existingFormat = await findExistingFormat(
    companyId,
    extractionResult.documentType,
    extractionResult.documentSubtype
  );

  if (existingFormat) {
    // 更新現有格式
    await updateFormatStatistics(existingFormat.id, extractionResult, mergedConfig);

    return {
      formatId: existingFormat.id,
      documentType: existingFormat.documentType as DocumentType,
      documentSubtype: existingFormat.documentSubtype as DocumentSubtype,
      formatName: existingFormat.name || generateFormatName(
        existingFormat.documentType as DocumentType,
        existingFormat.documentSubtype as DocumentSubtype
      ),
      confidence: extractionResult.formatConfidence,
      isNewFormat: false,
      companyId,
    };
  }

  // 創建新格式
  if (mergedConfig.autoCreateFormat) {
    const newFormat = await createDocumentFormat(
      companyId,
      extractionResult
    );

    return {
      formatId: newFormat.id,
      documentType: newFormat.documentType as DocumentType,
      documentSubtype: newFormat.documentSubtype as DocumentSubtype,
      formatName: newFormat.name || generateFormatName(
        newFormat.documentType as DocumentType,
        newFormat.documentSubtype as DocumentSubtype
      ),
      confidence: extractionResult.formatConfidence,
      isNewFormat: true,
      companyId,
    };
  }

  return null;
}

/**
 * 查找現有格式
 */
async function findExistingFormat(
  companyId: string,
  documentType: DocumentType,
  documentSubtype: DocumentSubtype
) {
  return prisma.documentFormat.findUnique({
    where: {
      companyId_documentType_documentSubtype: {
        companyId,
        documentType,
        documentSubtype,
      },
    },
  });
}

/**
 * 創建新的文件格式記錄
 */
async function createDocumentFormat(
  companyId: string,
  extractionResult: DocumentFormatExtractionResult
) {
  const formatName = generateFormatName(
    extractionResult.documentType,
    extractionResult.documentSubtype
  );

  return prisma.documentFormat.create({
    data: {
      companyId,
      documentType: extractionResult.documentType,
      documentSubtype: extractionResult.documentSubtype,
      name: formatName,
      features: extractionResult.formatFeatures as object,
      commonTerms: [],
      fileCount: 1,
    },
  });
}

/**
 * 更新格式統計和特徵學習
 */
async function updateFormatStatistics(
  formatId: string,
  extractionResult: DocumentFormatExtractionResult,
  config: FormatIdentificationConfig
) {
  const updateData: Record<string, unknown> = {
    fileCount: { increment: 1 },
  };

  // 如果啟用特徵學習，合併新特徵
  if (config.learnFeatures) {
    const existingFormat = await prisma.documentFormat.findUnique({
      where: { id: formatId },
      select: { features: true },
    });

    if (existingFormat?.features) {
      const mergedFeatures = mergeFormatFeatures(
        existingFormat.features as DocumentFormatFeatures,
        extractionResult.formatFeatures
      );
      updateData.features = mergedFeatures;
    }
  }

  await prisma.documentFormat.update({
    where: { id: formatId },
    data: updateData,
  });
}

/**
 * 合併格式特徵（學習新特徵）
 */
function mergeFormatFeatures(
  existing: DocumentFormatFeatures,
  newFeatures: DocumentFormatFeatures
): DocumentFormatFeatures {
  return {
    hasLineItems: existing.hasLineItems || newFeatures.hasLineItems,
    hasHeaderLogo: existing.hasHeaderLogo || newFeatures.hasHeaderLogo,
    currency: newFeatures.currency || existing.currency,
    language: newFeatures.language || existing.language,
    typicalFields: Array.from(new Set([
      ...(existing.typicalFields || []),
      ...(newFeatures.typicalFields || []),
    ])),
    layoutPattern: newFeatures.layoutPattern || existing.layoutPattern,
  };
}

/**
 * 生成格式名稱
 */
function generateFormatName(
  documentType: DocumentType,
  documentSubtype: DocumentSubtype
): string {
  const typeNames: Record<DocumentType, string> = {
    INVOICE: 'Invoice',
    DEBIT_NOTE: 'Debit Note',
    CREDIT_NOTE: 'Credit Note',
    STATEMENT: 'Statement',
    QUOTATION: 'Quotation',
    BILL_OF_LADING: 'Bill of Lading',
    CUSTOMS_DECLARATION: 'Customs Declaration',
    OTHER: 'Other Document',
  };

  const subtypeNames: Record<DocumentSubtype, string> = {
    OCEAN_FREIGHT: 'Ocean Freight',
    AIR_FREIGHT: 'Air Freight',
    LAND_TRANSPORT: 'Land Transport',
    CUSTOMS_CLEARANCE: 'Customs Clearance',
    WAREHOUSING: 'Warehousing',
    GENERAL: 'General',
  };

  return `${subtypeNames[documentSubtype]} ${typeNames[documentType]}`;
}

/**
 * 更新格式的常見術語
 */
export async function updateFormatCommonTerms(
  formatId: string,
  newTerms: string[]
): Promise<void> {
  const format = await prisma.documentFormat.findUnique({
    where: { id: formatId },
    select: { commonTerms: true },
  });

  if (!format) return;

  // 合併並去重，保留前 100 個最常見的術語
  const allTerms = [...format.commonTerms, ...newTerms];
  const termCounts = allTerms.reduce((acc, term) => {
    acc[term] = (acc[term] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedTerms = Object.entries(termCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([term]) => term);

  await prisma.documentFormat.update({
    where: { id: formatId },
    data: { commonTerms: sortedTerms },
  });
}
```

### 三層術語聚合服務

```typescript
// src/services/hierarchical-term-aggregation.service.ts

/**
 * @fileoverview 三層術語聚合服務
 * @module src/services/hierarchical-term-aggregation
 * @since Epic 0 - Story 0.9
 *
 * @description
 *   實現 Company → DocumentFormat → Terms 三層聚合結構。
 *   取代原有的扁平聚合邏輯。
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *   - batch-term-aggregation.service - 原有聚合服務
 *   - gpt-nano - 術語分類處理
 */

import { prisma } from '@/lib/prisma';
import type {
  HierarchicalTermAggregation,
  CompanyTermNode,
  FormatTermNode,
  TermNode,
  AggregationSummary,
} from '@/types/document-format';
import { normalizeForAggregation } from './batch-term-aggregation.service';
import { classifyTermWithGPT } from './term-classification.service';

/**
 * 執行三層術語聚合
 *
 * @param batchId - 批次 ID
 * @param options - 聚合選項
 * @returns 三層聚合結果
 */
export async function aggregateTermsHierarchically(
  batchId: string,
  options: {
    includeClassification?: boolean;
    minTermFrequency?: number;
    maxTermsPerFormat?: number;
  } = {}
): Promise<HierarchicalTermAggregation> {
  const {
    includeClassification = true,
    minTermFrequency = 1,
    maxTermsPerFormat = 500,
  } = options;

  // 1. 獲取所有已處理文件（包含發行者和格式資訊）
  const files = await prisma.historicalFile.findMany({
    where: {
      batchId,
      status: 'COMPLETED',
      documentIssuerId: { not: null },
      documentFormatId: { not: null },
    },
    include: {
      documentIssuer: true,
      documentFormat: true,
    },
  });

  // 2. 建立三層結構的 Map
  const companyMap = new Map<string, {
    company: typeof files[0]['documentIssuer'];
    formats: Map<string, {
      format: typeof files[0]['documentFormat'];
      terms: Map<string, { count: number; examples: string[] }>;
    }>;
  }>();

  // 3. 遍歷文件，組織數據
  for (const file of files) {
    const issuerId = file.documentIssuerId!;
    const formatId = file.documentFormatId!;

    // 確保公司節點存在
    if (!companyMap.has(issuerId)) {
      companyMap.set(issuerId, {
        company: file.documentIssuer!,
        formats: new Map(),
      });
    }

    const companyNode = companyMap.get(issuerId)!;

    // 確保格式節點存在
    if (!companyNode.formats.has(formatId)) {
      companyNode.formats.set(formatId, {
        format: file.documentFormat!,
        terms: new Map(),
      });
    }

    const formatNode = companyNode.formats.get(formatId)!;

    // 提取並聚合術語
    const extractionResult = file.extractionResult as {
      lineItems?: Array<{ description?: string }>;
    };

    for (const item of extractionResult?.lineItems || []) {
      if (!item.description) continue;

      const normalizedTerm = normalizeForAggregation(item.description);
      if (!normalizedTerm) continue;

      const existing = formatNode.terms.get(normalizedTerm);
      if (existing) {
        existing.count++;
        if (existing.examples.length < 3) {
          existing.examples.push(item.description);
        }
      } else {
        formatNode.terms.set(normalizedTerm, {
          count: 1,
          examples: [item.description],
        });
      }
    }
  }

  // 4. 轉換為輸出結構
  const companies: CompanyTermNode[] = [];
  let totalFormats = 0;
  let totalUniqueTerms = 0;
  let totalTermOccurrences = 0;

  for (const [companyId, companyData] of companyMap) {
    const formats: FormatTermNode[] = [];

    for (const [formatId, formatData] of companyData.formats) {
      // 過濾和排序術語
      const terms: TermNode[] = [];

      for (const [term, data] of formatData.terms) {
        if (data.count < minTermFrequency) continue;

        const termNode: TermNode = {
          term,
          normalizedTerm: term,
          frequency: data.count,
          examples: data.examples,
        };

        // 可選：使用 GPT-nano 分類術語
        if (includeClassification) {
          try {
            const classification = await classifyTermWithGPT(term);
            termNode.suggestedCategory = classification.category;
            termNode.confidence = classification.confidence;
          } catch (error) {
            console.warn(`Failed to classify term: ${term}`, error);
          }
        }

        terms.push(termNode);
        totalTermOccurrences += data.count;
      }

      // 按頻率排序並限制數量
      terms.sort((a, b) => b.frequency - a.frequency);
      const limitedTerms = terms.slice(0, maxTermsPerFormat);

      totalUniqueTerms += limitedTerms.length;

      formats.push({
        formatId,
        documentType: formatData.format!.documentType as any,
        documentSubtype: formatData.format!.documentSubtype as any,
        formatName: formatData.format!.name || 'Unknown Format',
        fileCount: formatData.format!.fileCount,
        terms: limitedTerms,
        termCount: limitedTerms.length,
      });
    }

    totalFormats += formats.length;

    companies.push({
      companyId,
      companyName: companyData.company!.name,
      companyNameVariants: companyData.company!.nameVariants || [],
      fileCount: files.filter(f => f.documentIssuerId === companyId).length,
      formats,
    });
  }

  // 按文件數量排序公司
  companies.sort((a, b) => b.fileCount - a.fileCount);

  return {
    companies,
    summary: {
      totalCompanies: companies.length,
      totalFormats,
      totalUniqueTerms,
      totalTermOccurrences,
    },
  };
}

/**
 * 獲取特定公司的術語聚合
 */
export async function getCompanyTermAggregation(
  companyId: string
): Promise<CompanyTermNode | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) return null;

  const formats = await prisma.documentFormat.findMany({
    where: { companyId },
    include: {
      files: {
        where: { status: 'COMPLETED' },
        select: { extractionResult: true },
      },
    },
  });

  const formatNodes: FormatTermNode[] = [];

  for (const format of formats) {
    const termMap = new Map<string, number>();

    for (const file of format.files) {
      const result = file.extractionResult as {
        lineItems?: Array<{ description?: string }>;
      };

      for (const item of result?.lineItems || []) {
        if (!item.description) continue;
        const normalized = normalizeForAggregation(item.description);
        if (normalized) {
          termMap.set(normalized, (termMap.get(normalized) || 0) + 1);
        }
      }
    }

    const terms: TermNode[] = Array.from(termMap.entries())
      .map(([term, frequency]) => ({
        term,
        normalizedTerm: term,
        frequency,
      }))
      .sort((a, b) => b.frequency - a.frequency);

    formatNodes.push({
      formatId: format.id,
      documentType: format.documentType as any,
      documentSubtype: format.documentSubtype as any,
      formatName: format.name || 'Unknown',
      fileCount: format.fileCount,
      terms,
      termCount: terms.length,
    });
  }

  return {
    companyId,
    companyName: company.name,
    companyNameVariants: company.nameVariants || [],
    fileCount: formats.reduce((sum, f) => sum + f.fileCount, 0),
    formats: formatNodes,
  };
}
```

---

## API 端點

### 格式相關 API

```typescript
// src/app/api/v1/formats/route.ts

/**
 * @fileoverview 文件格式 API 端點
 * @module src/app/api/v1/formats
 * @since Epic 0 - Story 0.9
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// 查詢參數驗證
const querySchema = z.object({
  companyId: z.string().optional(),
  documentType: z.string().optional(),
  documentSubtype: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * GET /api/v1/formats
 * 獲取文件格式列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(searchParams));

    const where: Record<string, unknown> = {};
    if (query.companyId) where.companyId = query.companyId;
    if (query.documentType) where.documentType = query.documentType;
    if (query.documentSubtype) where.documentSubtype = query.documentSubtype;

    const [formats, total] = await Promise.all([
      prisma.documentFormat.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true },
          },
        },
        orderBy: { fileCount: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.documentFormat.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        formats: formats.map(f => ({
          id: f.id,
          companyId: f.companyId,
          companyName: f.company.name,
          documentType: f.documentType,
          documentSubtype: f.documentSubtype,
          name: f.name,
          fileCount: f.fileCount,
          commonTerms: f.commonTerms,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching formats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch formats' },
      { status: 500 }
    );
  }
}
```

```typescript
// src/app/api/v1/formats/[id]/terms/route.ts

/**
 * @fileoverview 格式術語 API 端點
 * @module src/app/api/v1/formats/[id]/terms
 * @since Epic 0 - Story 0.9
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFormatTermAggregation } from '@/services/hierarchical-term-aggregation.service';

/**
 * GET /api/v1/formats/:id/terms
 * 獲取特定格式的術語聚合
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const terms = await getFormatTermAggregation(params.id);

    if (!terms) {
      return NextResponse.json(
        { success: false, error: 'Format not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: terms,
    });
  } catch (error) {
    console.error('Error fetching format terms:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch format terms' },
      { status: 500 }
    );
  }
}
```

### 三層聚合 API

```typescript
// src/app/api/v1/batches/[batchId]/hierarchical-terms/route.ts

/**
 * @fileoverview 三層術語聚合 API 端點
 * @module src/app/api/v1/batches/[batchId]/hierarchical-terms
 * @since Epic 0 - Story 0.9
 */

import { NextRequest, NextResponse } from 'next/server';
import { aggregateTermsHierarchically } from '@/services/hierarchical-term-aggregation.service';
import { z } from 'zod';

const querySchema = z.object({
  includeClassification: z.coerce.boolean().default(true),
  minTermFrequency: z.coerce.number().min(1).default(1),
  maxTermsPerFormat: z.coerce.number().min(10).max(1000).default(500),
});

/**
 * GET /api/v1/batches/:batchId/hierarchical-terms
 * 獲取批次的三層術語聚合
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const options = querySchema.parse(Object.fromEntries(searchParams));

    const aggregation = await aggregateTermsHierarchically(
      params.batchId,
      options
    );

    return NextResponse.json({
      success: true,
      data: aggregation,
    });
  } catch (error) {
    console.error('Error aggregating terms:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to aggregate terms' },
      { status: 500 }
    );
  }
}
```

---

## UI 組件

### 公司格式樹組件

```typescript
// src/components/features/term-analysis/CompanyFormatTree.tsx

/**
 * @fileoverview 公司格式樹狀組件
 * @component CompanyFormatTree
 * @since Epic 0 - Story 0.9
 */

'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Building2, FileText, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompanyTermNode, FormatTermNode } from '@/types/document-format';

interface CompanyFormatTreeProps {
  companies: CompanyTermNode[];
  selectedFormatId?: string;
  onFormatSelect?: (formatId: string) => void;
}

export function CompanyFormatTree({
  companies,
  selectedFormatId,
  onFormatSelect,
}: CompanyFormatTreeProps) {
  const [expandedCompanies, setExpandedCompanies] = React.useState<Set<string>>(
    new Set()
  );

  const toggleCompany = (companyId: string) => {
    const newExpanded = new Set(expandedCompanies);
    if (newExpanded.has(companyId)) {
      newExpanded.delete(companyId);
    } else {
      newExpanded.add(companyId);
    }
    setExpandedCompanies(newExpanded);
  };

  return (
    <div className="space-y-1">
      {companies.map((company) => (
        <CompanyNode
          key={company.companyId}
          company={company}
          isExpanded={expandedCompanies.has(company.companyId)}
          onToggle={() => toggleCompany(company.companyId)}
          selectedFormatId={selectedFormatId}
          onFormatSelect={onFormatSelect}
        />
      ))}
    </div>
  );
}

interface CompanyNodeProps {
  company: CompanyTermNode;
  isExpanded: boolean;
  onToggle: () => void;
  selectedFormatId?: string;
  onFormatSelect?: (formatId: string) => void;
}

function CompanyNode({
  company,
  isExpanded,
  onToggle,
  selectedFormatId,
  onFormatSelect,
}: CompanyNodeProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full p-2 hover:bg-muted rounded-md text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Building2 className="h-4 w-4 text-blue-500" />
        <span className="font-medium">{company.companyName}</span>
        <span className="text-muted-foreground text-sm">
          ({company.formats.length} formats, {company.fileCount} files)
        </span>
      </button>

      {isExpanded && (
        <div className="ml-6 space-y-1">
          {company.formats.map((format) => (
            <FormatNode
              key={format.formatId}
              format={format}
              isSelected={selectedFormatId === format.formatId}
              onSelect={() => onFormatSelect?.(format.formatId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FormatNodeProps {
  format: FormatTermNode;
  isSelected: boolean;
  onSelect: () => void;
}

function FormatNode({ format, isSelected, onSelect }: FormatNodeProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2 w-full p-2 rounded-md text-left',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted'
      )}
    >
      <FileText className="h-4 w-4 text-green-500" />
      <span>{format.formatName}</span>
      <span className="text-muted-foreground text-sm flex items-center gap-1">
        <Tag className="h-3 w-3" />
        {format.termCount} terms
      </span>
    </button>
  );
}
```

### 格式術語面板

```typescript
// src/components/features/term-analysis/FormatTermsPanel.tsx

/**
 * @fileoverview 格式術語面板組件
 * @component FormatTermsPanel
 * @since Epic 0 - Story 0.9
 */

'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import type { FormatTermNode, TermNode } from '@/types/document-format';

interface FormatTermsPanelProps {
  format: FormatTermNode | null;
}

export function FormatTermsPanel({ format }: FormatTermsPanelProps) {
  const [searchTerm, setSearchTerm] = React.useState('');

  if (!format) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        請選擇一個文件格式以查看術語
      </div>
    );
  }

  const filteredTerms = format.terms.filter((term) =>
    term.term.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{format.formatName}</h3>
          <p className="text-sm text-muted-foreground">
            {format.documentType} - {format.documentSubtype} | {format.fileCount} files
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋術語..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>術語</TableHead>
              <TableHead className="w-24 text-right">出現次數</TableHead>
              <TableHead className="w-32">建議分類</TableHead>
              <TableHead className="w-24 text-right">信心度</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTerms.map((term) => (
              <TermRow key={term.term} term={term} />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        顯示 {filteredTerms.length} / {format.termCount} 個術語
      </div>
    </div>
  );
}

function TermRow({ term }: { term: TermNode }) {
  return (
    <TableRow>
      <TableCell className="font-mono">{term.term}</TableCell>
      <TableCell className="text-right">{term.frequency}</TableCell>
      <TableCell>
        {term.suggestedCategory && (
          <Badge variant="outline">{term.suggestedCategory}</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        {term.confidence !== undefined && (
          <span className={term.confidence >= 90 ? 'text-green-600' : 'text-yellow-600'}>
            {term.confidence}%
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}
```

---

## 測試策略

### 單元測試

```typescript
// tests/unit/services/document-format.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  processDocumentFormat,
  updateFormatCommonTerms,
} from '@/services/document-format.service';

describe('DocumentFormatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processDocumentFormat', () => {
    it('should match existing format', async () => {
      // Mock existing format
      vi.mocked(prisma.documentFormat.findUnique).mockResolvedValue({
        id: 'format-1',
        companyId: 'company-1',
        documentType: 'INVOICE',
        documentSubtype: 'OCEAN_FREIGHT',
        name: 'Ocean Freight Invoice',
        fileCount: 10,
      } as any);

      const result = await processDocumentFormat('company-1', {
        documentType: 'INVOICE',
        documentSubtype: 'OCEAN_FREIGHT',
        formatConfidence: 95,
        formatFeatures: {
          hasLineItems: true,
          hasHeaderLogo: true,
        },
      });

      expect(result).toMatchObject({
        formatId: 'format-1',
        isNewFormat: false,
        documentType: 'INVOICE',
        documentSubtype: 'OCEAN_FREIGHT',
      });
    });

    it('should create new format when not found', async () => {
      vi.mocked(prisma.documentFormat.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.documentFormat.create).mockResolvedValue({
        id: 'new-format-1',
        companyId: 'company-1',
        documentType: 'AIR_FREIGHT',
        documentSubtype: 'INVOICE',
      } as any);

      const result = await processDocumentFormat('company-1', {
        documentType: 'INVOICE',
        documentSubtype: 'AIR_FREIGHT',
        formatConfidence: 88,
        formatFeatures: {
          hasLineItems: true,
          hasHeaderLogo: false,
        },
      });

      expect(result?.isNewFormat).toBe(true);
    });

    it('should return null when confidence below threshold', async () => {
      const result = await processDocumentFormat('company-1', {
        documentType: 'INVOICE',
        documentSubtype: 'OCEAN_FREIGHT',
        formatConfidence: 50,  // Below default 70 threshold
        formatFeatures: {
          hasLineItems: true,
          hasHeaderLogo: true,
        },
      });

      expect(result).toBeNull();
    });
  });
});
```

### 整合測試

```typescript
// tests/integration/api/hierarchical-terms.test.ts

import { describe, it, expect } from 'vitest';
import { createTestBatch, createTestFiles } from '@/tests/helpers';

describe('Hierarchical Terms API', () => {
  it('should return three-layer aggregation structure', async () => {
    // Setup test data
    const batch = await createTestBatch();
    await createTestFiles(batch.id, {
      withIssuer: true,
      withFormat: true,
    });

    const response = await fetch(
      `/api/v1/batches/${batch.id}/hierarchical-terms`
    );
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.companies).toBeInstanceOf(Array);
    expect(data.data.summary).toMatchObject({
      totalCompanies: expect.any(Number),
      totalFormats: expect.any(Number),
      totalUniqueTerms: expect.any(Number),
    });

    // Verify structure
    const company = data.data.companies[0];
    expect(company).toHaveProperty('companyId');
    expect(company).toHaveProperty('formats');
    expect(company.formats[0]).toHaveProperty('terms');
  });
});
```

---

## 資料庫遷移

### 遷移腳本

```sql
-- prisma/migrations/YYYYMMDDHHMMSS_add_document_format/migration.sql

-- 創建 DocumentType enum
CREATE TYPE "DocumentType" AS ENUM (
  'INVOICE',
  'DEBIT_NOTE',
  'CREDIT_NOTE',
  'STATEMENT',
  'QUOTATION',
  'BILL_OF_LADING',
  'CUSTOMS_DECLARATION',
  'OTHER'
);

-- 創建 DocumentSubtype enum
CREATE TYPE "DocumentSubtype" AS ENUM (
  'OCEAN_FREIGHT',
  'AIR_FREIGHT',
  'LAND_TRANSPORT',
  'CUSTOMS_CLEARANCE',
  'WAREHOUSING',
  'GENERAL'
);

-- 創建 document_formats 表
CREATE TABLE "document_formats" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "document_type" "DocumentType" NOT NULL,
  "document_subtype" "DocumentSubtype" NOT NULL,
  "name" TEXT,
  "features" JSONB,
  "common_terms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "file_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "document_formats_pkey" PRIMARY KEY ("id")
);

-- 添加唯一約束
ALTER TABLE "document_formats" ADD CONSTRAINT "document_formats_company_id_document_type_document_subtype_key"
  UNIQUE ("company_id", "document_type", "document_subtype");

-- 添加外鍵
ALTER TABLE "document_formats" ADD CONSTRAINT "document_formats_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 擴展 historical_files 表
ALTER TABLE "historical_files" ADD COLUMN "document_format_id" TEXT;
ALTER TABLE "historical_files" ADD COLUMN "format_confidence" DOUBLE PRECISION;

-- 添加外鍵
ALTER TABLE "historical_files" ADD CONSTRAINT "historical_files_document_format_id_fkey"
  FOREIGN KEY ("document_format_id") REFERENCES "document_formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 創建索引
CREATE INDEX "document_formats_company_id_idx" ON "document_formats"("company_id");
CREATE INDEX "document_formats_document_type_idx" ON "document_formats"("document_type");
CREATE INDEX "historical_files_document_format_id_idx" ON "historical_files"("document_format_id");
```

---

## 實施計劃

### 階段 1: 資料模型（2-3 天）
1. 創建 Prisma Schema 擴展
2. 執行資料庫遷移
3. 創建類型定義文件

### 階段 2: GPT Vision 整合（2-3 天）
1. 擴展 extraction-prompt.ts
2. 實現格式識別 prompt
3. 處理 GPT-5.2 Vision 響應

### 階段 3: 服務層（3-4 天）
1. 實現 document-format.service.ts
2. 實現 hierarchical-term-aggregation.service.ts
3. 整合到批量處理流程

### 階段 4: API 端點（1-2 天）
1. 創建格式 CRUD API
2. 創建三層聚合 API
3. 更新現有批量處理 API

### 階段 5: UI 組件（2-3 天）
1. 創建 CompanyFormatTree 組件
2. 創建 FormatTermsPanel 組件
3. 更新術語分析頁面

### 階段 6: 測試與驗證（2-3 天）
1. 單元測試
2. 整合測試
3. 端到端測試
4. 效能測試

---

## 技術考量

### Azure OpenAI GPT-5.2 Vision
- 用於識別文件類型和子類型
- 提取格式特徵（佈局、欄位結構等）
- 與發行者識別共用同一 API 調用

### GPT-nano
- 用於術語分類
- 輕量級文字處理
- 成本效益考量

### 效能優化
- 格式匹配使用唯一索引
- 術語聚合使用 Map 結構減少數據庫查詢
- 分頁返回大量術語數據

### 向後兼容
- 保留原有扁平聚合 API
- 新增三層聚合 API
- 逐步遷移現有數據

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Tech Spec Version | 1.0 |
| Story ID | 0.9 |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.7, Story 0.8 |
| Estimated Points | 13 |
| Created | 2025-12-25 |
| Status | backlog |
