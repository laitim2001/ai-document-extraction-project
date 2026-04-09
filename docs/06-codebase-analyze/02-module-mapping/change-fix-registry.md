# CHANGE/FIX Registry Analysis

> Generated: 2026-04-09 | Source: `claudedocs/4-changes/`

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **CHANGE docs** | 53 (CHANGE-001 ~ CHANGE-053) |
| **FIX docs** | 52 (FIX-001 ~ FIX-049, plus FIX-019b/024b/026b) |
| **Total registry items** | 105 |
| **Completed** | 97 (~92%) |
| **Planned / Pending** | 4 |
| **Partial / Superseded** | 4 |
| **Date range** | 2025-12-23 (FIX-001) ~ 2026-03-02 (FIX-049 / CHANGE-053) |

> Note: CHANGE numbering skips some values (no 046 gap etc.); FIX uses b-suffix for duplicate-number resolutions (019b, 024b, 026b).

---

## CHANGE Registry (53 items)

### Status Breakdown

| Status | Count | IDs |
|--------|-------|-----|
| Completed | 47 | 001-011, 013-028, 030-043, 045-051, 053 |
| Planned / Pending | 3 | 029, 044, 048 |
| Partial | 1 | 016 |
| Planning | 1 | 052 |
| Needs verification | 1 | 012 |

### Full CHANGE List

| # | Title | Status | Date | Category |
|---|-------|--------|------|----------|
| 001 | Native PDF 雙重處理架構增強 | ✅ | 2025-12-27 | Pipeline |
| 002 | 階層式術語報告匯出功能 | ✅ | 2025-12-27 | Reports/Export |
| 003 | 歷史數據文件詳情頁 | ✅ | 2025-12-28 | UI |
| 004 | Azure DI BoundingBox 座標提取 | ✅ | 2025-12-29 | Pipeline/OCR |
| 005 | 統一管道步驟重排序 | ✅ | 2026-01-05 | Pipeline |
| 006 | GPT Vision 動態配置提取與 Term 記錄 | ✅ | 2026-01-06 | Pipeline/AI |
| 007 | /forwarders → /companies 路徑重構 | ✅ | 2026-01-07 | Refactor/System |
| 008 | Azurite 開發環境存儲整合 | ✅ | 2026-01-08 | DevOps |
| 009 | 公司列表 UI 改進與格式建立錯誤處理 | ✅ | 2026-01-09 | UI |
| 010 | 批次處理並行化優化 | ✅ | 2026-01-10 | Pipeline/Perf |
| 011 | Rules Edit 組件國際化 | ✅ | 2026-01-12 | i18n |
| 012 | 歷史數據頁面 URL 導航一致性 | ⚠️ 需驗證 | 2026-01-20 | UI/Navigation |
| 013 | 端到端管線整合 Phase 1 — 基礎設施準備 | ✅ | 2026-01-27 | Pipeline/E2E |
| 014 | 端到端管線整合 Phase 2 — 核心整合 | ✅ | 2026-01-27 | Pipeline/E2E |
| 015 | 端到端管線整合 Phase 3 — 連接 Epic 19 | ✅ | 2026-01-27 | Pipeline/E2E |
| 016 | 端到端管線整合 Phase 4 — 測試驗證 | ⚠️ 部分 | 2026-01-27 | Testing/E2E |
| 017 | Retry 功能整合統一處理管線 | ✅ | 2026-01-28 | Pipeline |
| 018 | Invoice 詳情頁 API 增強與 Source Badge i18n | ✅ | 2026-01-28 | API/i18n |
| 019 | 統一管線中間處理狀態更新 | ✅ | 2026-01-28 | Pipeline |
| 020 | 新提取架構 Azure DI + GPT-5-mini | ✅ (superseded by 021) | 2026-01-29 | Pipeline/AI |
| 021 | 統一處理器 V3 — 純 GPT-5.2 Vision | ✅ | 2026-01-30 | Pipeline/AI |
| 022 | V3 架構 UI 更新計劃 | ✅ | 2026-01-31 | UI |
| 023 | AI 詳情 Tab 實作 | ✅ | 2026-02-01 | UI |
| 024 | 三階段提取架構重構 | ✅ | 2026-02-01 | Pipeline/Arch |
| 025 | 統一文件處理流程架構優化 | ✅ | 2026-02-01 | Pipeline/Arch |
| 026 | Prompt 配置與 Stage 服務整合 | ✅ | 2026-02-03 | Pipeline/Config |
| 027 | Prompt 模板插入功能 | ✅ | 2026-02-04 | UI/Config |
| 028 | Prompt Config 列表可折疊分組 | ✅ | 2026-02-04 | UI |
| 029 | Reference Number 管理頁面 UI 一致性 | ⏳ 待實作 | 2026-02-06 | UI |
| 030 | Sidebar Navigation 重組 | ✅ | 2026-02-06 | UI/Navigation |
| 031 | 前端 Invoice → Document 統一重命名 | ✅ | 2026-02-07 | Refactor |
| 032 | Pipeline Ref Match + FX Conversion 整合 | ✅ | 2026-02-08 | Pipeline |
| 033 | CLAUDE.md Token 優化 | ✅ | 2026-02-09 | DevOps/Docs |
| 034 | 新增 App Router CLAUDE.md 導航文檔 | ✅ | 2026-02-09 | DevOps/Docs |
| 035 | 參考編號匯入改為 Excel 格式 | ✅ | 2026-02-10 | Data Import |
| 036 | Ref Number 匹配改為 DB Substring 模糊匹配 | ✅ | 2026-02-10 | Pipeline/Data |
| 037 | Data Template 匹配流程完善 | ✅ | 2026-02-11 | Pipeline |
| 038 | Template Field Mapping Source Field 動態載入 | ✅ | 2026-02-11 | UI/Config |
| 039 | 部署 Seed 數據完善 | ✅ | 2026-02-13 | DevOps/Data |
| 040 | 阻擋無映射配置的匹配操作 | ✅ | 2026-02-14 | Pipeline/Guard |
| 041 | 文件列表頁整合批量匹配對話框 | ✅ | 2026-02-14 | UI |
| 042 | 三步閉環 — 欄位定義動態化 + Stage 3 改造 | ✅ | 2026-02-23 | Pipeline/Arch |
| 043 | Line Item Pivot 展平策略 | ✅ | 2026-02-25 | Pipeline/Data |
| 044 | Line Item Hybrid 雙模式 (Pivot/Expand) | ⏳ 待實作 | 2026-02-25 | Pipeline/Data |
| 045 | FieldDefinitionSet 欄位類型 + Line Item 動態生成 | ✅ | 2026-02-25 | Data Model |
| 046 | classifiedAs 正規化 + UI 下拉選單 | ✅ | 2026-02-25 | UI/Data |
| 047 | 將匹配 Ref Number 注入 Template Instance Row | ✅ | 2026-02-25 | Pipeline/Data |
| 048 | Ref Number 作為 Template Instance Row Key | ⏳ 待實作 | 2026-02-25 | Pipeline/Data |
| 049 | User Profile 個人資料頁面 | ✅ | 2026-02-26 | UI/Auth |
| 050 | System Settings Hub 統一設定頁面 | ✅ | 2026-02-26 | UI/Admin |
| 051 | Extracted Fields 顯示重構 | ✅ | 2026-02-26 | UI |
| 052 | GLOBAL_ADMIN 角色名稱統一修正 | 📋 規劃中 | 2026-02-26 | Auth/Data |
| 053 | 增強 Stage 2 格式識別硬編碼 Prompt | ✅ | 2026-03-02 | Pipeline/AI |

---

## FIX Registry (52 items)

### Status Breakdown

| Status | Count | IDs |
|--------|-------|-----|
| Completed / Fixed | 50 | All except 010, 016 partial |
| Superseded | 1 | 010 (replaced by FIX-026) |
| Implicit completed | 1 | 031, 032 (verified in-file) |

### Full FIX List

| # | Title | Status | Date | Category |
|---|-------|--------|------|----------|
| 001 | Code Review P1 Bug Fixes | ✅ | 2025-12-23 | Code Quality |
| 002 | 公司自動建立 FK 約束錯誤 | ✅ | 2025-12-27 | Data Model |
| 003 | 批次狀態邏輯矛盾修復 | ✅ | 2025-12-27 | Pipeline |
| 004 | 術語聚合欄位名稱錯誤 | ✅ | 2025-12-27 | Data/Reports |
| 005 | GPT_VISION 處理缺少發行者識別 | ✅ | 2025-12-29 | Pipeline/AI |
| 006 | 批次處理器 documentFormat 映射錯誤 | ✅ | 2025-12-29 | Pipeline |
| 007 | 術語聚合使用錯誤的公司欄位 | ✅ | 2025-12-30 | Data/Reports |
| 008 | pdfjs-dist SSR 模組 Object.defineProperty 錯誤 | ✅ | 2026-01-03 | UI/SSR |
| 009 | Zustand Selector Next.js 15 無限循環 | ✅ | 2026-01-03 | UI/State |
| 010 | pdfjs-dist v5 ESM Module Error | ⏸️ 取代 | 2026-01-03 | UI/SSR |
| 011 | PDF Viewer Controlled Mode | ✅ | 2026-01-04 | UI |
| 012 | Resizable Panel Layout Optimization | ✅ | 2026-01-04 | UI/Layout |
| 013 | 術語聚合地址過濾優化 | ✅ | 2025-12-30 | Data/Reports |
| 014 | 術語提取地址過濾 | ✅ | 2025-12-30 | Data/Reports |
| 015 | Export Script Address Filtering | ✅ | 2025-12-31 | Data/Export |
| 016 | IssuerIdentifierAdapter 欄位映射錯誤 | ✅ | 2026-01-05 | Pipeline |
| 017 | Enhanced Address Term Filtering | ✅ | 2025-12-31 | Data/Reports |
| 018 | Hierarchical Term Aggregation Fallback Mode | ✅ | 2026-01-05 | Pipeline |
| 019 | pdfjs-dist Next.js 伺服器環境相容性 | ✅ | 2026-01-05 | UI/SSR |
| 019b | 匯出空白 Excel - 認證重導向 | ✅ | 2026-01-06 | Auth/Export |
| 020 | 歷史數據管理頁面問題 | ✅ | 2025-12-24 | UI |
| 021 | PDF 解析失敗 - pdf is not a function | ✅ | 2025-12-24 | Pipeline |
| 022 | CONFIG_FETCHING 使用錯誤的 PromptType | ✅ | 2026-01-06 | Pipeline/Config |
| 023 | 統一處理流程發行者識別結果未同步到 DB | ✅ | 2026-01-07 | Pipeline/Data |
| 024 | Hooks API Path Errors | ✅ | 2026-01-07 | API |
| 024b | EmailNotVerified 錯誤訊息未正確顯示 | ✅ | 2026-01-19 | Auth/UI |
| 025 | Admin Pages Multiple Issues | ✅ | 2026-01-07 | UI/Admin |
| 026 | pdfjs-dist v5 ESM 最終解決方案 | ✅ | 2026-01-08 | UI/SSR |
| 026b | 公司編輯頁面路由缺失 | ✅ | 2026-01-13 | UI/Routing |
| 027 | 術語聚合報告導出為空 | ✅ | 2026-01-15 | Data/Export |
| 028 | 公司自動創建失敗問題 | ✅ | 2026-01-15 | Pipeline/Data |
| 029 | i18n 多語言缺失翻譯與命名空間 | ✅ | 2026-01-17 | i18n |
| 030 | 生產模式認證與 Session 同步問題 | ✅ | 2026-01-19 | Auth |
| 031 | 歷史數據批次處理進度無法即時顯示 | ✅ | 2026-01-20 | UI/Realtime |
| 032 | Field Mapping Config API UUID 驗證錯誤 | ✅ | 2026-01-21 | API/Validation |
| 033 | Template Matching API Zod 驗證 ID 格式不匹配 | ✅ | 2026-01-27 | API/Validation |
| 034 | 文件詳情頁面多項顯示問題 | ✅ | 2026-01-28 | UI |
| 035 | Companies 頁面構建快取與 Locale 問題 | ✅ | 2026-01-28 | UI/Build |
| 036 | Ref Number 匹配失敗時中止 Pipeline | ✅ | 2026-02-11 | Pipeline |
| 037 | Exchange Rate 轉換功能多項 Bug | ✅ | 2026-02-11 | Pipeline/Data |
| 038 | Template Matching formatId + matchSingle 缺 autoComplete | ✅ | 2026-02-11 | Pipeline |
| 039 | extracted-fields API 查詢不存在的 HistoricalFile | ✅ | 2026-02-12 | API |
| 040 | useFieldLabel Hook 對非標準欄位拋出 IntlError | ✅ | 2026-02-14 | UI/i18n |
| 041 | Rules New 頁面 i18n 遷移 + Forwarder→Company 術語 | ✅ | 2026-02-21 | i18n/Refactor |
| 042 | Rules Edit API 路徑錯誤 + Extraction Type + i18n | ✅ | 2026-02-22 | API/i18n |
| 043 | FieldDefinitionSet 欄位定義未注入 Stage 3 Prompt | ✅ | 2026-02-24 | Pipeline |
| 044 | V3.1 fieldMappings 為空 — Template Instance 全"-" | ✅ | 2026-02-24 | Pipeline/Data |
| 045 | Template Matching 欄位 key 不匹配 | ✅ | 2026-02-24 | Pipeline/Data |
| 046 | Mapping Rule Transform Type Stale Closure | ✅ | 2026-02-25 | UI/State |
| 047 | Audit Log 頁面角色名稱不匹配導致無法訪問 | ✅ | 2026-02-26 | Auth/Data |
| 048 | 提取管線缺失 ProcessingQueue 記錄建立 | ✅ | 2026-02-26 | Pipeline |
| 049 | Seed Prompt Stage 2 內容錯誤 + 信心度範圍不一致 | ✅ | 2026-03-02 | Pipeline/Config |

---

## Category Distribution

### CHANGE by Category

| Category | Count | Key IDs |
|----------|-------|---------|
| **Pipeline / Extraction** | 21 | 001, 005, 006, 010, 013-021, 024-026, 032, 036-037, 040, 042-044, 047-048, 053 |
| **UI / Frontend** | 14 | 003, 009, 022-023, 027-031, 038, 041, 046, 049-051 |
| **Refactor / System** | 4 | 007, 031, 033-034 |
| **Data Model / Config** | 5 | 035, 039, 045, 047-048 |
| **DevOps / Tooling** | 3 | 008, 033-034 |
| **i18n** | 2 | 011, 018 |
| **Auth / Admin** | 3 | 049-050, 052 |
| **Testing** | 1 | 016 |

### FIX by Category

| Category | Count | Key IDs |
|----------|-------|---------|
| **Pipeline / Processing** | 15 | 003, 005-006, 016, 018, 022-023, 028, 036-038, 043-045, 048 |
| **UI / Frontend** | 12 | 008-012, 020, 025, 031, 034-035, 040, 046 |
| **Data / Reports** | 7 | 002, 004, 007, 013-015, 027 |
| **API / Validation** | 5 | 024, 032-033, 039, 042 |
| **Auth / Session** | 4 | 019b, 024b, 030, 047 |
| **i18n** | 4 | 029, 040-042 |
| **SSR / Module** | 4 | 008, 010, 019, 026 |
| **Code Quality** | 1 | 001 |

---

## Epic / Feature Area Mapping

| Epic / Area | CHANGEs | FIXes |
|-------------|---------|-------|
| **Epic 0 — Historical Data** | 003, 010, 012 | 004, 007, 013-015, 017-018, 020, 027, 031 |
| **Epic 2 — Document Upload** | 001, 017, 019 | 003, 006, 021 |
| **Epic 5 — Company Config** | 007, 009 | 002, 028, 035 |
| **Epic 7 — Reports** | 002 | 015, 027 |
| **Epic 13 — Doc Preview** | 004, 022-023 | 008-012, 019, 026 |
| **Epic 14 — Prompt Config** | 006, 026-028 | 022 |
| **Epic 15 — Unified Pipeline** | 005, 013-021, 024-025, 032, 040, 042-043 | 005, 016, 023, 036-038, 043-045, 048 |
| **Epic 16 — Format Mgmt** | 038, 045 | 032-033, 039 |
| **Epic 17 — i18n** | 011, 018, 031 | 029, 040-042 |
| **Epic 18 — Auth** | 049 | 024b, 030, 047 |
| **Epic 19 — Template Matching** | 037, 041, 046-048 | 038, 044-046 |
| **Epic 20 — Ref Number** | 029, 035-036 | 036 |
| **Epic 21 — Exchange Rate** | 032 | 037 |
| **System-wide / DevOps** | 008, 030, 033-034, 039, 050, 052-053 | 001, 009, 025 |
| **Extraction V3 Architecture** | 020-021, 024-025, 042, 053 | 043-045, 049 |

---

## Timeline Phases

| Phase | Period | CHANGEs | FIXes | Focus |
|-------|--------|---------|-------|-------|
| **Phase 1: Foundation** | 2025-12-23 ~ 2026-01-06 | 001-006 | 001-019 | Core Epic 0 + PDF viewer fixes |
| **Phase 2: System Refactor** | 2026-01-07 ~ 2026-01-20 | 007-012 | 019b-032 | Company rename, auth, i18n |
| **Phase 3: E2E Pipeline** | 2026-01-27 ~ 2026-02-04 | 013-028 | 033-035 | V3 extraction architecture |
| **Phase 4: Feature Completion** | 2026-02-06 ~ 2026-02-26 | 029-052 | 036-048 | Template matching, field definitions |
| **Phase 5: Stabilization** | 2026-03-02 ~ current | 053 | 049 | Prompt tuning, confidence ranges |

---

## Observations

1. **Pipeline dominance**: ~40% of all CHANGE/FIX items relate to the extraction pipeline, reflecting the project's core complexity.
2. **PDF viewer recurring issues**: FIX-008/010/011/019/026 form a chain of pdfjs-dist SSR compatibility fixes across 5 iterations.
3. **V3 architecture cluster**: CHANGE-020 through CHANGE-025 represent a rapid architecture evolution from V2 to V3 within one week (Jan 29 ~ Feb 3).
4. **Template matching maturity**: CHANGE-037 through CHANGE-048 and FIX-038 through FIX-046 show intensive template matching refinement in Feb 2026.
5. **Naming/i18n debt**: CHANGE-007 (forwarders→companies), CHANGE-031 (invoice→document), and multiple FIX i18n items indicate ongoing terminology standardization.
6. **Open items**: CHANGE-029 (Ref Number UI), CHANGE-044 (Line Item dual-mode), CHANGE-048 (Ref Number row key), CHANGE-052 (GLOBAL_ADMIN role) remain unimplemented.
