# AI Document Extraction Project — 功能架構映射

> 分析日期: 2026-02-13
> 版本: V1.0
> 分析範圍: 全專案功能模組
> 分析方法: 靜態代碼結構掃描 + 檔案路徑映射

---

## 目錄

1. [功能模組總覽](#1-功能模組總覽)
2. [各功能模組詳細映射](#2-各功能模組詳細映射)
3. [功能實現狀態矩陣](#3-功能實現狀態矩陣)
4. [跨功能依賴圖](#4-跨功能依賴圖)
5. [i18n 覆蓋狀態](#5-i18n-覆蓋狀態)
6. [功能複雜度評估](#6-功能複雜度評估)

---

## 1. 功能模組總覽

### 1.1 全域量化指標

| 指標 | 數量 | 說明 |
|------|------|------|
| 頁面路由 (page.tsx) | 73 | 6 auth + 67 dashboard |
| 功能組件 (features/*.tsx) | 292 | 分佈於 47 個功能子目錄 |
| UI 基礎組件 (ui/*.tsx) | 34 | shadcn/ui Radix primitives |
| 佈局組件 (layout/*.tsx) | 5 | Sidebar, TopBar, DashboardLayout 等 |
| API 路由 (route.ts) | 319 | 分佈於 admin/v1/頂層 3 個域 |
| 業務服務 (services/*.ts) | 179 | 含 extraction-v3, unified-processor 等子域 |
| 自定義 Hooks | 101 | src/hooks/ |
| Zustand Stores | 2 | reviewStore, document-preview-test-store |
| React Context | 2 | DashboardFilterContext, DateRangeContext |
| Prisma Models | 119 | prisma/schema.prisma |
| TypeScript 型別定義 | 88 | src/types/ 含 external-api/ 子目錄 |
| Zod Schema | 8 | src/lib/validations/ |
| i18n 命名空間 | 31 | 每語言 31 個 JSON × 3 語言 = 93 檔案 |
| 使用 useTranslations 的檔案 | 234 | 全專案掃描 |
| Lib 工具模組 | 65 | src/lib/ |

### 1.2 功能域地圖

```
AI Document Extraction Platform
├── A. 認證與授權 ─────────── 6 頁面 / 3 組件 / 7 API / 8 lib 檔
├── B. 文件管理 ───────────── 3 頁面 / 15 組件 / 19 API / 14 服務
├── C. 文件提取管線 ────────── 0 頁面 / 0 組件 / 3 API / 40 服務 (核心後端)
├── D. 審核流程 ───────────── 2 頁面 / 27 組件 / 5 API / 5 服務
├── E. 規則管理 ───────────── 7 頁面 / 22 組件 / 20 API / 10 服務
├── F. 公司/Forwarder 管理 ── 6 頁面 / 14 組件 / 14 API / 5 服務
├── G. 文件格式管理 ────────── 1 頁面 / 17 組件 / 6 API / 2 服務
├── H. 三層映射系統 ────────── 0 頁面 / 9 組件 / 10 API / 7 服務
├── I. 四層配置繼承 ────────── 9 頁面 / 21 組件 / 19 API / 5 服務
├── J. 範本系統 ───────────── 5 頁面 / 32 組件 / 18 API / 5 服務
├── K. 升級處理 ───────────── 2 頁面 / 6 組件 / 3 API / 1 服務
├── L. 報表系統 ───────────── 4 頁面 / 3 組件 / 17 API / 6 服務
├── M. Admin 管理系統 ─────── 20 頁面 / 43 組件 / 104 API / 20+ 服務
├── N. 外部整合 ───────────── 1 頁面 / 5 組件 / 15 API / 12 服務
├── O. 匯率管理 ───────────── 3 頁面 / 6 組件 / 7 API / 1 服務
├── P. 參考編號管理 ────────── 3 頁面 / 8 組件 / 5 API / 1 服務
├── Q. 文件預覽系統 ────────── 1 頁面 / 9 組件 / 1 API / 0 服務
├── R. 稽核系統 ───────────── 1 頁面 / 3 組件 / 7 API / 3 服務
├── S. Dashboard ───────────── 1 頁面 / 0 組件 / 5 API / 1 服務
├── T. 全域統計 ───────────── 1 頁面 / 4 組件 / 3 API / 1 服務
└── U. 信心度系統 ─────────── 0 頁面 / 3 組件 / 2 API / 1 服務
```

### 1.3 按業務流程分類

**核心處理鏈**: 文件上傳 → OCR 提取 → AI 分類 → 欄位映射 → 範本比對 → 匯率轉換 → 品質保證 → 審核 → 匯出

| 業務階段 | 涉及功能模組 |
|----------|-------------|
| **文件輸入** | B.文件管理 + N.外部整合 (SharePoint/Outlook) |
| **智能處理** | C.文件提取管線 + H.三層映射 + U.信心度 |
| **配置驅動** | I.四層配置 + G.格式管理 + E.規則管理 |
| **人工審核** | D.審核流程 + K.升級處理 |
| **資料輸出** | J.範本系統 + L.報表系統 + O.匯率管理 |
| **系統管理** | A.認證授權 + M.Admin + F.公司管理 |
| **監控分析** | S.Dashboard + T.全域統計 + R.稽核 |

---

## 2. 各功能模組詳細映射

### 2.1 認證與授權系統 (Auth & Authorization)

#### 頁面路由 (6 個)

| 路由 | 檔案路徑 |
|------|---------|
| `/auth/login` | `src/app/[locale]/(auth)/auth/login/page.tsx` |
| `/auth/register` | `src/app/[locale]/(auth)/auth/register/page.tsx` |
| `/auth/forgot-password` | `src/app/[locale]/(auth)/auth/forgot-password/page.tsx` |
| `/auth/reset-password` | `src/app/[locale]/(auth)/auth/reset-password/page.tsx` |
| `/auth/verify-email` | `src/app/[locale]/(auth)/auth/verify-email/page.tsx` |
| `/auth/error` | `src/app/[locale]/(auth)/auth/error/page.tsx` |

#### 組件 (3 個)

| 組件 | 路徑 |
|------|------|
| `LoginForm` | `src/components/features/auth/LoginForm.tsx` |
| `RegisterForm` | `src/components/features/auth/RegisterForm.tsx` |
| `DevLoginForm` | `src/components/features/auth/DevLoginForm.tsx` |

#### API 路由 (7 個)

| 端點 | 路徑 |
|------|------|
| NextAuth Handler | `src/app/api/auth/[...nextauth]/route.ts` |
| 註冊 | `src/app/api/auth/register/route.ts` |
| 忘記密碼 | `src/app/api/auth/forgot-password/route.ts` |
| 重設密碼 | `src/app/api/auth/reset-password/route.ts` |
| 驗證 Email | `src/app/api/auth/verify-email/route.ts` |
| 重發驗證 | `src/app/api/auth/resend-verification/route.ts` |
| 驗證重設 Token | `src/app/api/auth/verify-reset-token/route.ts` |

#### 核心服務與工具

| 層級 | 檔案 | 職責 |
|------|------|------|
| Auth 配置 | `src/lib/auth.config.ts` | NextAuth 配置（Azure AD SSO + Credentials） |
| Auth 核心 | `src/lib/auth.ts` | Session 管理、JWT 策略 |
| Auth 工具 | `src/lib/auth/index.ts` | Auth 工具函數匯出 |
| API Key | `src/lib/auth/api-key.service.ts` | API Key 認證 |
| 城市權限 | `src/lib/auth/city-permission.ts` | 城市級別存取控制 |
| 密碼 | `src/lib/password.ts` | bcrypt 密碼雜湊 |
| Token | `src/lib/token.ts` | JWT Token 生成驗證 |
| Email | `src/lib/email.ts` | Nodemailer 驗證郵件 |

#### Hooks (1 個)

- `use-auth.ts` — 認證狀態管理

#### 中間件

| 檔案 | 職責 |
|------|------|
| `src/middleware.ts` | Next.js 中間件 (CORS → i18n → auth → route guard) |
| `src/middlewares/audit-log.middleware.ts` | API 稽核日誌記錄 |
| `src/lib/middleware/n8n-api.middleware.ts` | n8n API 認證中間件 |

#### RBAC 系統

- **Prisma Models**: `User`, `Account`, `Session`, `VerificationToken`, `Role`, `UserRole`, `UserCityAccess`, `UserRegionAccess`
- **權限定義**: `src/types/permissions.ts` (22 permissions)
- **角色定義**: `src/types/role.ts` + `src/types/role-permissions.ts` (6 roles: SUPER_ADMIN, ADMIN, MANAGER, REVIEWER, OPERATOR, VIEWER)
- **權限分類**: `src/types/permission-categories.ts`

---

### 2.2 文件管理系統 (Document Management)

#### 頁面路由 (3 個)

| 路由 | 檔案路徑 |
|------|---------|
| `/documents` | `src/app/[locale]/(dashboard)/documents/page.tsx` |
| `/documents/upload` | `src/app/[locale]/(dashboard)/documents/upload/page.tsx` |
| `/documents/[id]` | `src/app/[locale]/(dashboard)/documents/[id]/page.tsx` |

#### 組件 (15 個)

**文件列表與上傳 (4)**:
- `DocumentListTable.tsx` — 文件列表表格
- `FileUploader.tsx` — 文件上傳器
- `ProcessingStatus.tsx` — 處理狀態顯示
- `RetryButton.tsx` — 重試按鈕

**文件詳情 (7)**:
- `detail/AiDetailsTab.tsx` — AI 提取詳情頁籤
- `detail/DocumentAuditLog.tsx` — 文件稽核日誌
- `detail/DocumentDetailHeader.tsx` — 詳情頁頭
- `detail/DocumentDetailStats.tsx` — 統計摘要
- `detail/DocumentDetailTabs.tsx` — 頁籤容器
- `detail/ProcessingTimeline.tsx` — 處理時間線
- `detail/SmartRoutingBanner.tsx` — 智能路由橫幅

**文件來源 (5)**:
- `document-source/DocumentSourceBadge.tsx`
- `document-source/DocumentSourceDetails.tsx`
- `document-source/SourceTypeFilter.tsx`
- `document-source/SourceTypeStats.tsx`
- `document-source/SourceTypeTrend.tsx`

#### API 路由 (19 個)

| 端點 | 方法 | 路徑 |
|------|------|------|
| 文件列表/建立 | GET/POST | `src/app/api/documents/route.ts` |
| 文件詳情 | GET/PATCH/DELETE | `src/app/api/documents/[id]/route.ts` |
| 文件上傳 | POST | `src/app/api/documents/upload/route.ts` |
| 觸發處理 | POST | `src/app/api/documents/[id]/process/route.ts` |
| 處理進度 | GET | `src/app/api/documents/[id]/progress/route.ts` |
| 重試處理 | POST | `src/app/api/documents/[id]/retry/route.ts` |
| Blob 存取 | GET | `src/app/api/documents/[id]/blob/route.ts` |
| 來源資訊 | GET | `src/app/api/documents/[id]/source/route.ts` |
| 追蹤資訊 | GET | `src/app/api/documents/[id]/trace/route.ts` |
| 追蹤報告 | GET | `src/app/api/documents/[id]/trace/report/route.ts` |
| 搜尋 | GET | `src/app/api/documents/search/route.ts` |
| 處理中列表 | GET | `src/app/api/documents/processing/route.ts` |
| 處理統計 | GET | `src/app/api/documents/processing/stats/route.ts` |
| 來源統計 | GET | `src/app/api/documents/sources/stats/route.ts` |
| 來源趨勢 | GET | `src/app/api/documents/sources/trend/route.ts` |
| SharePoint 匯入 | POST | `src/app/api/documents/from-sharepoint/route.ts` |
| SharePoint 狀態 | GET | `src/app/api/documents/from-sharepoint/status/[fetchLogId]/route.ts` |
| Outlook 匯入 | POST | `src/app/api/documents/from-outlook/route.ts` |
| Outlook 狀態 | GET | `src/app/api/documents/from-outlook/status/[fetchLogId]/route.ts` |

#### 服務層

| 服務 | 檔案 | 職責 |
|------|------|------|
| 文件 CRUD | `src/services/document.service.ts` | 文件基本操作 |
| 文件格式 | `src/services/document-format.service.ts` | 格式辨識管理 |
| 文件發行者 | `src/services/document-issuer.service.ts` | 發行者識別 |
| 文件進度 | `src/services/document-progress.service.ts` | 處理進度追蹤 |
| 文件來源 | `src/services/document-source.service.ts` | 來源管理 |
| 文件處理 | `src/services/document-processing/index.ts` | 處理管線入口 |
| 映射管線步驟 | `src/services/document-processing/mapping-pipeline-step.ts` | 映射管線 |
| 處理路由 | `src/services/processing-router.service.ts` | 智能路由決策 |
| 處理統計 | `src/services/processing-stats.service.ts` | 處理統計 |
| 結果持久化 | `src/services/processing-result-persistence.service.ts` | 結果存儲 |
| 結果檢索 | `src/services/result-retrieval.service.ts` | 結果查詢 |
| 檔案偵測 | `src/services/file-detection.service.ts` | 文件類型偵測 |
| 追溯性 | `src/services/traceability.service.ts` | 完整追蹤鏈 |
| 任務狀態 | `src/services/task-status.service.ts` | 任務狀態管理 |

#### Hooks (6 個)

- `use-document.ts` — 單一文件操作
- `use-documents.ts` — 文件列表查詢
- `use-document-detail.ts` — 文件詳情
- `use-document-progress.ts` — 處理進度輪詢
- `use-document-formats.ts` — 格式列表
- `use-pdf-preload.ts` — PDF 預載

#### 資料庫 Models

`Document`, `OcrResult`, `ExtractionResult`, `DocumentProcessingStage`, `DocumentFormat`, `ProcessingQueue`

---

### 2.3 文件提取管線 (Extraction Pipeline V3/V3.1)

#### 架構概覽

```
V3.1 九步驟管線:
┌──────────┐  ┌───────────┐  ┌──────────────┐  ┌──────────────────┐
│ 1. OCR   │→│ 2. 驗證    │→│ 3. AI 提取    │→│ 4. AI 分類        │
│ (Azure)  │  │ (結果校驗) │  │ (GPT-5.2)    │  │ (公司/格式識別)   │
└──────────┘  └───────────┘  └──────────────┘  └──────────────────┘
       ↓
┌──────────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐
│ 5. 欄位映射  │→│ 6. 資料比對 │→│ 7. 匯率轉換   │→│ 8. 後處理     │→│ 9. QA      │
│ (三層映射)   │  │ (範本匹配) │  │ (自動換算)    │  │ (正規化)     │  │ (信心度)   │
└──────────────┘  └────────────┘  └──────────────┘  └──────────────┘  └────────────┘
```

#### 核心服務 — extraction-v3/ (17 個)

| 檔案 | 職責 |
|------|------|
| `extraction-v3.service.ts` | V3 管線主入口 |
| `unified-gpt-extraction.service.ts` | 統一 GPT 提取 |
| `confidence-v3.service.ts` | V3 信心度計算 |
| `confidence-v3-1.service.ts` | V3.1 信心度計算 (6 維度) |
| `prompt-assembly.service.ts` | 提示詞組裝 |
| `result-validation.service.ts` | 結果驗證 |
| `stages/stage-orchestrator.service.ts` | 階段調度器 |
| `stages/stage-1-company.service.ts` | 階段1: 公司識別 |
| `stages/stage-2-format.service.ts` | 階段2: 格式識別 |
| `stages/stage-3-extraction.service.ts` | 階段3: 欄位提取 |
| `stages/gpt-caller.service.ts` | GPT 呼叫服務 |
| `stages/exchange-rate-converter.service.ts` | 匯率轉換 |
| `stages/reference-number-matcher.service.ts` | 參考號匹配 |
| `utils/pdf-converter.ts` | PDF 轉換 |
| `utils/prompt-builder.ts` | 提示詞建構 |
| `utils/prompt-merger.ts` | 提示詞合併 |
| `utils/variable-replacer.ts` | 變數替換 |

#### 核心服務 — unified-processor/ (20 個)

| 檔案 | 職責 |
|------|------|
| `unified-document-processor.service.ts` | 統一處理器主入口 |
| `factory/step-factory.ts` | 步驟工廠 |
| `interfaces/step-handler.interface.ts` | 步驟介面 |
| **Steps (11 個)** | |
| `steps/file-type-detection.step.ts` | 檔案類型偵測 |
| `steps/azure-di-extraction.step.ts` | Azure DI OCR |
| `steps/issuer-identification.step.ts` | 發行者識別 |
| `steps/format-matching.step.ts` | 格式匹配 |
| `steps/config-fetching.step.ts` | 配置獲取 |
| `steps/routing-decision.step.ts` | 路由決策 |
| `steps/smart-routing.step.ts` | 智能路由 |
| `steps/gpt-enhanced-extraction.step.ts` | GPT 增強提取 |
| `steps/field-mapping.step.ts` | 欄位映射 |
| `steps/confidence-calculation.step.ts` | 信心度計算 |
| `steps/term-recording.step.ts` | 術語記錄 |
| **Adapters (7 個)** | |
| `adapters/confidence-calculator-adapter.ts` | 信心度適配器 |
| `adapters/config-fetcher-adapter.ts` | 配置適配器 |
| `adapters/format-matcher-adapter.ts` | 格式匹配適配器 |
| `adapters/issuer-identifier-adapter.ts` | 發行者適配器 |
| `adapters/legacy-processor.adapter.ts` | 舊版適配器 |
| `adapters/routing-decision-adapter.ts` | 路由適配器 |
| `adapters/term-recorder-adapter.ts` | 術語適配器 |

#### 核心服務 — extraction-v2/ (3 個)

| 檔案 | 職責 |
|------|------|
| `azure-di-document.service.ts` | Azure DI 文件解析 |
| `data-selector.service.ts` | 資料選擇器 |
| `gpt-mini-extractor.service.ts` | GPT Mini 提取 |

#### API 路由 (3 個)

| 端點 | 路徑 |
|------|------|
| V1 提取 | `src/app/api/extraction/route.ts` |
| V3 測試 | `src/app/api/v1/extraction-v3/test/route.ts` |
| V2 測試 | `src/app/api/test/extraction-v2/route.ts` |

#### 外部服務整合

| 服務 | 用途 |
|------|------|
| Azure Document Intelligence | OCR 文字辨識 (`src/services/azure-di.service.ts`) |
| Azure OpenAI (GPT-5.2) | AI 提取與分類 (`src/services/gpt-vision.service.ts`) |
| Azure Blob Storage | 文件存儲 (`src/lib/azure/storage.ts`, `src/lib/azure-blob.ts`) |

#### 信心度計算 — 6 維度

定義於 `src/services/extraction-v3/confidence-v3-1.service.ts`:
1. OCR 品質信心度
2. 公司識別信心度
3. 格式匹配信心度
4. 欄位提取信心度
5. 映射準確度信心度
6. 資料一致性信心度

---

### 2.4 審核流程系統 (Review Workflow)

#### 頁面路由 (2 個)

| 路由 | 檔案路徑 |
|------|---------|
| `/review` | `src/app/[locale]/(dashboard)/review/page.tsx` |
| `/review/[id]` | `src/app/[locale]/(dashboard)/review/[id]/page.tsx` |

#### 組件 (27 個)

**審核面板 (6)**:
- `ReviewPanel/ReviewPanel.tsx` — 審核主面板
- `ReviewPanel/ReviewActions.tsx` — 審核動作列
- `ReviewPanel/FieldEditor.tsx` — 欄位編輯器
- `ReviewPanel/FieldGroup.tsx` — 欄位分組
- `ReviewPanel/FieldRow.tsx` — 欄位行
- `ReviewPanel/QuickReviewMode.tsx` — 快速審核模式

**PDF 檢視器 (5)**:
- `PdfViewer/PdfViewer.tsx` — PDF 檢視器
- `PdfViewer/DynamicPdfViewer.tsx` — 動態 PDF 載入
- `PdfViewer/PdfHighlightOverlay.tsx` — 高亮覆蓋層
- `PdfViewer/PdfLoadingSkeleton.tsx` — 載入骨架
- `PdfViewer/PdfToolbar.tsx` — PDF 工具列

**審核列表與篩選 (7)**:
- `ReviewQueue.tsx`, `ReviewQueueTable.tsx`, `ReviewQueueSkeleton.tsx`
- `ReviewFilters.tsx`, `LowConfidenceFilter.tsx`
- `ReviewDetailLayout.tsx`, `ProcessingPathBadge.tsx`

**信心度顯示 (3)**:
- `ConfidenceBadge.tsx`, `ConfidenceIndicator.tsx`, `ConfidenceTooltip.tsx`

**對話框與驗證 (5)**:
- `ApprovalConfirmDialog.tsx`, `EscalationDialog.tsx`
- `CorrectionTypeDialog.tsx`, `CorrectionTypeSelector.tsx`
- `UnsavedChangesGuard.tsx`

**驗證 (1)**:
- `validation/ValidationMessage.tsx`

#### Zustand Store

- `src/stores/reviewStore.ts` — `useReviewStore` (審核狀態: 當前文件、欄位編輯、修正記錄)

#### API 路由 (5 個)

| 端點 | 路徑 |
|------|------|
| 審核列表 | `src/app/api/review/route.ts` (推測，含於 documents 域) |
| 信心度詳情 | `src/app/api/confidence/[id]/route.ts` |
| 信心度審核 | `src/app/api/confidence/[id]/review/route.ts` |
| 修正模式 | `src/app/api/corrections/patterns/route.ts` |
| 修正模式詳情 | `src/app/api/corrections/patterns/[id]/route.ts` |

#### 服務層

| 服務 | 檔案 |
|------|------|
| 信心度計算 | `src/services/confidence.service.ts` |
| 修正記錄 | `src/services/correction-recording.ts` |
| 模式分析 | `src/services/pattern-analysis.ts` |
| 發票提交 | `src/services/invoice-submission.service.ts` |
| 歷史準確度 | `src/services/historical-accuracy.service.ts` |

#### Hooks (4 個)

- `useReviewDetail.ts` — 審核詳情
- `useReviewQueue.ts` — 審核佇列
- `useApproveReview.ts` — 批准審核
- `useSaveCorrections.ts` — 保存修正

#### 資料庫 Models

`ReviewRecord`, `Correction`, `CorrectionPattern`, `FieldCorrectionHistory`

---

### 2.5 規則管理系統 (Rule Management)

#### 頁面路由 (7 個)

| 路由 | 檔案路徑 |
|------|---------|
| `/rules` | `src/app/[locale]/(dashboard)/rules/page.tsx` |
| `/rules/new` | `src/app/[locale]/(dashboard)/rules/new/page.tsx` |
| `/rules/[id]` | `src/app/[locale]/(dashboard)/rules/[id]/page.tsx` |
| `/rules/[id]/edit` | `src/app/[locale]/(dashboard)/rules/[id]/edit/page.tsx` |
| `/rules/[id]/history` | `src/app/[locale]/(dashboard)/rules/[id]/history/page.tsx` |
| `/rules/review` | `src/app/[locale]/(dashboard)/rules/review/page.tsx` |
| `/rules/review/[id]` | `src/app/[locale]/(dashboard)/rules/review/[id]/page.tsx` |

#### 組件 (22 個 rules + 6 rule-review + 3 rule-version + 6 suggestions = 37 個相關)

**規則核心 (22)**:
- `RuleList.tsx`, `RuleTable.tsx`, `RuleListSkeleton.tsx`
- `RuleDetailView.tsx`, `RuleStatusBadge.tsx`, `RuleSummaryCards.tsx`
- `RuleFilters.tsx`, `ExtractionTypeIcon.tsx`
- `NewRuleForm.tsx`, `RuleCreationPanel.tsx`
- `RuleEditDialog.tsx`, `RuleEditForm.tsx`
- `RuleTestPanel.tsx`, `RuleTestConfig.tsx`, `TestResultComparison.tsx`
- `RulePreviewPanel.tsx`, `RulePatternViewer.tsx`
- `AccuracyMetrics.tsx`, `ImpactStatistics.tsx`, `RuleStats.tsx`
- `BulkRuleActions.tsx`, `RecentApplicationsTable.tsx`

**規則審核 (6)**:
- `rule-review/ReviewDetailPage.tsx`, `ApproveDialog.tsx`, `RejectDialog.tsx`
- `ImpactSummaryCard.tsx`, `SampleCasesTable.tsx`, `SuggestionInfo.tsx`

**版本管理 (3)**:
- `rule-version/RollbackConfirmDialog.tsx`
- `rule-version/VersionCompareDialog.tsx`
- `rule-version/VersionDiffViewer.tsx`

**建議管理 (6)**:
- `suggestions/ImpactAnalysisPanel.tsx`, `ImpactStatisticsCards.tsx`
- `ImpactTimeline.tsx`, `RiskCasesTable.tsx`
- `SimulationConfigForm.tsx`, `SimulationResultsPanel.tsx`

#### API 路由 (20 個)

| 域 | 端點數 | 路徑前綴 |
|-----|-------|---------|
| 規則 CRUD | 3 | `src/app/api/rules/` (route, bulk, bulk/undo) |
| 建議管理 | 8 | `src/app/api/rules/suggestions/` (generate, CRUD, approve, reject, impact, simulate) |
| 測試 | 1 | `src/app/api/rules/test/route.ts` |
| 版本 | 1 | `src/app/api/rules/version/route.ts` |
| 路由配置 | 3 | `src/app/api/routing/` |
| 測試任務 | 4 | `src/app/api/test-tasks/` |

#### 服務層 (10 個)

| 服務 | 檔案 |
|------|------|
| 規則測試 | `src/services/rule-testing.service.ts` |
| 規則變更 | `src/services/rule-change.service.ts` |
| 規則解析 | `src/services/rule-resolver.ts` |
| 規則建議 | `src/services/rule-suggestion-generator.ts` |
| 規則模擬 | `src/services/rule-simulation.ts` |
| 規則準確度 | `src/services/rule-accuracy.ts` |
| 規則指標 | `src/services/rule-metrics.ts` |
| 影響分析 | `src/services/impact-analysis.ts` |
| 規則推斷 (3) | `src/services/rule-inference/` (keyword, position, regex) |

#### Hooks (10 個)

- `useRuleList.ts`, `useRuleDetail.ts`, `useRuleEdit.ts`
- `useRulePreview.ts`, `useRuleTest.ts`, `useTestRule.ts`
- `useCreateRule.ts`, `useRuleApprove.ts`, `useRuleReject.ts`
- `useRuleVersion.ts`

#### 資料庫 Models

`MappingRule`, `RuleVersion`, `RuleApplication`, `RuleChangeRequest`, `RuleTestTask`, `RuleTestDetail`, `RuleSuggestion`, `SuggestionSample`, `RollbackLog`, `RuleCacheVersion`, `BulkOperation`

---

### 2.6 公司/Forwarder 管理

#### 頁面路由 (6 個)

| 路由 | 檔案路徑 |
|------|---------|
| `/companies` | `src/app/[locale]/(dashboard)/companies/page.tsx` |
| `/companies/new` | `src/app/[locale]/(dashboard)/companies/new/page.tsx` |
| `/companies/[id]` | `src/app/[locale]/(dashboard)/companies/[id]/page.tsx` |
| `/companies/[id]/edit` | `src/app/[locale]/(dashboard)/companies/[id]/edit/page.tsx` |
| `/companies/[id]/formats/[formatId]` | `src/app/[locale]/(dashboard)/companies/[id]/formats/[formatId]/page.tsx` |
| `/companies/[id]/rules/[ruleId]/test` | `src/app/[locale]/(dashboard)/companies/[id]/rules/[ruleId]/test/page.tsx` |

#### 組件 (14 個)

**Forwarders (12)**:
- `ForwarderList.tsx`, `ForwarderTable.tsx`, `ForwarderTableSkeleton.tsx`
- `ForwarderDetailView.tsx`, `ForwarderInfo.tsx`, `ForwarderStatsPanel.tsx`
- `ForwarderForm.tsx`, `ForwarderFilters.tsx`, `ForwarderActions.tsx`
- `ForwarderRulesTable.tsx`, `RecentDocumentsTable.tsx`, `LogoUploader.tsx`

**Companies (2)**:
- `CompanyMergeDialog.tsx`, `CompanyTypeSelector.tsx`

#### API 路由 (14 個)

| 域 | 端點 | 路徑 |
|-----|------|------|
| 公司 CRUD | 4 | `src/app/api/companies/` (route, [id], list, check-code) |
| 公司狀態 | 2 | `companies/[id]/activate`, `companies/[id]/deactivate` |
| 公司識別 | 1 | `companies/identify` |
| 公司文件 | 1 | `companies/[id]/documents` |
| 公司規則 | 2 | `companies/[id]/rules/`, `companies/[id]/rules/[ruleId]` |
| 公司統計 | 1 | `companies/[id]/stats` |
| Admin 公司 | 3 | `admin/companies/` ([id], merge, pending) |

#### 服務層 (5 個)

- `company.service.ts` — 公司 CRUD
- `company-auto-create.service.ts` — 自動建立公司
- `company-matcher.service.ts` — 公司匹配
- `forwarder.service.ts` — Forwarder 管理
- `forwarder-identifier.ts` — Forwarder 識別

#### Hooks (6 個)

- `use-companies.ts`, `use-company-detail.ts`, `use-company-formats.ts`
- `useCompanyList.ts`, `useForwarderList.ts`, `use-forwarders.ts`

#### 資料庫 Models

`Company`, `Forwarder`, `ForwarderIdentification`, `FileTransactionParty`

---

### 2.7 文件格式管理

#### 頁面路由 (1 個)

- 嵌套於 `companies/[id]/formats/[formatId]` — `src/app/[locale]/(dashboard)/companies/[id]/formats/[formatId]/page.tsx`

#### 組件 (17 個)

- `FormatList.tsx`, `FormatCard.tsx`, `FormatFilters.tsx`
- `FormatDetailView.tsx`, `FormatBasicInfo.tsx`, `FormatForm.tsx`
- `FormatConfigPanel.tsx`, `ConfigInheritanceInfo.tsx`
- `FormatFilesTable.tsx`, `FormatTermsTable.tsx`
- `IdentificationRulesEditor.tsx`, `KeywordTagInput.tsx`, `LogoPatternEditor.tsx`
- `SourceFieldCombobox.tsx`
- `LinkedMappingConfig.tsx`, `LinkedPromptConfig.tsx`
- `CreateFormatDialog.tsx`

**格式分析 (2)**:
- `format-analysis/CompanyFormatTree.tsx`, `FormatTermsPanel.tsx`

#### API 路由 (6 個 v1)

| 端點 | 路徑 |
|------|------|
| 格式列表/建立 | `src/app/api/v1/formats/route.ts` |
| 格式詳情 | `src/app/api/v1/formats/[id]/route.ts` |
| 格式配置 | `src/app/api/v1/formats/[id]/configs/route.ts` |
| 提取欄位 | `src/app/api/v1/formats/[id]/extracted-fields/route.ts` |
| 格式文件 | `src/app/api/v1/formats/[id]/files/route.ts` |
| 格式術語 | `src/app/api/v1/formats/[id]/terms/route.ts` |

#### 服務層

- `document-format.service.ts` — 格式 CRUD
- `identification/identification.service.ts` — 識別服務

#### Hooks

- `use-document-formats.ts`, `use-format-detail.ts`, `use-format-files.ts`, `use-format-analysis.ts`

#### 資料庫 Models

`DocumentFormat`

---

### 2.8 三層映射系統 (Three-Tier Mapping)

#### 架構

```
Tier 1: Universal Mapping (通用層)
  ├── 覆蓋 70-80% 常見術語
  └── 所有 Forwarder 共用
        ↓ (若不匹配)
Tier 2: Forwarder-Specific Override (特定覆蓋層)
  ├── 只記錄差異映射
  └── 依 Company + Format 查找
        ↓ (若不匹配)
Tier 3: LLM Classification (AI 智能分類)
  ├── GPT-5.2 智能分類
  └── 處理未知新術語
```

#### 組件 (9 個 mapping-config)

- `ConfigSelector.tsx`, `MappingConfigPanel.tsx`
- `MappingPreview.tsx`, `MappingRuleList.tsx`
- `RuleEditor.tsx`, `SortableRuleItem.tsx`
- `SourceFieldSelector.tsx`, `TargetFieldSelector.tsx`, `TransformConfigPanel.tsx`

#### API 路由 (10 個)

| 端點 | 路徑 |
|------|------|
| 映射列表 | `src/app/api/mapping/route.ts` |
| 映射詳情 | `src/app/api/mapping/[id]/route.ts` |
| 欄位映射配置 CRUD | `src/app/api/v1/field-mapping-configs/` (8 routes: route, [id], [id]/rules, [id]/rules/[ruleId], [id]/rules/reorder, [id]/test, [id]/export, import) |

#### 服務層 — mapping/ (7 個)

| 服務 | 檔案 | 職責 |
|------|------|------|
| 配置解析 | `mapping/config-resolver.ts` | 四層配置繼承解析 |
| 動態映射 | `mapping/dynamic-mapping.service.ts` | 動態規則執行 |
| 欄位引擎 | `mapping/field-mapping-engine.ts` | 映射規則引擎 |
| 映射快取 | `mapping/mapping-cache.ts` | 映射結果快取 |
| 來源欄位 | `mapping/source-field.service.ts` | 來源欄位管理 |
| 轉換執行 | `mapping/transform-executor.ts` | 轉換函數執行 |
| 映射主服務 | `mapping.service.ts` | 映射 CRUD |

#### Transform 子系統 (6 個)

| 轉換類型 | 檔案 |
|---------|------|
| 直接映射 | `transform/direct.transform.ts` |
| 串接 | `transform/concat.transform.ts` |
| 分割 | `transform/split.transform.ts` |
| 公式 | `transform/formula.transform.ts` |
| 查找表 | `transform/lookup.transform.ts` |
| 執行器 | `transform/transform-executor.ts` |

#### 資料庫 Models

`MappingRule`, `FieldMappingConfig`, `FieldMappingRule`

---

### 2.9 四層配置繼承體系

#### 架構

```
SYSTEM (系統預設)
  └→ GLOBAL (全域覆蓋)
       └→ COMPANY (公司級別)
            └→ FORMAT (格式級別, 最高優先)
```

**配置類型**:
1. **PromptConfig** — AI 提取/分類提示詞
2. **FieldMappingConfig** — 欄位轉換規則
3. **PipelineConfig** — 處理管線參數

#### 頁面路由 (9 個)

| 路由 | 檔案路徑 |
|------|---------|
| Prompt 配置列表 | `src/app/[locale]/(dashboard)/admin/prompt-configs/page.tsx` |
| Prompt 新增 | `src/app/[locale]/(dashboard)/admin/prompt-configs/new/page.tsx` |
| Prompt 詳情 | `src/app/[locale]/(dashboard)/admin/prompt-configs/[id]/page.tsx` |
| 欄位映射列表 | `src/app/[locale]/(dashboard)/admin/field-mapping-configs/page.tsx` |
| 欄位映射新增 | `src/app/[locale]/(dashboard)/admin/field-mapping-configs/new/page.tsx` |
| 欄位映射詳情 | `src/app/[locale]/(dashboard)/admin/field-mapping-configs/[id]/page.tsx` |
| Pipeline 列表 | `src/app/[locale]/(dashboard)/admin/pipeline-settings/page.tsx` |
| Pipeline 新增 | `src/app/[locale]/(dashboard)/admin/pipeline-settings/new/page.tsx` |
| Pipeline 詳情 | `src/app/[locale]/(dashboard)/admin/pipeline-settings/[id]/page.tsx` |

#### 組件 (21 個)

**Prompt Config (10)**:
- `prompt-config/PromptConfigList.tsx`, `PromptConfigFilters.tsx`, `PromptConfigForm.tsx`
- `PromptEditor.tsx`, `PromptTester.tsx`, `PromptTemplateInserter.tsx`
- `CollapsibleControls.tsx`, `CollapsiblePromptGroup.tsx`
- `ShowMoreButton.tsx`, `TemplatePreviewDialog.tsx`

**Pipeline Config (4)**:
- `pipeline-config/PipelineConfigList.tsx`, `PipelineConfigFilters.tsx`
- `PipelineConfigForm.tsx`, `PipelineConfigScopeBadge.tsx`

**Mapping Config (7)** — 見 2.8 節

#### API 路由 (19 個)

| 域 | 端點數 | 路徑 |
|-----|-------|------|
| Prompt Config | 3 | `v1/prompt-configs/` (route, [id], test) |
| Field Mapping Config | 8 | `v1/field-mapping-configs/` (含 rules, reorder, test, export, import) |
| Pipeline Config | 3 | `v1/pipeline-configs/` (route, [id], resolve) |
| Prompt 解析 | 1 | `api/prompts/resolve` |
| Admin Config | 8 | `admin/config/` (route, [key], [key]/history, [key]/reset, [key]/rollback, export, import, reload) |

#### 服務層 (5 個)

| 服務 | 檔案 |
|------|------|
| Pipeline 配置 | `pipeline-config.service.ts` |
| Prompt 解析器 | `prompt-resolver.service.ts` |
| Prompt 工廠 | `prompt-resolver.factory.ts` |
| Prompt 快取 | `prompt-cache.service.ts` |
| Prompt 合併引擎 | `prompt-merge-engine.service.ts` |

#### Hooks (3 個)

- `use-prompt-configs.ts`, `use-field-mapping-configs.ts`, `use-pipeline-configs.ts`

#### 資料庫 Models

`PromptConfig`, `PromptVariable`, `FieldMappingConfig`, `FieldMappingRule`, `PipelineConfig`, `SystemConfig`, `ConfigHistory`

---

### 2.10 範本系統 (Template System)

#### 頁面路由 (5 個)

| 路由 | 檔案路徑 |
|------|---------|
| Data Template 列表 | `src/app/[locale]/(dashboard)/admin/data-templates/page.tsx` |
| Data Template 新增 | `src/app/[locale]/(dashboard)/admin/data-templates/new/page.tsx` |
| Data Template 詳情 | `src/app/[locale]/(dashboard)/admin/data-templates/[id]/page.tsx` |
| Template Field Mapping 列表 | `src/app/[locale]/(dashboard)/admin/template-field-mappings/page.tsx` |
| Template Field Mapping 新增 | `src/app/[locale]/(dashboard)/admin/template-field-mappings/new/page.tsx` |
| Template Field Mapping 詳情 | `src/app/[locale]/(dashboard)/admin/template-field-mappings/[id]/page.tsx` |
| Template Instance 列表 | `src/app/[locale]/(dashboard)/template-instances/page.tsx` |
| Template Instance 詳情 | `src/app/[locale]/(dashboard)/template-instances/[id]/page.tsx` |

#### 組件 (32 個)

**Data Template (5)**:
- `DataTemplateList.tsx`, `DataTemplateCard.tsx`, `DataTemplateFilters.tsx`
- `DataTemplateForm.tsx`, `DataTemplateFieldEditor.tsx`

**Template Field Mapping (10)**:
- `TemplateFieldMappingList.tsx`, `TemplateFieldMappingForm.tsx`
- `MappingRuleEditor.tsx`, `MappingRuleItem.tsx`, `MappingTestPanel.tsx`
- `SourceFieldSelector.tsx`, `TargetFieldSelector.tsx`
- `TransformConfigEditor.tsx`, `FormulaEditor.tsx`, `LookupTableEditor.tsx`

**Template Instance (12)**:
- `TemplateInstanceList.tsx`, `TemplateInstanceCard.tsx`, `TemplateInstanceFilters.tsx`
- `TemplateInstanceDetail.tsx`, `InstanceStatsOverview.tsx`
- `CreateInstanceDialog.tsx`, `InstanceRowsTable.tsx`
- `RowDetailDrawer.tsx`, `RowEditDialog.tsx`
- `ExportDialog.tsx`, `ExportFieldSelector.tsx`, `BulkActionsMenu.tsx`

**Template Matching (5)**:
- `BulkMatchDialog.tsx`, `DefaultTemplateSelector.tsx`
- `MatchStatusBadge.tsx`, `MatchToTemplateDialog.tsx`, `TemplateMatchingConfigAlert.tsx`

#### API 路由 (18 個)

| 域 | 端點 | 路徑 |
|-----|------|------|
| Data Templates | 3 | `v1/data-templates/` (route, [id], available) |
| Template Field Mappings | 3 | `v1/template-field-mappings/` (route, [id], resolve) |
| Template Instances | 5 | `v1/template-instances/` (route, [id], [id]/rows, [id]/rows/[rowId], [id]/export) |
| Template Matching | 4 | `v1/template-matching/` (execute, preview, validate, check-config) |
| Document Matching | 3 | `v1/documents/` ([id]/match, [id]/unmatch, match) |

#### 服務層 (5 個)

| 服務 | 檔案 |
|------|------|
| 資料範本 | `data-template.service.ts` |
| 範本欄位映射 | `template-field-mapping.service.ts` |
| 範本實例 | `template-instance.service.ts` |
| 範本匹配引擎 | `template-matching-engine.service.ts` |
| 自動範本匹配 | `auto-template-matching.service.ts` |
| 範本匯出 | `template-export.service.ts` |

#### Hooks (2 個)

- `use-data-templates.ts`, `use-template-field-mappings.ts`, `use-template-instances.ts`

#### 資料庫 Models

`DataTemplate`, `TemplateFieldMapping`, `TemplateInstance`, `TemplateInstanceRow`

---

### 2.11 升級處理 (Escalation)

#### 頁面路由 (2 個)

| 路由 | 檔案路徑 |
|------|---------|
| `/escalations` | `src/app/[locale]/(dashboard)/escalations/page.tsx` |
| `/escalations/[id]` | `src/app/[locale]/(dashboard)/escalations/[id]/page.tsx` |

#### 組件 (6 個)

- `EscalationListTable.tsx`, `EscalationFilters.tsx`, `EscalationListSkeleton.tsx`
- `EscalationStatusBadge.tsx`, `EscalationReasonBadge.tsx`, `ResolveDialog.tsx`

#### API 路由 (3 個)

- `src/app/api/escalations/route.ts`
- `src/app/api/escalations/[id]/route.ts`
- `src/app/api/escalations/[id]/resolve/route.ts`

#### Hooks (4 個)

- `useEscalationList.ts`, `useEscalationDetail.ts`
- `useEscalateReview.ts`, `useResolveEscalation.ts`

#### 資料庫 Models

`Escalation`

---

### 2.12 報表系統 (Reports)

#### 頁面路由 (4 個)

| 路由 | 檔案路徑 |
|------|---------|
| `/reports/monthly` | `src/app/[locale]/(dashboard)/reports/monthly/page.tsx` |
| `/reports/regional` | `src/app/[locale]/(dashboard)/reports/regional/page.tsx` |
| `/reports/cost` | `src/app/[locale]/(dashboard)/reports/cost/page.tsx` |
| `/reports/ai-cost` | `src/app/[locale]/(dashboard)/reports/ai-cost/page.tsx` |

#### 組件 (3 個)

- `reports/AiCostCard.tsx`, `CityCostTable.tsx`, `CostAnomalyDialog.tsx`

#### API 路由 (17 個)

| 域 | 端點數 | 路徑前綴 |
|-----|-------|---------|
| 報表工作 | 1 | `reports/jobs/[jobId]` |
| 月報 | 3 | `reports/monthly-cost/` (route, generate, [id]/download) |
| 區域報表 | 2 | `reports/regional/` (city/[cityCode], export) |
| 城市成本 | 3 | `reports/city-cost/` (route, trend, anomaly/[cityCode]) |
| 費用明細 | 2 | `reports/expense-detail/` (estimate, export) |
| AI 成本 | 4 | `dashboard/ai-cost/` (route, trend, daily/[date], anomalies) |
| 成本分析 | 5 | `cost/` (city-summary, city-trend, comparison, pricing, pricing/[id]) |

#### 服務層 (6 個)

| 服務 | 檔案 |
|------|------|
| AI 成本 | `ai-cost.service.ts` |
| 城市成本 | `city-cost.service.ts` |
| 城市成本報表 | `city-cost-report.service.ts` |
| 月報 | `monthly-cost-report.service.ts` |
| 區域報表 | `regional-report.service.ts` |
| 費用報表 | `expense-report.service.ts` |
| 成本估算 | `cost-estimation.service.ts` |

#### Hooks (5 個)

- `use-monthly-report.ts`, `use-city-cost-report.ts`
- `useAiCost.ts`, `useCityCost.ts`, `useProcessingStats.ts`

#### Excel 報表生成

- `src/lib/reports/excel-generator.ts` — Excel 報表生成
- `src/lib/reports/excel-i18n.ts` — 報表 i18n
- `src/lib/reports/hierarchical-terms-excel.ts` — 階層術語 Excel
- `src/lib/reports/pdf-generator.ts` — PDF 報表生成

#### 資料庫 Models

`ReportJob`, `ApiUsageLog`, `ApiPricingConfig`, `ApiPricingHistory`, `MonthlyReport`, `ProcessingStatistics`, `HourlyProcessingStats`

---

### 2.13 Admin 管理系統

#### 頁面路由 (20 個)

| 子系統 | 路由 | 檔案路徑 |
|--------|------|---------|
| 使用者管理 | `/admin/users` | `admin/users/page.tsx` |
| 角色管理 | `/admin/roles` | `admin/roles/page.tsx` |
| 系統配置 | `/admin/config` | `admin/config/page.tsx` |
| 告警管理 | `/admin/alerts` | `admin/alerts/page.tsx` |
| 效能監控 | `/admin/performance` | `admin/performance/page.tsx` |
| 備份管理 | `/admin/backup` | `admin/backup/page.tsx` |
| 健康監控 | `/admin/monitoring/health` | `admin/monitoring/health/page.tsx` |
| 術語分析 | `/admin/term-analysis` | `admin/term-analysis/page.tsx` |
| 歷史資料 | `/admin/historical-data` | `admin/historical-data/page.tsx` |
| 歷史文件詳情 | `/admin/historical-data/files/[fileId]` | `admin/historical-data/files/[fileId]/page.tsx` |
| Outlook 整合 | `/admin/integrations/outlook` | `admin/integrations/outlook/page.tsx` |
| 公司審核 | `/admin/companies/review` | `admin/companies/review/page.tsx` |
| 提取比較測試 | `/admin/test/extraction-compare` | `admin/test/extraction-compare/page.tsx` |
| 提取 V2 測試 | `/admin/test/extraction-v2` | `admin/test/extraction-v2/page.tsx` |
| 範本匹配測試 | `/admin/test/template-matching` | `admin/test/template-matching/page.tsx` |
| 文件預覽測試 | `/admin/document-preview-test` | `admin/document-preview-test/page.tsx` |
| *(另有 prompt-configs, field-mapping-configs, pipeline-settings, data-templates, template-field-mappings, exchange-rates, reference-numbers 各 3 頁)* | | |

#### 組件 (43 個)

| 子系統 | 組件數 | 主要組件 |
|--------|--------|---------|
| **使用者管理** | 8 | UserList, UserTable, UserFilters, UserSearchBar, AddUserDialog, EditUserDialog, UserStatusToggle, UserListSkeleton |
| **角色管理** | 5 | RoleList, AddRoleDialog, EditRoleDialog, DeleteRoleDialog, PermissionSelector |
| **系統配置** | 4 | ConfigManagement, ConfigItem, ConfigEditDialog, ConfigHistoryDialog |
| **告警管理** | 5 | AlertDashboard, AlertHistory, AlertRuleManagement, AlertRuleTable, CreateAlertRuleDialog |
| **備份管理** | 7 | BackupManagement, BackupList, BackupScheduleList, BackupStatusCard, CreateBackupDialog, ScheduleDialog, StorageUsageCard |
| **還原管理** | 4 | RestoreManagement, RestoreList, RestoreDialog, RestoreDetailDialog |
| **日誌管理** | 4 | LogViewer, LogDetailDialog, LogExportDialog, LogStreamPanel |
| **健康監控** | 1 | HealthDashboard |
| **API Key** | 3 | ApiKeyManagement, ApiKeyTable, CreateApiKeyDialog |
| **其他** | 2 | CitySelector, PermissionScopeIndicator |

#### API 路由 (104 個)

| 子域 | 端點數 |
|------|--------|
| historical-data | 19 |
| integrations (outlook + sharepoint + n8n) | 15 |
| alerts | 9 |
| config | 8 |
| retention | 7 |
| logs | 7 |
| backups | 6 |
| restore | 5 |
| performance | 4 |
| backup-schedules | 4 |
| api-keys | 4 |
| users | 3 |
| n8n-health | 3 |
| companies | 3 |
| roles | 2 |
| health | 2 |
| term-analysis | 1 |
| document-preview-test | 1 |
| cities | 1 |

#### 服務層 (20+ 個)

| 領域 | 服務 |
|------|------|
| 告警 | `alert.service.ts`, `alert-evaluation.service.ts`, `alert-evaluation-job.ts`, `alert-notification.service.ts`, `alert-rule.service.ts` |
| 備份還原 | `backup.service.ts`, `backup-scheduler.service.ts`, `restore.service.ts` |
| 日誌 | `logging/logger.service.ts`, `logging/log-query.service.ts` |
| 效能 | `performance.service.ts`, `performance-collector.service.ts` |
| 健康 | `health-check.service.ts` |
| 使用者 | `user.service.ts`, `role.service.ts` |
| 系統配置 | `system-config.service.ts` |
| 資料保留 | `data-retention.service.ts` |
| API Key | `api-key.service.ts`, `api-audit-log.service.ts` |
| 安全 | `security-log.ts`, `encryption.service.ts` |

---

### 2.14 外部整合 (External Integrations)

#### 頁面路由 (1 個)

- `/admin/integrations/outlook` — `src/app/[locale]/(dashboard)/admin/integrations/outlook/page.tsx`

#### 組件 (5 個)

**Outlook (3)**:
- `outlook/OutlookConfigForm.tsx`, `OutlookConfigList.tsx`, `OutlookFilterRulesEditor.tsx`

**SharePoint (2)**:
- `sharepoint/SharePointConfigForm.tsx`, `SharePointConfigList.tsx`

#### API 路由 (15 個)

| 域 | 端點數 | 路徑 |
|-----|-------|------|
| Outlook | 7 | `admin/integrations/outlook/` (route, [configId], [configId]/rules, [configId]/rules/[ruleId], [configId]/rules/reorder, [configId]/test, test) |
| SharePoint | 4 | `admin/integrations/sharepoint/` (route, [configId], [configId]/test, test) |
| n8n Webhooks | 4 | `admin/integrations/n8n/webhook-configs/` (route, [id], [id]/history, [id]/test) |

#### 服務層 (12 個)

| 服務 | 檔案 | 用途 |
|------|------|------|
| Outlook 配置 | `outlook-config.service.ts` | Outlook 收件配置 |
| Outlook 文件 | `outlook-document.service.ts` | Outlook 文件匯入 |
| Outlook 郵件 | `outlook-mail.service.ts` | 郵件存取 |
| SharePoint 配置 | `sharepoint-config.service.ts` | SharePoint 配置 |
| SharePoint 文件 | `sharepoint-document.service.ts` | SharePoint 文件匯入 |
| Microsoft Graph | `microsoft-graph.service.ts` | Graph API 客戶端 |
| n8n API Key | `n8n/n8n-api-key.service.ts` | n8n 認證 |
| n8n 文件 | `n8n/n8n-document.service.ts` | n8n 文件操作 |
| n8n 健康 | `n8n/n8n-health.service.ts` | n8n 健康檢查 |
| n8n Webhook | `n8n/n8n-webhook.service.ts` | Webhook 事件 |
| Webhook 配置 | `n8n/webhook-config.service.ts` | Webhook 配置管理 |
| 工作流定義 | `n8n/workflow-definition.service.ts` | 工作流管理 |
| 工作流錯誤 | `n8n/workflow-error.service.ts` | 錯誤處理 |
| 工作流執行 | `n8n/workflow-execution.service.ts` | 執行追蹤 |
| 工作流觸發 | `n8n/workflow-trigger.service.ts` | 工作流觸發 |

#### Hooks

- `use-outlook-config.ts`, `use-sharepoint-config.ts`
- `use-n8n-health.ts`, `use-webhook-config.ts`
- `useWorkflowExecutions.ts`, `useWorkflowError.ts`, `useWorkflowTrigger.ts`

#### 資料庫 Models

`SharePointConfig`, `SharePointFetchLog`, `OutlookConfig`, `OutlookFilterRule`, `OutlookFetchLog`, `N8nApiKey`, `N8nApiCall`, `N8nWebhookEvent`, `N8nIncomingWebhook`, `WorkflowExecution`, `WorkflowExecutionStep`, `WebhookConfig`, `WebhookConfigHistory`, `WorkflowDefinition`, `N8nConnectionStats`

---

### 2.15 匯率管理 (Exchange Rate)

#### 頁面路由 (3 個)

| 路由 | 檔案路徑 |
|------|---------|
| `/admin/exchange-rates` | `admin/exchange-rates/page.tsx` |
| `/admin/exchange-rates/new` | `admin/exchange-rates/new/page.tsx` |
| `/admin/exchange-rates/[id]` | `admin/exchange-rates/[id]/page.tsx` |

#### 組件 (6 個)

- `CurrencySelect.tsx`, `ExchangeRateCalculator.tsx`
- `ExchangeRateFilters.tsx`, `ExchangeRateForm.tsx`
- `ExchangeRateImportDialog.tsx`, `ExchangeRateList.tsx`

#### API 路由 (7 個)

- `v1/exchange-rates/` — route, [id], [id]/toggle, batch, convert, export, import

#### 服務

- `exchange-rate.service.ts`

#### Hooks

- `use-exchange-rates.ts`

#### 資料庫 Models

`ExchangeRate`

---

### 2.16 參考編號管理 (Reference Number)

#### 頁面路由 (3 個)

| 路由 | 檔案路徑 |
|------|---------|
| `/admin/reference-numbers` | `admin/reference-numbers/page.tsx` |
| `/admin/reference-numbers/new` | `admin/reference-numbers/new/page.tsx` |
| `/admin/reference-numbers/[id]` | `admin/reference-numbers/[id]/page.tsx` |

#### 組件 (8 個)

- `ReferenceNumberList.tsx`, `ReferenceNumberForm.tsx`, `ReferenceNumberFilters.tsx`
- `ReferenceNumberDeleteDialog.tsx`, `ReferenceNumberExportButton.tsx`, `ReferenceNumberImportDialog.tsx`
- `ReferenceNumberStatusBadge.tsx`, `ReferenceNumberTypeBadge.tsx`

#### API 路由 (5 個)

- `v1/reference-numbers/` — route, [id], export, import, validate

#### 服務

- `reference-number.service.ts`

#### Hooks

- `use-reference-numbers.ts`

#### 資料庫 Models

`ReferenceNumber`

---

### 2.17 文件預覽系統 (Document Preview)

#### 頁面路由 (1 個)

- `/admin/document-preview-test` — `admin/document-preview-test/page.tsx`

#### 組件 (9 個)

- `DynamicPDFViewer.tsx`, `PDFViewer.tsx`, `PDFControls.tsx`
- `PDFErrorDisplay.tsx`, `PDFLoadingSkeleton.tsx`
- `FieldHighlightOverlay.tsx`, `FieldCard.tsx`, `FieldFilters.tsx`
- `ExtractedFieldsPanel.tsx`

#### Zustand Store

- `src/stores/document-preview-test-store.ts` — `useDocumentPreviewTestStore`

#### API 路由 (1 個)

- `admin/document-preview-test/extract` — 預覽提取測試

#### Hooks

- `use-pdf-preload.ts`

---

### 2.18 稽核系統 (Audit)

#### 頁面路由 (1 個)

- `/audit/query` — `src/app/[locale]/(dashboard)/audit/query/page.tsx`

#### 組件 (3 個)

- `audit/AuditReportExportDialog.tsx`, `AuditReportJobList.tsx`, `ReportIntegrityDialog.tsx`

#### API 路由 (7 個)

| 端點 | 路徑 |
|------|------|
| 稽核日誌 | `audit/logs/route.ts` |
| 稽核查詢 | `audit/query/route.ts` |
| 查詢計數 | `audit/query/count/route.ts` |
| 稽核報告列表 | `audit/reports/route.ts` |
| 報告詳情 | `audit/reports/[jobId]/route.ts` |
| 報告下載 | `audit/reports/[jobId]/download/route.ts` |
| 報告驗證 | `audit/reports/[jobId]/verify/route.ts` |

#### 服務層 (3 個)

- `audit-log.service.ts`, `audit-query.service.ts`, `audit-report.service.ts`

#### Hooks (4 個)

- `useAuditQuery.ts`, `useAuditReports.ts`, `useChangeHistory.ts`, `useTraceability.ts`

#### 資料庫 Models

`AuditLog`, `AuditReportJob`, `AuditReportDownload`, `DataChangeHistory`, `TraceabilityReport`, `StatisticsAuditLog`

---

### 2.19 Dashboard

#### 頁面路由 (1 個)

- `/dashboard` — `src/app/[locale]/(dashboard)/dashboard/page.tsx`

#### React Context (2 個)

- `src/contexts/DashboardFilterContext.tsx` — 篩選條件上下文
- `src/contexts/DateRangeContext.tsx` — 日期範圍上下文

#### API 路由 (5 個)

- `dashboard/statistics/route.ts`
- `dashboard/ai-cost/route.ts`, `dashboard/ai-cost/trend/route.ts`
- `dashboard/ai-cost/daily/[date]/route.ts`, `dashboard/ai-cost/anomalies/route.ts`

#### 服務

- `dashboard-statistics.service.ts`

#### Hooks

- `useDashboardStatistics.ts`, `useCityFilter.ts`

---

### 2.20 全域統計 (Global Analytics)

#### 頁面路由 (1 個)

- `/global` — `src/app/[locale]/(dashboard)/global/page.tsx`

#### 組件 (4 個)

- `global/GlobalStats.tsx`, `GlobalTrend.tsx`, `CityRankings.tsx`, `RegionView.tsx`

#### API 路由 (3 個)

- `analytics/global/route.ts`
- `analytics/city-comparison/route.ts`
- `analytics/region/[code]/cities/route.ts`

#### 服務

- `global-admin.service.ts`, `regional-manager.service.ts`

---

### 2.21 其他功能模組

#### 信心度系統

- **組件** (3): `confidence/ConfidenceBadge.tsx`, `ConfidenceBreakdown.tsx`, `ConfidenceIndicator.tsx`
- **服務**: `confidence.service.ts` + `lib/confidence/` (calculator, thresholds, utils)
- **Hooks**: `use-accuracy.ts`

#### 歷史資料管理

- **頁面**: `/admin/historical-data` + `/admin/historical-data/files/[fileId]`
- **組件** (16): `historical-data/` (BatchFileUploader, BatchProgressPanel, BatchSummaryCard, CreateBatchDialog, HistoricalBatchList, HistoricalFileList, TermAggregationSummary, etc.) + `file-detail/` (6 個子組件)
- **API**: 19 個 admin 端點
- **服務**: `batch-processor.service.ts`, `batch-progress.service.ts`, `batch-term-aggregation.service.ts`, `hierarchical-term-aggregation.service.ts`, `term-aggregation.service.ts`, `term-classification.service.ts`
- **Hooks**: `use-historical-data.ts`, `use-historical-file-detail.ts`, `use-batch-progress.ts`, `use-term-aggregation.ts`, `use-term-analysis.ts`
- **Models**: `HistoricalBatch`, `HistoricalFile`, `TermAggregationResult`

#### 資料保留 (Data Retention)

- **組件** (5): `retention/DataRetentionDashboard.tsx`, `RetentionPolicyList.tsx`, `DeletionRequestList.tsx`, `ArchiveRecordList.tsx`, `StorageMetricsCard.tsx`
- **API**: 7 個 admin/retention/ 端點
- **服務**: `data-retention.service.ts`
- **Hooks**: `useRetention.ts`
- **Models**: `DataRetentionPolicy`, `DataArchiveRecord`, `DataDeletionRequest`, `DataRestoreRequest`

#### 變更歷史

- **組件** (2): `history/ChangeHistoryTimeline.tsx`, `HistoryVersionCompareDialog.tsx`
- **API**: 2 個 history/ 端點
- **服務**: `change-tracking.service.ts`
- **Hooks**: `useChangeHistory.ts`, `useVersions.ts`, `use-rollback.ts`

#### 區域管理

- **組件**: `region/RegionSelect.tsx`
- **API**: 2 個 v1/regions/ 端點
- **服務**: `region.service.ts`, `regional-manager.service.ts`, `city.service.ts`, `city-access.service.ts`
- **Hooks**: `use-regions.ts`, `use-cities.ts`, `use-accessible-cities.ts`, `useUserCity.ts`
- **Models**: `Region`, `City`, `UserCityAccess`, `UserRegionAccess`

#### 外部 API (n8n 整合端點)

- **API**: 4 個 n8n/ 端點 (documents route, [id]/result, [id]/status, webhook)
- **API**: 7 個 v1/invoices/ 端點 (route, [taskId]/status, [taskId]/result, [taskId]/result/fields/[fieldName], [taskId]/document, batch-status, batch-results)
- **API**: 3 個 v1/webhooks/ 端點

#### 文件 API 文檔

- **組件** (4): `docs/CodeBlock.tsx`, `LanguageTabs.tsx`, `SDKExamplesContent.tsx`, `SwaggerUIWrapper.tsx`
- **API**: 4 個 docs/ 端點 (route, error-codes, examples, version)
- **服務**: `openapi-loader.service.ts`

---

## 3. 功能實現狀態矩陣

### 3.1 各模組實現完整度

| # | 功能模組 | 前端 | 後端 API | 服務層 | 資料庫 | 完整度 |
|---|---------|------|---------|--------|--------|--------|
| A | 認證與授權 | ✅ 完整 | ✅ 7 routes | ✅ 8 lib | ✅ 8 models | **100%** |
| B | 文件管理 | ✅ 完整 | ✅ 19 routes | ✅ 14 服務 | ✅ 6 models | **100%** |
| C | 提取管線 V3 | N/A (純後端) | ✅ 3 routes | ✅ 40 服務 | ✅ 複用 | **100%** |
| D | 審核流程 | ✅ 27 組件 | ✅ 5 routes | ✅ 5 服務 | ✅ 4 models | **100%** |
| E | 規則管理 | ✅ 37 組件 | ✅ 20 routes | ✅ 10 服務 | ✅ 11 models | **100%** |
| F | 公司管理 | ✅ 14 組件 | ✅ 14 routes | ✅ 5 服務 | ✅ 4 models | **100%** |
| G | 格式管理 | ✅ 19 組件 | ✅ 6 routes | ✅ 2 服務 | ✅ 1 model | **100%** |
| H | 三層映射 | ✅ 9 組件 | ✅ 10 routes | ✅ 7+6 服務 | ✅ 3 models | **100%** |
| I | 配置繼承 | ✅ 21 組件 | ✅ 19 routes | ✅ 5 服務 | ✅ 7 models | **100%** |
| J | 範本系統 | ✅ 32 組件 | ✅ 18 routes | ✅ 6 服務 | ✅ 4 models | **100%** |
| K | 升級處理 | ✅ 6 組件 | ✅ 3 routes | ✅ 1 服務 | ✅ 1 model | **100%** |
| L | 報表系統 | ✅ 3 組件 | ✅ 17 routes | ✅ 7 服務 | ✅ 7 models | **100%** |
| M | Admin 系統 | ✅ 43 組件 | ✅ 104 routes | ✅ 20+ 服務 | ✅ 多 model | **100%** |
| N | 外部整合 | ✅ 5 組件 | ✅ 15 routes | ✅ 15 服務 | ✅ 15 models | **100%** |
| O | 匯率管理 | ✅ 6 組件 | ✅ 7 routes | ✅ 1 服務 | ✅ 1 model | **100%** |
| P | 參考編號 | ✅ 8 組件 | ✅ 5 routes | ✅ 1 服務 | ✅ 1 model | **100%** |
| Q | 文件預覽 | ✅ 9 組件 | ✅ 1 route | N/A | N/A | **100%** |
| R | 稽核系統 | ✅ 3 組件 | ✅ 7 routes | ✅ 3 服務 | ✅ 6 models | **100%** |
| S | Dashboard | ✅ Context | ✅ 5 routes | ✅ 1 服務 | N/A | **100%** |
| T | 全域統計 | ✅ 4 組件 | ✅ 3 routes | ✅ 2 服務 | N/A | **100%** |

> 全部 22 個 Epic (157+ Stories) 已完成。所有功能模組均達到 100% 實現狀態。

---

## 4. 跨功能依賴圖

### 4.1 核心依賴鏈

```
                    ┌─────────────┐
                    │ A. 認證授權  │
                    └──────┬──────┘
                           │ (所有模組依賴)
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌────────────┐    ┌────────────┐    ┌────────────┐
│ F. 公司管理 │    │ B. 文件管理 │    │ M. Admin   │
└──────┬─────┘    └──────┬─────┘    └──────┬─────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌────────────┐    ┌────────────┐    ┌────────────┐
│ G. 格式管理 │    │ C. 提取管線 │←──│ I. 配置繼承 │
└──────┬─────┘    └──────┬─────┘    └────────────┘
       │                 │
       ▼                 ├──────────┐
┌────────────┐           ▼          ▼
│ H. 三層映射 │←──┌────────────┐ ┌────────────┐
└────────────┘   │ U. 信心度   │ │ J. 範本系統 │
                 └──────┬─────┘ └────────────┘
                        │
                        ▼
               ┌────────────┐    ┌────────────┐
               │ D. 審核流程 │───→│ K. 升級處理 │
               └──────┬─────┘    └────────────┘
                      │
                      ▼
               ┌────────────┐
               │ L. 報表系統 │
               └────────────┘
```

### 4.2 核心共享服務

| 共享服務 | 依賴方 |
|---------|--------|
| `src/lib/prisma.ts` | 所有服務層 |
| `src/lib/auth.ts` + `src/lib/auth.config.ts` | 所有 API 路由 |
| `src/middleware.ts` | 所有頁面路由 |
| `src/lib/errors.ts` | 所有 API 錯誤處理 |
| `src/lib/utils.ts` | 全專案通用 |
| `src/lib/azure/storage.ts` | 文件管理、歷史資料、備份 |
| `src/services/notification.service.ts` | 審核、告警、升級 |
| `src/services/audit-log.service.ts` | 所有寫入操作 |
| `src/services/change-tracking.service.ts` | 配置變更、規則變更 |
| `src/lib/confidence/` | 提取管線、審核流程、報表 |
| `src/contexts/DashboardFilterContext.tsx` | Dashboard、報表組件 |
| `src/contexts/DateRangeContext.tsx` | 報表、統計組件 |

### 4.3 關鍵依賴關係

| 依賴方 | 被依賴方 | 依賴原因 |
|--------|---------|---------|
| C.提取管線 | F.公司管理 | 公司識別需要公司資料 |
| C.提取管線 | G.格式管理 | 格式匹配需要格式規則 |
| C.提取管線 | H.三層映射 | 欄位映射需要映射規則 |
| C.提取管線 | I.配置繼承 | 提示詞/管線配置解析 |
| C.提取管線 | O.匯率管理 | 匯率轉換步驟 |
| C.提取管線 | P.參考編號 | 參考號匹配步驟 |
| D.審核流程 | C.提取管線 | 審核需要提取結果 |
| D.審核流程 | U.信心度 | 審核依據信心度分流 |
| J.範本系統 | C.提取管線 | 自動範本匹配步驟 |
| J.範本系統 | H.三層映射 | 範本欄位映射 |
| K.升級處理 | D.審核流程 | 升級從審核流程觸發 |
| L.報表系統 | B.文件管理 | 報表統計文件處理數據 |
| L.報表系統 | O.匯率管理 | 成本報表需要匯率 |

---

## 5. i18n 覆蓋狀態

### 5.1 命名空間分佈 (31 個/語言 × 3 語言 = 93 個 JSON)

| 命名空間 | 對應功能模組 | 主要使用組件 |
|---------|-------------|-------------|
| `common` | 全域 | 通用按鈕、狀態、操作 |
| `navigation` | 佈局 | Sidebar, TopBar |
| `dialogs` | 全域 | 對話框通用文字 |
| `auth` | A.認證授權 | LoginForm, RegisterForm |
| `validation` | 全域 | Zod 驗證訊息 |
| `errors` | 全域 | 錯誤訊息 |
| `dashboard` | S.Dashboard | Dashboard 頁面 |
| `global` | T.全域統計 | GlobalStats, RegionView |
| `escalation` | K.升級處理 | EscalationListTable |
| `review` | D.審核流程 | ReviewPanel, ReviewQueue |
| `documents` | B.文件管理 | DocumentListTable, ProcessingTimeline |
| `rules` | E.規則管理 | RuleList, RuleDetailView |
| `companies` | F.公司管理 | ForwarderList, CompanyMergeDialog |
| `reports` | L.報表系統 | AiCostCard, CityCostTable |
| `admin` | M.Admin | UserList, ConfigManagement |
| `confidence` | U.信心度 | ConfidenceBadge, ConfidenceBreakdown |
| `historicalData` | 歷史資料 | HistoricalBatchList |
| `termAnalysis` | 術語分析 | TermTable, TermFilters |
| `documentPreview` | Q.文件預覽 | PDFViewer, FieldCard |
| `fieldMappingConfig` | H.三層映射/I.配置 | MappingConfigPanel |
| `promptConfig` | I.配置繼承 | PromptConfigForm |
| `pipelineConfig` | I.配置繼承 | PipelineConfigForm |
| `dataTemplates` | J.範本 | DataTemplateList |
| `formats` | G.格式管理 | FormatList, FormatForm |
| `templateFieldMapping` | J.範本 | TemplateFieldMappingForm |
| `templateInstance` | J.範本 | TemplateInstanceList |
| `templateMatchingTest` | J.範本 | 範本匹配測試 |
| `standardFields` | 通用 | 標準欄位名稱 |
| `referenceNumber` | P.參考編號 | ReferenceNumberList |
| `exchangeRate` | O.匯率 | ExchangeRateList |
| `region` | 區域 | RegionSelect |

### 5.2 i18n 使用統計

| 指標 | 數量 |
|------|------|
| 使用 `useTranslations` 的檔案 | 234 |
| 命名空間數 | 31 |
| 語言數 | 3 (en, zh-TW, zh-CN) |
| 翻譯檔案總數 | 93 |

---

## 6. 功能複雜度評估

### 6.1 複雜度評分矩陣

| # | 功能模組 | 組件數 | API 數 | 服務數 | Model 數 | 外部依賴 | 複雜度 |
|---|---------|--------|--------|--------|----------|---------|--------|
| C | 提取管線 V3 | 0 | 3 | 40 | 6 | Azure DI + GPT | **極高** ★★★★★ |
| M | Admin 系統 | 43 | 104 | 20+ | 多 | - | **極高** ★★★★★ |
| E | 規則管理 | 37 | 20 | 10 | 11 | - | **高** ★★★★ |
| J | 範本系統 | 32 | 18 | 6 | 4 | - | **高** ★★★★ |
| D | 審核流程 | 27 | 5 | 5 | 4 | - | **高** ★★★★ |
| I | 配置繼承 | 21 | 19 | 5 | 7 | - | **高** ★★★★ |
| N | 外部整合 | 5 | 15 | 15 | 15 | SP+Outlook+n8n | **高** ★★★★ |
| B | 文件管理 | 15 | 19 | 14 | 6 | Azure Blob | **中高** ★★★☆ |
| G | 格式管理 | 19 | 6 | 2 | 1 | - | **中** ★★★ |
| H | 三層映射 | 9 | 10 | 13 | 3 | - | **中** ★★★ |
| F | 公司管理 | 14 | 14 | 5 | 4 | - | **中** ★★★ |
| L | 報表系統 | 3 | 17 | 7 | 7 | - | **中** ★★★ |
| R | 稽核系統 | 3 | 7 | 3 | 6 | - | **中** ★★★ |
| A | 認證授權 | 3 | 7 | 8 | 8 | Azure AD | **中** ★★★ |
| O | 匯率管理 | 6 | 7 | 1 | 1 | - | **低** ★★ |
| P | 參考編號 | 8 | 5 | 1 | 1 | - | **低** ★★ |
| Q | 文件預覽 | 9 | 1 | 0 | 0 | pdfjs-dist | **低** ★★ |
| K | 升級處理 | 6 | 3 | 1 | 1 | - | **低** ★★ |
| S | Dashboard | 0 | 5 | 1 | 0 | - | **低** ★★ |
| T | 全域統計 | 4 | 3 | 2 | 0 | - | **低** ★★ |
| U | 信心度 | 3 | 2 | 1 | 0 | - | **低** ★★ |

### 6.2 代碼規模總結

| 分類 | 數量 |
|------|------|
| **前端** | |
| 頁面路由 | 73 |
| 功能組件 | 292 |
| UI 組件 | 34 |
| 佈局組件 | 5 |
| 自定義 Hooks | 101 |
| Zustand Stores | 2 |
| React Context | 2 |
| 型別定義檔 | 88 |
| **後端** | |
| API Route Files | 319 |
| 業務服務檔案 | 179 |
| Lib 工具檔案 | 65 |
| Zod Schemas | 8 |
| Prisma Models | 119 |
| **基礎設施** | |
| i18n 檔案 | 93 (31×3) |
| Python 服務 | 12 |
| 中間件 | 3 |
| **合計估算** | ~1,200+ TypeScript 檔案 |

### 6.3 Python 後端服務

| 子服務 | 檔案 | 功能 |
|--------|------|------|
| extraction | `python-services/extraction/src/main.py` | OCR 提取主入口 |
| extraction | `python-services/extraction/src/ocr/azure_di.py` | Azure DI 呼叫 |
| extraction | `python-services/extraction/src/ocr/processor.py` | OCR 結果處理 |
| mapping | `python-services/mapping/src/main.py` | 映射服務主入口 |
| mapping | `python-services/mapping/src/identifier/matcher.py` | 發行者匹配 |
| mapping | `python-services/mapping/src/mapper/field_mapper.py` | 欄位映射 |
| mapping | `python-services/mapping/src/mapper/models.py` | 資料模型 |

---

## 附錄: 快速參考索引

### 按路徑找功能

| 路徑前綴 | 功能模組 |
|---------|---------|
| `src/app/[locale]/(auth)/` | A.認證授權 |
| `src/app/[locale]/(dashboard)/documents/` | B.文件管理 |
| `src/services/extraction-v3/` | C.提取管線 |
| `src/services/unified-processor/` | C.提取管線 (統一處理器) |
| `src/app/[locale]/(dashboard)/review/` | D.審核流程 |
| `src/app/[locale]/(dashboard)/rules/` | E.規則管理 |
| `src/app/[locale]/(dashboard)/companies/` | F.公司管理 |
| `src/components/features/formats/` | G.格式管理 |
| `src/services/mapping/` | H.三層映射 |
| `src/app/[locale]/(dashboard)/admin/prompt-configs/` | I.配置繼承 |
| `src/app/[locale]/(dashboard)/admin/data-templates/` | J.範本系統 |
| `src/app/[locale]/(dashboard)/escalations/` | K.升級處理 |
| `src/app/[locale]/(dashboard)/reports/` | L.報表系統 |
| `src/app/[locale]/(dashboard)/admin/` | M.Admin |
| `src/services/n8n/` | N.外部整合 (n8n) |
| `src/app/[locale]/(dashboard)/admin/exchange-rates/` | O.匯率管理 |
| `src/app/[locale]/(dashboard)/admin/reference-numbers/` | P.參考編號 |
| `src/components/features/document-preview/` | Q.文件預覽 |
| `src/app/[locale]/(dashboard)/audit/` | R.稽核系統 |
| `src/app/[locale]/(dashboard)/dashboard/` | S.Dashboard |
| `src/app/[locale]/(dashboard)/global/` | T.全域統計 |

---

*報告生成日期: 2026-02-13*
*分析工具: Claude Code 靜態代碼結構掃描*
*專案版本: feature/change-021-extraction-v3 (commit d08fc96)*
