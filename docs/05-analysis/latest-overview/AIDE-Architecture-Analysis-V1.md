# AI 文件提取平台：AIDE 架構分析

> **文件版本**: 1.0
> **最後更新**: 2026-02-27
> **定位**: AI-Driven Document Extraction & Classification Platform
> **狀態**: Phase 1 完成 (22 Epics), Phase 2 進行中 (52 CHANGE + 48 FIX)
> **代碼庫規模**: ~375,270 LOC TypeScript (1,363 files) + 2,719 LOC Python (12 files)
> **驗證方式**: 多輪 Agent 並行分析 + 交叉驗證 + 命令行逐項核實

---

## 實現狀態總覽

> **重要說明**: 本報告基於 2026-02-27 至 2026-02-28 期間的多輪分析，所有核心數據經三次以上交叉驗證（Agent 並行掃描 → Grep 精確匹配 → 命令行逐項核實），確保數據準確性。

### 各層實現狀態

| 層級 | 名稱 | 路徑 | 檔案數 | LOC | 狀態 | 關鍵特徵 |
|------|------|------|--------|-----|------|---------|
| **L1** | 前端展示層 | `src/app/`, `src/components/` | 429+82 | ~118K | ✅ REAL | 429 組件, shadcn/ui 34 primitives, 82 頁面 |
| **L2** | API 路由層 | `src/app/api/` | 331 | ~67K | ✅ REAL | ~414 端點, RFC 7807 錯誤格式, Auth 58% |
| **L3** | 業務服務層 | `src/services/` | 200 | ~100K | ✅ REAL | 22 分類, 三層映射, 工廠+適配器模式 |
| **L4** | AI 提取管線層 | `extraction-v3/`, `unified-processor/` | 42 | ~18K | ✅ REAL | V3.1 三階段, 信心度路由, Feature Flag |
| **L5** | 映射與規則引擎 | `mapping/`, `transform/`, `rule-*` | 31 | ~10K | ✅ REAL | 三層映射, 7 轉換策略, 規則推斷 |
| **L6** | 資料存取層 | `prisma/` | 1 schema | ~4.4K | ✅ REAL | 122 models, 113 enums, 10 遷移 |
| **L7** | 外部整合層 | `n8n/`, `python-services/` | 25+ Node + 12 Py | ~13K | ✅ REAL | n8n, Outlook, SharePoint, 2 Python 微服務 |
| **L8** | i18n 與配置層 | `messages/`, `src/i18n/` | 102+13 | ~21K | ✅ REAL | 3 語言 x 34 namespace, ICU MessageFormat |
| **L9** | 基礎設施層 | `docker-compose.yml` | 配置文件 | ~500 | ✅ REAL | Docker Compose, PostgreSQL, Azurite |

### 已知問題

| # | 問題 | 影響 | 嚴重度 |
|---|------|------|--------|
| 1 | `/v1/*` 74 路由無 session auth（3.9% 覆蓋率） | 版本化業務 API 無認證保護 | **嚴重** |
| 2 | middleware.ts 跳過所有 `/api` 路由 | API 層無全局認證中間件 | **嚴重** |
| 3 | 測試覆蓋率 ~0%（僅 1 個測試文件） | 核心路徑完全無測試 | **嚴重** |
| 4 | `/cost/*` `/dashboard/*` 全部無認證 | 敏感財務/業務數據外洩風險 | **高** |
| 5 | `auth.config.ts` 9 個 console.log 洩露用戶電郵 | 帳號列舉攻擊風險 | **高** |
| 6 | 287 處 console.log 分佈 94 個文件 | 生產環境資訊洩漏 + 效能影響 | **高** |
| 7 | Zod 驗證覆蓋率僅 62%（73 個寫入端點無驗證） | 輸入注入風險 | **中** |
| 8 | 21 處 `any` 類型（15 個文件） | TypeScript 類型安全降低 | **中** |
| 9 | 16 個文件超過 1,000 LOC | 可維護性下降 | **中** |
| 10 | 45 個 TODO/FIXME（含 3 個 P0 核心功能） | 功能完整度偏差 | **中** |
| 11 | 無 CI/CD 管線 | 部署品質無自動化保障 | **中** |
| 12 | 無 Node.js Dockerfile / K8s 配置 | 未生產就緒 | **中** |
| 13 | 74 cuid + 47 uuid ID 策略混用 | 數據一致性風險 | **低** |
| 14 | ~43 個 hooks camelCase vs kebab-case 命名不一致 | 代碼風格不統一 | **低** |

---

## 執行摘要

AIDE 是一個 **AI 驅動的 Freight Invoice 智能提取與自動分類平台**，專為 SCM 部門設計，解決每年 450,000-500,000 張發票的手動處理瓶頸。平台核心競爭力不在 OCR 本身，而在 **三層映射 + 持續學習 + 信心度路由** 的完整業務邏輯閉環。

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                        │
│   AIDE Platform = AI-Driven Document Extraction & Classification       │
│   ════════════════════════════════════════════════════════════         │
│                                                                        │
│   「不是通用 OCR 工具，                                                │
│     而是垂直領域的 Freight Invoice 智能處理平台」                       │
│                                                                        │
│   三層映射引擎 (Three-Tier Mapping)                                    │
│   ─────────────────────────────────                                    │
│   • Tier 1: Universal Mapping      — 覆蓋 70-80% 常見術語             │
│   • Tier 2: Company-Specific       — 額外 10-15% 差異化映射           │
│   • Tier 3: LLM Classification     — 剩餘 5-10% AI 智能分類           │
│   • 規則從 9,000 條精簡至 ~800 條（↓90%）                             │
│                                                                        │
│   V3.1 三階段提取管線 (Three-Stage Extraction)                         │
│   ────────────────────────────────────────────                         │
│   • Stage 1: 公司識別 (GPT-5-nano, ~$0.0004)                          │
│   • Stage 2: 格式識別 (GPT-5-nano, ~$0.0005)                          │
│   • Stage 3: 欄位提取 (GPT-5.2,   ~$0.0027)                          │
│   • 總計 ~$0.0036/份（成本降低 86%）                                   │
│                                                                        │
│   信心度路由 (Confidence-Based Routing)                                 │
│   ─────────────────────────────────────                                │
│   • ≥90% → AUTO_APPROVE  （自動通過，無需人工）                       │
│   • 70-89% → QUICK_REVIEW （快速審核，一鍵確認）                      │
│   • <70% → FULL_REVIEW   （完整人工審核）                             │
│   • V3.1 智能降級: 新公司/新格式 → 強制降級                           │
│                                                                        │
│   企業級能力                                                           │
│   ──────────                                                           │
│   • NextAuth v5 + Azure AD SSO + RBAC 6 角色                          │
│   • n8n 工作流引擎整合（業務人員自助調整）                             │
│   • 四層審計日誌（操作/安全/統計/API）                                 │
│   • 3 語言 × 34 命名空間國際化                                        │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
```

### 關鍵數據

| 指標 | 數量 | 說明 |
|------|------|------|
| TypeScript LOC | ~375,270 | 1,363 TS/TSX files in `src/` |
| Python LOC | 2,719 | 12 files (OCR + Mapping 微服務) |
| API 端點 | ~414 | 331 route files, RFC 7807 標準 |
| Prisma Models | 122 | 113 enums, 439 索引, 73 唯一約束 |
| React 組件 | 429 | 34 UI + 358 features + 5 layout + 32 other |
| 自定義 Hooks | 104 | 覆蓋完整業務功能 |
| 業務服務 | 200 | 22 個分類, ~99,600 LOC |
| i18n 翻譯 | 102 JSON | 3 語言 × 34 命名空間 |
| Epics 完成 | 22/22 | 157+ Stories, Phase 1 全部完成 |
| Phase 2 變更 | 52 CHANGE + 48 FIX | 持續功能迭代中 |

---

## 1. 平台定位與價值主張

### 1.1 為什麼建立 AI 文件提取平台

SCM 部門面臨的核心挑戰：

| 痛點 | 現狀 | 影響 |
|------|------|------|
| 年處理量巨大 | 450,000-500,000 張發票（APAC 地區） | 人力資源嚴重不足 |
| 手動處理耗時 | 每張 ~5 分鐘 = ~41,667 人時/年 | 高人力成本 |
| 格式多樣化 | 100+ 種格式, 45+ 個 Forwarder | 標準化困難 |
| 錯誤率偏高 | 手工錄入 ~5% | 數據質量問題 |

**目標用戶**:
- **Amy（數據處理專員）**: 每日 150-200 張，希望減輕重複工作
- **David（SCM 經理）**: 需完整費用明細做供應商分析與議價

### 1.2 平台核心價值

**場景 1: 自動提取 + 三層映射（90%+ 自動化）**

用戶上傳 PDF 發票後，系統自動執行 OCR 識別、三階段 AI 提取（公司→格式→欄位）、三層映射（通用→特定→AI），將非結構化發票轉為結構化數據。高信心度結果自動批准，無需人工介入。

**場景 2: 信心度路由 + 人工審核（品質保障）**

系統通過 5 維度加權信心度評估提取質量，自動將低信心度結果路由至審核隊列。審核員可一鍵確認或修正欄位，修正結果自動記錄為學習數據。V3.1 智能降級機制在遇到新公司/新格式時主動降級，防止虛假高分通過。

**場景 3: 規則學習循環（持續改進）**

審核員的修正被系統自動分析，當同一修正模式出現 3 次以上，系統自動生成規則建議。經過影響分析和人工審批後，建議升級為正式映射規則。若新規則導致準確率下降 >10%，自動回滾並觸發告警。

### 1.3 核心價值定位表

| 能力維度 | AIDE 平台 | 手動 Excel/VBA | 商用 RPA (UiPath) | 通用 OCR SaaS |
|---------|-----------|---------------|-------------------|---------------|
| **語義理解** | 三層映射 + GPT-5.2 | 無 | 規則式，不理解語義 | 僅 OCR，不含業務邏輯 |
| **自動化率** | 90-95% | <10% | 50-70% | 30-50% |
| **成本/張** | ~$0.004 | ~$0.50 (人工) | ~$0.10 (授權) | ~$0.01 (API) |
| **持續學習** | 修正→建議→規則閉環 | 無 | 需手動更新規則 | 無 |
| **信心度路由** | 5 維度 + 智能降級 | 無 | 無 | 無 |
| **企業整合** | Azure AD + SharePoint + Outlook + n8n | 無 | 有限 | API 整合 |
| **多格式支援** | 100+ 格式，插拔式架構 | 逐格式開發 | 逐格式配置 | 通用但淺層 |
| **維護成本** | 800 條規則（↓90%） | O(n) 格式 | 高（授權+維護） | 低但淺層 |

---

## 2. 完整架構設計

### 2.0 端到端執行流程圖

> **重要**: 此圖展示 AIDE 平台的核心業務流程 — 從用戶上傳 PDF 發票到最終審核完成的每一步驟和決策點。基於 4 輪代碼追蹤驗證，涵蓋 30+ 步驟、17 個 Prisma Models、15+ 核心服務。

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                        AIDE Platform 端到端執行流程圖 (V3.1)                           │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  ╔══════════════════════════════════════════════════════════════════════════════════╗ │
│  ║                          入口層 — 文件來源                                       ║ │
│  ╠══════════════════════════════════════════════════════════════════════════════════╣ │
│  ║                                                                                  ║ │
│  ║   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           ║ │
│  ║   │  手動上傳    │  │ SharePoint  │  │  Outlook    │  │  n8n 工作流  │           ║ │
│  ║   │  (Web UI)   │  │ (自動獲取)  │  │ (郵件附件)  │  │ (Webhook)   │           ║ │
│  ║   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           ║ │
│  ║          │                │                │                │                    ║ │
│  ║          └────────────────┴────────────────┴────────────────┘                    ║ │
│  ║                                    │                                             ║ │
│  ║                                    ▼                                             ║ │
│  ║   ┌──────────────────────────────────────────────────────────────────────────┐   ║ │
│  ║   │                    POST /api/documents/upload                             │   ║ │
│  ║   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │   ║ │
│  ║   │   │ 格式/大小驗證 │  │ Azure Blob   │  │ Document     │                  │   ║ │
│  ║   │   │ (Zod Schema) │  │ 上傳         │  │ .create()    │                  │   ║ │
│  ║   │   └──────────────┘  └──────────────┘  └──────────────┘                  │   ║ │
│  ║   │                     ↓ Fire-and-Forget (Promise.allSettled)                │   ║ │
│  ║   └──────────────────────────────┬───────────────────────────────────────────┘   ║ │
│  ╚══════════════════════════════════│═══════════════════════════════════════════════╝ │
│                                      │                                                │
│  ╔══════════════════════════════════│═══════════════════════════════════════════════╗ │
│  ║             統一處理器層 — UnifiedDocumentProcessor                               ║ │
│  ╠══════════════════════════════════│═══════════════════════════════════════════════╣ │
│  ║                                   ▼                                               ║ │
│  ║   ┌──────────────────────────────────────────────────────────────────────────┐   ║ │
│  ║   │              UnifiedDocumentProcessor.processFile()                       │   ║ │
│  ║   │                                                                          │   ║ │
│  ║   │   ┌────────────────────────────────────────────────────────────────┐    │   ║ │
│  ║   │   │ Feature Flag 三層決策:                                          │    │   ║ │
│  ║   │   │ ├─ forceLegacy = true ──────────────→ Legacy Processor (V1)    │    │   ║ │
│  ║   │   │ ├─ shouldUseV3 = true (灰度%) ─────→ V3 Service (三階段)      │    │   ║ │
│  ║   │   │ └─ default ─────────────────────────→ V2 Pipeline (11 步)     │    │   ║ │
│  ║   │   └────────────────────────────────────────────────────────────────┘    │   ║ │
│  ║   └──────────────────────────────┬───────────────────────────────────────────┘   ║ │
│  ╚══════════════════════════════════│═══════════════════════════════════════════════╝ │
│                                      │                                                │
│  ╔══════════════════════════════════│═══════════════════════════════════════════════╗ │
│  ║          V3.1 三階段提取管線 — StageOrchestrator                                 ║ │
│  ╠══════════════════════════════════│═══════════════════════════════════════════════╣ │
│  ║                                   ▼                                               ║ │
│  ║   ┌──────────────────────────────────────────────────────────────────────────┐   ║ │
│  ║   │  Step 1: FILE_PREPARATION                                                │   ║ │
│  ║   │  └─ PdfConverter.convert() → imageBase64Array[]                          │   ║ │
│  ║   └──────────────────────────────┬───────────────────────────────────────────┘   ║ │
│  ║                                   ▼                                               ║ │
│  ║   ┌──────────────────────────────────────────────────────────────────────────┐   ║ │
│  ║   │  Step 2: STAGE_1_COMPANY_IDENTIFICATION (GPT-5-nano, ~$0.0004)          │   ║ │
│  ║   │  ├─ Company.findMany() → 已知公司匹配                                    │   ║ │
│  ║   │  ├─ GptCallerService.call() → Logo/Header/Address/TaxID 識別             │   ║ │
│  ║   │  └─ 輸出: { companyId, companyName, confidence, isNewCompany }           │   ║ │
│  ║   │      ⚠️ 失敗 → fallback LLM 分類 → 仍失敗 → FALLBACK_FAILED            │   ║ │
│  ║   └──────────────────────────────┬───────────────────────────────────────────┘   ║ │
│  ║                                   ▼                                               ║ │
│  ║   ┌──────────────────────────────────────────────────────────────────────────┐   ║ │
│  ║   │  Step 3: STAGE_2_FORMAT_IDENTIFICATION (GPT-5-nano, ~$0.0005)           │   ║ │
│  ║   │  ├─ DocumentFormat.findMany() → 已知格式匹配                              │   ║ │
│  ║   │  ├─ 配置決策: COMPANY_SPECIFIC > UNIVERSAL > LLM_INFERRED                │   ║ │
│  ║   │  └─ 輸出: { formatId, formatName, configSource, isNewFormat }            │   ║ │
│  ║   │      ⚠️ 失敗 → 使用 Universal 欄位定義回退                               │   ║ │
│  ║   └──────────────────────────────┬───────────────────────────────────────────┘   ║ │
│  ║                                   ▼                                               ║ │
│  ║   ┌──────────────────────────────────────────────────────────────────────────┐   ║ │
│  ║   │  Step 4: STAGE_3_FIELD_EXTRACTION (GPT-5.2, ~$0.0027)                   │   ║ │
│  ║   │  ├─ PromptAssemblyService → 動態 Prompt (FORMAT > COMPANY > GLOBAL)     │   ║ │
│  ║   │  │   └─ PromptConfig + FieldMappingConfig + MappingRule (Tier 1+2)      │   ║ │
│  ║   │  ├─ GptCallerService.call() → 結構化欄位提取                              │   ║ │
│  ║   │  ├─ ReferenceNumberMatcher → 參考編號匹配 (CHANGE-032)                   │   ║ │
│  ║   │  ├─ ExchangeRateConverter → 匯率轉換 (CHANGE-032)                        │   ║ │
│  ║   │  └─ 輸出: { standardFields, lineItems, extraCharges }                    │   ║ │
│  ║   │      ⚠️ 失敗 → OCR_FAILED → 強制 FULL_REVIEW                            │   ║ │
│  ║   └──────────────────────────────┬───────────────────────────────────────────┘   ║ │
│  ║                                   ▼                                               ║ │
│  ║   ┌──────────────────────────────────────────────────────────────────────────┐   ║ │
│  ║   │  Step 5: TERM_RECORDING                                                  │   ║ │
│  ║   │  └─ TermAggregationResult → 術語記錄用於持續學習                          │   ║ │
│  ║   └──────────────────────────────┬───────────────────────────────────────────┘   ║ │
│  ╚══════════════════════════════════│═══════════════════════════════════════════════╝ │
│                                      │                                                │
│  ╔══════════════════════════════════│═══════════════════════════════════════════════╗ │
│  ║            信心度計算與路由決策 — ConfidenceV3_1Service                           ║ │
│  ╠══════════════════════════════════│═══════════════════════════════════════════════╣ │
│  ║                                   ▼                                               ║ │
│  ║   ┌──────────────────────────────────────────────────────────────────────────┐   ║ │
│  ║   │  Step 6: CONFIDENCE_CALCULATION (5-6 維度加權)                            │   ║ │
│  ║   │                                                                          │   ║ │
│  ║   │   總信心度 (0-100) =                                                     │   ║ │
│  ║   │     20% x STAGE_1_COMPANY       (公司識別精度)                            │   ║ │
│  ║   │   + 15% x STAGE_2_FORMAT        (格式識別精度)                            │   ║ │
│  ║   │   + 30% x STAGE_3_EXTRACTION    (欄位提取精度, 最重要)                    │   ║ │
│  ║   │   + 20% x FIELD_COMPLETENESS    (必填欄位完整性)                          │   ║ │
│  ║   │   + 15% x CONFIG_SOURCE_BONUS   (COMPANY:100 / UNIVERSAL:80 / LLM:50)   │   ║ │
│  ║   │   (+5% x REFERENCE_NUMBER_MATCH  動態第 6 維度, CHANGE-032, 預設停用)     │   ║ │
│  ║   └──────────────────────────────┬───────────────────────────────────────────┘   ║ │
│  ║                                   ▼                                               ║ │
│  ║   ┌──────────────────────────────────────────────────────────────────────────┐   ║ │
│  ║   │  Step 7: ROUTING_DECISION (雙層路由)                                      │   ║ │
│  ║   │                                                                          │   ║ │
│  ║   │   Layer 1: getSmartReviewType() — 前置強制降級                            │   ║ │
│  ║   │   ├─ 新公司 + 新格式 → 強制 FULL_REVIEW                                  │   ║ │
│  ║   │   ├─ 新公司 → 強制 FULL_REVIEW                                           │   ║ │
│  ║   │   ├─ 新格式 → 強制 QUICK_REVIEW                                          │   ║ │
│  ║   │   └─ DEFAULT 配置 → 降一級                                               │   ║ │
│  ║   │                                                                          │   ║ │
│  ║   │   Layer 2: generateRoutingDecision() — 標準路由 + 額外降級               │   ║ │
│  ║   │   ├─ score >= 90 → AUTO_APPROVE                                          │   ║ │
│  ║   │   ├─ score >= 70 → QUICK_REVIEW                                          │   ║ │
│  ║   │   └─ score <  70 → FULL_REVIEW                                           │   ║ │
│  ║   │   + 額外降級: LLM推斷/待分類>3/Stage失敗                                 │   ║ │
│  ║   └──────────────────────────────┬───────────────────────────────────────────┘   ║ │
│  ╚══════════════════════════════════│═══════════════════════════════════════════════╝ │
│                                      │                                                │
│              ┌───────────────────────┼───────────────────────┐                        │
│              ▼                       ▼                       ▼                        │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐                    │
│  │  AUTO_APPROVE   │   │  QUICK_REVIEW   │   │  FULL_REVIEW    │                    │
│  │  (≥90% 信心度)  │   │  (70-89%)       │   │  (<70%)         │                    │
│  │                 │   │                 │   │                 │                    │
│  │ Document.update │   │ ReviewRecord    │   │ 詳細人工審核    │                    │
│  │ status=APPROVED │   │ .create()       │   │ + 修正          │                    │
│  │                 │   │ 一鍵確認/修正   │   │ Correction      │                    │
│  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘                    │
│           │                     │                     │                              │
│           └─────────────────────┴─────────────────────┘                              │
│                                  │                                                    │
│  ╔═══════════════════════════════│════════════════════════════════════════════════╗   │
│  ║                    結果持久化與審計                                              ║   │
│  ╠═══════════════════════════════│════════════════════════════════════════════════╣   │
│  ║   ┌───────────────────────────────────────────────────────────────────────┐   ║   │
│  ║   │ ExtractionResult.create() ← 提取結果持久化                            │   ║   │
│  ║   │ AuditLog.create()         ← 四層審計日誌                              │   ║   │
│  ║   │ TemplateInstance          ← 自動模板匹配                              │   ║   │
│  ║   │ TermAggregationResult     ← 術語聚合（持續學習）                      │   ║   │
│  ║   └───────────────────────────────────────────────────────────────────────┘   ║   │
│  ╚══════════════════════════════════════════════════════════════════════════════╝   │
│                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────┘

執行流程摘要:
═══════════════
1. 文件來源 → 上傳入口 (手動/SharePoint/Outlook/n8n)
2. 檔案驗證 + Azure Blob 儲存 + Document.create()
3. Fire-and-Forget → UnifiedDocumentProcessor (Feature Flag V2/V3 決策)
4. PDF 轉 Base64 → StageOrchestrator 三階段提取
5. Stage 1: 公司識別 (GPT-5-nano) → Stage 2: 格式識別 (GPT-5-nano)
6. Stage 3: 欄位提取 (GPT-5.2) + 參考編號匹配 + 匯率轉換
7. 5-6 維度信心度計算 → 雙層路由決策
8. AUTO_APPROVE / QUICK_REVIEW / FULL_REVIEW
9. 結果持久化 + 審計日誌 + 術語記錄 + 模板匹配
```

### 2.1 九層架構總覽

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                   AIDE Platform：九層架構總覽 (V1.0)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ╔════════════════════════════════════════════════════════════════════════╗  │
│  ║  Layer 1: 前端展示層 (Frontend/UI)                                     ║  │
│  ║  429 組件 + 82 頁面 | ~118,000 LOC | React 18 + Next.js 15 App Router ║  │
│  ╠════════════════════════════════════════════════════════════════════════╣  │
│  ║                                                                        ║  │
│  ║   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             ║  │
│  ║   │ Document │  │  Review  │  │  Admin   │  │Dashboard │             ║  │
│  ║   │ Upload   │  │  Panel   │  │ Modules  │  │ & Reports│             ║  │
│  ║   │ & Detail │  │ & Queue  │  │ (22個)   │  │          │             ║  │
│  ║   └──────────┘  └──────────┘  └──────────┘  └──────────┘             ║  │
│  ║   34 shadcn/ui + 358 features + Zustand + React Query + Hook Form    ║  │
│  ╚═══════════════════════════│════════════════════════════════════════════╝  │
│                               │ React Query + Fetch API                      │
│  ╔═══════════════════════════│════════════════════════════════════════════╗  │
│  ║  Layer 2: API 路由層 (~414 端點, 331 route files)                      ║  │
│  ║  ~66,800 LOC | RFC 7807 錯誤格式 | Auth 58% | Zod 64%                ║  │
│  ╠═══════════════════════════│════════════════════════════════════════════╣  │
│  ║   /admin/* (106) | /v1/* (77) | /rules/* (20) | /documents/* (19)     ║  │
│  ║   /companies/* (12) | /reports/* (12) | /auth/* (7) | Others (78)     ║  │
│  ╚═══════════════════════════│════════════════════════════════════════════╝  │
│                               │                                              │
│  ╔═══════════════════════════│════════════════════════════════════════════╗  │
│  ║  Layer 3: 業務服務層 (200 services, 22 分類)                            ║  │
│  ║  ~99,600 LOC | 工廠模式 + 適配器模式 + 策略模式 + 責任鏈               ║  │
│  ╚═══════════════════════════│════════════════════════════════════════════╝  │
│                  ┌────────────┼─────────────┬──────────────┐                 │
│                  ▼            ▼             ▼              ▼                 │
│  ╔══════════════════╗ ╔══════════════╗ ╔══════════════╗ ╔══════════════╗    │
│  ║  Layer 4:        ║ ║  Layer 5:    ║ ║  Layer 7:    ║ ║  Layer 8:    ║    │
│  ║  AI 提取管線     ║ ║  映射引擎    ║ ║  外部整合    ║ ║  i18n 配置   ║    │
│  ║  42 files, 18K   ║ ║  31 files    ║ ║  25+12 files ║ ║  102+13 files║    │
│  ╠══════════════════╣ ╠══════════════╣ ╠══════════════╣ ╠══════════════╣    │
│  ║ extraction-v3/   ║ ║ mapping/     ║ ║ n8n/ (9 svc) ║ ║ messages/    ║    │
│  ║  stages/ (7 svc) ║ ║ transform/   ║ ║ outlook/ (3) ║ ║  en/ zh-TW/  ║    │
│  ║  utils/ (5)      ║ ║ rule-* (12+) ║ ║ sharepoint/  ║ ║  zh-CN/      ║    │
│  ║ unified-proc/    ║ ║ similarity/  ║ ║ python-svc/  ║ ║ src/i18n/    ║    │
│  ║  steps/ (11)     ║ ║ rule-infer/  ║ ║  (2 FastAPI) ║ ║  i18n-*.ts   ║    │
│  ║  adapters/ (7)   ║ ║              ║ ║              ║ ║              ║    │
│  ╚══════════════════╝ ╚══════════════╝ ╚══════════════╝ ╚══════════════╝    │
│                  │            │             │                                 │
│                  └────────────┴─────────────┘                                │
│                               │                                              │
│  ╔═══════════════════════════│════════════════════════════════════════════╗  │
│  ║  Layer 6: 資料存取層 (Prisma ORM 7.2)                                  ║  │
│  ║  122 models | 113 enums | 439 索引 | 73 唯一約束 | PostgreSQL 15       ║  │
│  ╚═══════════════════════════│════════════════════════════════════════════╝  │
│                               │                                              │
│  ╔═══════════════════════════│════════════════════════════════════════════╗  │
│  ║  Layer 9: 基礎設施層 (Docker Compose)                                   ║  │
│  ║  PostgreSQL (5433) | pgAdmin (5050) | Azurite (10010-10012)            ║  │
│  ║  Python Extraction (8000) | Python Mapping (8001) | Next.js (3000)    ║  │
│  ╚════════════════════════════════════════════════════════════════════════╝  │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 資料流概覽

```
┌────────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────┐
│ 文件來源    │ ──→ │ Azure    │ ──→ │ OCR          │ ──→ │ 三階段       │
│ (Upload/   │     │ Blob     │     │ (Azure DI    │     │ AI 提取      │
│  SP/OL/n8n)│     │ Storage  │     │  via Python) │     │ (V3.1)       │
└────────────┘     └──────────┘     └──────────────┘     └──────┬───────┘
                                                                 │
                   ┌──────────────────────────────────────────────┘
                   ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────┐
│ 三層映射      │ ──→ │ 信心度計算    │ ──→ │ 路由決策     │ ──→ │ 審核/批准   │
│ (Universal   │     │ (5-6 維度    │     │ (AUTO/QUICK  │     │ (Review    │
│  → Company   │     │  加權評分)   │     │  /FULL)      │     │  Workflow) │
│  → LLM)      │     └──────────────┘     └──────────────┘     └──────┬─────┘
└──────────────┘                                                       │
                   ┌───────────────────────────────────────────────────┘
                   ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 結果持久化    │ ──→ │ 模板匹配     │ ──→ │ 匯出         │
│ (Extraction  │     │ (Template    │     │ (Excel/PDF)  │
│  Result)     │     │  Instance)   │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
        │
        ▼
┌──────────────────────────────────┐
│ 術語記錄 → 規則建議 → 持續學習    │
│ (Term Aggregation → Rule Suggest │
│  → Auto-Learning Loop)           │
└──────────────────────────────────┘
```

---

## 3. 核心能力矩陣

> 以下按 8 個功能域 (D1-D8) 整理 AIDE 平台的完整能力。所有 22 個 Epic (48+ 功能) 均已完成實現（100% 完成率）。

### 3.1 文件處理與 OCR 能力 (D1) — Epic 1, 8

| 能力 | 實現方式 | 關鍵文件 | 狀態 |
|------|---------|---------|------|
| 手動 PDF/Image 上傳 | FileUploader 組件 + multipart/form-data | `components/features/document/FileUploader.tsx` | ✅ |
| Azure Blob 存儲 | @azure/storage-blob SDK | `src/lib/azure/index.ts` | ✅ |
| OCR 文字提取 | Azure Document Intelligence (Python) | `python-services/extraction/` | ✅ |
| PDF 轉 Base64 | pdf-to-img + pdfjs-dist | `extraction-v3/utils/pdf-converter.ts` | ✅ |
| 文件格式/大小驗證 | Zod Schema + constants | `src/lib/upload/constants.ts` | ✅ |
| 批量文件上傳 | BatchFileUploader 組件 | `components/features/historical-data/` (12 files) | ✅ |
| 元數據自動檢測 | file-detection.service | `src/services/file-detection.service.ts` | ✅ |
| 文件預覽與對比 | react-pdf + DocumentDetail | `components/features/document/detail/` | ✅ |

### 3.2 AI 提取管線能力 (D2) — Epic 6, 9, 12

| 能力 | 實現方式 | 關鍵文件 | 狀態 |
|------|---------|---------|------|
| V3.1 三階段提取 | StageOrchestrator + 3 Stage Services | `extraction-v3/stages/` (7 services) | ✅ |
| 統一處理器框架 | 11 步 + 工廠 + 適配器 | `unified-processor/` (22 files) | ✅ |
| GPT Vision 提取 | OpenAI GPT-5.2 / GPT-5-nano | `gpt-vision.service.ts` (1,199 LOC) | ✅ |
| 動態 Prompt 組裝 | PromptAssemblyService | `prompt-assembly.service.ts` | ✅ |
| 5-6 維度信心度 | ConfidenceV3_1Service | `confidence-v3-1.service.ts` | ✅ |
| Feature Flag 灰度 | fileId hash 確定性灰度 | `src/config/feature-flags.ts` | ✅ |
| V3→V2 錯誤回退 | fallbackToV2OnError | `unified-document-processor.service.ts` | ✅ |
| 參考編號匹配 | ReferenceNumberMatcherService (CHANGE-032) | `stages/reference-number-matcher.service.ts` | ✅ |
| 匯率轉換 | ExchangeRateConverterService (CHANGE-032) | `stages/exchange-rate-converter.service.ts` | ✅ |

### 3.3 三層映射引擎能力 (D3) — Epic 4, 10, 11

| 能力 | 實現方式 | 關鍵文件 | 狀態 |
|------|---------|---------|------|
| Tier 1 通用映射 | MappingRule (companyId=null) | `rule-resolver.ts` (行 283-334) | ✅ |
| Tier 2 公司特定覆蓋 | MappingRule (companyId!=null) | `rule-resolver.ts` (行 183-215) | ✅ |
| Tier 3 LLM 分類 | GPT-5.2 智能分類 | `term-classification.service.ts` | ✅ |
| 配置層級優先級 | FORMAT > COMPANY > GLOBAL | `mapping/config-resolver.ts` | ✅ |
| 5 種轉換策略 | Direct/Concat/Split/Lookup/Custom | `transform/` (7 files) | ✅ |
| 映射快取 | mapping-cache.ts | `mapping/mapping-cache.ts` | ✅ |
| 規則學習閉環 | 3 次修正 → 建議 → 審批 → 正式規則 | `rule-suggestion-generator.service.ts` | ✅ |
| 影響分析 | 三維度影響評估 | `impact-analysis` 相關服務 | ✅ |
| 自動回滾 | 準確率下降 >10% 自動回滾 | `rule-change.service.ts` | ✅ |
| 規則推斷 | keyword/position/regex inferrer | `rule-inference/` (3 files) | ✅ |
| 相似度計算 | Levenshtein + date + numeric | `similarity/` (3 files) | ✅ |

### 3.4 審核工作流能力 (D4) — Epic 2, 3

| 能力 | 實現方式 | 關鍵文件 | 狀態 |
|------|---------|---------|------|
| 審核隊列 | ReviewQueue + ReviewQueueTable | `components/features/review/` | ✅ |
| 詳細對照視圖 | ReviewPanel + PdfViewer | `components/features/review/ReviewPanel/` | ✅ |
| 一鍵確認/修正 | POST /review/[id]/approve, PATCH /correct | `src/app/api/review/[id]/` | ✅ |
| 複雜案例升級 | Escalation model + API | `src/app/api/review/[id]/escalate/` | ✅ |
| 信心度路由 | AUTO/QUICK/FULL 三級路由 | `confidence-v3-1.service.ts` | ✅ |
| 智能降級 | 新公司/新格式強制降級 | `confidence-v3-1.service.ts` (行 527-590) | ✅ |
| 修正歷史追蹤 | Correction + FieldCorrectionHistory | Prisma models | ✅ |

### 3.5 公司與模板管理能力 (D5) — Epic 5, 13, 14

| 能力 | 實現方式 | 關鍵文件 | 狀態 |
|------|---------|---------|------|
| 公司 CRUD + 多類型 | Company model (6 CompanyType) | `company.service.ts` (1,720 LOC) | ✅ |
| 公司名稱變體匹配 | nameVariants + Levenshtein | `company-matcher.service.ts` | ✅ |
| 公司合併追蹤 | mergedIntoId 欄位 | Prisma Company model | ✅ |
| 文件格式管理 | DocumentFormat + FieldDefinitionSet | `document-format.service.ts` | ✅ |
| 模板定義管理 | DataTemplate CRUD | `data-template.service.ts` | ✅ |
| 模板欄位映射 | TemplateFieldMapping | `template-field-mapping.service.ts` | ✅ |
| 模板自動匹配 | TemplateMatchingEngine | `template-matching-engine.service.ts` | ✅ |
| Prompt 配置管理 | PromptConfig (GLOBAL/COMPANY/FORMAT) | `prompt-resolver.service.ts` | ✅ |
| 欄位映射配置 | FieldMappingConfig | `field-definition-set.service.ts` | ✅ |

### 3.6 報表與儀表板能力 (D6) — Epic 15, 16

| 能力 | 實現方式 | 關鍵文件 | 狀態 |
|------|---------|---------|------|
| 處理統計儀表板 | DashboardStatistics + 圖表 | `dashboard-statistics.service.ts` | ✅ |
| 城市成本報表 | CityCostReport | `city-cost-report.service.ts` | ✅ |
| AI 成本追蹤 | ApiUsageLog + ApiPricingConfig | `ai-cost.service.ts` | ✅ |
| 月度報表 | MonthlyCostReport | `monthly-cost-report.service.ts` | ✅ |
| 區域報表 | RegionalReport | `regional-report.service.ts` | ✅ |
| Excel 匯出 | ExcelJS | `template-export.service.ts` | ✅ |

### 3.7 外部整合與批量處理能力 (D7) — Epic 18, 19

| 能力 | 實現方式 | 關鍵文件 | 狀態 |
|------|---------|---------|------|
| SharePoint 自動獲取 | Microsoft Graph API | `sharepoint-document.service.ts` | ✅ |
| Outlook 郵件附件 | Microsoft Graph + 過濾規則 | `outlook-mail.service.ts` | ✅ |
| n8n 雙向 Webhook | 出站事件 + 入站接收 | `n8n/` (9 services, ~5,200 LOC) | ✅ |
| n8n 健康監控 | 5 分鐘定時檢查 | `n8n-health.service.ts` (745 LOC) | ✅ |
| API Key 認證 | SHA-256 雜湊 + 權限控制 | `n8n-api-key.service.ts` | ✅ |
| 批量處理 | p-queue 並發控制 | `batch-processor.service.ts` (1,356 LOC) | ✅ |
| SSE 進度串流 | ReadableStream + 心跳保活 | `/batches/[id]/progress` route | ✅ |
| Python OCR 服務 | FastAPI (port 8000) | `python-services/extraction/` | ✅ |
| Python 映射服務 | FastAPI (port 8001) | `python-services/mapping/` | ✅ |

### 3.8 系統管理與基礎設施能力 (D8) — Epic 7, 17, 20, 21, 22

| 能力 | 實現方式 | 關鍵文件 | 狀態 |
|------|---------|---------|------|
| Azure AD SSO | NextAuth v5 + Microsoft Provider | `src/lib/auth.ts` (404 LOC) | ✅ |
| 本地帳號認證 | Credentials Provider + bcryptjs | `src/lib/auth.config.ts` (292 LOC) | ✅ |
| RBAC 6 角色 | Role model + 細粒度權限 | `role.service.ts`, `permissions.ts` | ✅ |
| 城市/區域數據隔離 | UserCityAccess + UserRegionAccess | Prisma models | ✅ |
| 四層審計日誌 | AuditLog + SecurityLog + StatisticsAuditLog + ApiAuditLog | `audit-log.service.ts` | ✅ |
| 系統健康監控 | HealthCheckService | `health-check.service.ts` | ✅ |
| 告警通知系統 | AlertRule + 評估引擎 | `alert-evaluation.service.ts` | ✅ |
| 備份與還原 | Backup + Restore + 排程 | `backup.service.ts` (1,120 LOC) | ✅ |
| 系統參數配置 | SystemConfig (GLOBAL/REGION/CITY) | `system-config.service.ts` (1,553 LOC) | ✅ |
| 資料保留政策 | DataRetentionPolicy | `data-retention.service.ts` (1,150 LOC) | ✅ |
| 三語言國際化 | next-intl 4.7 (en, zh-TW, zh-CN) | `messages/` (102 JSON) | ✅ |
| 參考編號管理 | ReferenceNumber CRUD | `reference-number.service.ts` | ✅ |
| 匯率管理 | ExchangeRate CRUD + 轉換 | `exchange-rate.service.ts` (1,110 LOC) | ✅ |
| 系統設定中心 | SystemSettingsHub (CHANGE-050) | `/admin/settings/` page | ✅ |

---

## 4. 技術棧實現詳情

### 4.1 Layer 1: 前端展示層

- **框架**: React 18.3 + Next.js 15.0.0 (App Router) + TypeScript 5.0
- **UI 庫**: shadcn/ui (34 primitives) + Tailwind CSS 3.4
- **狀態管理**: Zustand 5.x (2 stores: reviewStore, document-preview-test) + React Query 5.x (~87 hooks)
- **表單**: React Hook Form 7.x + Zod 4.x
- **規模**: 429 組件 + 82 頁面 + 3 layouts, ~118,000 LOC
- **依賴方向**: ← Layer 2 (API) via React Query hooks, ← Layer 8 (i18n), ← Layer 6 (Auth)

**路由結構**:
```
src/app/[locale]/
├── (auth)/                    # 路由組 1 — 置中卡片式布局（無需認證）
│   └── auth/
│       ├── login/             # 登入（Azure AD SSO + 本地帳號）
│       ├── register/          # 註冊
│       ├── forgot-password/   # 忘記密碼
│       ├── reset-password/    # 重設密碼（token 驗證）
│       ├── verify-email/      # 電郵驗證
│       └── error/             # 認證錯誤
└── (dashboard)/               # 路由組 2 — Sidebar + TopBar（需認證）
    ├── dashboard/             # 儀表板首頁
    ├── documents/             # 文件管理（upload, [id], list）
    ├── review/                # 審核（queue, [id]）
    ├── rules/                 # 規則管理（list, new, [id], edit, history, review）
    ├── companies/             # 公司管理（list, new, [id], edit, formats, rules）
    ├── escalations/           # 升級處理（list, [id]）
    ├── reports/               # 報表（monthly, cost, ai-cost, regional）
    ├── admin/                 # 管理模組（22 個子模組）
    │   ├── users/             # 用戶管理
    │   ├── monitoring/        # 系統監控
    │   ├── alerts/            # 告警管理
    │   ├── backup/            # 備份還原
    │   ├── settings/          # 系統設定
    │   ├── prompt-configs/    # Prompt 配置
    │   ├── field-mapping-*/   # 欄位映射
    │   ├── data-templates/    # 模板管理
    │   ├── reference-numbers/ # 參考編號
    │   ├── exchange-rates/    # 匯率管理
    │   ├── historical-data/   # 歷史數據
    │   └── integrations/      # 外部整合（n8n, Outlook, SharePoint）
    └── template-instances/    # 模板實例
```

**組件分佈**:

| 類別 | 數量 | LOC | 說明 |
|------|------|-----|------|
| UI 組件 (`components/ui/`) | 34 | 2,573 | shadcn/ui primitives |
| 功能組件 (`components/features/`) | 358 | 86,086 | 38 子目錄 (306 tsx + 52 ts barrel) |
| 佈局組件 (`components/layout/`) | 5 | 1,136 | DashboardHeader, Sidebar, TopBar |
| 其他頂層 | 32 | 8,457 | dashboard, reports, audit, filters |
| **總計** | **429** | **98,252** | |

**功能組件 Top 10 子目錄**: admin/ (57) | review/ (32) | rules/ (23) | formats/ (18) | historical-data/ (18) | template-instance/ (15) | forwarders/ (13, legacy) | document/ (13) | template-field-mapping/ (12) | prompt-config/ (11)

**Top 5 最大組件文件**: ReferenceNumberImportDialog (785 LOC), RuleEditForm (751), TermAggregationSummary (679), OutlookFilterRulesEditor (671), HealthDashboard (651)

### 4.2 Layer 2: API 路由層

- **規模**: 331 route.ts, ~414 端點, ~66,800 LOC
- **標準**: RFC 7807 錯誤格式, Zod schema 驗證, 標準分頁
- **認證**: `await auth()` 模式 58.0% (192/331), n8nApiMiddleware 4 路由, ApiKeyService 4 路由

**HTTP 方法分佈**: GET 201 (60%) | POST 141 (43%) | PATCH 33 (10%) | DELETE 31 (9%) | PUT 8 (2%)

**API 領域分佈**: `/admin/*` 106 (32%) | `/v1/*` 77 (23%) | `/rules/*` 20 | `/documents/*` 19 | `/companies/*` 12 | `/reports/*` 12 | 其他 85

**特殊 API 類型**: SSE 2 端點 | Webhooks (n8n) | File Upload 7+ 端點 | Batch Operations 3+

### 4.3 Layer 3: 業務邏輯服務層

- **規模**: 200 服務, 22 分類, ~99,600 LOC
- **架構**: 根層級 111 + 子目錄 89 (12 個子目錄)
- **設計模式**: 工廠模式 (4+) | 適配器模式 (8+) | 策略模式 (10+) | 責任鏈 (2) | 快取模式 (6+) | 單例模式 (8+)

**22 個服務分類**: 核心處理 (11) | AI/OCR (10) | 映射與規則 (12) | 公司管理 (6) | 城市區域 (6) | 報表統計 (6) | 審計追蹤 (5) | 審核工作流 (3) | 警報通知 (6) | 備份資料 (5) | 外部整合 (15) | 系統管理 (7) | 用戶權限 (4) | 工具服務 (8) | V3 管線 (20) | 統一處理器 (22) | 欄位映射 (13) | Prompt 管理 (9) | 模板管理 (6) | 參考編號匯率 (3) | 管線配置 (1) | 其他 (4)

**Top 5 最大服務**: company.service.ts (1,720) | system-config.service.ts (1,553) | batch-processor.service.ts (1,356) | extraction-v3.service.ts (1,238) | gpt-vision.service.ts (1,199)

### 4.4 Layer 4: AI 提取管線層

- **規模**: 42 文件, ~18,000 LOC
- **組成**: extraction-v3 (20 files) + unified-processor (22 files)

**V3.1 三階段管線 (7 步)**:
1. FILE_PREPARATION — PDF 轉 Base64
2. STAGE_1_COMPANY_IDENTIFICATION — GPT-5-nano 公司識別
3. STAGE_2_FORMAT_IDENTIFICATION — GPT-5-nano 格式識別
4. STAGE_3_FIELD_EXTRACTION — GPT-5.2 欄位提取
5. TERM_RECORDING — 術語記錄
6. CONFIDENCE_CALCULATION — V3.1 五維度信心度
7. ROUTING_DECISION — 路由決策

**統一處理器 (V2 向後相容, 11 步)**: azure-di-extraction → config-fetching → file-type-detection → issuer-identification → format-matching → smart-routing → gpt-enhanced-extraction → field-mapping → confidence-calculation → term-recording → routing-decision

**V3.1 信心度維度**: STAGE_1_COMPANY (20%) | STAGE_2_FORMAT (15%) | STAGE_3_EXTRACTION (30%) | FIELD_COMPLETENESS (20%) | CONFIG_SOURCE_BONUS (15%)

**特性**: Feature Flag V2/V3 灰度切換 | V3→V2 錯誤回退 | 完整步驟時間追蹤 | 13 個 stage 相關 DB 欄位

### 4.5 Layer 5: 映射與規則引擎層

- **規模**: 31 文件, ~9,800 LOC
- **組成**: mapping/ (7) + transform/ (9) + rule-* (7) + rule-inference/ (4) + similarity/ (4)
- **設計模式**: 策略模式, 責任鏈, 快取模式, 工廠模式

**三層映射架構**:

```
查詢流程:
1. 查詢 Tier 2（Company-Specific, companyId != null）→ 如有匹配，優先使用
2. 查詢 Tier 1（Universal, companyId = null）→ Tier 2 無結果時使用
3. 回退 Tier 3（LLM Classification）→ Tier 1/2 都無匹配時觸發

配置層級優先級 (config-resolver.ts):
  GLOBAL: 1 (最低) → COMPANY: 2 → FORMAT: 3 (最高)
```

| 映射層 | 覆蓋率 | 數據源 | 優先級 |
|--------|--------|--------|--------|
| **Tier 1**: Universal Mapping | 70-80% | `MappingRule (companyId=null)` | 最低 |
| **Tier 2**: Company-Specific | 10-15% | `MappingRule (companyId!=null)` | 中 |
| **Tier 3**: LLM Classification | 5-10% | GPT-5.2 智能分類 | 最高 (回退) |

**轉換策略 (transform/)**:

| 策略 | 說明 | 範例 |
|------|------|------|
| `DIRECT` | 直接映射 | source → target |
| `CONCAT` | 串接多個欄位 | firstName + lastName |
| `SPLIT` | 分割為多值 | address → city + zip |
| `FORMULA` | 公式計算 | weight * rate |
| `LOOKUP` | 查詢表映射 | code → description |
| `AGGREGATE` | 聚合計算 | SUM(lineItems) |

**規則管理服務 (12+)**: rule-resolver | rule-suggestion-generator | rule-testing | rule-change | rule-accuracy | rule-metrics | rule-simulation | impact-analysis | pattern-analysis | correction-recording

**規則推斷 (`rule-inference/`)**: keyword-inferrer | position-inferrer | regex-inferrer

**相似度計算 (`similarity/`)**: Levenshtein 距離 | date-similarity | numeric-similarity

### 4.6 Layer 6: 資料存取層

- **ORM**: Prisma 7.2 + @prisma/adapter-pg
- **規模**: 122 models, 113 enums, 4,354 LOC schema, 439 索引, 73 唯一約束, 10 遷移
- **使用特性**: 關聯映射 | JSON 欄位 | `$transaction` | Enum | `_count` | 複雜 OR/insensitive 過濾 | 級聯刪除

**模型領域分佈**:

| 領域 | Model 數量 | 代表模型 |
|------|-----------|---------|
| 用戶與權限 | 8 | User, Account, Session, Role, UserRole, UserCityAccess |
| 文件處理 | 7 | Document, OcrResult, ExtractionResult, ProcessingQueue |
| 映射與規則 | 12 | MappingRule, RuleSuggestion, RuleVersion, FieldMappingConfig |
| 審核工作流 | 5 | ReviewRecord, Correction, FieldCorrectionHistory, Escalation |
| 公司管理 | 3 | Company, Forwarder (deprecated), ForwarderIdentification |
| 審計與安全 | 5 | AuditLog, SecurityLog, DataChangeHistory |
| 效能監控 | 11 | ServiceHealthCheck, ApiPerformanceMetric |
| 備份與還原 | 7 | Backup, BackupSchedule, RestoreRecord |
| n8n + 工作流 | 9 | N8nApiKey, WorkflowDefinition, WorkflowExecution |
| Prompt/模板/參考 | 8 | PromptConfig, DataTemplate, ReferenceNumber, ExchangeRate |
| 其他 (報表/告警/日誌等) | 47 | ReportJob, AlertRule, SystemLog, HistoricalBatch |

**ID 策略**:

| 策略 | 數量 | 佔比 | 說明 |
|------|------|------|------|
| `@default(uuid())` | 47 | 38.5% | 新建模型標準 |
| `@default(cuid())` | 74 | 60.7% | 早期模型，逐步遷移中 |
| 其他 | 1 | 0.8% | 特殊情況 |

**最大 Models 關聯**: User ~60 關聯（最複雜）| Document ~24 關聯 | MappingRule 多個關聯

**索引策略**: 439 個 `@@index` 定義，73 個唯一約束（30 複合 + 43 欄位級），確保查詢效能

### 4.7 Layer 7: 外部服務整合層

- **Node.js 整合**: 25+ 文件, ~10,300 LOC — n8n (9 services, ~5,200 LOC) + Outlook (4) + SharePoint (2) + Webhook (3)
- **Python 微服務**: 12 文件, 2,719 LOC — Extraction Service (port 8000) + Mapping Service (port 8001)

**外部服務依賴**: Azure Document Intelligence (OCR) | Azure OpenAI (GPT-5.2/nano) | Azure Blob Storage | Microsoft Graph (Outlook/SharePoint) | n8n (工作流) | Upstash Redis (快取/限速) | Nodemailer (郵件)

**Python API 端點**: Extraction — `GET /health`, `POST /extract/url`, `POST /extract/file` | Mapping — `GET /health`, `GET /forwarders`, `POST /identify`, `POST /map-fields`

### 4.8 Layer 8: i18n 與配置層

- **框架**: next-intl 4.7
- **規模**: 102 JSON (34 namespace x 3 languages) + 3 config + 5 utility + 5 hooks, ~21,000 LOC (含 JSON)

**34 命名空間**: admin, auth, common, companies, confidence, dashboard, dataTemplates, dialogs, documentPreview, documents, errors, escalation, exchangeRate, fieldDefinitionSet, fieldMappingConfig, formats, global, historicalData, navigation, pipelineConfig, profile, promptConfig, referenceNumber, region, reports, review, rules, standardFields, systemSettings, templateFieldMapping, templateInstance, templateMatchingTest, termAnalysis, validation

**i18n 工具鏈**: i18n-date.ts | i18n-number.ts | i18n-currency.ts | i18n-zod.ts | i18n-api-error.ts + 5 個 hooks (use-locale-preference, use-localized-date, use-localized-format, use-localized-zod, use-localized-toast)

### 4.9 Layer 9: 基礎設施層

**Docker Compose 服務**: PostgreSQL 15 (port 5433) | pgAdmin (port 5050) | Azurite Blob (10010), Queue (10011), Table (10012) | Python Extraction (8000) | Python Mapping (8001)

**開發工具**: ESLint + Prettier | TypeScript 5.0 | Playwright 1.57 (已安裝，未配置) | npm

**缺失項**: Node.js Dockerfile | Kubernetes 配置 | CI/CD pipeline | Prometheus/Grafana

---

## 5. 關鍵設計決策

> 以下 7 個設計決策涵蓋核心架構（決策 1-4）、基礎設施（決策 5-7），均經代碼追蹤驗證。完整版含 11 個決策（另含認證授權、n8n 工作流、審計日誌），詳見 TASK4-DESIGN-DECISIONS.md。

### 5.1 三層映射系統

| 維度 | 說明 |
|------|------|
| **問題** | 45+ Forwarder x 100+ 格式 x ~90 Header = 潛在 9,000+ 條規則，維護成本不可承受 |
| **選擇** | 分層映射: Tier 1 (Universal, 70-80%) → Tier 2 (Company-Specific Override, 10-15%) → Tier 3 (LLM Classification, 5-10%) |
| **替代方案** | 單層映射（無法應對差異化）/ 完全個性化（維護 O(n)）/ 純 AI（成本過高） |
| **理由** | 規則從 9,000 精簡至 ~800（↓90%），新 Forwarder 只需添加差異規則，支持持續學習 |
| **取捨** | 好處: 維護成本↓90%, 知識共享 | 代價: 三層優先級邏輯, Tier 3 LLM 成本, 規則衝突排查 |
| **代碼證據** | `rule-resolver.ts`, `mapping/config-resolver.ts` (SCOPE_PRIORITY), `mapping/` 7 files |

### 5.2 V3.1 三階段提取管線

| 維度 | 說明 |
|------|------|
| **問題** | V3 單次 GPT 調用 ~$0.01/份, prompt 過長影響準確度 |
| **選擇** | 三階段分離: Stage 1 公司識別(nano $0.0004) → Stage 2 格式識別(nano $0.0005) → Stage 3 欄位提取(GPT-5.2 $0.0027), 總計 ~$0.0036 (↓86%) |
| **替代方案** | 保持 V3 單次（成本高）/ 三次都用 5.2（經濟差）/ 三次都用 nano（準確率不足） |
| **理由** | 任務分解 + 模型分級，每階段可獨立優化 prompt 和模型 |
| **取捨** | 好處: 成本↓86%, 獨立優化 | 代價: 三次 API 延遲, 系統複雜度, 13 個 stage DB 欄位 |
| **代碼證據** | `stages/stage-orchestrator.service.ts`, `stages/stage-{1,2,3}-*.service.ts`, `confidence-v3-1.service.ts` |

### 5.3 信心度路由機制

| 維度 | 說明 |
|------|------|
| **問題** | 45-50 萬張/年, 自動化率 90%+ 目標, 需精準路由避免漏審和過審 |
| **選擇** | 5 維度加權信心度 (STAGE_1:20%, STAGE_2:15%, STAGE_3:30%, COMPLETENESS:20%, CONFIG:15%) + 配置來源加成 + 智能降級 |
| **替代方案** | 單一維度（不全面）/ 固定規則（無自適應）/ 純 LLM（不可控） |
| **理由** | 多維度反映提取質量, ConfigSourceBonus 避免虛假高分, 智能降級防範新場景風險 |
| **取捨** | 好處: 精準路由, 審計追蹤 | 代價: 5 個權重需調優, 可能過度保守 |
| **代碼證據** | `confidence-v3-1.service.ts` (全文), `extraction-v3.types.ts` (行 1257-1304) |

### 5.4 統一處理器 + V3 雙軌架構

| 維度 | 說明 |
|------|------|
| **問題** | V2 (11 步) 和 V3 (7 步) 並存, 需零停機過渡 |
| **選擇** | UnifiedDocumentProcessor 統一入口 + Feature Flag 灰度 + 工廠模式動態步驟 + 適配器 V3→V2 + 錯誤回退 |
| **替代方案** | 一次性切換（風險高）/ 並行兩套（成本倍增）/ 修改 V2（代碼混雜） |
| **理由** | 統一入口 + 灰度發佈是大規模系統過渡的最佳實踐 |
| **取捨** | 好處: 零停機升級, 精細流量控制 | 代價: V2/V3 雙套維護, 適配器邏輯, 回退可能隱藏問題 |
| **代碼證據** | `unified-document-processor.service.ts`, `factory/step-factory.ts`, `adapters/` (7), `feature-flags.ts` |

### 5.5 Forwarder → Company 重構

| 維度 | 說明 |
|------|------|
| **問題** | Forwarder 模型語義窄, 無法支援多公司類型（出口商/承運人/報關行） |
| **選擇** | 重構為 Company 模型, 新增 CompanyType (6 types), CompanySource, nameVariants, mergedIntoId |
| **替代方案** | Forwarder + 子類型（多對多複雜）/ 單表繼承（語義不清）/ 組合模式（過度設計） |
| **理由** | 直接重命名最清晰, 新增欄位完整覆蓋業務需求 |
| **取捨** | 好處: 語義準確, 名稱變體匹配, 合併追蹤 | 代價: 全系統重構, ~800+ 遺留引用 |
| **代碼證據** | `prisma/schema.prisma` (行 401-512), `company.service.ts` (1,720 LOC) |

### 5.6 技術棧選擇

| 決策 | 選擇 | 規模 | 選擇理由 |
|------|------|------|---------|
| 路由 | Next.js 15 App Router + `[locale]` | 82 page.tsx, 5 層深度 | Server/Client 混合, i18n 原生整合 |
| ORM | Prisma 7.2 | 122 models, 113 enums | 類型安全, 關聯映射, $transaction |
| 狀態 | Zustand + React Query | 2 stores, ~87 hooks | UI/Server 狀態分離, 最小化 |
| i18n | next-intl 4.7 | 3 語言 x 34 NS | Server/Client 混合翻譯, Zod 整合 |
| UI | shadcn/ui + Radix | 34 組件 | 高度自訂, 最小包大小, ARIA 支援 |

### 5.7 Python 微服務分離

| 維度 | 說明 |
|------|------|
| **問題** | OCR 和映射用 Python 還是 Node.js? 雙語言增加運維複雜度 |
| **選擇** | Node.js (業務邏輯/API/前端) + Python FastAPI (OCR/映射), HTTP REST 通信, Docker Compose 編排 |
| **替代方案** | 全 Node.js（Azure SDK 功能滯後）/ 全 Python（失去 Next.js 優勢）/ 第三方 SaaS（無 Azure DI 高級特性） |
| **理由** | Python Azure AI SDK 更成熟, 數據密集型處理生態更完善 |
| **取捨** | 好處: Azure SDK 最優, 可獨立部署擴展 | 代價: 雙技術棧維護, HTTP 通信延遲 |
| **代碼證據** | `python-services/extraction/` (port 8000), `python-services/mapping/` (port 8001), `docker-compose.yml` |

### 5.8 企業級認證與授權架構（附錄決策）

> 完整分析見 TASK4-DESIGN-DECISIONS.md 決策 9。

| 維度 | 說明 |
|------|------|
| **問題** | 多城市、多角色企業平台需安全認證 + 細粒度授權，同時支援 Azure AD SSO 和本地帳號 |
| **選擇** | NextAuth v5 雙配置架構 + RBAC 6 角色 + 城市/區域級數據隔離 |
| **核心架構** | `auth.config.ts` (292 LOC, Edge Runtime) + `auth.ts` (404 LOC, 完整配置含 DB) |

**6 個預定義角色**: Data Processor (預設) | City Manager | Regional Manager | Super User | System Admin | Auditor

**細粒度權限**: `INVOICE_{VIEW,CREATE,REVIEW,APPROVE}` | `RULE_{VIEW,MANAGE,APPROVE}` | `USER_{VIEW,MANAGE}` | `SYSTEM_{CONFIG,MONITOR}` | `AUDIT_{VIEW,EXPORT}`

**數據隔離**: UserCityAccess (城市級) + UserRegionAccess (區域級), JWT Session 擴展包含 `cityCodes[]`, `regionCodes[]`, `isGlobalAdmin`

### 5.9 n8n 工作流引擎整合（附錄決策）

> 完整分析見 TASK4-DESIGN-DECISIONS.md 決策 10。

| 維度 | 說明 |
|------|------|
| **問題** | 業務人員需自行調整處理邏輯，無需開發團隊介入 |
| **選擇** | n8n 外部工作流引擎 + 雙向 Webhook + API Key 認證 + 城市級隔離 |
| **規模** | 9 服務, ~5,200 LOC, 6 個 Prisma models |

**雙向通訊**: 入站 (n8n → AIDE): `workflow.{started,completed,failed,progress}`, `document.status_changed` | 出站 (AIDE → n8n): `DOCUMENT_{RECEIVED,COMPLETED,REVIEW_NEEDED}`, `WORKFLOW_FAILED`

**Webhook 重試**: 3 次重試 (1s → 5s → 30s), 應用重啟自動恢復待重試事件

### 5.10 多維度審計日誌系統（附錄決策）

> 完整分析見 TASK4-DESIGN-DECISIONS.md 決策 11。

| 維度 | 說明 |
|------|------|
| **問題** | 45 萬張敏感財務發票/年需完整操作追蹤和合規審計 |
| **選擇** | 四層審計: AuditLog (操作) + SecurityLog (安全) + StatisticsAuditLog (統計) + ApiAuditLog (API) |
| **寫入策略** | 敏感操作同步寫入 + 非敏感操作批次寫入 (100 條/1 秒刷新) |
| **合規** | 7 年保留 + PostgreSQL 觸發器防篡改 + SHA-256 報告簽章 + 4 種報告格式 |

---

## 6. 代碼品質與安全現狀

### 6.1 安全覆蓋率

**整體安全評分: 5.5/10**（三次驗證下修）

#### Auth 認證覆蓋率

| 領域 | 總文件數 | 有認證 | 覆蓋率 | 風險 |
|------|----------|--------|--------|------|
| `/rules/*` | 20 | 20 | **100%** | 🟢 |
| `/audit/*` | 7 | 7 | **100%** | 🟢 |
| `/review/*` | 5 | 5 | **100%** | 🟢 |
| `/workflows/*` | 5 | 5 | **100%** | 🟢 |
| `/companies/*` | 12 | 11 | 91.7% | 🟢 |
| `/admin/*` | 106 | 96 | 90.6% | 🟡 |
| `/documents/*` | 19 | 15+4 ApiKey | 100% | 🟢 |
| `/reports/*` | 12 | 4 | **33.3%** | 🔴 |
| `/v1/*` | 77 | 3 | **3.9%** | 🔴 |
| `/cost/*` | 5 | 0 | **0%** | 🔴 |
| `/dashboard/*` | 5 | 0 | **0%** | 🔴 |
| `/n8n/*` | 4 | 0+4 n8nApi | 100% (API Key) | 🟢 |
| **總計** | **331** | **191** | **57.7%** | — |

> **關鍵發現**: `src/middleware.ts` 第 90-98 行明確跳過所有 `/api` 路由。API 層完全依賴各 route.ts 內部的 `await auth()` 調用，無全局保護。

#### Zod 驗證覆蓋率

| 指標 | 數量 |
|------|------|
| 寫入路由總數 | 192 |
| 有 Zod 驗證 | 119 (62%) |
| 缺失驗證 | 73 (38%) |
| 內聯定義 | 85 (71%) |
| 共享 Schema | 28 (24%) |
| 現有 Schema 文件 | 9 個 (`src/lib/validations/`) |

### 6.2 代碼品質指標

| 指標 | 數量 | 嚴重度 | 詳情 |
|------|------|--------|------|
| `console.log` | **287** (94 files) | 🔴 | Top: gpt-vision(25), example-generator(22), batch-processor(21) |
| `console.warn/error` | 674 (429 files) | 🟡 | 部分可保留（錯誤處理） |
| `any` 類型 | **21** (15 files) | 🟡 | 6 Prisma Where + 3 DTO + 5 SDK + 4 next-intl + 3 其他 |
| TODO/FIXME | **45** (30+ files) | 🟡 | 3 P0(V3.1核心) + 13 P1(Azure Blob/Email) + 19 P2 + 10 P3 |
| Files >1000 LOC | **16** | 🟡 | Top: types(1,738), company(1,720), config(1,553) |
| Raw SQL | 15 (9 files) | 🟡 | 含 2 處 `$executeRawUnsafe` |

**正面發現**:

| 發現 | 數據 |
|------|------|
| ✅ 0 硬編碼密碼/密鑰 | 全 `src/` 掃描確認 |
| ✅ 0 XSS 漏洞 | 無 `dangerouslySetInnerHTML` |
| ✅ 100% JSDoc 合規率 | 200/200 服務文件有標準頭部 |
| ✅ RFC 7807 錯誤格式一致 | 所有 API 路由使用統一格式 |
| ✅ 所有 import 使用 `@/` alias | 無相對路徑混亂 |
| ✅ 99.4% 類型安全 | 僅 21 處 any (3,400+ 類型聲明) |
| ✅ i18n 完整覆蓋 | 34 命名空間 x 3 語言同步 |

### 6.3 測試覆蓋差距

**現有測試盤點**:

| 測試類型 | 文件數 | 狀態 |
|----------|--------|------|
| 單元測試 | 1 | `batch-processor-parallel.test.ts` |
| 整合測試 | 0 | `.gitkeep` 佔位 |
| E2E 測試 | 0 | `.gitkeep` 佔位 |
| **覆蓋率** | **~0%** | **最大風險項** |

**測試基礎設施狀態**:

| 項目 | 狀態 | 說明 |
|------|------|------|
| 測試框架 (Jest/Vitest) | ❌ 未配置 | package.json 無 test script |
| 覆蓋率工具 | ❌ 無 | 無 coverage 報告 |
| Playwright config | ❌ 不存在 | 套件已安裝 (1.57)，未配置 |
| Mock 工具 | ❌ 未配置 | 無 jest-mock-extended 等 |
| 測試 Fixtures | ❌ 無 | 無 fixtures/seeds |

**最需要測試的前 10 個核心服務**:

| # | 服務 | 關鍵性 | 測試類型 | 預估時間 |
|---|------|--------|---------|---------|
| 1 | `extraction-v3.service.ts` | 🔴 關鍵 | 單元 + 整合 | 3 天 |
| 2 | `stage-3-extraction.service.ts` | 🔴 關鍵 | 單元 + 整合 | 2 天 |
| 3 | `mapping/*.service.ts` (映射家族) | 🔴 關鍵 | 單元 + 整合 | 2.5 天 |
| 4 | `confidence-v3-1.service.ts` | 🔴 關鍵 | 單元 | 1.5 天 |
| 5 | `batch-processor.service.ts` | 🟠 重要 | 整合 | 2 天 |
| 6 | `company.service.ts` | 🟠 重要 | 單元 + 整合 | 2 天 |
| 7 | `rule-*.service.ts` (規則家族) | 🟠 重要 | 單元 + 整合 | 2.5 天 |
| 8 | `gpt-vision.service.ts` | 🟠 重要 | 單元 + Mock | 1.5 天 |
| 9 | `document.service.ts` | 🟠 重要 | 單元 + 整合 | 1.5 天 |
| 10 | `auth.config.ts` + `auth.ts` | 🟠 重要 | 單元 + 整合 | 1.5 天 |

**覆蓋差距分析（按業務重要性）**:

| 優先級 | 模組 | 當前覆蓋 | 建議類型 | 預估工作量 |
|--------|------|---------|---------|-----------|
| **P0** | 提取管線 (extraction-v3) | ❌ 0% | 單元 + 整合 | 5 天 |
| **P0** | 映射系統 (mapping) | ❌ 0% | 單元 + 整合 | 4 天 |
| **P0** | 信心度計算 (confidence) | ❌ 0% | 單元 | 2 天 |
| **P1** | 認證/授權 (auth) | ❌ 0% | 單元 + 整合 | 3 天 |
| **P1** | 文件處理 (document) | ❌ 0% | 整合 + E2E | 3 天 |
| **P2** | API 路由 (331 routes) | ❌ 0% | 整合 sampler | 4 天 |

---

## 7. 總結與展望

### 7.1 平台實現成熟度

| 功能域 | 成熟度 | 強項 | 待改善 |
|--------|--------|------|--------|
| **D1 文件處理與 OCR** | 8.5/10 | 多來源支援, Azure DI 整合完善 | Azure Blob 7 個 TODO 待實現 |
| **D2 AI 提取管線** | 9/10 | V3.1 三階段成本↓86%, Feature Flag 灰度 | 3 個 P0 TODO (Stage 3 核心) |
| **D3 三層映射引擎** | 9/10 | 規則↓90%, 持續學習閉環 | 測試覆蓋 0% |
| **D4 審核工作流** | 8.5/10 | 智能降級, 完整修正歷史 | 測試覆蓋 0% |
| **D5 公司與模板管理** | 8/10 | Company 重構完成, 模板匹配 | ~800 遺留 Forwarder 引用 |
| **D6 報表與儀表板** | 7.5/10 | 多維度報表, Excel 匯出 | 自助分析功能不足 |
| **D7 外部整合** | 8.5/10 | n8n 完整整合 (~5.2K LOC), 雙向 Webhook | Email 通知 2 個 TODO |
| **D8 系統管理** | 7/10 | 四層審計, RBAC, i18n 完整 | Auth 58%, 測試 0%, 無 CI/CD |

**總體評分: 8.2/10** — 功能完整度高，架構清晰，主要瓶頸在安全覆蓋率和測試覆蓋率。

**設計模式使用統計**:

| 設計模式 | 使用層級 | 數量 | 典型場景 |
|----------|----------|------|---------|
| **工廠模式** | L4, L5 | 4+ | step-factory, prompt-resolver, transform-executor |
| **適配器模式** | L4, L7 | 8+ | unified-processor adapters, external service wrappers |
| **策略模式** | L5, L8 | 10+ | mapping tiers, transform strategies, formatters |
| **責任鏈** | L4 | 2 | stage pipeline, tier resolution |
| **快取模式** | L5, L6, L8 | 6+ | mapping-cache, prompt-cache, Redis |
| **單例模式** | L3, L6 | 8+ | service exports, Prisma client |

**項目成熟度指標**:

| 指標 | 評分 | 備註 |
|------|------|------|
| 架構清晰度 | 9/10 | 9 層清晰分離，模式一致 |
| 代碼組織 | 8/10 | 目錄結構良好，部分文件過大 |
| 型態安全 | 8.5/10 | 完整 TypeScript，21 處 any |
| 文檔完整性 | 8/10 | CLAUDE.md 詳盡，API 文檔齊全 |
| 測試覆蓋 | 1/10 | 幾乎無測試，最大風險 |
| 國際化 | 9/10 | 3 語言完整支援，34 NS 同步 |
| 外部整合 | 8.5/10 | 5+ 服務整合完善 |
| 安全基礎 | 5.5/10 | Auth 58%，需大幅加固 |

### 7.2 後續規劃重點

| 優先級 | 建議 | 工作量 | 目標成果 |
|--------|------|--------|---------|
| **P0** | 安全加固 | 8-10 天 | Auth 95%+ / Zod 95%+ / 消除安全敏感 log |
| **P1** | 代碼品質提升 | 13-27 天 | 清理 287 console.log / 修復 21 any / 拆分大檔案 |
| **P1** | 測試策略 | 24+ 天 | 70%+ 覆蓋率 / P0 核心 90%+ |
| **P2** | 架構優化 | 36-42 天 | 統一 V2/V3 管線 / 消除代碼重複 |
| **P2** | 生產就緒 | 24-30 天 | K8s / CI/CD / Prometheus 監控 |
| **P1-P2** | 功能擴展 | 12-16 週 | 插拔式文件處理框架 / 多語言 OCR |

**總工作量**: ~105-117 天（約 21-23 週），建議分 3-4 個季度逐步實施。

**修復路線圖 — 本週 P0 立即修復**:

| # | 動作 | 來源 | 工作量 |
|---|------|------|--------|
| 1 | 清理 `auth.config.ts` 9 個安全 log | TASK5 審計 3 | 0.5 天 |
| 2 | `/v1/*` 74 路由添加 session auth 或 API Key | TASK5 審計 1 | 3 天 |
| 3 | `/cost/*` `/dashboard/*` 全部添加 auth | TASK5 審計 1 | 1 天 |
| 4 | `/admin/*` 10 個缺失 auth 路由修復 | TASK5 審計 1 | 1 天 |

**修復路線圖 — 本月 P1 短期改進**:

| # | 動作 | 來源 | 工作量 |
|---|------|------|--------|
| 5 | `/reports/*` `/workflow-executions/*` `/statistics/*` 添加 auth | TASK5 | 2 天 |
| 6 | 清理 Top 10 文件 console.log (~140 處) | TASK5 | 1 天 |
| 7 | 修復 9 個 Prisma Where + DTO `any` 類型 | TASK5 | 1 天 |
| 8 | 配置 Vitest + 基礎測試框架 | TASK5 | 1.5 天 |
| 9 | extraction-v3 核心單元測試 | TASK5 | 5 天 |
| 10 | 拆分 Top 3 大文件 | TASK5 | 3 天 |

### 7.3 架構演進方向

```
Q1                       Q2                       Q3                       Q4
──────────────────────  ──────────────────────  ──────────────────────  ──────────────
[P0 安全加固         ]
  ├ 立即修復             ├ 系統性覆蓋              ├ 持續監控 ───────────→
[P1 測試策略         ]
  ├ Phase 0: 框架        ├ Phase 1-2: 核心測試     ├ Phase 3: E2E        ├ Phase 4
[P1 代碼品質         ]
                         ├ 高優先清理 + 重構       ├ 技術債務清理 ───────→
[P2 生產就緒         ]
  ├ 容器化 + K8s         ├ CI/CD + 監控 ──────────→
[P2 架構優化         ]
                         ├ Phase 1: 信心度統一     ├ Phase 2: 管線重構   ├ Phase 3
[P1 功能擴展框架     ]
  ├ 框架設計             ├ Packing List 試點       ├ 多語言 OCR          ├ SAP 試點
```

**關鍵依賴**:
- 架構優化 (P2) 依賴 CI/CD + 測試覆蓋（需要監控和測試支撐灰度遷移）
- 功能擴展依賴架構統一（統一管線後才能建插拔框架）
- 安全加固 / 代碼品質 / 測試策略互相獨立，可完全並行

**長期架構演進方向**:

| 方向 | 短期 (6-12 月) | 長期 (12-24 月) |
|------|---------------|----------------|
| 跨文件類型 | Packing List, Bill of Lading | Shipping Certificate, Insurance Doc |
| 多語言 OCR | 繁中/簡中/日文/韓文 | 泰文/越南文/馬來文 |
| ERP 整合 | SAP (Ariba) API 試點 | Oracle Procurement Cloud |
| LLM 策略 | 模型分級 (nano/5.2) | 評估本地部署 (Llama/Mistral) |
| 擴展性 | 當前 ~100K 文件/月 | 目標 ~1M 文件/月（微服務+快取） |

---

## 附錄 A: 代碼庫規模快速參考

| 指標 | 數量 | 說明 |
|------|------|------|
| **Total TS/TSX files** | 1,363 | `src/` 目錄 |
| **Total TypeScript LOC** | ~375,270 | 所有 .ts/.tsx |
| **Python LOC** | 2,719 | 12 files (extraction + mapping) |
| **Prisma Schema** | 4,354 lines | 122 models, 113 enums |
| **i18n JSON** | 102 files | 34 NS x 3 languages |
| **Package Dependencies** | 77 prod + 20 dev | package.json |

**按目錄分類**:

| 目錄 | 文件數 | LOC | 說明 |
|------|--------|-----|------|
| `src/services/` | 200 | 99,635 | 核心業務邏輯 |
| `src/components/` | 429 | 98,252 | React 組件 |
| `src/app/api/` | 331 | 66,787 | API 路由 |
| `src/types/` | 93 | 38,749 | TypeScript 類型 |
| `src/hooks/` | 104 | 28,528 | 自定義 Hooks |
| `src/app/[locale]/` | 104 | 19,992 | 頁面文件 |
| `messages/` | 102 | 18,765 | i18n 翻譯 |
| `src/lib/` | 68 | 15,955 | 工具庫 |
| `prisma/` | 1 | 4,354 | Schema |
| `python-services/` | 12 | 2,719 | Python 微服務 |

**API 方法分佈**:

| HTTP 方法 | 文件數 | 佔比 |
|-----------|--------|------|
| GET | 201 | 60.7% |
| POST | 141 | 42.6% |
| PATCH | 33 | 10% |
| DELETE | 31 | 9% |
| PUT | 8 | 2% |
| 估計總端點 | ~414 | avg 1.25/file |

## 附錄 B: 全部 22 個 Epic 完成狀態

| Epic | 名稱 | 功能數 | 狀態 | 功能域 |
|------|------|--------|------|--------|
| 0 | Historical Data & Batch Processing | 4 | ✅ | D1 |
| 1 | User Management & Auth | 2 | ✅ | D8 |
| 2 | Document Upload & AI Processing | 4 | ✅ | D4 |
| 3 | Review Workflow | 3 | ✅ | D4 |
| 4 | Mapping Rules & Auto-Learning | 4 | ✅ | D3 |
| 5 | Company/Forwarder Management | 1 | ✅ | D5 |
| 6 | City & Regional Management | 2 | ✅ | D8 |
| 7 | Reports & Analytics | 2 | ✅ | D6 |
| 8 | Audit & Compliance | 1 | ✅ | D1 |
| 9 | External Integrations | 2 | ✅ | D7 |
| 10 | n8n Workflow Integration | 1 | ✅ | D3 |
| 11 | API Documentation & Webhooks | 2 | ✅ | D3 |
| 12 | System Administration | 6 | ✅ | D8 |
| 13 | Document Preview & Field Mapping | 2 | ✅ | D5 |
| 14 | Prompt Configuration | 1 | ✅ | D5 |
| 15 | Extraction V3 Pipeline | 1 | ✅ | D2 |
| 16 | Document Format Management | 1 | ✅ | D6 |
| 17 | Internationalization | 1 | ✅ | D8 |
| 18 | Local Account Auth | 1 | ✅ | D8 |
| 19 | Template System | 4 | ✅ | D7 |
| 20 | Reference Numbers & Regions | 2 | ✅ | D8 |
| 21 | Exchange Rate Management | 1 | ✅ | D8 |
| 22 | System Settings Hub | 1 | ✅ | D8 |

**Phase 2 變更統計**:
- **52 個 CHANGE** (CHANGE-001 ~ CHANGE-052): 功能變更與增強
- **48 個 FIX** (FIX-001 ~ FIX-048): Bug 修復

## 附錄 C: 外部套件依賴清單

### 核心框架

| 套件 | 版本 | 用途 |
|------|------|------|
| next | 15.0.0 | 全端框架 (App Router) |
| react / react-dom | 18.3 | UI 庫 |
| typescript | 5.0 | 類型系統 |
| @prisma/client | 7.2 | ORM |
| tailwindcss | 3.4 | CSS 框架 |
| next-intl | 4.7.0 | 國際化 |
| zustand | 5.x | UI 狀態管理 |
| @tanstack/react-query | 5.x | Server 狀態管理 |
| react-hook-form | 7.x | 表單管理 |
| zod | 4.x | 驗證 |

### Azure / Microsoft

| 套件 | 版本 | 用途 |
|------|------|------|
| @azure/storage-blob | 12.29 | Blob 存儲 |
| @azure/identity | 4.13 | Azure 認證 |
| openai | 6.15 | GPT-5.2 / nano |
| @microsoft/microsoft-graph-client | 3.0 | SharePoint / Outlook |

### PDF / 文件處理

| 套件 | 版本 | 用途 |
|------|------|------|
| react-pdf | 9.2.1 | PDF 渲染 |
| pdfjs-dist | 4.10.38 | PDF 解析 |
| pdf-parse | 1.1.1 | 文本提取 |
| pdf-to-img | 5.0.0 | PDF 轉圖片 |
| pdfkit | 0.17.2 | PDF 生成 |
| exceljs | 4.4.0 | Excel 報表 |

### 其他

| 套件 | 版本 | 用途 |
|------|------|------|
| next-auth | 5.x | 認證 |
| @upstash/redis | 1.35.8 | 快取/限速 |
| @dnd-kit/core | 6.3 | 拖放 UI |
| nodemailer | 7.0.12 | 電郵通知 |

---

## 更新歷史

| 版本 | 日期 | 作者 | 變更說明 |
|------|------|------|---------|
| 1.0 | 2026-02-27 | Agent Team | 初版：基於多輪 Agent 並行分析 + 三次交叉驗證 |

**數據來源與驗證記錄**:
- `ANALYSIS-RAW-DATA.md` — 基礎統計數據（三次驗證，修正 10 項錯誤）
- `BATCH1-ARCH-LAYERS.md` — 九層架構分析（二次驗證，修正 14 項錯誤）
- `BATCH1-FEATURE-MAPPING.md` — 功能-代碼映射（三次驗證，修正 19 項錯誤）
- `TASK3-E2E-FLOW-TRACING.md` — 端到端流程追蹤（四輪驗證）
- `TASK4-DESIGN-DECISIONS.md` — 設計決策分析（三輪驗證，修正 20 處）
- `TASK5-SECURITY-QUALITY.md` — 安全與品質審計（三次驗證，重大修正）
- `TASK6-RECOMMENDATIONS.md` — 架構演進建議（交叉驗證補充 22 項遺漏）
