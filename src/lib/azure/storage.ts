/**
 * @fileoverview Azure Blob Storage 服務模組
 * @description
 *   提供 Azure Blob Storage 的操作封裝：
 *   - 文件上傳
 *   - SAS URL 生成
 *   - 文件刪除
 *   - 文件存在檢查
 *
 * @module src/lib/azure/storage
 * @since Epic 2 - Story 2.1 (File Upload Interface)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 文件上傳到 Azure Blob Storage
 *   - 生成臨時訪問 URL (SAS)
 *   - 文件刪除和存在檢查
 *   - 容器自動創建
 *
 * @dependencies
 *   - @azure/storage-blob - Azure Blob SDK
 *
 * @related
 *   - src/app/api/documents/upload/route.ts - 使用此模組上傳文件
 *   - src/services/document.service.ts - 使用此模組刪除文件
 */

import {
  BlobServiceClient,
  ContainerClient,
  BlobSASPermissions,
} from '@azure/storage-blob';

// ===========================================
// Types
// ===========================================

/**
 * 文件上傳結果
 */
export interface UploadResult {
  /** Blob 名稱 (唯一標識) */
  blobName: string;
  /** Blob 完整 URL */
  blobUrl: string;
  /** 文件 MIME 類型 */
  contentType: string;
  /** 文件大小 (bytes) */
  size: number;
}

/**
 * 上傳選項
 */
export interface UploadOptions {
  /** 文件 MIME 類型 */
  contentType: string;
  /** 自定義元數據 */
  metadata?: Record<string, string>;
  /** 存儲文件夾 (可選) */
  folder?: string;
}

// ===========================================
// Configuration
// ===========================================

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const containerName = process.env.AZURE_STORAGE_CONTAINER || 'documents';

// Validate connection string in production
if (!connectionString && process.env.NODE_ENV === 'production') {
  throw new Error('AZURE_STORAGE_CONNECTION_STRING is required in production');
}

// ===========================================
// Clients (lazy initialization)
// ===========================================

let blobServiceClient: BlobServiceClient | null = null;
let containerClient: ContainerClient | null = null;

/**
 * 獲取 BlobServiceClient (延遲初始化)
 */
function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    if (!connectionString) {
      throw new Error('Azure Storage connection string is not configured');
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }
  return blobServiceClient;
}

/**
 * 獲取 ContainerClient (延遲初始化)
 */
function getContainerClient(): ContainerClient {
  if (!containerClient) {
    containerClient = getBlobServiceClient().getContainerClient(containerName);
  }
  return containerClient;
}

// ===========================================
// Functions
// ===========================================

/**
 * 確保容器存在 (啟動時調用一次)
 *
 * @description 創建容器 (如果不存在)
 * @throws {Error} 如果創建失敗
 */
export async function ensureContainer(): Promise<void> {
  const client = getContainerClient();
  await client.createIfNotExists({
    access: 'blob', // blob 級別的公開訪問
  });
}

/**
 * 上傳文件到 Azure Blob Storage
 *
 * @description 將文件緩衝區上傳到指定的 Blob 容器
 * @param buffer - 文件緩衝區
 * @param fileName - 原始文件名
 * @param options - 上傳選項 (contentType, metadata, folder)
 * @returns 上傳結果，包含 blobName, blobUrl, contentType, size
 * @throws {Error} 如果上傳失敗
 *
 * @example
 * ```typescript
 * const result = await uploadFile(buffer, 'invoice.pdf', {
 *   contentType: 'application/pdf',
 *   folder: 'TPE',
 *   metadata: { uploadedBy: 'user123' }
 * });
 * console.log(result.blobUrl); // https://xxx.blob.core.windows.net/documents/TPE/123-invoice.pdf
 * ```
 */
export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  options: UploadOptions
): Promise<UploadResult> {
  const { contentType, metadata, folder } = options;

  // 生成唯一的 blob 名稱 (timestamp + sanitized filename)
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const blobName = folder
    ? `${folder}/${timestamp}-${sanitizedName}`
    : `${timestamp}-${sanitizedName}`;

  const client = getContainerClient();
  const blockBlobClient = client.getBlockBlobClient(blobName);

  // 上傳文件
  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: {
      blobContentType: contentType,
      blobCacheControl: 'max-age=31536000', // 1 年緩存
    },
    metadata,
  });

  return {
    blobName,
    blobUrl: blockBlobClient.url,
    contentType,
    size: buffer.length,
  };
}

/**
 * 生成 SAS URL 以供臨時訪問
 *
 * @description 生成帶有 SAS token 的 URL，允許臨時讀取權限
 * @param blobName - Blob 名稱
 * @param expiresInMinutes - 過期時間 (分鐘)，默認 60 分鐘
 * @returns 帶有 SAS token 的完整 URL
 * @throws {Error} 如果生成失敗
 *
 * @example
 * ```typescript
 * const sasUrl = await generateSasUrl('TPE/123-invoice.pdf', 30);
 * // https://xxx.blob.core.windows.net/documents/TPE/123-invoice.pdf?sv=...&sig=...
 * ```
 */
export async function generateSasUrl(
  blobName: string,
  expiresInMinutes: number = 60
): Promise<string> {
  const client = getContainerClient();
  const blockBlobClient = client.getBlockBlobClient(blobName);

  const startsOn = new Date();
  const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000);

  const sasToken = await blockBlobClient.generateSasUrl({
    permissions: BlobSASPermissions.parse('r'), // 只讀權限
    startsOn,
    expiresOn,
  });

  return sasToken;
}

/**
 * 刪除指定的 Blob 文件
 *
 * @description 從 Azure Blob Storage 中刪除文件
 * @param blobName - 要刪除的 Blob 名稱
 * @throws {Error} 如果刪除失敗 (除非文件不存在)
 *
 * @example
 * ```typescript
 * await deleteFile('TPE/123-invoice.pdf');
 * ```
 */
export async function deleteFile(blobName: string): Promise<void> {
  const client = getContainerClient();
  const blockBlobClient = client.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

/**
 * 檢查 Blob 文件是否存在
 *
 * @description 檢查指定的 Blob 是否存在於容器中
 * @param blobName - Blob 名稱
 * @returns true 如果文件存在，false 否則
 *
 * @example
 * ```typescript
 * const exists = await fileExists('TPE/123-invoice.pdf');
 * if (exists) {
 *   // 文件存在
 * }
 * ```
 */
export async function fileExists(blobName: string): Promise<boolean> {
  const client = getContainerClient();
  const blockBlobClient = client.getBlockBlobClient(blobName);
  return blockBlobClient.exists();
}

/**
 * 獲取 Blob 文件屬性
 *
 * @description 獲取指定 Blob 的詳細屬性 (大小、類型、最後修改時間等)
 * @param blobName - Blob 名稱
 * @returns Blob 屬性對象
 * @throws {Error} 如果文件不存在或獲取失敗
 *
 * @example
 * ```typescript
 * const props = await getFileProperties('TPE/123-invoice.pdf');
 * console.log(props.contentLength); // 文件大小
 * console.log(props.contentType); // MIME 類型
 * ```
 */
export async function getFileProperties(blobName: string) {
  const client = getContainerClient();
  const blockBlobClient = client.getBlockBlobClient(blobName);
  return blockBlobClient.getProperties();
}

// ===========================================
// Development Helpers
// ===========================================

/**
 * 檢查 Azure Storage 是否已配置
 *
 * @description 用於開發環境檢查配置狀態
 * @returns true 如果已配置連接字符串
 */
export function isStorageConfigured(): boolean {
  return Boolean(connectionString);
}

/**
 * 獲取容器名稱
 *
 * @description 返回當前配置的容器名稱
 * @returns 容器名稱
 */
export function getContainerName(): string {
  return containerName;
}
