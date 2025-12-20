/**
 * @fileoverview Outlook 郵件服務 - 繼承 MicrosoftGraphService
 * @description
 *   提供與 Microsoft Graph API 的整合，專門處理 Outlook 郵件的
 *   資訊查詢和附件下載操作。繼承 MicrosoftGraphService 並擴展
 *   郵件相關功能。
 *
 *   ## 功能概覽
 *   - 獲取郵件資訊
 *   - 獲取附件內容
 *   - 獲取所有非內嵌附件
 *   - 測試郵箱存取權限
 *   - 獲取郵箱基本資訊
 *   - 獲取最近郵件數量
 *   - 獲取郵件資料夾列表
 *
 *   ## 認證方式
 *   使用 Azure AD 應用程式認證（Client Credentials Flow）：
 *   - tenantId: Azure AD 租戶 ID
 *   - clientId: 應用程式 ID
 *   - clientSecret: 應用程式密鑰
 *
 * @module src/services/outlook-mail.service
 * @author Development Team
 * @since Epic 9 - Story 9.3 (Outlook 郵件附件提取 API)
 * @lastModified 2025-12-20
 *
 * @features
 *   - 郵件資訊查詢
 *   - 附件內容下載
 *   - 批量附件獲取
 *   - 郵箱存取測試
 *   - 郵箱資訊獲取 (Story 9.4)
 *   - 最近郵件數量統計 (Story 9.4)
 *   - 郵件資料夾列表 (Story 9.4)
 *
 * @dependencies
 *   - @microsoft/microsoft-graph-client - Graph API 客戶端
 *   - @azure/identity - Azure 認證
 *
 * @related
 *   - src/services/microsoft-graph.service.ts - 父類
 *   - src/services/outlook-document.service.ts - 調用此服務
 *   - src/services/outlook-config.service.ts - 配置服務 (Story 9.4)
 *   - src/types/outlook.ts - 類型定義
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import type { GraphApiConfig } from '@/types/sharepoint';
import type { MailInfo, AttachmentInfo, AttachmentContent } from '@/types/outlook';

// ============================================================
// Types
// ============================================================

/**
 * Graph API 郵件回應
 */
interface MailMessageResponse {
  id: string;
  subject: string;
  sender?: {
    emailAddress?: {
      address: string;
      name?: string;
    };
  };
  receivedDateTime: string;
  attachments?: AttachmentResponse[];
}

/**
 * Graph API 附件回應
 */
interface AttachmentResponse {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentBytes?: string;
}

/**
 * 郵箱存取測試結果
 */
export interface MailboxAccessTestResult {
  success: boolean;
  error?: string;
}

// ============================================================
// Service
// ============================================================

/**
 * Outlook 郵件服務
 *
 * @description
 *   處理與 Outlook 郵件的所有交互，包含郵件查詢和附件下載。
 *   使用 Azure AD Client Credentials 認證。
 *
 * @example
 *   const mailService = new OutlookMailService(
 *     {
 *       tenantId: 'your-tenant-id',
 *       clientId: 'your-client-id',
 *       clientSecret: 'your-client-secret'
 *     },
 *     'mailbox@example.com'
 *   );
 *
 *   const mailInfo = await mailService.getMailInfo(messageId);
 *   const attachments = await mailService.getAllAttachments(messageId);
 */
export class OutlookMailService {
  private client: Client;
  private readonly mailboxAddress: string;
  private readonly config: GraphApiConfig;

  /**
   * 建立 Outlook 郵件服務實例
   *
   * @param config - Graph API 配置
   * @param mailboxAddress - 郵箱地址
   */
  constructor(config: GraphApiConfig, mailboxAddress: string) {
    this.config = config;
    this.mailboxAddress = mailboxAddress;
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
   * 獲取郵件資訊
   *
   * @description
   *   從指定郵箱獲取郵件的詳細資訊，包含主旨、寄件者和附件列表。
   *
   * @param messageId - 郵件 ID
   * @returns 郵件資訊
   *
   * @example
   *   const mailInfo = await mailService.getMailInfo('AAMkAGI2...');
   */
  async getMailInfo(messageId: string): Promise<MailInfo> {
    const message = (await this.client
      .api(`/users/${this.mailboxAddress}/messages/${messageId}`)
      .select('id,subject,sender,receivedDateTime')
      .expand('attachments($select=id,name,contentType,size,isInline)')
      .get()) as MailMessageResponse;

    return {
      id: message.id,
      subject: message.subject,
      sender: {
        email: message.sender?.emailAddress?.address || '',
        name: message.sender?.emailAddress?.name,
      },
      receivedDateTime: message.receivedDateTime,
      attachments: this.mapAttachments(message.attachments || []),
    };
  }

  /**
   * 獲取單一附件內容
   *
   * @description
   *   從指定郵件獲取單一附件的完整內容，包含 Base64 編碼的檔案內容。
   *
   * @param messageId - 郵件 ID
   * @param attachmentId - 附件 ID
   * @returns 附件內容（含 Base64 編碼）
   *
   * @example
   *   const content = await mailService.getAttachmentContent(
   *     'AAMkAGI2...',
   *     'AAMkAGI2TG9...'
   *   );
   */
  async getAttachmentContent(
    messageId: string,
    attachmentId: string
  ): Promise<AttachmentContent> {
    const attachment = (await this.client
      .api(
        `/users/${this.mailboxAddress}/messages/${messageId}/attachments/${attachmentId}`
      )
      .get()) as AttachmentResponse;

    return {
      id: attachment.id,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
      isInline: attachment.isInline,
      contentBytes: attachment.contentBytes || '',
    };
  }

  /**
   * 獲取所有非內嵌附件
   *
   * @description
   *   從指定郵件獲取所有非內嵌附件（排除簽名圖片等）的完整內容。
   *   使用並行請求加速下載。
   *
   * @param messageId - 郵件 ID
   * @returns 附件內容陣列
   *
   * @example
   *   const attachments = await mailService.getAllAttachments('AAMkAGI2...');
   */
  async getAllAttachments(messageId: string): Promise<AttachmentContent[]> {
    const mailInfo = await this.getMailInfo(messageId);

    // 過濾內嵌附件
    const regularAttachments = mailInfo.attachments.filter(
      (att) => !att.isInline
    );

    // 並行獲取所有附件內容
    const attachmentContents = await Promise.all(
      regularAttachments.map((att) =>
        this.getAttachmentContent(messageId, att.id)
      )
    );

    return attachmentContents;
  }

  /**
   * 測試郵箱存取權限
   *
   * @description
   *   測試是否有權限存取指定郵箱。先測試用戶資訊存取，
   *   再測試郵件讀取權限。
   *
   * @returns 存取測試結果
   *
   * @example
   *   const result = await mailService.testMailboxAccess();
   *   if (result.success) {
   *     console.log('Mailbox access granted');
   *   }
   */
  async testMailboxAccess(): Promise<MailboxAccessTestResult> {
    try {
      // 測試用戶資訊存取
      await this.client
        .api(`/users/${this.mailboxAddress}`)
        .select('id,displayName,mail')
        .get();

      // 測試郵件讀取權限
      await this.client
        .api(`/users/${this.mailboxAddress}/messages`)
        .top(1)
        .select('id')
        .get();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * 獲取郵箱資訊
   *
   * @description
   *   獲取郵箱的基本資訊，用於驗證郵箱存在且有權限存取。
   *
   * @returns 郵箱資訊
   */
  async getMailboxInfo(): Promise<{
    id: string;
    displayName: string;
    mail: string;
  }> {
    const user = await this.client
      .api(`/users/${this.mailboxAddress}`)
      .select('id,displayName,mail')
      .get();

    return {
      id: user.id,
      displayName: user.displayName,
      mail: user.mail,
    };
  }

  /**
   * 獲取最近郵件數量
   *
   * @description
   *   獲取指定時間範圍內收到的郵件數量。
   *   用於連線測試和監控統計。
   *
   * @param hours - 時間範圍（小時），預設 24 小時
   * @returns 郵件數量
   *
   * @example
   *   const count = await mailService.getRecentMailCount(24);
   *   console.log(`過去 24 小時收到 ${count} 封郵件`);
   */
  async getRecentMailCount(hours: number = 24): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    try {
      // 嘗試使用 $count 參數
      const result = await this.client
        .api(`/users/${this.mailboxAddress}/messages`)
        .filter(`receivedDateTime ge ${since}`)
        .count()
        .top(1)
        .get();

      return result['@odata.count'] || 0;
    } catch {
      // 如果計數失敗，嘗試獲取所有郵件並計數
      const result = await this.client
        .api(`/users/${this.mailboxAddress}/messages`)
        .filter(`receivedDateTime ge ${since}`)
        .select('id')
        .top(1000)
        .get();

      return result.value?.length || 0;
    }
  }

  /**
   * 獲取郵件資料夾列表
   *
   * @description
   *   獲取郵箱的所有資料夾，包含資料夾名稱、ID 和郵件數量。
   *   用於配置界面顯示可選的資料夾。
   *
   * @returns 資料夾列表
   *
   * @example
   *   const folders = await mailService.getMailFolders();
   *   folders.forEach(f => console.log(`${f.displayName}: ${f.totalItemCount} 封`));
   */
  async getMailFolders(): Promise<
    Array<{
      id: string;
      displayName: string;
      totalItemCount: number;
      unreadItemCount: number;
    }>
  > {
    interface GraphMailFolder {
      id: string;
      displayName: string;
      totalItemCount?: number;
      unreadItemCount?: number;
    }

    const result = await this.client
      .api(`/users/${this.mailboxAddress}/mailFolders`)
      .select('id,displayName,totalItemCount,unreadItemCount')
      .top(50)
      .get();

    return result.value.map((folder: GraphMailFolder) => ({
      id: folder.id,
      displayName: folder.displayName,
      totalItemCount: folder.totalItemCount || 0,
      unreadItemCount: folder.unreadItemCount || 0,
    }));
  }

  /**
   * 獲取特定資料夾的子資料夾
   *
   * @description
   *   獲取指定資料夾的子資料夾列表。
   *
   * @param folderId - 父資料夾 ID
   * @returns 子資料夾列表
   */
  async getChildFolders(
    folderId: string
  ): Promise<
    Array<{
      id: string;
      displayName: string;
      totalItemCount: number;
      unreadItemCount: number;
    }>
  > {
    interface GraphMailFolder {
      id: string;
      displayName: string;
      totalItemCount?: number;
      unreadItemCount?: number;
    }

    const result = await this.client
      .api(
        `/users/${this.mailboxAddress}/mailFolders/${folderId}/childFolders`
      )
      .select('id,displayName,totalItemCount,unreadItemCount')
      .get();

    return result.value.map((folder: GraphMailFolder) => ({
      id: folder.id,
      displayName: folder.displayName,
      totalItemCount: folder.totalItemCount || 0,
      unreadItemCount: folder.unreadItemCount || 0,
    }));
  }

  /**
   * 映射附件列表
   *
   * @param attachments - Graph API 附件回應
   * @returns 標準化的附件資訊列表
   */
  private mapAttachments(attachments: AttachmentResponse[]): AttachmentInfo[] {
    return attachments.map((att) => ({
      id: att.id,
      name: att.name,
      contentType: att.contentType,
      size: att.size,
      isInline: att.isInline || false,
    }));
  }
}
