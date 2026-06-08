// =============================================================================
// PostgreSQL Flexible Server Module
// =============================================================================
// Purpose: Production PostgreSQL 15 for AI Document Extraction (122 models, 113 enums)
// Used by: ../main.bicep
// Source: STEP-02 Action 2.4
// Reference: CHANGE-055 v0.3 §2.2 + §9 (No HA for UAT/Pilot)
// =============================================================================
//
// Design highlights:
//   - PG 15 default — aligned with prisma/schema.prisma (122 models, 113 enums)
//   - SKU default Standard_B2s (Burstable) for UAT cost optimization
//     → Upgrade path to GP_Standard_D2ds_v5 (General Purpose) for Production
//   - HA mode default 'Disabled' per v0.3 §9 decision (UAT/Pilot does not need HA)
//     → SameZone / ZoneRedundant available as future upgrade without recreating
//   - 7 day backup retention (minimum); raise to 35 for Prod compliance needs
//   - geo-redundant backup default 'Disabled' (UAT); enable for Prod DR plans
//   - Conditional VNet integration: empty delegatedSubnetId = public access mode
//     (Mode C in CHANGE-055); set both subnet + private DNS zone for Mode A/B
//   - Conditional Microsoft Entra (Azure AD) admin — STRONGLY recommended for Prod
//     • passwordAuth kept 'Enabled' during transition phase (Prisma legacy SDK)
//     • Long-term plan: Container App Managed Identity → Entra token → DATABASE_URL
//   - pgvector / uuid-ossp / pgcrypto extensions enabled by default
//     (used for embeddings, UUID generation, encrypted fields respectively)
//   - administratorLoginPassword marked @secure() — REFERENCE FROM KEY VAULT
//     in main.bicep, never hardcode in parameter files
//   - Naming reference: see infrastructure/naming-conventions.md §3 (psql-<project>-<env>)
// =============================================================================

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

@description('Azure region')
param location string = resourceGroup().location

@description('PostgreSQL server name (must be globally unique, 3-63 lowercase chars)')
@minLength(3)
@maxLength(63)
param postgresName string

@description('PostgreSQL version')
@allowed([
  '15'
  '16'
])
param version string = '15'

@description('SKU - B_Standard_B2s (Burstable) for UAT, GP_Standard_D2ds_v5 (General Purpose) for Prod')
param skuName string = 'Standard_B2s'

@description('SKU tier')
@allowed([
  'Burstable'
  'GeneralPurpose'
  'MemoryOptimized'
])
param skuTier string = 'Burstable'

@description('Storage size in GB (32, 64, 128, 256, 512, 1024)')
@allowed([
  32
  64
  128
  256
  512
  1024
])
param storageSizeGB int = 32

@description('Backup retention days (7-35)')
@minValue(7)
@maxValue(35)
param backupRetentionDays int = 7

@description('Geo-redundant backup (false for UAT, optional for Prod)')
param geoRedundantBackup string = 'Disabled'

@description('Administrator login (used only during initial setup; switch to AAD/MI for ongoing access)')
param administratorLogin string = 'aidocadmin'

@description('Administrator password (REFERENCE FROM KV; do not hardcode)')
@secure()
param administratorLoginPassword string

@description('Microsoft Entra (Azure AD) admin object ID (RECOMMENDED for production)')
param entraAdminObjectId string = ''

@description('Microsoft Entra admin name (e.g. user principal name or group name)')
param entraAdminName string = ''

@description('VNet integration - delegated subnet ID for Private Endpoint (empty = public access)')
param delegatedSubnetId string = ''

@description('Private DNS zone ID (required if delegatedSubnetId is set)')
param privateDnsZoneId string = ''

@description('High Availability mode (Disabled per v0.3 §9; SameZone or ZoneRedundant for future upgrade)')
@allowed([
  'Disabled'
  'SameZone'
  'ZoneRedundant'
])
param highAvailabilityMode string = 'Disabled'

@description('Enable public network access (Disabled if using Private Endpoint)')
@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccess string = 'Enabled'

@description('Allow all Azure services (NOT recommended for prod)')
param allowAzureServices bool = true

@description('Database name to create')
param databaseName string = 'ai_document_extraction'

@description('Tags')
param tags object = {}

// -----------------------------------------------------------------------------
// Resource: PostgreSQL Flexible Server
// -----------------------------------------------------------------------------
//
// Network mode is mutually exclusive:
//   - delegatedSubnetId set → VNet integration (Private Endpoint), publicNetworkAccess forced Disabled
//   - delegatedSubnetId empty → public endpoint with firewall rules (UAT default)
//
// authConfig:
//   - activeDirectoryAuth: enabled when entraAdminObjectId provided (production hardening path)
//   - passwordAuth: kept 'Enabled' during transition (legacy Prisma + admin tooling compatibility)
//     → Plan to flip to 'Disabled' after MI migration verified end-to-end
// -----------------------------------------------------------------------------

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: version
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: storageSizeGB
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: geoRedundantBackup
    }
    highAvailability: {
      mode: highAvailabilityMode
    }
    network: !empty(delegatedSubnetId) ? {
      delegatedSubnetResourceId: delegatedSubnetId
      privateDnsZoneArmResourceId: privateDnsZoneId
      publicNetworkAccess: 'Disabled'
    } : {
      publicNetworkAccess: publicNetworkAccess
    }
    authConfig: {
      activeDirectoryAuth: !empty(entraAdminObjectId) ? 'Enabled' : 'Disabled'
      passwordAuth: 'Enabled' // 過渡期保留 password auth；MI 切換完成後改為 'Disabled'
      tenantId: !empty(entraAdminObjectId) ? subscription().tenantId : ''
    }
  }
}

// -----------------------------------------------------------------------------
// Resource: Microsoft Entra (Azure AD) Administrator (conditional)
// -----------------------------------------------------------------------------
// Only created when entraAdminObjectId is supplied. principalType supports
// 'User' / 'Group' / 'ServicePrincipal' — recommend 'Group' for ops handoff.
// -----------------------------------------------------------------------------

resource entraAdmin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2024-08-01' = if (!empty(entraAdminObjectId)) {
  parent: postgres
  name: entraAdminObjectId
  properties: {
    principalType: 'User' // 也可用 'Group' 或 'ServicePrincipal'
    principalName: entraAdminName
    tenantId: subscription().tenantId
  }
}

// -----------------------------------------------------------------------------
// Resource: Application Database
// -----------------------------------------------------------------------------
// Charset/collation aligned with Prisma defaults; do not change without
// validating against existing migrations (UTF8 / en_US.utf8).
// -----------------------------------------------------------------------------

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// -----------------------------------------------------------------------------
// Resource: Firewall Rule — Allow Azure Services (conditional)
// -----------------------------------------------------------------------------
// Only applied in public-access mode (delegatedSubnetId empty). The special
// 0.0.0.0 / 0.0.0.0 range is the documented Azure way to allow all Azure
// internal IPs. NOT recommended for Production — use Private Endpoint instead.
// -----------------------------------------------------------------------------

resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = if (allowAzureServices && empty(delegatedSubnetId)) {
  parent: postgres
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// -----------------------------------------------------------------------------
// Resource: PostgreSQL Server Configuration — Extensions Allowlist
// -----------------------------------------------------------------------------
// VECTOR     : pgvector — required for embedding columns (term-mapping, semantic search)
// UUID-OSSP  : uuid_generate_v4() — used by Prisma @default(uuid()) on new models
// PGCRYPTO   : crypt() / digest() — used for encrypted-at-rest fields and integrity hashes
//
// Server-level `azure.extensions` only allowlists what CAN be created;
// the actual `CREATE EXTENSION` runs in the application database via Prisma migration
// or a one-off psql script.
// -----------------------------------------------------------------------------

resource extensionsConfig 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: postgres
  name: 'azure.extensions'
  properties: {
    value: 'VECTOR,UUID-OSSP,PGCRYPTO'
    source: 'user-override'
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('PostgreSQL Flexible Server resource ID')
output id string = postgres.id

@description('Server FQDN (use in DATABASE_URL)')
output fqdn string = postgres.properties.fullyQualifiedDomainName

@description('Server name')
output name string = postgres.name

@description('Database name')
output databaseName string = database.name

@description('PostgreSQL version')
output version string = postgres.properties.version
