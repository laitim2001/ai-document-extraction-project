# 信心度閾值設計文檔

> **文檔版本**: 1.0
> **建立日期**: 2025-12-18
> **最後更新**: 2025-12-18
> **相關 Stories**: Story 2-3, Story 2-5, Story 2-6

---

## 概覽

本系統使用多層信心度閾值機制，在不同處理階段應用不同的閾值規則。這些閾值是根據業務需求和錯誤成本分析設計的。

---

## 閾值設計架構

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        信心度閾值分層架構                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  第 1 層：Forwarder 識別閾值 (Story 2-3)                         │   │
│  │  ────────────────────────────────────────────────                │   │
│  │  用途：判斷 Forwarder 是否可自動關聯                              │   │
│  │  閾值：                                                           │   │
│  │    • ≥ 80%: IDENTIFIED（自動識別並關聯）                         │   │
│  │    • 50-79%: NEEDS_REVIEW（需人工確認 Forwarder）                │   │
│  │    • < 50%: UNIDENTIFIED（無法識別）                             │   │
│  │  位置：src/services/identification/identification.service.ts     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              ↓                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  第 2 層：欄位級信心度 (Story 2-5)                               │   │
│  │  ────────────────────────────────────────────────                │   │
│  │  用途：評估每個提取欄位的可靠度                                   │   │
│  │  組成：                                                           │   │
│  │    • OCR 信心度（Azure Document Intelligence）                    │   │
│  │    • 映射信心度（Tier 1/2/3 映射結果）                           │   │
│  │    • 歷史準確度（該 Forwarder + 欄位的歷史表現）                  │   │
│  │  位置：src/services/confidence.service.ts                        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              ↓                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  第 3 層：文件路由閾值 (Story 2-6)                               │   │
│  │  ────────────────────────────────────────────────                │   │
│  │  用途：決定文件的最終處理路徑                                     │   │
│  │  閾值：                                                           │   │
│  │    • ≥ 95%: AUTO_APPROVE（自動通過，無需審核）                   │   │
│  │    • 80-94%: QUICK_REVIEW（快速審核低信心度欄位）                │   │
│  │    • < 80%: FULL_REVIEW（完整審核所有欄位）                      │   │
│  │  位置：src/lib/routing/config.ts                                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 詳細閾值定義

### 1. Forwarder 識別閾值

| 閾值範圍 | 狀態 | 處理方式 | 常數名稱 |
|---------|------|---------|---------|
| ≥ 80% | `IDENTIFIED` | 自動關聯 Forwarder 到文件 | `CONFIDENCE_THRESHOLDS.AUTO_IDENTIFY` |
| 50-79% | `NEEDS_REVIEW` | 需要人工確認 Forwarder 歸屬 | `CONFIDENCE_THRESHOLDS.NEEDS_REVIEW` |
| < 50% | `UNIDENTIFIED` | 無法識別，需人工指定 | - |

**設計理由**：
- **80% 閾值**：Forwarder 識別錯誤的成本相對較低（可在後續審核中修正），因此使用較寬鬆的閾值以提高自動化率
- **50% 下限**：低於此值的識別結果可信度太低，不值得讓人工花時間確認

**代碼位置**：
```typescript
// src/services/identification/identification.service.ts
export const CONFIDENCE_THRESHOLDS = {
  AUTO_IDENTIFY: 80,
  NEEDS_REVIEW: 50,
} as const
```

---

### 2. 文件路由閾值

| 閾值範圍 | 路徑 | 審核範圍 | 常數名稱 |
|---------|------|---------|---------|
| ≥ 95% | `AUTO_APPROVE` | 無需審核 | `ROUTING_CONFIG.autoApproveThreshold` |
| 80-94% | `QUICK_REVIEW` | 僅審核低信心度欄位 | `ROUTING_CONFIG.quickReviewThreshold` |
| < 80% | `FULL_REVIEW` | 審核所有欄位 | - |
| 特殊 | `MANUAL_REQUIRED` | 完整人工處理 | - |

**設計理由**：
- **95% 閾值**：發票數據錯誤的業務成本高（財務影響），因此自動通過需要非常高的信心度
- **80% 閾值**：中等信心度的文件可以讓人工僅檢查有疑問的欄位，提高效率
- **特殊情況**：當 ≥3 個關鍵欄位信心度低於 80% 時，強制進入 MANUAL_REQUIRED

**代碼位置**：
```typescript
// src/lib/routing/config.ts
export const ROUTING_CONFIG: RoutingConfig = {
  autoApproveThreshold: 95,
  quickReviewThreshold: 80,
  criticalFields: [
    'invoiceNumber',
    'invoiceDate',
    'totalAmount',
    'currency',
    'shipperName',
    'consigneeName',
  ],
  // ...
}
```

---

### 3. 欄位級信心度分類

| 分類 | 閾值範圍 | 顏色編碼 | 意義 |
|------|---------|---------|------|
| High | ≥ 90% | 🟢 綠色 | 可信賴，無需人工關注 |
| Medium | 70-89% | 🟡 黃色 | 需留意，可能需確認 |
| Low | < 70% | 🔴 紅色 | 需審核，很可能有誤 |

**代碼位置**：
```typescript
// src/services/confidence.service.ts
function determineConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 90) return 'high'
  if (score >= 70) return 'medium'
  return 'low'
}
```

---

## 閾值配置總表

| 用途 | 文件位置 | 閾值 | Tech Spec |
|------|---------|------|-----------|
| **Forwarder 識別** | `src/services/identification/identification.service.ts` | 80/50 | Story 2-3 |
| **欄位信心度分類** | `src/services/confidence.service.ts` | 90/70 | Story 2-5 |
| **文件路由** | `src/lib/routing/config.ts` | 95/80 | Story 2-6 |

---

## 關鍵欄位定義

以下欄位被定義為「關鍵欄位」，其信心度會額外影響路由決策：

```typescript
const criticalFields = [
  'invoiceNumber',   // 發票號碼
  'invoiceDate',     // 發票日期
  'totalAmount',     // 總金額
  'currency',        // 幣別
  'shipperName',     // 發貨人名稱
  'consigneeName',   // 收貨人名稱
]
```

**規則**：當 ≥3 個關鍵欄位的信心度 < 80% 時，文件自動進入 `MANUAL_REQUIRED` 路徑。

---

## 信心度計算公式

### 欄位信心度計算

```typescript
fieldConfidence = (
  ocrConfidence * OCR_WEIGHT +
  mappingConfidence * MAPPING_WEIGHT +
  historicalAccuracy * HISTORICAL_WEIGHT
) / (OCR_WEIGHT + MAPPING_WEIGHT + HISTORICAL_WEIGHT)
```

**權重配置**：
- OCR 信心度權重：0.4
- 映射信心度權重：0.4
- 歷史準確度權重：0.2

### 整體信心度計算

```typescript
overallConfidence =
  criticalFieldsAverage * CRITICAL_WEIGHT +
  nonCriticalFieldsAverage * NON_CRITICAL_WEIGHT
```

**權重配置**：
- 關鍵欄位權重：0.7
- 非關鍵欄位權重：0.3

---

## 閾值調整指南

### 何時考慮調整閾值

1. **自動化率過低**：如果 AUTO_APPROVE 比例 < 70%，考慮降低 `autoApproveThreshold`
2. **錯誤率過高**：如果自動通過的文件錯誤率 > 2%，考慮提高 `autoApproveThreshold`
3. **人工負擔過重**：如果 FULL_REVIEW 比例 > 20%，考慮降低 `quickReviewThreshold`
4. **Forwarder 識別不準**：如果誤識別率 > 5%，考慮提高 `AUTO_IDENTIFY` 閾值

### 閾值調整流程

1. 分析當前指標（自動化率、錯誤率、人工處理時間）
2. 在測試環境調整閾值
3. 進行 A/B 測試或回測
4. 確認改善效果後部署到生產環境
5. 更新本文檔

---

## 相關文件

- [Story 2-3 Tech Spec](../04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-3.md)
- [Story 2-5 Tech Spec](../04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-5.md)
- [Story 2-6 Tech Spec](../04-implementation/tech-specs/epic-02-ai-processing/tech-spec-story-2-6.md)
- [PRD - FR8 處理路由](../01-planning/prd/sections/functional-requirements.md)

---

## 更新記錄

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| 1.0 | 2025-12-18 | 初始版本 |
