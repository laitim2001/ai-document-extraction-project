# Story 2.1: 文件上傳介面與驗證

**Status:** ready-for-dev

---

## Story

**As a** 數據處理員,
**I want** 上傳發票文件到系統,
**So that** 系統可以開始處理和提取發票內容。

---

## Acceptance Criteria

### AC1: 文件格式與大小驗證

**Given** 用戶在發票上傳頁面
**When** 點擊上傳區域或拖放文件
**Then** 系統接受 PDF、JPG、PNG 格式的文件
**And** 單個文件大小限制為 10MB
**And** 顯示上傳進度指示器

### AC2: 不支援格式處理

**Given** 用戶選擇了不支援的文件格式
**When** 嘗試上傳
**Then** 系統顯示錯誤訊息「不支援的文件格式，請上傳 PDF、JPG 或 PNG」

### AC3: 批量上傳

**Given** 用戶選擇多個文件（批量上傳）
**When** 確認上傳
**Then** 系統接受最多 20 個文件
**And** 顯示每個文件的上傳狀態

---

## Tasks / Subtasks

- [ ] **Task 1: Document 資料表設計** (AC: #1)
  - [ ] 1.1 創建 Document Prisma 模型
  - [ ] 1.2 定義欄位（id, fileName, fileType, fileSize, filePath, status, uploadedBy, cityCode）
  - [ ] 1.3 創建 DocumentStatus 枚舉
  - [ ] 1.4 執行 Prisma 遷移

- [ ] **Task 2: Azure Blob Storage 配置** (AC: #1)
  - [ ] 2.1 安裝 Azure Storage SDK
  - [ ] 2.2 配置連線字串環境變數
  - [ ] 2.3 創建 `src/lib/azure-storage.ts` 封裝
  - [ ] 2.4 實現文件上傳函數

- [ ] **Task 3: 上傳 API 端點** (AC: #1, #2, #3)
  - [ ] 3.1 創建 POST `/api/documents/upload` 端點
  - [ ] 3.2 實現文件格式驗證
  - [ ] 3.3 實現文件大小驗證
  - [ ] 3.4 支援多文件上傳（最多 20 個）
  - [ ] 3.5 創建 Document 記錄

- [ ] **Task 4: 上傳頁面 UI** (AC: #1, #3)
  - [ ] 4.1 創建 `src/app/(dashboard)/invoices/upload/page.tsx`
  - [ ] 4.2 實現拖放上傳區域
  - [ ] 4.3 實現文件選擇器
  - [ ] 4.4 顯示已選文件列表

- [ ] **Task 5: 上傳組件** (AC: #1, #2, #3)
  - [ ] 5.1 創建 `FileUploader.tsx` 組件
  - [ ] 5.2 實現拖放功能（react-dropzone）
  - [ ] 5.3 實現前端文件驗證
  - [ ] 5.4 顯示上傳進度條

- [ ] **Task 6: 錯誤處理與提示** (AC: #2)
  - [ ] 6.1 定義錯誤類型常量
  - [ ] 6.2 實現錯誤訊息顯示
  - [ ] 6.3 支援批量上傳部分成功情況

- [ ] **Task 7: 上傳進度追蹤** (AC: #1, #3)
  - [ ] 7.1 實現單文件進度追蹤
  - [ ] 7.2 實現批量上傳整體進度
  - [ ] 7.3 上傳完成後自動刷新列表

- [ ] **Task 8: 驗證與測試** (AC: #1-3)
  - [ ] 8.1 測試各格式文件上傳
  - [ ] 8.2 測試大小限制
  - [ ] 8.3 測試批量上傳
  - [ ] 8.4 測試錯誤處理

---

## Dev Notes

### 依賴項

- **Epic 1**: 用戶認證、權限系統

### Project Structure Notes

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── invoices/
│   │       └── upload/
│   │           └── page.tsx        # 上傳頁面
│   └── api/
│       └── documents/
│           └── upload/
│               └── route.ts        # 上傳 API
├── components/
│   └── features/
│       └── invoice/
│           ├── FileUploader.tsx    # 上傳組件
│           └── UploadProgress.tsx  # 進度組件
├── lib/
│   └── azure-storage.ts            # Azure Blob 封裝
└── services/
    └── document.service.ts         # 文件服務層
```

### Architecture Compliance

#### Prisma Schema - Document

```prisma
model Document {
  id          String         @id @default(uuid())
  fileName    String         @map("file_name")
  fileType    String         @map("file_type")
  fileSize    Int            @map("file_size")
  filePath    String         @map("file_path")  // Azure Blob URL
  status      DocumentStatus @default(UPLOADED)
  uploadedBy  String         @map("uploaded_by")
  cityCode    String?        @map("city_code")
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  uploader    User           @relation(fields: [uploadedBy], references: [id])
  ocrResults  OcrResult[]
  extractions ExtractionResult[]

  @@index([status])
  @@index([uploadedBy])
  @@index([cityCode])
  @@map("documents")
}

enum DocumentStatus {
  UPLOADING
  UPLOADED
  OCR_PROCESSING
  OCR_COMPLETED
  OCR_FAILED
  MAPPING_PROCESSING
  MAPPING_COMPLETED
  PENDING_REVIEW
  IN_REVIEW
  COMPLETED
  FAILED
}
```

#### Azure Blob Storage 配置

```typescript
// src/lib/azure-storage.ts
import { BlobServiceClient } from '@azure/storage-blob'

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'documents'

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
const containerClient = blobServiceClient.getContainerClient(containerName)

export async function uploadFile(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const blobName = `${Date.now()}-${fileName}`
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)

  await blockBlobClient.upload(file, file.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  })

  return blockBlobClient.url
}

export async function deleteFile(blobUrl: string): Promise<void> {
  const blobName = new URL(blobUrl).pathname.split('/').pop()!
  const blockBlobClient = containerClient.getBlockBlobClient(blobName)
  await blockBlobClient.delete()
}
```

#### 上傳 API

```typescript
// POST /api/documents/upload
// Content-Type: multipart/form-data

// 驗證規則
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 20

// Response:
interface UploadResponse {
  success: true
  data: {
    uploaded: Document[]
    failed: { fileName: string; error: string }[]
  }
}
```

#### FileUploader 組件

```typescript
// src/components/features/invoice/FileUploader.tsx
import { useDropzone } from 'react-dropzone'

export function FileUploader({ onUpload }: FileUploaderProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 20,
    onDrop: handleDrop,
  })

  // ...
}
```

### Library & Framework Requirements

```bash
# 安裝依賴
npm install @azure/storage-blob react-dropzone
```

### Testing Requirements

| 驗證項目 | 預期結果 |
|---------|---------|
| PDF 上傳 | 成功上傳並創建記錄 |
| JPG/PNG 上傳 | 成功上傳並創建記錄 |
| 不支援格式 | 顯示錯誤訊息 |
| 超過 10MB | 顯示大小限制錯誤 |
| 批量上傳 | 最多 20 個文件 |
| 進度顯示 | 即時更新進度百分比 |

### References

- [Source: docs/03-epics/sections/epic-2-manual-invoice-upload-ai-processing.md#story-21]
- [Source: docs/02-architecture/sections/project-structure-boundaries.md]
- [Source: docs/01-planning/prd/sections/functional-requirements.md#FR1]

---

## Story Metadata

| 屬性 | 值 |
|------|------|
| Story ID | 2.1 |
| Story Key | 2-1-file-upload-interface-validation |
| Epic | Epic 2: 手動發票上傳與 AI 處理 |
| FR Coverage | FR1 |
| Dependencies | Epic 1 (認證系統) |

---

*Story created: 2025-12-16*
*Status: ready-for-dev*
