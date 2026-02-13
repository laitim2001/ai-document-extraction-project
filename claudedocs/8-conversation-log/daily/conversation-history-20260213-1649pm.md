● 好的，我現在已經完成了所有分析。以下是完整的新環境 
  部署分析報告：

  ---
  新環境部署 Seed 數據與配置分析

  一、現有 Seed 涵蓋範圍 vs 缺口
  #: 1
  資料類別: 角色 (Role)
  Seed 現況: 6 個系統角色 + 22 個權限
  狀態: ✅ 已涵蓋
  ────────────────────────────────────────
  #: 2
  資料類別: 區域 (Region)
  Seed 現況: 4 個 (GLOBAL/APAC/EMEA/AMER)
  狀態: ✅ 已涵蓋
  ────────────────────────────────────────
  #: 3
  資料類別: 城市 (City)
  Seed 現況: 10 個
    (TPE/HKG/SGP/TYO/SHA/SYD/LON/FRA/NYC/LAX)        
  狀態: ✅ 已涵蓋
  ────────────────────────────────────────
  #: 4
  資料類別: 系統帳號
  Seed 現況: system@...internal + dev@example.com    
    (System Admin)
  狀態: ⚠️ 部分
  ────────────────────────────────────────
  #: 5
  資料類別: 公司/Forwarder
  Seed 現況: 15 家 (DHL/FedEx/UPS/TNT + 8 船公司 +   
    SF/Kerry + Unknown)
  狀態: ✅ 已涵蓋
  ────────────────────────────────────────
  #: 6
  資料類別: 映射規則 (MappingRule)
  Seed 現況: ~33 條 (25 通用 + DHL/FedEx/UPS/Maersk  
  各
    2-3 條)
  狀態: ✅ 已涵蓋
  ────────────────────────────────────────
  #: 7
  資料類別: 系統配置 (SystemConfig)
  Seed 現況: ~30 項 (5
    類：PROCESSING/INTEGRATION/SECURITY/NOTIFICATION/
  SYSTEM)
  狀態: ✅ 已涵蓋
  ────────────────────────────────────────
  #: 8
  資料類別: 資料範本 (DataTemplate)
  Seed 現況: 3 個 (ERP 標準/費用報表/物流追蹤)       
  狀態: ✅ 已涵蓋
  ────────────────────────────────────────
  #: 9
  資料類別: 範本欄位映射 (TemplateFieldMapping)      
  Seed 現況: 1 組 (ERP 標準 GLOBAL)
  狀態: ✅ 已涵蓋
  ────────────────────────────────────────
  #: 10
  資料類別: Pipeline 配置 (PipelineConfig)
  Seed 現況: 1 個 GLOBAL (預設 disabled)
  狀態: ✅ 已涵蓋
  ────────────────────────────────────────
  #: 11
  資料類別: Prompt 配置 (PromptConfig)
  Seed 現況: ❌ 無硬編碼 seed — 依賴
  exported-data.json
    恢復
  狀態: 🔴 缺口
  ────────────────────────────────────────
  #: 12
  資料類別: FieldMappingConfig
  Seed 現況: ❌ 無 seed
  狀態: 🔴 缺口
  ────────────────────────────────────────
  #: 13
  資料類別: 生產 Admin 帳號
  Seed 現況: ❌ 無 — 只有 dev 帳號和 system
    帳號（無密碼）
  狀態: 🔴 缺口
  ────────────────────────────────────────
  #: 14
  資料類別: Azure AD 使用者綁定
  Seed 現況: ❌ 無 seed — 需手動透過 SSO 首次登入建  
  狀態: ⚠️ 需手動
  ────────────────────────────────────────
  #: 15
  資料類別: 匯率 (ExchangeRate)
  Seed 現況: ❌ 無 seed
  狀態: 🔴 缺口
  ────────────────────────────────────────
  #: 16
  資料類別: 參考編號 (ReferenceNumber)
  Seed 現況: ❌ 無 seed
  狀態: ⚠️ 業務數據
  ────────────────────────────────────────
  #: 17
  資料類別: DocumentFormat
  Seed 現況: ❌ 無硬編碼 — 依賴 exported-data.json   
    或自動識別
  狀態: ⚠️ 依賴運行時
  ────────────────────────────────────────
  #: 18
  資料類別: 告警規則 (AlertRule)
  Seed 現況: ❌ 無 seed
  狀態: 🔴 缺口
  ────────────────────────────────────────
  #: 19
  資料類別: 備份排程 (BackupSchedule)
  Seed 現況: ❌ 無 seed
  狀態: ⚠️ 部署後設定
  ────────────────────────────────────────
  #: 20
  資料類別: SharePoint/Outlook 配置
  Seed 現況: ❌ 無 seed — 需手動在 UI 設定
  狀態: ⚠️ 部署後設定
  ---
  二、環境變數分析（.env）
  類別: 資料庫
  變數: DATABASE_URL
  必要性: 🔴 必須
  說明: PostgreSQL 連接字串
  ────────────────────────────────────────
  類別: 認證
  變數: AUTH_SECRET
  必要性: 🔴 必須
  說明: NextAuth 加密密鑰（npx auth secret 生成）    
  ────────────────────────────────────────
  類別: Azure AD
  變數: AZURE_AD_CLIENT_ID
  必要性: 🔴 必須
  說明: SSO 登入需要
  ────────────────────────────────────────
  類別:
  變數: AZURE_AD_CLIENT_SECRET
  必要性: 🔴 必須
  說明: SSO 登入需要
  ────────────────────────────────────────
  類別:
  變數: AZURE_AD_TENANT_ID
  必要性: 🔴 必須
  說明: SSO 登入需要
  ────────────────────────────────────────
  類別: 應用
  變數: NEXT_PUBLIC_APP_URL
  必要性: 🔴 必須
  說明: 前端 URL（影響回調、email 連結）
  ────────────────────────────────────────
  類別: Azure Blob
  變數: AZURE_STORAGE_CONNECTION_STRING
  必要性: 🔴 必須
  說明: 文件上傳存儲
  ────────────────────────────────────────
  類別:
  變數: AZURE_STORAGE_CONTAINER
  必要性: 🟡 建議
  說明: 預設 "documents"
  ────────────────────────────────────────
  類別: Azure OpenAI
  變數: AZURE_OPENAI_API_KEY
  必要性: 🔴 必須
  說明: AI 提取/分類核心功能
  ────────────────────────────────────────
  類別:
  變數: AZURE_OPENAI_ENDPOINT
  必要性: 🔴 必須
  說明: AI 服務端點
  ────────────────────────────────────────
  類別:
  變數: AZURE_OPENAI_DEPLOYMENT_NAME
  必要性: 🟡 建議
  說明: 預設 "gpt-5.2"
  ────────────────────────────────────────
  類別:
  變數: AZURE_OPENAI_API_VERSION
  必要性: 🟡 建議
  說明: 預設 "2025-03-01-preview"
  ────────────────────────────────────────
  類別: Azure DI
  變數: AZURE_DI_ENDPOINT
  必要性: 🔴 必須
  說明: OCR 服務（文件提取核心）
  ────────────────────────────────────────
  類別:
  變數: AZURE_DI_KEY
  必要性: 🔴 必須
  說明: OCR API key
  ────────────────────────────────────────
  類別: Python 服務
  變數: OCR_SERVICE_URL
  必要性: ⚠️ 視架構
  說明: Python OCR 微服務（若部署）
  ────────────────────────────────────────
  類別:
  變數: MAPPING_SERVICE_URL
  必要性: ⚠️ 視架構
  說明: Python Mapping 微服務（若部署）
  ────────────────────────────────────────
  類別: Redis
  變數: UPSTASH_REDIS_REST_URL
  必要性: 🟡 建議
  說明: Rate limiting + 快取
  ────────────────────────────────────────
  類別:
  變數: UPSTASH_REDIS_REST_TOKEN
  必要性: 🟡 建議
  說明: Upstash 認證
  ────────────────────────────────────────
  類別: n8n
  變數: N8N_BASE_URL
  必要性: ⚠️ 選用
  說明: 工作流引擎（透過 SystemConfig）
  ────────────────────────────────────────
  類別: 功能開關
  變數: ENABLE_UNIFIED_PROCESSOR
  必要性: 🟡 建議
  說明: V3.1 管線開關
  .env.example 的缺口：缺少 UPSTASH_REDIS_*, N8N_*,  
  MICROSOFT_GRAPH_* 等變數（這些在代碼中使用但未列入 
  .env.example）。

  ---
  三、🔴 關鍵缺口分析

  缺口 1: 沒有可登入的生產 Admin 帳號

  現況: seed 只建立了：
  - system@ai-document-extraction.internal —
  系統帳號，沒有密碼，無法登入
  - dev@example.com (id: dev-user-1) — 開發帳號，依  
   Dev Login 機制

  問題: 新環境部署後，如果 Azure AD SSO
  尚未設定完成，或者需要一個初始的 Credentials       
  帳號來登入系統進行配置，目前的 seed 無法滿足。     

  需要: 一個有密碼的 System Admin 帳號（使用
  Credentials provider 登入）。

  缺口 2: PromptConfig 沒有硬編碼 Seed

  現況: Prompt 配置只能透過
  prisma/seed/exported-data.json 恢復，沒有任何預設  
   seed 數據。

  問題: V3/V3.1 管線需要 PromptConfig 才能正確運行 AI
   提取和分類。沒有 prompt 配置，系統的核心功能（AI  
  提取）將無法使用。

  至少需要以下 PromptConfig:
  - STAGE_1_COMPANY_IDENTIFICATION (GLOBAL scope)    
  - STAGE_2_FORMAT_IDENTIFICATION (GLOBAL scope)     
  - STAGE_3_FIELD_EXTRACTION (GLOBAL scope)
  - FIELD_EXTRACTION (GLOBAL scope) — V3 管線使用    
  - TERM_CLASSIFICATION (GLOBAL scope) — 術語分類    

  缺口 3: FieldMappingConfig 沒有 Seed

  現況: 完全沒有欄位映射配置的 seed。

  問題: 四層配置繼承中的映射配置層沒有預設值。雖然   
  MappingRule 有 seed（Tier 1/2），但
  FieldMappingConfig（新的配置體系）沒有。

  缺口 4: 沒有預設告警規則

  現況: AlertRule 表為空。

  問題: 部署後系統不會自動產生任何告警。建議至少 seed
   幾個關鍵告警：
  - AI 服務不可用告警
  - OCR 服務超時告警
  - 處理佇列堆積告警
  - 資料庫連線異常告警

  缺口 5: 匯率表為空

  現況: ExchangeRate 表沒有 seed。

  問題: V3.1 管線中的匯率轉換步驟（step
  7）如果啟用，會因為沒有匯率資料而失敗。

  ---
  四、部署後「首次啟動」需手動執行的步驟

  以下是部署完 seed 後仍需手動完成的工作：
  順序: 1
  動作: 設定 .env 環境變數
  路徑/方式: 伺服器 .env
  說明: 所有 🔴 必須的變數
  ────────────────────────────────────────
  順序: 2
  動作: 執行 DB 遷移
  路徑/方式: npx prisma migrate deploy
  說明: 生產環境用 deploy
  ────────────────────────────────────────
  順序: 3
  動作: 執行 Seed
  路徑/方式: npx prisma db seed
  說明: 填入基礎資料
  ────────────────────────────────────────
  順序: 4
  動作: 首次 SSO 登入
  路徑/方式: 瀏覽器 /auth/login
  說明: 第一個 Azure AD 使用者登入
  ────────────────────────────────────────
  順序: 5
  動作: 設定首個 Admin
  路徑/方式: DB 直接操作或 API
  說明: 將首個 SSO 使用者設為 isGlobalAdmin: true    
  ────────────────────────────────────────
  順序: 6
  動作: 建立 PromptConfig
  路徑/方式: Admin UI /admin/prompt-configs/new      
  說明: 至少建 3 個 V3.1 階段的 prompt
  ────────────────────────────────────────
  順序: 7
  動作: 建立 FieldMappingConfig
  路徑/方式: Admin UI
  /admin/field-mapping-configs/new
  說明: 至少建 1 個 GLOBAL 配置
  ────────────────────────────────────────
  順序: 8
  動作: 設定 PipelineConfig
  路徑/方式: Admin UI /admin/pipeline-settings       
  說明: 啟用/停用匯率轉換、參考號匹配
  ────────────────────────────────────────
  順序: 9
  動作: 設定外部整合
  路徑/方式: Admin UI
  說明: SharePoint/Outlook/n8n（如需要）
  ────────────────────────────────────────
  順序: 10
  動作: 匯入匯率
  路徑/方式: Admin UI /admin/exchange-rates
  說明: 如啟用匯率轉換
  ────────────────────────────────────────
  順序: 11
  動作: 設定告警規則
  路徑/方式: Admin UI /admin/alerts
  說明: 關鍵系統告警
  ────────────────────────────────────────
  順序: 12
  動作: 設定備份排程
  路徑/方式: Admin UI /admin/backup
  說明: 定期備份
  ---
  五、建議的改善方案

  為了讓新環境部署後立即可用，建議增加以下 seed      
  數據：
  優先級: P0
  項目: 生產 Admin 帳號
  檔案: seed.ts 新增
  數據內容: 含密碼的 Credentials 帳號 + System Admin 
  角色
  ────────────────────────────────────────
  優先級: P0
  項目: PromptConfig seed
  檔案: seed-data/prompt-configs.ts 新建
  數據內容: 5 個基礎 GLOBAL prompt (Stage 1/2/3 +    
  提取 +
    分類)
  ────────────────────────────────────────
  優先級: P1
  項目: FieldMappingConfig seed
  檔案: seed-data/field-mapping-configs.ts 新建      
  數據內容: 1 個 GLOBAL 預設配置
  ────────────────────────────────────────
  優先級: P1
  項目: AlertRule seed
  檔案: seed-data/alert-rules.ts 新建
  數據內容: 4-5 個系統告警規則
  ────────────────────────────────────────
  優先級: P2
  項目: 匯率基礎資料
  檔案: seed-data/exchange-rates.ts 新建
  數據內容: 主要貨幣兌 USD 匯率
  ────────────────────────────────────────
  優先級: P2
  項目: .env.example 補全
  檔案: .env.example 更新
  數據內容: 加入 UPSTASH_REDIS_*、N8N_* 等缺失變數   
  ────────────────────────────────────────
  優先級: P3
  項目: 部署文檔
  檔案: docs/deployment-guide.md 新建
  數據內容: 完整的部署 SOP
  ---
  六、exported-data.json 機制的說明

  目前 seed 有一個「恢復機制」：如果
  prisma/seed/exported-data.json 存在，會從中恢復：  
  - 額外的 Companies
  - DocumentFormats
  - PromptConfigs
  - MappingRules
  - DataTemplates
  - SystemConfigs

  這是一個很好的「環境遷移」機制，但依賴於先從舊環境 
  導出。對於全新部署，這個檔案不存在，所以上述 P0    
  缺口必須通過硬編碼 seed 來填補。

  ---
  總結

  現有 seed 的覆蓋率大約 60-65%。基礎的 RBAC、區域/  
  市、公司、映射規則、系統配置都已涵蓋，但核心的 AI  
  功能配置（PromptConfig）和可登入的管理帳號是最關鍵 
  的缺口。

  建議優先處理 P0 項目（Admin 帳號 + PromptConfig    
  seed），這樣新環境部署後至少能：
  1. 透過 Credentials 帳號登入
  2. 使用 Admin 功能管理系統
  3. AI 提取管線有基礎的 prompt 可以運行

  需要我開始實作這些 seed 數據的改善嗎？