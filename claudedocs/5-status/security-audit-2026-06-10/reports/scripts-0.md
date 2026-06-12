# 安全審查報告 — scripts/ 工具腳本（前半 63 檔）

> 審查日期：2026-06-10 | Scope：scopes/scripts-0.txt | Agent：scripts-0

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | scripts/activate-company.ts | 31 | ✅ |
| 2 | scripts/analyze-batch-results.mjs | 125 | ✅ |
| 3 | scripts/analyze-batch-results.ts | 127 | ✅ |
| 4 | scripts/analyze-dhl-extraction.mjs | 191 | ✅ |
| 5 | scripts/analyze-dhl-lineitems.mjs | 99 | ✅ |
| 6 | scripts/analyze-dhl-problem.mjs | 114 | ✅ |
| 7 | scripts/analyze-failures.mjs | 113 | ✅ |
| 8 | scripts/analyze-issuer-issue.ts | 124 | ✅ |
| 9 | scripts/analyze-term-structure.mjs | 153 | ✅ |
| 10 | scripts/assign-admin-role.js | 75 | ✅ |
| 11 | scripts/backfill-document-format-id.mjs | 262 | ✅ |
| 12 | scripts/check-batch3-simple.mjs | 183 | ✅ |
| 13 | scripts/check-batch-config.mjs | 62 | ✅ |
| 14 | scripts/check-batch-status.mjs | 59 | ✅ |
| 15 | scripts/check-batch-status-now.mjs | 88 | ✅ |
| 16 | scripts/check-change006-batch.mjs | 166 | ✅ |
| 17 | scripts/check-change006-batch3.mjs | 222 | ✅ |
| 18 | scripts/check-change006-result.mjs | 128 | ✅ |
| 19 | scripts/check-change047.mjs | 106 | ✅ |
| 20 | scripts/check-company-config.mjs | 111 | ✅ |
| 21 | scripts/check-dhl-details.mjs | 181 | ✅ |
| 22 | scripts/check-dhl-extraction.mjs | 277 | ✅ |
| 23 | scripts/check-dhl-lineitems.mjs | 127 | ✅ |
| 24 | scripts/check-export-issue.mjs | 140 | ✅ |
| 25 | scripts/check-extraction-structure.mjs | 58 | ✅ |
| 26 | scripts/check-fields.ts | 41 | ✅ |
| 27 | scripts/check-format-id.mjs | 63 | ✅ |
| 28 | scripts/check-format-id.ts | 39 | ✅ |
| 29 | scripts/check-full-extraction.mjs | 117 | ✅ |
| 30 | scripts/check-gpt-and-terms.mjs | 130 | ✅ |
| 31 | scripts/check-gpt-extraction-detail.mjs | 108 | ✅ |
| 32 | scripts/check-i18n.ts | 323 | ✅ |
| 33 | scripts/check-i18n-completeness.ts | 239 | ✅ |
| 34 | scripts/check-index-sync.js | 252 | ✅ |
| 35 | scripts/check-issuer-stats.mjs | 55 | ✅ |
| 36 | scripts/check-issuer-status.mjs | 117 | ✅ |
| 37 | scripts/check-prompt-config.mjs | 41 | ✅ |
| 38 | scripts/check-resultdata.mjs | 106 | ✅ |
| 39 | scripts/check-review-queue.js | 434 | ✅ |
| 40 | scripts/check-status.mjs | 68 | ✅ |
| 41 | scripts/check-term-structure.mjs | 92 | ✅ |
| 42 | scripts/check-user.ts | 47 | ✅ |
| 43 | scripts/create-admin.ts | 94 | ✅ |
| 44 | scripts/create-dhl-prompt-config.mjs | 95 | ✅ |
| 45 | scripts/create-test-companies.ts | 54 | ✅ |
| 46 | scripts/debug-company-matching.mjs | 211 | ✅ |
| 47 | scripts/debug-format-issue.mjs | 271 | ✅ |
| 48 | scripts/debug-hierarchical-export.mjs | 304 | ✅ |
| 49 | scripts/debug-issuer-structure.mjs | 159 | ✅ |
| 50 | scripts/docker-entrypoint.sh | 21 | ✅ |
| 51 | scripts/e2e-i18n-check.ts | 879 | ✅ |
| 52 | scripts/e2e-test-plan-002.ts | 823 | ✅ |
| 53 | scripts/export-hierarchical-terms.ts | 443 | ✅ |
| 54 | scripts/export-test-plan-003-temp.ts | 305 | ✅ |
| 55 | scripts/find-batch.ts | 45 | ✅ |
| 56 | scripts/fix-file-detected-type.mjs | 108 | ✅ |
| 57 | scripts/fix-user-permissions.ts | 170 | ✅ |
| 58 | scripts/grant-admin-access.ts | 174 | ✅ |
| 59 | scripts/init-new-environment.ps1 | 222 | ✅ |
| 60 | scripts/init-new-environment.sh | 211 | ✅ |
| 61 | scripts/list-batches.mjs | 68 | ✅ |
| 62 | scripts/monitor-batch-progress.mjs | 115 | ✅ |
| 63 | scripts/query-batches.mjs | 33 | ✅ |

合計：63 檔，10,399 行，全部完整讀取。

---

## 2. 發現

### [Medium] D-01 預設管理員密碼硬編碼於初始化腳本與部署 seed 鏈

- **檔案**：scripts/init-new-environment.ps1:212、scripts/init-new-environment.sh:201（並透過 scripts/docker-entrypoint.sh:18 觸發 `seed-prod-essential`）
- **類別**：D（Secrets 與設定）/ I（認證機制）
- **描述**：兩個初始化腳本在完成訊息中明示預設管理員憑證 `admin@ai-document-extraction.com / ChangeMe@2026!`。此預設密碼為固定字串並已進入版本庫；若生產環境的 seed（`prisma/dist/seed-prod-essential.js`，由 `docker-entrypoint.sh` 在容器啟動時執行）使用相同預設密碼且部署後未強制更換，則攻擊者可用公開已知憑證直接接管最高權限帳號。
- **證據**：
  ```
  # init-new-environment.sh:200-202
  echo "📋 預設帳號："
  echo "   管理員：  admin@ai-document-extraction.com / ChangeMe@2026!"
  echo "   開發者：  dev@example.com（dev mode 登入，無需密碼）"
  ```
  ```sh
  # docker-entrypoint.sh:17-18
  echo "[entrypoint] Step 2/3: run essential seed (idempotent)"
  node prisma/dist/seed-prod-essential.js
  ```
- **建議**：確認 `seed-prod-essential` 在生產是否套用此固定預設密碼；若是，改為部署時要求由環境變數提供初始密碼、或首次登入強制改密、或產生隨機密碼。本檔僅能旗標風險，實際密碼設定邏輯在 `prisma/` seed（不在本 scope），建議交由負責 seed 的審查者一併確認。`Note: 跨 scope，依賴 prisma seed 行為`

### [Low] D-02 大量腳本硬編碼本地 DB 連線字串與 postgres:postgres 預設憑證

- **檔案**：scripts/check-batch3-simple.mjs:11（純硬編碼，無 env fallback）、scripts/check-batch-config.mjs:7、scripts/check-change006-batch.mjs:11、scripts/check-change006-batch3.mjs:12、scripts/check-change006-result.mjs:7、scripts/check-company-config.mjs:11、scripts/check-export-issue.mjs:14、scripts/check-extraction-structure.mjs:7、scripts/check-format-id.mjs:8、scripts/check-full-extraction.mjs:11、scripts/check-gpt-and-terms.mjs:11、scripts/check-gpt-extraction-detail.mjs:11、scripts/check-prompt-config.mjs:7、scripts/check-resultdata.mjs:12、scripts/check-term-structure.mjs:12、scripts/create-dhl-prompt-config.mjs:12、scripts/debug-format-issue.mjs:21、scripts/debug-hierarchical-export.mjs:12、scripts/list-batches.mjs:12、scripts/backfill-document-format-id.mjs:29
- **類別**：D（Secrets 與設定）
- **描述**：多數腳本以 `process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/...'` 形式內嵌本地連線字串與預設帳密（`postgres:postgres`）。雖屬本地開發預設值（非生產 secret），仍違反「不在原始碼硬編碼 connection string」的慣例（H4）。`check-batch3-simple.mjs:11` 更完全不讀 env、永遠連到硬編碼位址。另有資料庫名稱不一致（部分用 `ai_document_extraction`、部分用 `ai_doc_extraction`），可能導致誤連。
- **證據**：
  ```js
  // check-batch3-simple.mjs:10-12
  const pool = new Pool({
    connectionString: 'postgresql://postgres:postgres@localhost:5433/ai_document_extraction'
  });
  ```
- **建議**：統一改為僅讀取 `process.env.DATABASE_URL`（缺值即報錯），移除硬編碼 fallback；至少統一資料庫名稱。屬一次性開發/調試工具，風險限於本地，故列 Low。

### [Low] D-03 內部人員 email 硬編碼為腳本預設參數

- **檔案**：scripts/assign-admin-role.js:16（`TARGET_EMAIL = 'chris.lai@rapo.com.hk'`）、scripts/check-user.ts:11、scripts/fix-user-permissions.ts:28、scripts/grant-admin-access.ts:23
- **類別**：D（設定）/ E（PII）
- **描述**：四個腳本將特定真人內部 email 作為預設目標寫進原始碼。屬輕微 PII 洩漏（內部人員身分資訊進入版本庫），且使權限授予腳本預設指向特定帳號。
- **證據**：
  ```js
  // assign-admin-role.js:16
  const TARGET_EMAIL = 'chris.lai@rapo.com.hk';
  ```
- **建議**：改為必填 CLI 參數，缺省時報錯而非預設特定 email。

### [Low] E-01 check-user.ts 輸出帳號密碼存在性與長度

- **檔案**：scripts/check-user.ts:31-39
- **類別**：E（PII 與日誌）
- **描述**：腳本印出使用者 email、`hasPassword`、`passwordLength`、`isGlobalAdmin` 等。雖未印出明文密碼，洩漏密碼長度與帳號狀態屬不必要的敏感資訊輸出；為本地調試腳本，影響有限。
- **證據**：
  ```ts
  console.log('  - hasPassword:', !!user.password)
  console.log('  - passwordLength:', user.password?.length || 0)
  ```
- **建議**：移除 `passwordLength` 輸出；僅在確需驗證時輸出布林 `hasPassword`。

### [Info] A-01 權限提升腳本可由 CLI 參數建立/提升全域管理員

- **檔案**：scripts/grant-admin-access.ts:23-101、scripts/assign-admin-role.js、scripts/fix-user-permissions.ts:136-143、scripts/create-admin.ts:59-82
- **類別**：A（認證與授權）
- **描述**：`grant-admin-access.ts` 接受 argv email，若使用者不存在會「直接建立」一個 `isGlobalAdmin: true` 的新帳號並授予 System Admin + 全城市 FULL 權限；`fix-user-permissions.ts` 亦自我授權全域管理員。這些是設計上的管理 bootstrap 工具，需先具備本機 shell 與 DB 連線才能執行，非遠端可利用路徑，故列 Info。
- **證據**：
  ```ts
  // grant-admin-access.ts:57-73
  const newUser = await prisma.user.create({
    data: { email, name: email.split('@')[0], isGlobalAdmin: true, status: 'ACTIVE', ... }
  })
  await prisma.userRole.create({ data: { userId: newUser.id, roleId: systemAdminRole.id } })
  ```
- **建議**：確保此類腳本不被打包進可由 Web/部署環境觸發的路徑；維持僅供運維手動執行。

### [Info] K-01 e2e-test-plan-002.ts 硬編碼 SYSTEM_USER_ID 'dev-user-1' 與絕對路徑

- **檔案**：scripts/e2e-test-plan-002.ts:29-31
- **類別**：K（其他）
- **描述**：測試腳本硬編碼 `TEST_USER_ID = 'dev-user-1'`（即 FIX-054 處理過的型樣）與本機絕對路徑（`DOC_SAMPLE_DIR` / `REPORT_OUTPUT_DIR`）。屬測試專用、非生產執行路徑，無安全影響，僅記錄。
- **證據**：
  ```ts
  const TEST_USER_ID = 'dev-user-1';
  ```
- **建議**：無需即時處理；如未來進 CI 可改為環境變數。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 0 | 1 | 3 | 2 |

---

## 4. 區域整體觀察

- **無注入風險**：所有原始 SQL 皆安全。`check-review-queue.js` 的 `$queryRaw` 全為 tagged template（參數化）；`backfill-document-format-id.mjs`、`check-batch-config.mjs`、`check-format-id.mjs`、`check-extraction-structure.mjs`、`check-prompt-config.mjs` 使用 `$1` 參數化佔位符或靜態 SQL；`check-issuer-stats.mjs` 的 LIKE 為硬編碼常量。批次 ID 等外部輸入僅進入 Prisma 參數化查詢或經 `replace(/[^a-zA-Z0-9]/g,'-')` 清洗後組檔名，無 path traversal。
- **腳本性質**：本 scope 絕大多數為一次性調試/檢查/匯出工具，非部署執行路徑。唯一進入生產執行鏈的是 `docker-entrypoint.sh`（容器啟動 bootstrap + seed + server），本身無硬編碼 secret，依賴 env，設計合理（`set -e` 失敗即中止）。
- **系統性問題（縱深防禦缺層）**：~20 個腳本硬編碼本地 DB 連線字串與 `postgres:postgres` 預設憑證，且資料庫名稱不一致（`ai_document_extraction` vs `ai_doc_extraction`）。建議統一為僅讀 `DATABASE_URL`。
- **最需後續確認**：預設管理員密碼 `ChangeMe@2026!`（D-01）— 風險取決於 `prisma/` 的 `seed-prod-essential` 是否在生產沿用同一固定密碼，該邏輯不在本 scope，建議交由負責 prisma seed 的審查者驗證並決定是否強制改密/隨機化。
