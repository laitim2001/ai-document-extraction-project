/**
 * @fileoverview 外部 API 驗證 Schema 定義
 * @description
 *   使用 Zod 定義外部 API 請求的驗證規則，包括：
 *   - Base64 提交驗證
 *   - URL 提交驗證
 *   - 通用參數驗證
 *   - 文件格式驗證
 *
 * @module src/types/external-api/validation
 * @author Development Team
 * @since Epic 11 - Story 11.1 (API 發票提交端點)
 * @lastModified 2025-12-20
 *
 * @features
 *   - Zod 運行時驗證
 *   - 文件格式和大小驗證
 *   - URL 格式驗證
 *
 * @related
 *   - src/types/external-api/submission.ts - 提交類型
 *   - src/app/api/v1/invoices/route.ts - API 路由
 */

import { z } from 'zod';
import { SUPPORTED_MIME_TYPES, MAX_FILE_SIZE } from './submission';

// ============================================================
// 驗證 Schema
// ============================================================

/**
 * Base64 提交驗證 Schema
 */
export const base64SubmissionSchema = z.object({
  type: z.literal('base64'),
  content: z
    .string()
    .min(1, 'Base64 content is required')
    .refine(
      (val) => {
        try {
          // 驗證是否為有效的 Base64
          const buffer = Buffer.from(val, 'base64');
          return buffer.length > 0 && buffer.length <= MAX_FILE_SIZE;
        } catch {
          return false;
        }
      },
      { message: 'Invalid Base64 content or file too large' }
    ),
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name too long')
    .refine(
      (name) => /^[a-zA-Z0-9._-]+$/.test(name),
      { message: 'File name contains invalid characters' }
    ),
  mimeType: z
    .string()
    .min(1, 'MIME type is required')
    .refine(
      (mime) => SUPPORTED_MIME_TYPES.includes(mime.toLowerCase() as typeof SUPPORTED_MIME_TYPES[number]),
      { message: 'Unsupported MIME type. Supported: PDF, PNG, JPG, TIFF' }
    ),
});

/**
 * URL 提交驗證 Schema
 */
export const urlSubmissionSchema = z.object({
  type: z.literal('url'),
  url: z
    .string()
    .url('Invalid URL format')
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      },
      { message: 'Only HTTP and HTTPS protocols are supported' }
    ),
  fileName: z
    .string()
    .max(255, 'File name too long')
    .refine(
      (name) => !name || /^[a-zA-Z0-9._-]+$/.test(name),
      { message: 'File name contains invalid characters' }
    )
    .optional(),
});

/**
 * 通用參數驗證 Schema
 */
export const commonParamsSchema = z.object({
  cityCode: z
    .string()
    .min(1, 'City code is required')
    .max(10, 'City code too long')
    .regex(/^[A-Z]{2,5}$/, 'City code must be 2-5 uppercase letters'),
  priority: z
    .enum(['NORMAL', 'HIGH'])
    .optional()
    .default('NORMAL'),
  callbackUrl: z
    .string()
    .url('Invalid callback URL')
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
          return false;
        }
      },
      { message: 'Callback URL must use HTTP or HTTPS protocol' }
    )
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * JSON 請求體驗證 Schema（Base64 方式）
 */
export const jsonRequestBodySchema = z.object({
  submission: z.discriminatedUnion('type', [
    base64SubmissionSchema,
    urlSubmissionSchema,
  ]),
  cityCode: commonParamsSchema.shape.cityCode,
  priority: commonParamsSchema.shape.priority,
  callbackUrl: commonParamsSchema.shape.callbackUrl,
  metadata: commonParamsSchema.shape.metadata,
});

/**
 * Multipart 請求參數驗證 Schema
 */
export const multipartParamsSchema = z.object({
  cityCode: commonParamsSchema.shape.cityCode,
  priority: z
    .string()
    .refine(
      (val) => !val || ['NORMAL', 'HIGH'].includes(val.toUpperCase()),
      { message: 'Priority must be NORMAL or HIGH' }
    )
    .transform((val) => val?.toUpperCase() as 'NORMAL' | 'HIGH' | undefined)
    .optional(),
  callbackUrl: commonParamsSchema.shape.callbackUrl,
  metadata: z
    .string()
    .refine(
      (val) => {
        if (!val) return true;
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Metadata must be valid JSON' }
    )
    .transform((val) => val ? JSON.parse(val) : undefined)
    .optional(),
});

// ============================================================
// 類型推導
// ============================================================

/**
 * Base64 提交類型（從 Schema 推導）
 */
export type Base64Submission = z.infer<typeof base64SubmissionSchema>;

/**
 * URL 提交類型（從 Schema 推導）
 */
export type UrlSubmission = z.infer<typeof urlSubmissionSchema>;

/**
 * 通用參數類型（從 Schema 推導）
 */
export type CommonParams = z.infer<typeof commonParamsSchema>;

/**
 * JSON 請求體類型（從 Schema 推導）
 */
export type JsonRequestBody = z.infer<typeof jsonRequestBodySchema>;

/**
 * Multipart 參數類型（從 Schema 推導）
 */
export type MultipartParams = z.infer<typeof multipartParamsSchema>;

// ============================================================
// 驗證輔助函數
// ============================================================

/**
 * 驗證 MIME 類型是否支援
 * @param mimeType MIME 類型
 * @returns 是否支援
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(
    mimeType.toLowerCase() as typeof SUPPORTED_MIME_TYPES[number]
  );
}

/**
 * 驗證文件大小是否在限制內
 * @param size 文件大小（位元組）
 * @returns 是否在限制內
 */
export function isFileSizeValid(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

/**
 * 從 Content-Type 標頭解析 MIME 類型
 * @param contentType Content-Type 標頭值
 * @returns 純 MIME 類型（不含參數）
 */
export function parseMimeType(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase();
}

/**
 * 驗證 Base64 字串
 * @param str Base64 字串
 * @returns 是否為有效的 Base64
 */
export function isValidBase64(str: string): boolean {
  try {
    // 檢查是否符合 Base64 格式
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) {
      return false;
    }
    // 嘗試解碼
    Buffer.from(str, 'base64');
    return true;
  } catch {
    return false;
  }
}

/**
 * 從文件名推斷 MIME 類型
 * @param fileName 文件名
 * @returns MIME 類型或 undefined
 */
export function inferMimeTypeFromFileName(fileName: string): string | undefined {
  const extension = fileName.split('.').pop()?.toLowerCase();

  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  };

  return extension ? mimeMap[extension] : undefined;
}
