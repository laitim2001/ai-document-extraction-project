# Tier 3 LLM 實現範圍評估報告

> **文檔版本**: 1.0
> **建立日期**: 2025-12-18
> **最後更新**: 2025-12-18
> **相關 Stories**: Epic 9 (Learning & Optimization)

---

## 1. 執行摘要

### 1.1 現狀總結

| 項目 | 狀態 | 說明 |
|------|------|------|
| **類型定義** | ✅ 已完成 | `tier3`, `llm` 已定義於 `src/types/field-mapping.ts` |
| **信心度權重** | ✅ 已完成 | LLM 基礎信心度 = 60（最低） |
| **代碼結構** | ⚠️ 佔位符 | Python 服務有 TODO 註釋，無實際實現 |
| **Azure OpenAI 整合** | ❌ 未實現 | 環境變數已定義，但無客戶端代碼 |
| **回退機制** | ❌ 未實現 | Tier 1/2 失敗時無 LLM 回退 |
| **學習機制** | ❌ 未實現 | 人工修正升級規則功能未開發 |

### 1.2 結論

**Tier 3 LLM 分類功能目前僅存在於設計文檔中，實際代碼尚未實現。** 根據 MVP 策略，這屬於 MVP 1.5 階段的功能。

---

## 2. 詳細分析

### 2.1 已完成的基礎設施

#### 類型定義 (`src/types/field-mapping.ts`)

```typescript
// 信心度來源（三層架構）
export const CONFIDENCE_SOURCES = {
  TIER1: 'tier1',   // 通用映射規則
  TIER2: 'tier2',   // Forwarder 特定規則
  TIER3: 'tier3',   // LLM 智能分類 ← 已定義但未使用
  AZURE: 'azure',   // Azure Document Intelligence
} as const;

// 提取方法類型
export const EXTRACTION_METHODS = {
  // ...
  LLM: 'llm',       // ← 已定義但未使用
} as const;
```

#### 信心度計算 (`python-services/mapping/src/mapper/field_mapper.py`)

```python
class FieldMapper:
    BASE_CONFIDENCE = {
        "azure_field": 90,   # 最高
        "regex": 85,
        "keyword": 75,
        "position": 70,
        "llm": 60,           # 最低 ← 已定義權重
    }
```

#### 環境變數 (`.env.example`)

```bash
AZURE_OPENAI_ENDPOINT=    # 已定義
AZURE_OPENAI_KEY=         # 已定義
```

### 2.2 未實現的功能

#### Python 服務中的 TODO (`field_mapper.py:497`)

```python
def _determine_source(self, rule, forwarder_id):
    # TODO: Tier 3 (LLM) 待實現
    if forwarder_id:
        return ConfidenceSource.TIER2.value
    return ConfidenceSource.TIER1.value
```

#### 缺失的 LLM 分類函數

參考設計文檔 (`Batch_Preprocessing_Strategy.md`) 中的概念設計：

```python
async def _llm_classify(self, term: str, forwarder: str) -> dict:
    """使用 LLM 分類 - 設計概念，尚未實現"""
    prompt = f"""
    你是一個國際物流費用分類專家。
    Forwarder: {forwarder}
    費用術語: {term}
    請分類到以下類別之一: [類別列表]
    """
    # Azure OpenAI 調用 - 未實現
```

---

## 3. 設計規格

### 3.1 三層映射架構（設計意圖）

```
輸入術語
    │
    ▼
┌─────────────────────────────────────┐
│ Tier 1: Universal Mapping            │  覆蓋 70-80%
│ • 所有 Forwarder 通用的標準術語       │
│ • 例: "OCEAN FREIGHT" → Freight      │
└─────────────────┬───────────────────┘
                  │ 未匹配
                  ▼
┌─────────────────────────────────────┐
│ Tier 2: Forwarder-Specific           │  額外 10-15%
│ • 特定 Forwarder 的術語覆蓋           │
│ • 例: CEVA 的 "ADMIN FEE" → Docs Fee │
└─────────────────┬───────────────────┘
                  │ 未匹配
                  ▼
┌─────────────────────────────────────┐
│ Tier 3: LLM Classification (未實現)  │  剩餘 5-10%
│ • GPT-5.2 智能分類                   │
│ • 處理從未見過的新術語                │
│ • 輸出信心度評分                      │
└─────────────────────────────────────┘
```

### 3.2 MVP 分階段策略

| 階段 | 功能範圍 | 狀態 |
|------|---------|------|
| **MVP 1.0** | Tier 1 + Tier 2 映射 | ✅ 已實現 |
| **MVP 1.5** | + Tier 3 LLM 分類 | ❌ 待開發 |
| **MVP 2.0** | + 從人工修正學習 | ❌ 待開發 |

---

## 4. 實現建議

### 4.1 Phase 1: 核心 LLM 分類服務

**範圍**:
- Azure OpenAI 客戶端整合
- 結構化 Prompt 設計
- 響應解析與信心度計算
- 快取機制（避免重複調用）

**建議位置**:
```
python-services/mapping/src/
├── llm/
│   ├── __init__.py
│   ├── client.py          # Azure OpenAI 客戶端
│   ├── classifier.py      # LLM 分類邏輯
│   ├── prompts.py         # Prompt 模板
│   └── cache.py           # 分類結果快取
```

**技術規格**:
```python
# 建議的 LLM 分類介面
class LLMClassifier:
    async def classify(
        self,
        term: str,
        forwarder_id: Optional[str] = None,
        context: Optional[str] = None,
    ) -> ClassificationResult:
        """
        使用 LLM 分類費用術語

        Returns:
            ClassificationResult:
                - category: 分類結果
                - confidence: 信心度 (0-100)
                - reasoning: 分類理由
        """
```

### 4.2 Phase 2: 整合至映射管線

**修改文件**:
- `python-services/mapping/src/mapper/field_mapper.py`

**實現邏輯**:
```python
def _extract_field(self, field_name, rules, ...):
    # 嘗試 Tier 1/2 規則
    for rule in rules:
        result = self._try_extract(rule, ...)
        if result:
            return result

    # Tier 1/2 都失敗，回退到 LLM（Phase 2 新增）
    if self.llm_enabled:
        return await self._extract_with_llm(field_name, ocr_text, ...)

    return None
```

### 4.3 Phase 3: 學習與升級機制

**功能**:
- 追蹤人工修正
- 3+ 次相同修正後升級為 Tier 2 規則
- 管理員確認工作流

**資料模型（建議）**:
```prisma
model LearningRecord {
  id           String   @id @default(cuid())
  forwarderId  String
  originalTerm String
  correctedCategory String
  correctionCount Int     @default(1)
  isPromoted   Boolean  @default(false)
  promotedAt   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([forwarderId, originalTerm])
}
```

---

## 5. 成本與效益分析

### 5.1 預估成本

| 項目 | 計算基礎 | 月成本 |
|------|---------|--------|
| **Azure OpenAI 調用** | ~1,000 次/月 × $0.01/次 | ~$10 |
| **快取命中** | 預估 70% 命中率 | 節省 ~$7 |
| **實際成本** | | ~$3/月 |

### 5.2 預期效益

| 指標 | 當前 | 加入 Tier 3 後 |
|------|------|---------------|
| **自動分類覆蓋率** | 80-85% | 95-98% |
| **未匹配術語處理** | 手動 | 自動 + 人工確認 |
| **新術語適應時間** | 需等待規則更新 | 即時（LLM 推理） |

---

## 6. 風險與緩解

### 6.1 技術風險

| 風險 | 影響 | 緩解措施 |
|------|------|---------|
| LLM 響應延遲 | 處理時間增加 | 非同步處理 + 快取 |
| LLM 分類錯誤 | 數據質量下降 | 低信心度 → 人工審核 |
| API 配額限制 | 服務中斷 | 速率限制 + 降級策略 |
| 成本超支 | 預算超標 | 快取 + 批次處理 |

### 6.2 業務風險

| 風險 | 影響 | 緩解措施 |
|------|------|---------|
| 誤分類影響財務 | 費用歸類錯誤 | LLM 結果必須經人工確認 |
| 學習錯誤累積 | 規則質量下降 | 管理員審批升級規則 |

---

## 7. 相關文件

- [Product Brief - 三層映射架構](../00-discovery/product-brief-ai-document-extraction-project-2025-12-14.md)
- [Implementation Context](./implementation-context.md)
- [Batch Preprocessing Strategy](../00-discovery/past-discussions/Batch_Preprocessing_Strategy.md)
- [信心度閾值設計](./confidence-thresholds-design.md)

---

## 8. 結論與建議

### 8.1 短期建議（MVP 1.0 維護）

1. **維持現狀** - 當前 Tier 1/2 架構已滿足 80-85% 的分類需求
2. **監控未匹配率** - 追蹤哪些術語無法被現有規則分類
3. **收集學習數據** - 記錄人工修正，為未來 LLM 訓練做準備

### 8.2 中期建議（MVP 1.5 規劃）

1. **Phase 1 先行** - 實現核心 LLM 分類服務
2. **限制調用範圍** - 僅對關鍵欄位使用 LLM 回退
3. **強制人工確認** - LLM 分類結果進入 QUICK_REVIEW 隊列

### 8.3 長期建議（MVP 2.0 規劃）

1. **完整學習機制** - 從人工修正自動升級規則
2. **Fine-tuning** - 使用歷史數據微調專用模型
3. **A/B 測試** - 對比 LLM 與規則的準確率

---

## 更新記錄

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| 1.0 | 2025-12-18 | 初始評估報告 |
