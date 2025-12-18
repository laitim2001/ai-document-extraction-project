/**
 * @fileoverview Azure 服務模組導出
 * @module src/lib/azure
 * @since Epic 2 - Story 2.1 (File Upload Interface)
 */

// Azure Blob Storage
export {
  uploadFile,
  generateSasUrl,
  deleteFile,
  fileExists,
  getFileProperties,
  ensureContainer,
  isStorageConfigured,
  getContainerName,
  type UploadResult,
  type UploadOptions,
} from './storage';
