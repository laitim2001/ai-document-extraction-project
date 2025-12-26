# Story 0.9: 文件格式識別與術語重組

**Status:** backlog

---

## Story

**As a** 系統管理員,
**I want** 識別每間公司的不同文件格式類型，並按「公司 > 文件格式 > 術語」三層結構重組數據,
**So that** 可以準確了解每間公司使用的各種文件格式，以及每種格式中出現的費用術語。

---

## 背景說明

### 問題陳述

目前的術語聚合邏輯（Story 0.7）使用扁平結構：
- Company → Terms

但實際業務中，同一間公司可能有多種文件格式：
- DHL → Ocean Freight Invoice → 術語列表 A
- DHL → Air Freight Invoice → 術語列表 B
- DHL → Customs Declaration → 術語列表 C

### 解決方案

建立三層數據結構：
1. **Company（公司）**: 從文件發行者識別（Story 0.8）
2. **Document Format（文件格式）**: 由 GPT Vision 識別文件類型
3. **Terms（術語）**: 按公司 + 格式聚合

---

## Acceptance Criteria

### AC1: 文件格式識別

**Given** 一份發票文件
**When** 使用 Azure OpenAI GPT-5.2 Vision 處理
**Then** 系統識別：
  - documentType: 文件類型（Invoice, Debit Note, Credit Note, Statement 等）
  - documentSubtype: 子類型（Ocean Freight, Air Freight, Customs 等）
  - formatConfidence: 識別信心度（0-100%）

### AC2: DocumentFormat 資料模型

**Given** 識別到的文件格式資訊
**When** 系統處理結果
**Then** 創建/關聯 DocumentFormat 記錄：
  - 每個 Company 可有多個 DocumentFormat
  - 記錄該格式的特徵（欄位結構、常見術語等）
  - 追蹤該格式的文件數量

### AC3: 術語三層聚合

**Given** 批量處理完成
**When** 執行術語聚合分析
**Then** 按三層結構組織：
  - Level 1: Company（發行公司）
  - Level 2: DocumentFormat（文件格式）
  - Level 3: Terms（術語列表）

### AC4: 聚合統計視圖

**Given** 術語分析頁面
**When** 查看聚合結果
**Then** 顯示：
  - 公司樹狀結構（可展開/收合）
  - 每個公司下的文件格式列表
  - 每個格式下的術語統計
  - 跨格式術語比較

### AC5: 格式模板學習

**Given** 多份相同格式的文件
**When** 系統分析模式
**Then** 自動學習：
  - 該格式的常見欄位結構
  - 該格式的標準術語
  - 該格式的識別特徵

---

## Tasks / Subtasks

- [ ] **Task 1: GPT Vision Prompt 擴展** (AC: #1)
  - [ ] 1.1 修改 extraction-prompt.ts 新增 documentType 提取
  - [ ] 1.2 定義文件類型枚舉（DocumentType enum）
  - [ ] 1.3 定義文件子類型（DocumentSubtype enum）
  - [ ] 1.4 格式識別信心度計算

- [ ] **Task 2: DocumentFormat 資料模型** (AC: #2)
  - [ ] 2.1 創建 DocumentFormat Prisma 模型
  - [ ] 2.2 建立 Company-DocumentFormat 關聯
  - [ ] 2.3 建立 HistoricalFile-DocumentFormat 關聯
  - [ ] 2.4 執行資料庫遷移

- [ ] **Task 3: 格式識別服務** (AC: #1, #2)
  - [ ] 3.1 創建 src/services/document-format.service.ts
  - [ ] 3.2 實現 identifyDocumentFormat() 方法
  - [ ] 3.3 實現 matchOrCreateFormat() 方法
  - [ ] 3.4 格式特徵學習邏輯

- [ ] **Task 4: 術語聚合重構** (AC: #3)
  - [ ] 4.1 修改 batch-term-aggregation.service.ts
  - [ ] 4.2 實現三層聚合結構
  - [ ] 4.3 新增按格式篩選功能
  - [ ] 4.4 更新聚合 API 端點

- [ ] **Task 5: 類型定義擴展** (AC: #1-3)
  - [ ] 5.1 創建 src/types/document-format.ts
  - [ ] 5.2 定義 DocumentFormatResult interface
  - [ ] 5.3 定義 HierarchicalTermAggregation interface
  - [ ] 5.4 更新相關類型定義

- [ ] **Task 6: UI 組件更新** (AC: #4)
  - [ ] 6.1 創建 CompanyFormatTree 組件
  - [ ] 6.2 創建 FormatTermsPanel 組件
  - [ ] 6.3 更新術語分析頁面佈局
  - [ ] 6.4 實現格式比較視圖

- [ ] **Task 7: 批量處理整合** (AC: #1-3)
  - [ ] 7.1 修改批量處理流程
  - [ ] 7.2 整合格式識別步驟
  - [ ] 7.3 更新批量統計（格式分佈）

- [ ] **Task 8: 驗證與測試** (AC: #1-5)
  - [ ] 8.1 TypeScript 類型檢查通過
  - [ ] 8.2 ESLint 檢查通過
  - [ ] 8.3 單元測試：格式識別邏輯
  - [ ] 8.4 整合測試：三層聚合

---

## Dev Notes

### 依賴項

- **Story 0.7**: 批量術語聚合整合（提供聚合框架）
- **Story 0.8**: 文件發行者識別（提供 documentIssuerId）

### GPT Vision Prompt 擴展

```typescript
// src/lib/prompts/extraction-prompt.ts

const DOCUMENT_FORMAT_PROMPT = `
## Document Format Identification (文件格式識別)

Identify the TYPE and FORMAT of this document:

documentFormat: {
  documentType: The main document type
    - INVOICE: Standard invoice for services/goods
    - DEBIT_NOTE: Additional charges notification
    - CREDIT_NOTE: Refund or adjustment
    - STATEMENT: Account statement
    - QUOTATION: Price quote
    - BILL_OF_LADING: Shipping document
    - CUSTOMS_DECLARATION: Customs paperwork
    - OTHER: Other document types

  documentSubtype: The specific subtype based on business domain
    - OCEAN_FREIGHT: Sea shipping related
    - AIR_FREIGHT: Air shipping related
    - LAND_TRANSPORT: Ground/road transport
    - CUSTOMS_CLEARANCE: Customs processing
    - WAREHOUSING: Storage related
    - GENERAL: General/mixed services

  formatConfidence: 0-100 confidence in format identification

  formatFeatures: {
    hasLineItems: boolean,
    hasHeaderLogo: boolean,
    currency: detected currency code,
    language: primary language of document
  }
}
`;
```

### 資料模型

```prisma
// prisma/schema.prisma

// 文件類型
enum DocumentType {
  INVOICE
  DEBIT_NOTE
  CREDIT_NOTE
  STATEMENT
  QUOTATION
  BILL_OF_LADING
  CUSTOMS_DECLARATION
  OTHER
}

// 文件子類型
enum DocumentSubtype {
  OCEAN_FREIGHT
  AIR_FREIGHT
  LAND_TRANSPORT
  CUSTOMS_CLEARANCE
  WAREHOUSING
  GENERAL
}

// 文件格式模板
model DocumentFormat {
  id            String   @id @default(cuid())

  // 關聯公司（發行者）
  companyId     String   @map("company_id")
  company       Company  @relation(fields: [companyId], references: [id])

  // 格式識別
  documentType    DocumentType    @map("document_type")
  documentSubtype DocumentSubtype @map("document_subtype")

  // 格式名稱（自動生成或用戶自定義）
  name          String?

  // 格式特徵（JSON）
  features      Json?    @map("features")

  // 常見術語（用於快速查找）
  commonTerms   String[] @map("common_terms")

  // 統計
  fileCount     Int      @default(0) @map("file_count")

  // 時間戳
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // 關聯文件
  files         HistoricalFile[]

  @@unique([companyId, documentType, documentSubtype])
  @@map("document_formats")
}

// 擴展 HistoricalFile
model HistoricalFile {
  // 現有欄位...

  // 文件格式
  documentFormatId String?  @map("document_format_id")
  documentFormat   DocumentFormat? @relation(fields: [documentFormatId], references: [id])
}
```

### 三層聚合結構

```typescript
// src/types/document-format.ts

export interface HierarchicalTermAggregation {
  companies: CompanyTermNode[];
  totalCompanies: number;
  totalFormats: number;
  totalTerms: number;
}

export interface CompanyTermNode {
  companyId: string;
  companyName: string;
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
}

export interface TermNode {
  term: string;
  frequency: number;
  suggestedCategory?: string;
  confidence?: number;
}
```

### 聚合服務重構

```typescript
// src/services/batch-term-aggregation.service.ts

export async function aggregateTermsHierarchically(
  batchId: string
): Promise<HierarchicalTermAggregation> {
  // 1. 獲取所有已處理文件
  const files = await prisma.historicalFile.findMany({
    where: { batchId, status: 'COMPLETED' },
    include: {
      documentIssuer: true,
      documentFormat: true,
    },
  });

  // 2. 按 Company → Format → Terms 組織
  const companyMap = new Map<string, {
    company: Company;
    formats: Map<string, {
      format: DocumentFormat;
      terms: Map<string, number>;
    }>;
  }>();

  for (const file of files) {
    const issuerId = file.documentIssuerId;
    const formatId = file.documentFormatId;

    if (!issuerId || !formatId) continue;

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

    // 提取術語
    const result = file.extractionResult as ExtractionResult;
    for (const item of result.lineItems || []) {
      const term = normalizeForAggregation(item.description);
      formatNode.terms.set(term, (formatNode.terms.get(term) || 0) + 1);
    }
  }

  // 3. 轉換為輸出結構
  return transformToHierarchicalResult(companyMap);
}
```

### 技術考量

1. **Azure OpenAI GPT-5.2 Vision**: 用於識別文件格式
2. **GPT-nano**: 用於術語分類的文字處理
3. **格式去重**: 使用 (companyId, documentType, documentSubtype) 唯一約束
4. **漸進式學習**: 隨著處理更多文件，格式特徵更加準確

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 0.9 |
| Story Key | 0-9-document-format-term-reorganization |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.7, Story 0.8 |
| Estimated Points | 13 |

---

*Story created: 2025-12-25*
*Status: backlog*
