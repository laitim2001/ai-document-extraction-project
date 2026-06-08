// =============================================================================
// Storage Account + Blob Container Module
// =============================================================================
// Purpose: Document storage (PDFs, OCR results) with Managed Identity access
// Used by: ../main.bicep
// Source: docs/06-deployment/02-azure-deployment/uat-deployment/02-azure-resources-setup.md (Action 2.5)
// Reference: CHANGE-055 v0.3 §2.3 Storage 配置 + §9 HA 決策（UAT 用 LRS）
// =============================================================================
//
// Design highlights:
//   - Default SKU: Standard_LRS for UAT (Pilot 暫無 HA)；Prod 應升級至 ZRS/GZRS
//   - Microsoft-managed encryption is sufficient for UAT (CMK reserved for Prod hardening)
//   - Public blob access HARD-CODED disabled — all access must go through Managed Identity / SAS
//   - HTTPS-only + TLS 1.2 minimum — non-negotiable security baseline
//   - Soft-delete enabled (7 days) for both blobs and containers — prevents accidental data loss
//   - Blob versioning enabled — supports audit trail for document overwrites
//   - documents container forced to publicAccess=None — defence-in-depth
//   - Lifecycle policy commented out (UAT 不啟用，Prod 可參考啟用)
//   - Naming reference: see infrastructure/naming-conventions.md §3 (st<project><env>, lowercase, no '-')
// =============================================================================

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

// Default to the parent resource group's location to keep the module
// region-portable across UAT / Prod / DR scenarios.
@description('Azure region')
param location string = resourceGroup().location

// Storage Account names are part of the global DNS namespace
// (<name>.blob.core.windows.net). Azure constraint: 3-24 chars, lowercase
// alphanumeric only (no hyphens / no uppercase).
// Example for UAT: staidocextractuat
@description('Storage Account name (must be globally unique, 3-24 lowercase alphanumeric)')
@minLength(3)
@maxLength(24)
param storageName string

// SKU drives replication strategy and cost:
//   - Standard_LRS    : 3 copies in single zone — UAT/Pilot default (cheapest)
//   - Standard_ZRS    : 3 copies across zones — recommended for Prod
//   - Standard_GRS    : LRS + async geo-replication — DR scenario
//   - Standard_RAGRS  : GRS + read-access secondary
//   - Standard_GZRS   : ZRS + geo-replication — full HA + DR (most expensive)
//   - Standard_RAGZRS : GZRS + read-access secondary
// Per CHANGE-055 v0.3 §9, UAT/Pilot defers HA — LRS is sufficient.
@description('SKU - LRS for UAT, ZRS for Prod (Pilot 暫無 HA)')
@allowed([
  'Standard_LRS'
  'Standard_ZRS'
  'Standard_GRS'
  'Standard_RAGRS'
  'Standard_GZRS'
  'Standard_RAGZRS'
])
param skuName string = 'Standard_LRS'

// Hot tier for frequently accessed data (default for active document workloads).
// Cool tier saves storage cost but increases retrieval cost — only suitable for
// archived/infrequently-accessed blobs. UAT keeps Hot for predictable behaviour.
@description('Access tier')
@allowed([
  'Hot'
  'Cool'
])
param accessTier string = 'Hot'

// SECURITY: must remain false. Public blob access would allow anonymous internet
// access to document URLs — incompatible with PII / invoice content classification.
// All reads must go through Managed Identity / signed SAS URLs.
@description('Allow public blob access (REQUIRED to be false for security)')
param allowBlobPublicAccess bool = false

// Default Enabled to allow Container Apps + GitHub Actions to reach the account
// during Pilot. Switch to Disabled once Private Endpoint is provisioned.
@description('Public network access')
@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccess string = 'Enabled'

// Soft-delete window for blobs — accidentally deleted blobs can be restored
// within this period. 7 days is a balance between safety and storage cost
// (deleted blobs continue to incur charges during retention).
@description('Soft delete retention days for blobs')
@minValue(1)
@maxValue(365)
param blobSoftDeleteRetentionDays int = 7

// Soft-delete window for entire containers (separate from blob-level).
// Protects against accidental container removal — important since deleting
// a container is a single irreversible operation otherwise.
@description('Soft delete retention days for containers')
@minValue(1)
@maxValue(365)
param containerSoftDeleteRetentionDays int = 7

// Container holding uploaded invoice PDFs and derived OCR artefacts.
// Naming kept simple — environment isolation is at the Storage Account level.
@description('Container name for documents')
param documentsContainerName string = 'documents'

// Standard tags must include environment / owner / change / project per
// infrastructure/naming-conventions.md §6. Caller (main.bicep) merges defaults.
@description('Tags')
param tags object = {}

// SECURITY NOTE: Shared key (account key) auth is the legacy mechanism.
// Setting this to false forces all access through Microsoft Entra ID /
// Managed Identity (preferred). UAT keeps it enabled during the migration
// window so existing tooling (Storage Explorer, az CLI without --auth-mode)
// still works; Prod should flip this to false once tooling is migrated.
@description('Allow shared key access (false = enforce Entra ID/MI auth only)')
param allowSharedKeyAccess bool = true

// -----------------------------------------------------------------------------
// Resource: Storage Account
// -----------------------------------------------------------------------------
// API version 2023-05-01 is the latest stable GA at time of writing and
// supports all properties used below (network ACLs, allowSharedKeyAccess, etc.).

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: tags
  sku: {
    // SKU object only carries the tier name; pricing is implicit per Azure docs.
    name: skuName
  }
  // StorageV2 is the only generally-recommended kind for new accounts —
  // supports all data services (blob, file, queue, table) + lifecycle policies.
  kind: 'StorageV2'
  properties: {
    accessTier: accessTier

    // SECURITY BASELINE: TLS 1.2 minimum across all data services.
    // TLS 1.0/1.1 are deprecated and rejected by modern security policies.
    minimumTlsVersion: 'TLS1_2'

    // SECURITY BASELINE: reject any plain HTTP request. Non-negotiable.
    supportsHttpsTrafficOnly: true

    // SECURITY: see parameter doc above — must remain false in this template.
    allowBlobPublicAccess: allowBlobPublicAccess

    // Migration knob — see parameter doc above. UAT=true, Prod target=false.
    allowSharedKeyAccess: allowSharedKeyAccess

    // Network gating — when Disabled, callers must use Private Endpoint.
    publicNetworkAccess: publicNetworkAccess

    // Network ACL strategy:
    //   - When public access is Disabled, switch defaultAction to Deny so only
    //     Private Endpoint / explicit IP rules can reach the account.
    //   - bypass=AzureServices keeps trusted Azure services (e.g. Container
    //     Apps via system identity, ARM-managed copy ops) reachable even when
    //     defaultAction is Deny.
    networkAcls: {
      defaultAction: publicNetworkAccess == 'Disabled' ? 'Deny' : 'Allow'
      bypass: 'AzureServices'
    }

    // Encryption: Microsoft-managed key (PMK) on both blob and file services.
    // Customer-managed key (CMK) requires a Key Vault with purge protection
    // and a User-Assigned Managed Identity — deferred to Prod hardening.
    encryption: {
      services: {
        blob: {
          enabled: true
          keyType: 'Account'
        }
        file: {
          enabled: true
          keyType: 'Account'
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

// -----------------------------------------------------------------------------
// Resource: Blob Service (default) — soft-delete + versioning configuration
// -----------------------------------------------------------------------------
// The blobServices/default sub-resource carries account-wide blob policies.
// There is exactly one per Storage Account and it is named 'default' by API contract.

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    // Blob-level soft delete — recoverable window after a blob is deleted/overwritten.
    deleteRetentionPolicy: {
      enabled: true
      days: blobSoftDeleteRetentionDays
    }

    // Container-level soft delete — recoverable window after an entire container is deleted.
    containerDeleteRetentionPolicy: {
      enabled: true
      days: containerSoftDeleteRetentionDays
    }

    // Versioning preserves prior versions of blobs on overwrite — required for
    // audit trail of document edits / re-uploads. Storage cost increases linearly
    // with edit volume; UAT volume is low enough to absorb this.
    isVersioningEnabled: true

    // Change feed records every change as an immutable log — useful for
    // event-driven downstream pipelines but adds storage overhead. Disabled
    // for UAT (we don't have downstream consumers yet).
    changeFeed: {
      enabled: false
    }
  }
}

// -----------------------------------------------------------------------------
// Resource: Documents Container
// -----------------------------------------------------------------------------
// Holds invoice PDFs and OCR-derived artefacts. Always private — even if the
// account-level allowBlobPublicAccess is somehow flipped, the container's own
// publicAccess=None provides defence-in-depth.

resource documentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: documentsContainerName
  properties: {
    // SECURITY: enforce private access at container level (defence-in-depth).
    publicAccess: 'None'

    // Metadata is informational only (no functional impact). Useful for
    // Storage Explorer audits and ownership clarity.
    metadata: {
      purpose: 'Invoice document storage'
      managedBy: 'app-team'
    }
  }
}

// -----------------------------------------------------------------------------
// (Optional) Lifecycle Management Policy — disabled for UAT
// -----------------------------------------------------------------------------
// Lifecycle policy: move blobs untouched for 30 days into Cool tier to reduce
// storage cost. UAT 不啟用（資料量小、Hot tier 已足夠便宜）；Prod 可解除註解
// 並調整 daysAfterModificationGreaterThan 為實際 retention SLA。
//
/*
resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'MoveOldDocumentsToCool'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: [ 'blockBlob' ]
            }
            actions: {
              baseBlob: {
                tierToCool: {
                  daysAfterModificationGreaterThan: 30
                }
              }
            }
          }
        }
      ]
    }
  }
}
*/

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('Storage Account resource ID')
output id string = storage.id

@description('Storage Account name')
output name string = storage.name

@description('Primary blob endpoint (e.g. https://<name>.blob.core.windows.net/)')
output blobEndpoint string = storage.properties.primaryEndpoints.blob

@description('Documents container name')
output documentsContainerName string = documentsContainer.name

@description('Documents container resource ID')
output documentsContainerId string = documentsContainer.id

// -----------------------------------------------------------------------------
// Bicep deployment example (commented out — invoke from main.bicep or CLI)
// -----------------------------------------------------------------------------
//
// 1) Standalone deployment via az CLI:
//
//    az deployment group create \
//      --resource-group "${RG_NAME}" \
//      --template-file infrastructure/bicep/modules/storage.bicep \
//      --parameters storageName="${STORAGE_NAME}" \
//                   location="${LOCATION}" \
//                   skuName=Standard_LRS \
//                   accessTier=Hot \
//                   allowBlobPublicAccess=false \
//                   publicNetworkAccess=Enabled \
//                   tags='{"environment":"uat","owner":"app-team","change":"CHANGE-055","project":"ai-document-extraction"}'
//
// 2) Consumed from main.bicep:
//
//    module storage 'modules/storage.bicep' = {
//      name: 'deploy-storage'
//      params: {
//        storageName: storageName
//        location: location
//        skuName: 'Standard_LRS'
//        accessTier: 'Hot'
//        allowBlobPublicAccess: false
//        publicNetworkAccess: 'Enabled'
//        tags: commonTags
//      }
//    }
//
// 3) What-if preview before applying changes:
//
//    az deployment group what-if \
//      --resource-group "${RG_NAME}" \
//      --template-file infrastructure/bicep/modules/storage.bicep \
//      --parameters storageName="${STORAGE_NAME}"
//
// =============================================================================
