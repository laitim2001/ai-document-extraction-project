# Epic 14: Company + DocumentFormat Prompt 配置

**目標**：為不同的 Company（供應商公司）和 DocumentFormat（文件格式）配置專屬的 GPT Prompt，實現更精準的文件識別和術語分類

**前置條件**：Epic 0 完成（Story 0-8 發行者識別、Story 0-9 格式分類）

---

## 背景說明

目前 GPT Vision 使用統一的 Prompt 進行：
- 文件發行者識別 (Story 0-8)
- 術語分類 (Story 0-10)
- Prompt 優化 (Story 0-11)

但不同供應商的發票格式差異很大：
- **DHL**: 使用特定術語如 "AWB", "Fuel Surcharge"
- **FedEx**: 使用 "Tracking Number", "Fuel Adjustment"
- **Maersk**: 使用 "B/L", "Demurrage", "Container Fee"
- **其他**: 各有專屬的術語和格式

統一 Prompt 無法針對特定供應商優化，導致：
1. 術語分類準確率受限
2. 無法處理供應商特有的欄位
3. 難以調整不同格式的提取策略

### 解決方案架構

```
┌─────────────────────────────────────────────────────────────────┐
│                      Prompt 配置系統                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Global Prompt (基礎模板)                                  │   │
│  │ - 通用識別指令                                            │   │
│  │ - 標準輸出格式                                            │   │
│  │ - 基本術語分類規則                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓ 覆蓋                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Company Prompt (供應商專屬)                               │   │
│  │ - DHL: "識別 AWB, Fuel Surcharge 等術語"                 │   │
│  │ - FedEx: "識別 Tracking Number, Fuel Adjustment"         │   │
│  │ - Maersk: "識別 B/L, Demurrage, Container Fee"           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓ 覆蓋                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Format Prompt (格式專屬)                                  │   │
│  │ - "DHL Express Invoice": 特殊欄位位置                    │   │
│  │ - "DHL Freight Invoice": 不同的術語結構                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

Prompt 解析順序:
1. 載入 Global Prompt
2. 如果有 Company Prompt → 合併/覆蓋
3. 如果有 Format Prompt → 合併/覆蓋
4. 返回最終 Prompt
```

### Prompt 類型

| 類型 | 用途 | 配置層級 |
|------|------|----------|
| `ISSUER_IDENTIFICATION` | 文件發行者識別 | Global / Company |
| `TERM_CLASSIFICATION` | 術語分類 | Global / Company / Format |
| `FIELD_EXTRACTION` | 欄位提取增強 | Global / Company / Format |
| `VALIDATION` | 結果驗證 | Global / Company |

---

## Story 14.1: Prompt 配置模型與 API

**As a** 系統管理員,
**I want** 透過 API 管理 Prompt 配置,
**So that** 可以為不同 Company 和 Format 設定專屬的 Prompt。

**Acceptance Criteria:**

**Given** 調用 GET /api/v1/prompt-configs
**When** 提供篩選條件（promptType, companyId, documentFormatId）
**Then** 返回符合條件的配置列表

**Given** 調用 POST /api/v1/prompt-configs
**When** 提供有效的配置資料（包含 systemPrompt、userPromptTemplate）
**Then** 建立新的 Prompt 配置
**And** 驗證唯一性約束（promptType + companyId + documentFormatId）

**Given** 調用 PATCH /api/v1/prompt-configs/:id
**When** 提供要更新的欄位
**Then** 更新配置
**And** 返回更新後的配置

**技術要點**：
- PromptConfig Prisma 模型
- CRUD REST API
- 配置驗證服務

---

## Story 14.2: Prompt 配置管理介面

**As a** 系統管理員,
**I want** 通過可視化介面管理 Prompt 配置,
**So that** 我可以輕鬆編輯和測試不同的 Prompt。

**Acceptance Criteria:**

**Given** 管理員進入 Prompt 配置頁面
**When** 查看配置列表
**Then** 顯示所有配置，按 promptType 分組
**And** 顯示配置層級（Global / Company / Format）

**Given** 管理員編輯 Prompt
**When** 使用 Prompt 編輯器
**Then** 支援 Markdown 語法高亮
**And** 支援變數插入（如 {{companyName}}, {{knownTerms}}）
**And** 即時預覽最終 Prompt

**Given** 管理員測試 Prompt
**When** 上傳測試文件
**Then** 使用當前 Prompt 配置執行提取
**And** 顯示提取結果供比較

**技術要點**：
- Prompt 配置列表頁面
- Prompt 編輯器（支援變數、預覽）
- 測試功能（即時測試 Prompt 效果）

---

## Story 14.3: Prompt 解析與合併服務

**As a** 系統,
**I want** 根據文件的 Company 和 Format 動態解析 Prompt,
**So that** 不同文件可以使用最適合的 Prompt 配置。

**Acceptance Criteria:**

**Given** 系統需要獲取 Prompt
**When** 提供 promptType、companyId、documentFormatId
**Then** 按優先級查找配置（Format > Company > Global）
**And** 返回解析後的 Prompt

**Given** 需要合併多層 Prompt
**When** 存在 Company 和 Format 層配置
**Then** 按 mergeStrategy 合併（OVERRIDE / APPEND / PREPEND）
**And** 替換變數（{{companyName}} → 實際公司名）

**Given** 變數需要動態填充
**When** 執行變數替換
**Then** 支援靜態變數（配置時定義）
**And** 支援動態變數（運行時計算，如 knownTerms）
**And** 支援上下文變數（來自處理流程）

**技術要點**：
- PromptResolver 服務
- 變數替換引擎
- 合併策略（覆蓋 / 附加 / 自訂）

---

## Story 14.4: GPT Vision 服務整合

**As a** 系統,
**I want** GPT Vision 服務使用動態 Prompt 配置,
**So that** 不同文件可以獲得最佳的 AI 處理效果。

**Acceptance Criteria:**

**Given** 文件進入 GPT Vision 處理
**When** 需要發行者識別
**Then** 使用 ISSUER_IDENTIFICATION 類型的動態 Prompt
**And** 根據識別結果獲取對應的 Company 配置

**Given** 文件需要術語分類
**When** 已知 Company 和 Format
**Then** 使用 TERM_CLASSIFICATION 類型的動態 Prompt
**And** Prompt 包含該 Company/Format 的已知術語

**Given** 功能開關設定為關閉
**When** 處理文件
**Then** 使用原有的硬編碼 Prompt
**And** 確保向後兼容

**技術要點**：
- 修改 gpt-vision.service.ts 使用動態 Prompt
- 修改 ai-term-validation.service.ts 使用動態 Prompt
- 功能開關和向後兼容

---

## 依賴關係

```
Epic 14: Prompt 配置與動態生成
├─ Story 14.1: Prompt 配置模型與 API
├─ Story 14.2: Prompt 配置管理介面 (依賴 14.1)
├─ Story 14.3: Prompt 解析與合併服務 (依賴 14.1)
└─ Story 14.4: GPT Vision 服務整合 (依賴 14.3)
```

---

## 成功指標

| 指標 | 目標 |
|------|------|
| 術語分類準確率 | 從 85% 提升至 92% |
| 供應商專屬術語識別率 | 95%+ |
| Prompt 配置管理響應時間 | < 200ms |

---

## 與其他 Epic 的關係

- **Story 0-8**: 提供 companyId（發行者識別）
- **Story 0-9**: 提供 documentFormatId（格式分類）
- **Epic 13**: 互補關係 - Epic 13 處理欄位映射，Epic 14 處理 Prompt 配置
- **Epic 15**: 下游 - Epic 15 的統一處理流程使用 Epic 14 的動態 Prompt

---

*Epic 建立日期: 2026-01-02*
*狀態: 規劃中*
