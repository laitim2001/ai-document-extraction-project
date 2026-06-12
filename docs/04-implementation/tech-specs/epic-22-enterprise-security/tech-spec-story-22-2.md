# Tech Spec: Story 22.2 - 檔案上傳安全

> **Version**: 1.1.0
> **Created**: 2026-04-28
> **Last Updated**: 2026-04-28（B4 + B5 用戶決策套用）
> **Status**: Draft
> **Story Key**: STORY-22-2

---

## ✅ 用戶決策（2026-04-28）

| ID | 決策 | 影響章節 |
|----|------|----------|
| **B4** | 病毒掃描採 **Azure Defender for Storage**（公司已使用） | Architecture Overview、API Changes、Performance、Environment Variables |
| **B5** | 單檔大小上限 **15MB**（取代原預設 50MB） | AC-22.2.2、Pipeline Step 2、Environment Variables、Performance |

**架構級影響**：
- 病毒掃描服務由「ClamAV docker container（self-hosted）」改為「Azure Defender for Storage（Microsoft 託管）」
- 應用層改採異步 Event Grid callback 模式（不需 ClamAV worker pool / clamd socket）
- 月成本：Azure Defender ~$10/storage account vs ClamAV $0 + 自管成本
- 大小限制：50MB → **15MB**（單檔），對應 batch total 由 500MB 調整為 150MB

---

## Overview

| 項目 | 內容 |
|------|------|
| **Story ID** | 22.2 |
| **Epic** | Epic 22 — Enterprise Security & Governance |
| **Estimated Effort** | 13 Story Points（約 10-14 天）|
| **Dependencies** | Story 22-5（測試框架）、CHANGE-055（Azure 部署計畫）|
| **Blocking** | — |
| **對應風險** | AppSec-05（L1 → L3，🔴 致命，影響核心 Freight Invoice PDF 上傳）|

---

## Objective

針對核心業務入口（年處理 450,000-500,000 張 Freight Invoice PDF 上傳）建立企業級檔案上傳安全防線：Magic Number 驗證 + 隔離儲存區（Quarantine）+ 病毒掃描（ClamAV）+ UUID 重命名 + 異常 fallback（ManualReviewQueue）。**特別強調 Wave 3 矩陣 v1.2 §3.3 的 5 項必測項目**，並設計 dual-mode 漸進啟用機制以避免影響業務。

---

## Acceptance Criteria Mapping

| AC ID | 驗收條件 | 實現方式 |
|-------|----------|----------|
| AC-22.2.1 | Magic Number 驗證（前 8 bytes）| `magic-number.ts` + `file-type` npm |
| AC-22.2.2 | 大小限制（**15MB** / 100 檔 / **150MB** total，✅ B5）| 環境變數 + 多層檢查 |
| AC-22.2.3 | UUID 重命名（防 path traversal）| Upload route 改寫 |
| AC-22.2.4 | Quarantine container 隔離 | 雙 Blob container + lifecycle policy |
| AC-22.2.5 | **Azure Defender for Storage** 病毒掃描（✅ B4）| Defender plan + Event Grid callback |
| AC-22.2.6 | i18n 拒絕訊息 + AuditLog | 三語翻譯 + RFC 7807 + AuditLog 寫入 |
| AC-22.2.7 | PDF 兼容性（5 種格式）| 5,000+ 既有 PDF whitelist |
| AC-22.2.8 | 異常 MIME 自動修正 | Magic number 為準 |
| AC-22.2.9 | 病毒掃描效能 ≤ 3 秒 | Worker pool（5 並發）|
| AC-22.2.10 | EICAR 測試檔拒絕 | Self-test on startup |
| AC-22.2.11 | 100 檔批量上傳 | 前端分批 + 後端並發 |
| AC-22.2.12 | ManualReviewQueue fallback | 新 model + admin UI |
| AC-22.2.13 | E2E 測試覆蓋 8 場景 | Playwright spec |

---

## Architecture Overview

### 病毒掃描架構選型取捨（✅ B4 用戶決策 2026-04-28）

| 選項 | 月成本（10K 上傳）| 維護成本 | 部署複雜度 | 資料合規 | 採用狀態 |
|------|------------------|----------|------------|----------|----------|
| A. ClamAV self-hosted | $0（OSS）| 中（病毒庫更新自動，但需監控）| 中（docker / ACA service）| 資料不出系統 | ❌ **替代方案（未採用）** |
| **B. Azure Defender for Storage** | ~$10/storage account | 低（託管）| 低（Bicep + Event Grid 配置）| Microsoft 託管處理 | ✅ **採用（B4）** |
| C. VirusTotal API | ~$200+ | 低 | 低 | 上傳到 VT 公開 | ❌ 不適合 |

**Tech Spec 已採 Option B（Azure Defender for Storage）**：公司已使用此服務，與 Azure Blob 原生整合，零自管維護，透過 Event Grid 接收 `Microsoft.Security.MalwareScanningResult` 事件。原 Option A（ClamAV）保留為「替代方案參考」，未來若 Azure 環境更換或需離線部署可再評估。

### 完整資料流

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        File Upload Security Pipeline                          │
└────────────────────────────────────────────────────────────────────────────┘

  User selects 100 PDFs
       ↓
  [Frontend] Splits into 10 batches × 10 files
       ↓
  POST /api/documents/upload (per batch)
       ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 1: 認證與權限（既有）                                       │
  │  • NextAuth session check                                        │
  │  • INVOICE_CREATE permission                                     │
  │  • cityCode permission（既有 RLS context）                       │
  └─────────────────────────────────────────────────────────────────┘
       ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 2: 大小檢查（AC2，✅ B5 用戶決策 2026-04-28）              │
  │  • Single file ≤ 15MB                                            │
  │  • Batch total ≤ 150MB                                           │
  │  • Files per batch ≤ 100                                         │
  │  → 413 Request Entity Too Large if exceeded                      │
  └─────────────────────────────────────────────────────────────────┘
       ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 3: Magic Number 驗證（AC1, AC8）                            │
  │  • Read first 8 bytes via file-type npm                          │
  │  • Compare with claimed MIME                                     │
  │  • 自動修正（normalize）異常 MIME                                │
  │  → 400 + SecurityLog if mismatch and uncorrectable               │
  └─────────────────────────────────────────────────────────────────┘
       ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 4: UUID 重命名 + 路徑生成（AC3）                            │
  │  • storedFileName = `${uuidv4()}.${ext_from_magic}`              │
  │  • blobPath = `${cityCode}/${yyyy-MM}/${storedFileName}`         │
  │  • DB 保留 originalFileName（sanitized）                         │
  └─────────────────────────────────────────────────────────────────┘
       ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 5: 上傳到 Quarantine Container（AC4）                       │
  │  • blobStorageService.uploadToQuarantine(buffer, blobPath)       │
  │  • Document.processingStatus = PENDING_VIRUS_SCAN                │
  │  • Push job 到 ProcessingQueue                                   │
  └─────────────────────────────────────────────────────────────────┘
       ↓
  Response 202 Accepted: { documents: [{id, status: 'PENDING_VIRUS_SCAN'}] }

       (async)
       ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │ Step 6: 病毒掃描（Azure Defender for Storage，✅ B4）            │
  │  • 模式: Async via Event Grid callback                           │
  │  • Per-file SLA: ≤ 2 min (avg), ≤ 5 min (P95)                    │
  │  • Timeout: 5 min/檔，超時轉 ManualReviewQueue                  │
  │                                                                   │
  │  result = await waitForDefenderScan(documentId)                  │
  │  // Event Grid webhook callback 觸發 result 寫回                 │
  │                                                                   │
  │  ┌─ CLEAN ──────────────────────────────────────────┐            │
  │  │  • Move blob: quarantine → documents             │            │
  │  │  • Document.processingStatus = READY_FOR_PROCESSING │            │
  │  │  • Trigger V3.1 extraction pipeline              │            │
  │  └──────────────────────────────────────────────────┘            │
  │                                                                   │
  │  ┌─ INFECTED ───────────────────────────────────────┐            │
  │  │  • Keep in quarantine, set virusName             │            │
  │  │  • Document.processingStatus = QUARANTINED       │            │
  │  │  • SecurityLog: SUSPICIOUS_ACTIVITY, CRITICAL    │            │
  │  │  • Trigger CHANGE-066 alert                      │            │
  │  └──────────────────────────────────────────────────┘            │
  │                                                                   │
  │  ┌─ SCAN_ERROR ─────────────────────────────────────┐            │
  │  │  • Move to ManualReviewQueue                     │            │
  │  │  • Document.processingStatus = MANUAL_REVIEW     │            │
  │  └──────────────────────────────────────────────────┘            │
  └─────────────────────────────────────────────────────────────────┘
```

### 部署架構（Local Dev / Azure，✅ B4 用戶決策 2026-04-28）

```
┌──────────────────────────────────────────────────────────────────┐
│                     Local Dev (docker-compose)                     │
│                                                                    │
│   [Next.js Container] ─── (mock mode) ──► AZURE_DEFENDER_MOCK=true │
│         port: 3000                          → 直接返回 CLEAN       │
│                                                                    │
│   [Azurite] (Blob 模擬)                                            │
│   - container: documents                                           │
│   - container: quarantine ← 新增                                   │
│   ⚠️ Azurite 不支援 Azure Defender for Storage                    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│              Azure Container Apps (CHANGE-055)                     │
│                                                                    │
│   [App ACA Service]                                                │
│        │                                                           │
│        │ ┌── inbound webhook ──┐                                  │
│        │ │  POST /api/internal/                                    │
│        │ │   defender-scan-callback                                │
│        │ └─────────────────────┘                                   │
│        ▼                                                           │
│   [Azure Blob Storage]                                             │
│   - documents container（existing）                                │
│   - quarantine container（new）                                    │
│     • Lifecycle: 30 day auto-delete                                │
│     • Access tier: Hot                                             │
│     • ✅ Microsoft Defender for Storage 已啟用（B4 用戶決策）     │
│                                                                    │
│   [Azure Event Grid (system topic)] ────► Webhook callback        │
│   - Topic: storage.malwareScanningResult                           │
│   - Subscription: 推送至 ACA Web App                              │
│                                                                    │
│   [Microsoft Defender for Storage]                                 │
│   - 託管病毒掃描（每月 ~$10/storage account）                     │
│   - 病毒簽名庫由 Microsoft 維護                                   │
└──────────────────────────────────────────────────────────────────┘
```

> 📋 原 ClamAV docker / ACA 架構（含 freshclam / Azure Files persistent volume）為**替代方案（未採用）**。

---

## File Upload Pipeline

### Magic Number 驗證模組

```typescript
// src/lib/upload/magic-number.ts

import { fileTypeFromBuffer, type FileTypeResult } from 'file-type';

export interface MagicNumberResult {
  valid: boolean;
  detectedMime: string | null;
  detectedExt: string | null;
  shouldNormalize: boolean;       // 是否應自動修正客戶端 claim
  rejectionReason?: string;
}

const ALLOWED_MIME_TO_EXT: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
};

const KNOWN_ANOMALY_MIME: Record<string, string> = {
  // 部分掃描器產出的異常 MIME（自動修正）
  'image/pdf': 'application/pdf',
  'application/octet-stream': 'application/pdf',  // 僅當 magic number 是 PDF
};

export async function validateMagicNumber(
  buffer: Buffer,
  claimedMime: string
): Promise<MagicNumberResult> {
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    return {
      valid: false,
      detectedMime: null,
      detectedExt: null,
      shouldNormalize: false,
      rejectionReason: 'Unable to detect file type from content',
    };
  }

  // 1. 直接匹配
  if (claimedMime === detected.mime) {
    return {
      valid: true,
      detectedMime: detected.mime,
      detectedExt: detected.ext,
      shouldNormalize: false,
    };
  }

  // 2. 已知異常 MIME 自動修正
  if (KNOWN_ANOMALY_MIME[claimedMime] === detected.mime) {
    return {
      valid: true,
      detectedMime: detected.mime,
      detectedExt: detected.ext,
      shouldNormalize: true,    // 表示已自動修正
    };
  }

  // 3. claim 與 detected 不符且不在已知異常清單中 → 拒絕
  return {
    valid: false,
    detectedMime: detected.mime,
    detectedExt: detected.ext,
    shouldNormalize: false,
    rejectionReason: `Declared ${claimedMime} but content is ${detected.mime}`,
  };
}
```

### 病毒掃描服務（✅ B4 採 Azure Defender for Storage）

```typescript
// src/services/security/azure-defender-scan.service.ts

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export type ScanResultType = 'CLEAN' | 'INFECTED' | 'SCAN_ERROR';

export interface ScanResult {
  result: ScanResultType;
  virusName?: string;        // Microsoft Defender 回傳的 threat name
  scanDurationMs: number;
  scannerSource: 'azure-defender' | 'mock';
}

export class AzureDefenderScanService {
  private readonly mockMode: boolean;
  private readonly timeoutMs: number;

  constructor() {
    this.mockMode = process.env.AZURE_DEFENDER_MOCK === 'true';
    this.timeoutMs = parseInt(process.env.VIRUS_SCAN_TIMEOUT_MS || '300000');  // 5 min
  }

  /**
   * 等待 Azure Defender 完成掃描（透過 Event Grid callback 寫回 DB）。
   * 採輪詢 DB document.virusScanStatus 直到結果寫回或 timeout。
   */
  async waitForScanResult(documentId: string): Promise<ScanResult> {
    if (this.mockMode) {
      logger.info('AzureDefenderScanService: mock mode, returning CLEAN', { documentId });
      return { result: 'CLEAN', scanDurationMs: 0, scannerSource: 'mock' };
    }

    const start = Date.now();
    const deadline = start + this.timeoutMs;

    while (Date.now() < deadline) {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { virusScanStatus: true, virusName: true, scannedAt: true },
      });

      if (doc?.virusScanStatus === 'CLEAN') {
        return { result: 'CLEAN', scanDurationMs: Date.now() - start, scannerSource: 'azure-defender' };
      }
      if (doc?.virusScanStatus === 'INFECTED') {
        return {
          result: 'INFECTED',
          virusName: doc.virusName ?? 'Unknown threat',
          scanDurationMs: Date.now() - start,
          scannerSource: 'azure-defender',
        };
      }

      await new Promise((r) => setTimeout(r, 5000));  // 5 秒輪詢
    }

    return {
      result: 'SCAN_ERROR',
      scanDurationMs: Date.now() - start,
      scannerSource: 'azure-defender',
    };
  }
}

// src/app/api/internal/defender-scan-callback/route.ts
// Event Grid webhook handler — 由 Azure Defender 推送 Microsoft.Security.MalwareScanningResult 事件

export async function POST(request: Request) {
  const events = await request.json();

  for (const event of events) {
    if (event.eventType !== 'Microsoft.Security.MalwareScanningResult') continue;

    const blobUrl = event.data.blobUri;
    const verdict = event.data.scanResultType;  // 'No threats found' | 'Malicious' | ...
    const threatName = event.data.scanResultDetails?.malwareNamesFound?.[0];

    // 將 blobUrl 反查 documentId（DB 中的 storedFileName）
    // 寫回 Document.virusScanStatus + virusName
    // ...
  }

  return new Response(null, { status: 200 });
}
```

> 📋 原 ClamAV `virus-scan.service.ts` 為**替代方案（未採用）**：依賴 `clamscan` npm + `clamd` socket，需自管 worker pool / timeout / EICAR self-test。

---

## Storage Architecture

### 雙 Container 設計

```
Azure Blob Storage Account
├── documents (既有)
│   ├── HKG/2025-01/<uuid>.pdf
│   ├── SIN/2025-01/<uuid>.pdf
│   └── ...
└── quarantine (新增)
    ├── HKG/2025-01/<uuid>.pdf  ← 待掃描
    ├── SIN/2025-01/<uuid>.pdf  ← 已感染（保留 30 天）
    └── ...

Lifecycle Policy（quarantine container）:
  Rule 1: 30 days after creation → delete
  Rule 2: blobs with metadata.scanResult=INFECTED → archive after 30 days

Access Control:
  documents:    Private + Managed Identity
  quarantine:   Private + Managed Identity（更嚴格）
```

### Blob Storage Service 擴充

```typescript
// src/services/blob-storage.service.ts (擴充)

export class BlobStorageService {
  // ... 既有方法 ...

  async uploadToQuarantine(buffer: Buffer, blobPath: string, metadata: Record<string, string>): Promise<string> {
    const containerClient = this.client.getContainerClient('quarantine');
    const blobClient = containerClient.getBlockBlobClient(blobPath);
    await blobClient.uploadData(buffer, {
      metadata: { ...metadata, uploadedAt: new Date().toISOString() },
      blobHTTPHeaders: { blobContentType: metadata.detectedMime },
    });
    return blobClient.url;
  }

  async moveQuarantineToProduction(blobPath: string): Promise<string> {
    const sourceUrl = await this.getQuarantineBlobUrl(blobPath);
    const destClient = this.client.getContainerClient('documents').getBlockBlobClient(blobPath);
    await destClient.syncCopyFromURL(sourceUrl);
    await this.deleteQuarantineBlob(blobPath);
    return destClient.url;
  }

  async markQuarantineAsInfected(blobPath: string, virusName: string): Promise<void> {
    const blobClient = this.client.getContainerClient('quarantine').getBlobClient(blobPath);
    await blobClient.setMetadata({ scanResult: 'INFECTED', virusName, scannedAt: new Date().toISOString() });
  }
}
```

---

## API Changes

### POST /api/documents/upload（重大改寫）

**請求格式不變**：multipart/form-data

**新行為**：
1. 大小檢查（**15MB / 100 檔 / 150MB total**，✅ B5 用戶決策 2026-04-28）
2. Magic number 驗證（拒絕不符）
3. UUID 重命名
4. 上傳到 quarantine container（自動觸發 Azure Defender for Storage 掃描，✅ B4）
5. Event Grid callback 接收掃描結果並更新 Document
6. 返回 202 Accepted（不再等待處理完成）

**Response 202**:
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc-123",
        "originalFileName": "2025年1月發票.pdf",
        "storedFileName": "f47ac10b-58cc-4372-a567-0e02b2c3d479.pdf",
        "status": "PENDING_VIRUS_SCAN",
        "size": 1234567
      }
    ],
    "rejected": [
      {
        "originalFileName": "fake.pdf",
        "reason": "MIME mismatch: claimed application/pdf but content is application/x-msdownload"
      }
    ]
  }
}
```

**Response 413**（超過大小限制）:
```json
{
  "type": "https://docs.example.com/errors/upload/file-too-large",
  "title": "File too large",
  "status": 413,
  "detail": "File exceeds maximum size of 15MB",
  "instance": "/api/documents/upload"
}
```

### Manual Review API

```
GET  /api/admin/manual-review-queue
     → 列出 status=MANUAL_REVIEW 的 documents
     → Permission: USER_MANAGE + INVOICE_MANAGE

POST /api/admin/manual-review/[id]/approve
     Body: { reviewNote: string }
     → 移到 production container, status=READY_FOR_PROCESSING

POST /api/admin/manual-review/[id]/reject
     Body: { reviewNote: string }
     → 保留 quarantine, status=QUARANTINED
```

---

## Data Model

```prisma
// prisma/schema.prisma

model Document {
  // ... 既有欄位 ...
  fileName              String   // 既有 → 將改為 storedFileName

  // ✨ 新增（Story 22-2）
  originalFileName      String?  @map("original_file_name")          // 用戶原始檔名（顯示用）
  storedFileName        String?  @map("stored_file_name")             // UUID + 副檔名
  fileHash              String?  @db.VarChar(64) @map("file_hash")    // SHA-256
  virusScanStatus       VirusScanStatus @default(PENDING)             @map("virus_scan_status")
  virusName             String?  @db.VarChar(255) @map("virus_name")
  scannedAt             DateTime? @map("scanned_at")
  scanDurationMs        Int?     @map("scan_duration_ms")

  manualReview          ManualReviewQueue?

  @@index([virusScanStatus])
}

enum VirusScanStatus {
  PENDING
  SCANNING
  CLEAN
  INFECTED
  SCAN_ERROR
}

enum ProcessingStatus {
  // ... 既有值 ...

  // ✨ 新增（Story 22-2）
  PENDING_VIRUS_SCAN
  QUARANTINED
  MANUAL_REVIEW
  READY_FOR_PROCESSING
}

// ✨ 新增 model
model ManualReviewQueue {
  id            String    @id @default(uuid())
  documentId    String    @unique @map("document_id")
  reason        ManualReviewReason
  status        ManualReviewStatus @default(PENDING)
  reviewedBy    String?   @map("reviewed_by")
  reviewNote    String?   @map("review_note")
  createdAt     DateTime  @default(now()) @map("created_at")
  reviewedAt    DateTime? @map("reviewed_at")

  document      Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  reviewer      User?     @relation(fields: [reviewedBy], references: [id])

  @@index([status])
  @@index([createdAt])
  @@map("manual_review_queue")
}

enum ManualReviewReason {
  SCAN_ERROR
  ENCRYPTED_PDF
  ANOMALOUS_MIME
  ADMIN_REVIEW_REQUESTED
}

enum ManualReviewStatus {
  PENDING
  APPROVED
  REJECTED
}
```

---

## Security Considerations

### 1. Path Traversal 防護

- **威脅**：用戶上傳 `../../etc/passwd.pdf`
- **緩解**：UUID 重命名 + 副檔名只從 magic number 推導 + DB 中 `originalFileName` 透過 `path.basename()` sanitize

### 2. ZIP Bomb / 過度解壓

- **威脅**：小 PDF 解壓後極大消耗記憶體
- **緩解**：50MB 大小限制 + ClamAV 內建 archive scan（檢測 zip bomb）+ Node.js stream 處理大檔案

### 3. Encrypted PDF DoS

- **威脅**：上傳大量加密 PDF，掃描器卡住
- **緩解**：5 分鐘 timeout（Azure Defender SLA）+ 加密 PDF 直接拒絕（明確訊息）+ 證書加密進入 ManualReview

### 4. Polyglot Files

- **威脅**：同一檔案同時是合法 PDF 與惡意 HTML/JS
- **緩解**：Azure Defender 內建 polyglot 偵測 + Magic number 嚴格只接受首 8 bytes 是 `%PDF` 的純 PDF

### 5. Quarantine Container Access

- **威脅**：未來服務誤用 quarantine 中檔案
- **緩解**：
  - quarantine 與 documents 是不同 container
  - Managed Identity 給 quarantine 的權限僅 `Storage Blob Data Contributor`（讀寫但不對外）
  - 業務代碼設計上**禁止**從 quarantine 直接讀取（必須先 move）

### 6. Race Condition（同檔案兩次上傳）

- **威脅**：同一用戶並發上傳同一檔案
- **緩解**：file hash（SHA-256）unique 索引 + 重複檔案返回既有 documentId

### 7. Information Disclosure

- **威脅**：錯誤訊息洩漏內部架構（如 "Azure Defender Event Grid topic not found"）
- **緩解**：用戶看到一般化訊息（"Scan service unavailable"），詳細錯誤（Azure Defender / Event Grid 失敗）僅 log

---

## Testing Strategy

### Wave 3 必測項目對應

| 必測項目 | 測試類型 | 測試檔 | 優先級 |
|----------|----------|--------|-------|
| 1. PDF 格式（純文字 / 掃描 / 加密 / 混合）| Integration + E2E | `pdf-formats.spec.ts` | 🔴 P0 |
| 2. 異常 MIME 兼容性 | Integration | `mime-anomaly.test.ts` | 🔴 P0 |
| 3. 病毒掃描效能 ≤ 3 秒 | Performance | `scan-performance.test.ts` | 🔴 P0 |
| 4. 大小限制與業務最大檔 | E2E | `file-size.spec.ts` | 🟡 P1 |
| 5. 批量上傳 100+ 檔 | E2E + Performance | `batch-upload.spec.ts` | 🔴 P0 |

### 測試集規模

```
tests/fixtures/security/
├── pdfs/
│   ├── pure-text.pdf            # 純文字
│   ├── scanned.pdf              # 掃描件
│   ├── encrypted-password.pdf   # 密碼加密
│   ├── encrypted-cert.pdf       # 證書加密
│   ├── mixed-content.pdf        # 混合
│   ├── anomalous-mime.pdf       # claim image/pdf
│   ├── large-50mb.pdf           # 邊界大小
│   └── malicious/
│       ├── eicar.test           # EICAR 簽名
│       └── polyglot.pdf         # 偽裝為 PDF 的 HTML
├── existing-pdfs-sample/         # 5,000+ 既有 PDF 抽樣
└── README.md                     # 描述各檔案用途
```

### 測試檔案清單

```
tests/
├── unit/
│   ├── lib/upload/
│   │   └── magic-number.test.ts          # AC1, AC8
│   └── services/security/
│       └── virus-scan.service.test.ts    # AC5, AC10
│
├── integration/
│   ├── upload/
│   │   ├── upload-pipeline.test.ts       # AC1-AC6 端對端
│   │   ├── mime-anomaly.test.ts          # 必測項目 #2
│   │   ├── pdf-formats.test.ts           # 必測項目 #1
│   │   └── manual-review.test.ts         # AC12
│   └── performance/
│       └── scan-performance.test.ts      # 必測項目 #3
│
├── e2e/security/
│   └── file-upload.spec.ts               # AC13（8 場景）
│
└── load/
    └── batch-upload-100.spec.ts          # 必測項目 #5
```

### 既有 5,000+ PDF 兼容性驗證

```bash
# 執行 baseline 驗證（observe phase 開始前）
npm run script:validate-existing-pdfs -- --sample 5000 --output observation-baseline.json

# 預期輸出：
# - magic_number_anomalies: <list of files with mismatch>
# - virus_scan_failures: <list>
# - scan_time_p95: <ms>
# - 建議的 whitelist 規則
```

---

## Performance Considerations

### 預期效能基準（✅ B4 + B5 用戶決策 2026-04-28）

| 操作 | 預期延遲 | SLA |
|------|----------|-----|
| Magic Number 驗證 | < 50ms | P99 |
| Quarantine upload (15MB) | 500ms-1.5s | P95 |
| Azure Defender scan (15MB, async) | 30s-2min | avg |
| Azure Defender scan (15MB) | ≤ 5min | P95 |
| Move quarantine → production | 200-500ms | P95 |
| Total upload-to-ready (15MB) | 1-5min | P95 |
| Batch 100 files (15MB each) | ≤ 10min | total（含 Defender 並行掃描）|

### 並發設計

- **Azure Defender for Storage**: 託管並行（Microsoft 託管，無需自管 worker pool）
- **Blob upload pool**: 10 並發（Azure SDK 預設）
- **單批檔案數**: 100（前端分 10 批 × 10 檔）
- **Event Grid throughput**: 5,000 event/sec（Azure system topic 預設配額）

### 資源預估（每月 40K 上傳，✅ B4 + B5 用戶決策）

| 資源 | 預估 |
|------|------|
| Azure Defender for Storage | ~$10/storage account/月（託管掃描，無需 ACA 資源）|
| Quarantine storage | ~30GB（30 天 retention，15MB × 2,000 file/月）|
| Production storage | ~1.5TB/年（基於 15MB 上限）|
| Event Grid（system topic）| ~$0（前 100K event/月免費） |
| Egress（quarantine → production）| 內部 traffic 免費 |

---

## Rollback Plan

### 緊急降級（5 分鐘）

若 enforce mode 啟用後發現重大兼容性問題：

```bash
# 環境變數立即切換
FILE_UPLOAD_STRICT_MODE=false   # 從 true 改為 false

# ACA 立即重啟（fast restart）
az containerapp revision copy --name app --resource-group prod
```

降級後行為：
- Magic number 驗證仍跑，但**不阻擋**（log only）
- 病毒掃描仍跑，但**不阻擋**（CLEAN/INFECTED 都進 production）
- ManualReviewQueue 暫停接收新項目

### 短期修復（1-7 天）

1. 分析 observation log 找出誤判模式
2. 擴充 `KNOWN_ANOMALY_MIME` 清單
3. 為特定客戶異常 PDF 加 whitelist
4. 重新 enforce

### 長期方案（若架構問題）

1. 評估切換到 Azure Defender for Storage（Option B）
2. 重新設計 quarantine 流程（如改為「先進 production，異步掃描，發現問題再隔離」）
3. 業務協商（停止某些異常 PDF 來源）

### 不可降級項

- UUID 重命名（path traversal 防護）— **絕不降級**
- 大小限制 **15MB**（✅ B5 用戶決策 2026-04-28）— **絕不降級**
- EICAR 拒絕 — **絕不降級**

---

## File Structure

```
docker-compose.yml                                                # 更新（新增 clamav）

prisma/schema.prisma                                              # 更新

src/lib/upload/
├── constants.ts                                                  # 更新（大小限制提升）
└── magic-number.ts                                               # 新增

src/services/security/
└── virus-scan.service.ts                                         # 新增

src/services/blob-storage.service.ts                              # 更新（quarantine 操作）

src/services/queue/
└── virus-scan-job.service.ts                                     # 新增

src/services/documents/
├── upload-pipeline.service.ts                                    # 新增（編排器）
└── manual-review.service.ts                                      # 新增

src/app/api/documents/upload/route.ts                             # 重大改寫
src/app/api/admin/manual-review-queue/route.ts                    # 新增
src/app/api/admin/manual-review/[id]/approve/route.ts             # 新增
src/app/api/admin/manual-review/[id]/reject/route.ts              # 新增

src/app/[locale]/(dashboard)/admin/manual-review-queue/page.tsx   # 新增

src/components/features/admin/
├── ManualReviewList.tsx                                          # 新增
└── ManualReviewDialog.tsx                                        # 新增

src/lib/validations/
└── upload.ts                                                     # 新增

messages/{en,zh-TW,zh-CN}/
├── documents.json                                                # 更新（upload.errors.*）
└── admin.json                                                    # 更新（manualReview.*）

scripts/security/
└── validate-existing-pdfs.ts                                     # 新增

tests/
├── unit/                                                         # 多個新增
├── integration/                                                  # 多個新增
├── e2e/security/file-upload.spec.ts                              # 新增
├── fixtures/security/                                            # 新增測試集
└── load/batch-upload-100.spec.ts                                 # 新增
```

---

## Environment Variables（✅ B4 + B5 用戶決策 2026-04-28）

```env
# .env.example 新增

# Virus Scan — Azure Defender for Storage（B4）
AZURE_DEFENDER_MOCK="true"                    # 本機/CI 預設 mock；UAT/Prod 設 false
AZURE_DEFENDER_EVENTGRID_TOPIC="<topic-id>"   # Azure Event Grid system topic id
AZURE_STORAGE_DEFENDER_ENABLED="true"         # Bicep 部署時啟用 Defender plan
VIRUS_SCAN_TIMEOUT_MS="300000"                # 5 分鐘（Azure Defender SLA P95）

# File Upload Limits（B5）
MAX_FILE_SIZE="15728640"                      # 15MB（B5 用戶決策，原 50MB 已調整）
MAX_FILES_PER_BATCH="100"
MAX_BATCH_TOTAL_SIZE="157286400"              # 150MB（隨 15MB × 10 並發推算）

# Storage
QUARANTINE_CONTAINER_NAME="quarantine"
DOCUMENTS_CONTAINER_NAME="documents"
QUARANTINE_RETENTION_DAYS="30"

# Mode Toggle (Dual-mode)
FILE_UPLOAD_STRICT_MODE="false"               # observe phase 預設 false，1-2 週後改 true
```

> 📋 原 ClamAV 環境變數（`CLAMAV_HOST`、`CLAMAV_PORT`）已移除（B4 用戶決策後不採用 ClamAV）。

---

## Acceptance Criteria 驗證 Checklist

- [ ] AC1: Magic number 驗證生效（拒絕 PDF 偽裝）
- [ ] AC2: 大小限制 **15MB / 100 檔 / 150MB total**（✅ B5 用戶決策 2026-04-28）
- [ ] AC3: UUID 重命名 + originalFileName 保留
- [ ] AC4: Quarantine container 隔離 + lifecycle policy
- [ ] AC5: **Azure Defender for Storage** 整合 + 三種結果處理（✅ B4 用戶決策 2026-04-28）
- [ ] AC6: i18n 拒絕訊息（三語）+ AuditLog
- [ ] AC7: 5 種 PDF 格式全部通過
- [ ] AC8: 異常 MIME 自動修正
- [ ] AC9: Azure Defender 平均掃描 ≤ 2 分鐘，P95 ≤ 5 分鐘（B4 採託管異步模式）
- [ ] AC10: EICAR 測試檔正確拒絕
- [ ] AC11: 100 檔批量上傳 ≤ 5 分鐘完成
- [ ] AC12: ManualReviewQueue 完整 admin UI
- [ ] AC13: E2E 測試 8 場景全通過
- [ ] 5,000+ 既有 PDF 兼容性驗證通過
- [ ] dual-mode observe phase 1-2 週無重大誤判
- [ ] 通過 `npm run type-check`、`npm run lint`、`npm run i18n:check`

---

## 用戶決策確認狀態

### 1. 病毒掃描方案 ✅ **已決策（B4, 2026-04-28）**

採 **Azure Defender for Storage**（公司已使用）— 取代原 ClamAV self-hosted 預設方案。月成本 ~$10/storage account；Microsoft 託管，無需自管 worker pool 與 freshclam 病毒庫更新。

### 2. 大小限制 ✅ **已決策（B5, 2026-04-28）**

單檔上限為 **15MB**（取代原規劃的 50MB）。批量總額由 500MB 同步調整為 150MB。

### 3. ManualReviewQueue 通知機制

是否要在 admin queue 累積到一定數量時 email 通知 admin？Tech Spec 預設**不通知**（admin 主動查詢），可後續加入告警（CHANGE-066 配套）。

### 4. 加密 PDF 處理策略

- 預設：用戶端密碼 PDF 直接拒絕、證書 PDF 進 ManualReview
- 替代：兩種都進 ManualReview，admin 決定
- 替代：兩種都直接拒絕

**需用戶決策時機**：實作 Task 6 前。

### 5. 既有檔案處理

新機制上線後，**既有 documents container 中的 PDF 是否需要回掃描**？
- 不掃描（現有檔案視為已信任）— 預設
- 全部回掃描（增加 ~5TB 處理量，但 100% 安全）

**需用戶決策時機**：上線前。

---

## 版本資訊

- **建立日期**: 2026-04-28
- **版本**: 1.1.0
- **變更記錄**:
  - v1.1.0（2026-04-28）：套用 B4 + B5 用戶決策 — 病毒掃描方案改採 Azure Defender for Storage、單檔上限調整為 15MB（原 50MB）
  - v1.0.0（2026-04-28）：初版（預設 ClamAV self-hosted + 50MB）
- **依據**: `docs/08-security-and-governance/phase2-appsec-obs-assessment.md` AppSec-05
- **矩陣依據**: `docs/08-security-and-governance/enterprise-security-governance-matrix.md` v1.2 第 128 行（Wave 3 必測項目 §3.3）
