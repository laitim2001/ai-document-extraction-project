# Story 0-3: 即時公司 Profile 建立 - Technical Specification

**Version:** 1.0
**Created:** 2025-12-22
**Status:** Ready for Development (需先完成 REFACTOR-001)
**Story Key:** 0-3-just-in-time-company-profile

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 0.3 |
| Epic | Epic 0: 歷史數據初始化 |
| Estimated Effort | High |
| Dependencies | REFACTOR-001, Story 0.2 |
| Blocking | Story 0.5, Epic 5 |

---

## Objective

實現 Just-in-Time 公司 Profile 建立機制，當處理歷史文件時遇到未知公司，自動創建待審核的公司記錄，支援模糊匹配和合併功能。

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | 自動建立公司 Profile | Company creation with PENDING status |
| AC2 | 模糊名稱匹配 | Levenshtein distance + normalization |
| AC3 | 人工合併介面 | Merge UI + company consolidation |
| AC4 | 自動類型推測 | LLM classification for company type |
| AC5 | 名稱變體記錄 | nameVariants array management |

---

## Prerequisites

### REFACTOR-001: Forwarder → Company

此 Story 依賴 REFACTOR-001 完成，必須先將 Forwarder 模型重構為 Company 模型。

**需要的 Company 模型欄位：**
- `type`: CompanyType (FORWARDER, EXPORTER, CARRIER, etc.)
- `status`: CompanyStatus (ACTIVE, PENDING, MERGED)
- `source`: CompanySource (MANUAL, AUTO_CREATED, IMPORTED)
- `nameVariants`: String[] - 名稱變體
- `mergedIntoId`: String? - 合併目標

---

## Data Models

### Company Model (REFACTOR-001 後)

```prisma
// prisma/schema.prisma

model Company {
  id            String        @id @default(uuid())
  name          String        // 主要名稱
  code          String?       @unique // 系統代碼（可選）
  displayName   String        @map("display_name")
  description   String?

  // 公司類型
  type          CompanyType   @default(UNKNOWN)

  // 公司狀態
  status        CompanyStatus @default(PENDING)

  // 建立來源
  source        CompanySource @default(MANUAL)

  // 名稱變體（用於模糊匹配）
  nameVariants  String[]      @map("name_variants")

  // 合併相關
  mergedIntoId  String?       @map("merged_into_id")
  mergedInto    Company?      @relation("CompanyMerge", fields: [mergedIntoId], references: [id])
  mergedFrom    Company[]     @relation("CompanyMerge")

  // 首次出現文件
  firstSeenDocumentId String? @map("first_seen_document_id")

  // 保留欄位
  priority      Int           @default(0)
  logoUrl       String?       @map("logo_url")
  contactEmail  String?       @map("contact_email")
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")
  createdBy     String        @map("created_by")

  // 關聯
  creator            User              @relation(fields: [createdBy], references: [id])
  mappingRules       MappingRule[]
  documents          Document[]
  ruleSuggestions    RuleSuggestion[]
  correctionPatterns CorrectionPattern[]
  historicalFiles    HistoricalFile[]

  @@index([type])
  @@index([status])
  @@index([name])
  @@map("companies")
}

enum CompanyType {
  FORWARDER       // 貨運代理商
  EXPORTER        // 出口商
  CARRIER         // 承運人
  CUSTOMS_BROKER  // 報關行
  OTHER           // 其他
  UNKNOWN         // 未分類
}

enum CompanyStatus {
  ACTIVE          // 啟用
  INACTIVE        // 停用
  PENDING         // 待審核
  MERGED          // 已合併
}

enum CompanySource {
  MANUAL          // 手動建立
  AUTO_CREATED    // 自動建立（Just-in-Time）
  IMPORTED        // 批量匯入
}
```

### Company Match Result Type

```typescript
// src/types/company-match.ts

export interface CompanyMatchResult {
  matchType: 'EXACT' | 'FUZZY' | 'NEW';
  company: Company | null;
  confidence: number;        // 0-1
  matchedVariant?: string;   // 匹配到的名稱變體
  suggestedMatches?: Array<{
    company: Company;
    similarity: number;
    matchedOn: string;
  }>;
}

export interface CompanyTypeClassification {
  type: CompanyType;
  confidence: number;
  reasoning: string;
}
```

---

## Implementation Guide

### Phase 1: 公司匹配服務 (45 min)

#### Step 1.1: 創建名稱標準化工具

Create `src/lib/utils/company-name.ts`:

```typescript
/**
 * @fileoverview 公司名稱標準化工具
 * @module src/lib/utils/company-name
 * @since Epic 0 - Story 0.3
 */

// ============================================
// Name Normalization
// ============================================

/**
 * 標準化公司名稱（用於匹配）
 */
export function normalizeCompanyName(name: string): string {
  return name
    // 轉小寫
    .toLowerCase()
    // 移除常見公司後綴
    .replace(/\b(co\.?|ltd\.?|inc\.?|corp\.?|llc|pte|limited|corporation|company)\b/gi, '')
    // 移除標點符號
    .replace(/[.,\-_&()]/g, ' ')
    // 移除多餘空格
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 計算 Levenshtein 距離
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * 計算相似度 (0-1)
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const normalized1 = normalizeCompanyName(s1);
  const normalized2 = normalizeCompanyName(s2);

  if (normalized1 === normalized2) return 1;

  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  return 1 - distance / maxLength;
}

/**
 * 提取公司名稱的關鍵詞
 */
export function extractKeywords(name: string): string[] {
  const normalized = normalizeCompanyName(name);
  return normalized.split(' ').filter(word => word.length > 2);
}
```

#### Step 1.2: 創建公司匹配服務

Create `src/services/company-match.service.ts`:

```typescript
/**
 * @fileoverview 公司匹配服務
 * @description
 *   - 精確匹配（名稱和變體）
 *   - 模糊匹配（Levenshtein 距離）
 *   - 匹配建議
 *
 * @module src/services/company-match
 * @since Epic 0 - Story 0.3
 */

import { prisma } from '@/lib/prisma';
import { Company, CompanyStatus } from '@prisma/client';
import {
  normalizeCompanyName,
  calculateSimilarity,
} from '@/lib/utils/company-name';
import { CompanyMatchResult } from '@/types/company-match';

// ============================================
// Match Configuration
// ============================================

const MATCH_CONFIG = {
  EXACT_THRESHOLD: 1.0,
  FUZZY_THRESHOLD: 0.8,       // 80% 相似度視為模糊匹配
  SUGGESTION_THRESHOLD: 0.6,  // 60% 以上提供建議
  MAX_SUGGESTIONS: 5,
} as const;

// ============================================
// Main Match Function
// ============================================

/**
 * 匹配公司名稱
 */
export async function matchCompany(
  vendorName: string
): Promise<CompanyMatchResult> {
  const normalizedInput = normalizeCompanyName(vendorName);

  // 1. 精確匹配（主名稱）
  const exactMatch = await prisma.company.findFirst({
    where: {
      status: { not: 'MERGED' },
      OR: [
        { name: { equals: vendorName, mode: 'insensitive' } },
        { displayName: { equals: vendorName, mode: 'insensitive' } },
      ],
    },
  });

  if (exactMatch) {
    return {
      matchType: 'EXACT',
      company: exactMatch,
      confidence: 1.0,
    };
  }

  // 2. 精確匹配（名稱變體）
  const variantMatch = await findVariantMatch(vendorName);
  if (variantMatch) {
    return {
      matchType: 'EXACT',
      company: variantMatch.company,
      confidence: 1.0,
      matchedVariant: variantMatch.variant,
    };
  }

  // 3. 模糊匹配
  const allCompanies = await prisma.company.findMany({
    where: { status: { not: 'MERGED' } },
    select: {
      id: true,
      name: true,
      displayName: true,
      nameVariants: true,
      type: true,
      status: true,
    },
  });

  const matches: Array<{
    company: typeof allCompanies[0];
    similarity: number;
    matchedOn: string;
  }> = [];

  for (const company of allCompanies) {
    // 檢查主名稱
    const nameSimilarity = calculateSimilarity(vendorName, company.name);
    if (nameSimilarity >= MATCH_CONFIG.SUGGESTION_THRESHOLD) {
      matches.push({
        company,
        similarity: nameSimilarity,
        matchedOn: company.name,
      });
    }

    // 檢查顯示名稱
    if (company.displayName !== company.name) {
      const displaySimilarity = calculateSimilarity(vendorName, company.displayName);
      if (displaySimilarity >= MATCH_CONFIG.SUGGESTION_THRESHOLD) {
        matches.push({
          company,
          similarity: displaySimilarity,
          matchedOn: company.displayName,
        });
      }
    }

    // 檢查名稱變體
    for (const variant of company.nameVariants) {
      const variantSimilarity = calculateSimilarity(vendorName, variant);
      if (variantSimilarity >= MATCH_CONFIG.SUGGESTION_THRESHOLD) {
        matches.push({
          company,
          similarity: variantSimilarity,
          matchedOn: variant,
        });
      }
    }
  }

  // 排序並去重
  const sortedMatches = matches
    .sort((a, b) => b.similarity - a.similarity)
    .filter((match, index, self) =>
      index === self.findIndex(m => m.company.id === match.company.id)
    )
    .slice(0, MATCH_CONFIG.MAX_SUGGESTIONS);

  // 檢查是否有高信心度模糊匹配
  const topMatch = sortedMatches[0];
  if (topMatch && topMatch.similarity >= MATCH_CONFIG.FUZZY_THRESHOLD) {
    const fullCompany = await prisma.company.findUnique({
      where: { id: topMatch.company.id },
    });

    return {
      matchType: 'FUZZY',
      company: fullCompany,
      confidence: topMatch.similarity,
      matchedVariant: topMatch.matchedOn,
      suggestedMatches: sortedMatches.slice(1).map(m => ({
        company: m.company as unknown as Company,
        similarity: m.similarity,
        matchedOn: m.matchedOn,
      })),
    };
  }

  // 4. 無匹配 - 返回建議
  return {
    matchType: 'NEW',
    company: null,
    confidence: 0,
    suggestedMatches: sortedMatches.map(m => ({
      company: m.company as unknown as Company,
      similarity: m.similarity,
      matchedOn: m.matchedOn,
    })),
  };
}

/**
 * 查找名稱變體匹配
 */
async function findVariantMatch(
  vendorName: string
): Promise<{ company: Company; variant: string } | null> {
  const normalizedInput = normalizeCompanyName(vendorName);

  // PostgreSQL 陣列包含查詢
  const companies = await prisma.company.findMany({
    where: {
      status: { not: 'MERGED' },
      nameVariants: { has: vendorName },
    },
  });

  if (companies.length > 0) {
    return { company: companies[0], variant: vendorName };
  }

  // 標準化後比對
  const allCompanies = await prisma.company.findMany({
    where: { status: { not: 'MERGED' } },
  });

  for (const company of allCompanies) {
    for (const variant of company.nameVariants) {
      if (normalizeCompanyName(variant) === normalizedInput) {
        return { company, variant };
      }
    }
  }

  return null;
}
```

---

### Phase 2: Just-in-Time 建立服務 (30 min)

#### Step 2.1: 創建 JIT 服務

Create `src/services/company-jit.service.ts`:

```typescript
/**
 * @fileoverview Just-in-Time 公司 Profile 建立服務
 * @description
 *   - 自動建立公司記錄
 *   - 公司類型推測
 *   - 名稱變體管理
 *
 * @module src/services/company-jit
 * @since Epic 0 - Story 0.3
 */

import { prisma } from '@/lib/prisma';
import { Company, CompanyType, CompanyStatus } from '@prisma/client';
import { matchCompany } from './company-match.service';
import { classifyCompanyType } from './company-classifier.service';
import { normalizeCompanyName } from '@/lib/utils/company-name';

// ============================================
// JIT Configuration
// ============================================

const JIT_CONFIG = {
  AUTO_CREATE_THRESHOLD: 0.6,  // 低於此相似度自動建立
  SYSTEM_USER_ID: 'SYSTEM',    // 系統用戶 ID
} as const;

// ============================================
// Main JIT Function
// ============================================

/**
 * 獲取或建立公司
 * 如果公司不存在，自動建立待審核的公司記錄
 */
export async function getOrCreateCompany(params: {
  vendorName: string;
  documentId?: string;
  context?: {
    invoiceContent?: string;  // 用於類型推測
    existingCompanyHint?: string;
  };
}): Promise<{
  company: Company;
  isNew: boolean;
  matchResult: 'EXACT' | 'FUZZY' | 'NEW';
  confidence: number;
}> {
  const { vendorName, documentId, context } = params;

  // 1. 嘗試匹配現有公司
  const matchResult = await matchCompany(vendorName);

  // 2. 精確匹配 - 直接返回
  if (matchResult.matchType === 'EXACT' && matchResult.company) {
    return {
      company: matchResult.company,
      isNew: false,
      matchResult: 'EXACT',
      confidence: matchResult.confidence,
    };
  }

  // 3. 高信心度模糊匹配 - 添加名稱變體並返回
  if (
    matchResult.matchType === 'FUZZY' &&
    matchResult.company &&
    matchResult.confidence >= 0.9
  ) {
    // 添加新的名稱變體
    await addNameVariant(matchResult.company.id, vendorName);

    return {
      company: matchResult.company,
      isNew: false,
      matchResult: 'FUZZY',
      confidence: matchResult.confidence,
    };
  }

  // 4. 無匹配或低信心度 - 建立新公司
  const newCompany = await createAutoCompany({
    name: vendorName,
    documentId,
    context,
  });

  return {
    company: newCompany,
    isNew: true,
    matchResult: 'NEW',
    confidence: 0,
  };
}

/**
 * 自動建立公司
 */
async function createAutoCompany(params: {
  name: string;
  documentId?: string;
  context?: {
    invoiceContent?: string;
  };
}): Promise<Company> {
  const { name, documentId, context } = params;

  // 推測公司類型
  let companyType: CompanyType = 'UNKNOWN';
  if (context?.invoiceContent) {
    const classification = await classifyCompanyType(name, context.invoiceContent);
    companyType = classification.type;
  }

  // 生成顯示名稱
  const displayName = formatDisplayName(name);

  // 建立公司
  const company = await prisma.company.create({
    data: {
      name,
      displayName,
      type: companyType,
      status: 'PENDING',
      source: 'AUTO_CREATED',
      nameVariants: [name],  // 初始變體就是原始名稱
      firstSeenDocumentId: documentId,
      createdBy: JIT_CONFIG.SYSTEM_USER_ID,
    },
  });

  return company;
}

/**
 * 添加名稱變體
 */
export async function addNameVariant(
  companyId: string,
  variant: string
): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) return;

  // 檢查是否已存在
  const normalizedVariant = normalizeCompanyName(variant);
  const existingNormalized = company.nameVariants.map(normalizeCompanyName);

  if (!existingNormalized.includes(normalizedVariant)) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        nameVariants: { push: variant },
      },
    });
  }
}

/**
 * 格式化顯示名稱
 */
function formatDisplayName(name: string): string {
  // 首字母大寫
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
```

---

### Phase 3: 公司類型分類服務 (30 min)

#### Step 3.1: 創建分類服務

Create `src/services/company-classifier.service.ts`:

```typescript
/**
 * @fileoverview 公司類型分類服務
 * @description
 *   - 使用 LLM 推測公司類型
 *   - 基於發票內容分析
 *
 * @module src/services/company-classifier
 * @since Epic 0 - Story 0.3
 */

import OpenAI from 'openai';
import { CompanyType } from '@prisma/client';
import { CompanyTypeClassification } from '@/types/company-match';

// ============================================
// Client Initialization
// ============================================

const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: process.env.AZURE_OPENAI_ENDPOINT,
});

// ============================================
// Classification Prompt
// ============================================

const CLASSIFICATION_PROMPT = `你是一個物流行業專家。根據公司名稱和發票內容，判斷這家公司的類型。

公司類型選項：
- FORWARDER: 貨運代理商（提供運輸協調、報關、倉儲等服務）
- EXPORTER: 出口商（發貨方，貨物的賣家）
- CARRIER: 承運人（船公司、航空公司、卡車公司）
- CUSTOMS_BROKER: 報關行（專門處理海關事務）
- OTHER: 其他類型公司
- UNKNOWN: 無法判斷

判斷依據：
1. 公司名稱中的關鍵詞（Logistics, Shipping, Forwarding, Export, Import 等）
2. 發票中的費用類型（如果有 Ocean Freight 通常是 Forwarder）
3. 公司在發票中的角色

請以 JSON 格式返回：
{
  "type": "FORWARDER|EXPORTER|CARRIER|CUSTOMS_BROKER|OTHER|UNKNOWN",
  "confidence": 0.0-1.0,
  "reasoning": "判斷理由"
}`;

// ============================================
// Main Classification Function
// ============================================

/**
 * 分類公司類型
 */
export async function classifyCompanyType(
  companyName: string,
  invoiceContent?: string
): Promise<CompanyTypeClassification> {
  try {
    const prompt = `
${CLASSIFICATION_PROMPT}

公司名稱: ${companyName}
${invoiceContent ? `發票內容摘要: ${invoiceContent.substring(0, 1000)}` : '（無發票內容）'}
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',  // 使用較便宜的模型
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content);

    return {
      type: (result.type as CompanyType) || 'UNKNOWN',
      confidence: result.confidence || 0.5,
      reasoning: result.reasoning || '',
    };
  } catch (error) {
    console.error('Company classification error:', error);

    // 回退到基於名稱的簡單分類
    return classifyByNameOnly(companyName);
  }
}

/**
 * 僅基於名稱的簡單分類
 */
function classifyByNameOnly(name: string): CompanyTypeClassification {
  const lowerName = name.toLowerCase();

  if (
    lowerName.includes('logistics') ||
    lowerName.includes('forwarding') ||
    lowerName.includes('freight')
  ) {
    return {
      type: 'FORWARDER',
      confidence: 0.7,
      reasoning: 'Name contains logistics/forwarding keywords',
    };
  }

  if (
    lowerName.includes('shipping') ||
    lowerName.includes('line') ||
    lowerName.includes('carrier')
  ) {
    return {
      type: 'CARRIER',
      confidence: 0.6,
      reasoning: 'Name contains carrier keywords',
    };
  }

  if (
    lowerName.includes('customs') ||
    lowerName.includes('broker')
  ) {
    return {
      type: 'CUSTOMS_BROKER',
      confidence: 0.7,
      reasoning: 'Name contains customs broker keywords',
    };
  }

  if (
    lowerName.includes('export') ||
    lowerName.includes('import') ||
    lowerName.includes('trading')
  ) {
    return {
      type: 'EXPORTER',
      confidence: 0.5,
      reasoning: 'Name contains trade keywords',
    };
  }

  return {
    type: 'UNKNOWN',
    confidence: 0.3,
    reasoning: 'Unable to determine from name',
  };
}
```

---

### Phase 4: 公司合併服務 (45 min)

#### Step 4.1: 創建合併服務

Create `src/services/company-merge.service.ts`:

```typescript
/**
 * @fileoverview 公司合併服務
 * @description
 *   - 合併重複公司
 *   - 更新關聯記錄
 *   - 保留歷史追蹤
 *
 * @module src/services/company-merge
 * @since Epic 0 - Story 0.3
 */

import { prisma } from '@/lib/prisma';
import { Company } from '@prisma/client';

// ============================================
// Merge Types
// ============================================

export interface MergeRequest {
  sourceCompanyIds: string[];  // 要合併的公司
  targetCompanyId: string;     // 合併目標
  mergedBy: string;            // 執行者
}

export interface MergeResult {
  targetCompany: Company;
  mergedCount: number;
  updatedDocuments: number;
  updatedRules: number;
}

// ============================================
// Main Merge Function
// ============================================

/**
 * 合併公司
 */
export async function mergeCompanies(request: MergeRequest): Promise<MergeResult> {
  const { sourceCompanyIds, targetCompanyId, mergedBy } = request;

  // 驗證
  if (sourceCompanyIds.includes(targetCompanyId)) {
    throw new Error('Target company cannot be in source companies');
  }

  // 獲取所有相關公司
  const [targetCompany, sourceCompanies] = await Promise.all([
    prisma.company.findUnique({ where: { id: targetCompanyId } }),
    prisma.company.findMany({ where: { id: { in: sourceCompanyIds } } }),
  ]);

  if (!targetCompany) {
    throw new Error('Target company not found');
  }

  if (sourceCompanies.length !== sourceCompanyIds.length) {
    throw new Error('Some source companies not found');
  }

  // 開始事務
  return await prisma.$transaction(async (tx) => {
    // 1. 收集所有名稱變體
    const allVariants = new Set<string>([
      targetCompany.name,
      ...targetCompany.nameVariants,
    ]);

    for (const source of sourceCompanies) {
      allVariants.add(source.name);
      source.nameVariants.forEach(v => allVariants.add(v));
    }

    // 2. 更新關聯的文件
    const docUpdateResult = await tx.document.updateMany({
      where: { companyId: { in: sourceCompanyIds } },
      data: { companyId: targetCompanyId },
    });

    // 3. 更新關聯的歷史文件
    await tx.historicalFile.updateMany({
      where: { companyId: { in: sourceCompanyIds } },
      data: { companyId: targetCompanyId },
    });

    // 4. 更新關聯的映射規則
    const ruleUpdateResult = await tx.mappingRule.updateMany({
      where: { companyId: { in: sourceCompanyIds } },
      data: { companyId: targetCompanyId },
    });

    // 5. 更新關聯的規則建議
    await tx.ruleSuggestion.updateMany({
      where: { companyId: { in: sourceCompanyIds } },
      data: { companyId: targetCompanyId },
    });

    // 6. 標記源公司為已合併
    await tx.company.updateMany({
      where: { id: { in: sourceCompanyIds } },
      data: {
        status: 'MERGED',
        mergedIntoId: targetCompanyId,
      },
    });

    // 7. 更新目標公司的名稱變體
    const updatedTarget = await tx.company.update({
      where: { id: targetCompanyId },
      data: {
        nameVariants: Array.from(allVariants),
        updatedAt: new Date(),
      },
    });

    return {
      targetCompany: updatedTarget,
      mergedCount: sourceCompanies.length,
      updatedDocuments: docUpdateResult.count,
      updatedRules: ruleUpdateResult.count,
    };
  });
}

/**
 * 獲取潛在重複公司
 */
export async function findPotentialDuplicates(): Promise<Array<{
  companies: Company[];
  similarity: number;
  reason: string;
}>> {
  const pendingCompanies = await prisma.company.findMany({
    where: { status: 'PENDING' },
  });

  const activeCompanies = await prisma.company.findMany({
    where: { status: 'ACTIVE' },
  });

  const duplicates: Array<{
    companies: Company[];
    similarity: number;
    reason: string;
  }> = [];

  // 簡單的重複檢測（實際應用中可能需要更複雜的算法）
  for (const pending of pendingCompanies) {
    for (const active of activeCompanies) {
      const similarity = calculateNameSimilarity(pending.name, active.name);
      if (similarity >= 0.7) {
        duplicates.push({
          companies: [pending, active],
          similarity,
          reason: `Name similarity: ${(similarity * 100).toFixed(0)}%`,
        });
      }
    }
  }

  return duplicates.sort((a, b) => b.similarity - a.similarity);
}

function calculateNameSimilarity(name1: string, name2: string): number {
  // 使用 company-name.ts 中的 calculateSimilarity
  const { calculateSimilarity } = require('@/lib/utils/company-name');
  return calculateSimilarity(name1, name2);
}
```

---

### Phase 5: API 路由 (30 min)

#### Step 5.1: 公司匹配 API

Create `src/app/api/companies/match/route.ts`:

```typescript
/**
 * @fileoverview 公司匹配 API
 * @module src/app/api/companies/match
 * @since Epic 0 - Story 0.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { matchCompany } from '@/services/company-match.service';

const MatchRequestSchema = z.object({
  vendorName: z.string().min(1),
});

/**
 * POST /api/companies/match
 * 匹配公司名稱
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { vendorName } = MatchRequestSchema.parse(body);

    const result = await matchCompany(vendorName);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Match company error:', error);
    return NextResponse.json(
      { error: 'Match failed' },
      { status: 500 }
    );
  }
}
```

#### Step 5.2: 公司合併 API

Create `src/app/api/companies/merge/route.ts`:

```typescript
/**
 * @fileoverview 公司合併 API
 * @module src/app/api/companies/merge
 * @since Epic 0 - Story 0.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { mergeCompanies } from '@/services/company-merge.service';

const MergeRequestSchema = z.object({
  sourceCompanyIds: z.array(z.string().uuid()).min(1),
  targetCompanyId: z.string().uuid(),
});

/**
 * POST /api/companies/merge
 * 合併公司
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 權限檢查（需要管理員權限）
    // TODO: 實現權限檢查

    const body = await request.json();
    const data = MergeRequestSchema.parse(body);

    const result = await mergeCompanies({
      ...data,
      mergedBy: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Merge companies error:', error);
    return NextResponse.json(
      { error: 'Merge failed' },
      { status: 500 }
    );
  }
}
```

---

## Verification Checklist

### 公司匹配

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 精確匹配 | 搜尋已存在的公司名稱 | 返回 EXACT | [ ] |
| 變體匹配 | 搜尋公司的名稱變體 | 返回 EXACT | [ ] |
| 模糊匹配 | 搜尋相似名稱 | 返回 FUZZY + 建議 | [ ] |
| 無匹配 | 搜尋全新名稱 | 返回 NEW + 建議 | [ ] |

### JIT 建立

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 自動建立 | 處理未知公司的文件 | 建立 PENDING 公司 | [ ] |
| 類型推測 | 包含發票內容 | 正確分類類型 | [ ] |
| 變體記錄 | 模糊匹配後 | 添加新變體 | [ ] |

### 公司合併

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| 基本合併 | 合併兩家公司 | 更新所有關聯 | [ ] |
| 多公司合併 | 合併三家以上 | 正確處理 | [ ] |
| 變體合併 | 合併後 | 包含所有變體 | [ ] |

---

## File List (Expected Output)

| File Path | Description |
|-----------|-------------|
| `src/lib/utils/company-name.ts` | 名稱標準化工具 |
| `src/types/company-match.ts` | 匹配結果類型 |
| `src/services/company-match.service.ts` | 公司匹配服務 |
| `src/services/company-jit.service.ts` | JIT 建立服務 |
| `src/services/company-classifier.service.ts` | 類型分類服務 |
| `src/services/company-merge.service.ts` | 公司合併服務 |
| `src/app/api/companies/match/route.ts` | 匹配 API |
| `src/app/api/companies/merge/route.ts` | 合併 API |

---

## Next Steps

完成 Story 0-3 後：
1. 進入 **Story 0-4**（批量處理進度追蹤）
2. 實現 SSE 即時進度更新
3. 完成 **Story 0-5**（術語聚合）

---

*Generated by BMAD Method - Create Tech Spec Workflow*
