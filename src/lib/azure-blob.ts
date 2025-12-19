/**
 * @fileoverview Azure Blob Storage 服務
 * @description
 *   提供 Azure Blob Storage 的上傳、刪除和 SAS URL 生成功能
 *   - 用於 Forwarder Logo 上傳
 *   - 支援圖片檔案上傳
 *   - 提供刪除和 SAS URL 生成
 *
 * @module src/lib/azure-blob
 * @since Epic 5 - Story 5.5
 * @lastModified 2025-12-19
 */

import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'
import { v4 as uuidv4 } from 'uuid'

// =====================
// Configuration
// =====================

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'uploads'

let containerClient: ContainerClient | null = null

// =====================
// Helper Functions
// =====================

/**
 * 獲取或初始化 Container Client
 * @returns Container Client 實例
 */
async function getContainerClient(): Promise<ContainerClient> {
  if (!containerClient) {
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is not configured')
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    containerClient = blobServiceClient.getContainerClient(containerName)

    // 確保 container 存在
    await containerClient.createIfNotExists({
      access: 'blob' // Public read access for blobs
    })
  }
  return containerClient
}

/**
 * 驗證檔案類型是否為允許的圖片格式
 * @param contentType - MIME type
 * @returns 是否為允許的圖片格式
 */
function isAllowedImageType(contentType: string): boolean {
  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'image/svg+xml'
  ]
  return allowedTypes.includes(contentType.toLowerCase())
}

// =====================
// Public Functions
// =====================

/**
 * 上傳檔案到 Azure Blob Storage
 * @param file - 要上傳的檔案
 * @param path - 路徑前綴（例如 'forwarders/DHL/logo'）
 * @returns 上傳後的 Blob URL
 * @throws Error 如果上傳失敗或檔案類型不允許
 */
export async function uploadToBlob(file: File, path: string): Promise<string> {
  // 驗證檔案類型
  if (!isAllowedImageType(file.type)) {
    throw new Error(`不支援的檔案類型: ${file.type}。只允許 PNG、JPG、WebP、GIF、SVG 格式`)
  }

  // 驗證檔案大小（最大 5MB）
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error(`檔案大小超過限制。最大允許 5MB，實際大小 ${(file.size / 1024 / 1024).toFixed(2)}MB`)
  }

  const container = await getContainerClient()

  // 生成唯一的 blob 名稱
  const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
  const blobName = `${path}/${uuidv4()}.${extension}`

  // 獲取 blob client
  const blockBlobClient = container.getBlockBlobClient(blobName)

  // 將檔案轉換為 buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // 上傳並設定 content type
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: file.type || 'image/png'
    }
  })

  return blockBlobClient.url
}

/**
 * 從 Azure Blob Storage 刪除檔案
 * @param url - 要刪除的 Blob 完整 URL
 * @description 刪除失敗時不會拋出錯誤，只會記錄到 console
 */
export async function deleteFromBlob(url: string): Promise<void> {
  try {
    const container = await getContainerClient()

    // 從 URL 提取 blob 名稱
    const urlObj = new URL(url)
    // URL 格式: https://account.blob.core.windows.net/container/path/to/blob
    // pathname 格式: /container/path/to/blob
    const pathParts = urlObj.pathname.split('/')
    // 移除開頭的空字串和 container 名稱
    const blobName = pathParts.slice(2).join('/')

    const blockBlobClient = container.getBlockBlobClient(blobName)
    await blockBlobClient.deleteIfExists()
  } catch (error) {
    // 刪除失敗不應該影響主要操作
    console.error('Error deleting blob:', error)
  }
}

/**
 * 生成 SAS URL 用於暫時訪問
 * @param blobName - Blob 名稱
 * @param expiresInMinutes - 過期時間（分鐘）
 * @returns SAS URL
 */
export async function generateSasUrl(
  blobName: string,
  expiresInMinutes: number = 60
): Promise<string> {
  const container = await getContainerClient()
  const blockBlobClient = container.getBlockBlobClient(blobName)

  const expiresOn = new Date()
  expiresOn.setMinutes(expiresOn.getMinutes() + expiresInMinutes)

  // 注意：這需要 SAS 權限，可能需要額外設定
  const sasUrl = await blockBlobClient.generateSasUrl({
    permissions: { read: true } as unknown as import('@azure/storage-blob').BlobSASPermissions,
    expiresOn
  })

  return sasUrl
}

/**
 * 檢查 Azure Blob Storage 是否已配置
 * @returns 是否已配置
 */
export function isBlobStorageConfigured(): boolean {
  return !!connectionString
}

/**
 * 從 URL 提取 Blob 名稱
 * @param url - Blob URL
 * @returns Blob 名稱
 */
export function extractBlobNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    return pathParts.slice(2).join('/')
  } catch {
    return ''
  }
}
