/**
 * @fileoverview Microsoft Graph API 服務 - SharePoint 文件操作
 * @description
 *   提供與 Microsoft Graph API 的整合，處理 SharePoint 文件的
 *   資訊查詢和下載操作。
 *
 *   ## 功能概覽
 *   - 從 SharePoint URL 獲取文件資訊
 *   - 下載 SharePoint 文件內容
 *   - 測試 Graph API 連線
 *
 *   ## 認證方式
 *   使用 Azure AD 應用程式認證（Client Credentials Flow）：
 *   - tenantId: Azure AD 租戶 ID
 *   - clientId: 應用程式 ID
 *   - clientSecret: 應用程式密鑰
 *
 *   ## URL 解析策略
 *   1. 優先嘗試 Shares API（適用於共享連結）
 *   2. 回退到路徑解析方式（適用於直接路徑）
 *
 * @module src/services/microsoft-graph.service
 * @author Development Team
 * @since Epic 9 - Story 9.1 (SharePoint 文件監控 API)
 * @lastModified 2025-12-20
 *
 * @features
 *   - SharePoint 文件資訊查詢
 *   - 文件內容下載
 *   - 連線測試
 *   - 多種 URL 格式支援
 *
 * @dependencies
 *   - @microsoft/microsoft-graph-client - Graph API 客戶端
 *   - @azure/identity - Azure 認證
 *
 * @related
 *   - src/services/sharepoint-document.service.ts - 調用此服務
 *   - src/types/sharepoint.ts - 類型定義
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import type {
  GraphApiConfig,
  SharePointFileInfo,
  SharePointUrlParts,
  SharePointSiteInfo,
  SharePointDriveInfo,
  ConnectionTestDetails,
} from '@/types/sharepoint';

// ============================================================
// Types
// ============================================================

/**
 * Graph API 回應項目
 */
interface DriveItemResponse {
  id: string;
  name: string;
  size: number;
  file?: {
    mimeType: string;
  };
  webUrl: string;
  parentReference: {
    driveId: string;
    siteId?: string;
  };
  createdDateTime: string;
  lastModifiedDateTime: string;
  '@microsoft.graph.downloadUrl'?: string;
}

/**
 * 連線測試結果
 */
export interface ConnectionTestResult {
  success: boolean;
  error?: string;
}

// ============================================================
// Error Class
// ============================================================

/**
 * Graph API 錯誤
 */
export class GraphApiError extends Error {
  constructor(
    message: string,
    public code: 'AUTH_FAILED' | 'ITEM_NOT_FOUND' | 'ACCESS_DENIED' | 'API_ERROR'
  ) {
    super(message);
    this.name = 'GraphApiError';
  }
}

// ============================================================
// Service
// ============================================================

/**
 * Microsoft Graph API 服務
 *
 * @description
 *   處理與 SharePoint 的所有交互，包含文件查詢和下載。
 *   使用 Azure AD Client Credentials 認證。
 *
 * @example
 *   const graphService = new MicrosoftGraphService({
 *     tenantId: 'your-tenant-id',
 *     clientId: 'your-client-id',
 *     clientSecret: 'your-client-secret'
 *   });
 *
 *   const fileInfo = await graphService.getFileInfoFromUrl(sharepointUrl);
 *   const content = await graphService.downloadFile(fileInfo.downloadUrl);
 */
export class MicrosoftGraphService {
  private client: Client;
  private readonly config: GraphApiConfig;

  /**
   * 建立 Microsoft Graph API 服務實例
   *
   * @param config - Graph API 配置
   */
  constructor(config: GraphApiConfig) {
    this.config = config;
    this.client = this.initializeClient();
  }

  /**
   * 初始化 Graph API 客戶端
   */
  private initializeClient(): Client {
    const credential = new ClientSecretCredential(
      this.config.tenantId,
      this.config.clientId,
      this.config.clientSecret
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });

    return Client.initWithMiddleware({
      authProvider,
    });
  }

  /**
   * 從 SharePoint URL 獲取文件資訊
   *
   * @description
   *   嘗試從 SharePoint URL 獲取文件的詳細資訊。
   *   優先使用 Shares API（適用於共享連結），
   *   失敗時回退到路徑解析方式。
   *
   * @param sharepointUrl - SharePoint 文件 URL
   * @returns 文件資訊
   * @throws {GraphApiError} 當無法獲取文件資訊時
   *
   * @example
   *   const fileInfo = await service.getFileInfoFromUrl(
   *     'https://tenant.sharepoint.com/sites/Site/Shared%20Documents/invoice.pdf'
   *   );
   */
  async getFileInfoFromUrl(sharepointUrl: string): Promise<SharePointFileInfo> {
    // 嘗試使用 shares API（適用於共享連結）
    try {
      const encodedUrl = this.encodeSharePointUrl(sharepointUrl);
      const shareResponse = (await this.client
        .api(`/shares/${encodedUrl}/driveItem`)
        .get()) as DriveItemResponse;

      const downloadUrl = await this.getDownloadUrl(
        shareResponse.parentReference.driveId,
        shareResponse.id
      );

      return this.mapToFileInfo(shareResponse, downloadUrl);
    } catch {
      // 回退到路徑解析方式
      const urlParts = this.parseSharePointUrl(sharepointUrl);
      if (!urlParts) {
        throw new GraphApiError(
          'Invalid SharePoint URL format',
          'API_ERROR'
        );
      }
      return this.getFileInfoFromPath(urlParts.siteUrl, urlParts.filePath);
    }
  }

  /**
   * 從站點路徑獲取文件資訊
   *
   * @param siteUrl - SharePoint 站點 URL
   * @param filePath - 文件相對路徑
   * @returns 文件資訊
   */
  private async getFileInfoFromPath(
    siteUrl: string,
    filePath: string
  ): Promise<SharePointFileInfo> {
    const siteId = await this.getSiteId(siteUrl);

    const file = (await this.client
      .api(`/sites/${siteId}/drive/root:/${filePath}`)
      .get()) as DriveItemResponse;

    const downloadUrl = await this.getDownloadUrl(
      file.parentReference.driveId,
      file.id
    );

    return this.mapToFileInfo(file, downloadUrl, siteId);
  }

  /**
   * 獲取站點 ID
   *
   * @param siteUrl - SharePoint 站點 URL
   * @returns 站點 ID
   */
  private async getSiteId(siteUrl: string): Promise<string> {
    const url = new URL(siteUrl);
    const hostname = url.hostname;
    const sitePath = url.pathname;

    const site = await this.client.api(`/sites/${hostname}:${sitePath}`).get();

    return site.id as string;
  }

  /**
   * 獲取文件下載 URL
   *
   * @param driveId - Drive ID
   * @param itemId - Item ID
   * @returns 下載 URL
   */
  private async getDownloadUrl(driveId: string, itemId: string): Promise<string> {
    const item = (await this.client
      .api(`/drives/${driveId}/items/${itemId}`)
      .select('@microsoft.graph.downloadUrl')
      .get()) as DriveItemResponse;

    const downloadUrl = item['@microsoft.graph.downloadUrl'];
    if (!downloadUrl) {
      throw new GraphApiError(
        'Download URL not available for this item',
        'API_ERROR'
      );
    }

    return downloadUrl;
  }

  /**
   * 下載文件內容（使用下載 URL）
   *
   * @description
   *   使用文件的下載 URL 獲取文件內容。
   *   下載 URL 是預先簽名的，有時效性。
   *
   * @param downloadUrl - 文件下載 URL
   * @returns 文件內容 Buffer
   * @throws {GraphApiError} 當下載失敗時
   *
   * @example
   *   const content = await service.downloadFile(fileInfo.downloadUrl);
   */
  async downloadFile(downloadUrl: string): Promise<Buffer> {
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new GraphApiError(
        `Failed to download file: ${response.status} ${response.statusText}`,
        'API_ERROR'
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * 下載文件內容（使用 Drive ID 和 Item ID）
   *
   * @description
   *   使用 Drive ID 和 Item ID 直接通過 Graph API 下載文件。
   *   適用於需要即時下載的場景。
   *
   * @param driveId - Drive ID
   * @param itemId - Item ID
   * @returns 文件內容 Buffer
   */
  async downloadFileById(driveId: string, itemId: string): Promise<Buffer> {
    const stream = await this.client
      .api(`/drives/${driveId}/items/${itemId}/content`)
      .getStream();

    return this.streamToBuffer(stream);
  }

  /**
   * 測試連線
   *
   * @description
   *   測試與 Microsoft Graph API 的連線是否正常。
   *   通過查詢組織資訊來驗證認證是否有效。
   *
   * @returns 連線測試結果
   *
   * @example
   *   const result = await service.testConnection();
   *   if (result.success) {
   *     console.log('Connection successful');
   *   }
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.client.api('/organization').get();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * 測試連線並獲取詳情
   *
   * @description
   *   測試與 Microsoft Graph API 的連線並獲取詳細資訊，
   *   包含站點資訊和 Drive 資訊。用於 Story 9-2 配置管理。
   *
   * @param siteUrl - SharePoint 站點 URL
   * @param libraryPath - 文件庫路徑（可選）
   * @returns 連線測試結果含詳情
   *
   * @example
   *   const result = await service.testConnectionWithDetails(
   *     'https://tenant.sharepoint.com/sites/MySite',
   *     'Shared Documents'
   *   );
   */
  async testConnectionWithDetails(
    siteUrl: string,
    libraryPath?: string
  ): Promise<ConnectionTestResult & { details?: ConnectionTestDetails }> {
    try {
      // 取得站點資訊
      const siteInfo = await this.getSiteInfo(siteUrl);

      // 取得 Drive 資訊（如果提供文件庫路徑）
      let driveInfo: SharePointDriveInfo | undefined;
      if (libraryPath) {
        const siteId = await this.getSiteId(siteUrl);
        driveInfo = await this.getDriveInfo(siteId, libraryPath);
      }

      return {
        success: true,
        details: {
          siteInfo: {
            id: siteInfo.id,
            name: siteInfo.displayName,
            webUrl: siteInfo.webUrl,
          },
          driveInfo: driveInfo
            ? {
                id: driveInfo.id,
                name: driveInfo.name,
                driveType: driveInfo.driveType,
              }
            : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * 獲取 SharePoint 站點資訊
   *
   * @description
   *   從站點 URL 獲取站點的詳細資訊。
   *   用於驗證站點存在並且有權限存取。
   *
   * @param siteUrl - SharePoint 站點 URL
   * @returns 站點資訊
   * @throws {GraphApiError} 當無法獲取站點資訊時
   *
   * @example
   *   const siteInfo = await service.getSiteInfo(
   *     'https://tenant.sharepoint.com/sites/MySite'
   *   );
   */
  async getSiteInfo(siteUrl: string): Promise<SharePointSiteInfo> {
    try {
      const url = new URL(siteUrl);
      const hostname = url.hostname;
      const sitePath = url.pathname;

      const site = await this.client.api(`/sites/${hostname}:${sitePath}`).get();

      return {
        id: site.id,
        displayName: site.displayName,
        webUrl: site.webUrl,
        description: site.description,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        throw new GraphApiError('SharePoint site not found', 'ITEM_NOT_FOUND');
      }
      if (error instanceof Error && error.message.includes('403')) {
        throw new GraphApiError(
          'Access denied to SharePoint site',
          'ACCESS_DENIED'
        );
      }
      throw new GraphApiError(
        error instanceof Error ? error.message : 'Failed to get site info',
        'API_ERROR'
      );
    }
  }

  /**
   * 獲取 SharePoint Drive（文件庫）資訊
   *
   * @description
   *   獲取站點中指定文件庫的詳細資訊，
   *   包含 Drive ID、名稱、容量等。
   *
   * @param siteId - SharePoint 站點 ID
   * @param libraryPath - 文件庫名稱或路徑
   * @returns Drive 資訊
   * @throws {GraphApiError} 當無法獲取 Drive 資訊時
   *
   * @example
   *   const driveInfo = await service.getDriveInfo(siteId, 'Shared Documents');
   */
  async getDriveInfo(siteId: string, libraryPath: string): Promise<SharePointDriveInfo> {
    try {
      // 先嘗試通過名稱直接獲取 Drive
      const drivesResponse = await this.client
        .api(`/sites/${siteId}/drives`)
        .get();

      const drives = drivesResponse.value as Array<{
        id: string;
        name: string;
        driveType: string;
        webUrl: string;
        quota?: {
          used: number;
          total: number;
        };
      }>;

      // 搜尋匹配的 Drive
      const matchingDrive = drives.find(
        (drive) =>
          drive.name.toLowerCase() === libraryPath.toLowerCase() ||
          drive.webUrl.toLowerCase().includes(libraryPath.toLowerCase())
      );

      if (!matchingDrive) {
        // 回退到預設 Drive
        const defaultDrive = await this.client.api(`/sites/${siteId}/drive`).get();
        return {
          id: defaultDrive.id,
          name: defaultDrive.name,
          driveType: defaultDrive.driveType,
          webUrl: defaultDrive.webUrl,
          quota: defaultDrive.quota,
        };
      }

      return {
        id: matchingDrive.id,
        name: matchingDrive.name,
        driveType: matchingDrive.driveType,
        webUrl: matchingDrive.webUrl,
        quota: matchingDrive.quota,
      };
    } catch (error) {
      throw new GraphApiError(
        error instanceof Error ? error.message : 'Failed to get drive info',
        'API_ERROR'
      );
    }
  }

  /**
   * 獲取站點的所有 Drives（文件庫）列表
   *
   * @description
   *   列出站點中所有可用的文件庫，用於配置時選擇文件庫。
   *
   * @param siteUrl - SharePoint 站點 URL
   * @returns Drive 資訊列表
   */
  async listDrives(siteUrl: string): Promise<SharePointDriveInfo[]> {
    const siteId = await this.getSiteId(siteUrl);

    const response = await this.client.api(`/sites/${siteId}/drives`).get();

    return (response.value as Array<{
      id: string;
      name: string;
      driveType: string;
      webUrl: string;
      quota?: { used: number; total: number };
    }>).map((drive) => ({
      id: drive.id,
      name: drive.name,
      driveType: drive.driveType,
      webUrl: drive.webUrl,
      quota: drive.quota,
    }));
  }

  /**
   * 編碼 SharePoint URL 用於 shares API
   *
   * @description
   *   將 SharePoint URL 編碼為 shares API 可接受的格式。
   *   使用 base64 URL 安全編碼，並添加 'u!' 前綴。
   *
   * @param url - SharePoint URL
   * @returns 編碼後的字串
   */
  private encodeSharePointUrl(url: string): string {
    const base64 = Buffer.from(url).toString('base64');
    return (
      'u!' +
      base64.replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-')
    );
  }

  /**
   * 解析 SharePoint URL
   *
   * @description
   *   從 SharePoint URL 中解析出站點 URL 和文件路徑。
   *   支援 /sites/ 和 /s/ 兩種路徑格式。
   *
   * @param url - SharePoint URL
   * @returns 解析結果，或 null（無法解析時）
   */
  private parseSharePointUrl(url: string): SharePointUrlParts | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');

      // 尋找 sites 或 s 路徑
      const sitesIndex =
        pathParts.indexOf('sites') !== -1
          ? pathParts.indexOf('sites')
          : pathParts.indexOf('s');

      if (sitesIndex === -1) {
        return null;
      }

      const siteUrl = `${urlObj.origin}/sites/${pathParts[sitesIndex + 1]}`;
      const filePath = pathParts.slice(sitesIndex + 2).join('/');

      return {
        siteUrl,
        filePath: decodeURIComponent(filePath),
      };
    } catch {
      return null;
    }
  }

  /**
   * 映射 Graph API 回應到 FileInfo
   *
   * @param response - Graph API 回應
   * @param downloadUrl - 下載 URL
   * @param siteId - 站點 ID（可選）
   * @returns 標準化的文件資訊
   */
  private mapToFileInfo(
    response: DriveItemResponse,
    downloadUrl: string,
    siteId?: string
  ): SharePointFileInfo {
    return {
      id: response.id,
      name: response.name,
      size: response.size,
      mimeType: response.file?.mimeType || 'application/octet-stream',
      webUrl: response.webUrl,
      driveId: response.parentReference.driveId,
      siteId: siteId || response.parentReference.siteId || '',
      createdDateTime: response.createdDateTime,
      lastModifiedDateTime: response.lastModifiedDateTime,
      downloadUrl,
    };
  }

  /**
   * Stream 轉換為 Buffer
   *
   * @param stream - Node.js Readable Stream
   * @returns Buffer
   */
  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer | string) =>
        chunks.push(Buffer.from(chunk))
      );
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
