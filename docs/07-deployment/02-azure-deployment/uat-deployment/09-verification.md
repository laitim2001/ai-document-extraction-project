---
document_type: deployment_procedure
step_id: STEP-09
title: 部署後驗證（Smoke Test）
estimated_duration: 30-60 minutes
requires_approval: false
approver: none
environment: uat
status: ✅ 完整內容（階段 C）
prerequisites:
  - STEP-08 completed（Container App Running）
  - test fixture: tests/fixtures/sample-invoice-dhl.pdf 已準備
  - KV secret: uat-test-user-credentials 已建立
outputs:
  - smoke_test_results: <pass/fail per category>
  - test_user_login_status: pass|fail
  - sample_extraction_status: pass|fail
  - tier1_mapping_status: pass|fail
  - rate_limit_status: pass|fail
  - app_insights_status: pass|fail
---

# STEP-09: 部署後驗證（Smoke Test）

> **狀態**：✅ 完整內容（階段 C 完成詳述）

## 🎯 Objective

部署成功後執行端對端 smoke test，驗證核心業務功能可用。**任一 Critical 類別失敗應立即進入 STEP-10 Rollback 流程**。

---

## 📊 測試矩陣概覽

| 類別 | 測試項數 | 工具 | 是否 Critical |
|------|---------|------|---------------|
| 連通性 | 3 | curl | ✅ Critical |
| 認證 | 4 | curl + Playwright | ✅ Critical |
| 上傳 + OCR | 5 | curl + 手動 | ✅ Critical |
| Mapping + Routing | 4 | API + Prisma Studio | 🟡 Non-critical |
| 資料庫 | 3 | psql | ✅ Critical |
| 觀測 | 3 | Azure Portal + KQL | 🟡 Non-critical |

**總計**: 22 測試項 / 6 類別

---

## Action 9.1: Health Endpoints 驗證

### Command

```bash
# 設定 FQDN（從 STEP-08 取得）
FQDN="ai-doc-extraction-uat.<region>.azurecontainerapps.io"

# 9.1.a Public health endpoint（不需認證）
curl -fsSL "https://${FQDN}/api/health" | jq .

# 9.1.b Admin health endpoint（驗證 auth middleware 啟用）
curl -i "https://${FQDN}/api/admin/health"

# 9.1.c HTTPS 憑證鏈驗證
curl -v "https://${FQDN}/api/health" 2>&1 | grep -E "SSL|TLS|certificate"
```

### Verify

- 9.1.a 回應 HTTP 200 + JSON body：`{ status: 'healthy', services: { database: 'connected' }, ... }`
- 9.1.b 回應 HTTP 401（**未認證預期**，證明 admin auth middleware 已啟用）
- 9.1.c 憑證 chain 合法（CN 對應 FQDN，未過期）

### Expected Output

```json
{
  "status": "healthy",
  "timestamp": "2026-04-27T10:00:00.000Z",
  "uptime": 1234,
  "responseTime": 45,
  "services": { "database": "connected" },
  "version": "1.0.0"
}
```

### If Fails

- 9.1.a 失敗（200 不返回或 database disconnected）→ **Critical** → 立即進 STEP-10 Rollback
- 9.1.b 返回 200（未驗證即可訪問）→ **Critical** → 安全問題，立即進 STEP-10
- 9.1.c TLS 失敗 → 檢查 Container App ingress 設定 + custom domain cert

---

## Action 9.2: Login Smoke Test

### Command

```bash
# 9.2.a 從 Key Vault 取得測試帳號
TEST_USER=$(az keyvault secret show --vault-name <kv-name> \
  --name uat-test-user-credentials --query value -o tsv)
TEST_EMAIL=$(echo $TEST_USER | jq -r .email)
TEST_PASSWORD=$(echo $TEST_USER | jq -r .password)

# 9.2.b 本地帳號登入（NextAuth credentials provider）
curl -i -X POST "https://${FQDN}/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=${TEST_EMAIL}&password=${TEST_PASSWORD}" \
  -c /tmp/uat-cookies.txt

# 9.2.c Cookie 驗證
grep "next-auth.session-token" /tmp/uat-cookies.txt

# 9.2.d 失敗登入測試（rate limit 啟用驗證）
for i in {1..5}; do
  curl -s -o /dev/null -w "Attempt $i: %{http_code}\n" \
    -X POST "https://${FQDN}/api/auth/callback/credentials" \
    -d "email=${TEST_EMAIL}&password=wrong-password"
done

# 9.2.e Azure AD SSO（手動測試，記錄為 manual check）
# 在瀏覽器中訪問 https://${FQDN}/api/auth/signin → 點擊 Microsoft 登入
```

### Verify

- 9.2.b 回應 302 redirect（成功）或 200（NextAuth callback success）
- 9.2.c Cookie file 中存在 `next-auth.session-token`
- 9.2.d 連續錯誤密碼後，第 3+ 次應返回 401（FIX-052 rate limit 啟用驗證）
- 9.2.e 手動驗證 SSO redirect to Microsoft login + 回調成功

### Expected Output

```
HTTP/2 302
location: /

Attempt 1: 401
Attempt 2: 401
Attempt 3: 401（或 429 if rate-limited）
```

### If Fails

- 9.2.b 401（密碼錯誤）→ 檢查 KV secret 內容是否同步至 essential seed 用戶
- 9.2.c 無 cookie → NextAuth 配置問題，檢查 NEXTAUTH_SECRET / NEXTAUTH_URL
- 9.2.d 永遠 401 但無 429 → rate limit 未啟用（記錄為 non-critical bug）
- 9.2.e SSO 失敗 → 檢查 Azure AD app registration redirect URI 含 `https://${FQDN}/api/auth/callback/azure-ad`

---

## Action 9.3: 上傳 Test Invoice

### Command

```bash
# 9.3.a 確認 fixture 存在
ls -lh tests/fixtures/sample-invoice-dhl.pdf
# 若不存在：請先準備 sample DHL 發票 PDF（建議 1-2MB，含完整 OCR-able 內容）

# 9.3.b 上傳文件（使用 9.2 的 cookie）
RESPONSE=$(curl -s -X POST "https://${FQDN}/api/documents/upload" \
  -H "Cookie: $(cat /tmp/uat-cookies.txt | grep session-token | awk '{print $6"="$7}')" \
  -F "file=@tests/fixtures/sample-invoice-dhl.pdf")

echo $RESPONSE | jq .
DOCUMENT_ID=$(echo $RESPONSE | jq -r '.data.id')

# 9.3.c 驗證 Blob Storage 出現對應 blob
az storage blob list \
  --account-name <storage-account> \
  --container-name documents \
  --auth-mode login \
  --query "[?contains(name, '${DOCUMENT_ID}')].{name:name, size:properties.contentLength}" \
  -o table
```

### Verify

- 9.3.b HTTP 201 + body 含 `data.id` (UUID) + `data.processingId`
- 9.3.c Blob list 顯示至少 1 個對應 document ID 的 blob

### Expected Output

```json
{
  "success": true,
  "data": {
    "id": "<uuid>",
    "fileName": "sample-invoice-dhl.pdf",
    "extractionStatus": "PENDING",
    "processingId": "<uuid>"
  }
}
```

### If Fails

- 9.3.b 401 → cookie 失效，重新執行 9.2
- 9.3.b 413 Payload Too Large → 檢查 ingress max body size
- 9.3.b 500 → 檢查 Container App log（多半為 Blob Storage 連線問題或 KV access）
- 9.3.c blob 不存在 → Storage Account 連線問題或 RBAC（Container App MI 缺少 `Storage Blob Data Contributor`）

---

## Action 9.4: 驗證 OCR + Stage1/2/3 完成

### Command

```bash
# 9.4.a Poll 直到 extraction 完成（最多等 60 秒）
for i in {1..30}; do
  STATUS=$(curl -s "https://${FQDN}/api/documents/${DOCUMENT_ID}" \
    -H "Cookie: $(cat /tmp/uat-cookies.txt | grep session-token | awk '{print $6"="$7}')" \
    | jq -r '.data.extractionStatus')
  echo "Poll $i: status=$STATUS"
  [[ "$STATUS" == "COMPLETED" ]] && break
  [[ "$STATUS" == "FAILED" ]] && { echo "Extraction failed"; break; }
  sleep 2
done

# 9.4.b 取得處理 timeline + Stage 1/2/3 log
curl -s "https://${FQDN}/api/documents/${DOCUMENT_ID}" \
  -H "Cookie: $(cat /tmp/uat-cookies.txt | grep session-token | awk '{print $6"="$7}')" \
  | jq '.data | {extractionStatus, ocrTextLength: (.ocrText | length), stages: .processingStages}'

# 9.4.c 從 Application Insights 查 stage 執行日誌
# Azure Portal → App Insights → Logs → 執行 KQL（見 Action 9.8）
```

### Verify

- 9.4.a 最終 status = `COMPLETED`（10-30 秒內完成）
- 9.4.b `ocrTextLength > 0` + 三個 stage 都有對應 log（COMPANY_DETECTION / FORMAT_DETECTION / FIELD_EXTRACTION）
- 9.4.c App Insights logs 看到 `Stage 1 complete`、`Stage 2 complete`、`Stage 3 complete`

### Expected Output

```json
{
  "extractionStatus": "COMPLETED",
  "ocrTextLength": 5234,
  "stages": ["COMPANY_DETECTION", "FORMAT_DETECTION", "FIELD_EXTRACTION"]
}
```

### If Fails

- 9.4.a status=FAILED → 檢查 Azure Document Intelligence 連線 + AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT/KEY
- 9.4.a status 卡在 PROCESSING 60+ 秒 → Stage 阻塞，檢查 Azure OpenAI quota / rate limit
- 9.4.b ocrText 空 → OCR 失敗，檢查 Document Intelligence 配額或 PDF 格式
- 9.4.c 缺 Stage 2/3 → V3 pipeline 配置問題，檢查 PIPELINE_CONFIG seed

---

## Action 9.5: 驗證 Tier 1 Mapping 命中率

### Command

```bash
# 9.5.a 取得 ProcessedDocument fields（含 mapping source）
curl -s "https://${FQDN}/api/extraction/${DOCUMENT_ID}/fields" \
  -H "Cookie: $(cat /tmp/uat-cookies.txt | grep session-token | awk '{print $6"="$7}')" \
  | jq '.data.fields[] | {fieldName, mappingSource, confidenceScore}'

# 9.5.b 統計 mapping source 分佈
TIER1_COUNT=$(curl -s "https://${FQDN}/api/extraction/${DOCUMENT_ID}/fields" \
  -H "Cookie: $(cat /tmp/uat-cookies.txt | grep session-token | awk '{print $6"="$7}')" \
  | jq '[.data.fields[] | select(.mappingSource == "UNIVERSAL")] | length')
TOTAL_COUNT=$(curl -s "https://${FQDN}/api/extraction/${DOCUMENT_ID}/fields" \
  -H "Cookie: $(cat /tmp/uat-cookies.txt | grep session-token | awk '{print $6"="$7}')" \
  | jq '.data.fields | length')

echo "Tier 1 hit rate: $TIER1_COUNT / $TOTAL_COUNT = $(echo "scale=2; $TIER1_COUNT*100/$TOTAL_COUNT" | bc)%"
```

### Verify

- 9.5.b Tier 1 命中率 ≥ 70%（對齊 azure-deployment-plan.md §4 設計目標）

### Expected Output

```
Tier 1 hit rate: 14 / 18 = 77.78%
```

### If Fails

- 命中率 < 50% → **Warning**（reference data 整理不足，但不阻塞 UAT）→ 記錄為 follow-up，提醒重新檢視 `seed-prod-reference.ts` Tier 1 universal mappings 數量（應為 50-200 條）
- 命中率 0% → 檢查 mapping seed 是否執行（`SELECT count(*) FROM mapping_rule WHERE scope='UNIVERSAL'`）

---

## Action 9.6: 驗證信心度路由

### Command

```bash
# 9.6.a 上傳 3 種信心度等級的 sample（如有）
# - sample-high-confidence.pdf（清晰、標準格式 → 預期 AUTO_APPROVE）
# - sample-medium-confidence.pdf（部分模糊 → 預期 QUICK_REVIEW）
# - sample-low-confidence.pdf（手寫/掃描差 → 預期 FULL_REVIEW）

# 9.6.b 驗證路由決策
for SAMPLE in high medium low; do
  RESPONSE=$(curl -s -X POST "https://${FQDN}/api/documents/upload" \
    -H "Cookie: ..." \
    -F "file=@tests/fixtures/sample-${SAMPLE}-confidence.pdf")
  DOC_ID=$(echo $RESPONSE | jq -r '.data.id')

  # 等待處理完成後查路由
  sleep 30
  curl -s "https://${FQDN}/api/confidence/${DOC_ID}" \
    -H "Cookie: ..." \
    | jq '{confidenceScore, routingDecision}'
done
```

### Verify

- 9.6.b 三筆樣本應分別走 AUTO_APPROVE（≥ 90%）/ QUICK_REVIEW（70-89%）/ FULL_REVIEW（< 70%）
- ⚠️ 信心度閾值對齊 `confidence-v3-1.service.ts` 第 112-119 行（**90% / 70%**，非 CLAUDE.md 文檔聲稱的 95%/80%）

### Expected Output

```json
[
  { "confidenceScore": 0.93, "routingDecision": "AUTO_APPROVE" },
  { "confidenceScore": 0.78, "routingDecision": "QUICK_REVIEW" },
  { "confidenceScore": 0.55, "routingDecision": "FULL_REVIEW" }
]
```

### If Fails

- 路由不符預期 → 檢查 `confidence-v3-1.service.ts` 五維度權重（20/15/30/20/15）+ CONFIG_SOURCE_BONUS 是否與 V3.1 邏輯一致
- 全走 FULL_REVIEW → 配置可能未載入，檢查 PipelineConfig seed
- 若無 3 種 sample → 至少驗證 1 筆 sample 的 routingDecision 不為 null

---

## Action 9.7: Audit Log 寫入驗證

### Command

```bash
# 取得 PostgreSQL 連線字串（從 KV 或環境變數）
DB_URL=$(az keyvault secret show --vault-name <kv-name> \
  --name database-url --query value -o tsv)

# 9.7.a 查最近 5 分鐘的 DOCUMENT_UPLOADED audit log
psql "$DB_URL" -c "
  SELECT count(*) FROM audit_log
  WHERE action = 'DOCUMENT_UPLOADED'
    AND created_at > NOW() - INTERVAL '5 minutes';
"

# 9.7.b 查文件處理完整 audit chain
psql "$DB_URL" -c "
  SELECT action, created_at, user_id
  FROM audit_log
  WHERE entity_id = '${DOCUMENT_ID}'
  ORDER BY created_at;
"
```

### Verify

- 9.7.a count >= Action 9.3 + 9.6 上傳的文件總數
- 9.7.b 至少 4 條記錄：DOCUMENT_UPLOADED → EXTRACTION_STARTED → EXTRACTION_COMPLETED → ROUTING_DECISION

### Expected Output

```
 count
-------
     4

       action          |        created_at         | user_id
-----------------------+---------------------------+---------
 DOCUMENT_UPLOADED     | 2026-04-27 10:00:00       | <uuid>
 EXTRACTION_STARTED    | 2026-04-27 10:00:01       | <uuid>
 EXTRACTION_COMPLETED  | 2026-04-27 10:00:25       | <uuid>
 ROUTING_DECISION      | 2026-04-27 10:00:26       | <uuid>
```

### If Fails

- count = 0 → audit log 寫入完全失敗 → **Critical** → 進 STEP-10
- audit chain 不完整 → 部分 stage 未寫 audit，記錄為 non-critical bug

---

## Action 9.8: Application Insights Telemetry 驗證

### Command

```
1. Azure Portal → Application Insights → Live Metrics
2. 觀察 30 秒 incoming requests stream
3. Logs → 執行 KQL：
```

### KQL 查詢範例

```kusto
// 9.8.a 最近 15 分鐘 request 統計
requests
| where timestamp > ago(15m)
| summarize count() by resultCode, name
| order by count_ desc

// 9.8.b 依賴呼叫（DB / Storage / Azure OpenAI）
dependencies
| where timestamp > ago(15m)
| summarize count(), avg(duration) by type, target
| order by count_ desc

// 9.8.c 錯誤檢查（無 5xx 預期）
requests
| where timestamp > ago(15m) and resultCode startswith "5"
| project timestamp, name, resultCode, customDimensions
```

### Verify

- 9.8.a 看到 `/api/health`、`/api/documents/upload`、`/api/auth/*` 等 request stream
- 9.8.b dependencies 中包含 `postgresql`、`azure-blob`、`api.cognitive.microsoft.com`、`<azure-openai>.openai.azure.com`
- 9.8.c 無 5xx requests（或僅 < 1% 容忍範圍）

### Expected Output

```
resultCode  name                          count_
200         GET /api/health               12
200         POST /api/documents/upload    3
401         POST /api/auth/...            5  (rate limit test from 9.2.d)
```

### If Fails

- Live Metrics 無 stream → APPLICATIONINSIGHTS_CONNECTION_STRING 未配置或錯誤
- 缺 dependencies → SDK auto-collection 未啟用，檢查 instrumentation 設定
- 5xx 出現 → 立即查 `exceptions` table 找 root cause，視嚴重性決定是否 rollback

---

## Action 9.9: Rate Limiting 驗證（FIX-052 回歸）

### Command

```bash
# 短時間內呼叫某 API 50 次，預期觸發 rate limit
for i in {1..50}; do
  curl -s -o /dev/null -w "%{http_code} %header{x-ratelimit-remaining}\n" \
    "https://${FQDN}/api/health"
done | sort | uniq -c
```

### Verify

- 第 30+ 次開始返回 429（具體閾值依 rate-limit.service.ts 配置）
- Response header `X-RateLimit-Remaining` 應遞減至 0
- FIX-052 已驗證：Redis 優先 + in-memory fallback 機制正常

### Expected Output

```
     28 200
     22 429
```

### If Fails

- 全 200（無 429）→ rate limit middleware 未啟用，記錄為 non-critical bug（health endpoint 可能豁免）
- 改用其他 rate-limited endpoint（如 `/api/auth/callback/credentials`）重測

---

## Action 9.10: 寫入 Smoke Test 結果至 State File

### Command

```bash
# 9.10.a 更新 deployment-state/uat.yaml
cat >> deployment-state/uat.yaml << EOF

# STEP-09 Smoke Test Results
smoke_test_results:
  connectivity: pass        # 9.1
  auth: pass                # 9.2
  upload_extract: pass      # 9.3 + 9.4
  mapping_routing: pass     # 9.5 + 9.6
  database: pass            # 9.7
  observability: pass       # 9.8
  rate_limit: pass          # 9.9
  executed_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
  executor: <name>

flags:
  smoke_test_passed: true
  ready_for_phase2: true

failures: []
# 若有失敗，使用以下格式記錄：
# failures:
#   - category: mapping_routing
#     severity: non-critical
#     detail: "Tier 1 hit rate 45% (target 70%)"
#     follow_up: "Review seed-prod-reference.ts Tier 1 mappings count"
EOF
```

### Verify

- `smoke_test_results` 結構完整（7 個類別）
- `flags.smoke_test_passed` 反映實際結果
- 任何 fail 項目記錄至 `failures` 區段

---

## 🚨 Failure 處理決策樹

```
任一測試失敗
    ↓
是 Critical 類別？（連通性 / 認證 / 上傳+OCR / 資料庫）
    ├─ 是 → 立即停止 smoke test
    │       ├─ 寫入 failures + smoke_test_passed: false
    │       └─ 進入 STEP-10 Rollback 流程
    │
    └─ 否 → Non-critical（mapping/observability/rate-limit）
            ├─ 記錄至 failures（severity: non-critical）
            ├─ 標註 follow_up 行動
            └─ 繼續執行剩餘測試
```

### Critical 失敗範例

- Health endpoint 不回應 200
- 認證機制完全失效（admin endpoint 不需登入）
- 文件上傳 API 失敗
- OCR + Stage 1/2/3 任一階段卡住
- 資料庫無法寫入

### Non-critical 失敗範例

- Tier 1 mapping 命中率 < 70%（但 > 0%）
- Application Insights 部分 telemetry 缺失
- Rate limit 在 health endpoint 未生效

---

## ✅ Exit Criteria

- [ ] 所有 Critical 類別通過（連通性 / 認證 / 上傳+OCR / 資料庫）
- [ ] Non-critical 失敗已記錄 follow-up
- [ ] App Insights 接收 request + dependency telemetry
- [ ] `deployment-state/uat.yaml` 已更新 smoke_test_results
- [ ] `flags.smoke_test_passed: true`
- [ ] 進入 Phase 2 milestone（首次部署成功）

---

## 🤖 AI Execution Hint

- 失敗任一 Critical 步驟應立即寫入 `deployment-state/uat.yaml` 標記 `smoke_test_passed: false` + 進入 STEP-10
- Non-critical 失敗繼續執行剩餘測試，但必須記錄至 `failures` 區段
- 信心度閾值以 `confidence-v3-1.service.ts` 代碼為準（**90%/70%**），非 CLAUDE.md 文檔記載的 95%/80%
- Tier 1 命中率 < 50% 時，提醒檢視 `seed-prod-reference.ts`（azure-deployment-plan.md §4）
