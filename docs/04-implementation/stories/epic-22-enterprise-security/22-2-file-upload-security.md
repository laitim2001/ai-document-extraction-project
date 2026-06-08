# Story 22.2: 檔案上傳安全

**Status:** Planned

---

## ✅ 用戶決策確認（2026-04-28）

| ID | 決策 |
|----|------|
| **B4** | 病毒掃描採 **Azure Defender for Storage**（公司已使用），取代原預設的 ClamAV self-hosted 方案 |
| **B5** | 檔案大小上限 **15MB**（取代原預設的 50MB） |

**影響**：
- AC2 大小限制由 50MB 調整為 **15MB**（單檔），批量總額同步調整
- AC5 病毒掃描由 ClamAV docker container 切換為 **Azure Defender for Storage**（與 Azure Blob 原生整合）
- Tasks 1（ClamAV docker setup）、Tasks 3（clamscan SDK 整合）改為 **Azure Defender 配置 + Blob event-driven 掃描**
- 整體架構簡化（無需自管 ClamAV / freshclam / ACA persistent volume）
- 月成本：Azure Defender ~$10/storage account/月 vs ClamAV ~$0 但需自管維護成本

---

## Story

**As a** 系統安全管理員,
**I want** 系統對所有檔案上傳建立完整的安全防線（Magic number 驗證 + 隔離儲存 + 病毒掃描 + UUID 重命名）,
**So that** 攻擊者無法透過上傳惡意檔案攻擊系統，同時保證核心 Freight Invoice PDF 上傳功能（年處理 450,000-500,000 張）的兼容性與效能。

---

## 背景說明

### 問題陳述

Phase 2 盤點報告（`docs/08-security-and-governance/phase2-appsec-obs-assessment.md`）發現 **AppSec-05 評分 L1**（影響核心功能 Freight Invoice PDF 上傳，🔴 致命）：

| 項目 | 現況 | 強度 |
|------|------|------|
| MIME 類型驗證 | 客戶端 claim（`file.type`）白名單比對 | 🔴 弱（user-controllable） |
| 檔案副檔名驗證 | 從 MIME 推導，未檢查實際 file.name 後綴 | 🟡 中 |
| 大小限制 | 10MB / 20 files per batch | 🟢 強 |
| **Magic Number 驗證** | ❌ 無 | 🔴 **缺失** |
| **病毒掃描** | ❌ 無（無 ClamAV、無 Azure Defender） | 🔴 **缺失** |
| 檔名 sanitize | ❌ 無（保留 `file.name`） | 🟡 中 |
| **隔離儲存** | ❌ 無（直接寫入正式 container） | 🔴 **缺失** |
| 病毒掃描後處理 | ❌ 無（檔案上傳後立即觸發處理） | 🔴 **缺失** |

證據：
- `src/app/api/documents/upload/route.ts:289-304` 僅用 `isAllowedType(file.type)` + `isAllowedSize(file.size)`
- `src/app/api/documents/upload/route.ts:322` 保留原始檔名 `fileName: file.name`
- 全 codebase 搜尋 `virus|antivirus|clamav` 結果為 **0**
- 上傳目的地：Azure Blob Storage 共享 container，**無「隔離區」概念**

### 為何需要

| 需求 | 說明 |
|------|------|
| **核心入口防護** | Freight Invoice PDF 是核心業務入口（年 450K+ 張），是 #1 攻擊面 |
| **OWASP A03 / A05** | Injection（透過惡意 PDF）/ Security Misconfiguration |
| **法規合規** | ISO 27001 A.12.2 防惡意程式碼 |
| **防 Path Traversal** | 原始檔名可能含 `../../../etc/passwd`，需 UUID 重命名 |
| **防 ZIP Bomb / 加密 PDF DoS** | 大小限制 + 病毒掃描層配合 |

### Wave 3 必測項目（矩陣 v1.2 §3.3）

矩陣 v1.2 第 128 行明確列出 **5 項必測項目**，本 Story 必須在實作前 / 過程中全部覆蓋：

> **必測項目**：
> 1. 各種 PDF 格式（純文字、掃描件、加密、混合）
> 2. 部分掃描件 MIME type 異常的兼容性
> 3. 病毒掃描延遲對使用者體驗影響（建議 ≤ 3 秒）
> 4. 大小限制與業務最大檔案的相容性
> 5. 批量上傳（100+ 檔案）的兼容性
>
> **緩解**：提供 fallback 機制，異常檔案可由管理員審核後通過

### 設計決策

- **架構模式**：Quarantine container → Virus scan → Production container（隔離 + 掃描分流）
- **Magic Number 驗證庫**：採 npm `file-type` 套件（既有 codebase 中已有引用文字但未實際使用）
- **病毒掃描方案**：✅ **Azure Defender for Storage（B4, 2026-04-28 用戶決策）**— 公司已使用，與 Azure Blob 原生整合，取代原 ClamAV self-hosted 方案
- **檔名策略**：UUID 重命名（保留 `originalFileName` 在 DB 中以利顯示）
- **異常檔案處理**：建立 `ManualReviewQueue` — admin 可手動審核後通過或拒絕
- **Dual-mode 漸進啟用**：第 1 週 observe-only（log 不一致情況），第 2 週 enforce
- **批量處理**：MAX_FILES_PER_BATCH 從 20 提升至 100（與業務需求對齊），但每檔仍需通過全部驗證
- **單檔大小上限**：✅ **15MB（B5, 2026-04-28 用戶決策）**— 取代原 50MB 預設

---

## Acceptance Criteria

### AC1: Magic Number 驗證

**Given** 用戶上傳一個檔案，client 聲稱 MIME type 為 `application/pdf`
**When** 系統接收到檔案
**Then**
- 讀取檔案前 8 bytes
- 驗證 PDF magic number `25 50 44 46`（即 `%PDF`）
- 若 magic number 與 client claim 不一致 → 拒絕上傳，返回 RFC 7807 錯誤：
  ```json
  {
    "type": "https://docs.example.com/errors/file-upload/mime-mismatch",
    "title": "File type mismatch",
    "status": 400,
    "detail": "Declared file type does not match actual content",
    "instance": "/api/documents/upload"
  }
  ```
- 寫入 `SecurityLog`：`eventType=SUSPICIOUS_ACTIVITY, severity=MEDIUM, metadata: { fileName, claimedMime, actualMagic }`
- 支援的 MIME types：`application/pdf`、`image/jpeg`、`image/png`（與既有 ALLOWED_TYPES 一致）

### AC2: 檔案大小限制（含分層）

**Given** 系統大小限制配置
**When** 用戶上傳檔案
**Then**
- 單檔最大 **15MB**（✅ B5, 2026-04-28 用戶決策；從現有 10MB 提升，但低於原規劃 50MB）
- 批量單次最多 100 檔（從現有 20 提升）
- 全部 batch 總大小不超過 **150MB**（隨 15MB × 10 並發推算，可依環境變數調整）
- 透過環境變數可配置（`MAX_FILE_SIZE`、`MAX_FILES_PER_BATCH`、`MAX_BATCH_TOTAL_SIZE`）
- 超過大小時回應 413 Request Entity Too Large

### AC3: UUID 檔案重命名（防 Path Traversal）

**Given** 用戶上傳 `2025年1月-發票/../../etc/passwd.pdf`
**When** 系統儲存到 Blob Storage
**Then**
- 內部檔名使用 UUID v4：`<uuid>.<extension>`，例如 `f47ac10b-58cc-4372-a567-0e02b2c3d479.pdf`
- 副檔名從 magic number 推導（不信任 client 提供的副檔名）
- DB 中保留 `originalFileName` 欄位顯示給用戶（經過 sanitize，移除路徑分隔符）
- Blob 路徑：`<container>/<cityCode>/<yyyy-MM>/<uuid>.<ext>`，路徑中不含原始檔名

### AC4: 隔離儲存區（Quarantine Container）

**Given** 檔案通過 AC1, AC2, AC3 的初步驗證
**When** 系統儲存到 Azure Blob Storage
**Then**
- 先寫入 `quarantine` container（獨立於 `documents` 正式 container）
- DB `Document.processingStatus` 設為 `PENDING_VIRUS_SCAN`
- 觸發病毒掃描異步任務（透過 `ProcessingQueue` 排程）
- **掃描通過前**：用戶看到「處理中」狀態，但無法預覽、下載、處理
- **掃描通過後**：blob 從 quarantine 移到 documents container，狀態改為 `READY_FOR_PROCESSING`
- **掃描失敗**：blob 保留在 quarantine 並標記，狀態設為 `QUARANTINED`，寫入 SecurityLog
- 透過 Azure Blob lifecycle policy：quarantine 中超過 30 天的檔案自動刪除

### AC5: 病毒掃描整合（✅ B4, 2026-04-28 用戶決策：採 Azure Defender for Storage）

**Given** 檔案在 quarantine container
**When** Azure Defender for Storage 觸發掃描
**Then**
- 採用 **Azure Defender for Storage**（公司已使用，與 Azure Blob 原生整合）
- 透過 Azure Event Grid 訂閱 `Microsoft.Security.MalwareScanningResult` 事件
- 掃描結果分三種：
  - `No threats found`（CLEAN）→ 移到 production container，狀態 `READY_FOR_PROCESSING`
  - `Malicious`（INFECTED）→ 保留 quarantine，狀態 `QUARANTINED`，記錄威脅類型 / 簽名名稱
  - 掃描錯誤（含 `Unsupported`、`Skipped` 等狀態）→ 進入 `ManualReviewQueue`（admin 介入）
- 掃描 SLA 由 Azure Defender 託管（通常 ≤ 2 分鐘）；應用層採異步等待 + Event Grid callback 模式
- 病毒簽名庫由 Microsoft 託管，零自管維護
- **環境變數**：`AZURE_DEFENDER_EVENTGRID_TOPIC`、`AZURE_STORAGE_DEFENDER_ENABLED`、`VIRUS_SCAN_TIMEOUT_MS`
- **成本**：~$10/storage account/月（Azure Defender for Storage 訂閱費）

> 📋 ClamAV self-hosted 為**替代方案（未採用）**：原規劃透過 docker / ACA 自管 ClamAV + freshclam，但用戶已決策採 Azure Defender 簡化架構並提升託管度。

### AC6: 拒絕上傳清楚錯誤訊息（含 i18n + AuditLog）

**Given** 任何上傳被拒絕
**When** 系統返回錯誤
**Then**
- 錯誤訊息明確說明拒絕原因（i18n 三語齊全）：
  - MIME 不符 → `documents.upload.errors.mimeMismatch`
  - 大小超限 → `documents.upload.errors.tooLarge`
  - 病毒檢測 → `documents.upload.errors.virusDetected`
  - 加密 PDF 無法掃描 → `documents.upload.errors.encryptedPdf`
  - 掃描失敗（系統錯誤）→ `documents.upload.errors.scanFailed`
- 拒絕原因記錄到 `AuditLog`：`action=REJECT, resourceType=Document, metadata: { reason, fileName, claimedMime, fileSize }`
- 拒絕時不在 Blob Storage 留下檔案（避免儲存空間浪費）

### AC7: PDF 兼容性測試（必測項目 #1）

**Given** 各種 PDF 格式
**When** 用戶上傳
**Then** 以下類型全部能成功通過驗證並進入處理：
- ✅ 純文字 PDF（如 Adobe Acrobat 直接生成的發票）
- ✅ 掃描件 PDF（OCR 預處理前）
- ✅ 混合內容 PDF（部分文字 + 部分掃描）
- ✅ 含圖片的 PDF（高解析度發票圖片）
- ⚠️ **加密 PDF**：因 Azure Defender for Storage 無法掃描加密檔案內容，分兩種處理：
  - 用戶端密碼加密 → 拒絕並提示「請移除 PDF 密碼後重新上傳」
  - 證書加密 → 拒絕並進入 ManualReviewQueue 由 admin 決定
- 測試集：5,000+ 既有已上傳 PDF 全部測試一遍，建立 magic number whitelist

### AC8: 異常 MIME 兼容性（必測項目 #2）

**Given** 部分掃描器產生的 PDF MIME 為非標準（如 `image/pdf`、`application/octet-stream`）
**When** 系統接收這類檔案
**Then**
- **以 magic number 為準**：若 magic number 是有效 PDF（`%PDF`），則覆蓋客戶端 claim 的 MIME
- 寫入 log（不算 security event，僅 info）：「Client MIME ${claimedMime} corrected to application/pdf based on magic number」
- 檔案正常通過後續驗證
- 統計過去 30 天的「MIME 自動修正」事件，admin 可在 `/admin/security/mime-anomalies` 頁查詢

### AC9: 病毒掃描效能測試（必測項目 #3）

**Given** 100 個檔案的批量上傳
**When** 系統執行病毒掃描（Azure Defender for Storage 託管）
**Then**
- **平均掃描完成時間 ≤ 2 分鐘/檔**（Azure Defender SLA，含 Event Grid 觸發 → 結果回寫）
- **P95 掃描完成時間 ≤ 5 分鐘/檔**
- **應用層採異步等待 + Event Grid callback 模式**（不阻塞用戶上傳請求）
- 上傳 API 立即返回 `202 Accepted`，用戶介面顯示「掃描中」狀態並輪詢
- 100 檔批量上傳：上傳本身 ≤ 60 秒；掃描 + 移轉到 production 整體 ≤ 10 分鐘（Azure Defender 並行處理多檔）

> 📋 與原 ClamAV 預估比較：ClamAV 為單檔同步掃描（avg ≤ 3 秒/檔），但需自管 worker pool；Azure Defender 為託管異步處理，單檔延遲較大但無自管成本，整體吞吐量在 100+ 檔批量場景下相近。

### AC10: 拒絕已知惡意檔案（EICAR Test）

**Given** EICAR 測試檔案（行業標準病毒測試 string）
**When** 上傳到系統
**Then**
- Azure Defender for Storage 必偵測為 `EICAR-Test-File`（或 Microsoft Defender 對應簽名名稱）
- 系統將檔案保留在 quarantine container
- 狀態標記為 `QUARANTINED`，virus name 記錄為 Azure Defender 回傳的威脅名稱
- 寫入 SecurityLog：`eventType=SUSPICIOUS_ACTIVITY, severity=CRITICAL, metadata: { virusName, ipAddress, userId }`
- 觸發告警（與 CHANGE-066 安全告警整合）
- 用戶看到錯誤訊息：「您的檔案包含已知惡意內容，已被攔截。」

### AC11: 批量上傳兼容性（必測項目 #5）

**Given** 用戶批量上傳 100 個發票
**When** 系統處理
**Then**
- 100 檔在前端分批上傳（每批 10 檔，避免單次 request 過大）
- 後端每檔獨立進行 magic number + 病毒掃描
- 任一檔失敗不影響其他檔（部分成功 / 部分失敗模式）
- 用戶看到清楚的「成功 / 失敗 / 待審」報告
- 服務帳號（n8n / SharePoint sync）走獨立配額（與 CHANGE-059 配合）
- 全程不超過 5 分鐘

### AC12: Manual Review Queue（Fallback 機制）

**Given** 檔案因「掃描錯誤」、「加密 PDF（證書）」、「異常 MIME 但 magic number 也異常」進入待審
**When** 任務進入 ManualReviewQueue
**Then**
- DB `Document.processingStatus = MANUAL_REVIEW`
- 在 `/admin/manual-review-queue` 頁顯示待審清單
- Admin 可：
  - 通過：呼叫 `POST /api/admin/manual-review/[id]/approve`，檔案移到 production container
  - 拒絕：呼叫 `POST /api/admin/manual-review/[id]/reject`，檔案保留 quarantine + log
- 所有操作寫入 AuditLog
- 用戶在 dashboard 看到「等待管理員審核」狀態

### AC13: E2E 測試覆蓋全部場景

**Given** Playwright E2E 測試套件
**When** CI 執行
**Then** 以下場景全部通過：
- ✅ 上傳合法 PDF → 正常處理
- ✅ 上傳偽裝 .exe（claim 為 PDF）→ 拒絕 + SecurityLog
- ✅ 上傳超大檔案（16MB，超過 15MB 上限）→ 413 錯誤
- ✅ 上傳 EICAR 測試檔 → CRITICAL SecurityLog + 用戶友善錯誤
- ✅ 上傳加密 PDF（密碼）→ 拒絕並提示
- ✅ 批量上傳 100 檔正常 PDF → 全部 ≤ 5 分鐘完成
- ✅ Admin 解封 manual review 檔案
- ✅ Path traversal 嘗試（檔名 `../../etc/passwd.pdf`）→ UUID 重命名生效

---

## Tasks / Subtasks

- [ ] **Task 1: 基礎建設 — Azure Defender for Storage 配置** (AC: #5, #9) ✅ B4 用戶決策（2026-04-28）
  - [ ] 1.1 啟用 storage account 的 Microsoft Defender for Storage（透過 Azure Portal 或 Bicep）
  - [ ] 1.2 訂閱 Event Grid topic 接收 `Microsoft.Security.MalwareScanningResult` 事件
  - [ ] 1.3 建立 webhook endpoint `POST /api/internal/defender-scan-callback` 接收 Event Grid 通知
  - [ ] 1.4 health check：驗證 Defender plan 啟用狀態 + Event Grid subscription 健康
  - [ ] 1.5 在 Bicep IaC（CHANGE-055 / CHANGE-069）中加入 Defender plan 配置
  - [ ] 1.6 本機開發環境：Azurite 不支援 Defender，採 mock 模式（環境變數 `AZURE_DEFENDER_MOCK=true` → 直接返回 CLEAN）

> 📋 原 Task 1（Docker ClamAV）已被 B4 用戶決策取代，轉為「替代方案（未採用）」記錄保留於 Tech Spec。

- [ ] **Task 2: Magic Number 驗證模組** (AC: #1, #8)
  - [ ] 2.1 安裝 npm 套件 `file-type`（v18+，純 ESM 需確認 Next.js 兼容）
  - [ ] 2.2 建立 `src/lib/upload/magic-number.ts`
  - [ ] 2.3 實作 `validateMagicNumber(buffer: Buffer, claimedMime: string): MagicNumberResult`
  - [ ] 2.4 實作 `normalizeMimeType(buffer, claimedMime)` — 異常 MIME 自動修正
  - [ ] 2.5 加入單元測試（依賴 Story 22-5 完成 Vitest 後補齊）

- [ ] **Task 3: 病毒掃描服務（Azure Defender 整合）** (AC: #5, #9, #10) ✅ B4 用戶決策（2026-04-28）
  - [ ] 3.1 建立 `src/services/security/azure-defender-scan.service.ts`（取代原 ClamAV `virus-scan.service.ts`）
  - [ ] 3.2 實作 `subscribeScanResult(documentId): Promise<ScanResult>`（CLEAN / INFECTED / SCAN_ERROR）— 透過 Event Grid 訂閱
  - [ ] 3.3 實作 Event Grid webhook handler `handleDefenderScanCallback(event)`
  - [ ] 3.4 加入 timeout 機制（5 分鐘/檔，超時轉 ManualReview）
  - [ ] 3.5 EICAR 測試檔自我驗證（部署後 smoke test，驗證 Azure Defender 訂閱正常）
  - [ ] 3.6 Mock 模式（本機開發）：直接返回 CLEAN，不依賴 Azure Defender

- [ ] **Task 4: Quarantine Container 架構** (AC: #4)
  - [ ] 4.1 在 Azure Blob Storage 新增 `quarantine` container
  - [ ] 4.2 修改 `src/services/blob-storage.service.ts` 新增 `uploadToQuarantine`、`moveToProduction`、`markAsInfected`
  - [ ] 4.3 配置 lifecycle policy（quarantine 中 30 天自動刪除）
  - [ ] 4.4 在 Bicep IaC 中配置雙 container（與 CHANGE-055 同步）

- [ ] **Task 5: Document Model 與 Schema 變更** (AC: #4, #6, #12)
  - [ ] 5.1 在 `Document` model 新增 `originalFileName`、`storedFileName`、`fileHash`（SHA-256）、`virusScanStatus`、`virusScanResult`、`virusName?`、`scannedAt?`
  - [ ] 5.2 新增 `ProcessingStatus` 列舉值：`PENDING_VIRUS_SCAN`、`QUARANTINED`、`MANUAL_REVIEW`
  - [ ] 5.3 新增 `ManualReviewQueue` model（id, documentId, reason, status, reviewedBy?, reviewNote?）
  - [ ] 5.4 執行 `prisma db push --accept-data-loss`

- [ ] **Task 6: Upload API 改寫** (AC: #1, #2, #3, #4, #6)
  - [ ] 6.1 修改 `src/app/api/documents/upload/route.ts`
  - [ ] 6.2 加入 magic number 驗證（拒絕不符）
  - [ ] 6.3 改用 UUID 檔名 + 保留 originalFileName
  - [ ] 6.4 上傳到 quarantine container（不再直接到 documents）
  - [ ] 6.5 觸發病毒掃描異步任務（透過 `ProcessingQueue` push 任務）
  - [ ] 6.6 大小限制：**單檔 15MB / 100 檔 / 150MB total**（✅ B5 用戶決策 2026-04-28）
  - [ ] 6.7 統一 RFC 7807 錯誤格式（top-level）

- [ ] **Task 7: 病毒掃描異步任務** (AC: #5, #9)
  - [ ] 7.1 建立 `src/services/queue/virus-scan-job.service.ts`
  - [ ] 7.2 從 ProcessingQueue 取出待掃描任務
  - [ ] 7.3 從 quarantine 下載 → 掃描 → 移動到 production / 標記
  - [ ] 7.4 失敗重試 3 次（exponential backoff）
  - [ ] 7.5 與既有 unified-processor 整合（掃描通過後才觸發 V3.1 提取流程）

- [ ] **Task 8: Manual Review Queue UI** (AC: #12)
  - [ ] 8.1 建立 `src/app/[locale]/(dashboard)/admin/manual-review-queue/page.tsx`
  - [ ] 8.2 建立 `src/components/features/admin/ManualReviewList.tsx`
  - [ ] 8.3 新增 API: `GET /api/admin/manual-review-queue`、`POST /api/admin/manual-review/[id]/approve`、`POST /api/admin/manual-review/[id]/reject`
  - [ ] 8.4 權限要求：`USER_MANAGE` + `INVOICE_MANAGE`

- [ ] **Task 9: i18n 翻譯** (AC: #6)
  - [ ] 9.1 在 `messages/en/documents.json` 新增 `upload.errors.mimeMismatch`、`upload.errors.tooLarge`、`upload.errors.virusDetected`、`upload.errors.encryptedPdf`、`upload.errors.scanFailed`
  - [ ] 9.2 同步翻譯到 `messages/zh-TW/documents.json` 與 `messages/zh-CN/documents.json`
  - [ ] 9.3 新增 `admin.manualReview.*` namespace
  - [ ] 9.4 執行 `npm run i18n:check`

- [ ] **Task 10: 既有 5,000+ PDF 兼容性驗證腳本** (AC: #7, #8)
  - [ ] 10.1 建立 `scripts/security/validate-existing-pdfs.ts`
  - [ ] 10.2 從 production blob 取出已上傳 PDF
  - [ ] 10.3 跑 magic number 驗證 + 病毒掃描
  - [ ] 10.4 產生 whitelist 報告（哪些檔案 magic number 異常但屬合法）
  - [ ] 10.5 用於 dual-mode observe phase 做 baseline

- [ ] **Task 11: Dual-mode 漸進啟用** (AC: #7, #8)
  - [ ] 11.1 加入環境變數 `FILE_UPLOAD_STRICT_MODE=false`（observe phase）/ `true`（enforce phase）
  - [ ] 11.2 observe phase 期間：log 不一致情況到 `docs/08-security-and-governance/upload-observation/` 目錄
  - [ ] 11.3 1-2 週後切換到 enforce
  - [ ] 11.4 切換時更新 sprint-status.yaml

- [ ] **Task 12: E2E 測試套件** (AC: #13)
  - [ ] 12.1 建立 `tests/e2e/security/file-upload.spec.ts`
  - [ ] 12.2 涵蓋 AC13 所有 8 個場景
  - [ ] 12.3 EICAR 檔案放在 `tests/fixtures/security/`（gitignore 中加入 `*.exe.test`，避免誤掃毒）
  - [ ] 12.4 整合到 CI（與 Story 22-4 配合）

- [ ] **Task 13: 監控與告警整合** (AC: #10)
  - [ ] 13.1 與 CHANGE-066（5 條安全告警）整合
  - [ ] 13.2 告警規則：「過去 1 小時 INFECTED 事件 ≥ 3 次」→ 通知 admin
  - [ ] 13.3 Dashboard 顯示「過去 30 天 quarantine 統計」

---

## Dev Notes

### 依賴項

- **強制前置**：Story 22-5（測試框架）— 大量單元測試 + E2E 測試需先有測試基礎
- **建議前置**：Story 22-4（CI/CD）— 確保新測試自動跑
- **配套**：CHANGE-055（Azure 部署計畫）— Azure ACA 環境的 ClamAV 部署架構需協調
- **配套**：CHANGE-066（安全告警）— 病毒檢測告警

### 影響的檔案

```
docker-compose.yml                                         # 更新：新增 clamav service

prisma/schema.prisma                                       # 更新：Document model + ManualReviewQueue + ProcessingStatus enum

src/lib/upload/
├── constants.ts                                          # 更新：MAX_FILE_SIZE 提升、MAX_FILES_PER_BATCH 提升
└── magic-number.ts                                       # 新增

src/services/security/
└── virus-scan.service.ts                                 # 新增

src/services/blob-storage.service.ts                      # 更新：新增 quarantine 操作

src/services/queue/
└── virus-scan-job.service.ts                            # 新增

src/services/documents/
└── *                                                     # 多處更新（quarantine flow）

src/app/api/documents/upload/route.ts                     # 重大改寫
src/app/api/admin/manual-review-queue/route.ts            # 新增
src/app/api/admin/manual-review/[id]/approve/route.ts     # 新增
src/app/api/admin/manual-review/[id]/reject/route.ts      # 新增

src/app/[locale]/(dashboard)/admin/manual-review-queue/
└── page.tsx                                              # 新增

src/components/features/admin/
└── ManualReviewList.tsx                                  # 新增

messages/{en,zh-TW,zh-CN}/
├── documents.json                                        # 更新：upload.errors.*
└── admin.json                                            # 更新：manualReview.*

scripts/security/
└── validate-existing-pdfs.ts                             # 新增

tests/e2e/security/
└── file-upload.spec.ts                                   # 新增

tests/fixtures/security/
└── eicar.test.txt                                        # 新增（EICAR 測試簽名）
```

### Wave 3 必測項目對應追蹤表

| 必測項目 | AC 編號 | Task 編號 | 風險 |
|----------|--------|-----------|------|
| 1. 各種 PDF 格式 | AC7 | Task 10, 12 | 加密 PDF 處理 |
| 2. 異常 MIME 兼容性 | AC8 | Task 2, 10 | 部分掃描器產出 |
| 3. 病毒掃描延遲 ≤ 3 秒 | AC9 | Task 3, 7 | UX 影響 |
| 4. 大小限制 | AC2 | Task 6 | 業務最大檔需求驗證 |
| 5. 批量 100+ 檔 | AC11 | Task 6, 7 | 並發效能 |

### 病毒掃描架構選型取捨（✅ B4 已決策 2026-04-28）

| 選項 | 優點 | 缺點 | 採用狀態 |
|------|------|------|----------|
| ClamAV self-hosted | 開源免費；本地 + Azure 環境一致；資料不外傳 | 需維護病毒庫；資源消耗 | ❌ **替代方案（未採用）** |
| **Azure Defender for Storage（採用）** | 託管；與 Azure Blob 原生整合；零維護；公司已使用 | 額外費用 ~$10/storage account/月；綁定 Azure | ✅ **採用（B4, 2026-04-28）** |
| Hybrid | 主用 ClamAV，重要檔案雙掃 | 複雜度高 | ❌ 未採用 |

**結論**：本 Story 採 Azure Defender for Storage，公司已使用此服務，無需自管 ClamAV，與 Azure Blob 原生整合，並透過 Event Grid 接收掃描結果回調。

### Azure 部署考量（✅ B4 採 Azure Defender for Storage）

- 啟用方式：透過 Bicep 設定 `Microsoft.Security/pricings` resource，將 storage account 加入 Defender 訂閱
- Event Grid Topic：每個 storage account 自動建立一個 system topic，訂閱 `Microsoft.Security.MalwareScanningResult`
- 應用層（ACA Web App）僅需 inbound webhook endpoint（不需 outbound 連線到 ClamAV / freshclam）
- 不需自管 persistent volume / docker container / 病毒庫更新流程
- 本機開發：Azurite 不支援 Defender，採 mock 模式（環境變數開關）

> 📋 原 ClamAV ACA 部署考量章節（internal-only 服務 / NAT Gateway / Azure Files persistent volume）已被 B4 用戶決策取代，移為「替代方案參考」。

### Fallback 機制設計

矩陣 v1.2 §3.3 明確要求「**緩解：提供 fallback 機制，異常檔案可由管理員審核後通過**」。本 Story 透過 Task 8 的 `ManualReviewQueue` 實現：

- 任何「無法判斷」的情況 → 不直接拒絕，而是進入 manual review
- Admin 看到清楚的拒絕原因（原始檔名、MIME claim、magic 結果、scan 結果）
- 可手動 approve（檔案進入 production）或 reject（永久 quarantine）

### Rollback Plan（若兼容性問題影響業務）

若 enforce phase 啟用後發現業務影響：
1. **緊急**：環境變數 `FILE_UPLOAD_STRICT_MODE=false` 立即降級回 observe phase（5 分鐘）
2. **短期**：分析 observation log，調整 magic number whitelist
3. **長期**：若特定客戶有業務必要的「異常 PDF」，加入 ManualReviewQueue 但 admin 全部 approve（保留 audit）

### 關聯 CHANGE / FIX 文件

- **配套**：CHANGE-055 — Azure 部署計畫（含 ClamAV ACA 配置）
- **配套**：CHANGE-066 — 安全告警（病毒檢測告警規則）
- **配套**：Story 22-5 — Vitest 測試框架（Task 12 E2E 測試需要）
- **配套**：Story 22-4 — CI/CD（測試自動執行）
- **後續**：考慮新建 CHANGE-XXX 整合 Azure Defender for Storage（部署後評估）

---

## Implementation Notes

> 此區塊在 Story 完成後補上實作摘要、技術決策、效能基準資料、與最終的檔案清單。

---

## Related Files

- `docker-compose.yml` - 更新（新增 clamav）
- `prisma/schema.prisma` - 更新（Document, ManualReviewQueue, enum）
- `src/lib/upload/constants.ts` - 更新
- `src/lib/upload/magic-number.ts` - 新增
- `src/services/security/virus-scan.service.ts` - 新增
- `src/services/queue/virus-scan-job.service.ts` - 新增
- `src/app/api/documents/upload/route.ts` - 重大改寫
- `src/app/api/admin/manual-review-queue/route.ts` - 新增
- `src/app/api/admin/manual-review/[id]/{approve,reject}/route.ts` - 新增
- `src/app/[locale]/(dashboard)/admin/manual-review-queue/page.tsx` - 新增
- `src/components/features/admin/ManualReviewList.tsx` - 新增
- `messages/{en,zh-TW,zh-CN}/{documents,admin}.json` - 更新
- `tests/e2e/security/file-upload.spec.ts` - 新增
- `scripts/security/validate-existing-pdfs.ts` - 新增
- Tech Spec: `docs/04-implementation/tech-specs/epic-22-enterprise-security/tech-spec-story-22-2.md`
