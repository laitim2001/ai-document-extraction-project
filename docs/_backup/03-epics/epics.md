---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - "docs/01-planning/prd/prd.md"
  - "docs/02-architecture/architecture.md"
  - "docs/01-planning/ux/ux-design-specification.md"
workflowType: 'epics'
project_name: 'ai-document-extraction-project'
user_name: 'chris'
date: '2025-12-15'
---

# ai-document-extraction-project - Epic Breakdown

## Overview

本文檔提供 ai-document-extraction-project 的完整 Epic 和 Story 分解，將 PRD、UX Design 和 Architecture 的需求轉換為可執行的開發任務。

## Requirements Inventory

### Functional Requirements

#### 1. 文件處理（Document Processing）
- **FR1**: 用戶可以手動上傳單張或批量發票文件（支援 PDF、圖片格式）
- **FR2**: 系統可以從 SharePoint 自動獲取待處理的發票文件
- **FR3**: 系統可以從 Outlook 郵件附件自動提取發票文件
- **FR4**: 系統可以使用 OCR 技術提取發票中的文字內容
- **FR5**: 系統可以識別發票所屬的 Forwarder
- **FR6**: 系統可以將提取的內容映射到標準化的 Header 欄位（約 90 個）
- **FR7**: 系統可以為每個提取結果計算信心度評分
- **FR8**: 系統可以根據信心度自動分流處理路徑（自動/快速確認/完整審核）

#### 2. 審核與修正（Review & Correction）
- **FR9**: 數據處理員可以查看待審核的發票列表
- **FR10**: 數據處理員可以查看發票的提取結果和原始文件對照
- **FR11**: 數據處理員可以確認正確的提取結果
- **FR12**: 數據處理員可以修正錯誤的提取結果
- **FR13**: 數據處理員可以標記修正為「正常修正」或「特例不學習」
- **FR14**: 數據處理員可以將複雜案例升級給 Super User
- **FR15**: Super User 可以處理升級的複雜案例
- **FR16**: 系統可以顯示信心度低的原因和不確定的欄位

#### 3. 規則管理（Rule Management）
- **FR17**: Super User 可以查看現有的映射規則
- **FR18**: Super User 可以建議新的映射規則
- **FR19**: Super User 可以審核待升級的學習規則
- **FR20**: 系統可以記錄用戶修正並識別重複模式
- **FR21**: 系統可以在累計 3 次相同修正後建議規則升級
- **FR22**: 系統可以在規則升級前顯示影響範圍分析
- **FR23**: 系統可以保留規則版本歷史（至少 5 個版本）
- **FR24**: 系統可以在準確率下降時自動回滾規則

#### 4. Forwarder 管理（Forwarder Management）
- **FR25**: Super User 可以查看所有 Forwarder Profile 列表
- **FR26**: Super User 可以查看單個 Forwarder 的詳細配置
- **FR27**: Super User 可以編輯 Forwarder 特定的映射規則
- **FR28**: Super User 可以測試 Forwarder 規則變更的效果
- **FR29**: 系統管理員可以新增或停用 Forwarder Profile

#### 5. 報表與分析（Reporting & Analytics）
- **FR30**: 用戶可以查看處理統計儀表板（處理量、成功率、自動化率）
- **FR31**: 用戶可以按時間範圍篩選報表數據
- **FR32**: 用戶可以按 Forwarder 篩選報表數據
- **FR33**: 城市經理可以匯出費用明細報表（Excel 格式）
- **FR34**: 區域經理可以查看跨城市的匯總報表
- **FR35**: 系統可以追蹤並顯示 AI API 使用量和成本

#### 6. 用戶管理（User Management）
- **FR36**: 用戶可以使用 Azure AD SSO 登入系統
- **FR37**: 系統管理員可以查看所有用戶列表
- **FR38**: 系統管理員可以新增用戶並分配角色
- **FR39**: 系統管理員可以修改用戶的角色和城市歸屬
- **FR40**: 系統管理員可以停用用戶帳戶
- **FR41**: 系統管理員可以定義自定義角色
- **FR42**: 城市經理可以管理本城市的用戶

#### 7. 多城市數據管理（Multi-City Data Management）
- **FR43**: 系統可以按城市隔離發票和處理數據
- **FR44**: 城市用戶僅能訪問本城市的數據
- **FR45**: 區域經理可以訪問授權城市的數據
- **FR46**: 全局管理者可以訪問所有城市的數據
- **FR47**: 系統可以在所有城市共享 Mapping Rules 和 Forwarder Profiles

#### 8. 審計與追溯（Audit & Traceability）
- **FR48**: 系統可以記錄所有用戶操作日誌
- **FR49**: 系統可以記錄所有數據變更（修改人、時間、原因）
- **FR50**: 審計人員可以查詢指定期間的處理記錄
- **FR51**: 審計人員可以從任何數據點追溯至原始發票文件
- **FR52**: 審計人員可以匯出符合審計要求的報告
- **FR53**: 系統可以保留數據和日誌至少 7 年

#### 9. 工作流整合（Workflow Integration）
- **FR54**: 系統可以與 n8n 工作流引擎進行雙向通訊
- **FR55**: n8n 管理員可以在系統內查看工作流執行狀態
- **FR56**: n8n 管理員可以手動觸發特定工作流
- **FR57**: n8n 管理員可以查看工作流執行錯誤詳情
- **FR58**: 系統可以追蹤文件在工作流中的處理進度

#### 10. 系統管理（System Administration）
- **FR59**: 系統管理員可以查看系統健康狀態儀表板
- **FR60**: 系統管理員可以查看 Azure 服務的連接狀態
- **FR61**: 系統管理員可以查看系統日誌和錯誤記錄
- **FR62**: 系統管理員可以配置系統參數（如信心度閾值）
- **FR63**: 系統可以在異常情況下發送告警通知

#### 11. 對外 API（External API）
- **FR64**: 外部系統可以通過 API 提交發票文件
- **FR65**: 外部系統可以通過 API 查詢處理狀態
- **FR66**: 外部系統可以通過 API 獲取提取結果
- **FR67**: 外部系統可以註冊 Webhook 接收處理完成通知
- **FR68**: API 可以支援基於角色的訪問控制

#### 12. 成本追蹤（Cost Tracking）
- **FR69**: 系統可以按城市追蹤發票處理數量
- **FR70**: 系統可以按城市追蹤 AI API 調用成本
- **FR71**: 財務人員可以查看城市級別的成本報表
- **FR72**: 系統可以生成月度成本分攤報告

### NonFunctional Requirements

#### Performance（效能）
- **NFR-PERF-01**: 單張發票 AI 處理時間 < 30 秒
- **NFR-PERF-02**: Web 頁面載入時間 < 2 秒
- **NFR-PERF-03**: 搜尋結果返回時間 < 1 秒
- **NFR-PERF-04**: 批量處理能力 ≥ 500 張/小時
- **NFR-PERF-05**: 峰值處理能力 ≥ 1,000 張/小時
- **NFR-PERF-06**: 支援 ≥ 50 並發用戶

#### Security（安全性）
- **NFR-SEC-01**: 所有用戶必須通過 Azure AD SSO 認證
- **NFR-SEC-02**: Session 過期時間 ≤ 8 小時
- **NFR-SEC-03**: 非活躍 Session 30 分鐘後自動登出
- **NFR-SEC-04**: API 調用需有效 Token 認證（JWT/OAuth 2.0）
- **NFR-SEC-05**: 失敗登入嘗試 ≥ 5 次後鎖定 15 分鐘
- **NFR-SEC-06**: 傳輸中數據加密（TLS 1.2+）
- **NFR-SEC-07**: 靜態數據加密
- **NFR-SEC-10**: 城市間數據嚴格隔離（PostgreSQL RLS）
- **NFR-SEC-13**: 所有數據修改記錄審計日誌
- **NFR-SEC-14**: 審計日誌不可刪除、不可篡改
- **NFR-SEC-15**: 日誌保留 7 年

#### Scalability（可擴展性）
- **NFR-SCA-01**: 無狀態服務設計
- **NFR-SCA-02**: 新城市上線 < 1 週
- **NFR-SCA-03**: 新 Forwarder 支援 < 2 天
- **NFR-SCA-05**: 支援 ≥ 500,000 張/年發票
- **NFR-SCA-09**: 支援 11 個 APAC 城市

#### Reliability（可靠性）
- **NFR-REL-01**: 系統可用性 ≥ 99.5%
- **NFR-REL-04**: RPO（恢復點目標）< 1 小時
- **NFR-REL-05**: RTO（恢復時間目標）< 4 小時
- **NFR-REL-08**: AI 服務不可用時自動降級

#### Integration（整合性）
- **NFR-INT-01**: Azure Document Intelligence API 整合
- **NFR-INT-02**: Azure OpenAI API 整合
- **NFR-INT-04**: Azure AD SSO 整合
- **NFR-INT-05**: SharePoint 文件讀取
- **NFR-INT-06**: Outlook 附件提取
- **NFR-INT-08**: n8n 工作流引擎整合
- **NFR-INT-11**: RESTful API 設計

#### Accessibility（無障礙）
- **NFR-ACC-01**: 符合 WCAG 2.1 Level A
- **NFR-ACC-02**: 支援鍵盤導航
- **NFR-ACC-03**: 足夠的顏色對比度（≥ 4.5:1）

#### Maintainability（可維護性）
- **NFR-MAI-01**: 程式碼覆蓋率 ≥ 70%
- **NFR-MAI-02**: 技術文檔完整
- **NFR-MAI-05**: 監控儀表板

#### Internationalization（國際化）
- **NFR-I18N-01**: UI 支援繁體中文、簡體中文、英文
- **NFR-I18N-04**: 時區支援（各城市本地時間）

### Additional Requirements

#### 從 Architecture 提取的技術需求

- **ARCH-01**: 使用 create-next-app + shadcn/ui 作為 Starter Template
- **ARCH-02**: 使用 Prisma ORM 進行數據庫操作
- **ARCH-03**: 使用 NextAuth v5 + Azure AD Provider 進行認證
- **ARCH-04**: 使用 Zustand 管理 UI 狀態，React Query 管理伺服器狀態
- **ARCH-05**: 使用 BFF 模式（Next.js API Routes → Python Services）
- **ARCH-06**: Python 服務使用 FastAPI 框架
- **ARCH-07**: 遵循既定的命名規範（Prisma camelCase、DB snake_case、Component PascalCase）
- **ARCH-08**: API 錯誤格式遵循 RFC 7807
- **ARCH-09**: 部署到 Azure App Service + Azure Container Apps

#### 從 UX Design 提取的設計需求

- **UX-01**: 使用 Professional Blue 主題色（#2563EB）
- **UX-02**: 響應式設計支援桌面和平板
- **UX-03**: 審核界面使用並排 PDF 對照佈局
- **UX-04**: 信心度使用顏色編碼（綠>90%、黃70-90%、紅<70%）
- **UX-05**: 載入狀態使用 Skeleton 組件
- **UX-06**: 錯誤狀態提供清晰說明和重試選項

### FR Coverage Map

| FR | Epic | 說明 |
|----|------|------|
| FR1 | Epic 2 | 手動上傳發票文件 |
| FR2 | Epic 9 | SharePoint 自動獲取 |
| FR3 | Epic 9 | Outlook 郵件提取 |
| FR4 | Epic 2 | OCR 文字提取 |
| FR5 | Epic 2 | Forwarder 識別 |
| FR6 | Epic 2 | 欄位映射 |
| FR7 | Epic 2 | 信心度計算 |
| FR8 | Epic 2 | 自動分流 |
| FR9 | Epic 3 | 待審核列表 |
| FR10 | Epic 3 | 提取結果對照 |
| FR11 | Epic 3 | 確認提取結果 |
| FR12 | Epic 3 | 修正提取結果 |
| FR13 | Epic 3 | 標記修正類型 |
| FR14 | Epic 3 | 升級複雜案例 |
| FR15 | Epic 3 | 處理升級案例 |
| FR16 | Epic 3 | 顯示低信心度原因 |
| FR17 | Epic 4 | 查看映射規則 |
| FR18 | Epic 4 | 建議新規則 |
| FR19 | Epic 4 | 審核學習規則 |
| FR20 | Epic 4 | 記錄修正模式 |
| FR21 | Epic 4 | 建議規則升級 |
| FR22 | Epic 4 | 影響範圍分析 |
| FR23 | Epic 4 | 規則版本歷史 |
| FR24 | Epic 4 | 自動回滾規則 |
| FR25 | Epic 5 | Forwarder 列表 |
| FR26 | Epic 5 | Forwarder 詳細配置 |
| FR27 | Epic 5 | 編輯映射規則 |
| FR28 | Epic 5 | 測試規則效果 |
| FR29 | Epic 5 | 新增/停用 Profile |
| FR30 | Epic 7 | 處理統計儀表板 |
| FR31 | Epic 7 | 時間範圍篩選 |
| FR32 | Epic 7 | Forwarder 篩選 |
| FR33 | Epic 7 | 匯出費用報表 |
| FR34 | Epic 7 | 跨城市匯總報表 |
| FR35 | Epic 7 | AI 使用量成本 |
| FR36 | Epic 1 | Azure AD SSO 登入 |
| FR37 | Epic 1 | 用戶列表 |
| FR38 | Epic 1 | 新增用戶/分配角色 |
| FR39 | Epic 1 | 修改用戶角色 |
| FR40 | Epic 1 | 停用用戶帳戶 |
| FR41 | Epic 1 | 定義自定義角色 |
| FR42 | Epic 1 | 城市經理管理用戶 |
| FR43 | Epic 6 | 按城市隔離數據 |
| FR44 | Epic 6 | 城市用戶數據訪問 |
| FR45 | Epic 6 | 區域經理數據訪問 |
| FR46 | Epic 6 | 全局管理者訪問 |
| FR47 | Epic 6 | 共享全局規則 |
| FR48 | Epic 8 | 用戶操作日誌 |
| FR49 | Epic 8 | 數據變更記錄 |
| FR50 | Epic 8 | 查詢處理記錄 |
| FR51 | Epic 8 | 追溯原始文件 |
| FR52 | Epic 8 | 匯出審計報告 |
| FR53 | Epic 8 | 7 年數據保留 |
| FR54 | Epic 10 | n8n 雙向通訊 |
| FR55 | Epic 10 | 工作流執行狀態 |
| FR56 | Epic 10 | 手動觸發工作流 |
| FR57 | Epic 10 | 工作流錯誤詳情 |
| FR58 | Epic 10 | 處理進度追蹤 |
| FR59 | Epic 12 | 系統健康儀表板 |
| FR60 | Epic 12 | Azure 連接狀態 |
| FR61 | Epic 12 | 系統日誌查看 |
| FR62 | Epic 12 | 系統參數配置 |
| FR63 | Epic 12 | 異常告警通知 |
| FR64 | Epic 11 | API 提交發票 |
| FR65 | Epic 11 | API 查詢狀態 |
| FR66 | Epic 11 | API 獲取結果 |
| FR67 | Epic 11 | Webhook 通知 |
| FR68 | Epic 11 | API 訪問控制 |
| FR69 | Epic 7 | 城市處理數量追蹤 |
| FR70 | Epic 7 | 城市 AI 成本追蹤 |
| FR71 | Epic 7 | 城市成本報表 |
| FR72 | Epic 7 | 月度成本分攤 |

## Epic List

### Epic 1: 用戶認證與存取控制

**用戶成果**：用戶可以安全登入系統，管理員可以管理用戶權限和角色分配

| 項目 | 內容 |
|------|------|
| **FRs** | FR36, FR37, FR38, FR39, FR40, FR41, FR42 |
| **NFRs** | NFR-SEC-01~05, ARCH-03 |
| **依賴** | 無（基礎 Epic） |
| **說明** | 這是系統基礎，所有其他功能都需要認證和授權 |

---

### Epic 2: 手動發票上傳與 AI 處理

**用戶成果**：用戶可以上傳發票文件，系統自動進行 OCR 提取、Forwarder 識別、欄位映射並計算信心度

| 項目 | 內容 |
|------|------|
| **FRs** | FR1, FR4, FR5, FR6, FR7, FR8 |
| **NFRs** | NFR-PERF-01~05, NFR-INT-01~02, ARCH-05~06 |
| **依賴** | Epic 1 |
| **說明** | 核心 AI 處理流程，支援 PDF 和圖片格式 |

---

### Epic 3: 發票審核與修正工作流

**用戶成果**：數據處理員可以審核 AI 提取結果，修正錯誤，並將複雜案例升級給 Super User

| 項目 | 內容 |
|------|------|
| **FRs** | FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16 |
| **NFRs** | UX-03, UX-04, UX-05, UX-06 |
| **依賴** | Epic 1, Epic 2 |
| **說明** | 並排 PDF 對照界面，信心度顏色編碼，支援修正標記 |

---

### Epic 4: 映射規則管理與自動學習

**用戶成果**：Super User 可以查看、建議、審核映射規則，系統可從修正中自動學習並建議規則升級

| 項目 | 內容 |
|------|------|
| **FRs** | FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24 |
| **NFRs** | - |
| **依賴** | Epic 1, Epic 3 |
| **說明** | 累計 3 次相同修正後建議升級，支援影響範圍分析和版本回滾 |

---

### Epic 5: Forwarder 配置管理

**用戶成果**：Super User 可以查看和編輯 Forwarder Profile，測試規則變更效果

| 項目 | 內容 |
|------|------|
| **FRs** | FR25, FR26, FR27, FR28, FR29 |
| **NFRs** | NFR-SCA-03 |
| **依賴** | Epic 1, Epic 2 |
| **說明** | 新 Forwarder 支援 <2 天，管理員可新增或停用 Profile |

---

### Epic 6: 多城市數據隔離

**用戶成果**：系統按城市隔離數據，用戶只能訪問授權城市的數據，同時共享全局規則

| 項目 | 內容 |
|------|------|
| **FRs** | FR43, FR44, FR45, FR46, FR47 |
| **NFRs** | NFR-SEC-10, NFR-SCA-09 |
| **依賴** | Epic 1 |
| **說明** | PostgreSQL RLS 實現數據隔離，支援 11 個 APAC 城市 |

---

### Epic 7: 報表儀表板與成本追蹤

**用戶成果**：用戶可以查看處理統計儀表板，城市/區域經理可以匯出報表，財務可以查看成本分攤

| 項目 | 內容 |
|------|------|
| **FRs** | FR30, FR31, FR32, FR33, FR34, FR35, FR69, FR70, FR71, FR72 |
| **NFRs** | - |
| **依賴** | Epic 1, Epic 2, Epic 3 |
| **說明** | 支援按時間和 Forwarder 篩選，追蹤 AI API 使用成本 |

---

### Epic 8: 審計追溯與合規

**用戶成果**：審計人員可以查詢處理記錄，追溯至原始文件，匯出合規報告

| 項目 | 內容 |
|------|------|
| **FRs** | FR48, FR49, FR50, FR51, FR52, FR53 |
| **NFRs** | NFR-SEC-13, NFR-SEC-14, NFR-SEC-15 |
| **依賴** | Epic 1, Epic 2, Epic 3 |
| **說明** | 不可刪除/篡改的審計日誌，保留 7 年 |

---

### Epic 9: 自動化文件獲取

**用戶成果**：系統可自動從 SharePoint 獲取待處理文件，從 Outlook 郵件提取附件

| 項目 | 內容 |
|------|------|
| **FRs** | FR2, FR3 |
| **NFRs** | NFR-INT-05, NFR-INT-06 |
| **依賴** | Epic 1, Epic 2 |
| **說明** | 擴展 Epic 2 的文件來源，實現自動化處理流程 |

---

### Epic 10: n8n 工作流整合

**用戶成果**：系統與 n8n 整合，管理員可查看工作流狀態、手動觸發、追蹤處理進度

| 項目 | 內容 |
|------|------|
| **FRs** | FR54, FR55, FR56, FR57, FR58 |
| **NFRs** | NFR-INT-08 |
| **依賴** | Epic 1, Epic 2 |
| **說明** | 平台提供 API 供 n8n 調用，n8n 負責流程編排 |

**分工說明**：
- **平台職責**：提供處理 API、狀態查詢 API、Webhook 配置、n8n 連接監控
- **n8n 職責**：觸發源監控、流程編排、下游整合（用戶在 n8n 自行配置）

---

### Epic 11: 對外 API 服務

**用戶成果**：外部系統可通過 API 提交發票、查詢狀態、獲取結果，支援 Webhook 通知

| 項目 | 內容 |
|------|------|
| **FRs** | FR64, FR65, FR66, FR67, FR68 |
| **NFRs** | NFR-INT-11, NFR-SEC-04, ARCH-08 |
| **依賴** | Epic 1, Epic 2 |
| **說明** | RESTful API，JWT/OAuth 2.0 認證，RFC 7807 錯誤格式 |

---

### Epic 12: 系統管理與監控

**用戶成果**：系統管理員可以監控系統健康、查看連接狀態、配置參數、接收異常告警

| 項目 | 內容 |
|------|------|
| **FRs** | FR59, FR60, FR61, FR62, FR63 |
| **NFRs** | NFR-REL-01~08, NFR-MAI-05 |
| **依賴** | Epic 1 |
| **說明** | 健康狀態儀表板，Azure 服務監控，告警通知 |

---

## Epic 依賴關係圖

```
Epic 1: 認證 ─────────────────────────────────────────┐
    │                                                  │
    ▼                                                  │
Epic 2: 手動上傳 ──► Epic 3: 審核修正 ──► Epic 4: 規則管理
    │                     │
    │                     ▼
    │               Epic 5: Forwarder 管理
    │
    ├──► Epic 6: 多城市隔離（橫跨所有功能）
    │
    ├──► Epic 7: 報表儀表板（依賴 Epic 2, 3）
    │
    ├──► Epic 8: 審計追溯（依賴 Epic 2, 3）
    │
    ├──► Epic 9: 自動化獲取（擴展 Epic 2）
    │
    ├──► Epic 10: n8n 整合
    │
    ├──► Epic 11: 對外 API
    │
    └──► Epic 12: 系統監控
```

## Epic 總覽

| Epic | 名稱 | FR 數量 | 用戶價值 |
|------|------|---------|----------|
| 1 | 用戶認證與存取控制 | 7 | 安全登入與權限管理 |
| 2 | 手動發票上傳與 AI 處理 | 6 | 核心 AI 提取功能 |
| 3 | 發票審核與修正工作流 | 8 | 人工審核與品質控制 |
| 4 | 映射規則管理與自動學習 | 8 | 規則優化與系統學習 |
| 5 | Forwarder 配置管理 | 5 | Forwarder 特定配置 |
| 6 | 多城市數據隔離 | 5 | 數據安全與隔離 |
| 7 | 報表儀表板與成本追蹤 | 10 | 營運分析與成本控制 |
| 8 | 審計追溯與合規 | 6 | 合規與審計支援 |
| 9 | 自動化文件獲取 | 2 | 流程自動化 |
| 10 | n8n 工作流整合 | 5 | 工作流編排 |
| 11 | 對外 API 服務 | 5 | 系統整合能力 |
| 12 | 系統管理與監控 | 5 | 運維與監控 |
| **總計** | | **72** | |

---

# Epic Details

## Epic 1: 用戶認證與存取控制

**目標**：用戶可以安全登入系統，管理員可以管理用戶權限和角色分配

**FRs 覆蓋**：FR36, FR37, FR38, FR39, FR40, FR41, FR42

---

### Story 1.0: 專案初始化與基礎架構設定

**As a** 開發團隊,
**I want** 使用標準化的 Next.js 專案結構初始化專案,
**So that** 後續開發可以在一致的技術棧上進行。

**Acceptance Criteria:**

**Given** 專案需要初始化
**When** 執行初始化腳本
**Then** 使用 create-next-app 創建專案：
- TypeScript 5.x 嚴格模式
- Tailwind CSS 配置
- ESLint 配置
- App Router 模式
- src/ 目錄結構

**Given** 專案創建完成
**When** 初始化 UI 框架
**Then** 執行 shadcn/ui 初始化
**And** 安裝基礎 UI 組件（button, card, table, dialog, toast, form, input, label, badge, tabs）

**Given** UI 框架初始化完成
**When** 配置專案基礎結構
**Then** 創建以下目錄結構：
- src/app/ - 頁面路由
- src/components/ - 可重用組件
- src/lib/ - 工具函數
- src/services/ - API 服務層
- src/types/ - TypeScript 類型定義

**Given** 專案結構完成
**When** 配置開發環境
**Then** 設定環境變數模板（.env.example）
**And** 配置 Prisma ORM 連接 PostgreSQL
**And** 創建初始 Prisma Schema

**技術備註：**
- 使用 Architecture 文件中定義的初始化命令
- 配置 @/* 路徑別名
- 設定 ESLint 和 Prettier 規則

**FR 覆蓋**：基礎架構（無對應 FR，為技術前置條件）

---

### Story 1.1: Azure AD SSO 登入

**As a** 系統用戶,
**I want** 使用公司的 Azure AD 帳戶登入系統,
**So that** 我可以使用單一身份驗證安全地存取系統。

**Acceptance Criteria:**

**Given** 用戶尚未登入系統
**When** 用戶點擊「使用 Microsoft 登入」按鈕
**Then** 系統重導向至 Azure AD 登入頁面
**And** 成功驗證後，用戶被重導向回系統首頁
**And** 系統顯示用戶的名稱和頭像

**Given** 用戶已登入系統
**When** Session 超過 8 小時
**Then** 系統自動登出用戶
**And** 重導向至登入頁面

**Given** 用戶已登入但閒置超過 30 分鐘
**When** 用戶嘗試進行任何操作
**Then** 系統要求重新驗證

**技術備註：**
- 創建 `User` 資料表（id, email, name, azureAdId, status, createdAt, updatedAt）
- 配置 NextAuth v5 with Azure AD Provider
- 實現 Session 管理

**FR 覆蓋**：FR36

---

### Story 1.2: 用戶資料庫與角色基礎架構

**As a** 系統管理員,
**I want** 系統具備用戶和角色的數據結構,
**So that** 可以進行後續的權限管理功能。

**Acceptance Criteria:**

**Given** 用戶通過 Azure AD 首次登入
**When** 系統驗證成功
**Then** 系統自動創建用戶記錄
**And** 用戶被分配預設角色（Data Processor）
**And** 用戶狀態設為「Active」

**Given** 系統已有預定義的角色
**When** 查詢角色列表
**Then** 系統返回以下角色：System Admin, Super User, Data Processor, City Manager, Regional Manager, Auditor

**技術備註：**
- 創建 `Role` 資料表（id, name, description, permissions, isSystem, createdAt）
- 創建 `UserRole` 關聯表
- 種子數據：6 個預設角色

**FR 覆蓋**：FR36 (部分)

---

### Story 1.3: 用戶列表與搜尋

**As a** 系統管理員,
**I want** 查看所有系統用戶的列表,
**So that** 我可以了解系統的用戶狀況並進行管理。

**Acceptance Criteria:**

**Given** 系統管理員已登入
**When** 導航至「用戶管理」頁面
**Then** 系統顯示用戶列表，包含：姓名、Email、角色、城市、狀態、最後登入時間
**And** 列表支援分頁（每頁 20 筆）
**And** 列表支援按姓名或 Email 搜尋
**And** 列表支援按角色、城市、狀態篩選

**Given** 用戶列表載入中
**When** 數據尚未返回
**Then** 顯示 Skeleton 載入狀態

**FR 覆蓋**：FR37

---

### Story 1.4: 新增用戶與角色分配

**As a** 系統管理員,
**I want** 新增用戶並分配角色,
**So that** 新員工可以使用系統執行其職責。

**Acceptance Criteria:**

**Given** 系統管理員在用戶管理頁面
**When** 點擊「新增用戶」按鈕
**Then** 系統顯示新增用戶表單

**Given** 填寫有效的用戶資料（Email、姓名、角色、城市）
**When** 點擊「儲存」按鈕
**Then** 系統創建用戶記錄
**And** 系統發送邀請通知（如配置）
**And** 顯示成功訊息並返回列表

**Given** 填寫的 Email 已存在
**When** 點擊「儲存」按鈕
**Then** 系統顯示錯誤訊息「此 Email 已被使用」

**FR 覆蓋**：FR38

---

### Story 1.5: 修改用戶角色與城市歸屬

**As a** 系統管理員,
**I want** 修改用戶的角色和城市歸屬,
**So that** 我可以調整用戶的權限以符合其職責變更。

**Acceptance Criteria:**

**Given** 系統管理員查看用戶詳情
**When** 點擊「編輯」按鈕
**Then** 系統顯示可編輯的用戶資料表單

**Given** 修改用戶的角色或城市歸屬
**When** 點擊「儲存」按鈕
**Then** 系統更新用戶記錄
**And** 記錄變更至審計日誌
**And** 顯示成功訊息

**Given** 用戶被分配新角色
**When** 該用戶下次操作時
**Then** 系統應用新的權限設定

**FR 覆蓋**：FR39

---

### Story 1.6: 停用與啟用用戶帳戶

**As a** 系統管理員,
**I want** 停用離職員工的帳戶,
**So that** 確保系統安全，離職人員無法存取系統。

**Acceptance Criteria:**

**Given** 系統管理員查看活躍用戶
**When** 點擊「停用」按鈕並確認
**Then** 用戶狀態變更為「Inactive」
**And** 該用戶無法再登入系統
**And** 記錄變更至審計日誌

**Given** 系統管理員查看已停用用戶
**When** 點擊「啟用」按鈕
**Then** 用戶狀態變更為「Active」
**And** 該用戶可以重新登入系統

**Given** 已停用的用戶嘗試登入
**When** Azure AD 驗證成功後
**Then** 系統顯示「您的帳戶已被停用，請聯繫管理員」

**FR 覆蓋**：FR40

---

### Story 1.7: 自定義角色管理

**As a** 系統管理員,
**I want** 創建自定義角色並定義權限,
**So that** 我可以靈活地配置符合組織需求的權限組合。

**Acceptance Criteria:**

**Given** 系統管理員在角色管理頁面
**When** 點擊「新增角色」按鈕
**Then** 系統顯示角色創建表單，包含權限選擇清單

**Given** 填寫角色名稱並選擇權限
**When** 點擊「儲存」按鈕
**Then** 系統創建新角色
**And** 新角色可被分配給用戶

**Given** 查看系統預設角色
**When** 嘗試編輯或刪除
**Then** 系統禁止修改系統預設角色

**Given** 自定義角色已被分配給用戶
**When** 嘗試刪除該角色
**Then** 系統顯示警告並要求先移除用戶分配

**FR 覆蓋**：FR41

---

### Story 1.8: 城市經理用戶管理

**As a** 城市經理,
**I want** 管理本城市的用戶,
**So that** 我可以自主處理本城市的人員異動。

**Acceptance Criteria:**

**Given** 城市經理已登入
**When** 導航至「用戶管理」頁面
**Then** 系統僅顯示該城市的用戶列表

**Given** 城市經理新增用戶
**When** 選擇城市歸屬時
**Then** 系統僅允許選擇該城市經理管轄的城市

**Given** 城市經理嘗試修改其他城市的用戶
**When** 系統檢查權限
**Then** 系統拒絕操作並顯示「無權限」訊息

**FR 覆蓋**：FR42

---

## Epic 2: 手動發票上傳與 AI 處理

**目標**：用戶可以上傳發票文件，系統自動進行 OCR 提取、Forwarder 識別、欄位映射並計算信心度

**FRs 覆蓋**：FR1, FR4, FR5, FR6, FR7, FR8

---

### Story 2.1: 文件上傳介面與驗證

**As a** 數據處理員,
**I want** 上傳發票文件到系統,
**So that** 系統可以開始處理和提取發票內容。

**Acceptance Criteria:**

**Given** 用戶在發票上傳頁面
**When** 點擊上傳區域或拖放文件
**Then** 系統接受 PDF、JPG、PNG 格式的文件
**And** 單個文件大小限制為 10MB
**And** 顯示上傳進度指示器

**Given** 用戶選擇了不支援的文件格式
**When** 嘗試上傳
**Then** 系統顯示錯誤訊息「不支援的文件格式，請上傳 PDF、JPG 或 PNG」

**Given** 用戶選擇多個文件（批量上傳）
**When** 確認上傳
**Then** 系統接受最多 20 個文件
**And** 顯示每個文件的上傳狀態

**技術備註：**
- 創建 `Document` 資料表（id, fileName, fileType, fileSize, filePath, status, uploadedBy, cityCode, createdAt）
- 文件儲存至 Azure Blob Storage
- 實現前端拖放上傳組件

**FR 覆蓋**：FR1

---

### Story 2.2: 文件 OCR 提取服務

**As a** 系統,
**I want** 對上傳的發票進行 OCR 文字提取,
**So that** 可以獲取發票中的所有文字內容供後續處理。

**Acceptance Criteria:**

**Given** 文件已成功上傳
**When** 系統開始處理文件
**Then** 調用 Azure Document Intelligence API 進行 OCR
**And** 提取文件中的所有文字和結構化數據
**And** 處理時間 < 30 秒（單張發票）

**Given** OCR 處理成功
**When** 結果返回
**Then** 系統儲存原始 OCR 結果（JSON 格式）
**And** 更新文件狀態為「OCR 完成」

**Given** OCR 處理失敗
**When** API 返回錯誤
**Then** 系統記錄錯誤詳情
**And** 更新文件狀態為「OCR 失敗」
**And** 標記為需要人工處理

**技術備註：**
- 創建 `OcrResult` 資料表（id, documentId, rawResult, extractedText, processingTime, createdAt）
- 實現 FastAPI 端點處理 OCR 請求
- 配置 Azure Document Intelligence 連線

**FR 覆蓋**：FR4

---

### Story 2.3: Forwarder 自動識別

**As a** 系統,
**I want** 自動識別發票所屬的 Forwarder,
**So that** 可以應用該 Forwarder 特定的映射規則。

**Acceptance Criteria:**

**Given** OCR 提取完成
**When** 系統分析提取的文字
**Then** 系統識別 Forwarder 標識（公司名稱、Logo 文字、格式特徵）
**And** 返回 Forwarder ID 和信心度分數

**Given** 系統成功識別 Forwarder
**When** 信心度 >= 80%
**Then** 自動關聯該 Forwarder Profile
**And** 記錄識別結果

**Given** 系統無法識別 Forwarder
**When** 信心度 < 80% 或無匹配
**Then** 標記為「未識別 Forwarder」
**And** 列入需人工指定的隊列

**技術備註：**
- 創建 `Forwarder` 資料表（id, name, code, identificationPatterns, status, createdAt）
- 創建 `ForwarderIdentification` 結果記錄
- 實現模式匹配識別邏輯

**FR 覆蓋**：FR5

---

### Story 2.4: 欄位映射與提取

**As a** 系統,
**I want** 將 OCR 提取的內容映射到標準化欄位,
**So that** 數據可以被統一格式儲存和使用。

**Acceptance Criteria:**

**Given** Forwarder 已識別
**When** 系統應用該 Forwarder 的映射規則
**Then** 系統提取並映射約 90 個標準 Header 欄位
**And** 每個欄位包含：值、來源位置、提取方法

**Given** 映射規則存在
**When** OCR 文字包含匹配內容
**Then** 系統提取對應的值
**And** 記錄提取來源（頁碼、位置）

**Given** 某些欄位無法映射
**When** 規則無匹配或值不存在
**Then** 該欄位標記為「空值」
**And** 記錄無法映射的原因

**技術備註：**
- 創建 `ExtractionResult` 資料表（id, documentId, forwarderId, fieldMappings JSON, status, createdAt）
- 創建 `MappingRule` 資料表（id, forwarderId, fieldName, extractionPattern, priority）
- 實現映射引擎服務

**FR 覆蓋**：FR6

---

### Story 2.5: 信心度評分計算

**As a** 系統,
**I want** 為每個提取結果計算信心度評分,
**So that** 可以識別需要人工審核的項目。

**Acceptance Criteria:**

**Given** 欄位映射完成
**When** 系統計算信心度
**Then** 為每個欄位計算 0-100% 的信心度分數
**And** 計算整體文件的平均信心度

**Given** 信心度計算完成
**When** 結果返回
**Then** 欄位按信心度分類：
- 高信心 (>=90%)：綠色
- 中信心 (70-89%)：黃色
- 低信心 (<70%)：紅色

**Given** 信心度計算因素
**When** 評估欄位
**Then** 考慮以下因素：
- OCR 識別清晰度
- 規則匹配精確度
- 數據格式驗證結果
- 歷史修正頻率

**技術備註：**
- 在 `ExtractionResult` 中增加 confidenceScores JSON 欄位
- 實現信心度計算算法
- 配置信心度閾值參數

**FR 覆蓋**：FR7

---

### Story 2.6: 處理路徑自動分流

**As a** 系統,
**I want** 根據信心度自動分流處理路徑,
**So that** 高信心度的發票可以自動處理，低信心度的需要人工審核。

**Acceptance Criteria:**

**Given** 信心度評分完成
**When** 整體信心度 >= 95%
**Then** 文件分流至「自動通過」路徑
**And** 無需人工審核直接完成

**Given** 信心度評分完成
**When** 整體信心度在 80-94% 之間
**Then** 文件分流至「快速確認」路徑
**And** 僅需確認低信心度欄位

**Given** 信心度評分完成
**When** 整體信心度 < 80%
**Then** 文件分流至「完整審核」路徑
**And** 需要逐欄檢查和修正

**Given** 分流完成
**When** 更新文件狀態
**Then** 記錄分流決策和原因
**And** 通知相關審核人員（如需要）

**技術備註：**
- 在 `Document` 中增加 processingPath 欄位
- 創建 `ProcessingQueue` 資料表追蹤待審核項目
- 配置分流閾值參數

**FR 覆蓋**：FR8

---

### Story 2.7: 處理狀態追蹤與顯示

**As a** 數據處理員,
**I want** 查看已上傳文件的處理狀態,
**So that** 我可以了解處理進度並採取後續行動。

**Acceptance Criteria:**

**Given** 用戶在文件列表頁面
**When** 查看已上傳的文件
**Then** 系統顯示每個文件的處理狀態：
- 上傳中 / 已上傳
- OCR 處理中 / OCR 完成 / OCR 失敗
- 映射中 / 映射完成
- 待審核 / 審核中 / 已完成

**Given** 文件處理中
**When** 狀態更新
**Then** 頁面自動刷新顯示最新狀態（輪詢或 WebSocket）

**Given** 文件處理出錯
**When** 任一步驟失敗
**Then** 顯示錯誤圖標和錯誤原因
**And** 提供「重試」按鈕

**技術備註：**
- 實現狀態輪詢機制（每 5 秒）
- 使用 React Query 管理狀態
- 實現錯誤重試邏輯

**FR 覆蓋**：FR1, FR4, FR5, FR6, FR7, FR8 (整合)

---

## Epic 3: 發票審核與修正工作流

**目標**：數據處理員可以審核 AI 提取結果，修正錯誤，並將複雜案例升級給 Super User

**FRs 覆蓋**：FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16

---

### Story 3.1: 待審核發票列表

**As a** 數據處理員,
**I want** 查看分配給我的待審核發票列表,
**So that** 我可以有效地安排審核工作。

**Acceptance Criteria:**

**Given** 數據處理員已登入
**When** 導航至「待審核」頁面
**Then** 系統顯示分配給該用戶的待審核發票列表
**And** 列表包含：文件名、Forwarder、上傳時間、整體信心度、處理路徑
**And** 列表按上傳時間排序（最舊優先）

**Given** 待審核列表
**When** 篩選條件變更
**Then** 支援按 Forwarder、信心度範圍、處理路徑篩選

**Given** 待審核列表
**When** 點擊某筆發票
**Then** 進入該發票的審核詳情頁面

**FR 覆蓋**：FR9

---

### Story 3.2: 並排 PDF 對照審核界面

**As a** 數據處理員,
**I want** 在同一畫面看到原始 PDF 和提取結果的對照,
**So that** 我可以快速核對提取的準確性。

**Acceptance Criteria:**

**Given** 用戶進入發票審核頁面
**When** 頁面載入完成
**Then** 左側顯示原始 PDF 文件（可縮放、翻頁）
**And** 右側顯示提取結果表單

**Given** 審核界面顯示
**When** 用戶選中某個提取欄位
**Then** PDF 視圖自動滾動並高亮對應的來源位置

**Given** PDF 文件多頁
**When** 用戶翻頁
**Then** PDF 視圖支援快速翻頁導航
**And** 顯示當前頁碼 / 總頁數

**Given** 用戶調整視窗大小
**When** 螢幕寬度變化
**Then** 並排佈局自適應調整比例

**FR 覆蓋**：FR10, UX-03

---

### Story 3.3: 信心度顏色編碼顯示

**As a** 數據處理員,
**I want** 通過顏色快速識別需要關注的欄位,
**So that** 我可以優先檢查低信心度的項目。

**Acceptance Criteria:**

**Given** 審核界面的提取結果
**When** 顯示各欄位
**Then** 欄位背景顏色依信心度顯示：
- 綠色：>= 90%（高信心）
- 黃色：70-89%（中信心）
- 紅色：< 70%（低信心）

**Given** 欄位顯示
**When** 滑鼠懸停在信心度指示器上
**Then** 顯示具體的信心度百分比和計算因素

**Given** 審核界面
**When** 點擊「僅顯示低信心度欄位」
**Then** 隱藏高信心度欄位，僅顯示需要關注的項目

**FR 覆蓋**：FR16, UX-04

---

### Story 3.4: 確認提取結果

**As a** 數據處理員,
**I want** 確認正確的提取結果,
**So that** 已驗證的數據可以進入下一步處理。

**Acceptance Criteria:**

**Given** 用戶審核完所有欄位
**When** 所有欄位無需修改
**Then** 可以點擊「確認無誤」按鈕

**Given** 點擊「確認無誤」
**When** 系統處理確認
**Then** 文件狀態更新為「已審核」
**And** 記錄審核人、審核時間
**And** 返回待審核列表

**Given** 快速確認路徑的發票
**When** 進入審核頁面
**Then** 僅顯示需要確認的低信心度欄位
**And** 提供「全部確認」快捷按鈕

**FR 覆蓋**：FR11

---

### Story 3.5: 修正提取結果

**As a** 數據處理員,
**I want** 修正錯誤的提取值,
**So that** 最終數據的準確性得到保證。

**Acceptance Criteria:**

**Given** 用戶發現某欄位提取錯誤
**When** 點擊該欄位
**Then** 欄位變為可編輯狀態

**Given** 修改欄位值
**When** 輸入新值
**Then** 系統即時驗證格式（日期、數字、必填等）
**And** 顯示驗證結果

**Given** 完成修改
**When** 點擊「儲存修正」
**Then** 系統儲存修正後的值
**And** 記錄原始值和修正值
**And** 記錄修正人和時間

**Given** 修改多個欄位
**When** 離開頁面前未儲存
**Then** 系統提示「有未儲存的修改，是否離開？」

**FR 覆蓋**：FR12

---

### Story 3.6: 修正類型標記

**As a** 數據處理員,
**I want** 標記修正是「正常修正」或「特例不學習」,
**So that** 系統可以正確地進行規則學習。

**Acceptance Criteria:**

**Given** 用戶修正某個欄位
**When** 完成修正
**Then** 系統提示選擇修正類型：
- 正常修正：系統應學習此模式
- 特例不學習：此為特殊情況，不應影響規則

**Given** 選擇「正常修正」
**When** 儲存修正
**Then** 系統記錄此修正供規則學習分析

**Given** 選擇「特例不學習」
**When** 儲存修正
**Then** 系統標記此修正為特例
**And** 不納入規則學習統計

**Given** 同一欄位被標記為「正常修正」達 3 次
**When** 系統分析修正模式
**Then** 觸發規則升級建議流程（Epic 4）

**FR 覆蓋**：FR13

---

### Story 3.7: 升級複雜案例

**As a** 數據處理員,
**I want** 將無法處理的複雜案例升級給 Super User,
**So that** 專業人員可以處理特殊情況。

**Acceptance Criteria:**

**Given** 用戶遇到無法判斷的情況
**When** 點擊「升級案例」按鈕
**Then** 系統顯示升級表單

**Given** 填寫升級原因
**When** 提交升級請求
**Then** 文件狀態更新為「已升級」
**And** 指派給 Super User 隊列
**And** 通知相關 Super User

**Given** 升級表單
**When** 填寫內容
**Then** 必須選擇升級原因類型：
- 無法識別 Forwarder
- 映射規則不適用
- 文件品質問題
- 其他（需說明）

**FR 覆蓋**：FR14

---

### Story 3.8: Super User 處理升級案例

**As a** Super User,
**I want** 處理數據處理員升級的複雜案例,
**So that** 特殊情況可以得到正確處理。

**Acceptance Criteria:**

**Given** Super User 已登入
**When** 導航至「升級案例」頁面
**Then** 系統顯示所有待處理的升級案例
**And** 包含：升級人、升級時間、升級原因、原始審核進度

**Given** Super User 查看升級案例
**When** 進入案例詳情
**Then** 可以看到完整的審核界面
**And** 可以看到升級原因和數據處理員的備註

**Given** Super User 完成處理
**When** 提交處理結果
**Then** 文件狀態更新為「已審核」
**And** 記錄 Super User 的處理決策
**And** 可選擇是否創建新規則

**Given** Super User 處理案例
**When** 發現需要新增映射規則
**Then** 可以直接創建規則建議（連結到 Epic 4）

**FR 覆蓋**：FR15

---

## Epic 4: 映射規則管理與自動學習

**目標**：Super User 可以查看、建議、審核映射規則，系統可從修正中自動學習並建議規則升級

**FRs 覆蓋**：FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR24

---

### Story 4.1: 映射規則列表與查看

**As a** Super User,
**I want** 查看現有的映射規則,
**So that** 我可以了解系統的提取邏輯並進行管理。

**Acceptance Criteria:**

**Given** Super User 已登入
**When** 導航至「規則管理」頁面
**Then** 系統顯示所有映射規則列表
**And** 支援按 Forwarder、欄位名稱、狀態篩選
**And** 顯示規則的版本號和最後更新時間

**Given** 規則列表
**When** 點擊某條規則
**Then** 顯示規則詳情：提取模式、適用 Forwarder、創建人、應用統計

**FR 覆蓋**：FR17

---

### Story 4.2: 建議新映射規則

**As a** Super User,
**I want** 建議新的映射規則,
**So that** 系統可以更準確地提取特定 Forwarder 的發票。

**Acceptance Criteria:**

**Given** Super User 在規則管理頁面
**When** 點擊「建議新規則」
**Then** 顯示規則創建表單

**Given** 填寫規則表單
**When** 輸入規則內容
**Then** 包含：目標欄位、適用 Forwarder、提取模式類型、提取模式內容、優先級

**Given** 提交規則建議
**When** 規則需要審核
**Then** 規則狀態設為「待審核」並通知審核人員

**FR 覆蓋**：FR18

---

### Story 4.3: 修正模式記錄與分析

**As a** 系統,
**I want** 記錄用戶的修正並識別重複模式,
**So that** 可以自動發現潛在的規則改進機會。

**Acceptance Criteria:**

**Given** 用戶完成「正常修正」
**When** 系統記錄修正
**Then** 儲存：原始值、修正值、Forwarder、欄位名稱、修正時間

**Given** 系統累積修正記錄
**When** 執行模式分析
**Then** 識別重複的修正模式（相同 Forwarder + 相同欄位 + 相似修正）

**Given** 發現重複模式
**When** 修正次數 >= 3
**Then** 標記為「潛在規則升級候選」

**FR 覆蓋**：FR20

---

### Story 4.4: 規則升級建議生成

**As a** 系統,
**I want** 在累計 3 次相同修正後建議規則升級,
**So that** Super User 可以審核並決定是否採納。

**Acceptance Criteria:**

**Given** 相同模式修正達到 3 次
**When** 系統檢測到閾值
**Then** 自動生成規則升級建議
**And** 包含：建議的新規則、基於的修正案例、預期影響

**Given** 規則升級建議生成
**When** 系統創建建議
**Then** 通知相關 Super User，建議狀態設為「待審核」

**FR 覆蓋**：FR21

---

### Story 4.5: 規則影響範圍分析

**As a** Super User,
**I want** 在規則升級前查看影響範圍分析,
**So that** 我可以評估變更的風險。

**Acceptance Criteria:**

**Given** 查看規則升級建議
**When** 點擊「影響分析」
**Then** 顯示：受影響的歷史發票數量、預計改善率、可能受負面影響的案例

**Given** 影響分析完成
**When** 顯示結果
**Then** 提供測試運行功能，可對歷史數據進行模擬測試

**Given** 模擬測試完成
**When** 顯示測試結果
**Then** 對比原規則 vs 新規則結果，標記改善和惡化的案例

**FR 覆蓋**：FR22

---

### Story 4.6: 審核學習規則

**As a** Super User,
**I want** 審核待升級的學習規則,
**So that** 只有經過驗證的規則才會被應用。

**Acceptance Criteria:**

**Given** Super User 在規則審核頁面
**When** 查看待審核規則
**Then** 顯示規則詳情和影響分析

**Given** Super User 審核規則
**When** 點擊「批准」
**Then** 規則狀態更新為「已批准」，進入生效隊列

**Given** Super User 審核規則
**When** 點擊「拒絕」
**Then** 需要填寫拒絕原因，規則狀態更新為「已拒絕」

**FR 覆蓋**：FR19

---

### Story 4.7: 規則版本歷史管理

**As a** Super User,
**I want** 查看規則的版本歷史,
**So that** 我可以追溯規則的演變並在需要時回滾。

**Acceptance Criteria:**

**Given** 查看規則詳情
**When** 點擊「版本歷史」
**Then** 顯示該規則的所有版本（至少保留 5 個）

**Given** 版本歷史列表
**When** 選擇兩個版本
**Then** 可以進行版本對比，高亮顯示差異

**FR 覆蓋**：FR23

---

### Story 4.8: 規則自動回滾

**As a** 系統,
**I want** 在準確率下降時自動回滾規則,
**So that** 系統可以自我保護避免錯誤規則的影響。

**Acceptance Criteria:**

**Given** 新規則已生效
**When** 系統監控準確率指標
**Then** 每小時計算規則應用後的準確率

**Given** 準確率監控
**When** 新規則導致準確率下降超過 10%
**Then** 系統自動觸發回滾，恢復到上一個穩定版本

**Given** 自動回滾觸發
**When** 執行回滾
**Then** 發送告警通知給 Super User，記錄回滾原因和時間

**FR 覆蓋**：FR24

---

## Epic 5: Forwarder 配置管理

**目標**：Super User 可以查看和編輯 Forwarder Profile，測試規則變更效果

**FRs 覆蓋**：FR25, FR26, FR27, FR28, FR29

---

### Story 5.1: Forwarder Profile 列表

**As a** Super User,
**I want** 查看所有 Forwarder Profile 列表,
**So that** 我可以管理不同 Forwarder 的配置。

**Acceptance Criteria:**

**Given** Super User 已登入
**When** 導航至「Forwarder 管理」頁面
**Then** 顯示所有 Forwarder Profile 列表
**And** 包含：名稱、代碼、狀態、規則數量、最後更新時間

**FR 覆蓋**：FR25

---

### Story 5.2: Forwarder 詳細配置查看

**As a** Super User,
**I want** 查看單個 Forwarder 的詳細配置,
**So that** 我可以了解該 Forwarder 的所有設定。

**Acceptance Criteria:**

**Given** 在 Forwarder 列表頁面
**When** 點擊某個 Forwarder
**Then** 顯示詳細配置：基本資訊、關聯規則、處理統計、最近發票範例

**FR 覆蓋**：FR26

---

### Story 5.3: 編輯 Forwarder 映射規則

**As a** Super User,
**I want** 編輯 Forwarder 特定的映射規則,
**So that** 可以優化特定 Forwarder 的提取準確性。

**Acceptance Criteria:**

**Given** 在 Forwarder 詳情頁面
**When** 點擊「編輯規則」
**Then** 顯示該 Forwarder 的規則編輯界面

**Given** 編輯規則
**When** 修改規則內容
**Then** 規則變更需要經過審核流程

**FR 覆蓋**：FR27

---

### Story 5.4: 測試規則變更效果

**As a** Super User,
**I want** 在規則生效前測試變更效果,
**So that** 可以驗證規則變更不會造成負面影響。

**Acceptance Criteria:**

**Given** 編輯規則後
**When** 點擊「測試規則」
**Then** 可以選擇歷史發票進行測試，顯示原規則 vs 新規則對比

**FR 覆蓋**：FR28

---

### Story 5.5: 新增與停用 Forwarder Profile

**As a** 系統管理員,
**I want** 新增或停用 Forwarder Profile,
**So that** 可以支援新的 Forwarder 或停止不再使用的 Forwarder。

**Acceptance Criteria:**

**Given** 系統管理員在 Forwarder 管理頁面
**When** 點擊「新增 Forwarder」
**Then** 顯示新增表單，提交後創建新 Profile

**Given** 需要停用某個 Forwarder
**When** 點擊「停用」並確認
**Then** Forwarder 狀態變更為「停用」，歷史數據保留

**FR 覆蓋**：FR29

---

## Epic 6: 多城市數據隔離

**目標**：系統按城市隔離數據，用戶只能訪問授權城市的數據，同時共享全局規則

**FRs 覆蓋**：FR43, FR44, FR45, FR46, FR47

---

### Story 6.1: 城市數據模型與 RLS 配置

**As a** 系統,
**I want** 按城市隔離所有業務數據,
**So that** 確保數據安全和合規。

**Acceptance Criteria:**

**Given** 系統初始化
**When** 創建數據表
**Then** 所有業務數據表包含 cityCode 欄位
**And** 配置 PostgreSQL Row Level Security 策略
**And** 查詢自動過濾非授權城市數據

**Given** 用戶執行查詢
**When** 數據庫處理請求
**Then** RLS 策略自動應用
**And** 無需應用層額外過濾

**技術備註：**
- 創建 `City` 資料表（id, code, name, region, timezone, status）
- 為所有業務表添加 cityCode 外鍵
- 配置 RLS 策略基於 session 變數

**FR 覆蓋**：FR43

---

### Story 6.2: 城市用戶數據訪問控制

**As a** 城市用戶,
**I want** 只能訪問本城市的數據,
**So that** 確保數據隔離和安全。

**Acceptance Criteria:**

**Given** 城市用戶（Data Processor）已登入
**When** 查詢任何業務數據（發票、提取結果、審計記錄）
**Then** 系統自動過濾，僅返回該用戶所屬城市的數據
**And** 無法通過任何方式訪問其他城市數據

**Given** 城市用戶嘗試直接存取其他城市的資源
**When** 通過 URL 或 API 指定其他城市的資源 ID
**Then** 系統返回 403 Forbidden 或空結果
**And** 記錄此次存取嘗試至安全日誌

**Given** 城市用戶查看統計數據
**When** 載入儀表板
**Then** 所有統計僅反映該城市的數據

**FR 覆蓋**：FR44

---

### Story 6.3: 區域經理跨城市訪問

**As a** 區域經理,
**I want** 訪問我管轄的多個城市的數據,
**So that** 我可以進行跨城市的管理和分析。

**Acceptance Criteria:**

**Given** 區域經理已登入
**When** 查詢業務數據
**Then** 系統返回該經理被授權的所有城市數據
**And** 可以按城市篩選查看

**Given** 區域經理查看列表頁面
**When** 頁面載入
**Then** 顯示城市篩選下拉選單
**And** 預設顯示所有授權城市的數據

**Given** 區域經理匯出報表
**When** 選擇匯出選項
**Then** 可以選擇單一城市或多城市匯總
**And** 報表明確標示數據來源城市

**技術備註：**
- 創建 `UserCityAccess` 關聯表
- 區域經理可被授權多個城市

**FR 覆蓋**：FR45

---

### Story 6.4: 全局管理者完整訪問

**As a** 全局管理者,
**I want** 訪問所有城市的數據,
**So that** 我可以進行全球層級的管理和監控。

**Acceptance Criteria:**

**Given** 全局管理者已登入
**When** 查詢業務數據
**Then** 系統返回所有城市的數據
**And** 可以按城市、區域篩選

**Given** 全局管理者查看儀表板
**When** 頁面載入
**Then** 顯示全球匯總統計
**And** 可以切換查看單一城市或區域

**Given** 全局管理者進行系統配置
**When** 修改全局設定
**Then** 變更適用於所有城市

**FR 覆蓋**：FR46

---

### Story 6.5: 全局規則共享機制

**As a** 系統,
**I want** 在所有城市共享 Mapping Rules 和 Forwarder Profiles,
**So that** 規則維護集中化且一致。

**Acceptance Criteria:**

**Given** Super User 創建或修改規則
**When** 規則生效
**Then** 規則自動應用於所有城市
**And** 無需針對每個城市單獨配置

**Given** 城市用戶處理發票
**When** 系統應用規則
**Then** 使用全局共享的規則庫
**And** 規則版本在所有城市保持一致

**Given** 規則更新後
**When** 任何城市處理發票
**Then** 立即使用最新版本的規則
**And** 無需城市級別的同步操作

**技術備註：**
- MappingRule 和 Forwarder 表不包含 cityCode
- 這些表的數據為全局共享

**FR 覆蓋**：FR47

---

## Epic 7: 報表儀表板與成本追蹤

**目標**：用戶可以查看處理統計儀表板，城市/區域經理可以匯出報表，財務可以查看成本分攤

**FRs 覆蓋**：FR30, FR31, FR32, FR33, FR34, FR35, FR69, FR70, FR71, FR72

---

### Story 7.1: 處理統計儀表板

**As a** 用戶,
**I want** 查看處理統計儀表板,
**So that** 我可以了解整體處理狀況。

**Acceptance Criteria:**

**Given** 用戶已登入
**When** 導航至「儀表板」頁面
**Then** 顯示關鍵指標卡片：
- 今日處理量 / 本週處理量 / 本月處理量
- 成功率（百分比）
- 自動化率（無需人工審核的比例）
- 平均處理時間
- 待審核數量

**Given** 儀表板頁面載入
**When** 數據正在載入
**Then** 顯示 Skeleton 載入狀態
**And** 載入完成後平滑過渡到實際數據

**Given** 儀表板頁面
**When** 數據有更新
**Then** 支援手動刷新按鈕
**And** 顯示最後更新時間

**FR 覆蓋**：FR30

---

### Story 7.2: 時間範圍篩選

**As a** 用戶,
**I want** 按時間範圍篩選報表數據,
**So that** 我可以分析特定時期的表現。

**Acceptance Criteria:**

**Given** 在儀表板頁面
**When** 點擊時間範圍選擇器
**Then** 顯示預設選項：今日、本週、本月、本季、本年

**Given** 選擇「自訂範圍」
**When** 顯示日期選擇器
**Then** 可以選擇開始日期和結束日期
**And** 最大範圍限制為 1 年

**Given** 時間範圍變更
**When** 選擇新的時間範圍
**Then** 所有圖表和指標更新為該時間範圍的數據
**And** URL 參數同步更新（支援書籤）

**FR 覆蓋**：FR31

---

### Story 7.3: Forwarder 篩選

**As a** 用戶,
**I want** 按 Forwarder 篩選報表數據,
**So that** 我可以分析特定 Forwarder 的表現。

**Acceptance Criteria:**

**Given** 在儀表板頁面
**When** 點擊 Forwarder 篩選器
**Then** 顯示所有 Forwarder 的多選清單
**And** 支援搜尋 Forwarder 名稱

**Given** 選擇特定 Forwarder
**When** 篩選器變更
**Then** 所有圖表和指標更新為該 Forwarder 的數據

**Given** 選擇多個 Forwarder
**When** 查看圖表
**Then** 可以顯示對比視圖（各 Forwarder 的對比）

**FR 覆蓋**：FR32

---

### Story 7.4: 費用明細報表匯出

**As a** 城市經理,
**I want** 匯出費用明細報表,
**So that** 我可以進行財務分析和報告。

**Acceptance Criteria:**

**Given** 城市經理在報表頁面
**When** 點擊「匯出報表」按鈕
**Then** 顯示匯出選項對話框

**Given** 匯出選項對話框
**When** 配置匯出參數
**Then** 可以選擇：
- 時間範圍
- 匯出格式（Excel）
- 包含欄位（可勾選）

**Given** 確認匯出
**When** 系統生成報表
**Then** 報表包含：發票編號、上傳時間、處理時間、Forwarder、AI 成本、審核時長
**And** 下載完成後顯示成功訊息

**Given** 匯出大量數據
**When** 數據超過 10,000 筆
**Then** 系統採用背景處理
**And** 完成後發送通知和下載連結

**FR 覆蓋**：FR33

---

### Story 7.5: 跨城市匯總報表

**As a** 區域經理,
**I want** 查看跨城市的匯總報表,
**So that** 我可以比較各城市的表現。

**Acceptance Criteria:**

**Given** 區域經理已登入
**When** 導航至「區域報表」頁面
**Then** 顯示各城市的對比數據表格

**Given** 對比數據表格
**When** 查看內容
**Then** 包含以下欄位：
- 城市名稱
- 處理量
- 成功率
- 自動化率
- 平均處理時間
- AI 成本

**Given** 區域報表頁面
**When** 點擊某個城市
**Then** 展開顯示該城市的詳細趨勢圖

**Given** 區域報表
**When** 點擊「匯出」
**Then** 可以匯出跨城市對比報表（Excel 格式）

**FR 覆蓋**：FR34

---

### Story 7.6: AI API 使用量與成本顯示

**As a** 用戶,
**I want** 查看 AI API 使用量和成本,
**So that** 我可以監控和控制 AI 服務支出。

**Acceptance Criteria:**

**Given** 在儀表板頁面
**When** 查看「AI 成本」區塊
**Then** 顯示：
- API 調用次數（Document Intelligence / OpenAI）
- Token 使用量（輸入/輸出）
- 估算成本（美元）
- 與上期對比（增減百分比）

**Given** 成本區塊
**When** 點擊「查看詳情」
**Then** 顯示成本明細頁面
**And** 包含按日期的成本趨勢圖

**Given** 成本趨勢圖
**When** 發現異常高峰
**Then** 可以點擊該日期查看當日處理明細

**FR 覆蓋**：FR35

---

### Story 7.7: 城市處理數量追蹤

**As a** 系統,
**I want** 按城市追蹤發票處理數量,
**So that** 可以進行成本分攤和績效評估。

**Acceptance Criteria:**

**Given** 發票處理完成
**When** 系統記錄處理結果
**Then** 累計該城市的處理數量統計
**And** 分別記錄：總處理量、自動通過量、人工審核量

**Given** 系統記錄處理量
**When** 按時間維度聚合
**Then** 支援按日、週、月、年查詢

**技術備註：**
- 創建 `ProcessingStatistics` 資料表
- 支援增量更新和快照備份

**FR 覆蓋**：FR69

---

### Story 7.8: 城市 AI 成本追蹤

**As a** 系統,
**I want** 按城市追蹤 AI API 調用成本,
**So that** 可以準確分攤成本到各城市。

**Acceptance Criteria:**

**Given** AI API 被調用
**When** 系統記錄調用
**Then** 記錄以下資訊：
- 調用城市（cityCode）
- API 類型（Document Intelligence / OpenAI）
- Token 數（輸入/輸出）
- 估算成本（基於最新單價）
- 關聯的文件 ID

**Given** 成本記錄
**When** 查詢城市成本
**Then** 可以按時間範圍聚合計算

**技術備註：**
- 創建 `ApiUsageLog` 資料表
- 配置 API 單價參數（可更新）

**FR 覆蓋**：FR70

---

### Story 7.9: 城市成本報表

**As a** 財務人員,
**I want** 查看城市級別的成本報表,
**So that** 我可以進行預算管理和成本控制。

**Acceptance Criteria:**

**Given** 財務人員已登入
**When** 導航至「成本報表」頁面
**Then** 顯示各城市的成本明細表格

**Given** 成本明細表格
**When** 查看內容
**Then** 包含：城市、處理量、AI 成本、人工成本（估算）、總成本

**Given** 成本報表頁面
**When** 查看趨勢
**Then** 顯示各城市成本的月度趨勢圖
**And** 可以識別成本異常增長

**FR 覆蓋**：FR71

---

### Story 7.10: 月度成本分攤報告

**As a** 財務人員,
**I want** 生成月度成本分攤報告,
**So that** 可以進行內部成本結算。

**Acceptance Criteria:**

**Given** 財務人員在成本報表頁面
**When** 點擊「生成月度報告」
**Then** 顯示月份選擇對話框

**Given** 選擇月份
**When** 點擊「生成」
**Then** 系統生成包含以下內容的報告：
- 各城市處理量統計
- 各城市 AI API 成本明細
- 成本分攤比例
- 與上月對比

**Given** 報告生成完成
**When** 下載報告
**Then** 支援 Excel 和 PDF 格式
**And** PDF 格式包含圖表和摘要

**FR 覆蓋**：FR72

---

## Epic 8: 審計追溯與合規

**目標**：審計人員可以查詢處理記錄，追溯至原始文件，匯出合規報告

**FRs 覆蓋**：FR48, FR49, FR50, FR51, FR52, FR53

---

### Story 8.1: 用戶操作日誌記錄

**As a** 系統,
**I want** 記錄所有用戶操作日誌,
**So that** 可以追蹤誰在何時做了什麼操作。

**Acceptance Criteria:**

**Given** 用戶執行任何操作
**When** 操作完成
**Then** 系統記錄以下資訊：
- 用戶 ID 和用戶名
- 操作類型（創建/讀取/更新/刪除）
- 操作對象（資源類型和 ID）
- 操作時間（精確到毫秒）
- IP 地址和 User Agent
- 操作結果（成功/失敗）

**Given** 敏感操作
**When** 如用戶管理、規則變更、系統配置
**Then** 記錄操作前後的值變化

**Given** 操作日誌
**When** 嘗試修改或刪除
**Then** 系統拒絕操作
**And** 記錄此次嘗試至安全日誌

**技術備註：**
- 創建 `AuditLog` 資料表（append-only）
- 使用 PostgreSQL 觸發器確保不可篡改
- 考慮使用獨立的審計數據庫

**FR 覆蓋**：FR48

---

### Story 8.2: 數據變更追蹤

**As a** 系統,
**I want** 記錄所有數據變更（修改人、時間、原因）,
**So that** 可以完整追蹤數據的演變歷史。

**Acceptance Criteria:**

**Given** 業務數據被修改
**When** 如發票提取結果、規則、用戶資料
**Then** 系統記錄：
- 變更前的完整值
- 變更後的完整值
- 變更人 ID
- 變更時間
- 變更原因（如有）

**Given** 數據有多次變更
**When** 查詢變更歷史
**Then** 可以看到完整的變更鏈
**And** 支援時間軸視圖

**Given** 變更記錄
**When** 查詢特定版本
**Then** 可以查看該時間點的數據快照

**技術備註：**
- 創建 `DataChangeHistory` 資料表
- 使用 JSON 欄位儲存變更前後的值
- 建立索引支援快速查詢

**FR 覆蓋**：FR49

---

### Story 8.3: 處理記錄查詢

**As a** 審計人員,
**I want** 查詢指定期間的處理記錄,
**So that** 我可以進行審計和合規檢查。

**Acceptance Criteria:**

**Given** 審計人員已登入
**When** 導航至「審計查詢」頁面
**Then** 顯示查詢表單，包含：
- 時間範圍（必填）
- 城市（可選）
- Forwarder（可選）
- 處理狀態（可選）
- 操作人（可選）

**Given** 執行查詢
**When** 提交查詢條件
**Then** 返回符合條件的處理記錄列表
**And** 支援分頁（每頁 50 筆）
**And** 顯示總筆數

**Given** 查詢結果
**When** 需要進一步篩選
**Then** 支援在結果內搜尋
**And** 支援按欄位排序

**Given** 大量查詢結果
**When** 結果超過 10,000 筆
**Then** 系統提示縮小查詢範圍
**And** 或使用匯出功能

**FR 覆蓋**：FR50

---

### Story 8.4: 原始文件追溯

**As a** 審計人員,
**I want** 從任何數據點追溯至原始發票文件,
**So that** 我可以驗證數據的來源和準確性。

**Acceptance Criteria:**

**Given** 審計人員查看提取結果
**When** 點擊「查看原始文件」
**Then** 系統顯示原始發票 PDF/圖片

**Given** 審計人員查看修正記錄
**When** 點擊追溯連結
**Then** 系統顯示：
- 原始文件
- 原始 OCR 結果
- 修正前的值
- 修正後的值
- 修正人和時間

**Given** 原始文件
**When** 文件已被移至歸檔儲存
**Then** 系統可以從歸檔中讀取
**And** 載入時間 < 10 秒

**Given** 追溯查詢
**When** 生成追溯報告
**Then** 報告包含完整的數據鏈
**And** 從原始文件到最終結果

**FR 覆蓋**：FR51

---

### Story 8.5: 審計報告匯出

**As a** 審計人員,
**I want** 匯出符合審計要求的報告,
**So that** 可以提供給內部或外部審計使用。

**Acceptance Criteria:**

**Given** 審計人員完成查詢
**When** 點擊「匯出審計報告」
**Then** 顯示報告配置選項：
- 報告類型（處理記錄/變更歷史/完整審計）
- 時間範圍
- 包含欄位
- 輸出格式（Excel/PDF/CSV）

**Given** 選擇「完整審計報告」
**When** 生成報告
**Then** 報告包含：
- 封面和目錄
- 查詢條件摘要
- 處理記錄明細
- 數據變更歷史
- 附件（原始文件清單）

**Given** 報告生成
**When** 報告包含大量數據
**Then** 系統採用背景處理
**And** 完成後發送下載通知

**Given** 生成的報告
**When** 需要驗證完整性
**Then** 報告包含數位簽章或雜湊值
**And** 可以驗證報告未被篡改

**FR 覆蓋**：FR52

---

### Story 8.6: 長期數據保留

**As a** 系統,
**I want** 保留數據和日誌至少 7 年,
**So that** 符合審計和合規要求。

**Acceptance Criteria:**

**Given** 數據和日誌記錄
**When** 達到保留期限（7 年）
**Then** 系統不會自動刪除
**And** 需要管理員手動審批才能清理

**Given** 歷史數據
**When** 超過 1 年
**Then** 系統自動移至歸檔儲存（冷儲存）
**And** 降低儲存成本

**Given** 歸檔數據
**When** 需要查詢
**Then** 系統可以從歸檔中讀取
**And** 支援延遲載入（最長 30 秒）

**Given** 數據保留政策
**When** 系統配置
**Then** 可以設定：
- 活躍儲存期限（預設 1 年）
- 歸檔儲存期限（預設 7 年）
- 清理審批流程

**技術備註：**
- 配置 Azure Blob Storage 生命週期管理
- 實現冷熱數據分層儲存
- 設定保留策略防止意外刪除

**FR 覆蓋**：FR53

---

## Epic 9: 自動化文件獲取

**目標**：系統可自動從 SharePoint 獲取待處理文件，從 Outlook 郵件提取附件

**FRs 覆蓋**：FR2, FR3

**分工說明**：平台提供 API 接口，n8n 負責監控觸發源並調用 API

---

### Story 9.1: SharePoint 文件監控 API

**As a** 系統,
**I want** 提供 API 供外部獲取 SharePoint 文件並提交處理,
**So that** n8n 可以監控 SharePoint 並自動提交新文件。

**Acceptance Criteria:**

**Given** 外部系統（n8n）偵測到 SharePoint 新文件
**When** 調用平台 API 提交文件
**Then** API 接受以下參數：
- 文件 URL（SharePoint 位置）
- 來源城市代碼
- 來源類型（sharepoint）
- 原始文件名

**Given** 平台接收到 SharePoint 文件提交請求
**When** 處理請求
**Then** 系統從 SharePoint URL 下載文件
**And** 儲存至 Azure Blob Storage
**And** 創建處理任務（進入 Epic 2 的處理流程）

**Given** SharePoint 文件下載
**When** 下載成功
**Then** 返回處理任務 ID
**And** 可用於後續狀態查詢

**Given** SharePoint 文件下載
**When** 下載失敗（權限問題、文件不存在）
**Then** 返回適當的錯誤代碼和訊息
**And** 記錄錯誤至日誌

**技術備註：**
- 創建 `POST /api/documents/from-sharepoint` 端點
- 使用 Microsoft Graph API 讀取 SharePoint 文件
- 配置 Azure AD 應用程式權限（Files.Read.All）

**FR 覆蓋**：FR2

---

### Story 9.2: SharePoint 連線配置

**As a** 系統管理員,
**I want** 配置 SharePoint 連線設定,
**So that** 系統可以正確存取 SharePoint 資源。

**Acceptance Criteria:**

**Given** 系統管理員在系統設定頁面
**When** 導航至「SharePoint 整合」區塊
**Then** 顯示連線配置表單：
- SharePoint Site URL
- 文件庫路徑
- Azure AD 租戶 ID
- 應用程式 ID
- 客戶端密鑰（加密儲存）

**Given** 配置完成
**When** 點擊「測試連線」
**Then** 系統驗證連線設定
**And** 顯示連線結果（成功/失敗）

**Given** 連線測試成功
**When** 點擊「儲存」
**Then** 系統儲存配置
**And** 配置立即生效

**Given** 配置的 SharePoint 路徑
**When** 按城市配置不同路徑
**Then** 支援城市級別的 SharePoint 配置
**And** 不同城市可以監控不同的文件庫

**FR 覆蓋**：FR2

---

### Story 9.3: Outlook 郵件附件提取 API

**As a** 系統,
**I want** 提供 API 供外部提取 Outlook 郵件附件並提交處理,
**So that** n8n 可以監控郵箱並自動提取發票附件。

**Acceptance Criteria:**

**Given** 外部系統（n8n）偵測到符合條件的郵件
**When** 調用平台 API 提交附件
**Then** API 接受以下參數：
- 郵件 ID 或附件直接內容（Base64）
- 來源城市代碼
- 來源類型（outlook）
- 寄件者資訊
- 郵件主旨

**Given** 平台接收到郵件附件提交請求
**When** 處理請求
**Then** 系統解析附件內容
**And** 過濾非發票文件（非 PDF/圖片）
**And** 為每個有效附件創建處理任務

**Given** 郵件包含多個附件
**When** 處理郵件
**Then** 系統為每個有效附件創建獨立的處理任務
**And** 記錄附件與原始郵件的關聯

**Given** 附件處理完成
**When** 返回結果
**Then** 包含各附件的處理任務 ID
**And** 包含被過濾（跳過）的附件清單

**技術備註：**
- 創建 `POST /api/documents/from-outlook` 端點
- 支援 Microsoft Graph API 或直接附件上傳
- 實現文件類型過濾邏輯

**FR 覆蓋**：FR3

---

### Story 9.4: Outlook 連線配置

**As a** 系統管理員,
**I want** 配置 Outlook 連線設定,
**So that** 系統可以正確存取郵箱資源。

**Acceptance Criteria:**

**Given** 系統管理員在系統設定頁面
**When** 導航至「Outlook 整合」區塊
**Then** 顯示連線配置表單：
- 郵箱地址
- Azure AD 租戶 ID
- 應用程式 ID
- 客戶端密鑰（加密儲存）

**Given** 配置完成
**When** 點擊「測試連線」
**Then** 系統驗證連線設定
**And** 顯示連線結果（成功/失敗）

**Given** 連線配置
**When** 按城市配置不同郵箱
**Then** 支援城市級別的 Outlook 配置
**And** 不同城市可以監控不同的郵箱

**Given** 郵件過濾規則
**When** 配置過濾條件
**Then** 可以設定：
- 寄件者白名單/黑名單
- 主旨關鍵字
- 附件類型過濾

**FR 覆蓋**：FR3

---

### Story 9.5: 自動獲取來源追蹤

**As a** 用戶,
**I want** 查看自動獲取的文件來源資訊,
**So that** 我可以追蹤文件的原始來源。

**Acceptance Criteria:**

**Given** 查看發票詳情
**When** 發票來自 SharePoint
**Then** 顯示：
- 來源類型：SharePoint
- SharePoint 文件路徑
- 獲取時間
- 原始文件名

**Given** 查看發票詳情
**When** 發票來自 Outlook
**Then** 顯示：
- 來源類型：Outlook
- 寄件者地址
- 郵件主旨
- 郵件接收時間
- 附件原始名稱

**Given** 發票列表頁面
**When** 需要篩選來源
**Then** 支援按來源類型篩選（手動上傳/SharePoint/Outlook）

**技術備註：**
- 在 Document 表增加 sourceType、sourceMetadata 欄位
- sourceMetadata 使用 JSON 儲存來源詳情

**FR 覆蓋**：FR2, FR3

---

## Epic 10: n8n 工作流整合

**目標**：平台與 n8n 工作流引擎無縫整合，支援雙向通訊、狀態監控和錯誤處理

**FRs 覆蓋**：FR54, FR55, FR56, FR57, FR58

**分工說明**：
- 平台負責：提供 API 供 n8n 調用、接收 n8n 回調、顯示執行狀態
- n8n 負責：流程編排、觸發源監控、外部系統整合

---

### Story 10.1: n8n 雙向通訊 API

**As a** 系統,
**I want** 提供完整的 API 供 n8n 工作流調用,
**So that** n8n 可以與平台進行雙向通訊。

**Acceptance Criteria:**

**Given** n8n 工作流需要調用平台功能
**When** 發送 API 請求
**Then** 平台提供以下 API 端點：
- `POST /api/n8n/documents` - 提交文件處理
- `GET /api/n8n/documents/{id}/status` - 查詢處理狀態
- `GET /api/n8n/documents/{id}/result` - 獲取處理結果
- `POST /api/n8n/webhook` - 接收 n8n 回調通知

**Given** n8n 調用 API
**When** 需要認證
**Then** 使用 API Key 認證機制
**And** API Key 綁定特定城市權限
**And** 記錄所有 API 調用至審計日誌

**Given** 平台需要通知 n8n
**When** 文件處理完成或發生錯誤
**Then** 平台調用配置的 n8n Webhook URL
**And** 傳送標準化的事件通知格式

**Given** API 調用
**When** 發生錯誤
**Then** 返回標準錯誤格式：錯誤代碼、錯誤訊息、追蹤 ID

**技術備註：**
- 創建 `ApiKey` 資料表（id, key, cityCode, name, permissions, createdAt, lastUsedAt）
- 實現 API Key 認證中間件
- 設計標準化的 API 回應格式

**FR 覆蓋**：FR54, FR55

---

### Story 10.2: Webhook 配置管理

**As a** 系統管理員,
**I want** 配置 n8n Webhook 設定,
**So that** 平台可以正確地向 n8n 發送通知。

**Acceptance Criteria:**

**Given** 系統管理員在系統設定頁面
**When** 導航至「n8n 整合」區塊
**Then** 顯示 Webhook 配置表單：
- n8n 基礎 URL
- Webhook 端點路徑
- 認證 Token
- 重試策略設定

**Given** 配置完成
**When** 點擊「測試連線」
**Then** 系統發送測試請求至 n8n
**And** 顯示連線結果（成功/失敗/逾時）

**Given** Webhook 配置
**When** 按城市配置
**Then** 支援城市級別的 Webhook 配置
**And** 不同城市可以連接不同的 n8n 實例

**Given** Webhook 發送失敗
**When** 配置重試策略
**Then** 系統自動重試（最多 3 次）
**And** 重試間隔遞增（1秒、5秒、30秒）
**And** 超過重試次數後記錄失敗日誌

**技術備註：**
- 創建 `WebhookConfig` 資料表
- 實現重試佇列機制
- 配置超時和重試參數

**FR 覆蓋**：FR55

---

### Story 10.3: 工作流執行狀態查看

**As a** 用戶,
**I want** 查看 n8n 工作流的執行狀態,
**So that** 我可以了解自動化流程的運行情況。

**Acceptance Criteria:**

**Given** 用戶已登入
**When** 導航至「工作流監控」頁面
**Then** 顯示近期工作流執行列表
**And** 包含：工作流名稱、觸發時間、狀態、耗時、相關文件

**Given** 工作流執行列表
**When** 篩選條件變更
**Then** 支援按狀態、時間範圍、工作流類型篩選

**Given** 工作流執行
**When** 狀態為「執行中」
**Then** 顯示進度指示器
**And** 支援即時更新（輪詢或 WebSocket）

**Given** 工作流執行
**When** 狀態為「已完成」
**Then** 顯示綠色勾號圖標
**And** 顯示執行耗時

**Given** 工作流執行
**When** 狀態為「失敗」
**Then** 顯示紅色錯誤圖標
**And** 提供「查看詳情」連結

**技術備註：**
- 創建 `WorkflowExecution` 資料表追蹤執行記錄
- n8n 通過 Webhook 回報執行狀態
- 實現狀態輪詢或 WebSocket 更新

**FR 覆蓋**：FR56

---

### Story 10.4: 手動觸發工作流

**As a** Super User,
**I want** 手動觸發特定的 n8n 工作流,
**So that** 我可以在需要時重新處理文件或執行特定任務。

**Acceptance Criteria:**

**Given** Super User 在工作流監控頁面
**When** 點擊「手動觸發」按鈕
**Then** 顯示可觸發的工作流列表

**Given** 選擇工作流
**When** 需要輸入參數
**Then** 顯示參數輸入表單
**And** 包含：目標文件（可選）、執行參數

**Given** 確認觸發
**When** 提交請求
**Then** 系統調用 n8n Webhook 觸發工作流
**And** 創建執行記錄
**And** 顯示執行 ID 供追蹤

**Given** 手動觸發
**When** 觸發成功
**Then** 跳轉至執行詳情頁面
**And** 可以即時監控執行狀態

**Given** 手動觸發
**When** 觸發失敗
**Then** 顯示錯誤訊息
**And** 提供重試選項

**FR 覆蓋**：FR55, FR56

---

### Story 10.5: 工作流錯誤詳情查看

**As a** 用戶,
**I want** 查看工作流執行錯誤的詳細資訊,
**So that** 我可以診斷問題並採取修正措施。

**Acceptance Criteria:**

**Given** 工作流執行失敗
**When** 點擊「查看詳情」
**Then** 顯示錯誤詳情頁面：
- 錯誤發生時間
- 錯誤類型（連線失敗/逾時/業務錯誤/系統錯誤）
- 錯誤訊息
- 失敗的步驟
- 相關的文件或資源

**Given** 錯誤詳情頁面
**When** 查看技術細節
**Then** 可以展開查看：
- 錯誤堆疊追蹤
- 請求/回應詳情
- n8n 執行日誌（如有）

**Given** 可恢復的錯誤
**When** 查看錯誤詳情
**Then** 顯示「重試」按鈕
**And** 點擊後重新觸發工作流

**Given** 需要進一步調查
**When** 點擊「在 n8n 中查看」
**Then** 跳轉至 n8n 的執行詳情頁面（新視窗）

**技術備註：**
- 在 `WorkflowExecution` 中增加 errorDetails JSON 欄位
- 儲存 n8n 回傳的錯誤資訊
- 配置 n8n 執行頁面的 URL 模板

**FR 覆蓋**：FR57

---

### Story 10.6: 文件處理進度追蹤

**As a** 用戶,
**I want** 追蹤通過 n8n 工作流處理的文件進度,
**So that** 我可以了解自動化處理的狀態。

**Acceptance Criteria:**

**Given** 文件通過 n8n 工作流提交
**When** 查看文件詳情
**Then** 顯示完整的處理時間軸：
- n8n 觸發時間
- 平台接收時間
- 各處理階段的開始/完成時間
- 當前狀態

**Given** 文件處理中
**When** 查看進度
**Then** 顯示當前步驟和預估剩餘時間
**And** 支援即時更新

**Given** 文件處理完成
**When** 查看結果
**Then** 顯示處理結果摘要
**And** 可以連結至審核頁面

**Given** 文件列表頁面
**When** 查看來自 n8n 的文件
**Then** 顯示來源標記「n8n 工作流」
**And** 顯示觸發的工作流名稱

**技術備註：**
- 在 Document 中增加 workflowExecutionId 關聯
- 記錄各階段的時間戳
- 計算預估剩餘時間基於歷史數據

**FR 覆蓋**：FR58

---

### Story 10.7: n8n 連接狀態監控

**As a** 系統管理員,
**I want** 監控 n8n 的連接狀態,
**So that** 我可以及時發現和處理連接問題。

**Acceptance Criteria:**

**Given** 系統管理員在系統監控頁面
**When** 查看「n8n 連接狀態」區塊
**Then** 顯示：
- 連接狀態（正常/異常/未配置）
- 最後成功通訊時間
- 24 小時內的成功/失敗調用統計

**Given** n8n 連接異常
**When** 連續 3 次調用失敗
**Then** 系統狀態變更為「異常」
**And** 發送告警通知給管理員

**Given** 連接狀態頁面
**When** 點擊「查看歷史」
**Then** 顯示近期的連接狀態變化記錄
**And** 包含每次狀態變化的原因

**Given** 連接異常後恢復
**When** 調用成功
**Then** 系統狀態自動恢復為「正常」
**And** 發送恢復通知

**技術備註：**
- 實現健康檢查機制（定期 ping n8n）
- 創建 `SystemHealthLog` 記錄狀態變化
- 配置告警通知（Email/Teams）

**FR 覆蓋**：FR56, FR57

---

## Epic 11: 對外 API 服務

**目標**：為外部系統提供 RESTful API，支援發票提交、狀態查詢、結果獲取和 Webhook 通知

**FRs 覆蓋**：FR64, FR65, FR66, FR67, FR68

---

### Story 11.1: API 發票提交端點

**As a** 外部系統開發者,
**I want** 通過 API 提交發票文件進行處理,
**So that** 我可以將發票處理功能整合到我的應用中。

**Acceptance Criteria:**

**Given** 外部系統已獲得 API 訪問權限
**When** 調用 `POST /api/v1/invoices` 端點
**Then** 可以提交發票文件，支援以下方式：
- 文件直接上傳（multipart/form-data）
- Base64 編碼內容
- 外部 URL 引用

**Given** 提交發票請求
**When** 請求包含有效內容
**Then** API 返回：
- HTTP 202 Accepted
- 處理任務 ID
- 預估處理時間
- 狀態查詢 URL

**Given** 提交發票請求
**When** 請求包含可選參數
**Then** 支援以下參數：
- `cityCode` - 指定城市（必填）
- `priority` - 優先級（normal/high）
- `callbackUrl` - 完成回調 URL
- `metadata` - 自定義元數據（JSON）

**Given** 提交發票請求
**When** 文件格式不支援或大小超限
**Then** 返回 HTTP 400 Bad Request
**And** 包含清晰的錯誤訊息和錯誤代碼

**技術備註：**
- 支援格式：PDF, PNG, JPG, TIFF
- 文件大小限制：50MB
- 實現請求速率限制（每分鐘 60 次）

**FR 覆蓋**：FR64

---

### Story 11.2: API 處理狀態查詢端點

**As a** 外部系統開發者,
**I want** 查詢已提交發票的處理狀態,
**So that** 我可以追蹤處理進度並在完成時獲取結果。

**Acceptance Criteria:**

**Given** 已提交發票並獲得任務 ID
**When** 調用 `GET /api/v1/invoices/{taskId}/status`
**Then** 返回處理狀態資訊：
- `status` - 狀態碼（queued/processing/completed/failed/review_required）
- `progress` - 進度百分比
- `currentStep` - 當前步驟描述
- `createdAt` - 創建時間
- `updatedAt` - 最後更新時間
- `estimatedCompletion` - 預估完成時間

**Given** 查詢狀態
**When** 狀態為 `completed`
**Then** 額外返回：
- `resultUrl` - 結果獲取 URL
- `completedAt` - 完成時間
- `confidenceScore` - 整體信心度

**Given** 查詢狀態
**When** 狀態為 `failed`
**Then** 額外返回：
- `error.code` - 錯誤代碼
- `error.message` - 錯誤訊息
- `error.retryable` - 是否可重試

**Given** 查詢不存在的任務 ID
**When** 調用狀態查詢
**Then** 返回 HTTP 404 Not Found

**FR 覆蓋**：FR65

---

### Story 11.3: API 處理結果獲取端點

**As a** 外部系統開發者,
**I want** 獲取發票處理的完整結果,
**So that** 我可以使用提取的數據進行後續處理。

**Acceptance Criteria:**

**Given** 發票處理已完成
**When** 調用 `GET /api/v1/invoices/{taskId}/result`
**Then** 返回完整的提取結果：
- taskId - 任務 ID
- status - 狀態
- forwarder - Forwarder 資訊（id, name, code）
- fields - 提取欄位陣列（name, value, confidence, source）
- metadata - 元數據
- processedAt - 處理完成時間

**Given** 獲取結果
**When** 需要特定格式
**Then** 支援 `format` 參數：
- `json` - 標準 JSON 格式（預設）
- `csv` - CSV 格式（僅欄位數據）
- `xml` - XML 格式

**Given** 獲取結果
**When** 處理狀態不是 `completed`
**Then** 返回 HTTP 409 Conflict
**And** 包含當前狀態資訊

**Given** 獲取結果
**When** 結果已過期（超過保留期限）
**Then** 返回 HTTP 410 Gone
**And** 提示結果已歸檔

**FR 覆蓋**：FR66

---

### Story 11.4: Webhook 通知服務

**As a** 外部系統開發者,
**I want** 在發票處理完成時接收 Webhook 通知,
**So that** 我不需要持續輪詢狀態。

**Acceptance Criteria:**

**Given** 提交發票時指定了 `callbackUrl`
**When** 處理完成或失敗
**Then** 系統發送 POST 請求至回調 URL，包含：
- event - 事件類型
- taskId - 任務 ID
- status - 處理狀態
- timestamp - 時間戳
- result - 結果摘要（confidenceScore, forwarder, resultUrl）

**Given** Webhook 請求
**When** 需要驗證來源
**Then** 請求包含簽名 Header：
- `X-Signature` - HMAC-SHA256 簽名
- `X-Timestamp` - 請求時間戳
**And** 接收方可以驗證請求真實性

**Given** Webhook 發送
**When** 目標 URL 無回應或返回錯誤
**Then** 系統自動重試：
- 最多重試 3 次
- 重試間隔：1分鐘、5分鐘、30分鐘
**And** 超過重試次數後記錄失敗日誌

**Given** Webhook 通知
**When** 事件類型
**Then** 支援以下事件：
- `invoice.processing` - 開始處理
- `invoice.completed` - 處理完成
- `invoice.failed` - 處理失敗
- `invoice.review_required` - 需要人工審核

**技術備註：**
- 使用消息佇列確保可靠投遞
- 記錄所有 Webhook 發送記錄
- 提供 Webhook 日誌查詢 API

**FR 覆蓋**：FR67

---

### Story 11.5: API 訪問控制與認證

**As a** 系統管理員,
**I want** 管理 API 訪問權限和認證,
**So that** 確保 API 安全並可追蹤使用情況。

**Acceptance Criteria:**

**Given** 外部系統需要訪問 API
**When** 發送請求
**Then** 必須在 Header 中包含有效的 API Key：
- `Authorization: Bearer {api_key}`
**And** 無效或缺失的 API Key 返回 HTTP 401

**Given** 系統管理員在管理頁面
**When** 管理 API Key
**Then** 可以執行：
- 創建新 API Key（指定名稱、城市權限、速率限制）
- 查看現有 API Key 列表
- 停用/重新啟用 API Key
- 刪除 API Key（不可恢復）

**Given** API Key 創建
**When** 設定權限
**Then** 可以配置：
- 允許訪問的城市（cityCode 列表）
- 允許的操作（submit/query/result）
- 速率限制（每分鐘請求數）
- 有效期限（可選）

**Given** API 調用
**When** 超過速率限制
**Then** 返回 HTTP 429 Too Many Requests
**And** 包含 `Retry-After` Header

**Given** API 調用
**When** 任何請求
**Then** 記錄至審計日誌：
- API Key ID
- 調用端點
- 請求參數
- 回應狀態
- 調用時間
- 客戶端 IP

**技術備註：**
- API Key 使用安全隨機生成（32 字符）
- 儲存 API Key 的 Hash 值，不儲存明文
- 實現基於 Redis 的速率限制

**FR 覆蓋**：FR68

---

### Story 11.6: API 文檔與開發者支援

**As a** 外部系統開發者,
**I want** 查閱完整的 API 文檔,
**So that** 我可以快速整合發票處理功能。

**Acceptance Criteria:**

**Given** 開發者需要了解 API
**When** 訪問 `/api/docs` 端點
**Then** 顯示互動式 API 文檔（Swagger UI）：
- 所有端點的詳細說明
- 請求/回應範例
- 可以直接測試 API（需要 API Key）

**Given** API 文檔
**When** 查看端點說明
**Then** 包含：
- 端點 URL 和方法
- 請求參數說明
- 回應格式和狀態碼
- 錯誤代碼列表
- 使用範例（cURL, JavaScript, Python）

**Given** 開發者需要範例代碼
**When** 查看文檔
**Then** 提供以下語言的整合範例：
- JavaScript/TypeScript
- Python
- C#
**And** 包含完整的錯誤處理範例

**技術備註：**
- 使用 OpenAPI 3.0 規範
- 自動從代碼生成文檔

**FR 覆蓋**：FR64, FR65, FR66 (整合文檔)

---

## Epic 12: 系統管理與監控

**目標**：系統管理員可以監控系統健康狀態、追蹤效能指標、配置告警、管理系統配置和備份

**FRs 覆蓋**：FR59, FR60, FR61, FR62, FR63

---

### Story 12.1: 系統健康監控儀表板

**As a** 系統管理員,
**I want** 查看系統整體健康狀態儀表板,
**So that** 我可以即時了解系統運行情況並快速發現問題。

**Acceptance Criteria:**

**Given** 系統管理員已登入
**When** 導航至「系統監控」頁面
**Then** 顯示系統健康儀表板，包含：
- 整體健康狀態指示器（正常/警告/異常）
- 各服務狀態卡片（Web 應用、AI 服務、數據庫、儲存服務）
- 最近 24 小時的可用性百分比
- 當前活躍用戶數

**Given** 健康儀表板
**When** 某個服務狀態異常
**Then** 對應卡片顯示紅色警示
**And** 顯示異常開始時間
**And** 顯示簡要錯誤描述

**Given** 健康儀表板
**When** 服務狀態變化
**Then** 儀表板自動更新（每 30 秒刷新）
**And** 狀態變化時顯示通知

**Given** 服務狀態卡片
**When** 點擊某個服務
**Then** 展開顯示詳細資訊：
- 回應時間趨勢圖
- 錯誤率統計
- 最近的錯誤日誌

**技術備註：**
- 實現各服務的健康檢查端點
- 使用 WebSocket 實現即時更新
- 創建 `ServiceHealthCheck` 資料表記錄歷史

**FR 覆蓋**：FR59

---

### Story 12.2: 效能指標追蹤

**As a** 系統管理員,
**I want** 追蹤系統效能指標,
**So that** 我可以識別效能瓶頸並進行優化。

**Acceptance Criteria:**

**Given** 系統管理員在效能監控頁面
**When** 查看效能指標
**Then** 顯示以下指標的即時數據和趨勢圖：
- API 回應時間（P50, P95, P99）
- 數據庫查詢時間
- AI 服務處理時間
- 文件上傳/下載速度
- 記憶體使用率
- CPU 使用率

**Given** 效能指標
**When** 選擇時間範圍
**Then** 支援：最近 1 小時、6 小時、24 小時、7 天、30 天

**Given** 效能指標
**When** 某項指標超過閾值
**Then** 在圖表上標記警告區域
**And** 顯示超標時間點

**Given** 效能監控頁面
**When** 需要深入分析
**Then** 可以查看：
- 最慢的 API 端點列表
- 最慢的數據庫查詢列表
- 資源消耗最高的操作

**Given** 效能數據
**When** 需要匯出
**Then** 支援匯出為 CSV 格式
**And** 包含完整的時間序列數據

**技術備註：**
- 收集 API 回應時間中間件
- 使用時間序列數據結構儲存指標
- 配置效能閾值參數

**FR 覆蓋**：FR60

---

### Story 12.3: 錯誤告警配置

**As a** 系統管理員,
**I want** 配置錯誤告警規則,
**So that** 當系統出現問題時能及時收到通知。

**Acceptance Criteria:**

**Given** 系統管理員在告警配置頁面
**When** 創建新告警規則
**Then** 可以設定：
- 告警名稱和描述
- 觸發條件（指標類型、閾值、持續時間）
- 告警級別（資訊/警告/嚴重/緊急）
- 通知管道（Email/Microsoft Teams）
- 通知對象（用戶或群組）

**Given** 告警規則
**When** 配置觸發條件
**Then** 支援以下條件類型：
- 服務不可用持續 X 分鐘
- 錯誤率超過 X%
- 回應時間超過 X 毫秒
- 隊列積壓超過 X 筆
- 儲存空間低於 X%

**Given** 告警觸發
**When** 條件滿足
**Then** 系統發送通知：
- 包含告警名稱、級別、觸發時間
- 包含相關指標數據
- 包含快速連結至監控頁面

**Given** 告警已觸發
**When** 條件恢復正常
**Then** 系統發送恢復通知
**And** 記錄告警持續時間

**Given** 告警歷史
**When** 查看告警記錄
**Then** 顯示所有歷史告警：
- 觸發時間、恢復時間、持續時間
- 告警級別和類型
- 處理狀態（未處理/已確認/已解決）

**技術備註：**
- 創建 `AlertRule` 和 `AlertHistory` 資料表
- 實現告警評估排程任務
- 整合 Email 和 Teams Webhook 通知

**FR 覆蓋**：FR61

---

### Story 12.4: 系統配置管理

**As a** 系統管理員,
**I want** 管理系統配置參數,
**So that** 我可以調整系統行為而不需要重新部署。

**Acceptance Criteria:**

**Given** 系統管理員在配置管理頁面
**When** 查看系統配置
**Then** 顯示可配置參數分類列表：
- 處理參數（信心度閾值、自動通過閾值）
- 整合設定（AI 服務參數、n8n 連線）
- 安全設定（Session 超時、密碼策略）
- 通知設定（Email SMTP、Teams Webhook）

**Given** 配置參數
**When** 編輯某個參數
**Then** 顯示：
- 參數名稱和描述
- 當前值和預設值
- 允許的值範圍或選項
- 變更影響說明

**Given** 修改配置
**When** 點擊「儲存」
**Then** 系統驗證配置值
**And** 如果驗證失敗顯示錯誤訊息
**And** 如果驗證成功則：
  - 儲存新配置
  - 記錄變更至審計日誌
  - 立即生效或提示需要重啟

**Given** 敏感配置（如密鑰）
**When** 顯示或編輯
**Then** 值以遮罩方式顯示
**And** 變更需要二次確認

**Given** 配置變更歷史
**When** 需要查看或回滾
**Then** 顯示變更歷史：
- 變更時間、變更人
- 變更前後的值
- 提供「回滾」按鈕

**技術備註：**
- 創建 `SystemConfig` 資料表（key, value, type, description, updatedAt, updatedBy）
- 實現配置熱載入機制
- 敏感配置值加密儲存

**FR 覆蓋**：FR62

---

### Story 12.5: 數據備份管理

**As a** 系統管理員,
**I want** 管理系統數據備份,
**So that** 確保數據安全並可在需要時恢復。

**Acceptance Criteria:**

**Given** 系統管理員在備份管理頁面
**When** 查看備份狀態
**Then** 顯示：
- 自動備份狀態（啟用/停用）
- 最近一次備份時間
- 備份保留策略
- 儲存空間使用情況

**Given** 備份列表
**When** 查看歷史備份
**Then** 顯示所有備份記錄：
- 備份時間
- 備份類型（完整/增量）
- 備份大小
- 備份狀態（成功/失敗）

**Given** 備份管理頁面
**When** 點擊「立即備份」
**Then** 系統執行手動備份：
- 顯示備份進度
- 完成後顯示結果（成功/失敗）
- 備份包含：數據庫、上傳文件、系統配置

**Given** 備份配置
**When** 設定備份排程
**Then** 可以配置：
- 備份頻率（每日/每週）
- 備份時間（選擇低峰時段）
- 保留期限（保留最近 N 個備份）
- 備份類型（完整/增量）

**技術備註：**
- 使用 Azure Backup 服務
- 數據庫使用 PostgreSQL pg_dump
- 文件使用 Azure Blob 快照

**FR 覆蓋**：FR63

---

### Story 12.6: 數據恢復功能

**As a** 系統管理員,
**I want** 從備份恢復系統數據,
**So that** 在發生數據損失時可以快速恢復。

**Acceptance Criteria:**

**Given** 系統管理員在備份管理頁面
**When** 需要恢復數據
**Then** 選擇備份點後顯示恢復選項：
- 完整恢復（替換所有數據）
- 部分恢復（選擇特定表或文件）
- 恢復至新環境（不影響現有數據）

**Given** 選擇恢復
**When** 開始恢復操作
**Then** 系統要求：
- 二次確認（輸入確認文字）
- 記錄恢復操作至審計日誌
- 顯示恢復進度

**Given** 恢復進行中
**When** 查看進度
**Then** 顯示：
- 當前步驟（數據庫/文件/配置）
- 預估剩餘時間
- 已恢復的數據量

**Given** 恢復完成
**When** 操作結束
**Then** 系統：
- 顯示恢復結果報告
- 列出恢復的數據統計
- 提供數據完整性驗證結果

**Given** 恢復測試
**When** 需要驗證備份可用性
**Then** 支援「恢復演練」功能：
- 恢復至隔離環境
- 不影響生產數據
- 生成演練報告

**技術備註：**
- 實現恢復前的自動備份（防止覆蓋）
- 恢復操作需要在維護時間窗口執行
- 記錄詳細的恢復日誌

**FR 覆蓋**：FR63

---

### Story 12.7: 系統日誌查詢

**As a** 系統管理員,
**I want** 查詢和分析系統日誌,
**So that** 我可以診斷問題和追蹤系統行為。

**Acceptance Criteria:**

**Given** 系統管理員在日誌查詢頁面
**When** 搜尋日誌
**Then** 支援以下篩選條件：
- 時間範圍
- 日誌級別（Debug/Info/Warning/Error/Critical）
- 服務來源（Web/AI/Database/n8n）
- 關鍵字搜尋
- 用戶 ID 或請求 ID

**Given** 日誌查詢結果
**When** 查看日誌列表
**Then** 顯示：
- 時間戳
- 日誌級別（顏色編碼）
- 服務來源
- 訊息摘要
**And** 點擊可展開完整內容

**Given** 某筆日誌
**When** 查看詳情
**Then** 顯示：
- 完整日誌訊息
- 堆疊追蹤（如有）
- 關聯的請求 ID
- 相關的用戶資訊
- 連結到相關的其他日誌

**Given** 日誌查詢
**When** 結果量大
**Then** 支援分頁（每頁 100 筆）
**And** 支援匯出（最多 10,000 筆）

**Given** 即時日誌
**When** 需要監控
**Then** 提供「即時日誌串流」功能
**And** 可以暫停/繼續串流

**技術備註：**
- 使用結構化日誌格式（JSON）
- 實現請求追蹤 ID（correlation ID）
- 日誌保留期限：30 天（可配置）

**FR 覆蓋**：FR59, FR60 (整合監控)
