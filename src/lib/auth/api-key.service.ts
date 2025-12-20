/**
 * @fileoverview API Key 驗證服務
 * @description
 *   提供 API Key 驗證功能，用於外部系統（如 n8n）
 *   透過 API 存取系統功能。
 *
 *   ## 認證方式
 *   - Header: `x-api-key: <api-key>`
 *   - Header: `Authorization: Bearer <api-key>`
 *
 *   ## 安全設計
 *   - API Key 使用 SHA-256 雜湊儲存
 *   - 支援 Key 過期時間
 *   - 支援城市層級存取控制
 *   - 支援細粒度權限控制
 *
 * @module src/lib/auth/api-key.service
 * @author Development Team
 * @since Epic 9 - Story 9.1 (SharePoint 文件監控 API)
 * @lastModified 2025-12-20
 *
 * @features
 *   - API Key 驗證
 *   - 城市存取權限檢查
 *   - 功能權限檢查
 *   - 使用記錄更新
 *
 * @dependencies
 *   - crypto - 雜湊計算
 *   - @prisma/client - 資料庫操作
 *
 * @related
 *   - src/app/api/documents/from-sharepoint/route.ts - 使用此服務驗證請求
 *   - prisma/schema.prisma - ApiKey 模型
 *   - src/types/sharepoint.ts - ApiKeyValidationResult 類型
 */

import { createHash, randomBytes } from 'crypto';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ApiKeyValidationResult } from '@/types/sharepoint';

// ============================================================
// Types
// ============================================================

/**
 * API Key 權限常數
 */
export const API_KEY_PERMISSIONS = {
  /** SharePoint 文件提交權限 */
  SHAREPOINT_SUBMIT: 'sharepoint:submit',
  /** SharePoint 狀態查詢權限 */
  SHAREPOINT_STATUS: 'sharepoint:status',
  /** 文件上傳權限 */
  DOCUMENT_UPLOAD: 'document:upload',
  /** 所有權限 */
  ALL: '*',
} as const;

// ============================================================
// Service
// ============================================================

/**
 * API Key 驗證服務
 *
 * @description
 *   提供靜態方法驗證 API Key 並檢查權限。
 *   支援細粒度的城市存取控制和功能權限控制。
 *
 * @example
 *   // 在 API 路由中使用
 *   const result = await ApiKeyService.verify(request);
 *   if (!result.valid) {
 *     return NextResponse.json({ error: result.error }, { status: 401 });
 *   }
 *
 *   // 檢查城市存取權限
 *   if (!ApiKeyService.checkCityAccess(result.cityAccess, 'TPE')) {
 *     return NextResponse.json({ error: 'Access denied' }, { status: 403 });
 *   }
 */
export class ApiKeyService {
  /**
   * 驗證 API Key
   *
   * @description
   *   從請求中提取並驗證 API Key。
   *   驗證通過後會更新最後使用時間。
   *
   * @param request - Next.js 請求物件
   * @returns 驗證結果
   *
   * @example
   *   const result = await ApiKeyService.verify(request);
   *   if (result.valid) {
   *     console.log('Key ID:', result.keyId);
   *     console.log('Permissions:', result.permissions);
   *   }
   */
  static async verify(request: NextRequest): Promise<ApiKeyValidationResult> {
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      return { valid: false, error: 'API key is required' };
    }

    // 計算雜湊值
    const hashedKey = createHash('sha256').update(apiKey).digest('hex');

    // 查詢 API Key
    const keyRecord = await prisma.apiKey.findFirst({
      where: {
        keyHash: hashedKey,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!keyRecord) {
      return { valid: false, error: 'Invalid or expired API key' };
    }

    // 更新最後使用時間
    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      valid: true,
      keyId: keyRecord.id,
      permissions: keyRecord.permissions as string[],
      cityAccess: keyRecord.cityAccess as string[],
    };
  }

  /**
   * 從請求中提取 API Key
   *
   * @description
   *   支援兩種方式提供 API Key：
   *   1. x-api-key header
   *   2. Authorization: Bearer <key>
   *
   * @param request - Next.js 請求物件
   * @returns API Key 或 null
   */
  private static extractApiKey(request: NextRequest): string | null {
    // 優先從 x-api-key header 取得
    const headerKey = request.headers.get('x-api-key');
    if (headerKey) {
      return headerKey;
    }

    // 其次從 Authorization header 取得
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return null;
  }

  /**
   * 檢查城市存取權限
   *
   * @description
   *   檢查 API Key 是否有權限存取指定城市。
   *   空陣列表示可存取所有城市。
   *
   * @param cityAccess - 允許存取的城市代碼陣列
   * @param cityCode - 要存取的城市代碼
   * @returns 是否有權限
   *
   * @example
   *   if (!ApiKeyService.checkCityAccess(['TPE', 'HKG'], 'SHA')) {
   *     // 無權存取 SHA
   *   }
   */
  static checkCityAccess(
    cityAccess: string[] | undefined,
    cityCode: string
  ): boolean {
    // 空陣列或 undefined 表示可存取所有城市
    if (!cityAccess || cityAccess.length === 0) {
      return true;
    }
    return cityAccess.includes(cityCode);
  }

  /**
   * 檢查功能權限
   *
   * @description
   *   檢查 API Key 是否有指定的功能權限。
   *   '*' 表示擁有所有權限。
   *
   * @param permissions - 擁有的權限陣列
   * @param requiredPermission - 需要的權限
   * @returns 是否有權限
   *
   * @example
   *   if (!ApiKeyService.checkPermission(result.permissions, 'sharepoint:submit')) {
   *     // 無提交權限
   *   }
   */
  static checkPermission(
    permissions: string[] | undefined,
    requiredPermission: string
  ): boolean {
    if (!permissions || permissions.length === 0) {
      return false;
    }
    return permissions.includes(requiredPermission) || permissions.includes('*');
  }

  /**
   * 生成 API Key
   *
   * @description
   *   生成一個新的 API Key。
   *   返回原始 Key（用於顯示給用戶）和 Key 的雜湊值（用於儲存）。
   *
   * @returns 原始 Key 和雜湊值
   *
   * @example
   *   const { key, keyHash, keyPrefix } = ApiKeyService.generateApiKey();
   *   // 顯示給用戶: key
   *   // 儲存到資料庫: keyHash, keyPrefix
   */
  static generateApiKey(): {
    key: string;
    keyHash: string;
    keyPrefix: string;
  } {
    // 生成 32 bytes 的隨機 key
    const keyBuffer = randomBytes(32);
    const key = keyBuffer.toString('base64url');

    // 計算雜湊
    const keyHash = createHash('sha256').update(key).digest('hex');

    // 取前 8 字元作為識別前綴
    const keyPrefix = key.substring(0, 8);

    return { key, keyHash, keyPrefix };
  }

  /**
   * 計算 API Key 雜湊
   *
   * @description
   *   計算 API Key 的 SHA-256 雜湊值，用於驗證時比對。
   *
   * @param apiKey - 原始 API Key
   * @returns SHA-256 雜湊值（hex 編碼）
   */
  static hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }
}
