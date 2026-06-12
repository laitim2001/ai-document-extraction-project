---
document_type: deployment_procedure
step_id: STEP-03
title: Secrets Configuration（Key Vault 注入）
estimated_duration: 30-45 minutes
requires_approval: true
approver: app-team-lead
environment: uat
status: ✅ 完整內容（v0.4 階段 C）
prerequisites:
  - STEP-02 completed
  - Key Vault 可存取（Managed Identity 已 grant Get/List secrets）
  - Container App 已建立但尚未注入 secrets
outputs:
  - secrets_count: 21
  - key_vault_secret_uris:
    - AUTH_SECRET: https://${KV_NAME}.vault.azure.net/secrets/auth-secret
    - JWT_SECRET: https://${KV_NAME}.vault.azure.net/secrets/jwt-secret
    - SESSION_SECRET: https://${KV_NAME}.vault.azure.net/secrets/session-secret
    - ENCRYPTION_KEY: https://${KV_NAME}.vault.azure.net/secrets/encryption-key
    - DATABASE_URL: https://${KV_NAME}.vault.azure.net/secrets/database-url
    - AZURE_OPENAI_API_KEY: https://${KV_NAME}.vault.azure.net/secrets/azure-openai-api-key
    - AZURE_OPENAI_ENDPOINT: https://${KV_NAME}.vault.azure.net/secrets/azure-openai-endpoint
    - AZURE_DI_KEY: https://${KV_NAME}.vault.azure.net/secrets/azure-di-key
    - AZURE_DI_ENDPOINT: https://${KV_NAME}.vault.azure.net/secrets/azure-di-endpoint
    - UPSTASH_REDIS_REST_URL: https://${KV_NAME}.vault.azure.net/secrets/upstash-redis-rest-url
    - UPSTASH_REDIS_REST_TOKEN: https://${KV_NAME}.vault.azure.net/secrets/upstash-redis-rest-token
    - MICROSOFT_GRAPH_CLIENT_ID: https://${KV_NAME}.vault.azure.net/secrets/microsoft-graph-client-id
    - MICROSOFT_GRAPH_CLIENT_SECRET: https://${KV_NAME}.vault.azure.net/secrets/microsoft-graph-client-secret
    - MICROSOFT_GRAPH_TENANT_ID: https://${KV_NAME}.vault.azure.net/secrets/microsoft-graph-tenant-id
    - SMTP_HOST: https://${KV_NAME}.vault.azure.net/secrets/smtp-host
    - SMTP_PORT: https://${KV_NAME}.vault.azure.net/secrets/smtp-port
    - SMTP_USER: https://${KV_NAME}.vault.azure.net/secrets/smtp-user
    - SMTP_PASSWORD: https://${KV_NAME}.vault.azure.net/secrets/smtp-password
  - encryption_key_set: true
  - encryption_key_immutable: true
---

# STEP-03: Secrets Configuration（Key Vault 注入）

## 🎯 Objective

將所有 production secrets 注入 Azure Key Vault，並透過 Managed Identity + secret reference 機制讓 Container App 安全存取。完成後 Container App 不會直接持有任何 secret 值，所有敏感資料皆由 Azure platform 動態注入到 runtime env vars。

---

## ⚠️ 關鍵警告（執行前必讀）

| 警告 | 說明 |
|------|------|
| 🔴 **絕不從 dev 環境複製 secrets** | UAT/Prod 必須使用全新生成的 strong random，dev secrets 可能已外洩或共享給多人 |
| 🔴 **ENCRYPTION_KEY 不可變更** | 一旦設定後變更會讓既有加密資料（API keys、整合憑證）**永久無法解密**，等同業務災難 |
| 🔴 **禁止 query secret value** | 任何 verify 命令必須用 `--query "name"` 或 `--query "id"`，不可用 `--query "value"`（會印到終端 / log）|
| 🔴 **禁止把 secret value 寫入 state file** | `deployment-state/uat.yaml` 只記錄 secret URI，不可記錄值 |
| 🟡 **每個 secret 必須含 verify** | Action 後立即 verify 存在性，不假設成功 |

> 詳見 `99-ai-execution-guide.md` §4 敏感操作保護機制。

---

## 🔧 環境變數（基於 STEP-00 §5 增補）

```bash
# 已從 STEP-00 繼承：SUBSCRIPTION_ID / RG_NAME / KV_NAME / CA_NAME

# 本 STEP 額外需要
export STATE_FILE="${PROJECT_ROOT}/deployment-state/uat.yaml"
export POSTGRES_FQDN=$(yq '.resources.postgres.fqdn' ${STATE_FILE})
export MANAGED_IDENTITY_PRINCIPAL_ID=$(yq '.resources.managed_identity.principal_id' ${STATE_FILE})
```

---

## Action 3.1: 產生 Strong Secrets（本機一次性）

### 用途
為 4 個自定義 secrets（AUTH_SECRET / JWT_SECRET / SESSION_SECRET / ENCRYPTION_KEY）產生密碼學強度的隨機值。**必須在執行者本機產生**，不可從 dev 環境複製。

### Command
```bash
# 在執行者本機 shell 產生（不要記錄到任何檔案）
AUTH_SECRET_VALUE=$(openssl rand -base64 32)
JWT_SECRET_VALUE=$(openssl rand -base64 32)
SESSION_SECRET_VALUE=$(openssl rand -base64 32)
ENCRYPTION_KEY_VALUE=$(openssl rand -base64 32)

# 確認生成成功（只印長度，不印值）
for var in AUTH_SECRET_VALUE JWT_SECRET_VALUE SESSION_SECRET_VALUE ENCRYPTION_KEY_VALUE; do
  echo "${var} length: ${#!var}"
done
```

### Verify
```bash
# 預期每個值長度 = 44（base64 編碼 32 bytes 後的長度）
# 不可直接 echo 值
[[ ${#AUTH_SECRET_VALUE} -eq 44 ]] && echo "AUTH_SECRET OK" || echo "FAILED"
[[ ${#ENCRYPTION_KEY_VALUE} -eq 44 ]] && echo "ENCRYPTION_KEY OK" || echo "FAILED"
```

### Expected Output
```
AUTH_SECRET_VALUE length: 44
JWT_SECRET_VALUE length: 44
SESSION_SECRET_VALUE length: 44
ENCRYPTION_KEY_VALUE length: 44
AUTH_SECRET OK
ENCRYPTION_KEY OK
```

### If Fails
- `openssl: command not found` → 安裝 openssl（macOS：`brew install openssl`；Ubuntu：`apt install openssl`）
- 長度 ≠ 44 → 重新產生；確認 base64 編碼無誤
- ⚠️ 若不慎將 secret 值印到 terminal scrollback 或 shell history → 立即重新產生並清除 history

---

## Action 3.2: 注入 Secrets 到 Key Vault

### 用途
將所有 production secrets（含 Action 3.1 產生的 4 個 + 14 個外部服務憑證）寫入 Azure Key Vault。命名規範採 kebab-case，與 env var 名稱對應（`AUTH_SECRET` → `auth-secret`）。

### 3.2.1 自定義 Secrets（Action 3.1 產生）

```bash
# AUTH_SECRET — NextAuth/Auth.js v5 session 加密
az keyvault secret set --vault-name ${KV_NAME} \
  --name auth-secret --value "${AUTH_SECRET_VALUE}" --output none

# JWT_SECRET — JWT 簽章
az keyvault secret set --vault-name ${KV_NAME} \
  --name jwt-secret --value "${JWT_SECRET_VALUE}" --output none

# SESSION_SECRET — Session middleware
az keyvault secret set --vault-name ${KV_NAME} \
  --name session-secret --value "${SESSION_SECRET_VALUE}" --output none

# ENCRYPTION_KEY — 敏感資料加密（API keys / 整合憑證）⚠️ 不可變更
az keyvault secret set --vault-name ${KV_NAME} \
  --name encryption-key --value "${ENCRYPTION_KEY_VALUE}" --output none

# 立即清除本機變數（避免 shell history / scrollback 殘留）
unset AUTH_SECRET_VALUE JWT_SECRET_VALUE SESSION_SECRET_VALUE ENCRYPTION_KEY_VALUE
```

### 3.2.2 Database 連線

```bash
# DATABASE_URL — PostgreSQL Flexible Server
# 推薦：使用 Managed Identity 連線（無密碼，自動 token rotation）
# 連線字串格式：postgresql://<MI-name>@<server>:5432/<db>?sslmode=require
# Prisma 透過 Microsoft Entra token plugin 處理（需在 PostgreSQL 設定 MI 為 admin）
DATABASE_URL_VALUE="postgresql://${MANAGED_IDENTITY_NAME}@${POSTGRES_FQDN}:5432/ai_document_extraction?sslmode=require&schema=public"

az keyvault secret set --vault-name ${KV_NAME} \
  --name database-url --value "${DATABASE_URL_VALUE}" --output none

unset DATABASE_URL_VALUE
```

> **備註**：若 UAT 暫時採用 password-based auth（過渡期），DATABASE_URL 格式為
> `postgresql://<user>:<password>@<fqdn>:5432/<db>?sslmode=require`，並另存 `db-password` secret。
> 上 Prod 前必須切換到 Managed Identity（CHANGE-055 已記錄為 follow-up）。

### 3.2.3 Azure OpenAI（GPT-5.2）

```bash
az keyvault secret set --vault-name ${KV_NAME} \
  --name azure-openai-api-key --value "<paste-value>" --output none

az keyvault secret set --vault-name ${KV_NAME} \
  --name azure-openai-endpoint \
  --value "https://<your-resource>.cognitiveservices.azure.com/" --output none
```

### 3.2.4 Azure Document Intelligence

```bash
az keyvault secret set --vault-name ${KV_NAME} \
  --name azure-di-key --value "<paste-value>" --output none

az keyvault secret set --vault-name ${KV_NAME} \
  --name azure-di-endpoint \
  --value "https://<your-resource>.cognitiveservices.azure.com/" --output none
```

### 3.2.5 Upstash Redis（FIX-052 Rate Limit）

```bash
az keyvault secret set --vault-name ${KV_NAME} \
  --name upstash-redis-rest-url --value "<paste-url>" --output none

az keyvault secret set --vault-name ${KV_NAME} \
  --name upstash-redis-rest-token --value "<paste-token>" --output none
```

> **重要**：Upstash 缺少時 rate limit 會 fallback 為 in-memory Map（單實例有效）。UAT 建議啟用以模擬 Prod 行為。

### 3.2.6 Microsoft Graph（SharePoint / Outlook 整合）

```bash
az keyvault secret set --vault-name ${KV_NAME} \
  --name microsoft-graph-client-id --value "<paste-app-id>" --output none

az keyvault secret set --vault-name ${KV_NAME} \
  --name microsoft-graph-client-secret --value "<paste-secret>" --output none

az keyvault secret set --vault-name ${KV_NAME} \
  --name microsoft-graph-tenant-id --value "<paste-tenant-id>" --output none
```

### 3.2.7 SMTP（Email 通知）

```bash
az keyvault secret set --vault-name ${KV_NAME} \
  --name smtp-host --value "<smtp.example.com>" --output none

az keyvault secret set --vault-name ${KV_NAME} \
  --name smtp-port --value "587" --output none

az keyvault secret set --vault-name ${KV_NAME} \
  --name smtp-user --value "<paste-user>" --output none

az keyvault secret set --vault-name ${KV_NAME} \
  --name smtp-password --value "<paste-password>" --output none
```

### Verify（共 18 個 secret 名）
```bash
# 只 query 名稱，禁止 query value
EXPECTED_SECRETS=(
  auth-secret jwt-secret session-secret encryption-key
  database-url
  azure-openai-api-key azure-openai-endpoint
  azure-di-key azure-di-endpoint
  upstash-redis-rest-url upstash-redis-rest-token
  microsoft-graph-client-id microsoft-graph-client-secret microsoft-graph-tenant-id
  smtp-host smtp-port smtp-user smtp-password
)

for s in "${EXPECTED_SECRETS[@]}"; do
  NAME=$(az keyvault secret show --vault-name ${KV_NAME} --name ${s} --query "name" -o tsv 2>/dev/null)
  [[ "${NAME}" == "${s}" ]] && echo "✅ ${s}" || echo "❌ ${s} MISSING"
done
```

### Expected Output
```
✅ auth-secret
✅ jwt-secret
✅ session-secret
✅ encryption-key
✅ database-url
✅ azure-openai-api-key
... (18 個全 ✅)
```

### If Fails
- `Forbidden` / `does not have permission` → 確認執行者帳號有 KV `Set` 權限（不是 MI；MI 只需 `Get`/`List`）
- `Vault not found` → 確認 `${KV_NAME}` 與 STEP-02 outputs 一致
- 個別 secret 失敗 → 重跑該條 `az keyvault secret set`，secrets 為 idempotent（同名會建立新版本）

---

## Action 3.3: 配置 Container App Secret References

### 用途
將 Key Vault secrets 透過 `@Microsoft.KeyVault(SecretUri=...)` 語法注入 Container App，再 mapping 到 env vars。Container App 不會直接持有值，每次 revision 啟動由 platform 動態解析。

### Command

#### 3.3.1 配置 secret references（KV → Container App secrets）
```bash
KV_URI="https://${KV_NAME}.vault.azure.net"

az containerapp secret set \
  --name ${CA_NAME} --resource-group ${RG_NAME} \
  --secrets \
    "auth-secret=keyvaultref:${KV_URI}/secrets/auth-secret,identityref:system" \
    "jwt-secret=keyvaultref:${KV_URI}/secrets/jwt-secret,identityref:system" \
    "session-secret=keyvaultref:${KV_URI}/secrets/session-secret,identityref:system" \
    "encryption-key=keyvaultref:${KV_URI}/secrets/encryption-key,identityref:system" \
    "database-url=keyvaultref:${KV_URI}/secrets/database-url,identityref:system" \
    "azure-openai-api-key=keyvaultref:${KV_URI}/secrets/azure-openai-api-key,identityref:system" \
    "azure-openai-endpoint=keyvaultref:${KV_URI}/secrets/azure-openai-endpoint,identityref:system" \
    "azure-di-key=keyvaultref:${KV_URI}/secrets/azure-di-key,identityref:system" \
    "azure-di-endpoint=keyvaultref:${KV_URI}/secrets/azure-di-endpoint,identityref:system" \
    "upstash-redis-rest-url=keyvaultref:${KV_URI}/secrets/upstash-redis-rest-url,identityref:system" \
    "upstash-redis-rest-token=keyvaultref:${KV_URI}/secrets/upstash-redis-rest-token,identityref:system" \
    "microsoft-graph-client-id=keyvaultref:${KV_URI}/secrets/microsoft-graph-client-id,identityref:system" \
    "microsoft-graph-client-secret=keyvaultref:${KV_URI}/secrets/microsoft-graph-client-secret,identityref:system" \
    "microsoft-graph-tenant-id=keyvaultref:${KV_URI}/secrets/microsoft-graph-tenant-id,identityref:system" \
    "smtp-host=keyvaultref:${KV_URI}/secrets/smtp-host,identityref:system" \
    "smtp-port=keyvaultref:${KV_URI}/secrets/smtp-port,identityref:system" \
    "smtp-user=keyvaultref:${KV_URI}/secrets/smtp-user,identityref:system" \
    "smtp-password=keyvaultref:${KV_URI}/secrets/smtp-password,identityref:system"
```

#### 3.3.2 Mapping secrets → env vars（敏感）+ 設定非敏感 env vars
```bash
az containerapp update \
  --name ${CA_NAME} --resource-group ${RG_NAME} \
  --set-env-vars \
    "AUTH_SECRET=secretref:auth-secret" \
    "JWT_SECRET=secretref:jwt-secret" \
    "SESSION_SECRET=secretref:session-secret" \
    "ENCRYPTION_KEY=secretref:encryption-key" \
    "DATABASE_URL=secretref:database-url" \
    "AZURE_OPENAI_API_KEY=secretref:azure-openai-api-key" \
    "AZURE_OPENAI_ENDPOINT=secretref:azure-openai-endpoint" \
    "AZURE_DI_KEY=secretref:azure-di-key" \
    "AZURE_DI_ENDPOINT=secretref:azure-di-endpoint" \
    "UPSTASH_REDIS_REST_URL=secretref:upstash-redis-rest-url" \
    "UPSTASH_REDIS_REST_TOKEN=secretref:upstash-redis-rest-token" \
    "MICROSOFT_GRAPH_CLIENT_ID=secretref:microsoft-graph-client-id" \
    "MICROSOFT_GRAPH_CLIENT_SECRET=secretref:microsoft-graph-client-secret" \
    "MICROSOFT_GRAPH_TENANT_ID=secretref:microsoft-graph-tenant-id" \
    "SMTP_HOST=secretref:smtp-host" \
    "SMTP_PORT=secretref:smtp-port" \
    "SMTP_USER=secretref:smtp-user" \
    "SMTP_PASSWORD=secretref:smtp-password" \
    "NODE_ENV=production" \
    "AUTH_TRUST_HOST=false" \
    "SYSTEM_USER_ID=system-user-prod" \
    "NEXT_PUBLIC_APP_URL=https://${CA_FQDN}" \
    "AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5.2" \
    "AZURE_OPENAI_API_VERSION=2025-03-01-preview" \
    "AZURE_STORAGE_CONTAINER=documents" \
    "FEATURE_EXTRACTION_V3=true" \
    "FEATURE_EXTRACTION_V3_1=true" \
    "ENABLE_UNIFIED_PROCESSOR=true" \
    "JWT_EXPIRES_IN=7d" \
    "BCRYPT_SALT_ROUNDS=12" \
    "DEBUG_EXTRACTION_V3_PROMPT=false" \
    "DEBUG_EXTRACTION_V3_RESPONSE=false"
```

### 非敏感 env vars 清單（明文設定）

| Env Var | Value | 說明 |
|---------|-------|------|
| `NODE_ENV` | `production` | Next.js production mode |
| `AUTH_TRUST_HOST` | `false` | UAT 走 HTTPS（Container Apps 預設 TLS） |
| `SYSTEM_USER_ID` | `system-user-prod` | FIX-054 系統用戶 ID（非 dev 的 `system-user-1`） |
| `NEXT_PUBLIC_APP_URL` | `https://${CA_FQDN}` | UAT 公開 URL |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | `gpt-5.2` | 主模型 deployment 名 |
| `AZURE_STORAGE_CONTAINER` | `documents` | Blob 容器名 |
| `FEATURE_EXTRACTION_V3` / `_V3_1` | `true` | V3.1 三階段管線啟用 |
| `ENABLE_UNIFIED_PROCESSOR` | `true` | 11-step unified pipeline |

---

## Action 3.4: 驗證 Container App 能讀取 Secrets

### Command（只查名稱，禁止查值）
```bash
# 驗證 secret references 已配置
az containerapp show --name ${CA_NAME} --resource-group ${RG_NAME} \
  --query "properties.configuration.secrets[].name" -o tsv

# 驗證 env vars 名稱（不取 value）
az containerapp show --name ${CA_NAME} --resource-group ${RG_NAME} \
  --query "properties.template.containers[0].env[].name" -o tsv
```

### Expected Output

**Secrets**（應有 18 個 KV-backed）：
```
auth-secret
jwt-secret
session-secret
encryption-key
database-url
azure-openai-api-key
azure-openai-endpoint
azure-di-key
azure-di-endpoint
upstash-redis-rest-url
upstash-redis-rest-token
microsoft-graph-client-id
microsoft-graph-client-secret
microsoft-graph-tenant-id
smtp-host
smtp-port
smtp-user
smtp-password
```

**Env vars**（應有 18 敏感 + ~13 非敏感 = 31）：
```
AUTH_SECRET / JWT_SECRET / SESSION_SECRET / ENCRYPTION_KEY
DATABASE_URL
AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT
AZURE_DI_KEY / AZURE_DI_ENDPOINT
UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
MICROSOFT_GRAPH_CLIENT_ID / MICROSOFT_GRAPH_CLIENT_SECRET / MICROSOFT_GRAPH_TENANT_ID
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD
NODE_ENV / AUTH_TRUST_HOST / SYSTEM_USER_ID / NEXT_PUBLIC_APP_URL
AZURE_OPENAI_DEPLOYMENT_NAME / AZURE_OPENAI_API_VERSION / AZURE_STORAGE_CONTAINER
FEATURE_EXTRACTION_V3 / FEATURE_EXTRACTION_V3_1 / ENABLE_UNIFIED_PROCESSOR
JWT_EXPIRES_IN / BCRYPT_SALT_ROUNDS
DEBUG_EXTRACTION_V3_PROMPT / DEBUG_EXTRACTION_V3_RESPONSE
```

### If Fails
- env vars 缺漏 → 重跑 Action 3.3.2 對應的 `--set-env-vars`
- secret reference 顯示 `Failed to resolve` → 確認 Managed Identity 對 KV 有 `Get` secret 權限（STEP-02 Action 2.7）
- `identityref:system` 失敗 → 確認 Container App 已啟用 System-Assigned MI（`az containerapp identity show`）

> ⚠️ **絕對禁止** 用 `--query "env[].value"`、`exec` 進容器跑 `env`、或在 log 中印出 secret 值來「驗證」。

---

## Action 3.5: 文件化 ENCRYPTION_KEY 不可變更原則

### 用途
將 ENCRYPTION_KEY 設定狀態鎖定到 deployment state file，作為未來「請勿變更」的契約紀錄。任何後續 rotation 嘗試必須先讀此 flag 並評估資料遷移成本。

### Command
```bash
# 寫入 state file（只記 URI 與 flag，不記值）
yq -i ".resources.key_vault.uri = \"https://${KV_NAME}.vault.azure.net\"" ${STATE_FILE}
yq -i '.resources.key_vault.secrets_count = 18' ${STATE_FILE}

# 個別 secret URI（不含 value）
yq -i ".resources.key_vault.secret_uris.encryption_key = \"https://${KV_NAME}.vault.azure.net/secrets/encryption-key\"" ${STATE_FILE}
yq -i ".resources.key_vault.secret_uris.auth_secret = \"https://${KV_NAME}.vault.azure.net/secrets/auth-secret\"" ${STATE_FILE}
# ... 其餘 16 個 secret URIs

# Critical flag：encryption_key_set 一旦 true，後續 STEP 不可重新生成
yq -i '.flags.encryption_key_set = true' ${STATE_FILE}
yq -i '.flags.encryption_key_immutable = true' ${STATE_FILE}
yq -i '.flags.encryption_key_rotation_warning = "Rotation will permanently break decryption of existing data. Requires data migration plan + business approval."' ${STATE_FILE}

# 標記 STEP-03 完成
yq -i ".steps_completed += [{\"step_id\": \"STEP-03\", \"completed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"status\": \"success\"}]" ${STATE_FILE}
yq -i '.next_step = "STEP-04"' ${STATE_FILE}
```

### Verify
```bash
yq '.flags.encryption_key_set' ${STATE_FILE}            # 預期：true
yq '.flags.encryption_key_immutable' ${STATE_FILE}      # 預期：true
yq '.resources.key_vault.secrets_count' ${STATE_FILE}   # 預期：18
yq '.next_step' ${STATE_FILE}                           # 預期：STEP-04
```

### Expected Output
```
true
true
18
STEP-04
```

### If Fails
- `yq: command not found` → 安裝 yq（`brew install yq` / `apt install yq`，或使用 mikefarah/yq v4+）
- state file 結構壞損 → 從 git 還原或對照 STEP-00 §6.2 標準結構手動修復
- 重要：**絕不**在此處寫入任何 secret value，僅寫 URI 與 flag

---

## ⚠️ ENCRYPTION_KEY Rotation 警告（永久保留）

> **核心原則**：ENCRYPTION_KEY 設定後**禁止變更**。

| 影響範圍 | 後果 |
|----------|------|
| 既有 API keys / 整合憑證 | 無法解密 → 所有外部整合（Azure OpenAI / Graph / SMTP）失效 |
| 既有 mapping rules 加密欄位 | 無法解密 → 規則學習資料失效 |
| 文件處理歷史紀錄 | 部分加密欄位無法閱讀 |
| 業務影響 | UAT/Prod 需重新 setup 所有外部憑證 + 可能無法回溯歷史資料 |

**若真的必須 rotation**：
1. 必須由 app-team-lead + security-team 共同 approval
2. 必須有 data migration plan（用舊 key 解密 → 用新 key 重新加密）
3. 必須在維護視窗執行
4. 必須備份 KV（含舊版 secret）
5. 不在本部署文件涵蓋範圍 — 屬 incident-response runbook

---

## ✅ Exit Criteria

- [ ] Action 3.1: 4 個自定義 secrets 已用 `openssl rand -base64 32` 在本機產生
- [ ] Action 3.2: 18 個 secrets 已注入 Key Vault（verify 全部 ✅）
- [ ] Action 3.3: Container App secret references + env vars 已配置
- [ ] Action 3.4: `az containerapp show --query` 確認 18 個 secret refs + ~13 個明文 env vars
- [ ] Action 3.5: state file `flags.encryption_key_set = true` + 18 個 URIs（無 value）
- [ ] 無任何 secret value 寫入 terminal log / state file / shell history
- [ ] `next_step = STEP-04` 已更新

→ 進入 **`04-container-build-push.md`** 執行 Docker image build & push。

---

## 🤖 AI Execution Hint

執行本 STEP 時，AI 助手應：
1. **永遠不在 chat / log 印 secret 值** — 即使是 verify，也只查名稱
2. **Action 3.1 後立即 unset 變數** — 避免後續命令誤用
3. **Action 3.2 用 idempotent 方式** — 同名 secret 會建立新版本，不會破壞既有
4. **Action 3.5 寫 state 用 yq** — 不要 sed（YAML 結構脆弱）
5. **若用戶請求列出 secret 值 → 拒絕並引用本文件 §關鍵警告**

---

*文件版本: v1.0（階段 C 完成）*
*最後更新: 2026-04-27*
*維護者: AI 助手 + 開發團隊*
