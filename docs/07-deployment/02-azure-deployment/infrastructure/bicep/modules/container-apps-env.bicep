// =============================================================================
// Container Apps Environment Module
// =============================================================================
// Purpose: Managed environment for Container Apps (workload profile, networking, monitoring)
// Used by: ../main.bicep
// Source: docs/06-deployment/02-azure-deployment/uat-deployment/02-azure-resources-setup.md (Action 2.3)
// Reference: CHANGE-055 v0.3 §2.1 Container Apps 選型
// =============================================================================

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

@description('Azure region')
param location string = resourceGroup().location

@description('Container Apps Environment name (e.g. cae-aidocextract-uat)')
@minLength(2)
@maxLength(32)
param caeName string

@description('Log Analytics workspace customer ID (from Infra Team handoff)')
param logAnalyticsCustomerId string

@description('Log Analytics workspace primary shared key (REFERENCE FROM KV; do not hardcode)')
@secure()
param logAnalyticsSharedKey string

@description('VNet integration - subnet resource ID (empty = managed VNet by CAE)')
param infrastructureSubnetId string = ''

@description('Internal load balancer (true = internal-only ingress, false = external). Only effective when VNet integration is enabled.')
param internalLoadBalancer bool = false

@description('Tags to apply to the resource')
param tags object = {}

@description('Workload profile type - Consumption for UAT/Pilot, Dedicated for Prod high-load (D4/D8/D16/D32 etc.)')
param workloadProfileType string = 'Consumption'

// -----------------------------------------------------------------------------
// Variables
// -----------------------------------------------------------------------------

// 若提供 subnet ID，啟用 VNet integration；否則由 CAE 使用 managed VNet
var enableVnetIntegration = !empty(infrastructureSubnetId)

// CAE base properties (always present)
var baseProperties = {
  appLogsConfiguration: {
    destination: 'log-analytics'
    logAnalyticsConfiguration: {
      customerId: logAnalyticsCustomerId
      sharedKey: logAnalyticsSharedKey
    }
  }
  workloadProfiles: [
    {
      name: 'Consumption'
      workloadProfileType: workloadProfileType
    }
  ]
  zoneRedundant: false  // v0.3 §9：Pilot/UAT 暫無 HA 需求
}

// VNet configuration block (僅在啟用時 spread 進 properties)
var vnetProperties = enableVnetIntegration ? {
  vnetConfiguration: {
    infrastructureSubnetId: infrastructureSubnetId
    internal: internalLoadBalancer
  }
} : {}

// -----------------------------------------------------------------------------
// Resource: Container Apps Environment
// -----------------------------------------------------------------------------

resource cae 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: caeName
  location: location
  tags: tags
  properties: union(baseProperties, vnetProperties)
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('Container Apps Environment resource ID')
output id string = cae.id

@description('Default domain (e.g. <random>.southeastasia.azurecontainerapps.io)')
output defaultDomain string = cae.properties.defaultDomain

@description('Static IP for ingress')
output staticIp string = cae.properties.staticIp

@description('Container Apps Environment name')
output name string = cae.name
