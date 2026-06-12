// =============================================================================
// Container App Module
// =============================================================================
// Purpose: Next.js application Container App with Managed Identity + KV secrets
// Used by: ../main.bicep
// Source: STEP-08 first-deployment.md
// Reference: CHANGE-055 v0.3 §2.1.1 Container Apps 規模參數
// =============================================================================
//
// Design highlights:
//   - System-Assigned Managed Identity for ACR pull + Key Vault secret access
//     (NO admin user, NO static credentials — RBAC-only)
//   - All 18 production secrets are KV-backed via keyvaultref + identityref:system
//   - 18 sensitive env vars resolved through secretref: at revision boot
//   - 3 health probes (Startup / Liveness / Readiness) all hit /api/health
//   - HTTP scale rule with concurrentRequests threshold (default 50/replica)
//   - Single revision mode — blue/green achieved by creating new revision tag
//   - Naming reference: see infrastructure/naming-conventions.md §3 (ca-<project>-<env>)
// =============================================================================

// -----------------------------------------------------------------------------
// Parameters
// -----------------------------------------------------------------------------

// Default to the parent resource group's location for region portability.
@description('Azure region')
param location string = resourceGroup().location

// Container App resource name (Azure naming: 2-32 lowercase alphanumeric + hyphen).
// Example for UAT: ca-aidocextract-uat
@description('Container App name')
param caName string

// Resource ID of the Container Apps Environment created by container-apps-env module.
// Required for placing this app on the shared CAE control plane.
@description('Container Apps Environment ID (from container-apps-env module)')
param environmentId string

// ACR login server FQDN — output of the acr.bicep module.
// Used both for `registries[].server` and inside the image reference string.
@description('ACR login server (e.g. myacr.azurecr.io)')
param acrLoginServer string

// Image repository name without tag. Pairs with imageTag below.
// Example: ai-document-extraction
@description('Image name (without tag, e.g. ai-document-extraction)')
param imageName string

// Image tag — typically the SHA-derived tag pushed by GitHub Actions in STEP-04.
// Default is `uat-latest` for the very first revision; subsequent revisions
// should pass an immutable tag like `<sha>-uat-<timestamp>`.
@description('Image tag (e.g. abc1234-uat-20260513-093000)')
param imageTag string = 'uat-latest'

// Working hours: 1 (warm). Off-hours: 0 (scale to zero, accept cold start).
// CHANGE-055 §2.1.1: minReplicas swap is governed by Scheduled Scaling (TBD).
@description('Min replicas (1 for working hours, 0 for off-hours)')
@minValue(0)
@maxValue(10)
param minReplicas int = 1

// Hard cap on replica count — Pilot sizing is 5 (CHANGE-055 §2.1.1).
@description('Max replicas')
@minValue(1)
@maxValue(30)
param maxReplicas int = 5

// CPU cores per replica. Container Apps requires the exact string token.
// Allowed: 0.25 / 0.5 / 0.75 / 1.0 / 1.25 / 1.5 / 1.75 / 2.0
@description('CPU cores per replica (0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0)')
param cpuCores string = '0.5'

// Memory must be paired with CPU per Container Apps SKU table (e.g. 0.5 ↔ 1.0Gi).
@description('Memory per replica (Gi)')
param memoryGi string = '1.0Gi'

// Next.js standalone server listens on 3000 by default.
@description('Container target port')
param targetPort int = 3000

// External=true exposes a public *.azurecontainerapps.io FQDN.
// Set false once VNet + Private Endpoint + Front Door are in place.
@description('Ingress external (true = public FQDN, false = internal only)')
param externalIngress bool = true

// HTTP scale rule trigger threshold per replica.
@description('HTTP concurrent requests per replica (scale rule)')
param httpConcurrentRequests int = 50

// Key Vault DNS URI (e.g. https://kv-aidocextract-uat.vault.azure.net) — used
// to construct keyvaultref strings for every secret entry.
@description('Key Vault URI for secret references')
param keyVaultUri string

// Non-sensitive env vars passed in as a flat object map. Caller (main.bicep)
// can extend this default with additional plain-text vars without touching
// the secret reference table below.
@description('Non-sensitive env vars (object map)')
param envVars object = {
  NODE_ENV: 'production'
  AUTH_TRUST_HOST: 'false'
  SYSTEM_USER_ID: 'system-user-prod'
}

// Standard tags must include environment / owner / change / project per
// infrastructure/naming-conventions.md §6.
@description('Tags')
param tags object = {}

// -----------------------------------------------------------------------------
// Variables — Secret & Env Var Mapping Tables
// -----------------------------------------------------------------------------
// These two tables are the single source of truth for the 18 KV-backed secrets.
// Source: STEP-03 §3.2 (KV secret names) + §3.3 (env var → secret mapping).
// Keep both arrays aligned: every entry in envVarToSecretMappings MUST have a
// matching entry in secretMappings (by `name` ↔ `secretName`).
// -----------------------------------------------------------------------------

// KV secret name → Container App secret name 對照（共 18 個）
var secretMappings = [
  { name: 'database-url', kvSecretName: 'database-url' }
  { name: 'auth-secret', kvSecretName: 'auth-secret' }
  { name: 'jwt-secret', kvSecretName: 'jwt-secret' }
  { name: 'session-secret', kvSecretName: 'session-secret' }
  { name: 'encryption-key', kvSecretName: 'encryption-key' }
  { name: 'azure-openai-api-key', kvSecretName: 'azure-openai-api-key' }
  { name: 'azure-openai-endpoint', kvSecretName: 'azure-openai-endpoint' }
  { name: 'azure-di-key', kvSecretName: 'azure-di-key' }
  { name: 'azure-di-endpoint', kvSecretName: 'azure-di-endpoint' }
  { name: 'upstash-redis-rest-url', kvSecretName: 'upstash-redis-rest-url' }
  { name: 'upstash-redis-rest-token', kvSecretName: 'upstash-redis-rest-token' }
  { name: 'microsoft-graph-client-id', kvSecretName: 'microsoft-graph-client-id' }
  { name: 'microsoft-graph-client-secret', kvSecretName: 'microsoft-graph-client-secret' }
  { name: 'microsoft-graph-tenant-id', kvSecretName: 'microsoft-graph-tenant-id' }
  { name: 'smtp-host', kvSecretName: 'smtp-host' }
  { name: 'smtp-port', kvSecretName: 'smtp-port' }
  { name: 'smtp-user', kvSecretName: 'smtp-user' }
  { name: 'smtp-password', kvSecretName: 'smtp-password' }
]

// Env var name → secret reference 對照（共 18 個，與 secretMappings 對齊）
var envVarToSecretMappings = [
  { envName: 'DATABASE_URL', secretName: 'database-url' }
  { envName: 'AUTH_SECRET', secretName: 'auth-secret' }
  { envName: 'JWT_SECRET', secretName: 'jwt-secret' }
  { envName: 'SESSION_SECRET', secretName: 'session-secret' }
  { envName: 'ENCRYPTION_KEY', secretName: 'encryption-key' }
  { envName: 'AZURE_OPENAI_API_KEY', secretName: 'azure-openai-api-key' }
  { envName: 'AZURE_OPENAI_ENDPOINT', secretName: 'azure-openai-endpoint' }
  { envName: 'AZURE_DI_KEY', secretName: 'azure-di-key' }
  { envName: 'AZURE_DI_ENDPOINT', secretName: 'azure-di-endpoint' }
  { envName: 'UPSTASH_REDIS_REST_URL', secretName: 'upstash-redis-rest-url' }
  { envName: 'UPSTASH_REDIS_REST_TOKEN', secretName: 'upstash-redis-rest-token' }
  { envName: 'MICROSOFT_GRAPH_CLIENT_ID', secretName: 'microsoft-graph-client-id' }
  { envName: 'MICROSOFT_GRAPH_CLIENT_SECRET', secretName: 'microsoft-graph-client-secret' }
  { envName: 'MICROSOFT_GRAPH_TENANT_ID', secretName: 'microsoft-graph-tenant-id' }
  { envName: 'SMTP_HOST', secretName: 'smtp-host' }
  { envName: 'SMTP_PORT', secretName: 'smtp-port' }
  { envName: 'SMTP_USER', secretName: 'smtp-user' }
  { envName: 'SMTP_PASSWORD', secretName: 'smtp-password' }
]

// -----------------------------------------------------------------------------
// Resource: Container App
// -----------------------------------------------------------------------------
// API version 2024-03-01 is the latest stable revision supporting:
//   - keyvaultref:/identityref: secret resolution
//   - registries[].identity: 'system' for ACR pull via System-Assigned MI
//   - containers[].probes (Startup / Liveness / Readiness)
// -----------------------------------------------------------------------------

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: caName
  location: location
  tags: tags

  // System-Assigned Managed Identity is REQUIRED so that:
  //   1) `registries[].identity: 'system'` can pull from ACR (AcrPull RBAC)
  //   2) `secrets[].identity: 'system'` can resolve KV references (KV Secrets User RBAC)
  //   3) Application code can use DefaultAzureCredential for Blob / OpenAI / DI
  // RBAC role assignments to ACR / KV / Storage are wired in main.bicep AFTER
  // this module deploys (we need the principalId output first).
  identity: {
    type: 'SystemAssigned'
  }

  properties: {
    // Bind to the shared Container Apps Environment created by container-apps-env module.
    managedEnvironmentId: environmentId

    configuration: {
      // Single revision mode: each update replaces the active revision.
      // Multi-revision mode is reserved for future canary / blue-green flows.
      activeRevisionsMode: 'Single'

      // Ingress block — HTTPS-only, managed cert auto-provisioned by CAE.
      ingress: {
        external: externalIngress
        targetPort: targetPort
        // 'auto' lets Container Apps detect HTTP/1 vs HTTP/2 per request.
        transport: 'auto'
        // Force HTTPS — managed cert is issued automatically for the
        // *.azurecontainerapps.io FQDN within 1-2 minutes of first deploy.
        allowInsecure: false
      }

      // ACR pull via System-Assigned MI (NO admin user, NO password).
      // Requires AcrPull role granted on ACR scope (assigned in main.bicep).
      registries: [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]

      // KV-backed secrets — values dereferenced at revision boot via the
      // Container Apps platform. The app process never sees the KV URI.
      // 18 secrets total (must match envVarToSecretMappings size).
      secrets: [for secret in secretMappings: {
        name: secret.name
        keyVaultUrl: '${keyVaultUri}/secrets/${secret.kvSecretName}'
        identity: 'system'
      }]
    }

    template: {
      containers: [
        {
          name: caName
          image: '${acrLoginServer}/${imageName}:${imageTag}'

          resources: {
            cpu: json(cpuCores)
            memory: memoryGi
          }

          // Health probes — all three target /api/health (existing endpoint).
          // Tuned to the values used in STEP-08 Action 8.5 probes.yaml.
          probes: [
            {
              // Startup probe: tolerates up to 150s boot (failureThreshold=30 × 5s).
              // Generous because Next.js + Prisma cold start can hit 30-60s on first request.
              type: 'Startup'
              httpGet: {
                path: '/api/health'
                port: targetPort
              }
              initialDelaySeconds: 10
              periodSeconds: 5
              failureThreshold: 30
            }
            {
              // Liveness probe: kills replica if /api/health stays bad for 90s (3 × 30s).
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: targetPort
              }
              periodSeconds: 30
              failureThreshold: 3
            }
            {
              // Readiness probe: removes replica from rotation if not ready for 30s (3 × 10s).
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: targetPort
              }
              periodSeconds: 10
              failureThreshold: 3
            }
          ]

          // Env vars — concat of two sources:
          //   1) Plain-text envVars object (NODE_ENV, AUTH_TRUST_HOST, etc.)
          //   2) Secret references resolved from the secrets[] array above
          // Bicep `items()` iterates an object as { key, value } pairs,
          // matching what the Container Apps schema expects for env entries.
          env: concat(
            [for entry in items(envVars): {
              name: entry.key
              value: entry.value
            }],
            [for mapping in envVarToSecretMappings: {
              name: mapping.envName
              secretRef: mapping.secretName
            }]
          )
        }
      ]

      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas

        // HTTP scale rule — adds a replica when concurrent in-flight requests
        // exceed the threshold per replica. Tuned per CHANGE-055 §2.1.1.
        rules: [
          {
            name: 'http-concurrent-requests'
            http: {
              metadata: {
                concurrentRequests: '${httpConcurrentRequests}'
              }
            }
          }
        ]
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------

@description('Container App resource ID')
output id string = containerApp.id

@description('Container App FQDN')
output fqdn string = containerApp.properties.configuration.ingress.fqdn

@description('System-Assigned Managed Identity Principal ID (for RBAC assignments)')
output managedIdentityPrincipalId string = containerApp.identity.principalId

@description('Container App name')
output name string = containerApp.name

@description('Latest revision name')
output latestRevisionName string = containerApp.properties.latestRevisionName

// -----------------------------------------------------------------------------
// Bicep deployment example (commented out — invoke from main.bicep or CLI)
// -----------------------------------------------------------------------------
//
// 1) Consumed from main.bicep (typical pattern):
//
//    module containerApp 'modules/container-app.bicep' = {
//      name: 'deploy-container-app'
//      params: {
//        caName: caName
//        location: location
//        environmentId: containerAppsEnv.outputs.id
//        acrLoginServer: acr.outputs.loginServer
//        imageName: 'ai-document-extraction'
//        imageTag: imageTag
//        minReplicas: 1
//        maxReplicas: 5
//        cpuCores: '0.5'
//        memoryGi: '1.0Gi'
//        targetPort: 3000
//        externalIngress: true
//        httpConcurrentRequests: 50
//        keyVaultUri: keyVault.outputs.uri
//        envVars: {
//          NODE_ENV: 'production'
//          AUTH_TRUST_HOST: 'false'
//          SYSTEM_USER_ID: 'system-user-prod'
//          NEXT_PUBLIC_APP_URL: 'https://${caName}.${location}.azurecontainerapps.io'
//          AZURE_OPENAI_DEPLOYMENT_NAME: 'gpt-5.2'
//          AZURE_OPENAI_API_VERSION: '2025-03-01-preview'
//          AZURE_STORAGE_CONTAINER: 'documents'
//          FEATURE_EXTRACTION_V3: 'true'
//          FEATURE_EXTRACTION_V3_1: 'true'
//          ENABLE_UNIFIED_PROCESSOR: 'true'
//          JWT_EXPIRES_IN: '7d'
//          BCRYPT_SALT_ROUNDS: '12'
//          DEBUG_EXTRACTION_V3_PROMPT: 'false'
//          DEBUG_EXTRACTION_V3_RESPONSE: 'false'
//        }
//        tags: commonTags
//      }
//    }
//
// 2) Post-deploy RBAC wiring (in main.bicep, AFTER this module):
//
//    Use containerApp.outputs.managedIdentityPrincipalId to assign:
//      - AcrPull on ACR scope
//      - Key Vault Secrets User on KV scope
//      - Storage Blob Data Contributor on Storage scope
//
// 3) What-if preview before applying changes:
//
//    az deployment group what-if \
//      --resource-group "${RG_NAME}" \
//      --template-file infrastructure/bicep/main.bicep \
//      --parameters @infrastructure/bicep/parameters/uat.parameters.json
//
// =============================================================================
