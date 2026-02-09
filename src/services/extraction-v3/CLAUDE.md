# Extraction V3 管線 - 三階段提取架構

> **文件數量**: 19 個服務文件（6 核心 + 7 stages + 4 utils + 2 index）
> **架構版本**: V3（單次 GPT） + V3.1（三階段分離）
> **最後更新**: 2026-02-09
> **版本**: 1.0.0

---

## 概述

V3 提取管線是本項目的核心 AI 處理引擎，負責從文件（PDF/Image）中自動提取結構化資料。支援兩種模式：

| 模式 | 說明 | GPT 呼叫次數 | 適用場景 |
|------|------|-------------|----------|
| **V3** | 單次 GPT 呼叫完成所有提取 | 1 次 | 簡單文件 |
| **V3.1** | 三階段分離（CHANGE-024） | 2-3 次 | 複雜文件、需要精確控制 |

---

## 三階段管線架構

```
┌─────────────────────────────────────────────────────────────────┐
│                    extraction-v3.service.ts（入口）               │
│                              │                                   │
│    ┌─────────────────────────┼─────────────────────────┐        │
│    │                         ▼                         │        │
│    │         stage-orchestrator.service.ts              │        │
│    │                    │                               │        │
│    │    ┌───────────────┼───────────────┐              │        │
│    │    ▼               ▼               ▼              │        │
│    │ Stage 1         Stage 2         Stage 3           │        │
│    │ 公司識別        格式匹配        欄位提取           │ stages/│
│    │ (GPT-5-nano)   (GPT-5-nano)   (GPT-5.2)          │        │
│    │    │               │               │              │        │
│    │    │               │           ┌───┼───┐          │        │
│    │    │               │           │   │   │          │        │
│    │    │               │         GPT  Ref  FX         │        │
│    │    │               │        Caller Match Conv     │        │
│    └────┼───────────────┼───────────┼───┼───┼──────────┘        │
│         │               │           │   │   │                    │
│         ▼               ▼           ▼   ▼   ▼                    │
│    ┌─────────────────────────────────────────────────┐          │
│    │  prompt-assembly → confidence-v3-1 → validation │ 核心服務  │
│    └─────────────────────────────────────────────────┘          │
│                                                                  │
│    ┌─────────────────────────────────────────────────┐          │
│    │  pdf-converter │ prompt-builder │ prompt-merger  │ utils/   │
│    │  variable-replacer                              │          │
│    └─────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 目錄結構

```
src/services/extraction-v3/
├── index.ts                          # 統一導出（377 行）
├── extraction-v3.service.ts          # V3 主服務入口
├── prompt-assembly.service.ts        # Prompt 組裝服務
├── unified-gpt-extraction.service.ts # 統一 GPT 提取（V3 模式）
├── confidence-v3.service.ts          # V3 信心度計算
├── confidence-v3-1.service.ts        # V3.1 信心度計算（最新版）
├── result-validation.service.ts      # 結果驗證服務
│
├── stages/                           # 三階段處理器（V3.1）
│   ├── index.ts                      # Stages 導出
│   ├── stage-orchestrator.service.ts # 階段協調器
│   ├── stage-1-company.service.ts    # Stage 1: 公司識別
│   ├── stage-2-format.service.ts     # Stage 2: 格式匹配
│   ├── stage-3-extraction.service.ts # Stage 3: 欄位提取
│   ├── gpt-caller.service.ts         # 共用 GPT 呼叫器
│   ├── reference-number-matcher.service.ts  # 參考編號匹配 (Epic 20)
│   └── exchange-rate-converter.service.ts   # 匯率轉換 (Epic 21)
│
└── utils/                            # 提取工具函數
    ├── pdf-converter.ts              # PDF → Base64 圖片轉換
    ├── prompt-builder.ts             # Prompt 構建器
    ├── prompt-merger.ts              # Prompt 合併器 (CHANGE-026)
    └── variable-replacer.ts          # 變數替換器 (CHANGE-026)
```

---

## 核心服務詳解

### 入口服務

| 服務 | 說明 | 關鍵導出 |
|------|------|----------|
| `extraction-v3.service.ts` | V3 提取主服務 | `ExtractionV3Service`, `processFileV3`, `checkExtractionV3Health` |
| `prompt-assembly.service.ts` | Prompt 動態組裝 | `PromptAssemblyService`, `assemblePrompt`, `loadStage1/2/3PromptConfig` |
| `unified-gpt-extraction.service.ts` | V3 單次 GPT 提取 | `UnifiedGptExtractionService`, `extractWithGpt` |

### 信心度計算

| 服務 | 版本 | 說明 |
|------|------|------|
| `confidence-v3.service.ts` | V3 | 基礎信心度計算 |
| `confidence-v3-1.service.ts` | V3.1 | 三階段信心度 + 智能路由（最新版） |

### 結果驗證

| 服務 | 說明 |
|------|------|
| `result-validation.service.ts` | 驗證 GPT 返回結果的格式和內容 |

---

## 三階段處理器 (stages/)

### Stage 1: 公司識別 (`stage-1-company.service.ts`)

- **目的**: 從文件圖片中識別發送公司
- **模型**: GPT-5-nano（成本最低）
- **輸入**: 文件圖片 + 已知公司列表
- **輸出**: `Stage1CompanyResult`（公司名稱、匹配方式、信心度）

### Stage 2: 格式匹配 (`stage-2-format.service.ts`)

- **目的**: 匹配文件格式模板
- **模型**: GPT-5-nano
- **輸入**: Stage 1 結果 + 格式模板列表
- **輸出**: `Stage2FormatResult`（格式 ID、配置來源、信心度）

### Stage 3: 欄位提取 (`stage-3-extraction.service.ts`)

- **目的**: 根據已識別的公司和格式，提取所有欄位
- **模型**: GPT-5.2（最強推理能力）
- **輸入**: Stage 1 + Stage 2 結果 + 動態 Prompt
- **輸出**: `Stage3ExtractionResult`（標準欄位、行項目、附加費用）
- **後處理**: 參考編號匹配、匯率轉換

### 階段協調器 (`stage-orchestrator.service.ts`)

- **目的**: 管理 Stage 1 → 2 → 3 的執行流程
- **功能**: 錯誤處理、超時控制、結果聚合

### GPT 呼叫器 (`gpt-caller.service.ts`)

- **目的**: 統一封裝 Azure OpenAI GPT API 呼叫
- **功能**: 支援多種模型（GPT-5-nano、GPT-5.2）、圖片詳細度控制

### 參考編號匹配 (`reference-number-matcher.service.ts`) - Epic 20

- **目的**: 將提取的參考編號與主檔資料匹配
- **功能**: 精確匹配、模糊匹配、信心度計算

### 匯率轉換 (`exchange-rate-converter.service.ts`) - Epic 21

- **目的**: 將提取金額轉換為目標貨幣
- **功能**: 匯率查詢、自動轉換、轉換記錄

---

## 工具函數 (utils/)

| 工具 | 說明 | CHANGE |
|------|------|--------|
| `pdf-converter.ts` | PDF 轉 Base64 圖片（使用 pdf-to-img） | CHANGE-021 |
| `prompt-builder.ts` | 構建系統/用戶 Prompt | CHANGE-021 |
| `prompt-merger.ts` | 合併多層 Prompt 配置（global + company + format） | CHANGE-026 |
| `variable-replacer.ts` | 動態替換 Prompt 中的 `${變數}` 佔位符 | CHANGE-026 |

---

## 資料流

```
PDF/Image 輸入
    │
    ▼
PdfConverter (pdf-converter.ts)
    │ Base64 圖片陣列
    ▼
StageOrchestrator
    │
    ├── Stage 1 → 公司識別 → Stage1CompanyResult
    │                            │
    ├── Stage 2 → 格式匹配 ← ───┘ → Stage2FormatResult
    │                                    │
    └── Stage 3 → 欄位提取 ← ───────────┘ → Stage3ExtractionResult
         │
         ├── ReferenceNumberMatcher → 匹配參考編號
         └── ExchangeRateConverter → 轉換匯率
              │
              ▼
    ResultValidation → 結果驗證
              │
              ▼
    ConfidenceV3_1 → 信心度計算 → 路由決策
              │
              ▼
    ExtractionV3_1Output（最終輸出）
```

---

## 相關類型

所有 V3/V3.1 類型定義在 `src/types/extraction-v3.types.ts`，包括：
- 處理步驟類型 (`ProcessingStepV3`, `ProcessingStepV3_1`)
- 階段結果類型 (`Stage1CompanyResult`, `Stage2FormatResult`, `Stage3ExtractionResult`)
- 信心度類型 (`ConfidenceResultV3_1`, `DimensionScoreV3_1`)
- 智能路由類型 (`SmartRoutingInput`, `SmartRoutingOutput`)

---

## 變更歷史

| CHANGE | 說明 | 日期 |
|--------|------|------|
| CHANGE-021 | V3 統一提取重構 | 2026-01 |
| CHANGE-024 | V3.1 三階段架構 | 2026-02 |
| CHANGE-025 | Stage Prompt 載入 + 智能路由 | 2026-02 |
| CHANGE-026 | Prompt 合併器 + 變數替換器 | 2026-02 |
| CHANGE-032 | 參考編號匹配 + 匯率轉換（規劃中） | 2026-02 |

---

## 相關文檔

- [CLAUDE.md (根目錄)](../../../CLAUDE.md) - 項目總指南
- [src/services/CLAUDE.md](../CLAUDE.md) - 服務層總覽
- [src/types/extraction-v3.types.ts](../../types/extraction-v3.types.ts) - V3 類型定義
- [.claude/rules/services.md](../../../.claude/rules/services.md) - 服務開發規範

---

**維護者**: Development Team
**最後更新**: 2026-02-09
**版本**: 1.0.0
