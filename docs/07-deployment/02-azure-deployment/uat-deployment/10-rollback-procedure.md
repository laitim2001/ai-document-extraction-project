---
document_type: deployment_procedure
step_id: STEP-10
title: 回滾流程（Rollback Procedure）
estimated_duration: 15-30 minutes
requires_approval: true
approver: app-team-lead
environment: uat
status: ✅ 完整內容（階段 C）
prerequisites:
  - 至少有一個 previous Container Apps revision 存在
  - DB backup 可用（若需 data rollback）
outputs:
  - rollback_revision: <revision name reverted to>
  - rollback_reason: <text>
  - data_rolled_back: true|false
---

# STEP-10: 回滾流程（Rollback Procedure）

> **狀態**：✅ 完整內容（階段 C）
>
> **核心原則**：優先選擇最低破壞性的 rollback layer。Layer 3（DB rollback）會造成資料損失，必須有雙重 approval。

---

## 🎯 Objective

當部署後（或執行中）發現嚴重問題時，安全回滾到前一個已知良好狀態，並維持 ENCRYPTION_KEY 不變以保證加密資料可解密。

---

## 🔀 Decision Tree（流程選擇）

```
偵測問題（health check 失敗 / smoke test 失敗 / Pilot 用戶回報）
   │
   ▼
是否 Container 程式碼層 bug（無 schema/data 變更）？
   ├── Yes ──► Layer 1 Rollback（最快，0 data 影響）
   │
   ▼
是否需要回到舊 image（previous revision 已 deactivate / pruned）？
   ├── Yes ──► Layer 2 Rollback（重建舊 image revision）
   │
   ▼
是否 schema migration / seed 出錯且影響資料完整性？
   └── Yes ──► Layer 3 Rollback（破壞性，需 APPROVAL GATE）
```

> **AI 助手提示**：永遠先嘗試 Layer 1。若 Layer 1 不適用才考慮 Layer 2。Layer 3 必須先升級給人類，由 app-team-lead + Infra Admin 雙重確認。

---

## 🟢 Layer 1: Revision Rollback（最快，0 data 影響）

**適用場景**：新版本程式碼有 bug，但 schema / data 沒有變更，且 previous revision 仍 active。

### Action 10.1.1: 列出可用 revisions

```bash
# 取得 revision 列表 + 狀態
az containerapp revision list \
  --name ${CA_NAME} \
  --resource-group ${RG_NAME} \
  --query "[].{name:name, active:properties.active, status:properties.runningState, traffic:properties.trafficWeight, created:properties.createdTime}" \
  --output table
```

**Verify**：找到一個 `active=true` 但 `traffic=0`（或 traffic < 100）的 previous good revision；記錄其 `name`。

### Action 10.1.2: 切換流量到前一個 revision

```bash
# Single revision mode：將 100% 流量導向指定 revision
az containerapp revision set-mode \
  --name ${CA_NAME} \
  --resource-group ${RG_NAME} \
  --mode single \
  --revision <previous-revision-name>

# 等待 propagation（30-60 秒）
sleep 60
```

### Action 10.1.3: 驗證 health 與 active revision

```bash
# 取得 FQDN
FQDN=$(az containerapp show --name ${CA_NAME} --resource-group ${RG_NAME} --query "properties.configuration.ingress.fqdn" -o tsv)

# Health check
curl -fsSL "https://${FQDN}/api/health"

# 確認 active revision 為目標 revision
az containerapp show \
  --name ${CA_NAME} --resource-group ${RG_NAME} \
  --query "properties.latestReadyRevisionName" -o tsv
```

**Verify**：health endpoint 回傳 200；container logs 無 error；active revision name 與目標一致。

---

## 🟡 Layer 2: Image Rollback（重新部署舊 image）

**適用場景**：previous revision 已被 deactivate 或 prune（超出 revision retention），需要重建一個指向舊 image 的新 revision。

### Action 10.2.1: 識別舊 image tag

```bash
# 列出 ACR 中所有 image tags（按時間排序）
az acr repository show-tags \
  --name ${ACR_NAME} \
  --repository ${IMAGE_REPO} \
  --orderby time_desc \
  --output table

# 從 git log 對應 commit hash → tag
git log --oneline --max-count=20
```

**Verify**：選定的 `<old-tag>` 對應已知 stable 的 git commit。

### Action 10.2.2: 用舊 image 建立新 revision

```bash
# Update Container App image → 自動建立新 revision pointing to 舊 image
az containerapp update \
  --name ${CA_NAME} \
  --resource-group ${RG_NAME} \
  --image ${ACR_NAME}.azurecr.io/${IMAGE_REPO}:<old-tag>

# 等待新 revision Ready
sleep 90
```

### Action 10.2.3: 驗證新 revision

```bash
az containerapp revision list \
  --name ${CA_NAME} --resource-group ${RG_NAME} \
  --query "[?properties.active==\`true\`].{name:name, image:properties.template.containers[0].image, traffic:properties.trafficWeight}" \
  --output table

curl -fsSL "https://${FQDN}/api/health"
```

**Verify**：新 revision 帶有舊 image tag，traffic=100，health 200。

---

## 🔴 Layer 3: Database Rollback（破壞性 — APPROVAL GATE）

**適用場景**：schema migration 或 seed 出錯且影響資料完整性，無法用 Layer 1/2 解決。

### ⚠️ APPROVAL GATE（執行前必停）

```
即將執行 DB Rollback（Layer 3）
───────────────────────────────────────
✗ 資料損失：backup 之後的所有業務資料將遺失
✗ 影響範圍：UAT 環境完整 DB（psql-aidocextract-uat）
✗ ENCRYPTION_KEY 必須保留不變（不可變更，否則加密資料無法解密）
✗ Container App 將先停機（min-replicas=0），停機期間用戶無法存取
───────────────────────────────────────
請 app-team-lead + Infra Admin 雙重確認。
是否繼續？(yes/no)
```

> **AI 助手**：未取得人類雙重確認前，**絕對不可繼續執行 Action 10.3.x**。

### Action 10.3.1: 停止 Container App（避免寫入競爭）

```bash
# Scale to 0：所有 replica 停止，避免 rollback 期間資料寫入競爭
az containerapp update \
  --name ${CA_NAME} --resource-group ${RG_NAME} \
  --min-replicas 0 --max-replicas 0

# 等待所有 replica 停止
sleep 30
az containerapp replica list --name ${CA_NAME} --resource-group ${RG_NAME} --output table
```

**Verify**：replica 列表為空。

### Action 10.3.2: 從 backup 還原

#### 選項 A：PITR（Point-in-time recovery） — 推薦

```bash
# Azure PostgreSQL Flexible Server PITR
az postgres flexible-server restore \
  --resource-group ${RG_NAME} \
  --name "${POSTGRES_NAME}-restored" \
  --source-server ${POSTGRES_NAME} \
  --restore-time "2026-MM-DDTHH:MM:00Z"

# 切換 connection string → 新 server（更新 Key Vault DATABASE_URL）
# 或將舊 server rename + restored server rename 到原名（zero-downtime swap）
```

#### 選項 B：從 pg_dump 還原

```bash
# 假設已有 backup 檔案 backup-YYYYMMDD.sql
pg_restore \
  --host=${POSTGRES_FQDN} \
  --username=${POSTGRES_USER} \
  --dbname=${DB_NAME} \
  --clean --if-exists \
  backup-YYYYMMDD.sql
```

**Verify**：能登入 DB；關鍵 table（User、Company、Document）row count 與 backup 點符合預期。

### Action 10.3.3: 重啟 Container App

```bash
# Scale back to normal
az containerapp update \
  --name ${CA_NAME} --resource-group ${RG_NAME} \
  --min-replicas 1 --max-replicas 5

# 等待 replica 起來
sleep 60
```

### Action 10.3.4: Smoke test 子集

至少跑 STEP-09 的 Action 9.1（health endpoint）+ 9.2（auth login）+ 9.7（document upload）。

**Verify**：3 項 smoke test 全部 pass，才能宣告 Layer 3 rollback 成功。

---

## 📝 Action 10.4: Post-mortem 紀錄

無論用了哪一層 rollback，**必須**寫入 incident 紀錄：

**路徑**：`claudedocs/4-changes/incidents/INCIDENT-<YYYY-MM-DD>-<short-slug>.md`

**必含欄位**：

```markdown
# INCIDENT-2026-MM-DD-<short-slug>

| 項目 | 內容 |
|------|------|
| 觸發時間 | 2026-MM-DD HH:MM (TZ) |
| 偵測來源 | health check / smoke test / Pilot user / monitor alert |
| Root cause | <一句話根因分析> |
| 採用 Layer | Layer 1 / 2 / 3 |
| Rollback 執行人 | <name> |
| Approval（若 Layer 3） | app-team-lead: <name>, Infra Admin: <name> |
| Data loss | true（範圍：...） / false |
| 受影響 revision | <revision name> |
| 回滾目標 revision | <revision name> |
| 業務停機時長 | <minutes> |

## Improvement Actions（避免再發生）
1. ...
2. ...
```

**升級**：將該 INCIDENT 加入下一次 retrospective 議程（`bmad:bmm:workflows:retrospective`）。

---

## 📢 Action 10.5: 通知 stakeholders

| 角色 | 通知時機 | 通知方式 |
|------|---------|---------|
| app-team-lead | 任何 Layer 觸發時立即通知 | Slack / Email |
| Infra Admin | Layer 2/3 觸發時 | Slack / Email |
| 業務 Owner | 若 Pilot 已對 user 開放且有業務影響 | Email + 電話 |
| Security Team | 若 root cause 涉及安全事件 | 安全事件流程 |

---

## 🔴 特別禁止事項（絕對不可違反）

| # | 禁止項目 | 原因 |
|---|---------|------|
| 🔴 1 | 在無 backup 情況下執行 Layer 3 | 資料無法還原，造成永久損失 |
| 🔴 2 | 變更 ENCRYPTION_KEY 作為 rollback 手段 | 所有加密欄位（ApiKey、SmtpPassword）將無法解密 |
| 🔴 3 | 對 schema migration 做「revert migration」 | Prisma 不支援自動 revert，需手動寫降級 SQL（高風險） |
| 🔴 4 | 在 Layer 3 執行期間恢復 Container App 寫入 | 寫入競爭會破壞 restored DB 一致性 |
| 🟡 5 | Layer 1/2 在 Pilot 已對 user 開放後不需 approval | 仍需通知 app-team-lead；如已對外開放，必須加 approval |
| 🔴 6 | 跳過 Post-mortem 紀錄（Action 10.4） | 失去 incident 學習機會，違反治理 |

---

## 🔐 ENCRYPTION_KEY 緊急狀況

若 ENCRYPTION_KEY 不慎變更（例如 Key Vault secret version 被誤改）：

**現象**：
- 加密欄位（`ApiKey.encryptedKey`、`SmtpConfig.password`、`AzureOpenAIConfig.apiKey` 等）解密失敗
- 應用日誌出現 `crypto.decipheriv` error 或 `bad decrypt` exception
- API 呼叫外部服務全部失敗（金鑰無法解密）

**唯一補救方案**：

```bash
# Step 1：列出 Key Vault 中該 secret 的所有 version
az keyvault secret list-versions \
  --vault-name ${KV_NAME} \
  --name ENCRYPTION-KEY \
  --query "[].{id:id, created:attributes.created, enabled:attributes.enabled}" \
  --output table

# Step 2：找到舊的（正確的）version id
# Step 3：將舊 version 設為 current（透過建立新 secret 指向舊 value）
# 注意：Azure Key Vault 不支援直接 rollback version，需手動建立新 version 並寫入舊 value
az keyvault secret set \
  --vault-name ${KV_NAME} \
  --name ENCRYPTION-KEY \
  --value "<old-key-value-from-secure-backup>"

# Step 4：重啟 Container App 以重新讀取
az containerapp revision restart \
  --name ${CA_NAME} --resource-group ${RG_NAME} \
  --revision <current-revision>
```

> **預防措施**：ENCRYPTION_KEY 應在生成時備份到離線安全位置（離開 Azure 之外，例如加密的密碼管理工具），永不變更。

---

## 🤖 AI Execution Hint

- AI 應**優先**建議 Layer 1（最快、最安全）
- Layer 2 需 `app-team-lead` approval
- Layer 3 需 **app-team-lead + Infra Admin 雙重 approval**，AI 必須暫停請求人類確認
- Rollback 執行後**必須**完成 Action 10.4（Post-mortem）和 Action 10.5（通知）才算完整收尾
- 寫入 `deployment-state/uat.yaml` 的 outputs（rollback_revision / rollback_reason / data_rolled_back）

---

## ✅ Exit Criteria

- [ ] 服務恢復可用（`/api/health` 回傳 200）
- [ ] Smoke test 子集通過（至少 health + auth login + document upload）
- [ ] Post-mortem 已寫入 `claudedocs/4-changes/incidents/INCIDENT-<date>-<slug>.md`
- [ ] Stakeholders 已通知（依 Action 10.5 表格）
- [ ] `deployment-state/uat.yaml` 的 outputs 已更新
- [ ] 若 Layer 3：Improvement actions 已加入下次 retrospective 議程

---

*文件版本: v1.0（階段 C 完成）*
*最後更新: 2026-04-27*
*維護者: AI 助手 + 開發團隊*
