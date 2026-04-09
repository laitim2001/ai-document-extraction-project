# Codebase 深度分析 — 任務分工計劃

> **目標**: 產出兩份與參考樣本同等深度的分析報告
> **參考樣本**:
> - `docs/05-analysis/sample/MAF-Claude-Hybrid-Architecture-V7.md`（架構分析）
> - `docs/05-analysis/sample/MAF-Features-Architecture-Mapping-V7.md`（功能映射）
> **輸出位置**: `docs/05-analysis/latest-overview/`
> **建立日期**: 2026-02-27

---

## 整體進度

| 任務 | 輸出檔案 | 狀態 | 說明 |
|------|---------|------|------|
| Task 0 | `ANALYSIS-RAW-DATA.md` | ✅ 完成 | 基礎統計數據 |
| Task 1 | `BATCH1-ARCH-LAYERS.md` | ✅ 完成 | 9 層架構定義 |
| Task 2 | `BATCH1-FEATURE-MAPPING.md` | ✅ 完成 | 22 Epic 功能驗證 |
| Task 3 | `TASK3-E2E-FLOW-TRACING.md` | ✅ 完成 | 端到端流程追蹤（4 場景，1,116 行） |
| Task 4 | `TASK4-DESIGN-DECISIONS.md` | ✅ 完成 | 設計決策分析（11 個決策，二次驗證修正） |
| Task 5 | `TASK5-SECURITY-QUALITY.md` | ✅ 完成 | 安全與品質深度審計（7 領域，三次驗證修正） |
| Task 6 | `TASK6-RECOMMENDATIONS.md` | ✅ 完成 | 架構演進建議（6 建議，694 行） |
| **FINAL-A** | `AIDE-Architecture-Analysis-V1.md` | ⏳ 待執行 | 架構分析報告 |
| **FINAL-B** | `AIDE-Features-Architecture-Mapping-V1.md` | ⏳ 待執行 | 功能架構映射報告 |

---

## Task 3: 端到端流程追蹤

> **Session 指令**: 複製以下 prompt 到新 Session 執行

### 目的
追蹤 3-4 個關鍵業務場景的完整代碼路徑，記錄每一步涉及的文件、函數、數據流。這是最終報告中 **ASCII art 流程圖** 和 **端到端場景** 章節的核心數據來源。

### 需要追蹤的場景

**場景 1: 文件上傳 → AI 提取 → 審核（核心流程，涉及 15+ 功能協同）**
```
用戶上傳 PDF → Azure Blob 存儲 → OCR (Azure Document Intelligence)
→ V3.1 三階段提取 (Company ID → Format Match → Field Extraction)
→ 三層映射 (Universal → Company-Specific → LLM)
→ 信心度計算 (5 維度 + 配置加成)
→ 路由決策 (AUTO_APPROVE / QUICK_REVIEW / FULL_REVIEW)
→ 審核工作流 (如需) → 確認/修正 → 完成
```
需要追蹤：每一步的 service 函數名、API route、Prisma model 操作

**場景 2: 規則學習循環（涉及 4+ 功能協同）**
```
人工修正 → 修正記錄 → 達到閾值(3次) → 生成規則建議
→ 規則審核 → 影響分析 → 批准/拒絕
→ 如批准: 規則生效 → 如準確率下降: 自動回滾
```
需要追蹤：correction-recording → rule-suggestion → rule-change → rollback 的代碼路徑

**場景 3: 批量處理（歷史數據導入）**
```
批量上傳 → 元數據檢測 → 批量處理隊列
→ 並行提取 → 進度追蹤 (SSE)
→ 詞彙聚合 → 統計報告
```

**場景 4: 外部整合觸發（SharePoint/Outlook → 自動處理）**
```
SharePoint 監控 → 新文件偵測 → 自動下載 → 進入處理流程
Outlook 監控 → 郵件篩選 → 附件提取 → 進入處理流程
n8n Webhook → 外部觸發 → 狀態回報
```

### Agent 建議
- Agent 1 (Explore): 追蹤場景 1 + 場景 2（核心業務流程）
- Agent 2 (Explore): 追蹤場景 3 + 場景 4（批量 + 外部整合）

### 輸出格式
每個場景需要輸出：
1. **步驟表**: 步驟編號 | 動作 | 文件路徑 | 函數名 | 輸入 | 輸出
2. **涉及的 Prisma models**: 每步操作哪些 model
3. **涉及的 API routes**: 每步觸發哪些端點
4. **功能協同標註**: 標記哪些 Epic/功能在此步驟參與

### Session Prompt
```
讀取 docs/05-analysis/latest-overview/TASK-PLAN.md 中的 Task 3 說明，
執行端到端流程追蹤分析。使用 2 個 Explore Agent 並行追蹤 4 個場景。
結果保存到 docs/05-analysis/latest-overview/TASK3-E2E-FLOW-TRACING.md
```

---

## Task 4: 設計決策分析

> **Session 指令**: 複製以下 prompt 到新 Session 執行

### 目的
分析本項目中每個重大架構/設計決策的理由、替代方案、取捨考量。這是最終報告中 **關鍵設計決策** 和 **平台定位與價值主張** 章節的數據來源。

### 需要分析的設計決策

**決策 1: 三層映射系統 (Three-Tier Mapping)**
- 為什麼用 3 層而不是 1 層或 2 層？
- 每層的設計意圖和覆蓋率
- 層間優先順序和覆蓋邏輯
- 查看代碼: `src/services/mapping/`, `src/services/rule-resolver.service.ts`

**決策 2: V3.1 三階段提取管線**
- 為什麼從 V2 (單次提取) 演進到 V3 (多步管線) 再到 V3.1 (三階段分離)?
- 每階段使用不同 GPT 模型的理由 (nano vs 5.2)
- Feature Flag 控制 V2/V3 切換的設計
- 查看代碼: `src/services/extraction-v3/`, CHANGE-024/025/026 文檔

**決策 3: 信心度路由機制**
- 5 維度 + 配置加成的設計理由
- 閾值選擇 (95%/80%) 的依據
- V3.1 智能降級邏輯 (新公司/新格式)
- 查看代碼: `src/services/extraction-v3/confidence-v3-1.service.ts`

**決策 4: 統一處理器 + V3 雙軌架構**
- 為什麼同時保留 unified-processor 和 extraction-v3？
- 適配器模式橋接 V2/V3 的設計
- 查看代碼: `src/services/unified-processor/`

**決策 5: Forwarder → Company 重構**
- 重構動機和影響範圍
- 查看代碼: `src/services/company.service.ts`, Epic 5 相關文檔

**決策 6: 技術棧選擇**
- Next.js 15 App Router (非 Pages Router)
- Prisma ORM (非 Drizzle/TypeORM/Knex)
- Zustand + React Query (非 Redux)
- next-intl (非 react-i18next)
- shadcn/ui (非 Ant Design/MUI)
- 查看: `package.json`, 項目文檔

**決策 7: Python 微服務分離**
- 為什麼 OCR 和 Mapping 用 Python 而非 Node.js？
- 雙語言架構的取捨
- 查看: `python-services/`, `docker-compose.yml`

**決策 8: 平台定位**
- 讀取 PRD: `docs/01-planning/prd/prd.md`
- 項目使命: 為什麼做這個系統？解決什麼問題？
- 目標用戶和場景
- 與手動處理/其他方案的差異

### Agent 建議
- Agent 1 (Explore): 決策 1-4（核心架構決策，需要深入代碼追蹤）
- Agent 2 (Explore): 決策 5-8（技術選型 + 平台定位，需要讀文檔 + package.json）

### 輸出格式
每個決策需要輸出：
```
### 決策 N: [名稱]

**問題**: 需要解決什麼問題？
**選擇**: 最終選擇了什麼方案？
**替代方案**: 有哪些其他選項？
**理由**: 為什麼選擇這個方案？(從代碼/文檔中找到的證據)
**取捨**: 這個選擇帶來什麼好處和代價？
**代碼證據**: [具體文件路徑和關鍵代碼片段]
**影響範圍**: 這個決策影響了哪些模組？
```

### Session Prompt
```
讀取 docs/05-analysis/latest-overview/TASK-PLAN.md 中的 Task 4 說明，
執行設計決策分析。使用 2 個 Explore Agent 並行分析 8 個設計決策。
結果保存到 docs/05-analysis/latest-overview/TASK4-DESIGN-DECISIONS.md
```

---

## Task 5: 安全與品質深度審計

> **Session 指令**: 複製以下 prompt 到新 Session 執行

### 目的
對代碼品質和安全問題進行深度審計，產生具體的文件級清單。這是最終報告中 **已知問題**、**代碼品質統計**、**技術債務** 章節的數據來源。

### 需要審計的領域

**審計 1: Auth 中間件覆蓋率詳細分析**
- 列出所有 331 個 route.ts，標記哪些有 auth check、哪些沒有
- 識別 auth 模式: session check? role check? permission check?
- 按領域分組: /admin/* 有多少受保護？/v1/* 有多少？
- 嚴重程度分級: 哪些未保護的路由是高風險的？

**審計 2: Zod 驗證覆蓋率詳細分析**
- 列出所有 POST/PATCH/PUT routes，標記哪些有 Zod schema
- 識別驗證模式: 用了哪些 Zod schema？
- 缺失驗證的路由風險分級

**審計 3: console.log 清理清單**
- 完整的 94 個文件列表 + 每個文件的 console.log 數量
- 分類: debug 用 vs 有意義的 log
- 優先清理建議（從 auth 相關的開始）

**審計 4: any 類型使用詳情**
- 15 處 any 的完整列表: 文件 + 行號 + 上下文
- 每處的修復建議

**審計 5: TODO/FIXME 分類**
- 45 處的完整列表: 文件 + 內容
- 分類: 功能缺失 / 優化建議 / 已過時 / 需要討論
- 優先處理建議

**審計 6: 大文件拆分建議**
- 20 個 >1000 LOC 文件的分析
- 每個文件的拆分方案建議（拆成哪幾個文件）

**審計 7: 測試覆蓋差距**
- 目前只有 1 個測試文件
- 哪些核心邏輯最需要測試？
- 建議的測試優先級

### Agent 建議
- Agent 1 (Explore): 審計 1-3（Auth + Zod + console.log — 大量 Grep 搜索）
- Agent 2 (Explore): 審計 4-7（any + TODO + 大文件 + 測試）

### 輸出格式
每個審計需要輸出：
- **問題摘要表**: 問題 | 數量 | 嚴重度
- **詳細清單**: 具體文件路徑 + 行號
- **修復建議**: 優先級 + 預估工作量

### Session Prompt
```
讀取 docs/05-analysis/latest-overview/TASK-PLAN.md 中的 Task 5 說明，
執行安全與品質深度審計。使用 2 個 Explore Agent 並行審計 7 個領域。
結果保存到 docs/05-analysis/latest-overview/TASK5-SECURITY-QUALITY.md
```

---

## Task 6: 架構演進建議

> **Session 指令**: 複製以下 prompt 到新 Session 執行

### 目的
基於前面所有收集的數據，產生具體的架構改進建議和技術債務清理路線圖。這是最終報告中 **架構演進建議** 和 **技術債務** 章節的數據來源。

### 前置依賴
- 需要先完成 Task 3-5，讀取它們的輸出

### 需要產生的建議

**建議 1: 安全加固 (P0)**
- 基於 Task 5 審計 1 的 Auth 覆蓋率數據
- 哪些路由群組需要優先加 auth？
- 建議的 middleware 實現方案

**建議 2: 代碼品質提升 (P1)**
- console.log 清理計劃
- any 類型修復計劃
- 大文件拆分計劃
- 建議的實施順序和工作量

**建議 3: 測試策略 (P1)**
- 基於功能重要性的測試優先級
- 單元測試 / 整合測試 / E2E 測試的範圍建議
- 覆蓋率目標

**建議 4: 架構優化 (P2)**
- 統一處理器 vs V3 管線的整合方向
- CUID → UUID 遷移完成計劃
- 命名規範統一 (kebab-case vs camelCase hooks)

**建議 5: 生產就緒 (P2)**
- Kubernetes 部署配置
- CI/CD 管線設計
- 效能基準測試

**建議 6: 功能擴展方向**
- 基於現有架構可以擴展的方向
- 技術棧升級路線 (Next.js 15 → 16, etc.)

### Agent 建議
- Agent 1 (Explore): 讀取 Task 3-5 輸出 + 現有代碼，生成建議 1-3
- Agent 2 (Explore): 讀取 Task 3-5 輸出 + 現有代碼，生成建議 4-6

### 輸出格式
每個建議需要輸出：
```
### 建議 N: [名稱] — 優先級: P0/P1/P2

**現狀**: [目前的問題/狀況]
**目標**: [期望達到的狀態]
**方案**: [具體的改進步驟]
**涉及文件**: [需要修改的文件列表]
**預估工作量**: [天數或 story points]
**風險**: [可能的風險和應對]
```

### Session Prompt
```
讀取 docs/05-analysis/latest-overview/TASK-PLAN.md 中的 Task 6 說明，
以及 Task 3-5 的輸出文件：
- docs/05-analysis/latest-overview/TASK3-E2E-FLOW-TRACING.md
- docs/05-analysis/latest-overview/TASK4-DESIGN-DECISIONS.md
- docs/05-analysis/latest-overview/TASK5-SECURITY-QUALITY.md
執行架構演進建議分析。使用 2 個 Explore Agent 並行。
結果保存到 docs/05-analysis/latest-overview/TASK6-RECOMMENDATIONS.md
```

---

## FINAL: 最終報告生成

> **Session 指令**: Task 0-6 全部完成後，在新 Session 執行
> **重要**: 本 section 包含 AIDE 適配的完整章節大綱、功能域定義、數據來源映射，
> 以及 Context 管理策略。執行者必須嚴格按照此規格生成報告。

### 前置依賴（全部已完成）

| # | 檔案 | 行數 | 狀態 |
|---|------|------|------|
| 1 | `ANALYSIS-RAW-DATA.md` | ~500 | ✅ |
| 2 | `BATCH1-ARCH-LAYERS.md` | ~800 | ✅ |
| 3 | `BATCH1-FEATURE-MAPPING.md` | ~600 | ✅ |
| 4 | `TASK3-E2E-FLOW-TRACING.md` | 1,116 | ✅ |
| 5 | `TASK4-DESIGN-DECISIONS.md` | 1,059 | ✅ |
| 6 | `TASK5-SECURITY-QUALITY.md` | ~770 | ✅ (三次驗證修正) |
| 7 | `TASK6-RECOMMENDATIONS.md` | 694 | ✅ |

### 參考格式（僅參考結構，不複製內容）

- `docs/05-analysis/sample/MAF-Claude-Hybrid-Architecture-V7.md`（1,712 行，8 個主章節）
- `docs/05-analysis/sample/MAF-Features-Architecture-Mapping-V7.md`（860 行，7 個主章節）

### 輸出文件

1. `AIDE-Architecture-Analysis-V1.md` — 架構分析報告（預估 1,200-1,800 行）
2. `AIDE-Features-Architecture-Mapping-V1.md` — 功能架構映射報告（預估 800-1,200 行）

---

### AIDE 功能域定義（8 個域，取代 MAF 的 8 個域）

> **重要**: 以下分類用於 Doc 2 的 §2.1-§2.8 章節結構，以及 Doc 1 的 §3 能力矩陣。
> MAF 的 8 個域（Agent 編排、人機協作、狀態與記憶...）是該項目特有的，AIDE 必須使用自己的分類。

| 域 | 功能域名稱 | 涵蓋的 Epic | 核心功能 | 預估功能數 |
|----|-----------|-------------|---------|-----------|
| **D1** | 文件處理與 OCR | Epic 1, 8 | 文件上傳、Azure Blob 存儲、OCR (Azure Document Intelligence)、文件預覽 (PDF/圖片) | ~8 |
| **D2** | AI 提取管線 | Epic 6, 9, 12 | V3.1 三階段提取、信心度計算 (5 維度)、路由決策、提示詞配置 | ~10 |
| **D3** | 三層映射引擎 | Epic 4, 10, 11 | Universal/Company-Specific/LLM 映射、術語分析、欄位映射配置 | ~8 |
| **D4** | 審核工作流 | Epic 2, 3 | 文件審核、修正記錄、審核路由 (AUTO/QUICK/FULL)、批量審核 | ~6 |
| **D5** | 公司與模板管理 | Epic 5, 13, 14 | 公司管理 (原 Forwarder)、數據模板、模板欄位映射、模板實例 | ~8 |
| **D6** | 報表與儀表板 | Epic 15, 16 | 報表生成 (Excel 匯出)、統計儀表板、分析圖表 | ~5 |
| **D7** | 外部整合與批量處理 | Epic 18, 19 | SharePoint/Outlook/n8n 整合、歷史數據批量導入、SSE 進度追蹤 | ~8 |
| **D8** | 系統管理與基礎設施 | Epic 7, 17, 20, 21, 22 | 系統配置、用戶管理、認證 (Azure AD + 本地)、i18n (3 語言)、管理後台 | ~12 |

**Phase 2 CHANGE/FIX 的域映射**：
- D2: CHANGE-024/025/026 (V3.1), CHANGE-036/038/051 (提取增強)
- D3: CHANGE-028/029/030 (映射規則增強)
- D4: CHANGE-041 (批量審核)
- D5: CHANGE-032/044 (公司管理增強)
- D7: CHANGE-047 (SharePoint 增強)
- D8: CHANGE-049/050 (用戶設定、系統設定中心)

---

### Document 1: AIDE-Architecture-Analysis-V1.md — 完整章節大綱

> **對應樣本**: MAF-Claude-Hybrid-Architecture-V7.md
> **結構說明**: 保留樣本的前置章節 + §1-§7 主體 + 附錄結構，但跳過 MAF 特有的 §5 並行處理架構，
> 並將樣本的 §7 可觀測性設計融入 §4 逐層詳情中（AIDE 沒有獨立的可觀測性層）。

```
# AI 文件提取平台：AIDE 架構分析

> 文件版本: 1.0
> 最後更新: 2026-02-XX
> 定位: AI-Driven Document Extraction & Classification Platform
> 狀態: Phase 1 完成 (22 Epics), Phase 2 進行中 (52 CHANGE + 48 FIX)
> 代碼庫規模: ~348K LOC (1,363 TS/TSX files)
> 驗證方式: 多輪 Agent 並行分析 + 交叉驗證

---

## 實現狀態總覽                          ← 數據來源: BATCH1-ARCH-LAYERS
### 各層實現狀態                          ← 9 層 × files/LOC/components/status 表格
### 已知問題                              ← 數據來源: TASK5 問題摘要總覽
                                          ← 格式: # | 問題 | 影響 | 嚴重度 表格

---

## 執行摘要                              ← 數據來源: RAW-DATA + TASK4 決策 8
### 關鍵數據                              ← 項目規模數據表 (LOC, files, models, etc.)
                                          ← 含 ASCII art 平台定位概念圖

---

## 1. 平台定位與價值主張                  ← 數據來源: TASK4 決策 8 (平台定位)
### 1.1 為什麼建立 AI 文件提取平台        ← 問題背景: 450K+ 發票/年, 手動處理痛點
### 1.2 平台核心價值                      ← 3 個使用場景 (同 MAF 的 1.2 格式)
                                          ← 場景 1: 自動提取 + 三層映射 (90%+ 自動化)
                                          ← 場景 2: 信心度路由 + 人工審核 (品質保障)
                                          ← 場景 3: 規則學習循環 (持續改進)
### 1.3 核心價值定位表                    ← AIDE vs 手動處理 vs 其他方案 對比表

---

## 2. 完整架構設計                        ← 數據來源: BATCH1-ARCH-LAYERS + TASK3
### 2.0 端到端執行流程圖                  ← **大型 ASCII art** (同 MAF §2.0 格式)
                                          ← 基於 TASK3 場景 1 的完整流程
                                          ← 從 PDF 上傳 → OCR → 三階段提取 → 三層映射
                                          ← → 信心度計算 → 路由 → 審核 → 完成
### 2.1 九層架構總覽                      ← **大型 ASCII art** (同 MAF §2.1 格式)
                                          ← 基於 BATCH1-ARCH-LAYERS 的 9 層定義
### 2.2 資料流概覽                        ← 簡化版資料流圖 (同 MAF §2.2 格式)

---

## 3. 核心能力矩陣                        ← 數據來源: BATCH1-FEATURE-MAPPING
### 3.1 文件處理與 OCR 能力 (D1)          ← 能力表: 能力 | 實現方式 | 文件位置 | 狀態
### 3.2 AI 提取管線能力 (D2)
### 3.3 三層映射引擎能力 (D3)
### 3.4 審核工作流能力 (D4)
### 3.5 公司與模板管理能力 (D5)
### 3.6 報表與儀表板能力 (D6)
### 3.7 外部整合與批量處理能力 (D7)
### 3.8 系統管理與基礎設施能力 (D8)

---

## 4. 技術棧實現詳情                      ← 數據來源: BATCH1-ARCH-LAYERS (9 層詳情)
### 4.1 Layer 1: 前端展示層               ← 82 pages, 345 components, Tailwind + shadcn/ui
### 4.2 Layer 2: API 路由層               ← 331 route files, 400+ endpoints, RFC 7807
### 4.3 Layer 3: 業務邏輯服務層           ← 200 services, 99,635 LOC
### 4.4 Layer 4: AI 提取管線層            ← extraction-v3, confidence, unified-processor
### 4.5 Layer 5: 資料存取層               ← Prisma ORM, 122 models, 113 enums
### 4.6 Layer 6: 外部服務整合層           ← Azure, OpenAI, Graph API, n8n
### 4.7 Layer 7: Python 微服務層          ← extraction + mapping FastAPI services
### 4.8 Layer 8: 基礎設施層              ← PostgreSQL, Azurite, Docker
### 4.9 Layer 9: 開發支援層               ← i18n, Zustand, React Query, hooks

---

## 5. 關鍵設計決策                        ← 數據來源: TASK4 (全部 8 個決策)
### 5.1 三層映射系統                      ← TASK4 決策 1
### 5.2 V3.1 三階段提取管線              ← TASK4 決策 2
### 5.3 信心度路由機制                    ← TASK4 決策 3
### 5.4 統一處理器 + V3 雙軌架構          ← TASK4 決策 4
### 5.5 Forwarder → Company 重構          ← TASK4 決策 5
### 5.6 技術棧選擇                        ← TASK4 決策 6
### 5.7 Python 微服務分離                 ← TASK4 決策 7
                                          ← 每個決策格式: 問題 | 選擇 | 替代方案 | 理由 | 取捨

---

## 6. 代碼品質與安全現狀                  ← 數據來源: TASK5 (審計 1-7 摘要)
### 6.1 安全覆蓋率                        ← Auth 57.7% (三次驗證), Zod 62%, 高風險路由清單
### 6.2 代碼品質指標                      ← console.log 287, any 21, TODO 42, 大文件 16, raw SQL 15
### 6.3 測試覆蓋差距                      ← 現有測試盤點 + 建議優先級
                                          ← 注意: 這是 MAF §7 可觀測性的 AIDE 適配版

---

## 7. 總結與展望                          ← 數據來源: TASK6 (建議摘要)
### 7.1 平台實現成熟度                    ← 8 個功能域 × 成熟度評估 (從現有數據合成)
### 7.2 後續規劃重點                      ← TASK6 的 P0/P1/P2 建議摘要
### 7.3 架構演進方向                      ← TASK6 建議 4-6 (統一管線/生產就緒/功能擴展)

---

## 附錄 A: 代碼庫規模快速參考             ← 數據來源: RAW-DATA

## 更新歷史
```

**Doc 1 vs MAF 樣本的章節對照**:

| MAF 樣本章節 | AIDE 對應章節 | 適配說明 |
|-------------|-------------|---------|
| Pre: 實現狀態 + 已知問題 + 摘要 | Pre: 同結構 | 直接對應 |
| §1 平台定位 | §1 平台定位 | 內容適配：Agent 編排 → 文件提取 |
| §2 完整架構 (11 層 ASCII) | §2 完整架構 (9 層 ASCII) | 層數不同，ASCII 格式相同 |
| §3 核心能力矩陣 (8 域) | §3 核心能力矩陣 (8 域) | 域名不同，表格格式相同 |
| §4 逐層詳情 (11 層) | §4 逐層詳情 (9 層) | 層數不同，詳情格式相同 |
| §5 並行處理架構 | **跳過** | MAF 特有 (Python asyncio) |
| §6 關鍵設計決策 | §5 關鍵設計決策 | 決策不同，格式相同 |
| §7 可觀測性設計 | §6 代碼品質與安全 | 適配：AIDE 無獨立監控層 |
| §8 總結與展望 | §7 總結與展望 | 直接對應 |
| 附錄 + 更新歷史 | 附錄 + 更新歷史 | 直接對應 |

---

### Document 2: AIDE-Features-Architecture-Mapping-V1.md — 完整章節大綱

> **對應樣本**: MAF-Features-Architecture-Mapping-V7.md
> **結構說明**: 保留樣本的全部主體結構，將 MAF 的 8 個功能域替換為 AIDE 的 8 個功能域 (D1-D8)，
> 將 §3 功能整合總覽中的 Mock/InMemory 分析替換為 AIDE 適用的品質分析。

```
# AI 文件提取平台功能架構映射指南

> 文件版本: 1.0
> 最後更新: 2026-02-XX
> 定位: AI-Driven Document Extraction & Classification Platform
> 前置文件: AIDE-Architecture-Analysis-V1.md (架構總覽)
> 狀態: Phase 1 完成 (22 Epics), Phase 2 進行中 (52 CHANGE + 48 FIX)
> 驗證方式: 多輪 Agent 並行分析 + 交叉驗證

---

## 實現狀態總覽                           ← 數據來源: BATCH1-FEATURE-MAPPING
### 功能驗證結果                           ← 65 功能 (49 原始 + 16 Phase 2) 驗證統計
                                           ← 狀態 | 數量 | 比例 | 說明
### 按功能域統計                           ← 8 域 × 功能數/✅/⚠️/❌/實現率
### Phase 1 → Phase 2 狀態變更             ← Epic 模式 → CHANGE/FIX 模式的演進說明

---

## 執行摘要                               ← 數據來源: BATCH1-FEATURE-MAPPING 概覽
                                           ← 65 個功能, 8 大功能域簡述

---

## 1. 架構層級與功能映射總覽               ← 數據來源: BATCH1-ARCH-LAYERS + FEATURE-MAPPING
### 1.1 架構層級定義 (9 層模型)            ← **ASCII art** 9 層架構圖 (同 Doc 1 §2.1)
                                           ← 層級表: 層 | 名稱 | 說明 | 規模
### 1.2 功能域與架構層級對應               ← 8 域 → 主要層級 對照表
### 1.3 功能實現狀態速查表                 ← **完整功能清單** (65 行)
                                           ← # | 功能名稱 | 狀態 | 架構層級 | 主要位置 | 所屬域

---

## 2. 功能詳細映射                         ← 數據來源: BATCH1-FEATURE-MAPPING + ARCH-LAYERS
### 2.1 文件處理與 OCR (D1, ~8 功能)       ← 表格: # | 功能 | 狀態 | 層級 | 實現文件 | LOC
                                           ← + 代碼結構說明 + 已知問題
### 2.2 AI 提取管線 (D2, ~10 功能)         ← 同上格式 + V3.1 三階段架構說明
### 2.3 三層映射引擎 (D3, ~8 功能)         ← 同上格式 + 層間覆蓋邏輯
### 2.4 審核工作流 (D4, ~6 功能)           ← 同上格式 + 路由決策邏輯
### 2.5 公司與模板管理 (D5, ~8 功能)       ← 同上格式 + Forwarder→Company 重構說明
### 2.6 報表與儀表板 (D6, ~5 功能)         ← 同上格式
### 2.7 外部整合與批量處理 (D7, ~8 功能)   ← 同上格式 + SSE 進度追蹤 + n8n webhook
### 2.8 系統管理與基礎設施 (D8, ~12 功能)  ← 同上格式 + Auth 模式 + i18n 架構

---

## 3. 功能整合總覽                         ← 數據來源: BATCH1 兩份 + TASK5
### 3.1 功能與架構層級映射矩陣             ← 9 層 × 功能編號 | 功能數 表格
### 3.2 架構層級功能分布                   ← 柱狀圖 (ASCII bar chart，同 MAF §3.2)
### 3.3 代碼品質熱點 (按功能域)            ← 取代 MAF 的 Mock 類統計
                                           ← 域 | console.log | any | TODO | 大文件
### 3.4 Phase 2 功能擴展分析               ← 取代 MAF 的 InMemory 風險
                                           ← 16 個 CHANGE 功能的域映射 + 影響分析
### 3.5 功能缺口分析                       ← 仍需實現的功能 / TODO 對應的功能域

---

## 4. 能力總結                             ← 數據來源: TASK5 + TASK6
### 4.1 八大功能域能力矩陣                 ← 域 | 成熟度 | 功能數 | 實現率 | 主要風險
                                           ← 成熟度: Production / Stable / Needs Improvement
### 4.2 安全風險評估                       ← TASK5 審計 1-2 摘要 (Auth + Zod)
### 4.3 已知技術債務與風險                 ← TASK5 全部審計摘要 (嚴重度排序)
### 4.4 架構演進建議                       ← TASK6 的 6 個建議摘要表

---

## 5. 端到端場景                           ← 數據來源: TASK3 (4 個場景)
### 場景一：文件上傳 → AI 提取 → 審核      ← **ASCII art 流程圖** (同 MAF §5 場景格式)
                                           ← 標記功能協同: [D1 上傳] → [D2 提取] → [D3 映射] → [D4 審核]
### 場景二：規則學習循環                    ← ASCII art + 功能協同標記
### 場景三：批量處理（歷史數據導入）        ← ASCII art + 功能協同標記
### 場景四：外部整合觸發                    ← ASCII art + 功能協同標記
                                           ← (場景 4 可簡化為概述，因部分功能仍在開發中)

---

## 附錄 A: 代碼庫規模快速參考              ← 數據來源: RAW-DATA

## 附錄 B: Epic → 功能域對照表             ← Epic 1-22 → D1-D8 的完整對照

## 更新歷史
```

**Doc 2 vs MAF 樣本的章節對照**:

| MAF 樣本章節 | AIDE 對應章節 | 適配說明 |
|-------------|-------------|---------|
| Pre: 實現狀態 + 摘要 | Pre: 同結構 | 64 功能 → 65 功能 |
| §1 架構層級與功能映射 | §1 同結構 | 11 層 → 9 層，8 域名不同 |
| §2.1-§2.8 功能詳細映射 | §2.1-§2.8 同結構 | 域名和內容完全不同 |
| §3.1-§3.2 映射矩陣+分布 | §3.1-§3.2 同結構 | 直接對應 |
| §3.3 Mock 類統計 | §3.3 代碼品質熱點 | 適配：AIDE 無 Mock 問題 |
| §3.4 InMemory 風險 | §3.4 Phase 2 擴展分析 | 適配：AIDE 的 Phase 2 演進 |
| §3.5-§3.6 Stub+缺口 | §3.5 功能缺口 | 合併為一個子章節 |
| §4.0-§4.4 能力總結 | §4.1-§4.4 同結構 | 格式相同，內容適配 |
| §5 端到端場景 | §5 端到端場景 | 2→4 場景 (AIDE 有 4 個) |
| 附錄 A + B | 附錄 A + B | B 改為 Epic→域對照 |

---

### Context 管理策略

> **問題**: 7 份原始數據 (~5,500 行) + 2 份樣本 (~2,570 行) = ~8,000 行，單一 Agent 很難完整消化。
> **方案**: 拆成 2 個 Agent，每個只讀必要的文件。

**Agent 1 — 撰寫 Doc 1 (Architecture Analysis)**

| 優先級 | 文件 | 用途 | 讀取方式 |
|--------|------|------|---------|
| 必讀 | BATCH1-ARCH-LAYERS.md | §2, §4 核心數據 | 全文 |
| 必讀 | TASK4-DESIGN-DECISIONS.md | §1, §5 設計決策 | 全文 |
| 必讀 | ANALYSIS-RAW-DATA.md | Pre, §7 附錄, 統計 | 全文 |
| 必讀 | TASK5-SECURITY-QUALITY.md | Pre 已知問題, §6 | 摘要章節 (問題總覽 + 各審計的 .1 總體統計) |
| 必讀 | TASK6-RECOMMENDATIONS.md | §7 總結與展望 | 建議總覽 + 實施路線圖 |
| 參考 | TASK3-E2E-FLOW-TRACING.md | §2.0 流程圖數據 | 場景 1 的架構總覽 + 完整資料流圖 |
| 參考 | BATCH1-FEATURE-MAPPING.md | §3 能力矩陣 | 按 Epic 分類的摘要部分 |
| **格式** | MAF Architecture V7 | 章節結構參考 | 只讀前 120 行 (結構) + §2.0 (ASCII 格式範例) |

**Agent 2 — 撰寫 Doc 2 (Features Architecture Mapping)**

| 優先級 | 文件 | 用途 | 讀取方式 |
|--------|------|------|---------|
| 必讀 | BATCH1-FEATURE-MAPPING.md | §1, §2, §3 核心數據 | 全文 |
| 必讀 | BATCH1-ARCH-LAYERS.md | §1 層級定義, §3 矩陣 | 全文 |
| 必讀 | TASK3-E2E-FLOW-TRACING.md | §5 端到端場景 | 全文 |
| 必讀 | ANALYSIS-RAW-DATA.md | Pre, 附錄 A | 全文 |
| 必讀 | TASK5-SECURITY-QUALITY.md | §4 能力總結 | 摘要章節 |
| 必讀 | TASK6-RECOMMENDATIONS.md | §4.4 架構建議 | 建議總覽表 |
| 參考 | TASK4-DESIGN-DECISIONS.md | §2 各域的設計背景 | 決策全景矩陣章節 |
| **格式** | MAF Feature Mapping V7 | 章節結構參考 | 只讀前 260 行 (結構+速查表格式) + §5 (場景格式) |

---

### Session Prompt (Doc 1)

```
你的任務是撰寫 AIDE 架構分析報告。

**必讀指引**: 先讀取 docs/05-analysis/latest-overview/TASK-PLAN.md 中的 FINAL section，
找到「Document 1: AIDE-Architecture-Analysis-V1.md — 完整章節大綱」，
這是你必須嚴格遵循的章節結構和數據來源映射。

**格式參考**: 讀取 docs/05-analysis/sample/MAF-Claude-Hybrid-Architecture-V7.md 的前 120 行
理解 metadata + 實現狀態 + 已知問題 + 執行摘要的格式。
再讀第 234-440 行理解 §2.0 大型 ASCII art 流程圖的格式深度。
注意：只參考格式結構，不要複製 MAF 的內容。

**原始數據**（全部在 docs/05-analysis/latest-overview/ 下）:
1. ANALYSIS-RAW-DATA.md — 全文讀取
2. BATCH1-ARCH-LAYERS.md — 全文讀取（§2, §4 核心）
3. TASK4-DESIGN-DECISIONS.md — 全文讀取（§1, §5 核心）
4. TASK5-SECURITY-QUALITY.md — 讀取問題摘要總覽 + 各審計的總體統計小節
5. TASK6-RECOMMENDATIONS.md — 讀取建議總覽 + 實施路線圖
6. TASK3-E2E-FLOW-TRACING.md — 讀取場景 1 的架構總覽 + 完整資料流圖
7. BATCH1-FEATURE-MAPPING.md — 讀取按 Epic 分類的摘要

**輸出**: docs/05-analysis/latest-overview/AIDE-Architecture-Analysis-V1.md

**關鍵要求**:
- §2.0 必須有大型 ASCII art 端到端流程圖（基於 TASK3 場景 1 數據）
- §2.1 必須有大型 ASCII art 9 層架構總覽圖（基於 BATCH1-ARCH-LAYERS）
- §3 核心能力矩陣使用 AIDE 的 8 個功能域 (D1-D8)，見 TASK-PLAN 中的功能域定義表
- §5 每個設計決策使用表格格式: 問題 | 選擇 | 替代方案 | 理由 | 取捨
- 所有數據必須來自原始數據文件，不要虛構數據
```

### Session Prompt (Doc 2)

```
你的任務是撰寫 AIDE 功能架構映射報告。

**必讀指引**: 先讀取 docs/05-analysis/latest-overview/TASK-PLAN.md 中的 FINAL section，
找到「Document 2: AIDE-Features-Architecture-Mapping-V1.md — 完整章節大綱」，
這是你必須嚴格遵循的章節結構和數據來源映射。

**格式參考**: 讀取 docs/05-analysis/sample/MAF-Features-Architecture-Mapping-V7.md 的前 260 行
理解 metadata + 實現狀態 + 執行摘要 + §1 架構層級定義 + 功能速查表的格式。
再讀第 676-777 行理解 §5 端到端場景 ASCII 流程圖的格式深度。
注意：只參考格式結構，不要複製 MAF 的內容。

**原始數據**（全部在 docs/05-analysis/latest-overview/ 下）:
1. ANALYSIS-RAW-DATA.md — 全文讀取
2. BATCH1-FEATURE-MAPPING.md — 全文讀取（§1, §2, §3 核心）
3. BATCH1-ARCH-LAYERS.md — 全文讀取（§1 層級定義, §3 矩陣）
4. TASK3-E2E-FLOW-TRACING.md — 全文讀取（§5 端到端場景）
5. TASK5-SECURITY-QUALITY.md — 讀取問題摘要總覽 + 各審計總體統計
6. TASK6-RECOMMENDATIONS.md — 讀取建議總覽表
7. TASK4-DESIGN-DECISIONS.md — 讀取決策全景矩陣章節

**輸出**: docs/05-analysis/latest-overview/AIDE-Features-Architecture-Mapping-V1.md

**關鍵要求**:
- §1.3 功能速查表必須列出全部 65 個功能（49 原始 + 16 Phase 2）
- §2.1-§2.8 使用 AIDE 的 8 個功能域 (D1-D8)，見 TASK-PLAN 中的功能域定義表
- §2 每個域的格式: 功能表格 + 代碼結構說明 + 已知問題
- §5 四個場景必須有 ASCII art 流程圖，標記涉及的功能域 [D1]→[D2]→[D3]
- 附錄 B 必須列出 Epic 1-22 → D1-D8 的完整對照表
- 所有數據必須來自原始數據文件，不要虛構數據
```

### Agent 建議

建議拆成 **2 個獨立 Session**（不是 1 個 Session 用 2 個 Agent），原因：
1. 每份報告需要消化 ~4,000-5,000 行原始數據 + 生成 1,000+ 行輸出
2. 單一 Session 內 2 個 Agent 共享 context 限制
3. 獨立 Session 可以各自充分利用 context window

| Session | Agent 類型 | 輸出 | 預估行數 |
|---------|-----------|------|---------|
| FINAL-A | code-implementer | AIDE-Architecture-Analysis-V1.md | 1,200-1,800 |
| FINAL-B | code-implementer | AIDE-Features-Architecture-Mapping-V1.md | 800-1,200 |

**FINAL-A 和 FINAL-B 可以完全並行**（兩份報告之間沒有數據依賴）。

---

## 執行順序

```
已完成                              待執行
════════                            ════════

Task 0 (原始數據) ─── ✅
Task 1 (架構層級) ─── ✅
Task 2 (功能映射) ─── ✅
Task 3 (端到端)   ─── ✅ ───┐
Task 4 (設計決策) ─── ✅ ───┤
Task 5 (安全品質) ─── ✅ ───┤
                              ├──→ Task 6 ✅ ──→ FINAL-A + FINAL-B (並行)
                              │
```

### 剩餘執行計劃

| 波次 | Sessions | 說明 |
|------|----------|------|
| **FINAL** | FINAL-A + FINAL-B（2 個 Session 並行） | 各自撰寫一份報告 |

---

*計劃建立: 2026-02-27*
*最後更新: 2026-02-28*
