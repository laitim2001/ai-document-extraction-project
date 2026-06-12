// =============================================================================
// Application Insights Module
// =============================================================================
// Purpose: APM + telemetry for AI Document Extraction (workspace-based)
// Used by: ../main.bicep
// Source: STEP-02 Action 2.6
// Reference: CHANGE-055 v0.3 §8 (App Insights 連 Infra Team Log Analytics)
// =============================================================================

@description('Azure region')
param location string = resourceGroup().location

@description('Application Insights name')
param appInsightsName string

@description('Log Analytics workspace resource ID (workspace-based App Insights)')
param logAnalyticsWorkspaceId string

@description('Application type')
@allowed([
  'web'
  'other'
])
param applicationType string = 'web'

@description('Sampling percentage (1-100)')
@minValue(1)
@maxValue(100)
param samplingPercentage int = 100

@description('Public network access for ingestion')
@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccessForIngestion string = 'Enabled'

@description('Public network access for query')
@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccessForQuery string = 'Enabled'

@description('Tags')
param tags object = {}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: applicationType
  properties: {
    Application_Type: applicationType
    WorkspaceResourceId: logAnalyticsWorkspaceId
    SamplingPercentage: samplingPercentage
    DisableIpMasking: false  // 強制 IP masking 保護 PII
    DisableLocalAuth: false  // UAT 過渡期允許 instrumentation key auth；Prod 改 true 強制 Entra
    publicNetworkAccessForIngestion: publicNetworkAccessForIngestion
    publicNetworkAccessForQuery: publicNetworkAccessForQuery
    Flow_Type: 'Bluefield'
    Request_Source: 'rest'
    IngestionMode: 'LogAnalytics'
  }
}

@description('Application Insights resource ID')
output id string = appInsights.id

@description('Application Insights name')
output name string = appInsights.name

@description('Connection string (use for SDK; preferred over instrumentation key)')
output connectionString string = appInsights.properties.ConnectionString

@description('Instrumentation key (legacy; use connection string instead)')
output instrumentationKey string = appInsights.properties.InstrumentationKey

@description('App Id (for direct API calls)')
output appId string = appInsights.properties.AppId

// =============================================================================
// 注意事項：
//
// 1. Workspace-based App Insights（依賴 Log Analytics workspace）
//    - Log Analytics 通常由 Infra Team 提供，不在本 module 建立
//    - 透過 logAnalyticsWorkspaceId 參數注入
//
// 2. Sampling
//    - UAT 預設 100%（取所有 telemetry 方便 debug）
//    - Prod 視 cost 可降至 10-50%
//
// 3. PII Masking
//    - DisableIpMasking = false（自動遮罩 client IP）
//    - 應用層另外用 logger 過濾 email/password（FIX-050 機制）
//
// 4. Local Auth (Instrumentation Key)
//    - UAT 允許（連線字串內含 ikey）
//    - Prod 應改 DisableLocalAuth = true，強制 Entra ID 認證
//
// 5. Connection String 注入流程
//    - Bicep output connectionString 寫入 Container App env var APPLICATIONINSIGHTS_CONNECTION_STRING
//    - Container App 自動經由此連線傳送 telemetry
//
// 應用層整合：見 ../uat-deployment/08-first-deployment.md + future src/lib/telemetry.ts
// =============================================================================
