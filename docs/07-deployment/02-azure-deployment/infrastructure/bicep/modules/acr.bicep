// =============================================================================
// Azure Container Registry (ACR) Module
// =============================================================================
// Purpose: Production-ready ACR for AI Document Extraction
// Used by: ../main.bicep
// Source: docs/06-deployment/02-azure-deployment/uat-deployment/02-azure-resources-setup.md (Action 2.2)
// Reference: CHANGE-055 v0.3 §2.5 IaC Optional Track
// =============================================================================
//
// Design highlights:
//   - Standard tier supports webhook + reserves geo-replication path (upgrade to Premium)
//   - admin user MUST be disabled — forces all auth through Microsoft Entra ID / Managed Identity
//   - Public network access default Enabled (Mode C); set Disabled when Private Endpoint is in use
//   - Retention policy auto-cleans untagged manifests after 30 days
//   - Microsoft-managed encryption is sufficient for UAT (CMK reserved for Prod hardening)
//   - Naming reference: see infrastructure/naming-conventions.md §3 (acr<project><env>)
// =============================================================================

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

// Default to the parent resource group's location to avoid hard-coding regions
// and to keep the module region-portable across UAT / Prod / DR scenarios.
@description('Azure region for resource deployment')
param location string = resourceGroup().location

// ACR names are part of the global DNS namespace (<name>.azurecr.io).
// Azure constraint: 5-50 chars, alphanumeric only (no hyphens).
// Example for UAT: acraidocextractuat
@description('Container Registry name (must be globally unique, alphanumeric only, 5-50 chars)')
@minLength(5)
@maxLength(50)
param acrName string

// SKU drives feature set and cost:
//   - Basic    : dev/sandbox only (no webhook, no geo-replication)
//   - Standard : default for UAT/Prod (webhook + content trust capability)
//   - Premium  : reserved for production hardening (geo-replication, CMK, private link, etc.)
@description('SKU tier - Standard for UAT/Prod, Basic only for dev/sandbox')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param sku string = 'Standard'

// Hard-coded to false by policy: admin user is a shared static credential and
// directly conflicts with the Managed Identity strategy (STEP-08 + RBAC AcrPull).
// Only flip to true for break-glass investigation, then revert immediately.
@description('Enable admin user (REQUIRED to be false for security)')
param adminUserEnabled bool = false

// Default Enabled to allow CI/CD push from GitHub Actions runners during Pilot.
// Switch to Disabled once Private Endpoint + dedicated build agent are in place.
@description('Public network access (Disabled if using Private Endpoint)')
@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccess string = 'Enabled'

// Standard tags must include environment / owner / change / project per
// infrastructure/naming-conventions.md §6. Caller (main.bicep) merges defaults.
@description('Tags to apply')
param tags object = {}

// -----------------------------------------------------------------------------
// Resource: Azure Container Registry
// -----------------------------------------------------------------------------
// API version 2023-11-01-preview is the latest stable preview offering full
// support for retention/export policies and modern network rule options.

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    // SKU object only carries the tier name; pricing is implicit per Azure docs.
    name: sku
  }
  properties: {
    // SECURITY: must remain false — see parameter doc above.
    adminUserEnabled: adminUserEnabled

    // Network gating — when Disabled, callers must use Private Endpoint.
    publicNetworkAccess: publicNetworkAccess

    // Allow trusted Azure services (e.g. Container Apps, GitHub Actions OIDC)
    // to bypass network rules even when public access is restricted later.
    networkRuleBypassOptions: 'AzureServices'

    // Disable the dedicated data endpoint — UAT pulls go through the standard
    // login server. Enable later if multi-region replication is introduced.
    dataEndpointEnabled: false

    // Use Microsoft-managed key. Customer-managed key (CMK) requires Premium
    // SKU and a Key Vault with purge protection — deferred to Prod hardening.
    encryption: {
      status: 'disabled'
    }

    // Policy block: keep simple for Pilot, tighten in Phase 2.
    policies: {
      // Quarantine policy gates new images behind a manual scan approval.
      // Disabled to keep the deploy loop fast during Pilot; revisit when
      // Microsoft Defender for Containers is in place.
      quarantinePolicy: {
        status: 'disabled'
      }

      // Trust policy (content trust / Notary v1) requires Premium SKU; keep
      // disabled here so the same template works for Standard tier.
      trustPolicy: {
        status: 'disabled'
        type: 'Notary'
      }

      // Auto-cleanup of untagged manifests after 30 days. Prevents storage
      // bloat from orphaned layers without affecting tagged release images.
      retentionPolicy: {
        days: 30
        status: 'enabled'
      }

      // Allow `az acr import` / cross-region image export. Required for any
      // future DR replication or staging-to-prod promotion workflow.
      exportPolicy: {
        status: 'enabled'
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('ACR resource ID')
output id string = acr.id

@description('ACR login server FQDN (e.g. myacr.azurecr.io)')
output loginServer string = acr.properties.loginServer

@description('ACR name')
output name string = acr.name

// -----------------------------------------------------------------------------
// Bicep deployment example (commented out — invoke from main.bicep or CLI)
// -----------------------------------------------------------------------------
//
// 1) Standalone deployment via az CLI:
//
//    az deployment group create \
//      --resource-group "${RG_NAME}" \
//      --template-file infrastructure/bicep/modules/acr.bicep \
//      --parameters acrName="${ACR_NAME}" \
//                   location="${LOCATION}" \
//                   sku=Standard \
//                   adminUserEnabled=false \
//                   publicNetworkAccess=Enabled \
//                   tags='{"environment":"uat","owner":"app-team","change":"CHANGE-055","project":"ai-document-extraction"}'
//
// 2) Consumed from main.bicep:
//
//    module acr 'modules/acr.bicep' = {
//      name: 'deploy-acr'
//      params: {
//        acrName: acrName
//        location: location
//        sku: 'Standard'
//        adminUserEnabled: false
//        publicNetworkAccess: 'Enabled'
//        tags: commonTags
//      }
//    }
//
// 3) What-if preview before applying changes:
//
//    az deployment group what-if \
//      --resource-group "${RG_NAME}" \
//      --template-file infrastructure/bicep/modules/acr.bicep \
//      --parameters acrName="${ACR_NAME}"
//
// =============================================================================
