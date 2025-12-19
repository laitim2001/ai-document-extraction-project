/**
 * @fileoverview 應用程式錯誤類別
 * @description
 *   提供統一的錯誤處理類別，遵循 RFC 7807 規範。
 *   用於業務邏輯錯誤的結構化表示。
 *
 * @module src/lib/errors
 * @author Development Team
 * @since Epic 1 - Story 1.4 (Add User & Role Assignment)
 * @lastModified 2025-12-18
 *
 * @related
 *   - src/app/api - API 錯誤處理
 */

// ============================================================
// AppError Class
// ============================================================

/**
 * 應用程式錯誤類別
 *
 * @description
 *   用於表示業務邏輯錯誤，包含類型、標題、狀態碼和詳細訊息。
 *   支援 JSON 序列化，適合 API 響應。
 *
 * @example
 *   throw new AppError(
 *     'validation_error',
 *     'Email Already Exists',
 *     409,
 *     'This email address is already registered'
 *   )
 */
export class AppError extends Error {
  constructor(
    /** 錯誤類型（用於 RFC 7807 type 欄位） */
    public type: string,
    /** 錯誤標題（簡短描述） */
    public title: string,
    /** HTTP 狀態碼 */
    public status: number,
    /** 詳細錯誤訊息 */
    public detail: string
  ) {
    super(detail)
    this.name = 'AppError'
  }

  /**
   * 將錯誤轉換為 JSON 格式
   * @returns RFC 7807 格式的錯誤物件
   */
  toJSON() {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
    }
  }
}

// ============================================================
// Type Guards
// ============================================================

/**
 * 檢查是否為 AppError 實例
 * @param error - 要檢查的錯誤
 * @returns 是否為 AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

// ============================================================
// Common Errors Factory
// ============================================================

/**
 * 建立驗證錯誤
 * @param detail - 錯誤詳情
 * @returns AppError 實例
 */
export function createValidationError(detail: string): AppError {
  return new AppError('validation_error', 'Validation Error', 400, detail)
}

/**
 * 建立未授權錯誤
 * @param detail - 錯誤詳情
 * @returns AppError 實例
 */
export function createUnauthorizedError(
  detail = 'Authentication required'
): AppError {
  return new AppError('unauthorized', 'Unauthorized', 401, detail)
}

/**
 * 建立禁止存取錯誤
 * @param detail - 錯誤詳情
 * @returns AppError 實例
 */
export function createForbiddenError(
  detail = 'You do not have permission to perform this action'
): AppError {
  return new AppError('forbidden', 'Forbidden', 403, detail)
}

/**
 * 建立資源不存在錯誤
 * @param resource - 資源類型
 * @param id - 資源 ID
 * @returns AppError 實例
 */
export function createNotFoundError(resource: string, id?: string): AppError {
  const detail = id ? `${resource} with ID ${id} not found` : `${resource} not found`
  return new AppError('not_found', 'Not Found', 404, detail)
}

/**
 * 建立衝突錯誤
 * @param detail - 錯誤詳情
 * @returns AppError 實例
 */
export function createConflictError(detail: string): AppError {
  return new AppError('conflict', 'Conflict', 409, detail)
}

/**
 * 建立內部伺服器錯誤
 * @param detail - 錯誤詳情
 * @returns AppError 實例
 */
export function createInternalError(
  detail = 'An unexpected error occurred'
): AppError {
  return new AppError('internal_error', 'Internal Server Error', 500, detail)
}
