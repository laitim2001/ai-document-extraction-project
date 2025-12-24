# Tech Spec: Story 0.5 - 術語聚合與初始規則建立

| 屬性 | 值 |
|------|------|
| Story ID | 0.5 |
| Story Key | 0-5-term-aggregation-initial-rules |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.2 (智能路由), Story 0.3 (公司 Profile), Story 4.1 (規則模型) |
| 預估工時 | 4-5 天 |
| 優先級 | P0 (必要) |

---

## 目標

從歷史數據處理結果中聚合常見術語，利用 GPT-5.2 進行智能分類，並批量建立 Tier 1 Universal Mapping 和 Tier 2 Company-Specific 映射規則，為系統提供初始的費用分類知識庫。

---

## 驗收標準對應

| AC# | 驗收標準 | 實現方式 |
|-----|---------|---------|
| AC1 | 術語聚合分析 | `term-aggregation.service.ts` + `TermAnalysisPage` |
| AC2 | AI 分類建議 | `term-classification.service.ts` + GPT-5.2 |
| AC3 | Universal Mapping 建立 | `bulk-rule.service.ts` + Tier 1 規則 API |
| AC4 | Company-Specific 規則建立 | `bulk-rule.service.ts` + Tier 2 規則 API |
| AC5 | 規則批量操作 | `BulkRuleActions.tsx` + 撤銷機制 |

---

## 數據模型

### Prisma Schema

```prisma
// prisma/schema.prisma

// === 標準費用類別 ===
enum ChargeCategory {
  OCEAN_FREIGHT       // 海運費
  AIR_FREIGHT         // 空運費
  HANDLING_FEE        // 操作費
  CUSTOMS_CLEARANCE   // 清關費
  DOCUMENTATION_FEE   // 文件費
  TERMINAL_HANDLING   // 碼頭操作費
  INLAND_TRANSPORT    // 內陸運輸
  INSURANCE           // 保險費
  STORAGE             // 倉儲費
  FUEL_SURCHARGE      // 燃油附加費
  SECURITY_FEE        // 安全費
  OTHER               // 其他
}

// === 映射規則範圍 ===
enum MappingRuleScope {
  UNIVERSAL  // Tier 1: 全局適用
  COMPANY    // Tier 2: 公司特定
}

// === 映射規則 ===
model MappingRule {
  id              String            @id @default(uuid())

  // === 映射內容 ===
  sourceTerm      String            @map("source_term")
  normalizedTerm  String            @map("normalized_term")
  targetCategory  ChargeCategory    @map("target_category")

  // === 範圍設定 ===
  scope           MappingRuleScope  @default(UNIVERSAL)
  companyId       String?           @map("company_id")
  company         Company?          @relation(fields: [companyId], references: [id])

  // === 信心度與覆蓋 ===
  confidence      Float             @default(0.8)
  isOverride      Boolean           @default(false) @map("is_override")

  // === 來源追蹤 ===
  source          RuleSource        @default(MANUAL)
  bulkOperationId String?           @map("bulk_operation_id")
  bulkOperation   BulkOperation?    @relation(fields: [bulkOperationId], references: [id])

  // === 狀態與統計 ===
  isActive        Boolean           @default(true) @map("is_active")
  usageCount      Int               @default(0) @map("usage_count")
  lastUsedAt      DateTime?         @map("last_used_at")

  // === 元數據 ===
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")
  createdBy       String            @map("created_by")

  // === 索引 ===
  @@unique([normalizedTerm, scope, companyId])
  @@index([scope])
  @@index([targetCategory])
  @@index([companyId])
  @@index([normalizedTerm])
  @@map("mapping_rules")
}

enum RuleSource {
  MANUAL          // 手動建立
  AI_SUGGESTED    // AI 建議
  BULK_IMPORT     // 批量導入
  LEARNING        // 系統學習
}

// === 批量操作記錄 ===
model BulkOperation {
  id              String   @id @default(uuid())
  operationType   String   @map("operation_type") // CREATE, UPDATE, DELETE
  operationName   String   @map("operation_name") // 操作描述
  affectedCount   Int      @map("affected_count")
  affectedRules   Json     @map("affected_rules") // 規則快照，用於撤銷

  // === 撤銷狀態 ===
  isUndone        Boolean  @default(false) @map("is_undone")
  undoneAt        DateTime? @map("undone_at")
  undoneBy        String?  @map("undone_by")

  // === 元數據 ===
  createdAt       DateTime @default(now()) @map("created_at")
  createdBy       String   @map("created_by")

  // === 關聯 ===
  creator         User     @relation(fields: [createdBy], references: [id])
  rules           MappingRule[]

  @@index([createdAt])
  @@index([operationType])
  @@map("bulk_operations")
}

// === 提取的術語（來自處理結果）===
model ExtractedTerm {
  id              String   @id @default(uuid())
  batchId         String   @map("batch_id")
  fileId          String   @map("file_id")

  // === 術語內容 ===
  originalTerm    String   @map("original_term")
  normalizedTerm  String   @map("normalized_term")

  // === 上下文信息 ===
  companyId       String?  @map("company_id")
  amount          Float?
  currency        String?

  // === AI 分類結果 ===
  suggestedCategory ChargeCategory? @map("suggested_category")
  classificationConfidence Float?   @map("classification_confidence")
  classificationReason String?      @map("classification_reason")

  // === 是否已建立規則 ===
  ruleCreated     Boolean  @default(false) @map("rule_created")
  ruleId          String?  @map("rule_id")

  // === 元數據 ===
  createdAt       DateTime @default(now()) @map("created_at")

  // === 關聯 ===
  batch           HistoricalBatch @relation(fields: [batchId], references: [id])
  company         Company?        @relation(fields: [companyId], references: [id])

  @@index([batchId])
  @@index([normalizedTerm])
  @@index([companyId])
  @@map("extracted_terms")
}
```

---

## 類型定義

### 術語聚合類型

```typescript
// src/types/term-aggregation.ts

/**
 * @fileoverview 術語聚合相關類型定義
 * @module src/types/term-aggregation
 * @since Epic 0 - Story 0.5
 */

import { ChargeCategory, MappingRuleScope } from '@prisma/client';

/**
 * 聚合後的術語
 */
export interface AggregatedTerm {
  /** 正規化術語 */
  term: string;
  /** 原始術語變體 */
  variants: string[];
  /** 出現頻率 */
  frequency: number;
  /** 公司分佈 */
  companyDistribution: CompanyTermCount[];
  /** 相似術語群組 */
  similarTerms: string[];
  /** 是否為公司特定（只出現在一家公司） */
  isCompanySpecific: boolean;
  /** AI 分類建議 */
  classification?: TermClassification;
  /** 是否已建立規則 */
  hasRule: boolean;
  /** 現有規則 ID（如果有） */
  existingRuleId?: string;
}

/**
 * 術語在公司中的出現次數
 */
export interface CompanyTermCount {
  companyId: string;
  companyName: string;
  count: number;
  percentage: number;
}

/**
 * AI 術語分類結果
 */
export interface TermClassification {
  term: string;
  category: ChargeCategory;
  confidence: number;
  reason: string;
}

/**
 * 術語聚合統計
 */
export interface TermAggregationStats {
  totalTerms: number;
  uniqueTerms: number;
  classifiedTerms: number;
  rulesCreated: number;
  companiesWithTerms: number;
}

/**
 * 術語分析請求
 */
export interface TermAnalysisRequest {
  batchId: string;
  minFrequency?: number;
  companyId?: string;
  includeClassified?: boolean;
}

/**
 * 術語分析結果
 */
export interface TermAnalysisResult {
  terms: AggregatedTerm[];
  stats: TermAggregationStats;
  clusters: TermCluster[];
}

/**
 * 術語聚類
 */
export interface TermCluster {
  clusterId: string;
  representativeTerm: string;
  terms: string[];
  suggestedCategory?: ChargeCategory;
}
```

### 規則管理類型

```typescript
// src/types/mapping-rule.ts

/**
 * @fileoverview 映射規則相關類型定義
 * @module src/types/mapping-rule
 * @since Epic 0 - Story 0.5
 */

import { ChargeCategory, MappingRuleScope, RuleSource } from '@prisma/client';

/**
 * 建立映射規則請求
 */
export interface CreateMappingRuleRequest {
  /** 原始術語 */
  sourceTerm: string;
  /** 目標費用類別 */
  targetCategory: ChargeCategory;
  /** 規則範圍 */
  scope: MappingRuleScope;
  /** 公司 ID（如果是 COMPANY scope） */
  companyId?: string;
  /** 信心度 (0-1) */
  confidence: number;
  /** 是否覆蓋 Universal 規則 */
  isOverride?: boolean;
  /** 規則來源 */
  source?: RuleSource;
}

/**
 * 批量建立規則請求
 */
export interface BulkCreateRulesRequest {
  rules: CreateMappingRuleRequest[];
  operationName: string;
}

/**
 * 批量建立規則結果
 */
export interface BulkCreateRulesResult {
  operationId: string;
  createdCount: number;
  skippedCount: number;
  errors: {
    term: string;
    reason: string;
  }[];
}

/**
 * 批量更新規則請求
 */
export interface BulkUpdateRulesRequest {
  ruleIds: string[];
  updates: Partial<{
    targetCategory: ChargeCategory;
    confidence: number;
    isActive: boolean;
  }>;
  operationName: string;
}

/**
 * 批量刪除規則請求
 */
export interface BulkDeleteRulesRequest {
  ruleIds: string[];
  operationName: string;
}

/**
 * 撤銷操作請求
 */
export interface UndoOperationRequest {
  operationId: string;
}

/**
 * 撤銷操作結果
 */
export interface UndoOperationResult {
  success: boolean;
  restoredCount: number;
  message: string;
}

/**
 * 規則導出格式
 */
export interface RuleExportData {
  sourceTerm: string;
  targetCategory: string;
  scope: string;
  companyName?: string;
  confidence: number;
  isOverride: boolean;
  createdAt: string;
}
```

---

## 實現指南

### Phase 1: 術語聚合服務

#### 1.1 術語提取與聚合

```typescript
// src/services/term-aggregation.service.ts

/**
 * @fileoverview 術語聚合服務
 * @module src/services/term-aggregation
 * @since Epic 0 - Story 0.5
 */

import { prisma } from '@/lib/prisma';
import type {
  AggregatedTerm,
  TermAnalysisRequest,
  TermAnalysisResult,
  TermAggregationStats,
  TermCluster,
  CompanyTermCount,
} from '@/types/term-aggregation';
import { normalizeTermForAggregation, calculateTermSimilarity } from '@/lib/utils/term-utils';

/**
 * 執行術語聚合分析
 */
export async function analyzeTerms(
  request: TermAnalysisRequest
): Promise<TermAnalysisResult> {
  const { batchId, minFrequency = 1, companyId, includeClassified = true } = request;

  // 1. 獲取提取的術語
  const extractedTerms = await prisma.extractedTerm.findMany({
    where: {
      batchId,
      ...(companyId && { companyId }),
      ...(includeClassified === false && { suggestedCategory: null }),
    },
    include: {
      company: { select: { id: true, name: true } },
    },
  });

  // 2. 聚合術語
  const termMap = new Map<string, {
    originalTerms: Set<string>;
    count: number;
    companies: Map<string, { name: string; count: number }>;
    classification?: { category: any; confidence: number; reason: string };
    ruleId?: string;
  }>();

  for (const term of extractedTerms) {
    const normalized = term.normalizedTerm;

    if (!termMap.has(normalized)) {
      termMap.set(normalized, {
        originalTerms: new Set(),
        count: 0,
        companies: new Map(),
        classification: term.suggestedCategory ? {
          category: term.suggestedCategory,
          confidence: term.classificationConfidence ?? 0,
          reason: term.classificationReason ?? '',
        } : undefined,
        ruleId: term.ruleId ?? undefined,
      });
    }

    const data = termMap.get(normalized)!;
    data.originalTerms.add(term.originalTerm);
    data.count++;

    if (term.company) {
      if (!data.companies.has(term.company.id)) {
        data.companies.set(term.company.id, { name: term.company.name, count: 0 });
      }
      data.companies.get(term.company.id)!.count++;
    }
  }

  // 3. 轉換為結果格式並過濾
  const aggregatedTerms: AggregatedTerm[] = [];
  let classifiedCount = 0;
  let rulesCreatedCount = 0;
  const companiesSet = new Set<string>();

  for (const [term, data] of termMap.entries()) {
    if (data.count < minFrequency) continue;

    const totalCount = data.count;
    const companyDistribution: CompanyTermCount[] = Array.from(data.companies.entries())
      .map(([companyId, info]) => ({
        companyId,
        companyName: info.name,
        count: info.count,
        percentage: Math.round((info.count / totalCount) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    companyDistribution.forEach(c => companiesSet.add(c.companyId));

    const isCompanySpecific = data.companies.size === 1;

    if (data.classification) classifiedCount++;
    if (data.ruleId) rulesCreatedCount++;

    aggregatedTerms.push({
      term,
      variants: Array.from(data.originalTerms),
      frequency: data.count,
      companyDistribution,
      similarTerms: [],
      isCompanySpecific,
      classification: data.classification ? {
        term,
        category: data.classification.category,
        confidence: data.classification.confidence,
        reason: data.classification.reason,
      } : undefined,
      hasRule: !!data.ruleId,
      existingRuleId: data.ruleId,
    });
  }

  // 4. 執行相似術語聚類
  const clusters = clusterSimilarTerms(aggregatedTerms);

  // 5. 更新聚合術語的 similarTerms
  for (const cluster of clusters) {
    for (const clusterTerm of cluster.terms) {
      const aggregated = aggregatedTerms.find(t => t.term === clusterTerm);
      if (aggregated) {
        aggregated.similarTerms = cluster.terms.filter(t => t !== clusterTerm);
      }
    }
  }

  // 6. 按頻率排序
  aggregatedTerms.sort((a, b) => b.frequency - a.frequency);

  // 7. 統計
  const stats: TermAggregationStats = {
    totalTerms: extractedTerms.length,
    uniqueTerms: aggregatedTerms.length,
    classifiedTerms: classifiedCount,
    rulesCreated: rulesCreatedCount,
    companiesWithTerms: companiesSet.size,
  };

  return { terms: aggregatedTerms, stats, clusters };
}

/**
 * 相似術語聚類
 */
function clusterSimilarTerms(terms: AggregatedTerm[]): TermCluster[] {
  const SIMILARITY_THRESHOLD = 0.8;
  const clusters: TermCluster[] = [];
  const assignedTerms = new Set<string>();

  for (const term of terms) {
    if (assignedTerms.has(term.term)) continue;

    const cluster: TermCluster = {
      clusterId: `cluster-${clusters.length + 1}`,
      representativeTerm: term.term,
      terms: [term.term],
      suggestedCategory: term.classification?.category,
    };

    // 找相似術語
    for (const other of terms) {
      if (other.term === term.term || assignedTerms.has(other.term)) continue;

      const similarity = calculateTermSimilarity(term.term, other.term);
      if (similarity >= SIMILARITY_THRESHOLD) {
        cluster.terms.push(other.term);
        assignedTerms.add(other.term);
      }
    }

    if (cluster.terms.length > 1) {
      // 選擇頻率最高的作為代表
      const representative = cluster.terms.reduce((max, t) => {
        const termData = terms.find(x => x.term === t);
        const maxData = terms.find(x => x.term === max);
        return (termData?.frequency ?? 0) > (maxData?.frequency ?? 0) ? t : max;
      });
      cluster.representativeTerm = representative;
      clusters.push(cluster);
    }

    assignedTerms.add(term.term);
  }

  return clusters;
}

/**
 * 從批次處理結果提取術語到數據庫
 */
export async function extractTermsFromBatch(batchId: string): Promise<number> {
  // 獲取已完成處理的文件
  const files = await prisma.historicalFile.findMany({
    where: {
      batchId,
      status: 'COMPLETED',
    },
    include: {
      batch: true,
    },
  });

  let extractedCount = 0;

  for (const file of files) {
    // 假設 extractionResult 存儲在某處（可能是 Document 關聯）
    // 這裡需要根據實際數據結構調整
    const extractionResult = await getExtractionResult(file.id);

    if (!extractionResult?.lineItems) continue;

    for (const item of extractionResult.lineItems) {
      const originalTerm = item.description;
      const normalizedTerm = normalizeTermForAggregation(originalTerm);

      // 檢查是否已存在
      const existing = await prisma.extractedTerm.findFirst({
        where: {
          batchId,
          fileId: file.id,
          normalizedTerm,
        },
      });

      if (!existing) {
        await prisma.extractedTerm.create({
          data: {
            batchId,
            fileId: file.id,
            originalTerm,
            normalizedTerm,
            companyId: extractionResult.vendor?.companyId,
            amount: item.amount,
            currency: extractionResult.documentInfo?.currency,
          },
        });
        extractedCount++;
      }
    }
  }

  // 更新批次統計
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: { extractedTermsCount: extractedCount },
  });

  return extractedCount;
}

async function getExtractionResult(fileId: string): Promise<any> {
  // 實際實現需根據數據存儲結構
  // 可能從 Document 表或文件存儲獲取
  return null;
}
```

#### 1.2 術語處理工具

```typescript
// src/lib/utils/term-utils.ts

/**
 * @fileoverview 術語處理工具函數
 * @module src/lib/utils/term-utils
 * @since Epic 0 - Story 0.5
 */

/**
 * 正規化術語用於聚合
 * - 轉小寫
 * - 移除多餘空格
 * - 移除特殊字符（保留字母、數字、空格）
 * - 移除常見後綴（FEE, CHARGE, COST 等）
 */
export function normalizeTermForAggregation(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(fee|charge|cost|surcharge|handling)\b$/gi, '')
    .trim();
}

/**
 * 計算兩個術語的相似度（基於 Levenshtein 距離）
 */
export function calculateTermSimilarity(term1: string, term2: string): number {
  const s1 = normalizeTermForAggregation(term1);
  const s2 = normalizeTermForAggregation(term2);

  if (s1 === s2) return 1;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return maxLength > 0 ? 1 - distance / maxLength : 0;
}

/**
 * Levenshtein 距離計算
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

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
 * 檢查術語是否可能是費用相關
 */
export function isChargeRelatedTerm(term: string): boolean {
  const chargeKeywords = [
    'freight', 'handling', 'clearance', 'documentation', 'terminal',
    'storage', 'insurance', 'surcharge', 'fee', 'charge', 'cost',
    'transport', 'delivery', 'pickup', 'customs', 'duty', 'tax',
  ];

  const normalized = term.toLowerCase();
  return chargeKeywords.some(keyword => normalized.includes(keyword));
}
```

### Phase 2: AI 分類服務

#### 2.1 GPT-5.2 術語分類

```typescript
// src/services/term-classification.service.ts

/**
 * @fileoverview 術語 AI 分類服務
 * @module src/services/term-classification
 * @since Epic 0 - Story 0.5
 */

import { openai } from '@/lib/openai';
import { prisma } from '@/lib/prisma';
import { ChargeCategory } from '@prisma/client';
import type { TermClassification } from '@/types/term-aggregation';

/**
 * 分類 Prompt 模板
 */
const CLASSIFICATION_PROMPT = `你是一個物流費用分類專家。請將以下發票費用術語分類到標準費用類別。

## 標準費用類別

| 代碼 | 中文名稱 | 說明 |
|------|---------|------|
| OCEAN_FREIGHT | 海運費 | 海上運輸主費用 |
| AIR_FREIGHT | 空運費 | 空中運輸主費用 |
| HANDLING_FEE | 操作費 | 一般性操作、裝卸費用 |
| CUSTOMS_CLEARANCE | 清關費 | 進出口清關相關費用 |
| DOCUMENTATION_FEE | 文件費 | 提單、報關單等文件費用 |
| TERMINAL_HANDLING | 碼頭操作費 | THC、碼頭裝卸費 |
| INLAND_TRANSPORT | 內陸運輸 | 陸運、拖車費 |
| INSURANCE | 保險費 | 貨物保險 |
| STORAGE | 倉儲費 | 倉庫存放費用 |
| FUEL_SURCHARGE | 燃油附加費 | 燃油附加費、BAF |
| SECURITY_FEE | 安全費 | 安檢、AMS 等安全相關 |
| OTHER | 其他 | 無法分類的其他費用 |

## 分類規則

1. 優先考慮術語的核心含義
2. 如有多個可能類別，選擇最具體的
3. 不確定時使用 OTHER，但需說明原因
4. 信心度基於術語的明確程度：
   - 90-100%: 術語含義明確
   - 70-89%: 術語大致清楚
   - 50-69%: 術語模糊，但可推測
   - <50%: 高度不確定

## 待分類術語

{terms}

## 輸出格式

請以 JSON 陣列格式返回，每個元素包含：
{
  "term": "原始術語",
  "category": "類別代碼",
  "confidence": 信心度數值(0-100),
  "reason": "分類理由（20字以內）"
}`;

/**
 * 批量分類術語
 */
export async function classifyTerms(
  terms: string[]
): Promise<TermClassification[]> {
  const BATCH_SIZE = 30; // 每批處理的術語數量
  const results: TermClassification[] = [];

  for (let i = 0; i < terms.length; i += BATCH_SIZE) {
    const batch = terms.slice(i, i + BATCH_SIZE);
    const batchResults = await classifyTermBatch(batch);
    results.push(...batchResults);

    // 避免 rate limit
    if (i + BATCH_SIZE < terms.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * 分類單批術語
 */
async function classifyTermBatch(terms: string[]): Promise<TermClassification[]> {
  const prompt = CLASSIFICATION_PROMPT.replace(
    '{terms}',
    terms.map((t, i) => `${i + 1}. ${t}`).join('\n')
  );

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3, // 較低溫度以提高一致性
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(content);
    const classifications = Array.isArray(parsed) ? parsed : parsed.classifications ?? [];

    return classifications.map((item: any) => ({
      term: item.term,
      category: validateCategory(item.category),
      confidence: Math.min(100, Math.max(0, item.confidence)) / 100, // 轉為 0-1
      reason: item.reason ?? '',
    }));
  } catch (error) {
    console.error('Error classifying terms:', error);
    // 返回 OTHER 作為 fallback
    return terms.map(term => ({
      term,
      category: ChargeCategory.OTHER,
      confidence: 0,
      reason: '分類失敗',
    }));
  }
}

/**
 * 驗證並轉換類別代碼
 */
function validateCategory(category: string): ChargeCategory {
  const validCategories = Object.values(ChargeCategory);
  const normalized = category?.toUpperCase();

  if (validCategories.includes(normalized as ChargeCategory)) {
    return normalized as ChargeCategory;
  }

  return ChargeCategory.OTHER;
}

/**
 * 更新術語的 AI 分類結果
 */
export async function updateTermClassifications(
  batchId: string,
  classifications: TermClassification[]
): Promise<number> {
  let updatedCount = 0;

  for (const classification of classifications) {
    const result = await prisma.extractedTerm.updateMany({
      where: {
        batchId,
        normalizedTerm: classification.term.toLowerCase().trim(),
        suggestedCategory: null, // 只更新未分類的
      },
      data: {
        suggestedCategory: classification.category,
        classificationConfidence: classification.confidence,
        classificationReason: classification.reason,
      },
    });

    updatedCount += result.count;
  }

  return updatedCount;
}

/**
 * 獲取待分類的術語
 */
export async function getUnclassifiedTerms(batchId: string): Promise<string[]> {
  const terms = await prisma.extractedTerm.findMany({
    where: {
      batchId,
      suggestedCategory: null,
    },
    distinct: ['normalizedTerm'],
    select: { normalizedTerm: true },
  });

  return terms.map(t => t.normalizedTerm);
}
```

### Phase 3: 規則管理服務

#### 3.1 批量規則操作

```typescript
// src/services/bulk-rule.service.ts

/**
 * @fileoverview 批量規則管理服務
 * @module src/services/bulk-rule
 * @since Epic 0 - Story 0.5
 */

import { prisma } from '@/lib/prisma';
import { MappingRuleScope, RuleSource } from '@prisma/client';
import type {
  BulkCreateRulesRequest,
  BulkCreateRulesResult,
  BulkUpdateRulesRequest,
  BulkDeleteRulesRequest,
  UndoOperationRequest,
  UndoOperationResult,
  CreateMappingRuleRequest,
} from '@/types/mapping-rule';
import { normalizeTermForAggregation } from '@/lib/utils/term-utils';

/**
 * 批量建立映射規則
 */
export async function bulkCreateRules(
  request: BulkCreateRulesRequest,
  userId: string
): Promise<BulkCreateRulesResult> {
  const { rules, operationName } = request;
  const createdRules: any[] = [];
  const errors: { term: string; reason: string }[] = [];
  let skippedCount = 0;

  // 使用事務
  const result = await prisma.$transaction(async (tx) => {
    // 1. 建立批量操作記錄
    const operation = await tx.bulkOperation.create({
      data: {
        operationType: 'CREATE',
        operationName,
        affectedCount: 0,
        affectedRules: [],
        createdBy: userId,
      },
    });

    // 2. 逐個建立規則
    for (const rule of rules) {
      try {
        const normalizedTerm = normalizeTermForAggregation(rule.sourceTerm);

        // 檢查重複
        const existing = await tx.mappingRule.findFirst({
          where: {
            normalizedTerm,
            scope: rule.scope,
            companyId: rule.companyId ?? null,
          },
        });

        if (existing) {
          skippedCount++;
          errors.push({ term: rule.sourceTerm, reason: '規則已存在' });
          continue;
        }

        // 建立規則
        const created = await tx.mappingRule.create({
          data: {
            sourceTerm: rule.sourceTerm,
            normalizedTerm,
            targetCategory: rule.targetCategory,
            scope: rule.scope,
            companyId: rule.companyId,
            confidence: rule.confidence,
            isOverride: rule.isOverride ?? false,
            source: rule.source ?? RuleSource.AI_SUGGESTED,
            bulkOperationId: operation.id,
            createdBy: userId,
          },
        });

        createdRules.push(created);
      } catch (error: any) {
        errors.push({ term: rule.sourceTerm, reason: error.message });
      }
    }

    // 3. 更新操作記錄
    await tx.bulkOperation.update({
      where: { id: operation.id },
      data: {
        affectedCount: createdRules.length,
        affectedRules: createdRules,
      },
    });

    return {
      operationId: operation.id,
      createdCount: createdRules.length,
      skippedCount,
      errors,
    };
  });

  // 4. 更新 ExtractedTerm 的 ruleCreated 狀態
  for (const rule of createdRules) {
    await prisma.extractedTerm.updateMany({
      where: { normalizedTerm: rule.normalizedTerm },
      data: { ruleCreated: true, ruleId: rule.id },
    });
  }

  return result;
}

/**
 * 批量更新映射規則
 */
export async function bulkUpdateRules(
  request: BulkUpdateRulesRequest,
  userId: string
): Promise<{ operationId: string; updatedCount: number }> {
  const { ruleIds, updates, operationName } = request;

  return await prisma.$transaction(async (tx) => {
    // 1. 獲取原始規則快照
    const originalRules = await tx.mappingRule.findMany({
      where: { id: { in: ruleIds } },
    });

    // 2. 建立操作記錄
    const operation = await tx.bulkOperation.create({
      data: {
        operationType: 'UPDATE',
        operationName,
        affectedCount: originalRules.length,
        affectedRules: originalRules,
        createdBy: userId,
      },
    });

    // 3. 批量更新
    const result = await tx.mappingRule.updateMany({
      where: { id: { in: ruleIds } },
      data: updates,
    });

    return {
      operationId: operation.id,
      updatedCount: result.count,
    };
  });
}

/**
 * 批量刪除映射規則
 */
export async function bulkDeleteRules(
  request: BulkDeleteRulesRequest,
  userId: string
): Promise<{ operationId: string; deletedCount: number }> {
  const { ruleIds, operationName } = request;

  return await prisma.$transaction(async (tx) => {
    // 1. 獲取規則快照
    const rulesToDelete = await tx.mappingRule.findMany({
      where: { id: { in: ruleIds } },
    });

    // 2. 建立操作記錄
    const operation = await tx.bulkOperation.create({
      data: {
        operationType: 'DELETE',
        operationName,
        affectedCount: rulesToDelete.length,
        affectedRules: rulesToDelete,
        createdBy: userId,
      },
    });

    // 3. 更新 ExtractedTerm
    for (const rule of rulesToDelete) {
      await tx.extractedTerm.updateMany({
        where: { ruleId: rule.id },
        data: { ruleCreated: false, ruleId: null },
      });
    }

    // 4. 刪除規則
    const result = await tx.mappingRule.deleteMany({
      where: { id: { in: ruleIds } },
    });

    return {
      operationId: operation.id,
      deletedCount: result.count,
    };
  });
}

/**
 * 撤銷批量操作
 */
export async function undoOperation(
  request: UndoOperationRequest,
  userId: string
): Promise<UndoOperationResult> {
  const { operationId } = request;

  const operation = await prisma.bulkOperation.findUnique({
    where: { id: operationId },
  });

  if (!operation) {
    return { success: false, restoredCount: 0, message: '操作記錄不存在' };
  }

  if (operation.isUndone) {
    return { success: false, restoredCount: 0, message: '操作已被撤銷' };
  }

  const affectedRules = operation.affectedRules as any[];

  return await prisma.$transaction(async (tx) => {
    let restoredCount = 0;

    switch (operation.operationType) {
      case 'CREATE':
        // 撤銷建立 = 刪除
        const deleteResult = await tx.mappingRule.deleteMany({
          where: { bulkOperationId: operationId },
        });
        restoredCount = deleteResult.count;

        // 重置 ExtractedTerm
        for (const rule of affectedRules) {
          await tx.extractedTerm.updateMany({
            where: { ruleId: rule.id },
            data: { ruleCreated: false, ruleId: null },
          });
        }
        break;

      case 'UPDATE':
        // 撤銷更新 = 恢復原值
        for (const rule of affectedRules) {
          await tx.mappingRule.update({
            where: { id: rule.id },
            data: {
              targetCategory: rule.targetCategory,
              confidence: rule.confidence,
              isActive: rule.isActive,
            },
          });
          restoredCount++;
        }
        break;

      case 'DELETE':
        // 撤銷刪除 = 重新建立
        for (const rule of affectedRules) {
          const { id, createdAt, updatedAt, ...ruleData } = rule;
          await tx.mappingRule.create({
            data: { ...ruleData, id }, // 保持原 ID
          });
          restoredCount++;

          // 恢復 ExtractedTerm
          await tx.extractedTerm.updateMany({
            where: { normalizedTerm: rule.normalizedTerm },
            data: { ruleCreated: true, ruleId: id },
          });
        }
        break;
    }

    // 標記操作為已撤銷
    await tx.bulkOperation.update({
      where: { id: operationId },
      data: {
        isUndone: true,
        undoneAt: new Date(),
        undoneBy: userId,
      },
    });

    return {
      success: true,
      restoredCount,
      message: `成功撤銷 ${restoredCount} 條記錄`,
    };
  });
}

/**
 * 導出規則為 CSV
 */
export async function exportRulesToCsv(
  filter?: { scope?: MappingRuleScope; companyId?: string }
): Promise<string> {
  const rules = await prisma.mappingRule.findMany({
    where: {
      ...(filter?.scope && { scope: filter.scope }),
      ...(filter?.companyId && { companyId: filter.companyId }),
    },
    include: {
      company: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const headers = [
    'Source Term',
    'Target Category',
    'Scope',
    'Company',
    'Confidence',
    'Is Override',
    'Created At',
  ];

  const rows = rules.map(rule => [
    rule.sourceTerm,
    rule.targetCategory,
    rule.scope,
    rule.company?.name ?? '',
    rule.confidence.toString(),
    rule.isOverride ? 'Yes' : 'No',
    rule.createdAt.toISOString(),
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return csv;
}
```

### Phase 4: API 路由

#### 4.1 術語分析 API

```typescript
// src/app/api/admin/term-analysis/route.ts

/**
 * @fileoverview 術語分析 API
 * @module src/app/api/admin/term-analysis
 * @since Epic 0 - Story 0.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeTerms } from '@/services/term-aggregation.service';

const querySchema = z.object({
  batchId: z.string().uuid(),
  minFrequency: z.coerce.number().min(1).optional(),
  companyId: z.string().uuid().optional(),
  includeClassified: z.coerce.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      batchId: searchParams.get('batchId'),
      minFrequency: searchParams.get('minFrequency'),
      companyId: searchParams.get('companyId'),
      includeClassified: searchParams.get('includeClassified'),
    });

    const result = await analyzeTerms(query);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error analyzing terms:', error);
    return NextResponse.json(
      { error: 'Failed to analyze terms' },
      { status: 500 }
    );
  }
}
```

#### 4.2 AI 分類 API

```typescript
// src/app/api/admin/term-analysis/classify/route.ts

/**
 * @fileoverview 術語 AI 分類 API
 * @module src/app/api/admin/term-analysis/classify
 * @since Epic 0 - Story 0.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  classifyTerms,
  updateTermClassifications,
  getUnclassifiedTerms,
} from '@/services/term-classification.service';

const requestSchema = z.object({
  batchId: z.string().uuid(),
  terms: z.array(z.string()).optional(), // 如果不提供，則分類所有未分類術語
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchId, terms } = requestSchema.parse(body);

    // 獲取要分類的術語
    const termsToClassify = terms ?? await getUnclassifiedTerms(batchId);

    if (termsToClassify.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          classifiedCount: 0,
          message: 'No terms to classify',
        },
      });
    }

    // 執行 AI 分類
    const classifications = await classifyTerms(termsToClassify);

    // 更新數據庫
    const updatedCount = await updateTermClassifications(batchId, classifications);

    return NextResponse.json({
      success: true,
      data: {
        classifiedCount: updatedCount,
        classifications,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error classifying terms:', error);
    return NextResponse.json(
      { error: 'Failed to classify terms' },
      { status: 500 }
    );
  }
}
```

#### 4.3 批量規則 API

```typescript
// src/app/api/admin/mapping-rules/bulk/route.ts

/**
 * @fileoverview 批量規則管理 API
 * @module src/app/api/admin/mapping-rules/bulk
 * @since Epic 0 - Story 0.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ChargeCategory, MappingRuleScope, RuleSource } from '@prisma/client';
import {
  bulkCreateRules,
  bulkUpdateRules,
  bulkDeleteRules,
} from '@/services/bulk-rule.service';

const createRuleSchema = z.object({
  sourceTerm: z.string().min(1),
  targetCategory: z.nativeEnum(ChargeCategory),
  scope: z.nativeEnum(MappingRuleScope),
  companyId: z.string().uuid().optional(),
  confidence: z.number().min(0).max(1),
  isOverride: z.boolean().optional(),
  source: z.nativeEnum(RuleSource).optional(),
});

const bulkCreateSchema = z.object({
  rules: z.array(createRuleSchema).min(1).max(500),
  operationName: z.string().min(1).max(100),
});

const bulkUpdateSchema = z.object({
  ruleIds: z.array(z.string().uuid()).min(1).max(500),
  updates: z.object({
    targetCategory: z.nativeEnum(ChargeCategory).optional(),
    confidence: z.number().min(0).max(1).optional(),
    isActive: z.boolean().optional(),
  }),
  operationName: z.string().min(1).max(100),
});

const bulkDeleteSchema = z.object({
  ruleIds: z.array(z.string().uuid()).min(1).max(500),
  operationName: z.string().min(1).max(100),
});

// POST - 批量建立
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = bulkCreateSchema.parse(body);

    // TODO: 從 session 獲取 userId
    const userId = 'system';

    const result = await bulkCreateRules(validated, userId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating rules:', error);
    return NextResponse.json(
      { error: 'Failed to create rules' },
      { status: 500 }
    );
  }
}

// PATCH - 批量更新
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = bulkUpdateSchema.parse(body);

    const userId = 'system';

    const result = await bulkUpdateRules(validated, userId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating rules:', error);
    return NextResponse.json(
      { error: 'Failed to update rules' },
      { status: 500 }
    );
  }
}

// DELETE - 批量刪除
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = bulkDeleteSchema.parse(body);

    const userId = 'system';

    const result = await bulkDeleteRules(validated, userId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error deleting rules:', error);
    return NextResponse.json(
      { error: 'Failed to delete rules' },
      { status: 500 }
    );
  }
}
```

#### 4.4 撤銷 API

```typescript
// src/app/api/admin/mapping-rules/bulk/undo/route.ts

/**
 * @fileoverview 撤銷批量操作 API
 * @module src/app/api/admin/mapping-rules/bulk/undo
 * @since Epic 0 - Story 0.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { undoOperation } from '@/services/bulk-rule.service';

const requestSchema = z.object({
  operationId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operationId } = requestSchema.parse(body);

    const userId = 'system';

    const result = await undoOperation({ operationId }, userId);

    return NextResponse.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error undoing operation:', error);
    return NextResponse.json(
      { error: 'Failed to undo operation' },
      { status: 500 }
    );
  }
}
```

### Phase 5: 前端組件

#### 5.1 術語分析頁面

```tsx
// src/app/(dashboard)/admin/term-analysis/page.tsx

/**
 * @fileoverview 術語分析管理頁面
 * @module src/app/(dashboard)/admin/term-analysis
 * @since Epic 0 - Story 0.5
 */

'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TermAnalysisTable } from '@/components/features/term-analysis/TermAnalysisTable';
import { RuleCreationPanel } from '@/components/features/term-analysis/RuleCreationPanel';
import { BulkRuleActions } from '@/components/features/term-analysis/BulkRuleActions';
import { TermStats } from '@/components/features/term-analysis/TermStats';
import { useTermAnalysis } from '@/hooks/use-term-analysis';

export default function TermAnalysisPage() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batchId') ?? '';

  const [selectedTerms, setSelectedTerms] = React.useState<string[]>([]);

  const {
    data,
    isLoading,
    error,
    classifyTerms,
    isClassifying,
  } = useTermAnalysis(batchId);

  if (!batchId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        請選擇一個批次進行術語分析
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">術語分析</h1>
        <BulkRuleActions
          selectedTerms={selectedTerms}
          onRulesCreated={() => setSelectedTerms([])}
        />
      </div>

      {/* 統計卡片 */}
      {data?.stats && <TermStats stats={data.stats} />}

      {/* 主要內容 */}
      <Tabs defaultValue="terms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="terms">術語列表</TabsTrigger>
          <TabsTrigger value="clusters">相似術語群組</TabsTrigger>
          <TabsTrigger value="rules">規則建立</TabsTrigger>
        </TabsList>

        <TabsContent value="terms">
          <Card>
            <CardHeader>
              <CardTitle>提取的術語</CardTitle>
            </CardHeader>
            <CardContent>
              <TermAnalysisTable
                terms={data?.terms ?? []}
                isLoading={isLoading}
                selectedTerms={selectedTerms}
                onSelectionChange={setSelectedTerms}
                onClassify={classifyTerms}
                isClassifying={isClassifying}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clusters">
          <Card>
            <CardHeader>
              <CardTitle>相似術語群組</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 群組視圖組件 */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <RuleCreationPanel
            terms={data?.terms ?? []}
            selectedTerms={selectedTerms}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### 5.2 術語分析表格

```tsx
// src/components/features/term-analysis/TermAnalysisTable.tsx

/**
 * @fileoverview 術語分析表格組件
 * @module src/components/features/term-analysis/TermAnalysisTable
 * @since Epic 0 - Story 0.5
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Building2, CheckCircle2, Search } from 'lucide-react';
import type { AggregatedTerm } from '@/types/term-aggregation';
import { cn } from '@/lib/utils';

interface TermAnalysisTableProps {
  terms: AggregatedTerm[];
  isLoading: boolean;
  selectedTerms: string[];
  onSelectionChange: (terms: string[]) => void;
  onClassify: (terms: string[]) => void;
  isClassifying: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  OCEAN_FREIGHT: '海運費',
  AIR_FREIGHT: '空運費',
  HANDLING_FEE: '操作費',
  CUSTOMS_CLEARANCE: '清關費',
  DOCUMENTATION_FEE: '文件費',
  TERMINAL_HANDLING: '碼頭操作費',
  INLAND_TRANSPORT: '內陸運輸',
  INSURANCE: '保險費',
  STORAGE: '倉儲費',
  FUEL_SURCHARGE: '燃油附加費',
  SECURITY_FEE: '安全費',
  OTHER: '其他',
};

export function TermAnalysisTable({
  terms,
  isLoading,
  selectedTerms,
  onSelectionChange,
  onClassify,
  isClassifying,
}: TermAnalysisTableProps) {
  const [search, setSearch] = React.useState('');
  const [filterCompany, setFilterCompany] = React.useState<string>('all');
  const [filterStatus, setFilterStatus] = React.useState<string>('all');

  // 過濾邏輯
  const filteredTerms = React.useMemo(() => {
    return terms.filter(term => {
      const matchesSearch = term.term.toLowerCase().includes(search.toLowerCase());
      const matchesCompany = filterCompany === 'all' ||
        term.companyDistribution.some(c => c.companyId === filterCompany);
      const matchesStatus = filterStatus === 'all' ||
        (filterStatus === 'classified' && term.classification) ||
        (filterStatus === 'unclassified' && !term.classification) ||
        (filterStatus === 'hasRule' && term.hasRule);
      return matchesSearch && matchesCompany && matchesStatus;
    });
  }, [terms, search, filterCompany, filterStatus]);

  // 全選/取消全選
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(filteredTerms.map(t => t.term));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectTerm = (term: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedTerms, term]);
    } else {
      onSelectionChange(selectedTerms.filter(t => t !== term));
    }
  };

  // 獲取所有公司列表
  const allCompanies = React.useMemo(() => {
    const companies = new Map<string, string>();
    terms.forEach(term => {
      term.companyDistribution.forEach(c => {
        companies.set(c.companyId, c.companyName);
      });
    });
    return Array.from(companies.entries());
  }, [terms]);

  return (
    <div className="space-y-4">
      {/* 工具列 */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋術語..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="篩選公司" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有公司</SelectItem>
            {allCompanies.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="篩選狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="unclassified">未分類</SelectItem>
            <SelectItem value="classified">已分類</SelectItem>
            <SelectItem value="hasRule">已建規則</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => {
            const unclassified = selectedTerms.length > 0
              ? selectedTerms.filter(t => !terms.find(x => x.term === t)?.classification)
              : filteredTerms.filter(t => !t.classification).map(t => t.term);
            onClassify(unclassified);
          }}
          disabled={isClassifying}
        >
          <Sparkles className={cn('h-4 w-4 mr-2', isClassifying && 'animate-pulse')} />
          AI 分類
        </Button>
      </div>

      {/* 表格 */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedTerms.length === filteredTerms.length && filteredTerms.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>術語</TableHead>
              <TableHead className="w-20 text-center">頻率</TableHead>
              <TableHead className="w-40">公司分佈</TableHead>
              <TableHead className="w-32">AI 分類</TableHead>
              <TableHead className="w-24 text-center">信心度</TableHead>
              <TableHead className="w-24 text-center">狀態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  載入中...
                </TableCell>
              </TableRow>
            ) : filteredTerms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  沒有符合條件的術語
                </TableCell>
              </TableRow>
            ) : (
              filteredTerms.map((term) => (
                <TableRow key={term.term}>
                  <TableCell>
                    <Checkbox
                      checked={selectedTerms.includes(term.term)}
                      onCheckedChange={(checked) =>
                        handleSelectTerm(term.term, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{term.term}</div>
                      {term.variants.length > 1 && (
                        <div className="text-xs text-muted-foreground">
                          +{term.variants.length - 1} 變體
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {term.frequency}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {term.companyDistribution.slice(0, 2).map((c) => (
                        <Badge key={c.companyId} variant="outline" className="text-xs">
                          <Building2 className="h-3 w-3 mr-1" />
                          {c.companyName}
                        </Badge>
                      ))}
                      {term.companyDistribution.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{term.companyDistribution.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {term.classification ? (
                      <Badge>
                        {CATEGORY_LABELS[term.classification.category]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {term.classification ? (
                      <span className={cn(
                        'font-medium',
                        term.classification.confidence >= 0.9 && 'text-green-600',
                        term.classification.confidence >= 0.7 && term.classification.confidence < 0.9 && 'text-yellow-600',
                        term.classification.confidence < 0.7 && 'text-red-600'
                      )}>
                        {Math.round(term.classification.confidence * 100)}%
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {term.hasRule ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        已建規則
                      </Badge>
                    ) : (
                      <Badge variant="outline">待建立</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分頁 */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          顯示 {filteredTerms.length} / {terms.length} 術語
        </span>
        <span>已選擇 {selectedTerms.length} 項</span>
      </div>
    </div>
  );
}
```

---

## 驗證清單

### 功能驗證

- [ ] **AC1 術語聚合分析**
  - [ ] 術語正確提取和聚合
  - [ ] 頻率統計準確
  - [ ] 公司分佈顯示正確
  - [ ] 相似術語聚類合理

- [ ] **AC2 AI 分類建議**
  - [ ] GPT-5.2 分類調用成功
  - [ ] 分類結果合理
  - [ ] 信心度計算正確
  - [ ] 批量分類效能良好

- [ ] **AC3 Universal Mapping 建立**
  - [ ] Tier 1 規則建立成功
  - [ ] 規則去重正常
  - [ ] 操作記錄完整

- [ ] **AC4 Company-Specific 規則建立**
  - [ ] Tier 2 規則建立成功
  - [ ] 公司關聯正確
  - [ ] Override 標記正確

- [ ] **AC5 規則批量操作**
  - [ ] 批量編輯功能正常
  - [ ] 批量刪除功能正常
  - [ ] 撤銷功能正常
  - [ ] CSV 導出正確

### 技術驗證

- [ ] TypeScript 類型檢查通過
- [ ] ESLint 檢查通過
- [ ] Prisma Migration 成功
- [ ] GPT-5.2 API 調用效能測試

---

## 文件清單

### 新增文件

| 文件路徑 | 說明 |
|---------|------|
| `src/types/term-aggregation.ts` | 術語聚合類型定義 |
| `src/types/mapping-rule.ts` | 映射規則類型定義 |
| `src/lib/utils/term-utils.ts` | 術語處理工具 |
| `src/services/term-aggregation.service.ts` | 術語聚合服務 |
| `src/services/term-classification.service.ts` | AI 分類服務 |
| `src/services/bulk-rule.service.ts` | 批量規則服務 |
| `src/app/api/admin/term-analysis/route.ts` | 術語分析 API |
| `src/app/api/admin/term-analysis/classify/route.ts` | AI 分類 API |
| `src/app/api/admin/mapping-rules/bulk/route.ts` | 批量規則 API |
| `src/app/api/admin/mapping-rules/bulk/undo/route.ts` | 撤銷 API |
| `src/hooks/use-term-analysis.ts` | 術語分析 Hook |
| `src/app/(dashboard)/admin/term-analysis/page.tsx` | 術語分析頁面 |
| `src/components/features/term-analysis/TermAnalysisTable.tsx` | 術語表格 |
| `src/components/features/term-analysis/RuleCreationPanel.tsx` | 規則建立面板 |
| `src/components/features/term-analysis/BulkRuleActions.tsx` | 批量操作組件 |
| `src/components/features/term-analysis/TermStats.tsx` | 統計組件 |

### 修改文件

| 文件路徑 | 說明 |
|---------|------|
| `prisma/schema.prisma` | 新增 MappingRule, BulkOperation, ExtractedTerm 模型 |
| `src/types/index.ts` | 導出新類型 |
| `src/services/index.ts` | 導出新服務 |

---

## 依賴項

### 內部依賴

- Story 0.2: 智能處理路由（提供提取結果結構）
- Story 0.3: 公司 Profile（提供公司關聯）
- Story 4.1: 映射規則列表（規則模型參考）

### 外部依賴

- `openai`: GPT-5.2 API 調用（已在 Story 0.2 安裝）

---

## 疑難排解

### GPT-5.2 分類問題

```typescript
// 問題：分類結果不一致
// 解決：降低 temperature，增加 few-shot examples
const response = await openai.chat.completions.create({
  model: 'gpt-5.2',
  temperature: 0.1, // 更低的溫度
  messages: [
    { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
    { role: 'user', content: FEW_SHOT_EXAMPLES }, // 添加範例
    { role: 'user', content: prompt },
  ],
});
```

### 大量術語聚合效能

```typescript
// 問題：術語量大時聚合慢
// 解決：使用資料庫聚合而非記憶體處理
const aggregatedTerms = await prisma.extractedTerm.groupBy({
  by: ['normalizedTerm'],
  where: { batchId },
  _count: { normalizedTerm: true },
  orderBy: { _count: { normalizedTerm: 'desc' } },
  take: 1000, // 限制返回數量
});
```

---

## 下一步

完成 Epic 0 所有 Stories 後：
1. 執行完整的整合測試
2. 準備部署到測試環境
3. 進行用戶驗收測試
4. 開始 Epic 1-12 的正式開發

---

*Tech Spec 建立日期: 2025-12-22*
*Story Status: pending*
