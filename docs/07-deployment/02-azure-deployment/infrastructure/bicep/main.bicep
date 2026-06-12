// =============================================================================
// AI Document Extraction - Azure Application Layer Infrastructure (Main)
// =============================================================================
// Purpose: Orchestrate App Team layer resources (ACR / CAE / CA / PG / Storage / KV / App Insights)
// Reference: CHANGE-055 v0.3 §2 + UAT 部署 SOP
// Mode: Mode C (App layer only - Infra Team builds RG / VNet / shared KV)
//
// Usage:
//   az deployment group create \
//     --resource-group <RG_NAME> \
//     --template-file main.bicep \
//     --parameters @parameters/uat.parameters.json
// =============================================================================

targetScope = 'resourceGroup'

// =============================================================================
// PARAMETERS - 共用
// =============================================================================

@description('Environment (uat / prod)')
@allowed([
  'uat'
  'prod'
])
param environment string

@description('Azure region')
param location string = resourceGroup().location

@description('Project short name for resource naming')
param projectShortName string = 'aidocextract'

@description('Tags applied to all resources')
param commonTags object = {
  project: 'ai-document-extraction'
  owner: 'app-team'
  change: 'CHANGE-055'
}

// =============================================================================
// PARAMETERS - 資源命名
// =============================================================================

@description('Container Registry name (5-50 chars, alphanumeric only, globally unique)')
@minLength(5)
@maxLength(50)
param acrName string

@description('PostgreSQL server name (3-63 chars, lowercase + hyphens, globally unique)')
@minLength(3)
@maxLength(63)
param postgresName string

@description('Storage Account name (3-24 chars, lowercase alphanumeric only, globally unique)')
@minLength(3)
@maxLength(24)
param storageName string

@description('Container Apps Environment name (2-32 chars, alphanumeric + hyphens)')
@minLength(2)
@maxLength(32)
param caeName string

@description('Container App name (2-32 chars, lowercase + hyphens)')
@minLength(2)
@maxLength(32)
param caName string

@description('Application Insights name (1-260 chars, alphanumeric + hyphens)')
param appInsightsName string

@description('Key Vault name (3-24 chars, alphanumeric + hyphens, globally unique). Only used if deployKeyVault=true')
param kvName string = ''

// =============================================================================
// PARAMETERS - 旗標
// =============================================================================

@description('Deploy Key Vault (false if using shared KV from Infra Team)')
param deployKeyVault bool = false

@description('Shared Key Vault URI (used when deployKeyVault=false)')
param sharedKeyVaultUri string = ''

// =============================================================================
// PARAMETERS - Log Analytics（Infra Team 提供）
// =============================================================================

@description('Log Analytics workspace resource ID (from Infra Team handoff)')
param logAnalyticsWorkspaceId string

@description('Log Analytics workspace customer ID (workspaceId GUID)')
param logAnalyticsCustomerId string

@description('Log Analytics workspace primary shared key')
@secure()
param logAnalyticsSharedKey string

// =============================================================================
// PARAMETERS - PostgreSQL
// =============================================================================

@description('PostgreSQL administrator login (for initial setup; switch to AAD/MI later)')
param postgresAdminLogin string = 'aidocadmin'

@description('PostgreSQL administrator password')
@secure()
param postgresAdminPassword string

@description('PostgreSQL Microsoft Entra admin object ID (recommended)')
param postgresEntraAdminObjectId string = ''

@description('PostgreSQL Microsoft Entra admin name')
param postgresEntraAdminName string = ''

// =============================================================================
// PARAMETERS - Container App
// =============================================================================

@description('Container image name (without tag)')
param imageName string = 'ai-document-extraction'

@description('Container image tag')
param imageTag string = 'uat-latest'

@description('Min replicas')
@minValue(0)
@maxValue(25)
param minReplicas int = 1

@description('Max replicas')
@minValue(1)
@maxValue(25)
param maxReplicas int = 5

@description('CPU cores allocated to each replica')
param cpuCores string = '0.5'

@description('Memory allocated to each replica')
param memoryGi string = '1.0Gi'

// =============================================================================
// PARAMETERS - SKU 控制（環境差異）
// =============================================================================

@description('ACR SKU')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param acrSku string = 'Standard'

@description('PostgreSQL SKU name (e.g. Standard_B2s, Standard_D2ds_v5)')
param postgresSkuName string = 'Standard_B2s'

@description('PostgreSQL SKU tier')
@allowed([
  'Burstable'
  'GeneralPurpose'
  'MemoryOptimized'
])
param postgresSkuTier string = 'Burstable'

@description('PostgreSQL storage size GB')
@minValue(32)
@maxValue(16384)
param postgresStorageSizeGB int = 32

@description('Storage Account SKU')
@allowed([
  'Standard_LRS'
  'Standard_ZRS'
  'Standard_GRS'
  'Standard_GZRS'
])
param storageSkuName string = 'Standard_LRS'

// =============================================================================
// MODULES - 依依賴順序
// =============================================================================

// 1. ACR（先建，Container App 拉 image 用）
module acr 'modules/acr.bicep' = {
  name: 'deploy-acr'
  params: {
    location: location
    acrName: acrName
    sku: acrSku
    adminUserEnabled: false
    tags: union(commonTags, {
      environment: environment
    })
  }
}

// 2. PostgreSQL（建立資料庫服務）
module postgres 'modules/postgres.bicep' = {
  name: 'deploy-postgres'
  params: {
    location: location
    postgresName: postgresName
    skuName: postgresSkuName
    skuTier: postgresSkuTier
    storageSizeGB: postgresStorageSizeGB
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    entraAdminObjectId: postgresEntraAdminObjectId
    entraAdminName: postgresEntraAdminName
    tags: union(commonTags, {
      environment: environment
    })
  }
}

// 3. Storage Account
module storage 'modules/storage.bicep' = {
  name: 'deploy-storage'
  params: {
    location: location
    storageName: storageName
    skuName: storageSkuName
    tags: union(commonTags, {
      environment: environment
    })
  }
}

// 4. Key Vault（條件式：自建 vs 共享）
module keyVault 'modules/key-vault.bicep' = if (deployKeyVault) {
  name: 'deploy-kv'
  params: {
    location: location
    kvName: kvName
    enableRbacAuthorization: true
    enablePurgeProtection: true
    tags: union(commonTags, {
      environment: environment
    })
  }
}

// 5. Application Insights
module appInsights 'modules/app-insights.bicep' = {
  name: 'deploy-app-insights'
  params: {
    location: location
    appInsightsName: appInsightsName
    logAnalyticsWorkspaceId: logAnalyticsWorkspaceId
    samplingPercentage: 100
    tags: union(commonTags, {
      environment: environment
    })
  }
}

// 6. Container Apps Environment
module containerAppsEnv 'modules/container-apps-env.bicep' = {
  name: 'deploy-cae'
  params: {
    location: location
    caeName: caeName
    logAnalyticsCustomerId: logAnalyticsCustomerId
    logAnalyticsSharedKey: logAnalyticsSharedKey
    tags: union(commonTags, {
      environment: environment
    })
  }
}

// 7. Container App（最後建，依賴 ACR + CAE + App Insights）
module containerApp 'modules/container-app.bicep' = {
  name: 'deploy-container-app'
  dependsOn: [
    acr
    containerAppsEnv
    appInsights
  ]
  params: {
    location: location
    caName: caName
    environmentId: containerAppsEnv.outputs.id
    acrLoginServer: acr.outputs.loginServer
    imageName: imageName
    imageTag: imageTag
    minReplicas: minReplicas
    maxReplicas: maxReplicas
    cpuCores: cpuCores
    memoryGi: memoryGi
    keyVaultUri: deployKeyVault ? keyVault.outputs.uri : sharedKeyVaultUri
    envVars: {
      NODE_ENV: 'production'
      AUTH_TRUST_HOST: 'false'
      SYSTEM_USER_ID: 'system-user-prod'
      APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.outputs.connectionString
    }
    tags: union(commonTags, {
      environment: environment
    })
  }
}

// =============================================================================
// OUTPUTS
// =============================================================================

@description('Container App FQDN (for browser access)')
output containerAppFqdn string = containerApp.outputs.fqdn

@description('Container App Managed Identity Principal ID (for RBAC grants)')
output managedIdentityPrincipalId string = containerApp.outputs.managedIdentityPrincipalId

@description('ACR login server')
output acrLoginServer string = acr.outputs.loginServer

@description('PostgreSQL FQDN')
output postgresFqdn string = postgres.outputs.fqdn

@description('Storage Account name')
output storageName string = storage.outputs.name

@description('Documents container name')
output documentsContainerName string = storage.outputs.documentsContainerName

@description('Application Insights connection string')
output appInsightsConnectionString string = appInsights.outputs.connectionString

@description('Key Vault URI (self-built or shared)')
output keyVaultUri string = deployKeyVault ? keyVault.outputs.uri : sharedKeyVaultUri
