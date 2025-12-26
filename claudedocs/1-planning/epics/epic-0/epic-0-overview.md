# Epic 0: 歷史數據初始化

> **建立日期**: 2025-12-23
> **完成日期**: 2025-12-26
> **狀態**: ✅ 已完成
> **優先級**: High

---

## 1. Epic 目標

### 主要目標
建立歷史數據批次處理能力，讓系統能夠從現有發票數據中學習和建立初始映射規則。

### 業務價值
- 利用現有歷史數據快速建立映射規則基礎
- 減少手動配置工作量
- 加速系統上線準備時間
- 為 Forwarder 特定規則提供數據支持

### 成功定義
- 能夠批次上傳歷史發票文件
- 系統自動識別公司和文檔類型
- 自動聚合術語並建議初始映射規則
- 提供完整的處理進度追蹤

---

## 2. Epic 範圍

### 包含功能（In Scope）

| Story | 名稱 | 描述 | 狀態 |
|-------|------|------|------|
| 0-1 | 批次文件上傳與元數據偵測 | 支援多檔案上傳，自動偵測 Forwarder 和文件類型 | ✅ |
| 0-2 | 智能處理路由 | 根據文件特徵自動選擇處理流程 | ✅ |
| 0-3 | Just-in-Time 公司配置 | 動態建立新發現的公司配置 | ✅ |
| 0-4 | 批次處理進度追蹤 | 即時顯示批次處理狀態和進度 | ✅ |
| 0-5 | 術語聚合與初始規則 | 從提取結果聚合術語，建議映射規則 | ✅ |
| 0-6 | 批次公司識別整合 | 整合公司識別到批次處理流程 | ✅ |
| 0-7 | 批次術語聚合整合 | 整合術語聚合到批次處理 UI | ✅ |

### 排除功能（Out of Scope）
- 即時發票處理（屬於 Epic 2）
- 人工審核工作流（屬於 Epic 3）
- 規則管理界面（屬於 Epic 4）

### 依賴項
- Azure Document Intelligence OCR 服務
- Azure OpenAI GPT-4o 服務
- PostgreSQL 資料庫
- Prisma ORM

---

## 3. 技術架構概覽

### 核心組件

```
┌─────────────────────────────────────────────────────────────────┐
│                    批次處理流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [文件上傳] → [元數據偵測] → [智能路由] → [OCR 提取]            │
│       ↓                                                         │
│  [公司識別] → [術語聚合] → [規則建議] → [進度追蹤]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 關鍵服務

| 服務 | 檔案位置 | 功能 |
|------|---------|------|
| BatchProcessingService | `src/services/batch-processing.service.ts` | 批次處理協調 |
| CompanyIdentificationService | `src/services/company-identification.service.ts` | 公司自動識別 |
| TermAggregationService | `src/services/term-aggregation.service.ts` | 術語聚合分析 |
| HierarchicalTermAggregationService | `src/services/hierarchical-term-aggregation.service.ts` | 三層聚合 |

### 資料模型

```prisma
model Batch {
  id            String   @id @default(cuid())
  name          String
  status        BatchStatus
  totalFiles    Int
  processedFiles Int
  createdAt     DateTime @default(now())
  files         BatchFile[]
}

model BatchFile {
  id            String   @id @default(cuid())
  batchId       String
  fileName      String
  status        FileStatus
  companyId     String?
  documentType  DocumentType?
  extractedData Json?
}
```

---

## 4. 開發時間線

### 階段規劃

| 階段 | 時間 | 內容 | 狀態 |
|------|------|------|------|
| Phase 1 | 2025-12-23 | 批次上傳與元數據偵測 (Story 0-1, 0-2) | ✅ |
| Phase 2 | 2025-12-24 | 公司配置與進度追蹤 (Story 0-3, 0-4) | ✅ |
| Phase 3 | 2025-12-25 | 術語聚合 (Story 0-5) | ✅ |
| Phase 4 | 2025-12-26 | 整合優化 (Story 0-6, 0-7) | ✅ |

### 里程碑

- ✅ M1: 批次上傳 MVP (2025-12-23)
- ✅ M2: 智能路由完成 (2025-12-24)
- ✅ M3: 術語聚合完成 (2025-12-25)
- ✅ M4: Epic 完成 (2025-12-26)

---

## 5. 成功指標

### 功能指標

| 指標 | 目標 | 實際 |
|------|------|------|
| 批次上傳成功率 | ≥ 99% | ✅ 達成 |
| 公司識別準確率 | ≥ 90% | ✅ 達成 |
| 術語聚合覆蓋率 | ≥ 85% | ✅ 達成 |
| 處理進度即時性 | < 2s 延遲 | ✅ 達成 |

### 技術指標

| 指標 | 目標 | 實際 |
|------|------|------|
| 單檔處理時間 | < 30s | ✅ 達成 |
| 批次並行處理數 | ≥ 5 | ✅ 達成 |
| API 回應時間 | < 500ms | ✅ 達成 |

---

## 6. 風險與挑戰

### 已解決風險

| 風險 | 影響 | 解決方案 |
|------|------|----------|
| OCR 品質不一 | 高 | 實施預處理和品質檢查 |
| 公司識別模糊 | 中 | 多策略識別 + 用戶確認 |
| 大量文件處理效能 | 高 | 實施隊列和並行處理 |

### 技術債務

| 項目 | 優先級 | 計劃修復時間 |
|------|--------|-------------|
| 批次處理錯誤重試機制 | Medium | Epic 12 |
| 大文件分片處理 | Low | 未規劃 |

---

## 7. 相關文檔

### 規劃文檔
- PRD: `docs/01-planning/prd/prd.md`
- UX 設計: `docs/01-planning/ux/ux-design.md`

### 技術文檔
- 架構設計: `docs/02-architecture/architecture.md`
- API 文檔: `docs/02-architecture/api-design.md`

### 實施文檔
- Sprint 狀態: `docs/04-implementation/sprint-status.yaml`
- 故事列表: `docs/03-stories/`

---

**維護者**: Development Team
**最後更新**: 2025-12-26
