# Epic 0: 歷史數據初始化

**目標**：處理 5 年以上的歷史 Freight Invoice 文件，建立初始映射規則和公司資料庫，為系統正式運營奠定基礎

**前置條件**：此 Epic 應在系統正式運營前完成，為後續 Epic 1-12 提供基礎數據

---

## 背景說明

系統需要處理 APAC 地區約 2,000-5,000 份歷史發票文件，這些文件來自多個 Forwarder（貨運代理商）。歷史數據處理有以下特點：

1. **格式多樣**：歷史文件可能是原生 PDF、掃描 PDF、或圖片格式
2. **公司未知**：許多 Forwarder 尚未在系統中建立 Profile
3. **規則空白**：初期沒有任何映射規則，需要通過處理建立

---

## Story 0.1: 批量文件上傳與元數據檢測

**As a** 系統管理員,
**I want** 批量上傳歷史發票文件並自動檢測文件類型,
**So that** 系統可以根據文件特性選擇最佳處理方式。

**Acceptance Criteria:**

**Given** 系統管理員在歷史數據管理頁面
**When** 上傳批量文件（支援 .pdf, .jpg, .png, .tiff）
**Then** 系統自動檢測每個文件的類型（原生 PDF / 掃描 PDF / 圖片）
**And** 顯示文件列表及其檢測結果
**And** 允許手動修正檢測結果

**技術要點**：
- 使用元數據檢測策略（Strategy C）
- 原生 PDF：直接提取文字內容判斷
- 掃描 PDF/圖片：標記需要 OCR 處理

---

## Story 0.2: 智能處理路由

**As a** 系統,
**I want** 根據文件類型自動選擇最佳處理方式,
**So that** 可以平衡處理成本和準確性。

**Acceptance Criteria:**

**Given** 文件已完成元數據檢測
**When** 系統決定處理方式
**Then** 原生 PDF 使用 Azure Document Intelligence（成本較低）
**And** 掃描 PDF/圖片使用 GPT-4o Vision（準確性較高）

**Given** 處理完成
**When** 查看處理結果
**Then** 顯示使用的處理方式和估算成本

**技術要點**：
- Azure DI 成本：約 $0.01-0.02/頁
- GPT-4o Vision 成本：約 $0.02-0.04/頁
- 預估總成本：$50-100（2,000 份文件）

---

## Story 0.3: 即時公司 Profile 建立（Just-in-Time）

**As a** 系統,
**I want** 在遇到未知公司時自動建立初始 Profile,
**So that** 不會因為缺少公司資料而中斷處理流程。

**Acceptance Criteria:**

**Given** AI 提取結果中識別到公司名稱
**When** 該公司尚未在系統中建立
**Then** 自動建立初始 Company Profile：
  - 名稱：從發票提取
  - 類型：UNKNOWN（待分類）
  - 狀態：PENDING（待確認）
  - 來源：AUTO_CREATED

**Given** 自動建立的 Company Profile
**When** 管理員審核
**Then** 可以修改類型（Forwarder / Exporter / Carrier / Other）
**And** 可以合併重複的公司（同一公司不同名稱變體）

**技術要點**：
- Company 模型替代 Forwarder 模型（更通用）
- 支援多種公司類型
- 自動去重和合併建議

---

## Story 0.4: 批量處理進度追蹤

**As a** 系統管理員,
**I want** 查看批量處理的即時進度,
**So that** 我可以監控處理狀態並處理異常。

**Acceptance Criteria:**

**Given** 批量處理任務正在執行
**When** 查看處理面板
**Then** 顯示：
  - 總文件數 / 已處理 / 待處理 / 失敗
  - 預估剩餘時間
  - 當前處理文件名
  - 處理速率（文件/分鐘）

**Given** 處理出現錯誤
**When** 查看錯誤詳情
**Then** 顯示錯誤原因和重試選項
**And** 允許跳過並繼續處理其他文件

**技術要點**：
- WebSocket 即時更新（或輪詢）
- 錯誤隔離，避免單一文件影響整批
- 支援斷點續傳

---

## Story 0.5: 術語聚合與初始規則建立

**As a** 系統管理員,
**I want** 從歷史數據中聚合常見術語並建立初始映射規則,
**So that** 系統可以快速學習常見的費用項目命名模式。

**Acceptance Criteria:**

**Given** 批量處理完成
**When** 執行術語聚合分析
**Then** 顯示：
  - 出現頻率最高的術語（Top 100）
  - 每個術語出現的公司分佈
  - AI 建議的標準費用類別

**Given** 聚合結果
**When** 管理員確認映射
**Then** 批量建立 Universal Mapping 規則（Tier 1）
**And** 對於公司特定術語，建立 Company-Specific 規則（Tier 2）

**技術要點**：
- 詞頻統計和聚類
- GPT-4o 輔助分類建議
- 批量規則建立（支援撤銷）

---

## 依賴關係

```
Epic 0: 歷史數據初始化
├─ Story 0.1: 批量文件上傳與元數據檢測
├─ Story 0.2: 智能處理路由 (依賴 0.1)
├─ Story 0.3: 即時公司 Profile 建立 (依賴 0.2)
├─ Story 0.4: 批量處理進度追蹤 (依賴 0.1)
└─ Story 0.5: 術語聚合與初始規則建立 (依賴 0.2, 0.3)
```

---

## 成功指標

| 指標 | 目標 |
|------|------|
| 歷史文件處理完成率 | ≥ 95% |
| 公司 Profile 覆蓋率 | ≥ 90%（已知 Forwarder） |
| 初始 Universal Mapping 規則數 | ≥ 50 條 |
| 平均處理時間 | < 30 秒/文件 |
| 總處理成本 | < $100（2,000 份文件） |

---

## 與其他 Epic 的關係

- **Epic 2**: 使用 Epic 0 建立的映射規則進行新發票處理
- **Epic 4**: 基於 Epic 0 的初始規則進行規則優化和學習
- **Epic 5**: 管理 Epic 0 自動建立的 Company Profile

---

*Epic 建立日期: 2025-12-22*
*狀態: 待開發*
