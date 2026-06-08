---
document_type: deployment_procedure
step_id: STEP-08
title: Container Apps 首次部署（First Revision）
estimated_duration: 30-45 minutes
requires_approval: true
approver: app-team-lead
environment: uat
status: ✅ 完整內容（階段 C）
prerequisites:
  - STEP-04 completed（image 已推 ACR）
  - STEP-05 completed（schema migration 已套用）
  - STEP-06 completed（essential seed 已執行）
  - STEP-07 completed（reference seed 已執行）
outputs:
  - container_app_revision_name: <revision-name>
  - container_app_fqdn: <https FQDN>
  - revision_status: Running
  - replicas_running: 1
---

# STEP-08: Container Apps 首次部署（First Revision）

## ⚠️ 部署前警告

> **此 STEP 為業務影響觸發點 — 必須謹慎執行**

| 警告項目 | 說明 |
|---------|------|
| 🔴 **Approval Required** | `requires_approval: true` / `approver: app-team-lead` — AI 助手必須暫停請求人類確認 |
| 🔴 **業務影響** | 部署成功後 Container App 進入 user-reachable 狀態（首次外部可達） |
| 🟡 **建議分階段曝光** | 即使 ingress 為 external，建議先在內部測試 IP allowlist 範圍內驗證再對 Pilot 開放 |
| 🟡 **不可逆性** | revision 一旦 active，rollback 需要 STEP-10 流程；非 atomic |
| 🟢 **可逆性等級** | Layer 1 rollback 可用（previous revision 切回） |

> **AI 執行協議**：依 `99-ai-execution-guide.md` §4.1 Pre-Action Safety Check，必須在 Action 8.5 前輸出明確 plan 並等待 `app-team-lead` 確認。

---

## 🎯 Objective

部署第一個 Container Apps revision，啟用應用：
- 從 ACR 拉取 image（透過 Managed Identity，**不使用 admin user**）
- 注入所有 Key Vault secret references
- 配置 scale rule（minReplicas=1 工作時段 / maxReplicas=5）
- 配置 System-Assigned Managed Identity 並授予三個必要角色
- 啟動 health check endpoint 並驗證 `/api/health` 200 OK
- HTTPS 憑證自動配置（Container Apps managed cert）

---

## 📋 Action 8.1: 準備 Container App spec

> **目的**：宣告 Container App 配置（資源 / image / ingress / probes）

### Approach: Azure CLI 命令式（推薦給 AI 執行）

```bash
# 從 state file 載入前置 outputs
ACR_LOGIN_SERVER=$(yq '.resources.acr.login_server' ${STATE_FILE})
IMAGE_TAG=$(yq '.resources.acr.last_pushed_tag' ${STATE_FILE})
CAE_ID=$(yq '.resources.container_apps_env.id' ${STATE_FILE})
SHARED_KV_URI=$(yq '.resources.shared_key_vault.uri' ${STATE_FILE})

# 預期 spec 摘要（先印出供 review）
cat <<EOF
Container App Spec Preview:
  name:               ${CA_NAME}
  resource_group:     ${RG_NAME}
  environment:        ${CAE_NAME}
  image:              ${ACR_LOGIN_SERVER}/${IMAGE_REPO}:${IMAGE_TAG}
  ingress:            external (HTTPS only) target=3000
  resources:          cpu=0.5 vcpu / memory=1.0Gi
  replicas:           min=1 (working hours) / max=5
  registry_auth:      managed-identity (system-assigned)
  health_probe_path:  /api/health
EOF
```

**Verify**：
```bash
# 檢查 image tag 真的存在於 ACR
az acr repository show-tags \
  --name ${ACR_NAME} \
  --repository ${IMAGE_REPO} \
  --query "[?@=='${IMAGE_TAG}']" -o tsv
```

**Expected Output**: 印出 `${IMAGE_TAG}`（即 image 存在）

**If Fails**：
- 找不到 tag → 回到 STEP-04 重新 build / push image
- 找不到 ACR_LOGIN_SERVER → state file 損壞，從 STEP-02 outputs 重新填入

---

## 📋 Action 8.2: 配置 Key Vault Secret References

> **目的**：列出所有從 STEP-03 注入的 secrets，並對應 env vars 名稱

### Secret Mapping 清單

| KV Secret 名稱 | Env Var 名稱 | 用途 | Source STEP |
|---------------|-------------|------|------------|
| `database-url` | `DATABASE_URL` | PostgreSQL connection string | STEP-03 |
| `auth-secret` | `AUTH_SECRET` | NextAuth JWT 簽章 | STEP-03 |
| `encryption-key` | `ENCRYPTION_KEY` | 應用層欄位加密 | STEP-03（不可變更）|
| `azure-storage-connection-string` | `AZURE_STORAGE_CONNECTION_STRING` | Blob 上傳 | STEP-03 |
| `azure-openai-key` | `AZURE_OPENAI_API_KEY` | GPT-5.2 呼叫 | STEP-03 |
| `azure-openai-endpoint` | `AZURE_OPENAI_ENDPOINT` | OpenAI endpoint URL | STEP-03 |
| `document-intelligence-key` | `DOCUMENT_INTELLIGENCE_KEY` | OCR 服務 key | STEP-03 |
| `document-intelligence-endpoint` | `DOCUMENT_INTELLIGENCE_ENDPOINT` | OCR endpoint | STEP-03 |
| `app-insights-connection-string` | `APPLICATIONINSIGHTS_CONNECTION_STRING` | Telemetry | STEP-03 |

### Command

```bash
# 取得每個 secret 的最新 versionless URI
KV_URI_BASE="${SHARED_KV_URI}"  # e.g. https://kv-shared-uat.vault.azure.net

# 構造 --secrets 參數（Container App 內部 secret 名稱 → KV reference）
SECRETS_FLAG=$(cat <<EOF
database-url=keyvaultref:${KV_URI_BASE}/secrets/database-url,identityref:system
auth-secret=keyvaultref:${KV_URI_BASE}/secrets/auth-secret,identityref:system
encryption-key=keyvaultref:${KV_URI_BASE}/secrets/encryption-key,identityref:system
azure-storage-connection-string=keyvaultref:${KV_URI_BASE}/secrets/azure-storage-connection-string,identityref:system
azure-openai-key=keyvaultref:${KV_URI_BASE}/secrets/azure-openai-key,identityref:system
azure-openai-endpoint=keyvaultref:${KV_URI_BASE}/secrets/azure-openai-endpoint,identityref:system
document-intelligence-key=keyvaultref:${KV_URI_BASE}/secrets/document-intelligence-key,identityref:system
document-intelligence-endpoint=keyvaultref:${KV_URI_BASE}/secrets/document-intelligence-endpoint,identityref:system
app-insights-connection-string=keyvaultref:${KV_URI_BASE}/secrets/app-insights-connection-string,identityref:system
EOF
)

# Env vars 引用上述 secrets（用 secretref:）
ENV_VARS_FLAG=$(cat <<EOF
DATABASE_URL=secretref:database-url
AUTH_SECRET=secretref:auth-secret
ENCRYPTION_KEY=secretref:encryption-key
AZURE_STORAGE_CONNECTION_STRING=secretref:azure-storage-connection-string
AZURE_OPENAI_API_KEY=secretref:azure-openai-key
AZURE_OPENAI_ENDPOINT=secretref:azure-openai-endpoint
DOCUMENT_INTELLIGENCE_KEY=secretref:document-intelligence-key
DOCUMENT_INTELLIGENCE_ENDPOINT=secretref:document-intelligence-endpoint
APPLICATIONINSIGHTS_CONNECTION_STRING=secretref:app-insights-connection-string
NODE_ENV=production
AUTH_TRUST_HOST=false
SYSTEM_USER_ID=system-user-prod
EOF
)
```

**Verify**：每個 KV secret 確實存在
```bash
for SECRET in database-url auth-secret encryption-key azure-storage-connection-string \
              azure-openai-key azure-openai-endpoint \
              document-intelligence-key document-intelligence-endpoint \
              app-insights-connection-string; do
  az keyvault secret show --vault-name ${KV_NAME} --name ${SECRET} --query "name" -o tsv \
    || echo "MISSING: ${SECRET}"
done
```

**Expected Output**：每行印出 secret 名稱，無 `MISSING:` 行

**If Fails**：
- `MISSING: <name>` → 回到 STEP-03 補注入該 secret
- `forbidden` → Managed Identity 尚未建立或未授予 Key Vault Secret User（先做 Action 8.3）

---

## 📋 Action 8.3: 配置 Managed Identity 與 RBAC

> **目的**：啟用 System-Assigned MI 並授予三個必要角色（ACR Pull / KV Secret User / Storage Blob Data Contributor）

### Step 1: 建立 Container App 殼（含 system-assigned MI）

> **註**：此步驟先建空殼好取得 MI principal ID，正式 image / config 在 Action 8.5 一次套上。

```bash
# 建立最小殼（暫時用 hello-world image，稍後在 Action 8.5 update）
az containerapp create \
  --name ${CA_NAME} \
  --resource-group ${RG_NAME} \
  --environment ${CAE_NAME} \
  --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
  --system-assigned \
  --min-replicas 0 \
  --max-replicas 1 \
  --output json
```

### Step 2: 取得 Managed Identity Principal ID

```bash
PRINCIPAL_ID=$(az containerapp identity show \
  --name ${CA_NAME} \
  --resource-group ${RG_NAME} \
  --query "principalId" -o tsv)

echo "MI Principal ID: ${PRINCIPAL_ID}"
```

### Step 3: 授予 ACR Pull 角色

```bash
ACR_ID=$(az acr show --name ${ACR_NAME} --query "id" -o tsv)

az role assignment create \
  --role "AcrPull" \
  --assignee ${PRINCIPAL_ID} \
  --scope ${ACR_ID}
```

### Step 4: 授予 Key Vault Secret User 角色

```bash
KV_ID=$(az keyvault show --name ${KV_NAME} --query "id" -o tsv)

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee ${PRINCIPAL_ID} \
  --scope ${KV_ID}
```

### Step 5: 授予 Storage Blob Data Contributor 角色

```bash
STORAGE_ID=$(az storage account show \
  --name ${STORAGE_NAME} --resource-group ${RG_NAME} \
  --query "id" -o tsv)

az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee ${PRINCIPAL_ID} \
  --scope ${STORAGE_ID}
```

**Verify**：列出 MI 上的所有 role assignment
```bash
az role assignment list \
  --assignee ${PRINCIPAL_ID} \
  --query "[].{role:roleDefinitionName,scope:scope}" \
  -o table
```

**Expected Output**：應看到三筆 role assignment
```
Role                              Scope
--------------------------------  -------------------------------------
AcrPull                           /subscriptions/.../registries/acraidocextractuat
Key Vault Secrets User            /subscriptions/.../vaults/kv-shared-uat
Storage Blob Data Contributor     /subscriptions/.../storageAccounts/staidocextractuat
```

**If Fails**：
- `forbidden` → 當前執行帳號需要 `User Access Administrator` 或 `Owner` 才能建立 role assignment；升級給人類
- `principal not found` → MI propagation 延遲；等待 30-60 秒後重試

---

## 📋 Action 8.4: 配置 Scale Rules

> **目的**：設定 HTTP scale rule（concurrent requests = 50 per replica）

### HTTP Concurrent Requests Scale Rule

```bash
az containerapp update \
  --name ${CA_NAME} \
  --resource-group ${RG_NAME} \
  --min-replicas 1 \
  --max-replicas 5 \
  --scale-rule-name http-concurrent-requests \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50
```

**參數說明**：
- `min-replicas=1`：工作時段保持 warm，避免 cold start
- `max-replicas=5`：上限對齊 Pilot 規模（100-200 張/週 / 50-100 張/週測試）
- `concurrency=50`：每 replica 同時處理 50 個 HTTP request 才觸發擴容

### Optional: KEDA Cron Scheduled Scaling（建議離峰縮容）

> 此為 optional — 若 UAT 成本緊縮可加上夜間縮至 0

```bash
# 範例：週一至週五 09:00-19:00 GMT+8 維持 min=1，其餘時段 min=0
az containerapp update \
  --name ${CA_NAME} \
  --resource-group ${RG_NAME} \
  --scale-rule-name cron-scale-down \
  --scale-rule-type cron \
  --scale-rule-metadata \
      "timezone=Asia/Taipei" \
      "start=0 19 * * 1-5" \
      "end=0 9 * * 1-5" \
      "desiredReplicas=0"
```

**Verify**：
```bash
az containerapp show \
  --name ${CA_NAME} \
  --resource-group ${RG_NAME} \
  --query "properties.template.scale" -o json
```

**Expected Output**：
```json
{
  "minReplicas": 1,
  "maxReplicas": 5,
  "rules": [
    {
      "name": "http-concurrent-requests",
      "http": { "metadata": { "concurrentRequests": "50" } }
    }
  ]
}
```

**If Fails**：
- min > max → 修正參數
- scale rule 衝突（HTTP + Cron 同時存在但設定不一致） → 移除 cron rule 重設

---

## 📋 ⚠️ Action 8.5: APPROVAL GATE — Deploy First Revision

> **🔴 此為 Approval Gate — AI 必須暫停輸出 plan 並等待人類確認**

### AI Pre-Action Safety Check 輸出範例

```markdown
## ⚠️ 即將執行敏感操作

**Step**: STEP-08
**Action**: 8.5 Deploy first revision

即將部署 Container App: ca-aidocextract-uat
Image: ${ACR_LOGIN_SERVER}/${IMAGE_REPO}:${IMAGE_TAG}
Replicas: min=1 / max=5
Ingress: external (HTTPS only)
Target Port: 3000
Managed Identity: system-assigned (3 roles already granted)

**影響範圍**:
  - Container App 進入 user-reachable 狀態（首次業務影響）
  - revision 進入 active，承接所有 ingress 流量
**可逆性**: ✅（Layer 1 rollback — 切回 hello-world 殼或 previous revision）
**Approval 狀態**: requires_approval: true（等待 app-team-lead 確認）

是否確認部署？(yes/no)
```

> **獲得 `yes` 後才能執行下方命令。**

### Command（獲准後執行）

```bash
az containerapp update \
  --name ${CA_NAME} \
  --resource-group ${RG_NAME} \
  --image ${ACR_LOGIN_SERVER}/${IMAGE_REPO}:${IMAGE_TAG} \
  --cpu 0.5 --memory 1.0Gi \
  --ingress external \
  --target-port 3000 \
  --transport auto \
  --registry-server ${ACR_LOGIN_SERVER} \
  --registry-identity system \
  --secrets ${SECRETS_FLAG} \
  --env-vars ${ENV_VARS_FLAG} \
  --revision-suffix "first-$(date +%Y%m%d-%H%M%S)" \
  --output json
```

### Configure Health Probes（同 revision 內）

```bash
# Container Apps 透過 az containerapp ingress 設定 probes 較困難
# 推薦用 YAML 提交 probes（separate update）
cat > /tmp/probes.yaml <<EOF
properties:
  template:
    containers:
      - name: ${CA_NAME}
        probes:
          - type: Startup
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 30   # 最長容忍 150 秒啟動
          - type: Liveness
            httpGet:
              path: /api/health
              port: 3000
            periodSeconds: 30
            failureThreshold: 3
          - type: Readiness
            httpGet:
              path: /api/health
              port: 3000
            periodSeconds: 10
            failureThreshold: 3
EOF

az containerapp update \
  --name ${CA_NAME} \
  --resource-group ${RG_NAME} \
  --yaml /tmp/probes.yaml
```

**Expected Behavior**：命令返回後 revision 進入 `Provisioning` 狀態，預計 30-90 秒內進入 `Running`（含 image pull）

**If Fails**：
- **Image pull 失敗（ImagePullBackOff）** → ACR Pull role 缺失或 Managed Identity 未生效；重做 Action 8.3 並等 60 秒讓 RBAC propagate
- **Container 啟動失敗** → 檢查 env vars / secret references（Action 8.8 logs 診斷）
- **Quota exceeded** → Subscription Container Apps quota 滿，升級給 Infra Team
- **回傳 `OperationNotAllowed`** → CAE 仍在 provisioning，等 1-2 分鐘再試

---

## 📋 Action 8.6: Poll Revision 狀態

> **目的**：等待 revision 達到 `Provisioned + Running` 且至少 1 個 replica running

### Polling Shell Script

```bash
TIMEOUT=300       # 5 分鐘 timeout
INTERVAL=10       # 10 秒輪詢一次
ELAPSED=0

while [[ ${ELAPSED} -lt ${TIMEOUT} ]]; do
  REVISION_NAME=$(az containerapp revision list \
    --name ${CA_NAME} --resource-group ${RG_NAME} \
    --query "[?properties.active].name | [0]" -o tsv)

  if [[ -z "${REVISION_NAME}" ]]; then
    echo "[${ELAPSED}s] No active revision yet, waiting..."
    sleep ${INTERVAL}
    ELAPSED=$((ELAPSED + INTERVAL))
    continue
  fi

  PROVISIONING=$(az containerapp revision show \
    --name ${CA_NAME} --resource-group ${RG_NAME} --revision ${REVISION_NAME} \
    --query "properties.provisioningState" -o tsv)

  RUNNING_STATE=$(az containerapp revision show \
    --name ${CA_NAME} --resource-group ${RG_NAME} --revision ${REVISION_NAME} \
    --query "properties.runningState" -o tsv)

  REPLICAS=$(az containerapp revision show \
    --name ${CA_NAME} --resource-group ${RG_NAME} --revision ${REVISION_NAME} \
    --query "properties.replicas" -o tsv)

  echo "[${ELAPSED}s] revision=${REVISION_NAME} provisioning=${PROVISIONING} running=${RUNNING_STATE} replicas=${REPLICAS}"

  if [[ "${PROVISIONING}" == "Provisioned" && "${RUNNING_STATE}" == "Running" && ${REPLICAS} -ge 1 ]]; then
    echo "✅ Revision is healthy."
    break
  fi

  if [[ "${PROVISIONING}" == "Failed" || "${RUNNING_STATE}" == "Failed" ]]; then
    echo "❌ Revision failed. Dumping logs..."
    az containerapp logs show --name ${CA_NAME} --resource-group ${RG_NAME} --tail 100
    exit 1
  fi

  sleep ${INTERVAL}
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [[ ${ELAPSED} -ge ${TIMEOUT} ]]; then
  echo "❌ Timeout waiting for revision (>${TIMEOUT}s)"
  exit 2
fi
```

**Expected Output**：
```
[10s] revision=ca-aidocextract-uat--first-... provisioning=Provisioning running=Unknown replicas=0
[20s] revision=... provisioning=Provisioning running=Unknown replicas=0
[30s] revision=... provisioning=Provisioned running=Starting replicas=1
[40s] revision=... provisioning=Provisioned running=Running replicas=1
✅ Revision is healthy.
```

**If Fails**：
- Timeout（>5 min） → image 體積過大或 Next.js 啟動 hang，升級到 Action 8.8 看 logs
- `Failed` 狀態 → 立即進 Action 8.8 取得 error logs，分類為 L2/L3

---

## 📋 Action 8.7: 取得 FQDN 並驗證 Health Endpoint

> **目的**：取得 public FQDN 並驗證 `/api/health` 回應

### Get FQDN

```bash
FQDN=$(az containerapp show \
  --name ${CA_NAME} --resource-group ${RG_NAME} \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "Container App FQDN: https://${FQDN}"
```

### Verify Health Endpoint

```bash
# 等 10 秒讓 ingress route 完全 propagate
sleep 10

HTTP_STATUS=$(curl -fsSL -o /tmp/health.json -w "%{http_code}" \
  https://${FQDN}/api/health)

echo "HTTP Status: ${HTTP_STATUS}"
cat /tmp/health.json
```

**Expected Output**：
```
HTTP Status: 200
{"status":"healthy","db":"ok","blob":"ok","timestamp":"2026-05-13T11:35:42Z"}
```
（具體 schema 依應用實作為主，至少含 `"status":"healthy"` 或等價）

### Verify HTTPS Cert（managed cert auto-issued）

```bash
echo | openssl s_client -connect ${FQDN}:443 -servername ${FQDN} 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

**Expected Output**：
```
subject= CN = ca-aidocextract-uat.<random>.southeastasia.azurecontainerapps.io
issuer= ... (Microsoft / DigiCert)
notBefore=...
notAfter=...（至少 30 天後）
```

**If Fails**：
- `502 Bad Gateway` → ingress target port 設錯（應為 3000，對齊 Next.js 預設）
- `503 Service Unavailable` → replica 尚未 ready，重試 30 秒後再 curl
- `Connection refused` → ingress 未 enable external，回 Action 8.5 檢查 `--ingress external`
- `cert error` → managed cert 配置中（Container Apps 自動 provision，可能需 1-2 分鐘）

---

## 📋 Action 8.8: 檢查 Container Logs（驗證無 Critical Error）

> **目的**：確認 Next.js / Prisma 啟動正常，無 ERROR / FATAL 訊息

### Get Recent Logs

```bash
az containerapp logs show \
  --name ${CA_NAME} --resource-group ${RG_NAME} \
  --follow false --tail 100 --output json > /tmp/ca-logs.json

# 解析並印出
jq -r '.[] | "\(.TimeStamp) [\(.Stream)] \(.Log)"' /tmp/ca-logs.json | head -50
```

### Filter ERROR / FATAL

```bash
jq -r '.[] | "\(.TimeStamp) [\(.Stream)] \(.Log)"' /tmp/ca-logs.json \
  | grep -iE 'ERROR|FATAL|panic|unhandled' \
  | head -20
```

**Expected Output（成功）**：
- 沒有 ERROR / FATAL 行
- 應看到類似：
  ```
  ▲ Next.js 15.0.0
  - Local: http://localhost:3000
  ✓ Ready in 4.2s
  Prisma Client connected to database (latency: 12ms)
  ```

**Expected Output（失敗範例 — 需排查）**：
```
ERROR: Error: P1001 Can't reach database server at psql-aidocextract-uat...
FATAL: ENCRYPTION_KEY is not defined
```

**If Fails**：
- `P1001 Can't reach database` → Postgres firewall 規則未允許 Container Apps subnet IP；回 STEP-02 補設定
- `ENCRYPTION_KEY is not defined` → secret reference 名稱錯誤；檢查 Action 8.2 的 mapping 表
- `KeyVault secret not found` → secret 名稱大小寫不符；KV secret 名一律 lowercase
- `Module not found` → image build 階段缺少 dependency；回 STEP-04 重 build

---

## 📋 Action 8.9: 寫入 State File

> **目的**：原子性寫入 outputs 至 deployment state file

```bash
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REVISION_NAME=$(az containerapp revision list \
  --name ${CA_NAME} --resource-group ${RG_NAME} \
  --query "[?properties.active].name | [0]" -o tsv)

REPLICAS=$(az containerapp revision show \
  --name ${CA_NAME} --resource-group ${RG_NAME} --revision ${REVISION_NAME} \
  --query "properties.replicas" -o tsv)

# 原子性更新（用 yq）
yq -i ".resources.container_app.name = \"${CA_NAME}\"" ${STATE_FILE}
yq -i ".resources.container_app.fqdn = \"${FQDN}\"" ${STATE_FILE}
yq -i ".resources.container_app.revision_active = \"${REVISION_NAME}\"" ${STATE_FILE}
yq -i ".resources.container_app.revision_status = \"Running\"" ${STATE_FILE}
yq -i ".resources.container_app.replicas_running = ${REPLICAS}" ${STATE_FILE}

yq -i ".steps_completed += [{
  \"step_id\": \"STEP-08\",
  \"completed_at\": \"${TIMESTAMP}\",
  \"status\": \"success\"
}]" ${STATE_FILE}

yq -i ".next_step = \"STEP-09\"" ${STATE_FILE}
yq -i ".metadata.last_updated = \"${TIMESTAMP}\"" ${STATE_FILE}
```

**Verify**：
```bash
yq '.resources.container_app' ${STATE_FILE}
yq '.next_step' ${STATE_FILE}
```

**Expected Output**：
```yaml
name: ca-aidocextract-uat
fqdn: ca-aidocextract-uat.<random>.southeastasia.azurecontainerapps.io
revision_active: ca-aidocextract-uat--first-20260513-113500
revision_status: Running
replicas_running: 1
```
```
"STEP-09"
```

**If Fails**：
- `yq: command not found` → 安裝 `yq`（v4+，YAML-aware）
- YAML structure 損壞 → 從 git 取回 state file 範本，重新填入

---

## 🚨 If Fails 速查表（跨 Action 共用）

| 症狀 | 可能原因 | 補救 |
|------|---------|------|
| **Image pull 失敗（ImagePullBackOff）** | ACR Pull role 缺失 / MI propagation 延遲 | 重做 Action 8.3 + 等 60 秒；確認 `--registry-identity system` |
| **Container 啟動失敗（CrashLoopBackOff）** | env vars / secret references 錯誤 | Action 8.8 dump logs；對照 Action 8.2 mapping 表 |
| **Health endpoint 不回應** | Next.js 啟動 timeout / port mismatch | 檢查 startup probe `failureThreshold`；確認 target port = 3000 |
| **502 Bad Gateway** | Ingress target port 設定錯誤 | `az containerapp ingress show` 確認 targetPort=3000 |
| **503 Service Unavailable** | Replica 尚未 ready | 等 30-60 秒；檢查 readiness probe |
| **HTTPS cert error** | Managed cert provisioning 中 | 等 1-2 分鐘；用 `openssl s_client` 驗證 |
| **`forbidden` on KV** | KV Secret User role 缺失 | 重做 Action 8.3 Step 4 |
| **`P1001` DB unreachable** | Postgres firewall 未開 / private endpoint 未綁 | 回 STEP-02 檢查 DB 網路設定 |

---

## ✅ Exit Criteria

完成 STEP-08 必須滿足以下全部：

- [ ] Container App `${CA_NAME}` 存在且 ingress = external
- [ ] System-Assigned Managed Identity 啟用，三個角色（AcrPull / KV Secret User / Storage Blob Data Contributor）已授予
- [ ] First revision provisioning state = `Provisioned`
- [ ] First revision running state = `Running`
- [ ] Replicas running ≥ 1
- [ ] FQDN 可 HTTPS 存取（managed cert 有效）
- [ ] `/api/health` 回應 200 OK 且 body 含 `"status":"healthy"`
- [ ] Container logs 無 ERROR / FATAL 訊息
- [ ] State file 已寫入 `resources.container_app.*` 與 `next_step: STEP-09`
- [ ] `app-team-lead` 已在 Action 8.5 給予 approval（記錄於 commit / state file）

→ 進入 **`09-verification.md`** 執行完整 smoke test。

---

*文件版本: v1.0（階段 C 完成）*
*最後更新: 2026-04-27*
*維護者: AI 助手 + 開發團隊*
