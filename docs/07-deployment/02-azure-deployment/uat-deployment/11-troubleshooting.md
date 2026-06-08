---
document_type: deployment_procedure
step_id: STEP-11
title: 常見問題排解（Troubleshooting）
estimated_duration: variable
requires_approval: false
approver: none
environment: uat
status: ✅ 完整內容（v0.3 階段 C）
prerequisites:
  - 此文件不依賴順序，可隨時參考
outputs:
  - issue_diagnosis: <category + resolution>
---

# STEP-11: 常見問題排解（Troubleshooting）

## 🎯 Objective

提供常見部署問題的診斷流程與解法，適用於 STEP-02 ~ STEP-09 任何階段失敗。

## 📖 使用方式

- **此文件不依賴順序**：是 STEP-02 ~ STEP-09 任何階段失敗時的查詢工具
- **按錯誤訊息或現象**在 A-F 分類查找
- **找不到對應分類時**：寫入 state file `failures` 區段 + 升級給人類（見 §10）
- **每個問題提供**：症狀 / 診斷命令 / 解法 / 預防（如適用）

---

## A. Azure 資源建立失敗

### A.1: AuthorizationFailed — RBAC 權限不足

**症狀**：
```
The client 'xxx@xxx.com' with object id 'xxx' does not have authorization
to perform action 'Microsoft.X/Y/write' over scope '/subscriptions/.../resourceGroups/...'
```

**診斷**：
```bash
# 檢查當前用戶在 RG 上的角色
az role assignment list \
  --assignee $(az account show --query user.name -o tsv) \
  --scope /subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG_NAME} \
  --output table
```

**解法**：聯繫 Infra Admin 在目標 RG 加入 `Contributor` role
**預防**：STEP-01 Action 1.2 強制檢查 RBAC（部署前必過）

---

### A.2: LocationRestricted — Region 不允許建立特定資源

**症狀**：
```
The location 'X' is not available for resource type 'Y'
```

**診斷**：
```bash
# 查詢該資源類型支援的 location
az provider show --namespace Microsoft.X \
  --query "resourceTypes[?resourceType=='Y'].locations" -o tsv
```

**解法**：切換到支援的 region（UAT 預設 `southeastasia`，若該服務不支援則改 `eastasia`）
**預防**：在 STEP-02 計畫階段先 dry-run 驗證每個資源 location

---

### A.3: QuotaExceeded — Subscription quota 不足

**症狀**：
```
Operation could not be completed as it results in exceeding approved
standardEvFamily quota / vCPU quota / public IP quota
```

**診斷**：
```bash
# vCPU quota（VM 系列）
az vm list-usage --location ${LOCATION} --output table | grep -i quota

# Container Apps 環境配額
az containerapp env list --query "length(@)"
```

**解法**：提交 quota increase request 給 Microsoft（**1-2 工作天**），無法即時解決
**預防**：STEP-01 prerequisites 預估資源用量

---

### A.4: ResourceGroupNotFound — RG 命名錯誤

**症狀**：`Resource group 'X' could not be found.`

**診斷**：
```bash
az group list --query "[?contains(name, 'aidocextract')].name" -o tsv
```

**解法**：
1. 確認 `RG_NAME` 拼字無誤（注意 `-uat` suffix）
2. 確認 Infra Team 已建立 RG（見 STEP-01 handoff checklist）

---

### A.5: NameAlreadyExists — global unique 名稱衝突

**適用**：ACR / Storage Account（global unique namespace）

**症狀**：
```
The name 'acraidocextractuat' is already taken / already exists
```

**解法**：加 random suffix（4-6 chars hex），例如 `acraidocextractuat3f7a`
**預防**：STEP-01 Action 1.4 預先 `az acr check-name` 驗證可用性

---

## B. Container 相關

### B.1: Image pull failed — ACR 拉取失敗

**症狀**：Container revision stuck in `Pulling` 或 `Failed`

**診斷**：
```bash
# 系統日誌（image pull error 會出現於此）
az containerapp logs show --name ${CA_NAME} --resource-group ${RG_NAME} \
  --type system --tail 50
```

**常見原因 + 解法**：
| 原因 | 解法 |
|------|------|
| ACR Pull role 缺失 | 給 Container App 的 Managed Identity grant `AcrPull` role on ACR |
| Image tag 不存在 | `az acr repository show-tags --name ${ACR_NAME} --repository ${IMAGE_REPO}` 確認 |
| Network 路徑問題（Private Endpoint） | 升級 Infra Team 檢查 Private DNS / NSG |

---

### B.2: Container 啟動失敗（CrashLoopBackOff 等價）

**症狀**：Replica 反覆重啟（restart count 持續上升）

**診斷**：
```bash
# 應用日誌（最近 200 行）
az containerapp logs show --name ${CA_NAME} --resource-group ${RG_NAME} \
  --follow false --tail 200
```

**常見原因 + 解法**：
| 原因 | 解法 |
|------|------|
| `DATABASE_URL` 拼字錯誤 / 無法連線 | 對照 D.1 |
| Key Vault secret reference 失敗 | 對照 C.1 / C.2 |
| Prisma client 未生成 | 確認 Dockerfile 含 `RUN npx prisma generate` |
| Migration 未執行 | 對照 D.2 |

---

### B.3: Container 啟動慢（>2 分鐘）

**預期啟動時間**：30-60 秒（Next.js standalone build）

**若 >2 分鐘**：
1. 確認 `next.config.ts` 設定 `output: 'standalone'`
2. 確認 Dockerfile 使用 `node server.js` 而非 `npm start`
3. 確認 Prisma client 已包進 image（`COPY --from=builder /app/node_modules/.prisma`）
4. 檢查 cold start：CAE 縮放至 0 時首次喚醒會慢

---

### B.4: Memory / CPU 不足

**症狀**：
- `OOMKilled`（exit code 137）→ 記憶體不足
- CPU 持續 100% → vCPU 不足

**解法**：
```bash
# 升級 SKU（UAT 預設 0.5 CPU / 1Gi）
az containerapp update --name ${CA_NAME} --resource-group ${RG_NAME} \
  --cpu 1.0 --memory 2Gi

# 或增加 replicas
az containerapp update --name ${CA_NAME} --resource-group ${RG_NAME} \
  --min-replicas 1 --max-replicas 3
```

---

### B.5: Health check 失敗

**症狀**：Liveness / Readiness probe 標記不健康，replica 被殺

**檢查點**：
- `/api/health` endpoint 必須在 1 秒內回應
- Health endpoint **不應依賴 DB**（DB 慢會連帶 health timeout）

**解法**：
```typescript
// 分離 health endpoint
// /api/health → 純 process liveness
// /api/health/ready → 含 DB connectivity check（用於 readiness）
```

---

### B.6: HTTPS 憑證錯誤

**症狀**：瀏覽器顯示 cert error / `NET::ERR_CERT_INVALID`

**情境**：
- **預設 FQDN**（`*.<random>.<region>.azurecontainerapps.io`）：Container Apps 提供 managed cert，不應出問題
- **自訂域名**：需要 DNS verification + cert binding

**解法（自訂域名）**：
```bash
# 1. 加自訂域名（先驗證 DNS TXT record）
az containerapp hostname add --name ${CA_NAME} --resource-group ${RG_NAME} \
  --hostname uat.example.com

# 2. Bind managed cert
az containerapp hostname bind --name ${CA_NAME} --resource-group ${RG_NAME} \
  --hostname uat.example.com --validation-method CNAME
```

---

## C. Key Vault / Secrets

### C.1: Managed Identity 無法讀取 secret

**症狀**：Container 日誌出現 `Forbidden` / `Access denied to Key Vault`

**診斷**：
```bash
# 確認 KV 存在且未被刪除
az keyvault list-deleted --query "[?name=='${KV_NAME}']"

# 確認 access policy 或 RBAC
az keyvault show --name ${KV_NAME} --query "properties.accessPolicies"
```

**解法**：grant `Key Vault Secrets User` role 給 Container App's Managed Identity
```bash
PRINCIPAL_ID=$(az containerapp identity show --name ${CA_NAME} \
  --resource-group ${RG_NAME} --query principalId -o tsv)

az role assignment create --assignee ${PRINCIPAL_ID} \
  --role "Key Vault Secrets User" \
  --scope $(az keyvault show --name ${KV_NAME} --query id -o tsv)
```

---

### C.2: Secret reference 格式錯誤

**正確格式**（兩種擇一）：
```
# Container Apps Secrets reference（推薦）
secretref:my-secret-name

# Key Vault direct reference
@Microsoft.KeyVault(SecretUri=https://kv-name.vault.azure.net/secrets/name)
```

**注意事項**：
- 大小寫敏感
- KV URI 結尾不要 trailing slash
- 不要包含 secret version（讓它取 latest）

---

### C.3: Secret value 在 Container 中為空

**診斷**（**只看 name，絕不看 value**）：
```bash
az containerapp show --name ${CA_NAME} --resource-group ${RG_NAME} \
  --query "properties.template.containers[0].env[].name"
```

**常見原因**：
- env var 名稱大小寫錯誤（`DATABASE_URL` vs `database_url`）
- secretref 指向不存在的 secret
- KV 中 secret 未啟用（`enabled: false`）

---

### C.4: ENCRYPTION_KEY 變更後加密資料無法解密 🔴 Critical

**事件等級**：L4 Critical（見 99-ai-execution-guide §3.1）

**症狀**：
- 應用啟動正常
- 讀取既有加密欄位（如 user passwords / API keys）時拋錯
- 新建資料正常

**解法**：
1. **立即停止任何寫入操作**（避免新舊 key 混用）
2. 還原 KV secret 到舊 version：
   ```bash
   az keyvault secret list-versions --vault-name ${KV_NAME} --name encryption-key
   az keyvault secret set-attributes --vault-name ${KV_NAME} \
     --name encryption-key --version <old-version> --enabled true
   ```
3. 重啟 Container App（強制 re-fetch secret）
4. 通知 app-team-lead，記錄為 critical incident

**預防**：`ENCRYPTION_KEY` 一經設定**永不變更**（見 99-ai-execution-guide §4.2）

---

## D. Database

### D.1: Connection failed

**症狀**：`P1001: Can't reach database server` / `connection refused`

**檢查清單**：
| 項目 | 命令 |
|------|------|
| 防火牆規則 | `az postgres flexible-server firewall-rule list -g ${RG_NAME} -n ${POSTGRES_NAME}` |
| Private DNS（若 Private Endpoint） | 升級 Infra Team 檢查 `privatelink.postgres.database.azure.com` |
| `DATABASE_URL` 含 `sslmode=require` | grep .env / KV secret |
| Server 狀態 | `az postgres flexible-server show ... --query state` 應為 `Ready` |

---

### D.2: Migration failed 🔴 Critical

**症狀**：`P1001` / `P1014` / `Migration failed to apply`

**事件等級**：L4 Critical（**不可 retry**，避免半套用狀態）

**解法**：
1. **立即停止**任何進一步 migration 嘗試
2. 查 `_prisma_migrations` 表狀態：
   ```sql
   SELECT migration_name, finished_at, logs
   FROM _prisma_migrations
   WHERE finished_at IS NULL;
   ```
3. 還原 DB backup（PITR）：見 STEP-10 Layer 3 rollback
4. 通知 app-team-lead

---

### D.3: Seed failed — FK / Unique violation

**Essential seed FK violation**：
- 原因：seed 順序錯（必須 roles → regions → cities → users）
- 解法：重跑 `seed-essential.ts`（idempotent，安全）

**Reference seed unique violation**：
- 原因：`reference_seed_executed` flag 未設，重複執行
- 解法：
  ```bash
  # 確認 state file flag
  yq '.flags.reference_seed_executed' ${STATE_FILE}
  # 若為 true 但仍重跑 → 文件 bug，回報
  ```

---

### D.4: Slow query

**診斷**：
```sql
-- 找出慢 query
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

-- 確認是否缺索引
EXPLAIN ANALYZE <slow query>;
```

**常見原因**：
- 缺索引（高頻查詢欄位）
- pgvector 索引未建（V3 embedding 啟用時）：`CREATE INDEX ON ... USING ivfflat`

---

### D.5: 加密欄位讀取錯誤

對照 **C.4**（ENCRYPTION_KEY mismatch）

---

## E. Network

> **大部分 Network 問題由 Infra Team 處理**。應用層只能驗證連線並提供錯誤訊息給 Infra Team。

### E.1: Container 無法連到 DB / KV / Storage

**App Team 可做**：
```bash
# 從 Container 內 curl 測試連線
az containerapp exec --name ${CA_NAME} --resource-group ${RG_NAME} \
  --command "curl -v https://${KV_NAME}.vault.azure.net/"
```

**升級給 Infra Team 並提供**：
- Container App 的 outbound IP
- 目標資源 FQDN
- 錯誤訊息（含 timeout / refused / DNS resolution failure）

---

### E.2: External user 無法連到 Container App

**檢查清單**：
| 項目 | 驗證 |
|------|------|
| FQDN 可解析 | `nslookup ${CA_NAME}.<region>.azurecontainerapps.io` |
| HTTPS 可達 | `curl -I https://${CA_FQDN}/api/health` |
| Ingress 設為 external | `az containerapp show --query "properties.configuration.ingress.external"` |
| IP allowlist（若有） | 檢查 ingress restriction rules |

---

### E.3: SharePoint / Outlook integration 失敗

**檢查清單**：
- Microsoft Graph API token 取得：`tenant-id` / `client-id` / `client-secret` 是否正確
- Admin consent 是否已授權（必要 scopes：`Mail.Read`、`Files.Read.All`）
- Conditional Access 是否阻擋（service principal 需排除）

---

### E.4: SMTP 連線失敗

**檢查**：
- Port 587（STARTTLS）/ 465（SSL）是否被 NSG outbound rule 擋
- SMTP server credentials 正確性
- DKIM / SPF record 配置（避免被收件方拒收）

---

## F. Application

### F.1: Login 失敗（Azure AD SSO）

**檢查清單**：
- App Registration 中 redirect URI 必須包含：
  ```
  https://${CA_FQDN}/api/auth/callback/azure-ad
  ```
- env vars `AUTH_TRUST_HOST=false` + `AUTH_URL=https://${CA_FQDN}`
- `AZURE_AD_CLIENT_SECRET` 未過期（KV 中確認 expiration）

---

### F.2: Login 失敗（本地帳號）

**檢查**：
- `bcrypt` hash 格式：seed essential 的 admin user hash 是否正確
- Rate limit 鎖定（FIX-052 已修復 fallback 問題）：清除 in-memory map 或 Redis key

---

### F.3: 文件上傳失敗

**檢查**：
- Blob Storage Managed Identity permission：需 `Storage Blob Data Contributor`
- File size 限制：Container Apps payload size limit（預設 30MB，可調至 100MB）
- `AZURE_STORAGE_ACCOUNT_NAME` env var 正確

---

### F.4: OCR 失敗

**檢查**：
- `AZURE_DOCUMENT_INTELLIGENCE_KEY` / `_ENDPOINT` 正確
- DI 服務 quota 未耗盡（每分鐘 / 每天限制）
- DI service tier（F0 free tier 限制較嚴）

---

### F.5: Mapping 失敗

**檢查**：
- Tier 1 Universal Mapping 是否為空（reference seed 未執行 → STEP-07）
- Stage 1（公司）/ Stage 2（格式）/ Stage 3（欄位）任一失敗
- 查 Application Insights traces 找出失敗 stage

---

### F.6: 信心度路由錯誤

**對照 V3.1 規則**（confidence-v3-1.service.ts:112-119）：
- ≥ 90% → AUTO_APPROVE
- 70-89% → QUICK_REVIEW
- < 70% → FULL_REVIEW

> **注意**：CLAUDE.md 寫 95%/80% 為**過時資訊**，代碼實際為 90%/70%（見 MEMORY 記錄）

**智能降級**：新公司 → 強制 FULL_REVIEW；新格式 → 強制 QUICK_REVIEW；DEFAULT 配置來源 → 降一級

---

## 🚨 升級給人類的時機

依 `99-ai-execution-guide.md` §10，下列情境 AI 必須**立即停止 + 升級**：

1. **L3 / L4 失敗**（permission / critical）
2. **連續 retry 3 次仍失敗**（L1 transient）
3. **資料異常**（如 essential seed 後 `roles_count = 0`）
4. **安全風險**（secret 出現在 log、未授權訪問）
5. **業務影響不可逆**（DB rollback、KV purge、ENCRYPTION_KEY 變更）
6. **文件與實際不符**（命令在當前 Azure CLI 版本不支援）

升級格式見 `99-ai-execution-guide.md` §10。

---

## 📋 Error Message 對照表（Grep 友善）

| Error Pattern (regex) | 分類 | Sub-item |
|----------------------|------|---------|
| `AuthorizationFailed` | A | A.1 |
| `LocationRestricted` / `not available for resource type` | A | A.2 |
| `exceeding approved.*quota` | A | A.3 |
| `Resource group.*could not be found` | A | A.4 |
| `name.*is already taken` / `already exists` | A | A.5 |
| `ImagePullBackOff` / `Pulling.*Failed` | B | B.1 |
| `CrashLoopBackOff` / `restart count` | B | B.2 |
| `OOMKilled` / `exit code 137` | B | B.4 |
| `Forbidden.*KeyVault` / `Access denied to Key Vault` | C | C.1 |
| `secretref` / `@Microsoft.KeyVault.*invalid` | C | C.2 |
| `decryption failed` / `bad decrypt` | C | C.4 |
| `P1001.*reach database server` | D | D.1 |
| `P1014` / `Migration failed to apply` | D | D.2 |
| `unique constraint.*violated` / `foreign key.*violated`（seed） | D | D.3 |
| `redirect_uri.*mismatch` / `AADSTS50011` | F | F.1 |
| `bcrypt.*invalid` | F | F.2 |
| `Blob.*403` / `AuthorizationPermissionMismatch` | F | F.3 |

> **使用方式**：`grep -E "<pattern>"` 應用日誌找對應分類。若無 match → 記錄到 state file `failures` 並升級。

---

*文件版本: v1.0（階段 C 完成）*
*最後更新: 2026-04-27*
*維護者: AI 助手 + 開發團隊*
