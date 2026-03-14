# Task 6: 架構演進建議

> **分析日期**: 2026-02-27
> **方法**: 2 個 Explore Agent 並行分析（建議 1-3 + 建議 4-6）
> **輸入數據**: TASK3-E2E-FLOW-TRACING.md, TASK4-DESIGN-DECISIONS.md, TASK5-SECURITY-QUALITY.md, ANALYSIS-RAW-DATA.md, BATCH1-ARCH-LAYERS.md, BATCH1-FEATURE-MAPPING.md + 直接代碼探索
> **用途**: 最終報告中 **架構演進建議** 和 **技術債務** 章節的數據來源

---

## 建議總覽

| 建議 | 優先級 | 工作量 | 目標成果 | 責任 |
|------|--------|--------|---------|------|
| **1. 安全加固** | P0 | 8 天 | Auth 95%+ / Zod 95%+ / 消除安全敏感 log | Security + Backend Lead |
| **2. 代碼品質提升** | P1 | 13 天 | 清理 287 console.log / 修復 18 any / 拆分 5 大檔案 | Code Quality Lead |
| **3. 測試策略** | P1 | 24 天 | 70%+ 覆蓋率 / P0 核心 90%+ / API sampler | QA + Backend Lead |
| **4. 架構優化** | P2 | 36-42 天 | 統一 V2/V3 管線 / 消除代碼重複 | Backend Lead + Architect |
| **5. 生產就緒** | P2 | 24-30 天 | K8s 部署 / CI/CD / Prometheus 監控 | DevOps + Backend Lead |
| **6. 功能擴展** | P1(框架) P2(應用) | 12-16 週(短期) | 插拔式文件處理框架 / 多語言 OCR / ERP 整合 | Architect + 全棧團隊 |

**總工作量估算**: ~105-117 天（約 21-23 週），建議分 3-4 個季度逐步實施

---

## 實施路線圖

```
Q1 2025                  Q2 2025                  Q3 2025                  Q4 2025
─────────────────────── ─────────────────────── ─────────────────────── ───────────────────
[建議1: P0 安全加固    ]
  ├─ Week 1: 立即修復     ├─ Week 2-4: 系統性覆蓋  ├─ 持續監控 ──────────→
[建議3: P1 測試策略    ]
  ├─ Phase 0: 框架         ├─ Phase 1-2: 核心測試   ├─ Phase 3: E2E        ├─ Phase 4: 監控
[建議2: P1 代碼品質    ]
                           ├─ 高優先清理 + 重構     ├─ 技術債務清理 ──────→
[建議5: P2 生產就緒    ]
  ├─ 容器化 + K8s          ├─ CI/CD + 監控 ────────→
[建議6: 功能擴展       ]
  ├─ 框架設計              ├─ Packing List 試點     ├─ 多語言 OCR          ├─ SAP 試點
[建議4: P2 架構優化    ]
                           ├─ Phase 1: 信心度統一   ├─ Phase 2: 管線重構   ├─ Phase 3: 灰度遷移
```

---

## 建議 1: 安全加固 — 優先級: P0

**現狀**:
- 331 個 API 路由中，有認證檢查的佔 57.7%（191/331）— **140 個路由無認證檢查**（TASK5 第 39-47 行）
- `src/middleware.ts` 第 90-98 行明確跳過所有 `/api` 路由，全局認證中間件對 API 層無保護（TASK5 第 49-51 行）
- 高風險未保護路由共 5 個（POST/PATCH/DELETE 無認證）：`/api/n8n/webhook`、`/api/companies/check-code`、`/api/rules/test`、`/api/extraction/`（TASK5 第 88-96 行）
- **最高安全風險**：`src/lib/auth.config.ts` 的 9 個 console.log 洩露用戶電郵、密碼驗證失敗日誌、環境配置（TASK5 第 265-283 行）
- Zod 驗證覆蓋率僅 62%（119/192 寫入路由），**73 個**寫入端點缺少驗證（TASK5 第 140 行）⚠️ *[勘誤：原誤記為 38，經第二次驗證修正]*

**目標**:
- Auth 覆蓋率從 57.7% 提升至 ≥95%，實現全局認證保護
- 消除高風險 console.log，特別是安全敏感的日誌
- Zod 覆蓋率從 62% 提升至 ≥95%，強制所有寫入端點驗證
- 建立 ESLint 自動化規則檢測未認證/未驗證的寫入端點

**方案**:

### 階段 1：立即修復（1 周）— 高風險項目

1. **清理 auth.config.ts 的 9 個安全敏感 log**（0.5 天）
   - 刪除涉及電郵/密碼/環境變數的 console.log
   - 使用 `logger.debug()` 替代（實裝標準 Logger 服務，參考 TASK5 第 297-299 行）
   - 文件：`src/lib/auth.config.ts`

2. **修復 5 個高風險未保護寫入端點**（1 天）
   - `/api/n8n/webhook` (POST) → 添加 n8n webhook 簽名驗證（HMAC-SHA256）
   - `/api/n8n/documents/[id]/result` (POST) → 同上
   - `/api/companies/check-code` (POST) → 添加 `await auth()` + 可選 API Key 驗證
   - `/api/rules/test` (POST) → 添加 `await auth() + hasPermission('RULE_MANAGE')`
   - `/api/extraction/` (POST) → 添加 `await auth() + hasPermission('DOCUMENT_PROCESS')`
   - 引用文件：`src/app/api/n8n/webhook/route.ts`, `/companies/check-code/route.ts` 等（TASK5 第 91-96 行）

3. **修復 9 個高風險無驗證寫入端點（Zod 缺失）**（1.5 天）
   - `/admin/config/import/` → 添加 Zod schema 驗證配置結構
   - `/companies/identify/` → 驗證公司識別輸入
   - `/extraction/` → 驗證提取請求 payload
   - `/mapping/[id]/` (PATCH) → 驗證映射規則修改
   - `/documents/from-sharepoint/` → 驗證 SharePoint 請求
   - `/documents/from-outlook/` → 驗證 Outlook 請求
   - 3 個 n8n 測試端點 → 驗證測試配置
   - 創建新 Zod Schema 文件：`src/lib/validations/admin.schema.ts`, `company.schema.ts` 等（TASK5 第 179-186 行）

### 階段 2：系統性覆蓋（2-3 周）

4. **新增 6 個共享 Zod Schema 文件**（2 天）
   - `document.schema.ts` — 文件上傳/處理驗證
   - `company.schema.ts` — 公司 CRUD 驗證
   - `rule.schema.ts` — 規則管理驗證
   - `mapping.schema.ts` — 映射配置驗證
   - `extraction.schema.ts` — 提取請求驗證
   - `integration.schema.ts` — n8n/Outlook/SharePoint 配置驗證
   - 位置：`src/lib/validations/` 下（現有 9 個 schema，參考 TASK5 第 165-177 行）

5. **統一認證中間件設計**（2 天）
   - 目前中間件（middleware.ts）跳過 `/api`，無法全局保護 API
   - 建議方案：
     - **選項 A（推薦）**：在 middleware.ts 中添加 API 認證邏輯（redirect 改為標準 401 JSON 響應）
     - **選項 B**：創建 `src/middleware/api-auth-middleware.ts`，在每個 route.ts 的頂層使用
   - 實作模式（參考現有實踐，TASK3 場景 4A 第 741-757 行）：
     ```typescript
     export async function POST(req: NextRequest) {
       const auth = await requireAuth({ permission: 'API_KEY_CREATE' })
       if (!auth.success) return auth.error // RFC 7807 格式
       // ... 業務邏輯
     }
     ```
   - 涉及文件：`src/middleware.ts`, `src/lib/auth-helpers.ts`（新建）

6. **添加 ESLint 自定義規則**（1 天）
   - 檢測 POST/PATCH/DELETE 路由缺少 `await auth()` 或 `requireAuth()`
   - 檢測缺少 `const parsed = schema.safeParse(req.json())`
   - 檢測 console.log（全局禁止，dev 可選）
   - 配置文件：`.eslintrc.json` 的 `rules` 章節

### 階段 3：持續監控（下季度）

7. **CI/CD 自動化**（1 天）
   - GitHub Actions 工作流：在 PR 檢查時執行 ESLint 規則
   - 生成覆蓋率報告：Auth 覆蓋率 + Zod 覆蓋率的每次 PR 快照
   - 阻止不符合規則的 PR 合併

**涉及文件**:
- `src/lib/auth.config.ts` — 清理 console.log
- `src/app/api/n8n/webhook/route.ts`, `/companies/check-code/route.ts`, `/rules/test/route.ts`, `/extraction/route.ts` — 添加 auth
- `src/lib/validations/` — 新增 6 個 schema 文件
- `src/middleware.ts` — 評估 API 認證設計
- `.eslintrc.json` — 自定義規則

**預估工作量**:
- P0 立即修復：3 天（0.5 + 1 + 1.5）
- 系統性覆蓋：5 天（2 + 2 + 1）
- 持續監控：1 天
- **總計**：8 天

**風險**:
- middleware.ts 修改可能影響現有 auth 流程 → **應對**：先在 dev 環境測試，參考 TASK5 第 49-51 行驗證目前行為
- Zod schema 與既有內聯 schema 重複 → **應對**：使用 ESLint 規則逐步遷移（參考 TASK5 第 161-163 行的 85 個內聯 schema）

---

## 建議 2: 代碼品質提升 — 優先級: P1

**現狀**:
- **287 個 console.log**（94 檔案）— 最嚴重：`gpt-vision.service.ts` (25)、`example-generator.service.ts` (22)、`batch-processor.service.ts` (21)、`auth.config.ts` (9，**已列為 P0**）（TASK5 第 237-261 行）
- **`any` 類型**：TASK5 統計 21 處/15 檔案，實際代碼驗證為 **13 處**（差異來自搜尋模式不同）：6 處 Prisma Where、3 處 DTO Mapper、其餘為動態 Import/SDK（TASK5 第 316-360 行）⚠️ *[勘誤：原誤記為 18 處/13 檔案，經第二次驗證修正]*
- **16 個超大檔案**（>1000 LOC）：top 5 分別為 1,738 / 1,720 / 1,553 / 1,537 / 1,451 行（TASK5 第 474-493 行）
- **45 個 TODO/FIXME** — 包含 3 個 P0 (V3.1 核心)、13 個 P1 (Azure Blob + Email)（TASK5 第 373-421 行）

**目標**:
- 清理 287 個 console.log，建立統一 Logger 服務
- 修復 18 處 `any` 類型，提升 TypeScript 嚴謹性至 99.5%+
- 拆分 Top 5 超大檔案，改善可讀性與可維護性
- 優先處理 P0/P1 TODO，清理技術債務

**方案**:

### 階段 1：高優先度清理（2 周）

1. **實作統一 Logger 服務**（1.5 天）
   - 創建 `src/services/logger.service.ts`
   - 方法：`debug()`, `info()`, `warn()`, `error()`
   - 集成：Winston 或 Pino（輕量級 JSON logger，支援日誌分級）
   - 配置：環境變數控制 dev/prod 日誌級別
   - 使用範例：
     ```typescript
     import logger from '@/services/logger.service'
     logger.debug('[Auth] Development mode login for:', sanitizeEmail(email))
     ```

2. **清理 Top 3 文件的 68 個 console.log**（1.5 天）
   - `gpt-vision.service.ts` (25) → 替換為 logger.debug() + logger.info()
   - `example-generator.service.ts` (22) → 同上
   - `batch-processor.service.ts` (21) → 同上（可保留進度日誌為 logger.info）
   - 每個 console.log 評估：刪除（debug 用） vs 替換為 logger（業務邏輯）

3. **修復 6 個 Prisma Where `any` 類型**（0.5 天）
   - `alert.service.ts` 第 283, 411 行 → 使用 `Prisma.AlertWhereInput`
   - `template-export.service.ts` 第 303 行 → 使用具體 Prisma Where 類型
   - `n8n/n8n-health.service.ts` 第 242, 285 行 → 使用 `Prisma.N8nHealthWhereInput` ⚠️ *[勘誤：正確路徑為 `src/services/n8n/n8n-health.service.ts`]*
   - `workflow-execution.service.ts` 第 477 行 → 使用 `Prisma.WorkflowExecutionWhereInput`

4. **修復 3 個 DTO Mapper `any` 類型**（0.5 天）
   - `template-instance.service.ts` 第 934, 957 行 → 定義 `PrismaTemplateInstance` 類型
   - `template-field-mapping.service.ts` 第 503 行 → 定義 `PrismaFieldMapping` 類型

5. **清理剩餘 9 個 `any` 類型**（1 天）
   - 5 處動態 Import/SDK → 使用正確的 TypeScript 類型
     - `pdf-to-img` → `typeof import('pdf-to-img')`
     - OpenAI SDK → `ChatCompletionMessageParam[]`
     - next-intl → 移除 `<any>` 泛型
   - 4 處 `Record<string, any>` → 改為 `Record<string, unknown>` 或具體類型

### 階段 2：大檔案重構（3-4 周）

6. **拆分 Top 5 超大檔案**（3.5 天）

   **#1 — `src/types/extraction-v3.types.ts` (1,738 LOC) → 6 個檔案**
   - `extraction-v3.types.ts` — 核心枚舉 + FieldValue (~100 LOC)
   - `extraction-v3-stages.types.ts` — Stage 1/2/3 Result Types (~300 LOC)
   - `extraction-v3-gpt.types.ts` — UnifiedExtractionResult + GPT config (~250 LOC)
   - `extraction-v3-prompt.types.ts` — DynamicPromptConfig (~400 LOC)
   - `extraction-v3-confidence.types.ts` — ConfidenceWeightsV3_1 (~200 LOC)
   - `extraction-v3-flags.types.ts` — ExtractionV3Flags (~150 LOC)
   - 位置：`src/types/extraction-v3/` 子目錄（新建）

   **#2 — `src/services/company.service.ts` (1,720 LOC) → 4 個檔案**
   - `company.service.ts` — CRUD 核心 (~600 LOC)
   - `company-detail.service.ts` — 詳情視圖 + 統計 (~400 LOC)
   - `company-rules.service.ts` — 規則管理 (~350 LOC)
   - `company-identification.service.ts` — 識別 + 名稱匹配 (~250 LOC)
   - 位置：`src/services/company/` 子目錄（新建）

   **#3 — `src/services/system-config.service.ts` (1,373 LOC) → 4 個檔案** ⚠️ *[勘誤：原誤記為 1,553，實際 1,373 LOC]*
   - `system-config.service.ts` — CRUD 核心 (~500 LOC)
   - `system-config-version.service.ts` — 版本控制 + 回滾 (~300 LOC)
   - `system-config-encryption.service.ts` — 加/解密 (~250 LOC)
   - `system-config-cache.service.ts` — 快取 + 熱載 (~200 LOC)
   - 位置：`src/services/system-config/` 子目錄（新建）

   **#4 — `src/types/field-mapping.ts` (1,537 LOC) → 5 個檔案**
   - `field-mapping-base.types.ts` — 基本類型 (~300 LOC)
   - `field-mapping-transform.types.ts` — 轉換類型 (~400 LOC)
   - `field-mapping-validation.types.ts` — 驗證類型 (~300 LOC)
   - `field-mapping-advanced.types.ts` — 條件/動態映射 (~250 LOC)
   - `field-mapping-constants.ts` — 常數與枚舉 (~150 LOC)
   - 位置：`src/types/field-mapping/` 子目錄（新建）

   **#5 — `src/services/extraction-v3/stages/stage-3-extraction.service.ts` (1,451 LOC) → 4 個檔案**
   - `stage-3-extraction.service.ts` — 主協調 (~600 LOC)
   - `stage-3-mapping.service.ts` — Tier 1/2/3 映射 (~300 LOC)
   - `stage-3-gpt-caller.service.ts` — GPT 呼叫 + 解析 (~300 LOC)
   - `stage-3-validation.service.ts` — 驗證 + 轉換 (~250 LOC)

   - **導入更新**：使用 barrel export（`index.ts`）維持向後相容

### 階段 3：技術債務優先處理（1 周）

7. **優先清理 16 個 P0+P1 TODO/FIXME**

   **P0（3 項）— V3.1 核心**（1 天）
   - `extraction-v3/stages/stage-3-extraction.service.ts:191` — V3.1 Stage 3 實際 GPT 呼叫
   - `extraction-v3/stages/stage-3-extraction.service.ts:521, 546` — 完整術語映射載入
   - 狀態：根據 TASK3 場景 1，功能已實作，TODO 可能已過期 → **建議驗證並移除過時 TODO**

   **P1（13 項）— Azure Blob (7) + Email (2) + Auth (1) + n8n (2) + 信心度 (1)**（5 天）
   - Azure Blob 7 項：`backup.service.ts`, `companies/[id]/route.ts` 等 → 統一實作，參考 `src/lib/azure/storage.ts`
   - Email 2 項：`alert.service.ts`, `alert-notification.service.ts` → 整合 Nodemailer
   - Auth 1 項：`cost/pricing/[id]/route.ts:151` → 從 auth context 獲取用戶 ID
   - n8n 2 項：相關服務整合
   - 信心度 1 項：`confidence-calculator-adapter.ts:539` → 整合歷史準確率

**涉及文件**:
- 新建：`src/services/logger.service.ts`, `src/services/company/`, `src/services/system-config/`, `src/types/extraction-v3/`, `src/types/field-mapping/`
- 修改：94 個包含 console.log 的檔案、13 個包含 `any` 的檔案、5 個超大型檔案
- 更新：所有 import 語句使用新的子目錄結構

**預估工作量**:
- 高優先度清理：5 天（1.5 + 1.5 + 0.5 + 0.5 + 1）
- 大檔案重構：3.5 天
- 技術債務（P0+P1）：6 天（1 + 5）
- **總計**：13 天

**風險**:
- 拆分時破壞循環依賴 → **應對**：先繪製依賴圖，確認無循環
- Import 語句修改影響舊代碼 → **應對**：保持 barrel export 相容性
- console.log 刪除影響調試 → **應對**：logger 服務提供 dev 環境詳細日誌開關

---

## 建議 3: 測試策略 — 優先級: P1

**現狀**:
- **測試覆蓋率 ≈ 0%**：僅有 1 個測試檔案（`batch-processor-parallel.test.ts`）（TASK5 第 555-564 行）
- **測試框架未配置**：無 Jest/Vitest script，`package.json` 無 test 相關配置（TASK5 第 570 行）
- **核心路徑完全無測試**：extraction-v3、mapping、信心度計算、認證/授權、文件處理、331 個 API 路由（TASK5 第 577-604 行）
- **E2E 測試部分實施**：Playwright 已安裝（1.57），但未見大規模測試用例（TASK5 第 572 行）

**目標**:
- 達成 70%+ 核心代碼覆蓋率（18 個月內）
- P0 核心服務（extraction-v3, mapping, confidence）≥ 90% 覆蓋
- P1 關鍵功能（auth, document, company, rules）≥ 70% 覆蓋
- API 路由自動化測試（sampler：100+ 核心端點）

**方案**:

### Phase 0：測試基礎設施（1 周）

1. **選型與配置**（1 天）
   - **推薦**: Vitest（快速、原生 TS 支援、Next.js 相容）
   - 配置：`vitest.config.ts` + V8 coverage provider
   - 安裝：`npm i -D vitest @vitest/ui @vitest/coverage-v8`

2. **Mock 工具棧**（0.5 天）
   - MSW (Mock Service Worker) 用於 API mock
   - @faker-js/faker 用於測試數據生成
   - 安裝：`npm i -D msw @faker-js/faker`

3. **測試目錄結構**（0.5 天）
   - `tests/unit/` — 單元測試
   - `tests/integration/` — 整合測試
   - `tests/e2e/` — E2E 測試
   - `tests/fixtures/` — 共用測試數據

### Phase 1：P0 核心服務測試（Week 2）— 30% 覆蓋

4. **extraction-v3 單元 + 整合測試**（5 天）

   **單元測試（3 天）**:
   | 服務 | 測試案例數 | 重點 |
   |------|-----------|------|
   | `extraction-v3.service.ts` | 5-7 | 主協調、回退、錯誤處理 |
   | `stage-1-company.service.ts` | 4-5 | 已知/未知公司識別 |
   | `stage-2-format.service.ts` | 3-4 | 格式匹配邏輯 |
   | `stage-3-extraction.service.ts` | 6-8 | 欄位提取、參考編號、匯率 |

   **整合測試（2 天）**:
   - 完整三階段流程（3-4 cases）
   - 端到端：上傳 → OCR → V3.1 提取 → 信心度 → 路由決策
   - Mock：Azure Document Intelligence, OpenAI API

5. **confidence-v3-1 單元測試**（2 天）
   | 測試類別 | 案例數 | 重點 |
   |---------|--------|------|
   | 5 維度權重計算 | 5 | 各維度邊界（0%, 100%） |
   | V3.1 智能降級 | 6 | 新公司→FULL_REVIEW, 新格式→QUICK_REVIEW |
   | 路由決策閾值 | 3 | ≥90% AUTO, 80-89% QUICK, <80% FULL |

6. **mapping 核心單元測試**（3 天）
   | 服務 | 案例數 | 重點 |
   |------|--------|------|
   | `dynamic-mapping.service.ts` | 6 | 三層映射 + 快取 |
   | `transform-executor.ts` | 8 | 7 轉換策略 |
   | `field-mapping-engine.ts` | 4 | 規則應用 |

### Phase 2：P1 關鍵功能測試（Week 3-4）— 50% 覆蓋

7. **認證/授權測試**（3 天）
   - `auth.config.ts` — 本地認證邏輯（4 cases）
   - `auth-helpers.ts` — `requireAuth()`, `hasPermission()` (5 cases)

8. **文件處理測試**（3 天）
   - `document.service.ts` — CRUD + 狀態轉換（6 cases）
   - `processing-result-persistence.service.ts` — 結果持久化（3 cases）

9. **公司管理測試**（2.5 天）
   - `company.service.ts` — CRUD（5 cases）
   - `company-identification.service.ts` — 名稱匹配（4 cases）

10. **規則系統測試**（3 天）
    - `rule-suggestion-generator.service.ts` — 規則推斷（4 cases）
    - `rule-accuracy.service.ts` — 準確率計算（3 cases）
    - `auto-rollback.service.ts` — 回滾邏輯（3 cases）

### Phase 3：整合 + E2E 測試（Week 5）— 70% 目標

11. **API 路由整合測試 sampler**（4 天）
    - 選擇 100+ 核心端點（非全部 331 個）
    - 優先：`/api/documents/upload`, `/api/review/*`, `/api/rules/*`, `/api/companies/*`, `/api/v1/*`
    - 工具：Supertest + Vitest + MSW

12. **E2E 場景測試（Playwright）**（3 天）
    - 場景 1：文件上傳 → 自動審核 → 結果確認（TASK3 場景 1）
    - 場景 2：規則學習循環（TASK3 場景 2）
    - 場景 3：批量導入（TASK3 場景 3）

### Phase 4：覆蓋率監控（Week 6+）

13. **CI/CD 整合**（1 天）
    - GitHub Actions：每 PR 執行 Vitest + 覆蓋率報告
    - 阻止覆蓋率下降的 PR

**Top 20 最需要測試的核心服務**（TASK5 第 593-604 行）:

| 優先序 | 服務 | 預估天數 | 理由 |
|--------|------|---------|------|
| 1 | `extraction-v3.service.ts` | 3 天 | 核心提取管線 |
| 2 | `stage-3-extraction.service.ts` | 2 天 | 欄位提取邏輯 |
| 3 | `dynamic-mapping.service.ts` | 2.5 天 | 三層映射核心 |
| 4 | `confidence-v3-1.service.ts` | 1.5 天 | 信心度計算 |
| 5 | `batch-processor.service.ts` | 2 天 | 並發控制 |
| 6 | `company.service.ts` | 2 天 | 公司 CRUD |
| 7 | `rule-suggestion-generator.service.ts` | 1.5 天 | 規則推斷 |
| 8 | `rule-accuracy.service.ts` | 1 天 | 準確率 |
| 9 | `auto-rollback.service.ts` | 1 天 | 回滾邏輯 |
| 10 | `gpt-vision.service.ts` | 1.5 天 | Vision OCR |
| 11 | `document.service.ts` | 1.5 天 | 文件管理 |
| 12 | `auth.config.ts` | 1.5 天 | 認證 |
| 13 | `processing-router.service.ts` | 1 天 | 處理路由 |
| 14 | `transform-executor.ts` | 1.5 天 | 轉換策略 |
| 15 | `system-config.service.ts` | 1.5 天 | 系統配置 |
| 16 | `user.service.ts` | 1 天 | 用戶管理 |
| 17 | `report-generator.service.ts` | 1 天 | 報表生成 |
| 18 | `alert.service.ts` | 1 天 | 告警服務 |
| 19 | `term-aggregation.service.ts` | 1 天 | 詞彙聚合 |
| 20 | `field-mapping-engine.ts` | 1 天 | 映射引擎 |

**里程碑規劃**:

| Phase | 週次 | 重點 | 覆蓋率目標 |
|-------|------|------|-----------|
| Phase 0 | Week 1 | 測試框架 + Mock 工具 | 基礎設施就緒 |
| Phase 1 | Week 2 | extraction-v3 + confidence + mapping | → 30% 核心覆蓋 |
| Phase 2 | Week 3-4 | auth + document + company + rules | → 50% |
| Phase 3 | Week 5 | API sampler + E2E | → 70% |
| Phase 4 | Week 6+ | 監控 & 自動化 | 持續改善 |

**涉及文件**:
- 新建：`vitest.config.ts`, `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/fixtures/`
- 修改：`package.json` (test scripts), `.github/workflows/` (CI)

**預估工作量**:
- 基礎設施：2 天
- P0 核心：10 天
- P1 關鍵：11.5 天
- 整合 + E2E：7 天
- CI/CD：1 天
- **總計**：24 天（約 1 個月）

**風險**:
- 測試編寫成本高 → **應對**：先聚焦 P0/P1，P2 服務延後
- Prisma mock 困難 → **應對**：使用 testcontainers 啟動實際 PostgreSQL
- GPT API 呼叫 mock → **應對**：MSW 或環境變數控制 mock/real

---

## 建議 4: 統一處理器與 V3 管線融合 — 優先級: P2

**現狀**:
- 目前架構存在 **V2（11 步管線）+ V3（7 步管線）+ 統一處理器（Feature Flag 灰度）三層並存**的複雜狀況
- `unified-processor/` (**22** 個文件) 與 `extraction-v3/` (**21** 個文件) 分別維護，代碼重複率約 23%（特別是信心度計算、結果驗證模組）⚠️ *[勘誤：含 index.ts/CLAUDE.md，原誤記為 21/20]*
- Prisma schema 中 ExtractionResult 同時支援 V2/V3 欄位（14+ stage 相關欄位），表結構冗長
- **Feature Flag 灰度決策** 基於 fileId hash，無法針對特定公司/格式進行精細控制（TASK4 決策 4）
- **回退邏輯複雜**: V3 失敗 → V2 → Legacy，實際上 99% 生產場景應直接用 V3.1

**目標**:
- 將 V2/V3 統一為**單一提取管線架構**，V3.1 成為預設
- 消除代碼重複，從 42 個管線文件降至 25-28 個
- Feature Flag 支援**維度級控制**（按 Company/Format/Region）
- 建立**清晰的優雅降級機制**

**方案**（分 3 個季度）:

| 季度 | 里程碑 | 關鍵任務 | 預估天數 |
|------|--------|---------|---------|
| **Q1** | Phase 1: 重構信心度計算 | 統一 confidence-v3(-1)?.service.ts 為單一計算引擎 + ConfigurableWeights 動態權重 + 回歸測試 | 12-14 天 |
| **Q2** | Phase 2: 統一提取管線 | 建立 `extraction-unified.service.ts` 單一入口 + 移除 `unified-processor/` (21 files) + 維度級 Feature Flag + Prisma 欄位清理 | 14-16 天 |
| **Q3** | Phase 3: 灰度遷移 | 20% → 50% → 100% 流量遷移 + 監控 error rate/processing time + 完全下線 V2 | 10-12 天 |

**Phase 1 詳細步驟**:
1. 統一 `confidence-v3(-1)?.service.ts` 為單一計算引擎
2. V2 維度 → V3.1 維度（5-6 dim）完全遷移
3. Zod schema 驗證 confidence input 參數
4. 新增 ConfigurableWeights 動態權重系統（允許按 Company 調優）
5. 編寫回歸測試（3 場景：新公司、高信心、邊界值）

**Phase 2 詳細步驟**:
6. 建立 `extraction-unified.service.ts` 作為單一入口
7. 內部路由：complexity 評估 → 短路 → 三階段 → 結果驗證
8. 移除 `unified-processor/` 並整合至新管線
9. 新增維度級 Feature Flag (Company/Format/Region)
10. Prisma ExtractionResult 欄位清理：V2 欄位標記 deprecated

**Phase 3 詳細步驟**:
11. 20% 流量切至新統一管線（按 region 灰度）
12. 監控 error rate、processing time（目標 <5% 差異）
13. 50% → 100% 流量遷移
14. 完全下線 V2 管線代碼（保留 Feature Flag 應急降級）

**涉及文件**:
- **刪除** (22 files): `src/services/unified-processor/*` ⚠️ *[勘誤：含 index.ts]*
- **修改** (8 files): `confidence-*.service.ts`, `extraction-v3.service.ts`, `result-validation.service.ts`, Prisma types
- **新增** (3 files): `extraction-unified.service.ts`, `extraction-pipeline-flags.ts`, `confidence-calculation-engine.service.ts`
- **測試** (5 files): unit/integration/e2e 回歸測試

**預估工作量**: 36-42 天（約 6-7 週），分 3 個 Sprint

**風險**:

| 風險 | 概率 | 應對 |
|------|------|------|
| 新管線效能比現有差 | 中 | 預先 benchmark（100 張文件），>10% 衰減立即分析 |
| 回退邏輯複雜難調試 | 中 | 建立狀態圖 + 3 個代碼審查點 |
| Prisma 遷移數據相容性 | 低 | 新欄位 nullable，deprecated 欄位 1 年內支援 |

---

## 建議 5: 生產就緒基礎設施升級 — 優先級: P2

**現狀**:
- **容器化**: 僅 Docker Compose 開發環境，無 Node.js Dockerfile，無 K8s 配置
- **CI/CD**: 零（無 GitHub Actions、無自動化部署管線）
- **監控告警**: 健康檢查端點存在（`GET /api/admin/health`），但無 Prometheus/Grafana
- **效能基準**: 無明確 SLA 測試驗證（CLAUDE.md 提及 99.5% uptime, RPO<1h, RTO<4h）
- **環境管理**: `.env` 存在，無 Secret Manager（Azure Key Vault 集成不完整）
- **部署策略**: 純手動 `npm run build && npm start`

**目標**:
- Kubernetes-ready 容器配置
- CI/CD 全自動化管線（lint → type-check → test → build → deploy）
- Prometheus + Grafana 監控棧
- 驗證效能基準（<30s/張 處理時間，99.5% uptime）
- 完整 Secret 管理

**方案**:

### Phase 1：容器化與 K8s（Q1, 6-8 周）

| 步驟 | 任務 | 新增文件 | 天數 |
|------|------|---------|------|
| 1 | Node.js Dockerfile（multi-stage） | `Dockerfile` | 1 |
| 2 | 更新 docker-compose.yml | `docker-compose.override.yml` | 0.5 |
| 3 | `.dockerignore` | `.dockerignore` | 0.5 |
| 4 | K8s manifests | `deploy/k8s/base/`, `deploy/k8s/overlays/staging/`, `deploy/k8s/overlays/prod/` | 3 |
| 5 | ArgoCD 配置 | `.argocd/application.yaml` | 1 |
| 6 | 部署文檔 | `docs/deployment/docker-setup.md` | 1 |
| | **小計** | | **7 天** |

### Phase 2：CI/CD + 監控（Q2, 8-10 周）

| 步驟 | 任務 | 新增文件 | 天數 |
|------|------|---------|------|
| 7 | GitHub Actions CI/CD | `.github/workflows/ci.yml`, `.github/workflows/cd.yml` | 3 |
| 8 | Smoke test 腳本 | `scripts/smoke-test.sh` | 1 |
| 9 | Prometheus 整合 | `src/services/metrics.service.ts`, `src/app/api/metrics/route.ts`, `deploy/monitoring/prometheus-config.yaml` | 3 |
| 10 | Grafana 儀表板 | `deploy/monitoring/grafana-dashboards/` | 2 |
| 11 | Alert Rules | `deploy/monitoring/alertmanager-config.yaml`, `deploy/monitoring/prometheus-rules.yaml` | 1.5 |
| 12 | Secret 管理完善 | `src/lib/secrets.ts`, `.env.example`, `docs/deployment/secrets-management.md` | 2 |
| 13 | 效能基準測試 | `tests/e2e/performance.spec.ts`, `scripts/benchmark-report.ts` | 2 |
| | **小計** | | **14.5 天** |

**Alert Rules 設定**:
- Uptime < 99% → warning
- P99 latency > 50s → critical
- Error rate > 1% → warning
- DB connection pool exhausted → critical
- Azure service unavailable → critical

**Prometheus 指標**:
- `request_duration_ms` — 請求延遲
- `request_total` — 請求總量
- `error_total` — 錯誤總量
- `db_query_time_ms` — DB 查詢延遲

**涉及文件**:
- **新增**: Dockerfile, 8 個 K8s YAML, 2 個 GitHub Actions, 4 個監控配置, 3 個文檔, 2 個新服務文件
- **修改**: `package.json`, `docker-compose.yml`

**預估工作量**: 24-30 天（約 4-5 週）

**風險**:

| 風險 | 概率 | 應對 |
|------|------|------|
| K8s 部署複雜，團隊無經驗 | 中 | 詳細部署手冊 + 培訓，可先用 Docker Swarm 過渡 |
| CI/CD flaky tests | 高 | 從簡單管線開始，逐步加入測試 |
| 監控告警噪聲 | 中 | 前 2 週調優閾值 |
| Azure Key Vault 集成失敗 | 低 | 保留 .env 作為開發環境備選 |

---

## 建議 6: 功能擴展與技術棧升級路線 — 優先級: P1(框架) P2(應用)

**現狀**:
- **功能邊界**：目前專注 Freight Invoice（Forwarder 識別、三層映射、信心度路由）
- **技術棧版本**：Next.js 15.0.0, Prisma 7.2, React 18.3
- **Prisma ID 策略混用**：74 個模型使用 cuid()，47 個使用 uuid()
- **擴展機會**：跨文件類型、多語言 OCR、ERP 整合、自助分析、LLM 本地部署

**目標**:
- 規劃 12-18 個月技術棧升級路線
- 建立插拔式文件處理框架，新文件類型可快速新增
- 評估架構擴展性上限

### 6.1 功能擴展方向

| 擴展方向 | 短期（6-12 月） | 長期（12-24 月） | 風險 |
|---------|----------------|-----------------|------|
| **跨文件類型** | Packing List, Bill of Lading | Shipping Certificate, Insurance Doc | 中 |
| **多語言 OCR** | 繁中、簡中、日文、韓文 | 泰文、越南文、馬來文 | 低 |
| **ERP 整合** | SAP (Ariba) API | Oracle Procurement Cloud | 高 |
| **報表自助化** | Monthly Cost by Forwarder | 異常檢測、Supply Chain 優化 | 中 |
| **LLM 本地部署** | 評估 Llama 2 / Mistral | 7B 模型內部 GPU 部署 | 高 |

### 6.2 技術棧升級路線

| 升級 | 時機 | 好處 | 成本 | 影響 |
|------|------|------|------|------|
| **Next.js 15 → 16** | 2025 Q4 | 更好 hydration, faster build | 低 | App Router 相容性檢查 |
| **Prisma 7 → 8** | 2025 Q3 | 新 aggregations, improved types | 低 | Schema 無變動 |
| **React 18 → 19** | 2025 Q1-Q2 | Server Components 穩定, use() hook | 中 | 25+ 組件驗證 |

**CUID → UUID 遷移計劃**:
- 目前：74 cuid + 47 uuid（混用狀態）
- 方案：新模型一律 uuid，舊模型在重構時逐步遷移
- 風險：外鍵關聯需同步更新

### 6.3 架構擴展性評估

| 層級 | 當前容量 | 瓶頸 | 改善方案 | 預估投入 |
|------|---------|------|---------|---------|
| **API 層** | 400+ 端點，無速率限制 | DDoS 風險 | Redis 速率限制 + API 分級 | 5-7 天 |
| **服務層** | 200 服務，無隔離 | 大服務難測試 | 微服務分離（extraction, mapping 獨立） | 12-16 週 |
| **資料庫** | 122 models，連接池 10 | 高並發連接耗盡 | 連接池 20 + 讀寫分離 | 8-12 天 |
| **檔案儲存** | Azure Blob，無快取 | 每次存取 Blob | CDN + Redis 快取 | 4-6 天 |
| **AI/OCR** | Azure DI + OpenAI | 完全依賴外部 | 本地 OCR fallback + 批次優化 | 20-28 天 |

**擴展性預測**:
- **當前**: ~100,000 文件/月（~3,300/日），~500 並發用戶
- **瓶頸觸發**: 200,000 文件/月 → DB 連接池耗盡
- **改善後**: ~1,000,000 文件/月（微服務 + 快取層）

### 6.4 插拔式文件處理框架設計

建議建立 **Pluggable Document Processor Framework**：

```
DocumentProcessor Interface:
├── 1. OCR Configuration
│   ├── ocrModel: 'AZURE_DI' | 'TESSERACT' | 'PADDLEOCR'
│   ├── language: enum (en, zh_TW, zh_CN, ja, ko, ...)
│   └── confidenceThreshold: number
├── 2. Field Definition
│   ├── requiredFields: FieldDefinition[]
│   ├── optionalFields: FieldDefinition[]
│   └── lineItemSchema: optional
├── 3. Mapping Rules
│   ├── universalMappings: Tier 1
│   ├── companySpecific: Tier 2
│   └── aiClassification: Tier 3
├── 4. Validation Schema
│   ├── zod.schema: ZodSchema
│   └── businessRules: BusinessRule[]
└── 5. Post-Processing
    ├── transformers: Transformer[]
    ├── enrichers: Enricher[]
    └── exportFormats: ExportFormat[]
```

新文件類型只需定義上述 5 個部分，核心引擎自動處理。

**涉及文件**:
- 新建：`src/services/document-processor-framework/` (5-8 個文件)
- 新增 Prisma model：`DocumentProcessorDefinition`, `FieldDefinition`
- 新增 API：`GET /api/v1/document-processors`, `POST /api/v1/document-processors/{type}/test`

**預估工作量**:
- 短期（6-12 月）：框架 2-3 週 + Packing List 4-6 週 + 多語言 OCR 3-4 週 = 12-16 週
- 中期（12-18 月）：第二文件類型 3-4 週 + SAP 試點 8-12 週 + 報表 MVP 6-8 週 = 20-28 週
- 長期（18-24 月）：LLM 本地部署 12-16 週

**擴展優先順序**:

| 方向 | 優先級 | 風險 | 用戶需求 | 建議 |
|------|--------|------|---------|------|
| 跨文件類型 | P1 | 低 | 高 | **立即著手框架設計** |
| 多語言 OCR | P1 | 低 | 高 | **納入 Q1 目標** |
| SAP 整合 | P2 | 高 | 中 | 小範圍試點驗證 ROI |
| 報表自助化 | P2 | 中 | 中 | Phase 2 後期 |
| LLM 本地部署 | P3 | 高 | 低 | data governance 強制時才啟動 |

---

## 整體實施順序建議

```
                    Q1                    Q2                    Q3                    Q4
                ──────────────────── ──────────────────── ──────────────────── ────────────────
P0 安全加固     [████████]
P1 測試策略     [████████████████████████████████████████]
P1 代碼品質              [████████████████████████]
P2 生產就緒     [████████████████████████████████]
P2 架構優化                          [████████████████████████████████████████████████]
P1 功能擴展框架 [████████]
P2 功能擴展應用          [████████████████████████████████████████████████████████████]
```

**建議順序**:
1. **第 1 周**：同時啟動 建議 1 (P0 立即修復) + 建議 3 (Phase 0 框架搭建)
2. **第 2-3 周**：建議 2 (高優先清理) + 建議 3 (Phase 1-2 核心測試) + 建議 5 (容器化)
3. **第 4-5 周**：建議 2 (大檔案重構) + 建議 3 (Phase 3 E2E) + 建議 6 (框架設計)
4. **第 6-8 周**：建議 1 (系統性覆蓋) + 建議 5 (CI/CD + 監控)
5. **Q2 起**：建議 4 (架構統一) + 建議 6 (功能擴展應用)

**關鍵依賴**:
- 建議 4 依賴建議 5（需要 CI/CD 和監控支撐灰度遷移）
- 建議 4 依賴建議 3（需要測試覆蓋確保回歸安全）
- 建議 6 功能擴展依賴建議 4（統一管線後才能建框架）
- 建議 1-3 互相獨立，可完全並行

---

## 交叉驗證補充（Task 3/4/5 → Task 6 遺漏修補）

> **驗證方法**: 3 個 Explore Agent 並行交叉比對 Task 3（E2E 流程）、Task 4（設計決策）、Task 5（安全品質）與 Task 6 的覆蓋度
> **發現**: 22 項重要遺漏 + 12 項次要遺漏（去重合併後歸類如下）

### 驗證覆蓋度總評

| 來源 | 原始覆蓋度 | 補充後覆蓋度 | 主要缺失領域 |
|------|-----------|-------------|-------------|
| Task 3 → Task 6 | ~55% | ~90% | 測試策略細節嚴重不足 |
| Task 4 → Task 6 | ~85% | ~95% | 成本控制、監控指標、DB 遷移 |
| Task 5 → Task 6 | ~80% | ~95% | 數據不一致、P2/P3 TODO、中低風險端點 |

---

### 補充 A：建議 1（安全加固）遺漏修補

#### A1. API 層實際認證覆蓋率澄清

**問題**：報告引用 57.7% 覆蓋率，但 `middleware.ts` 跳過所有 `/api` 路由（第 90-98 行），實際 API 層認證保護率遠低於此數字。57.7% 包含了前端頁面路由的保護。

**補充**：建議 1 階段 2 的「統一認證中間件設計」應明確標注：
- 當前 API 層真實覆蓋率需獨立評估（預期 <50%）
- 統一中間件的首要目標是補齊 API 層的認證缺口

#### A2. 敏感 GET 端點修復

**問題**：建議 1 階段 1 只列舉了 POST/PATCH/DELETE 高風險端點，遺漏了 2 個敏感 GET 端點（TASK5 審計 1.4）。

**補充**：階段 1 新增 0.5 天：
- `/api/cost/pricing` (GET) → 添加 `await auth() + hasPermission('PRICING_VIEW')`（定價信息洩露風險）
- `/api/admin/health` (GET) → 限制為內部訪問或 Bearer Token 驗證

#### A3. 中低風險 Zod 驗證端點分級計劃

**問題**：TASK5 統計 73 個缺失 Zod 驗證的寫入端點，建議 1 僅覆蓋 9 個高風險，剩餘 64 個未規劃。

**補充**：建議 1 階段 2 新增 1.5 天：
- 高風險 9 個（接受複雜 body）：P0，第 1-2 周（已列入）
- 中風險 8 個（操作確認端點）：P1，第 2-3 周
- 低風險 56 個：P2，後續遷移（每批 10-15 個）

**建議 1 修正後工作量：8 天 → 10 天（+2 天）**

---

### 補充 B：建議 2（代碼品質）遺漏修補

#### B1. `any` 類型數量修正

**數據不一致**：
- TASK5 統計：**21 處 / 15 檔案**
- TASK6 引用：**18 處 / 13 檔案**
- 分項：6 (Prisma Where) + 3 (DTO) + 5 (SDK) + 4 (其他) = 18，**遺漏 3 處**
- 另外 TASK5 發現 **20 處 eslint-disable 針對 any 的禁用**

**補充**：建議 2 階段 1 第 5 點修正為：
- 總計 **21 處** any（非 18 處），需重新核對遺漏的 3 處
- 新增：移除 20 處 `eslint-disable` 註解，逐一評估是否可修復（+0.5 天）

#### B2. P2/P3 TODO 清理計劃（完全缺失）

**問題**：建議 2 僅處理 P0 (3) + P1 (13)，**完全未提及 P2 (19) + P3 (10)**，佔總 TODO 的 64%。

**補充**：建議 2 新增「階段 4：P2/P3 技術債務清理」

**P2 待辦項**（19 項，預估 8-10 天）：
- Schema 更新（5 項，術語映射相關）— 2 天
- 功能完成（6 項，UI 編輯、WebSocket 通知等）— 4 天
- 服務整合（8 項）— 3 天

**P3 待辦項**（10 項，預估 3-4 天）：
- 已過時 Epic 條件註釋（5 項）— 1 天（直接移除）
- 可選功能（5 項）— 2-3 天（評估是否保留）

**納入時程**：Q2 後期清理計劃

#### B3. 剩餘 11 個超大檔案拆分方案

**問題**：建議 2 僅詳述 Top 5（>1,400 LOC），TASK5 列舉 16 個 >1,000 LOC 檔案，剩餘 11 個無拆分計劃。

**補充**：建議 2 階段 2 新增 P1-P2 級別拆分（7-9 天）：

| # | 檔案 | LOC | 建議拆分 |
|---|------|-----|---------|
| 6 | `batch-processor.service.ts` | 1,356 | 核心 + 排程 + 並行 (3 files) |
| 7 | `extraction-v3.service.ts` | 1,238 | 協調 + 配置 + 結果處理 (3 files) |
| 8 | `gpt-vision.service.ts` | 1,199 | OCR 調用 + 結果解析 + 錯誤處理 (3 files) |
| 9 | `data-retention.service.ts` | 1,150 | 策略 + 執行 + 排程 (3 files) |
| 10 | `example-generator.service.ts` | 1,139 | 生成 + 模板 + 匯出 (3 files) |
| 11 | `invoice-fields.ts` | 1,126 | 按欄位類別分組 (4 files) |
| 12-16 | 其餘 5 個 | 1,017-1,120 | 各拆 2-3 個 |

**建議 2 修正後工作量：13 天 → 24-27 天（+11-14 天）**

---

### 補充 C：建議 3（測試策略）遺漏修補 — 最大缺口

> **核心問題**：原建議 3 的測試案例設計過於框架性，缺少 TASK3 場景中發現的關鍵業務路徑和邊界條件。

#### C1. 信心度路由完整測試（+3-4 天）

**遺漏**：TASK3 場景 1 的 V3.1 信心度計算有多個關鍵邏輯未被測試覆蓋。

**補充至 Phase 1**：
- ConfigSourceBonus 三級分數 (100/80/50) 邊界測試（1 case）
- CHANGE-032 動態第 6 維度 (`refMatchEnabled=true`) 權重調整驗證（1 case）
- 5 條智能降級規則各自的觸發邏輯（5 cases）：
  - 新公司 + 新格式 (99% 信心度) → 仍強制 FULL_REVIEW
  - 新公司 + 已知格式 (99% 信心度) → 仍強制 FULL_REVIEW
  - 已知公司 + 新格式 (99% 信心度) → QUICK_REVIEW
  - 超過 3 個需分類項目 → AUTO → QUICK
  - DEFAULT 配置來源 → 降級（優先於信心度數值）
- 雙層規則優先級測試（2 cases）：`getSmartReviewType()` vs `generateRoutingDecision()` 衝突解決
- 異常處理回退（4 cases：Stage 失敗、GPT 超時各重試邏輯）

`confidence-v3-1.service.ts` 從 2 天提升至 **5-6 天**

#### C2. Stage 1/2/3 失敗降級邏輯測試（+5-8 天）

**遺漏**：TASK3 場景 1 第 162-167 行定義的各階段降級邏輯完全未被測試。

**補充至 Phase 1**：
- `stage-1-company.service.ts` 新增 2-3 cases：
  - Company 未知 → fallback LLM 分類成功/失敗
  - fallback LLM 也失敗 → FALLBACK_FAILED 降級
- `stage-2-format.service.ts` 新增 1-2 cases：
  - Format 識別失敗 → Universal 欄位定義回退
- `stage-3-extraction.service.ts` 新增 2-3 cases：
  - 欄位提取完全失敗 → OCR_FAILED 標記
  - GPT 超時 → 重試 0/1/2/3 次邏輯
  - 最終超時 → FULL_REVIEW 降級
- **Stage 間協調邏輯**新增 4-5 cases（TASK4 決策 2 發現）：
  - Stage 2 `configSource=LLM_INFERRED` → Stage 3 使用降級 prompt
  - Stage 2 `configSource=COMPANY_SPECIFIC` → Stage 3 使用精調 prompt
  - Stage 2 格式識別失敗 → Stage 3 回退通用配置
  - 三階段總耗時 SLA 驗證（<20s）

#### C3. 外部整合測試（+6-8 天）— 完全缺失

**遺漏**：TASK3 場景 4 的三條子流程（SharePoint / Outlook / n8n）涉及 30+ API 端點，建議 3 中完全未提及。

**補充：新增 Phase 2.5「外部整合測試」**

**SharePoint 整合**（3 天）：
- `MicrosoftGraphService` 單元測試（3 cases：auth, download, error handling）
- `sharepoint-document.service` 整合測試（4 cases：驗證、重複檢測、Blob 上傳、Document 創建）
- API 路由測試（2 cases：POST /api/documents/from-sharepoint, GET status）

**Outlook 整合**（2.5 天）：
- `outlook-mail.service` 單元測試（2 cases：獲取附件）
- 過濾規則引擎測試（5 cases：白名單、黑名單、6 種規則類型）
- 直接上傳 vs MESSAGE_ID 模式（2 cases）

**n8n 整合**（2.5 天）：
- `n8n-document.service`（2 cases：Base64 解碼、上傳）
- `n8n-webhook.service`（3 cases：入站事件分派、回調重試邏輯）
- `workflow-trigger.service`（2 cases：參數驗證、觸發請求）

#### C4. 批量處理 SSE 與生命週期測試（+2-3 天）

**遺漏**：TASK3 場景 3 的 SSE 串流細節（ReadableStream、心跳保活、超時、事件類型）和生命週期控制（暫停/恢復/取消/跳過）未被測試。

**補充至 Phase 1**：
- SSE 事件格式驗證（5 events：connected, progress, heartbeat, completed, error）
- 連線超時機制（5 分鐘上限）
- 暫停/恢復狀態轉移（3 cases：pause→resume, cancel, skip）
- 並發控制驗證（p-queue 5 並發限制）
- E2E Playwright 測試（SSE 連線壽命 + UI 更新）

`batch-processor.service.ts` 從 2 天提升至 **4-5 天**

#### C5. 參考編號匹配 + 匯率轉換測試（+2-3 天）

**遺漏**：TASK3 場景 1 提及的 CHANGE-032 引入的兩個關鍵服務完全未在 Top 20 測試清單中。

**補充至 Phase 1（extraction-v3 整合測試）**：
- `reference-number-matcher.service.ts`（1-1.5 天）：匹配成功/失敗、相似度臨界值、信心度加成
- `exchange-rate-converter.service.ts`（1-1.5 天）：現匯率查詢、轉換精度、匯率缺失降級

#### C6. 規則學習循環完整測試（+4-5 天）

**遺漏**：TASK3 場景 2 的 21 步規則學習循環中，模式分析、影響分析、自動回滾的測試案例不足。

**補充至 Phase 2**：
- `pattern-analysis.service.ts`（1.5 天）：三次修正→CANDIDATE 轉變、Levenshtein 相似度 0.8+、按 Company:fieldName 分組
- `impact-analysis.service.ts`（1.5 天）：三維度計算（affectedDocs, improvement, accuracy）、風險案例識別
- `auto-rollback.service.ts`（1 天）：準確率下降 >10% 觸發、版本回滾邏輯、告警通知
- `rule-suggestion-generator.service.ts` 從 1.5 天提升至 2-3 天

#### C7. 審核工作流與修正流程測試（+2-2.5 天）

**遺漏**：TASK3 場景 1 與場景 2 中的審核相關 API 和狀態轉移未被測試。

**補充至 Phase 2**：
- 文件狀態轉移（UPLOADED → PROCESSING → OCR_COMPLETED → APPROVED/REJECTED）
- AUTO_APPROVE / QUICK_REVIEW / FULL_REVIEW 路由測試
- 修正記錄（Correction model）與升級流程（Escalation）

#### C8. 技術棧升級回歸測試（+5-7 天）

**遺漏**：TASK4 決策 6 的技術棧升級（Next.js 16, React 19）有 breaking change 風險，建議 3 未規劃回歸測試。

**補充至 Phase 4 或獨立階段**：
- Server Component 序列化驗證（5 個關鍵組件）
- API Route 相容性（100+ 路由抽樣測試）
- Middleware 行為變更驗證
- 構建時間基準測試（避免 >2x）
- E2E 場景重跑（TASK3 場景 1-3）

#### 建議 3 修正後總工作量

| Phase | 原估 | 補充 | 修正後 |
|-------|------|------|--------|
| Phase 0：基礎設施 | 2 天 | — | 2 天 |
| Phase 1：P0 核心 | 10 天 | +13-18 天 (C1+C2+C4+C5) | 23-28 天 |
| Phase 2：P1 關鍵 | 11.5 天 | +6.5-7.5 天 (C6+C7) | 18-19 天 |
| Phase 2.5：外部整合 | 0 天 | +6-8 天 (C3) | 6-8 天 |
| Phase 3：E2E | 7 天 | — | 7 天 |
| Phase 4：監控+回歸 | 1 天 | +5-7 天 (C8) | 6-8 天 |
| **總計** | **24 天** | **+30-40 天** | **~55-65 天（約 11-13 週）** |

---

### 補充 D：建議 4（架構優化）遺漏修補

#### D1. LLM Tier 3 成本控制機制

**遺漏**：TASK4 決策 1+2 指出，新公司+新格式+新術語同時出現時，LLM 調用會級聯（Stage 1 nano + Stage 3 GPT-5.2 + Tier 3 術語分類 GPT），成本可能激增。建議 4 未提及成本爆炸時的降級策略。

**補充至 Phase 2**：
- **LLM 分類配額管理**：
  - 按月限額（如 $500/月 Tier 3 成本）
  - 80% 配額 → 警告，關閉 Tier 3，改用 fallback 術語
  - 100% 配額 → 未知術語改用 `UNKNOWN_<sequence>` 佔位
- **Tier 3 調用監控指標**：
  - `tier3_classification_calls_total`
  - `tier3_cost_usd_total`
  - `tier3_classification_latency_ms`

#### D2. V2/V3 回退生產監控指標

**遺漏**：TASK4 決策 4 指出 V3→V2→Legacy 三層回退機制，但何時觸發、成功率、延遲的監控指標未定義。

**補充至 Phase 3（灰度遷移）+ 建議 5 Prometheus**：
- `extraction_v3_fallback_to_v2_total` — V3→V2 回退計數
- `extraction_v2_fallback_to_legacy_total` — V2→Legacy 回退計數
- `extraction_fallback_rate{stage}` — 各階段回退率
- `extraction_retry_delay_ms{attempt}` — 重試延遲
- **告警規則**：V3 fallback rate >5% → warning；V2 fallback rate >10% → critical

#### D3. 代碼重複掃描報告

**遺漏**：建議 4 提及「23% 代碼重複」但未指出具體哪些模組重複。

**補充**：Phase 2 前置條件新增「代碼重複掃描報告」（使用 jscpd 或類似工具），識別 unified-processor 與 extraction-v3 之間的具體重複函數和模組。

**建議 4 修正後工作量：36-42 天 → 40-48 天（+4-6 天）**

---

### 補充 E：建議 5（生產就緒）遺漏修補

#### E1. Python 微服務性能基準

**遺漏**：TASK4 決策 7 指出 Python 微服務分離，但 Node.js→Python 的網絡延遲、故障場景、性能基準未量化。

**補充至 Phase 2（性能基準測試）新增 3-5 天**：

| 測試項 | 預期值 |
|--------|--------|
| OCR latency（Azure DI） | 8-12s（含網絡往返 <100ms） |
| Mapping latency（Tier 1/2 查詢） | <500ms |
| End-to-End（提交→三階段→結果） | <30s |

**故障場景測試**：
- Python 服務掉線 → 重試機制驗證
- 部分請求超時 → 回退到本地快速映射
- 網絡抖動 → 重試 + 指數退避

**新增監控指標**：
- `python_service_latency_p99_ms`
- `network_latency_extraction_ms`
- `fallback_to_local_mapping_rate`

#### E2. Docker Compose Python 服務配置

**遺漏**：建議 5 Phase 1 提及 Dockerfile，但未明確 Python 服務在 docker-compose.yml 中的配置。

**補充**：Phase 1 更新 docker-compose.yml 時需包含：
- `python-extraction` service（port 8000）
- `python-mapping` service（port 8001）
- 健康檢查配置
- 共享網絡與 volume 配置

**建議 5 修正後工作量：24-30 天 → 28-36 天（+4-6 天）**

---

### 補充 F：建議 6（功能擴展）遺漏修補

#### F1. Forwarder → Company 資料庫遷移策略

**遺漏**：TASK4 決策 5 指出重構涉及 7+ Prisma 模型的跨表外鍵更新，建議 2 的 company.service.ts 拆分僅涵蓋代碼層，未涵蓋資料庫遷移。

**補充（新增獨立段落，5-9 天）**：
- **Phase 1 備份+驗證**（1-2 天）：Full backup，驗證舊 Forwarder 表數據完整性
- **Phase 2 灰度遷移**（3-5 天）：新 Company 表並行寫入（Feature Flag 10%→50%→100%），讀取優先級 Company > Forwarder（fallback），數據一致性驗證（row count, hash）
- **Phase 3 下線舊表**（1-2 天）：停止 Forwarder 寫入，遺留數據歸檔
- **Rollback 計劃**：保留 Forwarder 表 90 天，支持秒級回滾

#### F2. 客戶分層功能優先級

**遺漏**：TASK4 決策 8 定義了平台定位，但建議 6 的功能擴展未按客戶群分化優先級。

**補充**：

| 客戶層 | 規模 | 必需功能 | 建議功能 | 可選功能 |
|--------|------|---------|---------|---------|
| **Tier 1**（大型 3PL，>100k docs/年） | 三層映射、多語言 | SAP 整合、Custom Rule Builder | LLM 本地部署 |
| **Tier 2**（中型承運商，10-100k） | 三層映射、英文、Basic 報表 | Packing List | 多語言、ERP |
| **Tier 3**（小型企業，<10k） | 手動上傳、基本提取 | Bulk Import | 一切 |

**路線圖調整**：
- Q1-Q2：Tier 1 SAP 試點（1-2 家供應商）
- Q2-Q3：Tier 2+ Packing List
- Q3-Q4：Tier 1+ 多語言 OCR

#### F3. 插拔式框架與現有 V3 管線的適配

**遺漏**：建議 6.4 設計了 DocumentProcessor Interface，但未說明與現有 extraction-v3 / mapping 代碼的整合策略。

**補充**：
- 現有 extraction-v3 應改造為 DocumentProcessor 介面的**預設實現**
- field-mapping 的三層映射邏輯應抽象為 `MappingStrategy` interface
- 新文件類型通過實現相同介面快速擴展
- 預估重構工作：2-3 週（獨立於新文件類型開發）

#### F4. 技術棧升級 Breaking Change 風險矩陣

**遺漏**：建議 6.2 僅列升級好處，未列實施風險。

**補充**：

| 升級 | Breaking Changes | 影響範圍 | 應對策略 |
|------|-----------------|---------|---------|
| Next.js 15→16 | SSR 序列化限制、streaming 改變 | App Router 組件 | Feature branch 預驗證 |
| React 18→19 | `use()` hook、Server Components 穩定 API | 25+ 組件 | 逐組件遷移 |
| Prisma 7→8 | `where` 子句精確型態 | 所有 service | 自動化 codemod |

#### F5. CUID→UUID 混用期間 ORM 相容性

**遺漏**：建議 6.2 提及逐步遷移，但混用期間 `WHERE id IN (uuid AND cuid)` 的查詢複雜度未提及。

**補充**：
- 混用期間需確保 Prisma ORM 的 `findMany({ where: { id: { in: [...] } } })` 支援不同格式 ID
- 建議在遷移期間為需要跨表查詢的場景新增**類型適配層**
- 遷移完成後移除適配層

---

### 修正後建議總覽

| 建議 | 優先級 | 原工作量 | 修正後工作量 | 變化 |
|------|--------|---------|-------------|------|
| **1. 安全加固** | P0 | 8 天 | **10 天** | +2 天 |
| **2. 代碼品質提升** | P1 | 13 天 | **24-27 天** | +11-14 天 |
| **3. 測試策略** | P1 | 24 天 | **55-65 天** | +31-41 天 |
| **4. 架構優化** | P2 | 36-42 天 | **40-48 天** | +4-6 天 |
| **5. 生產就緒** | P2 | 24-30 天 | **28-36 天** | +4-6 天 |
| **6. 功能擴展** | P1/P2 | 12-16 週 | **15-20 週** | +3-4 週 |
| **總計** | | ~105-117 天 | **~157-186 天（含 F1/F2）** | +~50-70 天 |

> **說明**：工作量大幅增加主要來自建議 3（測試策略）的補充。原估 24 天僅覆蓋框架性測試，補充後 55-65 天涵蓋了完整的業務邏輯邊界測試、外部整合測試和技術棧回歸測試。這反映了一個 400+ 端點、200+ 服務的項目達到 70% 測試覆蓋率的真實投入。

### 修正後實施路線圖

```
                    Q1                    Q2                    Q3                    Q4
                ──────────────────── ──────────────────── ──────────────────── ────────────────
P0 安全加固     [██████████]
P1 測試策略     [████████████████████████████████████████████████████████████████████████████]
P1 代碼品質              [████████████████████████████████████████]
P2 生產就緒     [████████████████████████████████████████]
P2 架構優化                          [████████████████████████████████████████████████████████]
P1 功能擴展框架 [████████████]
P2 功能擴展應用              [████████████████████████████████████████████████████████████████]
DB 遷移                  [████████████]
```

---

*交叉驗證完成日期: 2026-02-27*
*驗證方法: 3 個 Explore Agent 並行對比 Task 3/4/5 → Task 6 覆蓋度*
*發現: 22 項重要遺漏 + 12 項次要遺漏，已全部納入修補*

---

## 第二次交叉驗證補充（5 維度獨立驗證）

> **驗證日期**: 2026-02-27
> **驗證方法**: 5 個獨立 Explore Agent 並行驗證
> - Agent 1: Task 3（E2E 流程）→ Task 6 覆蓋度（評分 7/10）
> - Agent 2: Task 4（設計決策）→ Task 6 覆蓋度（評分 7.2/10）
> - Agent 3: Task 5（安全品質）→ Task 6 覆蓋度（評分 6.5/10）
> - Agent 4: Task 6 vs 實際代碼庫（事實核查，準確率 73.3%）
> - Agent 5: Task 0/1/2（基礎數據）→ Task 6 覆蓋度（評分 6.8/10）
> **綜合評分**: 6.9/10 — 框架完整，數據準確性和覆蓋深度有缺陷
> **發現**: 6 項事實錯誤（已行內勘誤）+ 13 項新結構性遺漏 + 7 項深度不足

---

### 勘誤表（已行內修正）

| # | 位置 | 原值 | 修正值 | 差異性質 |
|---|------|------|--------|---------|
| E1 | 第 53 行 | 38 個寫入端點缺少 Zod 驗證 | **73 個** | 🔴 數字錯誤（差異 92%） |
| E2 | 第 150 行 | 18 處 any / 13 檔案 | TASK5=21 處/15 檔案；**實際代碼=13 處**（三方矛盾） | 🔴 統計口徑不一致 |
| E3 | 第 218 行 | system-config.service.ts 1,553 LOC | **1,373 LOC**（差 10.4%） | 🟡 數據過期或版本差異 |
| E4 | 第 184 行 | `n8n-health.service.ts` | 正確路徑 `src/services/n8n/n8n-health.service.ts` | 🟡 路徑不完整 |
| E5 | 第 435 行 | unified-processor 21 個文件 | **22 個**（含 index.ts） | 🟢 計數遺漏 |
| E6 | 第 435 行 | extraction-v3 20 個文件 | **21 個**（含 CLAUDE.md） | 🟢 計數遺漏 |

**E2 `any` 類型三方矛盾說明**：
- TASK5 使用廣泛搜尋（含 `as any`、`eslint-disable` 等模式），統計 21 處 / 15 檔案
- TASK6 原文引用時錯誤縮減為 18 處 / 13 檔案
- 事實核查 Agent 僅搜尋 `: any` 聲明，找到 13 處
- **建議**：實施前以 `grep -rn "any" --include="*.ts" | grep -v node_modules | grep -E "(: any|as any|\<any\>)"` 重新統計

---

### 補充 G：決策治理與投入產出比（Task 4 驗證發現 — 完全缺失）

> **問題核心**：Task 6 的 6 個建議投入 157-186 天，但完全缺乏「為什麼值得這樣投入」的論證。

#### G1. 決策間依賴矩陣（TASK4 第 1031-1042 行）

**遺漏**：TASK4 明確定義了 8 個設計決策的依賴關係圖，Task 6 的實施順序未參考此圖。

**補充**：

```
決策 8（平台定位）── 最上層，所有決策服務於此
  ├─→ 決策 1（三層映射）── 建議 4 Phase 2 涉及
  ├─→ 決策 2（V3.1 管線）── 建議 4 Phase 1-2 涉及
  │     ├─→ 決策 3（信心度路由）── 建議 4 Phase 1 涉及
  │     └─→ 決策 4（統一處理器）── 建議 4 Phase 2-3 涉及
  ├─→ 決策 7（Python 微服務）── 建議 5 涉及
  ├─→ 決策 5（Company 重構）── 補充 F1 涉及
  └─→ 決策 6（技術棧）── 建議 6 涉及
```

**實施順序約束**（從依賴圖推導）：
- 建議 4 Phase 1（信心度統一）必須在 Phase 2（管線統一）之前
- 建議 4 Phase 2 必須在建議 6 的功能擴展框架之前（新框架基於統一管線）
- 補充 F1（Company 遷移）應在建議 4 Phase 2 之前（V3.1 Stage 1 依賴 Company 識別）
- 建議 5（CI/CD + 監控）應在建議 4 Phase 3（灰度遷移）之前（灰度需要監控支撐）

#### G2. 投入產出比（ROI）框架

**遺漏**：TASK4 第 946-959 行定義了明確的成功指標，但 Task 6 建議未量化預期收益。

**補充 — 各建議的預期 ROI**：

| 建議 | 投入 | 預期收益 | ROI 指標 |
|------|------|---------|---------|
| 1. 安全加固 | 10 天 | 消除數據洩露風險；合規審計通過 | 安全事件歸零 |
| 2. 代碼品質 | 24-27 天 | 維護效率提升 30-40%；新人 onboarding 時間縮短 | 月均 bug 數↓30% |
| 3. 測試策略 | 55-65 天 | 回歸 bug 減少 70%+；部署信心提升 | 回歸缺陷率 <5% |
| 4. 架構優化 | 40-48 天 | 管線維護成本↓50%（42→25 個文件）；新功能開發提速 | 單次提取延遲不變 |
| 5. 生產就緒 | 28-36 天 | 部署頻率從手動→每日；uptime 99.5%→99.9% | MTTR <15 分鐘 |
| 6. 功能擴展 | 15-20 週 | 支援新文件類型；目標市場擴大 3x | 新文件類型 <4 週上線 |

**對標 TASK4 平台成功指標**：
- 年省 35-40K 人時 → 建議 4+6 直接貢獻（統一管線 + 新文件類型 = 擴大自動化範圍）
- 自動化率 ≥90% → 建議 3 間接貢獻（測試覆蓋確保自動化路徑可靠）
- AI 準確率 ≥90% → 建議 1+3 間接貢獻（安全 + 測試確保信心度計算正確）

#### G3. 設計哲學對齊檢查

**遺漏**：TASK4 歸納了四大設計哲學，Task 6 建議未系統對齊。

**補充 — 各建議的哲學對齊**：

| 哲學 | 對齊情況 | 改進建議 |
|------|---------|---------|
| **分層漸進** | ⚠️ 建議 2 大文件拆分未按業務重要性分層 | 先拆映射/提取相關（決策 1/2），再拆通用服務 |
| **成本敏感** | ❌ 建議 3 投入 55-65 天未評估替代方案（如僅 P0 核心 90%，P1 延後） | 測試策略應有「最小可行測試」（30 天）和「完整測試」（65 天）兩個方案 |
| **業務驅動** | ⚠️ 建議 6 功能擴展未評估各方向對年省目標的貢獻度 | SAP 整合年省多少人時？多語言 OCR 覆蓋多少新城市？ |
| **持續演進** | ⚠️ 缺乏「監控→決策調優」反饋迴路 | 信心度權重應根據歷史準確率數據定期自動調優 |

---

### 補充 H：業務功能完整性遺漏（Task 3 + Task 0/1/2 驗證發現）

#### H1. FieldExtractionFeedback 模型（CHANGE-042）— 完全遺漏

**來源**：TASK3 場景 1 第 218 行

**問題**：CHANGE-042 引入了 `FieldExtractionFeedback` 模型，追蹤「定義欄位 vs 實際提取欄位」的差異和覆蓋率。這是持續改進的核心機制，但 Task 6 完全未提及。

**應納入**：
- 建議 3 Phase 2 新增 `feedback-aggregation.service.ts` 測試（+1 天）
- 建議 4 Phase 1 統一信心度計算時，應整合 Feedback 數據作為第 7 維度

#### H2. 參考編號/匯率主檔維護機制 — 完全遺漏

**來源**：TASK3 場景 1 第 87-88 行

**問題**：`ReferenceNumber.findMany()` 和 `ExchangeRate.findMany()` 依賴主檔數據的及時更新，但無定時更新任務、過期清理策略。

**應納入**：
- 建議 5 新增監控指標：`reference_master_stale_count`、`exchange_rate_update_delay_hours`
- 建議 6 功能擴展新增：定時匯率同步任務（+2-3 天）

#### H3. 通知系統消息隊列 — 完全遺漏

**來源**：TASK3 場景 2 第 327、337、521 行

**問題**：規則建議通知、回滾通知、批量完成通知均依賴 Nodemailer 直接發送，無消息隊列、重試邏輯、交付狀態追蹤。

**應納入**：
- 建議 5 Phase 2 新增「Notification Service 升級」（+2 天）：
  - 消息隊列（Bull/BullMQ 或 Redis Pub/Sub）
  - 重試策略（指數退避，最多 3 次）
  - Dead Letter Queue 管理

#### H4. 大文件分片上傳 — 完全遺漏

**來源**：TASK3 場景 1 第 72 行（50MB 上限）

**問題**：當前上傳限制 50MB，無分片上傳機制，限制了大型文件處理能力。

**應納入**：建議 6 功能擴展新增「Large File Handling」（+5-7 天），包含 Azure Blob multipart upload + 進度追蹤

#### H5. 詞彙聚類邊界測試（0.85 vs 0.8）

**來源**：TASK3 場景 3 第 595-617 行

**問題**：批量處理的詞彙聚合使用 Levenshtein 相似度 0.85 閾值，但建議 3 補充 C6 中誤引為 0.8。

**應納入**：建議 3 Phase 1 或 Phase 2.5 新增 `term-aggregation.service.ts` 邊界測試（+2 天），正確閾值為 0.85

#### H6. Phase 2 CHANGE 功能測試缺失

**來源**：BATCH1-FEATURE-MAPPING.md

**問題**：以下近期 CHANGE 功能完全未納入建議 3 的測試計劃：

| CHANGE | 功能 | 測試需求 |
|--------|------|---------|
| CHANGE-041 | 文件列表批量匹配 UI | E2E 測試 |
| CHANGE-043/044/045 | Line Item 聚合與模板系統 | 單元 + 整合測試 |
| CHANGE-049 | User Profile 頁 | E2E 測試 |
| CHANGE-050 | System Settings Hub | E2E 測試 |

**應納入**：建議 3 Phase 3（E2E）新增上述功能的場景測試（+3-4 天）

---

### 補充 I：品質覆蓋度擴展（Task 5 驗證發現）

#### I1. 85 個內聯 Zod Schema 遷移計劃 — 完全遺漏

**來源**：TASK5 審計 2 第 161-177 行

**問題**：除了建議 1 新增的 6 個共享 Schema 外，還有 85 個 Zod Schema 內聯在 route.ts 中，無統一管理。

**應納入**：建議 2 新增「階段 5：Zod Schema 統一」（+3 天）
- Phase 1：提取高頻共享 Schema（auth、pagination、sorting）— 1 天
- Phase 2：按領域建立 Schema 文件（document、rule、company 等）— 2 天

#### I2. 20 處 eslint-disable 針對 any 的移除

**來源**：TASK5 第 696 行

**問題**：除了修復 any 類型本身，還有 20 處 `eslint-disable` 註解壓制了 any 警告，需逐一評估是否可移除。

**應納入**：建議 2 階段 1 第 5 點新增 +0.5 天，逐一評估 20 處 eslint-disable

#### I3. auth.config.ts 以外的安全敏感 Log

**來源**：TASK5 審計 3

**問題**：建議 1 P0 僅處理 auth.config.ts 的 9 個 log，但其他認證/授權相關文件可能也包含敏感信息。

**應納入**：建議 1 階段 1 新增「安全敏感 Log 全面掃描」（+0.5 天），搜尋所有包含 `password`、`token`、`secret`、`credential` 關鍵字的 console.log

---

### 補充 J：架構層與設計決策深度（Task 4 + Task 0/1/2 驗證發現）

#### J1. L8 i18n 層同步檢查 — 完全遺漏

**來源**：BATCH1-ARCH-LAYERS.md L8 分析

**問題**：34 個 i18n 命名空間 × 3 語言 = 102 個 JSON 文件的同步一致性，在建議 1-6 中完全未提及。

**應納入**：
- 建議 2 新增「i18n 同步檢查自動化」（+1 天）：將現有 `npm run i18n:check` 整合至 CI/CD
- 建議 5 Phase 2 的 GitHub Actions 中加入 i18n 一致性檢查步驟

#### J2. V2/V3 回退觸發標準與適配器風險

**來源**：TASK4 決策 4 第 523-555 行

**問題**：建議 4 Phase 3 規劃了灰度遷移，但未定義回退的**具體觸發條件**。

**補充**：

| 觸發條件 | 回退動作 | 監控指標 |
|---------|---------|---------|
| V3 處理超時 >30s | 當次請求回退 V2 | `extraction_v3_timeout_total` |
| V3 錯誤率 >5%（5 分鐘窗口） | 自動暫停 V3，全量回退 V2 | `extraction_v3_error_rate_5m` |
| V3 信心度平均值 <70%（1 小時窗口） | 告警 + 手動決策 | `extraction_v3_confidence_avg_1h` |
| V2 也失敗 | 記錄 + 人工隊列 | `extraction_fallback_to_manual_total` |

**V3→V2 適配器數據轉換風險**：`StandardFieldsV3` → `InvoiceData` 的欄位映射可能丟失 V3.1 新增的參考編號和匯率欄位，需在適配器中增加 fallback 預設值。

#### J3. Forwarder 遺留引用系統清理

**來源**：TASK4 決策 5 第 664 行

**問題**：~800+ 個 `forwarder` 引用分佈在 149 個文件中，補充 F1 僅規劃了資料庫遷移，應用層代碼遷移計劃缺失。

**應納入**：建議 2 新增「Forwarder 遺留引用清理」（+3-5 天）
- Phase 1：自動化掃描（1 天）— 使用 codemod 識別所有 `forwarder`/`Forwarder`/`FORWARDER` 引用
- Phase 2：分批替換（2-4 天）— 按目錄優先級（services → components → types → tests）

#### J4. Company 新欄位利用計劃

**來源**：TASK4 決策 5 第 639-654 行

**問題**：Company model 新增了 `type`、`source`、`nameVariants`、`mergedIntoId` 四個欄位，但無利用路線圖。

**應納入**：建議 6 功能擴展新增：
- `nameVariants` 模糊匹配 → Stage 1 公司識別準確率提升（+2 天）
- `mergedIntoId` 合併檢測 → 避免重複公司記錄（+1 天）
- `type` / `source` 分類 → Company 列表篩選和報表（+1 天）

#### J5. Python 微服務容器化與故障恢復

**來源**：TASK4 決策 7 第 833-889 行

**問題**：建議 5 Phase 1 的 Dockerfile 僅針對 Node.js，Python 服務的容器化、健康檢查和故障恢復策略不完整。

**補充至建議 5 Phase 1（+2 天）**：
- `python-services/Dockerfile.extraction`（multi-stage，port 8000）
- `python-services/Dockerfile.mapping`（multi-stage，port 8001）
- docker-compose.yml 新增 `python-extraction` 和 `python-mapping` services
- 健康檢查：`/health` endpoint + `restart: unless-stopped`
- 故障恢復：Node.js → Python 請求超時 30s → 指數退避重試（最多 3 次）

#### J6. KPI 監控儀表板

**來源**：TASK4 決策 8 第 946-959 行

**問題**：TASK4 定義了明確的成功指標（自動化率 ≥90%、準確率 ≥90%、年省 35K 人時），但建議 5 的 Grafana 儀表板規劃未包含業務 KPI。

**應納入**：建議 5 Phase 2 Grafana 儀表板新增「Business KPI Dashboard」（+1.5 天）：

| KPI | 計算方式 | 數據來源 |
|-----|---------|---------|
| 自動化率 | AUTO_APPROVE / Total Documents | ExtractionResult.routingDecision |
| 準確率 | 正確提取 / 總提取 | FieldExtractionFeedback |
| 月省人時 | (自動化文件數 × 平均手動處理時間) | Document + SystemConfig |
| 平均處理時間 | 提交→完成的中位時間 | Document.createdAt → completedAt |

#### J7. 依賴包版本審計

**來源**：ANALYSIS-RAW-DATA.md

**問題**：77 個 production 依賴包的版本安全性未被建議 1 的安全加固覆蓋。

**應納入**：建議 1 階段 2 新增（+0.5 天）：
- `npm audit` 整合至 CI/CD
- Dependabot 或 Renovate 自動化版本更新

---

### 修正後建議最終總覽

| 建議 | 優先級 | 第一次修正 | 第二次修正 | 新增工作量 | 來源 |
|------|--------|-----------|-----------|-----------|------|
| **1. 安全加固** | P0 | 10 天 | **11 天** | +1 天 | I3 安全 log 掃描 + J7 依賴審計 |
| **2. 代碼品質** | P1 | 24-27 天 | **31-36 天** | +7-9 天 | I1 Zod 統一 + I2 eslint-disable + J1 i18n + J3 Forwarder 清理 |
| **3. 測試策略** | P1 | 55-65 天 | **61-72 天** | +6-7 天 | H1 Feedback + H5 詞彙聚類 + H6 CHANGE 功能 |
| **4. 架構優化** | P2 | 40-48 天 | **42-51 天** | +2-3 天 | J2 回退標準 + H1 Feedback 整合 |
| **5. 生產就緒** | P2 | 28-36 天 | **34-42 天** | +5.5-6 天 | H2 主檔監控 + H3 通知隊列 + J5 Python 容器 + J6 KPI |
| **6. 功能擴展** | P1/P2 | 15-20 週 | **17-23 週** | +2-3 週 | H4 大文件 + J4 Company 欄位 |
| **總計** | | ~157-186 天 | **~179-212 天（含功能擴展）** | +22-26 天 | |

### 修正後實施路線圖

```
                    Q1                    Q2                    Q3                    Q4
                ──────────────────── ──────────────────── ──────────────────── ────────────────
P0 安全加固     [███████████]
P1 測試策略     [██████████████████████████████████████████████████████████████████████████████████████]
P1 代碼品質              [██████████████████████████████████████████████████]
P2 生產就緒     [██████████████████████████████████████████████████]
P2 架構優化                          [██████████████████████████████████████████████████████████████]
P1 功能擴展框架 [████████████████]
P2 功能擴展應用              [██████████████████████████████████████████████████████████████████████]
DB 遷移                  [████████████]
Forwarder清理            [██████████]
KPI 儀表板      [████████]
```

### 第二次驗證後的信心度評估

| 維度 | 補充前 | 補充後 | 說明 |
|------|--------|--------|------|
| 數據準確性 | 73.3% | **~95%** | 6 項行內勘誤 + E2 三方矛盾已標註 |
| Task 3 覆蓋度 | 7/10 | **8.5/10** | H1-H6 補充 6 項業務功能遺漏 |
| Task 4 覆蓋度 | 7.2/10 | **8.8/10** | G1-G3 + J2-J6 補充決策治理和設計深度 |
| Task 5 覆蓋度 | 6.5/10 | **8.5/10** | I1-I3 補充品質覆蓋擴展 |
| Task 0/1/2 覆蓋度 | 6.8/10 | **9/10** | J1 + J7 補充架構層和依賴審計 |
| **綜合評分** | **6.9/10** | **~8.6/10** | 主要殘餘風險：E2 any 統計需實施前重新確認 |

### 殘餘已知風險（無法在報告層面解決）

1. **`any` 類型統計三方矛盾** — 需實施前以統一搜尋模式重新確認（建議使用 ESLint `@typescript-eslint/no-explicit-any` 規則掃描）
2. **system-config.service.ts 行數差異** — 可能是分析期間有過修改，實施拆分前應重新確認當前行數
3. **建議 3 測試投入過大** — 61-72 天可能超出團隊承受能力，建議準備「最小可行測試方案」（~35 天，僅覆蓋 P0 核心 90%）作為備選
4. **功能擴展 ROI 未量化** — SAP 整合和多語言 OCR 的預期增量收益需要業務團隊提供數據

---

*第二次交叉驗證完成日期: 2026-02-27*
*驗證方法: 5 個獨立 Explore Agent（Task 3/4/5/代碼事實核查/Task 0-1-2）*
*發現: 6 項事實錯誤（已行內勘誤）+ 13 項新結構性遺漏 + 7 項深度不足，已全部納入修補*
*累計修補: 第一次 22+12 項 + 第二次 6+13+7 項 = 60 項*
