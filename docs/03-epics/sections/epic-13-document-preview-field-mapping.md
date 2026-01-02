# Epic 13: 文件預覽與欄位映射

**目標**：提供直觀的文件預覽介面和靈活的欄位映射配置，讓用戶可以查看 AI 提取結果並自定義欄位映射規則

**前置條件**：Epic 0 完成（DocumentFormat 模型建立）

---

## 背景說明

目前系統提取文件內容後存在以下問題：

1. **缺乏視覺化預覽**: 用戶無法直觀看到提取欄位在原始文件中的位置
2. **映射規則固定**: Azure DI 提取的欄位名稱與系統內部欄位名稱之間的映射是寫死的
3. **缺乏自定義能力**: 不同格式的文件可能需要不同的欄位映射策略

### 解決方案架構

```
┌─────────────────────────────────────────────────────────────────┐
│                     文件預覽與欄位映射系統                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 文件預覽層 (Story 13-1)                                  │   │
│  │ - PDFViewer (react-pdf)                                 │   │
│  │ - FieldHighlightOverlay (bounding box 覆蓋)            │   │
│  │ - Zoom/Pan/Navigation 控制                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↕ 互動                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 提取結果面板 (Story 13-2)                                │   │
│  │ - ExtractedFieldsPanel                                  │   │
│  │ - FieldCard (信心度顯示、inline 編輯)                   │   │
│  │ - 搜尋/過濾/排序功能                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↕ 配置                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 欄位映射配置 (Story 13-3, 13-4)                          │   │
│  │ - MappingConfigPanel                                    │   │
│  │ - SourceFieldSelector / TargetFieldSelector             │   │
│  │ - MappingRuleList (drag-drop 排序)                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↕ 執行                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 動態映射服務 (Story 13-5)                                │   │
│  │ - FieldMappingEngine                                    │   │
│  │ - DynamicMappingService                                 │   │
│  │ - 結果緩存與處理流水線整合                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Story 13.1: 文件預覽組件與欄位高亮

**As a** 審核人員,
**I want** 在預覽文件時看到提取欄位的位置高亮,
**So that** 我可以快速驗證 AI 提取的準確性。

**Acceptance Criteria:**

**Given** 用戶開啟文件詳情頁面
**When** 文件為 PDF 格式
**Then** 使用 react-pdf 渲染 PDF 預覽
**And** 支援縮放、翻頁、導航控制
**And** 在欄位位置上疊加高亮框（bounding box）

**Given** 用戶點擊某個高亮區域
**When** 該區域對應某個提取欄位
**Then** 右側面板自動滾動到對應欄位卡片
**And** 欄位卡片高亮顯示

**技術要點**：
- 使用 react-pdf 渲染 PDF
- FieldHighlightOverlay 組件渲染 bounding box
- 支援座標系統轉換（PDF 座標 → 螢幕座標）

---

## Story 13.2: 欄位提取結果面板

**As a** 審核人員,
**I want** 查看和編輯 AI 提取的欄位結果,
**So that** 我可以快速修正錯誤並確認正確的提取。

**Acceptance Criteria:**

**Given** 用戶開啟文件詳情頁面
**When** 查看提取結果面板
**Then** 顯示所有提取欄位的卡片列表
**And** 每個卡片顯示：欄位名稱、提取值、信心度、來源

**Given** 用戶點擊某個欄位卡片
**When** 該欄位有對應的 bounding box
**Then** 左側預覽自動滾動到對應位置
**And** 對應的高亮框突出顯示

**Given** 用戶雙擊欄位值
**When** 欄位可編輯
**Then** 進入 inline 編輯模式
**And** 支援儲存或取消編輯

**技術要點**：
- ExtractedFieldsPanel 容器組件
- FieldCard 組件（信心度顯示、inline 編輯）
- 搜尋、過濾、排序功能

---

## Story 13.3: 欄位映射配置介面

**As a** 系統管理員,
**I want** 可視化配置欄位映射規則,
**So that** 我可以靈活調整不同文件格式的映射策略。

**Acceptance Criteria:**

**Given** 管理員進入映射配置頁面
**When** 選擇要配置的 Company 或 DocumentFormat
**Then** 顯示現有的映射規則列表
**And** 支援新增、編輯、刪除規則

**Given** 管理員新增映射規則
**When** 選擇來源欄位和目標欄位
**Then** 可選擇轉換類型（直接映射、串接、拆分、查表、自定義）
**And** 可配置轉換參數

**Given** 管理員調整規則順序
**When** 使用 drag-drop 重新排序
**Then** 規則按新順序執行

**技術要點**：
- MappingConfigPanel 組件
- SourceFieldSelector / TargetFieldSelector 組件
- MappingRuleList 組件（drag-drop 排序）

---

## Story 13.4: 映射配置 API

**As a** 前端應用,
**I want** 透過 API 管理欄位映射配置,
**So that** 配置可以持久化並在系統中共享。

**Acceptance Criteria:**

**Given** 調用 GET /api/v1/field-mapping-configs
**When** 提供篩選條件（companyId, documentFormatId）
**Then** 返回符合條件的配置列表

**Given** 調用 POST /api/v1/field-mapping-configs
**When** 提供有效的配置資料
**Then** 建立新的映射配置
**And** 返回建立的配置詳情

**Given** 調用 PATCH /api/v1/field-mapping-configs/:id
**When** 提供要更新的欄位
**Then** 更新配置
**And** 返回更新後的配置

**技術要點**：
- FieldMappingConfig Prisma 模型
- FieldMappingRule Prisma 模型
- CRUD REST API
- 測試端點、導入/導出功能

---

## Story 13.5: 動態欄位映射服務整合

**As a** 系統,
**I want** 在處理文件時動態應用欄位映射配置,
**So that** 不同文件可以使用各自的映射策略。

**Acceptance Criteria:**

**Given** 文件處理流程開始
**When** 需要執行欄位映射
**Then** 根據文件的 Company 和 DocumentFormat 獲取適用的配置
**And** 按優先級解析配置（Format > Company > Global）

**Given** 獲取到映射配置
**When** 執行映射
**Then** 按規則順序執行每條映射規則
**And** 支援各種轉換類型（直接、串接、拆分、查表、自定義）

**Given** 映射結果產生
**When** 需要緩存結果
**Then** 將映射結果緩存以提升效能
**And** 與處理流水線整合

**技術要點**：
- FieldMappingEngine 服務
- DynamicMappingService 服務
- 結果緩存機制
- 處理流水線整合

---

## 依賴關係

```
Epic 13: 文件預覽與欄位映射
├─ Story 13.1: 文件預覽組件與欄位高亮
├─ Story 13.2: 欄位提取結果面板 (依賴 13.1)
├─ Story 13.3: 欄位映射配置介面 (依賴 13.4)
├─ Story 13.4: 映射配置 API
└─ Story 13.5: 動態欄位映射服務整合 (依賴 13.4)
```

---

## 成功指標

| 指標 | 目標 |
|------|------|
| PDF 預覽載入時間 | < 2 秒 |
| 欄位高亮渲染延遲 | < 100ms |
| 映射配置 API 響應時間 | < 200ms |
| 動態映射執行時間 | < 50ms/文件 |

---

## 與其他 Epic 的關係

- **Epic 0**: 使用 Epic 0 建立的 DocumentFormat 模型
- **Epic 2**: 使用 Epic 2 的文件提取結果
- **Epic 14**: 互補關係 - Epic 13 處理欄位映射，Epic 14 處理 Prompt 配置
- **Epic 15**: 下游 - Epic 15 的統一處理流程使用 Epic 13 的映射服務

---

*Epic 建立日期: 2026-01-02*
*狀態: 規劃中*
