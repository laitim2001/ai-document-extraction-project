# Story 0.8: 文件發行者識別

**Status:** backlog

---

## Story

**As a** 系統管理員,
**I want** 從文件的標題/Logo/頁首自動識別文件發行公司,
**So that** 可以準確知道每份文件是由哪間公司（如貨運代理商）發出的，而非僅從交易對象欄位判斷。

---

## 背景說明

### 問題陳述

目前的公司識別邏輯（Story 0.6）從 vendor/shipper/consignee 等交易欄位提取公司名稱，但這些是「交易對象」而非「文件發行者」。

**範例說明**：
- 一份由 DHL 發出的發票，vendor 欄位可能是 "ABC Trading Co."（客戶）
- 但我們需要識別的是「DHL」這間發出發票的公司
- DHL 的資訊通常出現在文件的標題區域、Logo、或頁首

### 解決方案

利用 Azure OpenAI GPT-5.2 Vision 模型，像人類一樣「看」文件，從視覺元素中識別文件發行者：
- 公司 Logo
- 文件標題區域的公司名稱
- 頁首/頁尾的公司資訊
- 發票抬頭

---

## Acceptance Criteria

### AC1: GPT Vision 文件發行者提取

**Given** 一份發票文件（PDF 或圖片）
**When** 使用 Azure OpenAI GPT-5.2 Vision 處理
**Then** 系統提取：
  - documentIssuer: 發行公司名稱（從 Logo/標題識別）
  - issuerConfidence: 識別信心度（0-100%）
  - issuerIdentificationMethod: 識別方法（LOGO, HEADER, LETTERHEAD, FOOTER）

### AC2: 文件發行者 vs 交易對象區分

**Given** GPT Vision 提取結果
**When** 查看處理結果
**Then** 清楚區分：
  - documentIssuer: 發出文件的公司（如 DHL）
  - transactionParties: 交易相關方（vendor, shipper, consignee 等）
  - 兩者獨立儲存，不互相覆蓋

### AC3: 發行者與公司 Profile 關聯

**Given** 識別到的 documentIssuer
**When** 系統處理識別結果
**Then** 使用三層匹配策略關聯公司：
  1. Exact Match: 完全相同（忽略大小寫）
  2. Variant Match: 檢查已知變體名稱（如 "DHL Express" vs "DHL"）
  3. Fuzzy Match: 90% 相似度閾值
  4. 如都未匹配：建立新公司（狀態：PENDING）

### AC4: 批量處理整合

**Given** 歷史數據批量處理流程
**When** 每個文件完成處理
**Then**：
  - 自動提取 documentIssuer
  - 關聯到對應公司 Profile
  - 更新 HistoricalFile.documentIssuerId
  - 批量統計記錄發行者分佈

### AC5: 發行者識別配置

**Given** 批量處理配置
**When** 啟動批量處理
**Then** 可配置：
  - 是否啟用 documentIssuer 識別（預設開啟）
  - 識別信心度閾值（預設 70%）
  - 優先識別方法（LOGO > HEADER > LETTERHEAD）

---

## Tasks / Subtasks

- [ ] **Task 1: GPT Vision Prompt 擴展** (AC: #1)
  - [ ] 1.1 修改 src/lib/prompts/extraction-prompt.ts
  - [ ] 1.2 新增 documentIssuer 提取指令
  - [ ] 1.3 新增 issuerIdentificationMethod 欄位
  - [ ] 1.4 設計識別優先順序邏輯

- [ ] **Task 2: 資料模型擴展** (AC: #2, #3)
  - [ ] 2.1 擴展 Prisma Schema - HistoricalFile 新增 documentIssuerId
  - [ ] 2.2 創建 FileTransactionParty 模型（多對多關聯）
  - [ ] 2.3 新增 IssuerIdentificationMethod enum
  - [ ] 2.4 執行資料庫遷移

- [ ] **Task 3: 發行者識別服務** (AC: #1, #3)
  - [ ] 3.1 創建 src/services/document-issuer.service.ts
  - [ ] 3.2 實現 extractDocumentIssuer() 方法
  - [ ] 3.3 實現 matchIssuerToCompany() 方法
  - [ ] 3.4 信心度計算邏輯

- [ ] **Task 4: 類型定義擴展** (AC: #1, #2)
  - [ ] 4.1 創建 src/types/document-issuer.ts
  - [ ] 4.2 定義 DocumentIssuerResult interface
  - [ ] 4.3 定義 TransactionParty interface
  - [ ] 4.4 更新 ExtractionResult 類型

- [ ] **Task 5: 批量處理整合** (AC: #4)
  - [ ] 5.1 修改 src/services/batch-processor.service.ts
  - [ ] 5.2 在處理流程中加入發行者識別
  - [ ] 5.3 更新批量統計（發行者分佈）
  - [ ] 5.4 錯誤處理（識別失敗不中斷主流程）

- [ ] **Task 6: 配置 UI 擴展** (AC: #5)
  - [ ] 6.1 修改 CreateBatchDialog 添加配置選項
  - [ ] 6.2 識別方法優先順序配置
  - [ ] 6.3 信心度閾值配置

- [ ] **Task 7: 驗證與測試** (AC: #1-5)
  - [ ] 7.1 TypeScript 類型檢查通過
  - [ ] 7.2 ESLint 檢查通過
  - [ ] 7.3 單元測試：發行者識別邏輯
  - [ ] 7.4 整合測試：批量處理 + 發行者識別

---

## Dev Notes

### 依賴項

- **Story 0.2**: 智能處理路由（GPT Vision 處理）
- **Story 0.3**: 即時公司 Profile 建立（公司匹配邏輯）
- **Story 0.6**: 批量處理公司識別整合（提供整合框架）

### GPT Vision Prompt 擴展

```typescript
// src/lib/prompts/extraction-prompt.ts

const DOCUMENT_ISSUER_PROMPT = `
## Document Issuer Identification (文件發行者識別)

IMPORTANT: Identify the COMPANY THAT ISSUED this document (NOT the transaction parties).

Look for the company identity in these areas (in priority order):
1. **Company Logo** - Usually at top-left or top-center of the document
2. **Document Header** - Company name in the header/title area
3. **Letterhead** - Official letterhead with company branding
4. **Footer** - Company information at the bottom

Extract:
- documentIssuer: {
    name: "Company name that issued this document",
    identificationMethod: "LOGO" | "HEADER" | "LETTERHEAD" | "FOOTER",
    confidence: 0-100,
    rawText: "Original text as seen on document"
  }

DISTINGUISH FROM Transaction Parties:
- documentIssuer: The company that CREATED and SENT this invoice (e.g., DHL, FedEx, Kuehne+Nagel)
- vendor/shipper/consignee: The parties INVOLVED in the transaction (customers, shippers, receivers)

Example:
- A DHL invoice for shipping goods from ABC Corp to XYZ Ltd:
  - documentIssuer: "DHL Express"
  - vendor: "DHL Express" (may be same)
  - shipper: "ABC Corp"
  - consignee: "XYZ Ltd"
`;
```

### 資料模型擴展

```prisma
// prisma/schema.prisma

// 發行者識別方法
enum IssuerIdentificationMethod {
  LOGO
  HEADER
  LETTERHEAD
  FOOTER
  AI_INFERENCE  // AI 推斷（無明確視覺線索）
}

// 擴展 HistoricalFile
model HistoricalFile {
  // 現有欄位...

  // 文件發行者（發出文件的公司）
  documentIssuerId              String?  @map("document_issuer_id")
  documentIssuer                Company? @relation("FileDocumentIssuer", fields: [documentIssuerId], references: [id])
  issuerIdentificationMethod    IssuerIdentificationMethod? @map("issuer_identification_method")
  issuerConfidence              Float?   @map("issuer_confidence")

  // 交易對象（多對多）
  transactionParties FileTransactionParty[]
}

// 交易對象關聯表
model FileTransactionParty {
  id        String   @id @default(cuid())
  fileId    String   @map("file_id")
  file      HistoricalFile @relation(fields: [fileId], references: [id], onDelete: Cascade)

  companyId String   @map("company_id")
  company   Company  @relation(fields: [companyId], references: [id])

  role      TransactionPartyRole @map("role")

  createdAt DateTime @default(now()) @map("created_at")

  @@unique([fileId, companyId, role])
  @@map("file_transaction_parties")
}

enum TransactionPartyRole {
  VENDOR
  SHIPPER
  CONSIGNEE
  CARRIER
  BUYER
  SELLER
  NOTIFY_PARTY
  OTHER
}
```

### 類型定義

```typescript
// src/types/document-issuer.ts

export type IssuerIdentificationMethod =
  | 'LOGO'
  | 'HEADER'
  | 'LETTERHEAD'
  | 'FOOTER'
  | 'AI_INFERENCE';

export interface DocumentIssuerResult {
  name: string;
  identificationMethod: IssuerIdentificationMethod;
  confidence: number;  // 0-100
  rawText?: string;
  companyId?: string;  // 匹配到的公司 ID
  isNewCompany?: boolean;  // 是否為新建公司
}

export interface TransactionParty {
  role: TransactionPartyRole;
  name: string;
  companyId?: string;
}

export type TransactionPartyRole =
  | 'VENDOR'
  | 'SHIPPER'
  | 'CONSIGNEE'
  | 'CARRIER'
  | 'BUYER'
  | 'SELLER'
  | 'NOTIFY_PARTY'
  | 'OTHER';
```

### 服務實現

```typescript
// src/services/document-issuer.service.ts

import { prisma } from '@/lib/prisma';
import { matchCompanyName } from './company-matcher.service';

export async function extractDocumentIssuer(
  extractionResult: ExtractionResult
): Promise<DocumentIssuerResult | null> {
  // 從 GPT Vision 結果中提取 documentIssuer
  const issuerData = extractionResult.documentIssuer;

  if (!issuerData?.name) {
    return null;
  }

  // 匹配公司 Profile
  const matchResult = await matchCompanyName(issuerData.name, {
    fuzzyThreshold: 0.9,
    createIfNotFound: true,
    source: 'DOCUMENT_ISSUER',
  });

  return {
    name: issuerData.name,
    identificationMethod: issuerData.identificationMethod || 'AI_INFERENCE',
    confidence: issuerData.confidence || 0,
    rawText: issuerData.rawText,
    companyId: matchResult.companyId,
    isNewCompany: matchResult.isNew,
  };
}

export async function processTransactionParties(
  fileId: string,
  extractionResult: ExtractionResult
): Promise<void> {
  const parties: { role: TransactionPartyRole; name: string }[] = [];

  // 收集所有交易對象
  if (extractionResult.vendor?.name) {
    parties.push({ role: 'VENDOR', name: extractionResult.vendor.name });
  }
  if (extractionResult.shipper?.name) {
    parties.push({ role: 'SHIPPER', name: extractionResult.shipper.name });
  }
  if (extractionResult.consignee?.name) {
    parties.push({ role: 'CONSIGNEE', name: extractionResult.consignee.name });
  }

  // 為每個交易對象匹配/創建公司 Profile
  for (const party of parties) {
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
  }
}
```

### 與 Story 0.9 的關係

Story 0.8 專注於「文件發行者識別」，為 Story 0.9（文件格式識別與術語重組）提供基礎：

- **Story 0.8 輸出**: documentIssuerId（發行公司）
- **Story 0.9 使用**: 基於 documentIssuerId 識別該公司的文件格式類型

### 技術考量

1. **Azure OpenAI GPT-5.2 Vision**: 用於識別文件 Logo/標題
2. **識別失敗處理**: 如果無法識別發行者，記錄為 null，不影響其他處理
3. **信心度閾值**: 低於閾值的識別結果標記為需人工確認
4. **效能**: 發行者識別與現有 OCR 處理並行，不增加額外 API 調用

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 0.8 |
| Story Key | 0-8-document-issuer-identification |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.2, Story 0.3, Story 0.6 |
| Estimated Points | 8 |

---

*Story created: 2025-12-25*
*Status: backlog*
