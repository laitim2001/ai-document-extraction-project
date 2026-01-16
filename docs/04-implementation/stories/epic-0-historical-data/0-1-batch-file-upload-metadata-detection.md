# Story 0.1: 批量文件上傳與元數據檢測

**Status:** completed (2025-12-23)

---

## Story

**As a** 系統管理員,
**I want** 批量上傳歷史發票文件並自動檢測文件類型,
**So that** 系統可以根據文件特性選擇最佳處理方式。

---

## Acceptance Criteria

### AC1: 批量文件上傳

**Given** 系統管理員在歷史數據管理頁面
**When** 點擊「批量上傳」或拖拽文件
**Then** 支援上傳 .pdf, .jpg, .png, .tiff 格式
**And** 單次最多上傳 500 個文件
**And** 單個文件最大 50MB
**And** 顯示上傳進度

### AC2: 自動元數據檢測

**Given** 文件上傳完成
**When** 系統分析文件
**Then** 自動檢測文件類型：
  - `NATIVE_PDF`：原生 PDF（包含文字層）
  - `SCANNED_PDF`：掃描 PDF（純圖片）
  - `IMAGE`：圖片文件（jpg/png/tiff）
**And** 檢測結果顯示在文件列表中

### AC3: 檢測結果顯示與修正

**Given** 文件列表顯示檢測結果
**When** 管理員認為檢測結果有誤
**Then** 可以手動修改文件類型
**And** 修改會記錄到審計日誌

### AC4: 批量操作

**Given** 文件列表頁面
**When** 選擇多個文件
**Then** 可以批量修改類型
**And** 可以批量刪除
**And** 可以批量開始處理

---

## Tasks / Subtasks

- [ ] **Task 1: 歷史數據管理頁面** (AC: #1)
  - [ ] 1.1 創建 `src/app/(dashboard)/admin/historical-data/page.tsx`
  - [ ] 1.2 設計頁面佈局（上傳區、文件列表、操作區）
  - [ ] 1.3 實現權限控制（僅 ADMIN 可訪問）

- [ ] **Task 2: 批量上傳組件** (AC: #1)
  - [ ] 2.1 創建 `BatchFileUploader.tsx` 組件
  - [ ] 2.2 支援拖拽上傳
  - [ ] 2.3 支援多文件選擇
  - [ ] 2.4 文件類型和大小驗證
  - [ ] 2.5 上傳進度顯示（總進度 + 單文件進度）
  - [ ] 2.6 上傳錯誤處理和重試

- [ ] **Task 3: 元數據檢測服務** (AC: #2)
  - [ ] 3.1 創建 `src/services/file-detection.service.ts`
  - [ ] 3.2 PDF 文字層檢測邏輯
  - [ ] 3.3 圖片文件識別
  - [ ] 3.4 掃描 PDF 判斷（頁面是否為純圖片）

- [ ] **Task 4: 上傳 API** (AC: #1, #2)
  - [ ] 4.1 創建 POST `/api/admin/historical-data/upload`
  - [ ] 4.2 文件存儲（Azure Blob / 本地）
  - [ ] 4.3 元數據檢測觸發
  - [ ] 4.4 批量任務記錄建立

- [ ] **Task 5: 文件列表組件** (AC: #3, #4)
  - [ ] 5.1 創建 `HistoricalFileList.tsx`
  - [ ] 5.2 顯示文件名、大小、類型、檢測結果
  - [ ] 5.3 支援選擇（單選/全選）
  - [ ] 5.4 支援排序和篩選
  - [ ] 5.5 類型修改下拉選單

- [ ] **Task 6: 批量操作功能** (AC: #4)
  - [ ] 6.1 批量類型修改 API
  - [ ] 6.2 批量刪除 API
  - [ ] 6.3 批量處理觸發

- [ ] **Task 7: 數據模型** (AC: #1-4)
  - [ ] 7.1 建立 `HistoricalBatch` 模型（批量任務）
  - [ ] 7.2 建立 `HistoricalFile` 模型（單個文件）
  - [ ] 7.3 Prisma Migration

- [ ] **Task 8: 驗證與測試** (AC: #1-4)
  - [ ] 8.1 TypeScript 類型檢查通過
  - [ ] 8.2 ESLint 檢查通過
  - [ ] 8.3 上傳功能測試
  - [ ] 8.4 元數據檢測準確性測試

---

## Dev Notes

### 依賴項

- 無前置 Story 依賴（Epic 0 的起點）
- 需要 Azure Blob Storage 或本地文件存儲配置

### 數據模型

```prisma
// 批量處理任務
model HistoricalBatch {
  id            String   @id @default(uuid())
  name          String   // 批次名稱
  status        BatchStatus @default(PENDING)
  totalFiles    Int      @map("total_files")
  processedFiles Int     @default(0) @map("processed_files")
  failedFiles   Int      @default(0) @map("failed_files")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  createdBy     String   @map("created_by")

  creator       User     @relation(fields: [createdBy], references: [id])
  files         HistoricalFile[]

  @@map("historical_batches")
}

// 歷史文件記錄
model HistoricalFile {
  id            String   @id @default(uuid())
  batchId       String   @map("batch_id")
  fileName      String   @map("file_name")
  fileSize      Int      @map("file_size")
  fileType      FileType @map("file_type")
  detectedType  DetectedFileType? @map("detected_type")
  storagePath   String   @map("storage_path")
  status        FileProcessingStatus @default(PENDING)
  errorMessage  String?  @map("error_message")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  batch         HistoricalBatch @relation(fields: [batchId], references: [id])

  @@map("historical_files")
}

enum BatchStatus {
  PENDING       // 待處理
  PROCESSING    // 處理中
  COMPLETED     // 完成
  FAILED        // 失敗
  CANCELLED     // 已取消
}

enum DetectedFileType {
  NATIVE_PDF    // 原生 PDF（有文字層）
  SCANNED_PDF   // 掃描 PDF（純圖片）
  IMAGE         // 圖片文件
}

enum FileProcessingStatus {
  PENDING       // 待處理
  DETECTING     // 檢測中
  DETECTED      // 已檢測
  PROCESSING    // AI 處理中
  COMPLETED     // 完成
  FAILED        // 失敗
}
```

### 元數據檢測邏輯

```typescript
// src/services/file-detection.service.ts

export async function detectFileType(file: Buffer, mimeType: string): Promise<DetectedFileType> {
  // 圖片文件直接返回 IMAGE
  if (mimeType.startsWith('image/')) {
    return 'IMAGE';
  }

  // PDF 文件需要進一步分析
  if (mimeType === 'application/pdf') {
    const hasTextLayer = await checkPdfTextLayer(file);
    return hasTextLayer ? 'NATIVE_PDF' : 'SCANNED_PDF';
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

async function checkPdfTextLayer(pdfBuffer: Buffer): Promise<boolean> {
  // 使用 pdf-parse 或 pdfjs-dist 檢查
  // 如果可以提取到有意義的文字（> 50 字符），認為是原生 PDF
  const text = await extractPdfText(pdfBuffer);
  return text.trim().length > 50;
}
```

### API 設計

```typescript
// POST /api/admin/historical-data/upload
// Content-Type: multipart/form-data

interface UploadResponse {
  success: true;
  data: {
    batchId: string;
    files: {
      id: string;
      fileName: string;
      fileSize: number;
      detectedType: DetectedFileType;
      status: FileProcessingStatus;
    }[];
  };
}

// PATCH /api/admin/historical-data/files/[id]
interface UpdateFileRequest {
  detectedType?: DetectedFileType; // 手動修改類型
}

// POST /api/admin/historical-data/batches/[id]/process
// 觸發批量處理
```

### References

- [Source: docs/03-epics/sections/epic-0-historical-data-initialization.md#story-01]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 0.1 |
| Story Key | 0-1-batch-file-upload-metadata-detection |
| Epic | Epic 0: 歷史數據初始化 |
| Dependencies | None |

---

*Story created: 2025-12-22*
*Status: pending*
