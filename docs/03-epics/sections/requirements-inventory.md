# Requirements Inventory

## Functional Requirements

### 1. 文件處理（Document Processing）
- **FR1**: 用戶可以手動上傳單張或批量發票文件（支援 PDF、圖片格式）
- **FR2**: 系統可以從 SharePoint 自動獲取待處理的發票文件
- **FR3**: 系統可以從 Outlook 郵件附件自動提取發票文件
- **FR4**: 系統可以使用 OCR 技術提取發票中的文字內容
- **FR5**: 系統可以識別發票所屬的 Forwarder
- **FR6**: 系統可以將提取的內容映射到標準化的 Header 欄位（約 90 個）
- **FR7**: 系統可以為每個提取結果計算信心度評分
- **FR8**: 系統可以根據信心度自動分流處理路徑（自動/快速確認/完整審核）

### 2. 審核與修正（Review & Correction）
- **FR9**: 數據處理員可以查看待審核的發票列表
- **FR10**: 數據處理員可以查看發票的提取結果和原始文件對照
- **FR11**: 數據處理員可以確認正確的提取結果
- **FR12**: 數據處理員可以修正錯誤的提取結果
- **FR13**: 數據處理員可以標記修正為「正常修正」或「特例不學習」
- **FR14**: 數據處理員可以將複雜案例升級給 Super User
- **FR15**: Super User 可以處理升級的複雜案例
- **FR16**: 系統可以顯示信心度低的原因和不確定的欄位

### 3. 規則管理（Rule Management）
- **FR17**: Super User 可以查看現有的映射規則
- **FR18**: Super User 可以建議新的映射規則
- **FR19**: Super User 可以審核待升級的學習規則
- **FR20**: 系統可以記錄用戶修正並識別重複模式
- **FR21**: 系統可以在累計 3 次相同修正後建議規則升級
- **FR22**: 系統可以在規則升級前顯示影響範圍分析
- **FR23**: 系統可以保留規則版本歷史（至少 5 個版本）
- **FR24**: 系統可以在準確率下降時自動回滾規則

### 4. Forwarder 管理（Forwarder Management）
- **FR25**: Super User 可以查看所有 Forwarder Profile 列表
- **FR26**: Super User 可以查看單個 Forwarder 的詳細配置
- **FR27**: Super User 可以編輯 Forwarder 特定的映射規則
- **FR28**: Super User 可以測試 Forwarder 規則變更的效果
- **FR29**: 系統管理員可以新增或停用 Forwarder Profile

### 5. 報表與分析（Reporting & Analytics）
- **FR30**: 用戶可以查看處理統計儀表板（處理量、成功率、自動化率）
- **FR31**: 用戶可以按時間範圍篩選報表數據
- **FR32**: 用戶可以按 Forwarder 篩選報表數據
- **FR33**: 城市經理可以匯出費用明細報表（Excel 格式）
- **FR34**: 區域經理可以查看跨城市的匯總報表
- **FR35**: 系統可以追蹤並顯示 AI API 使用量和成本

### 6. 用戶管理（User Management）
- **FR36**: 用戶可以使用 Azure AD SSO 登入系統
- **FR37**: 系統管理員可以查看所有用戶列表
- **FR38**: 系統管理員可以新增用戶並分配角色
- **FR39**: 系統管理員可以修改用戶的角色和城市歸屬
- **FR40**: 系統管理員可以停用用戶帳戶
- **FR41**: 系統管理員可以定義自定義角色
- **FR42**: 城市經理可以管理本城市的用戶

### 7. 多城市數據管理（Multi-City Data Management）
- **FR43**: 系統可以按城市隔離發票和處理數據
- **FR44**: 城市用戶僅能訪問本城市的數據
- **FR45**: 區域經理可以訪問授權城市的數據
- **FR46**: 全局管理者可以訪問所有城市的數據
- **FR47**: 系統可以在所有城市共享 Mapping Rules 和 Forwarder Profiles

### 8. 審計與追溯（Audit & Traceability）
- **FR48**: 系統可以記錄所有用戶操作日誌
- **FR49**: 系統可以記錄所有數據變更（修改人、時間、原因）
- **FR50**: 審計人員可以查詢指定期間的處理記錄
- **FR51**: 審計人員可以從任何數據點追溯至原始發票文件
- **FR52**: 審計人員可以匯出符合審計要求的報告
- **FR53**: 系統可以保留數據和日誌至少 7 年

### 9. 工作流整合（Workflow Integration）
- **FR54**: 系統可以與 n8n 工作流引擎進行雙向通訊
- **FR55**: n8n 管理員可以在系統內查看工作流執行狀態
- **FR56**: n8n 管理員可以手動觸發特定工作流
- **FR57**: n8n 管理員可以查看工作流執行錯誤詳情
- **FR58**: 系統可以追蹤文件在工作流中的處理進度

### 10. 系統管理（System Administration）
- **FR59**: 系統管理員可以查看系統健康狀態儀表板
- **FR60**: 系統管理員可以查看 Azure 服務的連接狀態
- **FR61**: 系統管理員可以查看系統日誌和錯誤記錄
- **FR62**: 系統管理員可以配置系統參數（如信心度閾值）
- **FR63**: 系統可以在異常情況下發送告警通知

### 11. 對外 API（External API）
- **FR64**: 外部系統可以通過 API 提交發票文件
- **FR65**: 外部系統可以通過 API 查詢處理狀態
- **FR66**: 外部系統可以通過 API 獲取提取結果
- **FR67**: 外部系統可以註冊 Webhook 接收處理完成通知
- **FR68**: API 可以支援基於角色的訪問控制

### 12. 成本追蹤（Cost Tracking）
- **FR69**: 系統可以按城市追蹤發票處理數量
- **FR70**: 系統可以按城市追蹤 AI API 調用成本
- **FR71**: 財務人員可以查看城市級別的成本報表
- **FR72**: 系統可以生成月度成本分攤報告

## NonFunctional Requirements

### Performance（效能）
- **NFR-PERF-01**: 單張發票 AI 處理時間 < 30 秒
- **NFR-PERF-02**: Web 頁面載入時間 < 2 秒
- **NFR-PERF-03**: 搜尋結果返回時間 < 1 秒
- **NFR-PERF-04**: 批量處理能力 ≥ 500 張/小時
- **NFR-PERF-05**: 峰值處理能力 ≥ 1,000 張/小時
- **NFR-PERF-06**: 支援 ≥ 50 並發用戶

### Security（安全性）
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

### Scalability（可擴展性）
- **NFR-SCA-01**: 無狀態服務設計
- **NFR-SCA-02**: 新城市上線 < 1 週
- **NFR-SCA-03**: 新 Forwarder 支援 < 2 天
- **NFR-SCA-05**: 支援 ≥ 500,000 張/年發票
- **NFR-SCA-09**: 支援 11 個 APAC 城市

### Reliability（可靠性）
- **NFR-REL-01**: 系統可用性 ≥ 99.5%
- **NFR-REL-04**: RPO（恢復點目標）< 1 小時
- **NFR-REL-05**: RTO（恢復時間目標）< 4 小時
- **NFR-REL-08**: AI 服務不可用時自動降級

### Integration（整合性）
- **NFR-INT-01**: Azure Document Intelligence API 整合
- **NFR-INT-02**: Azure OpenAI API 整合
- **NFR-INT-04**: Azure AD SSO 整合
- **NFR-INT-05**: SharePoint 文件讀取
- **NFR-INT-06**: Outlook 附件提取
- **NFR-INT-08**: n8n 工作流引擎整合
- **NFR-INT-11**: RESTful API 設計

### Accessibility（無障礙）
- **NFR-ACC-01**: 符合 WCAG 2.1 Level A
- **NFR-ACC-02**: 支援鍵盤導航
- **NFR-ACC-03**: 足夠的顏色對比度（≥ 4.5:1）

### Maintainability（可維護性）
- **NFR-MAI-01**: 程式碼覆蓋率 ≥ 70%
- **NFR-MAI-02**: 技術文檔完整
- **NFR-MAI-05**: 監控儀表板

### Internationalization（國際化）
- **NFR-I18N-01**: UI 支援繁體中文、簡體中文、英文
- **NFR-I18N-04**: 時區支援（各城市本地時間）

## Additional Requirements

### 從 Architecture 提取的技術需求

- **ARCH-01**: 使用 create-next-app + shadcn/ui 作為 Starter Template
- **ARCH-02**: 使用 Prisma ORM 進行數據庫操作
- **ARCH-03**: 使用 NextAuth v5 + Azure AD Provider 進行認證
- **ARCH-04**: 使用 Zustand 管理 UI 狀態，React Query 管理伺服器狀態
- **ARCH-05**: 使用 BFF 模式（Next.js API Routes → Python Services）
- **ARCH-06**: Python 服務使用 FastAPI 框架
- **ARCH-07**: 遵循既定的命名規範（Prisma camelCase、DB snake_case、Component PascalCase）
- **ARCH-08**: API 錯誤格式遵循 RFC 7807
- **ARCH-09**: 部署到 Azure App Service + Azure Container Apps

### 從 UX Design 提取的設計需求

- **UX-01**: 使用 Professional Blue 主題色（#2563EB）
- **UX-02**: 響應式設計支援桌面和平板
- **UX-03**: 審核界面使用並排 PDF 對照佈局
- **UX-04**: 信心度使用顏色編碼（綠>90%、黃70-90%、紅<70%）
- **UX-05**: 載入狀態使用 Skeleton 組件
- **UX-06**: 錯誤狀態提供清晰說明和重試選項

## FR Coverage Map

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
