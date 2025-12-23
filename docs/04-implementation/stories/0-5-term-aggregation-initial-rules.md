# Story 0.5: 術語聚合與初始規則建立

**Status:** pending

---

## Story

**As a** 系統管理員,
**I want** 從歷史數據中聚合常見術語並建立初始映射規則,
**So that** 系統可以快速學習常見的費用項目命名模式。

---

## Acceptance Criteria

### AC1: 術語聚合分析

**Given** 批量處理完成
**When** 執行術語聚合分析
**Then** 顯示：
  - 所有提取到的唯一術語
  - 每個術語的出現頻率
  - 每個術語出現的公司分佈
  - 術語分類（相似術語聚類）

### AC2: AI 分類建議

**Given** 術語列表
**When** 請求 AI 分類建議
**Then** GPT-4o 為每個術語建議：
  - 標準費用類別（Ocean Freight, Handling Fee, etc.）
  - 信心度（0-100%）
  - 建議理由

### AC3: Universal Mapping 建立

**Given** 術語和 AI 建議
**When** 管理員確認映射
**Then** 可以批量建立 Tier 1 Universal Mapping 規則：
  - 術語 → 標準費用類別
  - 預設信心度
  - 適用範圍：全局

### AC4: Company-Specific 規則建立

**Given** 某術語只出現在特定公司
**When** 管理員確認
**Then** 建立 Tier 2 Company-Specific 規則：
  - 術語 → 標準費用類別
  - 關聯公司
  - 覆蓋 Universal 規則的標記

### AC5: 規則批量操作

**Given** 規則建立完成
**When** 需要修改或撤銷
**Then** 可以：
  - 批量編輯規則
  - 批量刪除規則
  - 撤銷最近的批量操作
  - 導出規則為 CSV

---

## Tasks / Subtasks

- [ ] **Task 1: 術語聚合服務** (AC: #1)
  - [ ] 1.1 創建 `src/services/term-aggregation.service.ts`
  - [ ] 1.2 從處理結果中提取術語
  - [ ] 1.3 詞頻統計
  - [ ] 1.4 公司分佈分析
  - [ ] 1.5 相似術語聚類

- [ ] **Task 2: AI 分類服務** (AC: #2)
  - [ ] 2.1 創建 `src/services/term-classification.service.ts`
  - [ ] 2.2 GPT-4o 分類 Prompt 設計
  - [ ] 2.3 批量分類（避免 token 超限）
  - [ ] 2.4 信心度解析

- [ ] **Task 3: 術語分析頁面** (AC: #1, #2)
  - [ ] 3.1 創建 `src/app/(dashboard)/admin/term-analysis/page.tsx`
  - [ ] 3.2 術語列表表格
  - [ ] 3.3 頻率排序
  - [ ] 3.4 公司篩選
  - [ ] 3.5 AI 建議顯示

- [ ] **Task 4: 規則建立 UI** (AC: #3, #4)
  - [ ] 4.1 創建 `RuleCreationPanel.tsx`
  - [ ] 4.2 單個規則確認
  - [ ] 4.3 批量規則確認
  - [ ] 4.4 規則類型選擇（Universal / Company-Specific）

- [ ] **Task 5: 規則管理 API** (AC: #3, #4)
  - [ ] 5.1 POST `/api/admin/mapping-rules/bulk` - 批量建立
  - [ ] 5.2 PATCH `/api/admin/mapping-rules/bulk` - 批量更新
  - [ ] 5.3 DELETE `/api/admin/mapping-rules/bulk` - 批量刪除
  - [ ] 5.4 POST `/api/admin/mapping-rules/bulk/undo` - 撤銷

- [ ] **Task 6: 批量操作功能** (AC: #5)
  - [ ] 6.1 創建 `BulkRuleActions.tsx`
  - [ ] 6.2 批量編輯對話框
  - [ ] 6.3 撤銷機制（基於操作歷史）
  - [ ] 6.4 CSV 導出

- [ ] **Task 7: 術語聚類算法** (AC: #1)
  - [ ] 7.1 相似度計算
  - [ ] 7.2 聚類分組
  - [ ] 7.3 代表術語選擇

- [ ] **Task 8: 驗證與測試** (AC: #1-5)
  - [ ] 8.1 TypeScript 類型檢查通過
  - [ ] 8.2 ESLint 檢查通過
  - [ ] 8.3 聚合準確性測試
  - [ ] 8.4 規則建立功能測試

---

## Dev Notes

### 依賴項

- **Story 0.2**: 智能處理路由（提供提取結果）
- **Story 0.3**: 即時公司 Profile 建立（提供公司資料）
- **Story 4.1**: 映射規則列表查看（規則模型）

### 術語聚合邏輯

```typescript
// src/services/term-aggregation.service.ts

export interface AggregatedTerm {
  term: string;
  frequency: number;
  companyDistribution: {
    companyId: string;
    companyName: string;
    count: number;
  }[];
  similarTerms: string[];
  suggestedCategory?: string;
  confidence?: number;
}

export async function aggregateTerms(
  batchId: string
): Promise<AggregatedTerm[]> {
  // 1. 從處理結果中提取所有術語
  const files = await prisma.historicalFile.findMany({
    where: {
      batchId,
      status: 'COMPLETED',
      extractionResult: { not: null },
    },
    select: {
      extractionResult: true,
      document: {
        select: {
          companyId: true,
          company: { select: { id: true, name: true } },
        },
      },
    },
  });

  // 2. 建立術語 → 出現記錄的映射
  const termMap = new Map<string, {
    count: number;
    companies: Map<string, { name: string; count: number }>;
  }>();

  for (const file of files) {
    const result = file.extractionResult as ExtractionResult;
    for (const item of result.lineItems) {
      const term = normalizeForAggregation(item.description);
      if (!termMap.has(term)) {
        termMap.set(term, { count: 0, companies: new Map() });
      }
      const termData = termMap.get(term)!;
      termData.count++;

      if (file.document?.company) {
        const company = file.document.company;
        if (!termData.companies.has(company.id)) {
          termData.companies.set(company.id, { name: company.name, count: 0 });
        }
        termData.companies.get(company.id)!.count++;
      }
    }
  }

  // 3. 轉換為結果格式
  const aggregated: AggregatedTerm[] = [];
  for (const [term, data] of termMap.entries()) {
    aggregated.push({
      term,
      frequency: data.count,
      companyDistribution: Array.from(data.companies.entries()).map(
        ([companyId, info]) => ({
          companyId,
          companyName: info.name,
          count: info.count,
        })
      ),
      similarTerms: [], // 由聚類算法填充
    });
  }

  // 4. 相似術語聚類
  clusterSimilarTerms(aggregated);

  // 5. 按頻率排序
  aggregated.sort((a, b) => b.frequency - a.frequency);

  return aggregated;
}
```

### AI 分類 Prompt

```typescript
// src/services/term-classification.service.ts

const CLASSIFICATION_PROMPT = `你是一個物流費用分類專家。
請將以下發票術語分類到標準費用類別。

標準費用類別包括：
- OCEAN_FREIGHT: 海運費
- AIR_FREIGHT: 空運費
- HANDLING_FEE: 操作費
- CUSTOMS_CLEARANCE: 清關費
- DOCUMENTATION_FEE: 文件費
- TERMINAL_HANDLING: 碼頭操作費
- INLAND_TRANSPORT: 內陸運輸
- INSURANCE: 保險費
- STORAGE: 倉儲費
- FUEL_SURCHARGE: 燃油附加費
- SECURITY_FEE: 安全費
- OTHER: 其他

請為每個術語返回 JSON 格式：
{
  "term": "原始術語",
  "category": "標準類別代碼",
  "confidence": 0-100 的信心度,
  "reason": "分類理由（簡短）"
}

待分類術語：
{terms}
`;

export async function classifyTerms(
  terms: string[]
): Promise<TermClassification[]> {
  // 分批處理，每批 50 個術語
  const batchSize = 50;
  const results: TermClassification[] = [];

  for (let i = 0; i < terms.length; i += batchSize) {
    const batch = terms.slice(i, i + batchSize);
    const prompt = CLASSIFICATION_PROMPT.replace(
      '{terms}',
      batch.join('\n')
    );

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const classifications = JSON.parse(
      response.choices[0].message.content!
    );
    results.push(...classifications);
  }

  return results;
}
```

### 規則建立

```typescript
// 規則類型

enum MappingRuleScope {
  UNIVERSAL     // Tier 1: 全局適用
  COMPANY       // Tier 2: 公司特定
}

interface CreateMappingRuleRequest {
  sourceTerm: string;           // 原始術語
  targetCategory: string;       // 標準費用類別
  scope: MappingRuleScope;
  companyId?: string;           // 如果是 COMPANY scope
  confidence: number;           // 0-1
  isOverride?: boolean;         // 是否覆蓋 Universal 規則
}

// POST /api/admin/mapping-rules/bulk
interface BulkCreateRequest {
  rules: CreateMappingRuleRequest[];
  operationId: string;          // 用於撤銷
}
```

### 撤銷機制

```prisma
// 操作歷史
model BulkOperation {
  id            String   @id @default(uuid())
  operationType String   @map("operation_type") // CREATE, UPDATE, DELETE
  affectedRules Json     @map("affected_rules") // 規則快照
  createdAt     DateTime @default(now()) @map("created_at")
  createdBy     String   @map("created_by")
  isUndone      Boolean  @default(false) @map("is_undone")
  undoneAt      DateTime? @map("undone_at")

  @@map("bulk_operations")
}
```

### References

- [Source: docs/03-epics/sections/epic-0-historical-data-initialization.md#story-05]
- [Source: docs/00-discovery/past-discussions/Batch_Preprocessing_Strategy.md] (參考)

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 0.5 |
| Story Key | 0-5-term-aggregation-initial-rules |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | Story 0.2, Story 0.3 |

---

*Story created: 2025-12-22*
*Status: pending*
