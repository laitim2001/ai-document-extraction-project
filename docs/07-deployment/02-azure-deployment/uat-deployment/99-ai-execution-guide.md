---
document_type: ai_execution_protocol
step_id: STEP-99
title: AI Assistant Execution Guide（AI 助手執行協議）
estimated_duration: 15 minutes（閱讀）
requires_approval: false
approver: none
environment: uat
status: ✅ 完整內容（v0.3 階段 B）
audience: ai_assistant
---

# STEP-99: AI Assistant Execution Guide

> **目的**：為 AI 助手（Claude Code、其他 LLM agent）提供執行 UAT 部署的**標準操作協議**。
>
> **核心原則**：AI 助手是「全自動 + Approval Gates」執行者，不是「無人值守 daemon」。

---

## 🤖 1. AI 助手必讀：執行協議 5 大原則

### Principle 1: 永遠先讀 State File
任何 session 開始執行部署前，**必須先讀** `deployment-state/uat.yaml` 判斷進度：
```bash
cat ${PROJECT_ROOT}/deployment-state/uat.yaml
# 找出 next_step 欄位，那就是你應該執行的下一步
```

❌ **禁止行為**：
- 從零開始猜測進度
- 重複執行已完成的步驟（除非該步驟標記 idempotent）
- 跳過 STEP-01 prerequisites 檢查

### Principle 2: 嚴守 Approval Gates
讀取每個 STEP 的 frontmatter `requires_approval`：

```yaml
requires_approval: true
approver: app-team-lead
```

→ **必須暫停並向人類請求確認**，不可自行執行。

✅ 正確流程：
```
AI: "STEP-08 'First Deployment' requires approval from app-team-lead.
     Plan to execute: az containerapp create --image ${ACR}/${IMAGE}
     Resources affected: Container App ca-aidocextract-uat
     Estimated duration: 30-45 minutes
     Reversibility: Layer 1 rollback available
     Confirm to proceed? (yes/no)"
人類: "yes"
AI: <執行>
```

❌ **禁止行為**：自己決定「這應該安全吧」就執行 approval-required 步驟。

### Principle 3: 每個 Action 後立即 Verify
不可假設 `command_executed == success`，必須跑 `verify` 區塊比對 `expected_output`。

```
Action 2.2 → Command 執行 → Verify command 執行 → Compare output → ✅ 或 ❌
```

若 Verify 失敗：
1. 不繼續下一個 Action
2. 寫入 `failures` 區段（含完整 error message）
3. 嘗試 `if_fails` 區塊建議的補救
4. 若 `if_fails` 無對應 → 升級給人類

### Principle 4: 寫入 State File 是 Atomic Operation
每個 STEP 完成後，必須**原子性寫入** state file：

```yaml
# 正確：完整寫入
steps_completed:
  - step_id: STEP-02
    completed_at: 2026-05-13T10:30:00Z
    status: success
resources:
  acr:
    login_server: acraidocextractuat.azurecr.io
next_step: STEP-03
```

❌ **禁止行為**：
- 部分更新後 abort（會讓 state 不一致）
- 用 `>>` append 破壞 YAML 結構
- 寫入後不 fsync 就退出

### Principle 5: 永遠不暴露 Secrets
讀寫 state file 時：
- ✅ 寫入：secret URI（`https://kv-...vault.azure.net/secrets/auth-secret`）
- ❌ 寫入：secret value（`<actual-secret-string>`）

驗證 secret 可用性時：
- ✅ `az keyvault secret show --query "name" -o tsv`（驗證存在）
- ❌ `az keyvault secret show --query "value" -o tsv`（會印出值）

Container App 中驗證 env vars：
- ✅ `az containerapp show --query "properties.template.containers[0].env[].name"`（只取名）
- ❌ `az containerapp show ... env[].value`（暴露值）

---

## 🔁 2. 跨 Session 續接協議

當 AI 助手在新 session 接手未完成部署：

### 2.1 開場必跑檢查清單

```bash
# Step A: 確認 state file 存在
ls -la ${PROJECT_ROOT}/deployment-state/uat.yaml

# Step B: 讀取進度
yq '.next_step' ${PROJECT_ROOT}/deployment-state/uat.yaml
yq '.steps_completed[].step_id' ${PROJECT_ROOT}/deployment-state/uat.yaml
yq '.failures' ${PROJECT_ROOT}/deployment-state/uat.yaml

# Step C: 驗證上次完成步驟的資源仍存在
# 例如若上次完成 STEP-02，驗證 ACR / DB / KV 等資源
```

### 2.2 開場回報模板

新 session 接手時，AI 應主動產出：

```markdown
## 🔄 UAT 部署進度接手報告

**讀取 state file**: deployment-state/uat.yaml
**上次更新**: 2026-05-13T11:30:00Z by <previous-executor>
**已完成步驟**: STEP-01, STEP-02, STEP-03
**下一步**: STEP-04（Container Build & Push）
**未解決失敗**: 0

### 資源驗證
- ✅ ACR `acraidocextractuat` 存在
- ✅ Container Apps Environment 存在
- ✅ Key Vault secrets 已注入（共 8 個）

### 建議下一步
執行 STEP-04: 04-container-build-push.md
- requires_approval: false（不需審批）
- 預估時間: 15-30 分鐘
- 即將執行: docker build + push to ACR

是否繼續？(yes/no)
```

---

## ⚠️ 3. 失敗處理協議

### 3.1 失敗分類

| 等級 | 例子 | AI 反應 |
|------|------|--------|
| **L1: Transient** | 網路 timeout、API rate limit | 自動 retry 3 次（指數退避：5s / 30s / 120s）|
| **L2: Configuration** | 環境變數錯誤、參數錯字 | 嘗試 `if_fails` 補救，記錄 + 繼續 |
| **L3: Permission** | RBAC 不足、Quota 超限 | 停止 + 升級給人類 |
| **L4: Critical** | DB migration 失敗、secret leak | 立即停止 + Alert + 不可繼續 |

### 3.2 寫入 failures 區段

```yaml
failures:
  - step_id: STEP-02
    action_id: 2.4
    failed_at: 2026-05-13T10:15:00Z
    error_class: AuthorizationFailed
    error_message: |
      The client 'xxx' does not have authorization to perform action
      'Microsoft.DBforPostgreSQL/flexibleServers/write'
    severity: L3
    attempted_remediation:
      - Read 01-prerequisites.md Action 1.2 → not applicable
      - Checked role assignment → user has only Reader role on RG
    resolution: pending
    escalated_to: infra-admin
```

### 3.3 Retry 策略

```
L1 失敗 → Retry 1（5s 後）→ Retry 2（30s 後）→ Retry 3（120s 後）→ 仍失敗 → 升級
L2 失敗 → 嘗試 if_fails → 仍失敗 → 升級
L3/L4 失敗 → 立即停止，不 retry
```

❌ **絕對禁止**的 retry 模式：
- 對 destructive operation（migration / seed reference / delete）做 retry
- 對 approval-required step 做 retry
- 無上限的 retry loop

---

## 🔐 4. 敏感操作保護機制

### 4.1 Pre-Action Safety Check

執行任何 mutation 操作前，AI 必須輸出：

```markdown
## ⚠️ 即將執行敏感操作

**Step**: STEP-08
**Action**: 8.5 Deploy first revision
**Command**: az containerapp create --image ${ACR}/${IMAGE} ...
**影響範圍**:
  - 建立新 Container App revision
  - 觸發業務影響（首次 user 可達）
  - 影響資源：ca-aidocextract-uat
**可逆性**: ✅（Layer 1 rollback 可用）
**Approval 狀態**: requires_approval: true（已等待 app-team-lead 確認）

確認後將執行。等待回應...
```

### 4.2 必須請求確認的操作清單

無論 STEP-XX 的 frontmatter 為何，以下操作**永遠**需要請求人類確認：

- 任何 `az group delete` / `az resource delete`
- `prisma migrate deploy`（schema 變更）
- `seed-prod-reference.ts`（業務參考資料）
- `az containerapp revision set-mode`（流量切換）
- `pg_restore`（DB 還原）
- 修改 `ENCRYPTION_KEY`（不可變更）

### 4.3 Dry Run 優先

支援 `--what-if` 或 `--dry-run` 的 Azure 指令，AI 應**先執行 dry run** 給人類看 plan：

```bash
# Bicep deployment 先 what-if
az deployment group what-if --resource-group ${RG_NAME} --template-file main.bicep

# 確認 plan 後再正式 deploy
az deployment group create --resource-group ${RG_NAME} --template-file main.bicep
```

---

## 📋 5. 命令執行格式規範

### 5.1 環境變數一律從 state file / overview 取

```bash
# ❌ 不要硬編碼
RG_NAME="rg-ai-document-extraction-uat"

# ✅ 從上下文/state file 取
RG_NAME=$(yq '.metadata.resource_group' ${PROJECT_ROOT}/deployment-state/uat.yaml)
# 或從 STEP-00 §5 通用環境變數宣告
```

### 5.2 命令一律加 `--output` 與 `--query` 控制輸出

```bash
# ❌ 預設輸出（人讀友善但 AI 難解析）
az containerapp show --name ca-aidocextract-uat

# ✅ 結構化輸出
az containerapp show --name ca-aidocextract-uat --output json
az containerapp show --name ca-aidocextract-uat --query "properties.runningStatus" -o tsv
```

### 5.3 長時間操作必須 poll status

```bash
# ❌ Fire-and-forget
az postgres flexible-server create ... &
# 假設立刻成功

# ✅ Poll 直到 provisioningState=Succeeded
while true; do
  STATUS=$(az postgres flexible-server show \
    --name ${POSTGRES_NAME} --resource-group ${RG_NAME} \
    --query "state" -o tsv 2>/dev/null)
  echo "Postgres state: ${STATUS}"
  [[ "${STATUS}" == "Ready" ]] && break
  [[ "${STATUS}" == "Failed" ]] && exit 1
  sleep 30
done
```

### 5.4 Output 寫入 state file 用 yq 而非 sed

```bash
# ❌ 用 sed 修改 YAML（脆弱）
sed -i "s/next_step:.*/next_step: STEP-03/" ${STATE_FILE}

# ✅ 用 yq（YAML-aware）
yq -i ".next_step = \"STEP-03\"" ${STATE_FILE}
yq -i ".steps_completed += [{\"step_id\": \"STEP-02\", \"completed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"status\": \"success\"}]" ${STATE_FILE}
```

---

## 🧠 6. 決策樹（AI 該怎麼做）

```
任何時刻 AI 收到「執行部署」指令
  │
  ▼
讀取 deployment-state/uat.yaml
  │
  ├── State file 不存在 → 建議從 STEP-00 開始
  │
  ▼
取得 next_step
  │
  ▼
讀取對應 STEP-NN.md frontmatter
  │
  ▼
requires_approval == true？
  │
  ├── Yes → 暫停 + 顯示 plan + 等待人類 confirm
  │
  └── No → 繼續
  │
  ▼
依序執行 Actions（每個 Action）
  │
  ▼
每個 Action：Command → Verify → Compare with Expected Output
  │
  ├── Match → 寫入 state，繼續下一個 Action
  │
  └── No match → 失敗分類 → L1 retry / L2 if_fails / L3-4 升級
  │
  ▼
所有 Actions 通過 → 寫入 steps_completed + 更新 next_step
  │
  ▼
回報人類：「STEP-NN 完成，下一步 STEP-(NN+1)，是否繼續？」
```

---

## 📌 7. 常用查詢速查表

```bash
# 列出已完成步驟
yq '.steps_completed[].step_id' ${STATE_FILE}

# 取得下一步
yq '.next_step' ${STATE_FILE}

# 取得某資源的 output
yq '.resources.acr.login_server' ${STATE_FILE}

# 列出失敗
yq '.failures[]' ${STATE_FILE}

# 標記 reference seed 已執行
yq -i '.flags.reference_seed_executed = true' ${STATE_FILE}

# Update last_updated
yq -i ".metadata.last_updated = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" ${STATE_FILE}

# 加新 failure
yq -i '.failures += [{"step_id": "STEP-XX", "error_message": "..."}]' ${STATE_FILE}
```

---

## 🚫 8. 反模式（AI 絕不可做）

| 反模式 | 為何禁止 | 正確替代 |
|-------|---------|---------|
| 直接執行 `requires_approval: true` 步驟 | 可能造成不可逆業務影響 | 先暫停請求人類確認 |
| 跳過 verify 假設成功 | 沉默失敗會堆積問題 | 每個 Action 都跑 verify |
| 在 state file 寫 secret value | Secret 可能被 git 提交或日誌洩漏 | 只寫 secret URI |
| 對 schema migration 做 retry | DB 可能進入半套用狀態 | L4 fail 立即停止 |
| 自己決定「這個 error 沒關係」忽略 | 沉默忽略導致下游連鎖失敗 | 寫入 failures + 升級 |
| 跳過 STEP-01 直接執行 STEP-02+ | Prerequisites 失敗會在 STEP-02 引發混亂錯誤 | 永遠先 STEP-01 |
| 從本地 dev DB 複製資料到 prod | 違反 seed 策略 + 含測試污染 | 用 prisma/seed-data/reference/ 整理過的 JSON |
| 自行修改 ENCRYPTION_KEY | 會讓加密資料無法解密 | 通知人類，標記 critical |
| 多 session 同時執行 | State file 競爭破壞 | 單一執行者 lock（用 file lock 或約定）|

---

## 🔍 9. 自我檢查清單（每次執行前）

AI 執行任何 STEP 前自問：

- [ ] 我已讀取最新的 `deployment-state/uat.yaml`
- [ ] 我即將執行的步驟符合 `next_step` 欄位
- [ ] 我已讀完目標 STEP 的完整文件
- [ ] 我已確認 `requires_approval` 並做相應處理
- [ ] 我已準備好 verify command 與 expected output 的比對邏輯
- [ ] 我已準備好失敗時的 if_fails 補救路徑
- [ ] 我不會把 secret value 寫入任何文件 / log
- [ ] 我不會擅自跳過任何 Action

---

## 📞 10. 升級給人類的時機

下列情境 AI 必須**立即停止 + 升級**：

1. L3 / L4 失敗（permission / critical）
2. 連續 retry 3 次仍失敗（L1）
3. 偵測到資料異常（如 essential seed 後 roles_count = 0）
4. 偵測到安全風險（secret 出現在 log、未授權訪問）
5. 業務影響不可逆操作（DB rollback、Key Vault purge）
6. 發現文件與實際不符（STEP-XX 寫的命令在當前 Azure CLI 版本不支援）

升級格式：

```markdown
## 🚨 升級給人類

**事件等級**: L3 / L4
**STEP**: STEP-NN
**Action**: NN.M
**問題**: <一句話描述>
**已嘗試**: <列出 retry / if_fails 嘗試>
**state file 已更新**: failures 區段已寫入
**建議**:
  - Option A: <建議行動>
  - Option B: <備選行動>
**等待**: 人類決策

⚠️ 我不會繼續執行任何步驟，直到你回應。
```

---

## ✅ 11. 結語

AI 助手的角色：
- ✅ 是**執行加速器** — 自動化重複性 az CLI 操作
- ✅ 是**狀態保管員** — 維護 state file、確保跨 session 連續性
- ✅ 是**驗證執行者** — 嚴格比對 verify output
- ❌ 不是**決策者** — 敏感操作、業務影響、安全事件都該升級
- ❌ 不是**獨自運行者** — Approval Gates 是設計核心

**配合原則**：「AI 提速 + 人類把關」共贏，勝於「AI 全自動 + 偶發災難」。

---

*文件版本: v1.0（階段 B 完成）*
*最後更新: 2026-04-27*
*維護者: AI 助手 + 開發團隊*
