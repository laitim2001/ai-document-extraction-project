// =============================================================================
// Key Vault Module（App Team 自建情境）
// =============================================================================
// Purpose: Application secrets storage (RBAC mode + soft-delete + purge protection)
// Used by: ../main.bicep
// Source: STEP-03 secrets-configuration
// Reference: CHANGE-055 v0.3 §2.4
//
// 注意：Mode C 下若 Infra Team 提供共享 KV，本 module 不部署。
// 透過 main.bicep 的 conditional deployment 控制。
// =============================================================================
//
// Design highlights:
//   - RBAC authorization (取代 legacy access policies) — 對齊 Microsoft 推薦做法
//   - Soft delete 永遠啟用（Azure 已強制，無法停用）
//   - Purge protection 預設 true — 一旦啟用無法停用，符合 Prod 最低安全基線
//   - 18-21 個 secrets 的注入由 STEP-03 透過 az CLI 互動式完成（絕不入 git）
//   - Naming reference: see infrastructure/naming-conventions.md §3 (kv-<project>-<env>)
// =============================================================================

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

// Default to the parent resource group's location to keep the module
// region-portable across UAT / Prod / DR scenarios.
@description('Azure region')
param location string = resourceGroup().location

// Key Vault names live in the global DNS namespace (<name>.vault.azure.net).
// Azure constraint: 3-24 chars, alphanumeric + hyphen, must start with a letter.
// Example for UAT: kv-aidocextract-uat
@description('Key Vault name (3-24 alphanumeric + hyphen, globally unique)')
@minLength(3)
@maxLength(24)
param kvName string

// SKU drives feature set:
//   - standard : default for UAT/Prod (software-protected keys)
//   - premium  : HSM-backed keys (reserved for regulated workloads)
@description('SKU')
@allowed([
  'standard'
  'premium'
])
param skuName string = 'standard'

// Default to the deployment subscription's tenant. Override only when the
// Key Vault belongs to a different Entra ID tenant (rare cross-tenant case).
@description('Tenant ID')
param tenantId string = subscription().tenantId

// RBAC mode is the Microsoft-recommended default. Legacy access policies are
// retained for backward compatibility only — do not use for new vaults.
@description('Use RBAC for authorization (true = recommended; false = legacy access policies)')
param enableRbacAuthorization bool = true

// Azure allows 7-90 days. Pilot/UAT can keep 7 to recycle name space quickly;
// Prod should be raised to 90 (set in prod.parameters.json).
@description('Soft delete retention days (7-90)')
@minValue(7)
@maxValue(90)
param softDeleteRetentionDays int = 7

// IMMUTABLE once enabled — Azure will not let you turn this back off, and the
// vault cannot be purged before softDeleteRetentionDays elapse. Required true
// for any environment hosting production secrets.
@description('Enable purge protection (REQUIRED to be true for Prod; immutable once enabled)')
param enablePurgeProtection bool = true

// Set to Disabled when Private Endpoint is in place. Default Enabled to allow
// Container App MI + GitHub Actions OIDC to read secrets during Pilot.
@description('Public network access (Disabled if using Private Endpoint)')
@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccess string = 'Enabled'

// AzureServices bypass lets trusted Microsoft platform services (e.g. ARM
// deployment, Container Apps) reach the vault even when public access is
// later restricted. Set to None for strictest isolation.
@description('Network ACLs - allow Azure Services bypass')
@allowed([
  'AzureServices'
  'None'
])
param networkAclsBypass string = 'AzureServices'

// When publicNetworkAccess is Disabled this is forced to Deny below.
// When Enabled, defaultAction Allow is fine for Pilot (callers still need RBAC).
@description('Network ACLs - default action when no rules match')
@allowed([
  'Allow'
  'Deny'
])
param networkAclsDefaultAction string = 'Allow'

// All three "enabledFor*" flags grant ARM/compute services the ability to
// read secrets without RBAC. Keep false for least-privilege; only enable for
// specific scenarios (VM disk encryption, ARM template parameters).
@description('Enabled for deployment (allow ARM to access secrets during deployment)')
param enabledForDeployment bool = false

@description('Enabled for disk encryption')
param enabledForDiskEncryption bool = false

@description('Enabled for template deployment')
param enabledForTemplateDeployment bool = false

// Standard tags must include environment / owner / change / project per
// infrastructure/naming-conventions.md §6. Caller (main.bicep) merges defaults.
@description('Tags')
param tags object = {}

// Optional shortcut: pass Container App's system-assigned MI principalId here
// to grant Key Vault Secrets User in a single deployment. Leave empty when
// orchestrating RBAC from main.bicep instead (preferred for multi-consumer).
@description('Optional: Container App MI Principal ID to grant Key Vault Secrets User role')
param grantSecretUserToPrincipal string = ''

// -----------------------------------------------------------------------------
// Resource: Azure Key Vault
// -----------------------------------------------------------------------------
// API version 2023-07-01 is the latest stable GA offering full support for
// RBAC authorization, soft-delete retention tuning, and network ACLs.

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    sku: {
      // Microsoft-defined family code; only 'A' is currently valid.
      family: 'A'
      name: skuName
    }

    // RBAC mode: empty accessPolicies array. All access governed by Azure RBAC
    // role assignments (Key Vault Secrets User / Officer / Administrator).
    enableRbacAuthorization: enableRbacAuthorization

    // Soft delete is permanently on (Azure removed the ability to disable).
    // Retention window controls how long deleted vaults/secrets are recoverable.
    enableSoftDelete: true
    softDeleteRetentionInDays: softDeleteRetentionDays

    // Set to null when false so subsequent redeploys do not surface a
    // "cannot disable purge protection" error from Azure Resource Manager.
    enablePurgeProtection: enablePurgeProtection ? true : null

    // Network gating — when Disabled, callers must reach the vault via
    // Private Endpoint inside the Container Apps Environment subnet.
    publicNetworkAccess: publicNetworkAccess

    networkAcls: {
      bypass: networkAclsBypass
      // Force Deny when public network is disabled — defence in depth in case
      // a future operator flips publicNetworkAccess back to Enabled.
      defaultAction: publicNetworkAccess == 'Disabled' ? 'Deny' : networkAclsDefaultAction
      ipRules: []
      virtualNetworkRules: []
    }

    // All three flags default false (least privilege). Container App reads
    // secrets via its system-assigned Managed Identity + RBAC, not via these.
    enabledForDeployment: enabledForDeployment
    enabledForDiskEncryption: enabledForDiskEncryption
    enabledForTemplateDeployment: enabledForTemplateDeployment

    // RBAC mode → must be empty array. Populating this would conflict with
    // enableRbacAuthorization=true and trigger an ARM validation error.
    accessPolicies: []
  }
}

// -----------------------------------------------------------------------------
// Optional inline RBAC: grant Key Vault Secrets User to Container App MI
// -----------------------------------------------------------------------------
// Convenience path for single-consumer deployments. For multi-consumer
// scenarios (App + GitHub Actions runner + admin user) prefer to orchestrate
// RBAC from main.bicep so all assignments live in one place.
//
// Role: Key Vault Secrets User
//   - Built-in roleDefinitionId: 4633458b-17de-408a-b874-0445c86b69e6
//   - Permission: Microsoft.KeyVault/vaults/secrets/getSecret/action
//   - Reference: https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#key-vault-secrets-user

resource secretUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(grantSecretUserToPrincipal)) {
  scope: keyVault
  // Deterministic GUID — re-running deployment with the same principal is idempotent.
  name: guid(keyVault.id, grantSecretUserToPrincipal, 'KV-Secret-User')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: grantSecretUserToPrincipal
    // ServicePrincipal covers both Managed Identity and standard SP. Setting
    // this avoids the "principal not found" race condition when the MI was
    // just created in the same deployment.
    principalType: 'ServicePrincipal'
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('Key Vault resource ID')
output id string = keyVault.id

@description('Key Vault URI (e.g. https://kv-name.vault.azure.net)')
output uri string = keyVault.properties.vaultUri

@description('Key Vault name')
output name string = keyVault.name

// =============================================================================
// 重要注意事項：
//
// 1. Purge Protection 一旦啟用無法停用，且 vault 刪除後最少 7 天才能 purge
// 2. RBAC mode 取代 access policies（Microsoft 推薦做法）
// 3. Soft delete 預設 7 天，建議 Prod 設 90 天
// 4. Secrets 不在此 Bicep 注入（敏感值絕不入 git）— 用 az CLI 互動式注入
// 5. Mode C 下若 Infra Team 提供共享 KV，本 module 不部署
//
// Secrets 注入流程：見 ../uat-deployment/03-secrets-configuration.md
// =============================================================================

// -----------------------------------------------------------------------------
// Bicep deployment example (commented out — invoke from main.bicep or CLI)
// -----------------------------------------------------------------------------
//
// 1) Standalone deployment via az CLI:
//
//    az deployment group create \
//      --resource-group "${RG_NAME}" \
//      --template-file infrastructure/bicep/modules/key-vault.bicep \
//      --parameters kvName="${KV_NAME}" \
//                   location="${LOCATION}" \
//                   skuName=standard \
//                   enableRbacAuthorization=true \
//                   enablePurgeProtection=true \
//                   softDeleteRetentionDays=7 \
//                   publicNetworkAccess=Enabled \
//                   tags='{"environment":"uat","owner":"app-team","change":"CHANGE-055","project":"ai-document-extraction"}'
//
// 2) Consumed from main.bicep (App Team 自建情境):
//
//    module kv 'modules/key-vault.bicep' = if (deployKeyVault) {
//      name: 'deploy-kv'
//      params: {
//        kvName: kvName
//        location: location
//        skuName: 'standard'
//        enableRbacAuthorization: true
//        enablePurgeProtection: true
//        softDeleteRetentionDays: environment == 'prod' ? 90 : 7
//        publicNetworkAccess: usePrivateEndpoint ? 'Disabled' : 'Enabled'
//        grantSecretUserToPrincipal: containerApp.outputs.principalId
//        tags: commonTags
//      }
//    }
//
// 3) Mode C 跳過部署（Infra Team 提供共享 KV）:
//
//    main.bicep 透過 param deployKeyVault bool = false 控制；
//    Container App 改用 Infra Team 給的 kvUri 與 principalId 接線。
//
// 4) What-if preview before applying changes:
//
//    az deployment group what-if \
//      --resource-group "${RG_NAME}" \
//      --template-file infrastructure/bicep/modules/key-vault.bicep \
//      --parameters kvName="${KV_NAME}"
//
// =============================================================================
