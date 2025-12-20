/**
 * @fileoverview 工作流觸發服務 - 管理手動觸發 n8n 工作流
 * @description
 *   本模組負責工作流手動觸發的完整流程，包含：
 *   - 列出可觸發的工作流
 *   - 解析工作流參數 Schema
 *   - 驗證觸發參數
 *   - 發送觸發請求
 *   - 重試失敗的執行
 *   - 取消執行
 *
 *   ## 觸發流程
 *   1. 驗證工作流存在且啟用
 *   2. 檢查城市和角色權限
 *   3. 驗證參數和文件選擇
 *   4. 創建執行記錄
 *   5. 發送 Webhook 請求
 *   6. 更新執行狀態
 *
 * @module src/services/n8n/workflow-trigger.service
 * @author Development Team
 * @since Epic 10 - Story 10.4
 * @lastModified 2025-12-20
 *
 * @features
 *   - 可觸發工作流列表
 *   - 動態參數驗證
 *   - 文件選擇支持
 *   - 觸發請求發送
 *   - 重試和取消功能
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/lib/encryption - 加密工具
 *   - @/services/n8n/webhook-config.service - Webhook 配置服務
 *
 * @related
 *   - src/types/workflow-trigger.ts - 工作流觸發類型
 *   - prisma/schema.prisma - WorkflowDefinition, WorkflowExecution 模型
 */

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { webhookConfigService } from './webhook-config.service';
import type { WorkflowDefinition, Prisma } from '@prisma/client';
import type {
  TriggerWorkflowInput,
  TriggerResult,
  WorkflowParameter,
  WorkflowParametersSchema,
  DocumentSelectionConfig,
  WebhookTriggerPayload,
  TriggerErrorCode,
  TriggerableWorkflow,
} from '@/types/workflow-trigger';

// ============================================================
// Constants
// ============================================================

/** 觸發請求超時時間（毫秒） */
const TRIGGER_TIMEOUT = 30000;

// ============================================================
// Types
// ============================================================

/**
 * 列出可觸發工作流的選項
 */
interface ListTriggerableOptions {
  /** 城市代碼 */
  cityCode: string;
  /** 用戶角色列表 */
  userRoles: string[];
  /** 分類篩選 */
  category?: string;
}

/**
 * 文件資訊
 */
interface DocumentInfo {
  id: string;
  fileName: string;
  filePath: string;
  status: string;
}

// ============================================================
// Service Class
// ============================================================

/**
 * @class WorkflowTriggerService
 * @description 工作流觸發服務
 */
export class WorkflowTriggerService {
  // ============================================================
  // Public Methods - 列表和查詢
  // ============================================================

  /**
   * 列出可觸發的工作流
   *
   * @description
   *   獲取用戶可觸發的工作流列表，根據：
   *   1. 城市權限（城市特定或全域）
   *   2. 角色權限
   *   3. 工作流啟用狀態
   *
   * @param options - 查詢選項
   * @returns 可觸發的工作流列表（含解析後的參數 Schema）
   */
  async listTriggerableWorkflows(options: ListTriggerableOptions): Promise<TriggerableWorkflow[]> {
    const { cityCode, userRoles, category } = options;

    const where: Prisma.WorkflowDefinitionWhereInput = {
      isActive: true,
      OR: [
        { cityCode },
        { cityCode: null }, // 全域工作流
      ],
    };

    if (category) {
      where.category = category;
    }

    const workflows = await prisma.workflowDefinition.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });

    // 過濾有權限的工作流並解析參數 Schema
    return workflows
      .filter((workflow) => this.hasRolePermission(workflow, userRoles))
      .map((workflow) => ({
        ...workflow,
        ...this.parseParametersSchema(workflow),
      }));
  }

  /**
   * 獲取工作流定義詳情
   *
   * @param id - 工作流定義 ID
   * @returns 工作流定義或 null
   */
  async getWorkflowDefinition(id: string): Promise<WorkflowDefinition | null> {
    return prisma.workflowDefinition.findUnique({
      where: { id },
    });
  }

  /**
   * 解析參數 Schema
   *
   * @description
   *   將工作流的 parameters JSON 欄位解析為結構化的參數 Schema
   *
   * @param workflow - 工作流定義
   * @returns 解析後的參數 Schema 和文件選擇配置
   */
  parseParametersSchema(workflow: WorkflowDefinition): {
    parameterSchema: WorkflowParameter[];
    documentSelection?: DocumentSelectionConfig;
  } {
    if (!workflow.parameters) {
      return { parameterSchema: [] };
    }

    try {
      const schema = workflow.parameters as unknown as WorkflowParametersSchema;
      return {
        parameterSchema: schema.parameters || [],
        documentSelection: schema.documentSelection,
      };
    } catch {
      return { parameterSchema: [] };
    }
  }

  // ============================================================
  // Public Methods - 觸發操作
  // ============================================================

  /**
   * 觸發工作流
   *
   * @description
   *   手動觸發 n8n 工作流執行，流程：
   *   1. 驗證工作流存在且啟用
   *   2. 檢查城市權限
   *   3. 驗證參數
   *   4. 驗證文件選擇
   *   5. 創建執行記錄
   *   6. 發送 Webhook 請求
   *   7. 更新執行狀態
   *
   * @param input - 觸發輸入
   * @returns 觸發結果
   */
  async triggerWorkflow(input: TriggerWorkflowInput): Promise<TriggerResult> {
    const { workflowId, parameters = {}, documentIds, triggeredBy, cityCode } = input;

    // 獲取工作流定義
    const workflow = await this.getWorkflowDefinition(workflowId);

    if (!workflow) {
      return this.createErrorResult('WORKFLOW_NOT_FOUND', '找不到工作流定義');
    }

    if (!workflow.isActive) {
      return this.createErrorResult('WORKFLOW_INACTIVE', '工作流已停用');
    }

    // 驗證城市權限
    if (workflow.cityCode && workflow.cityCode !== cityCode) {
      return this.createErrorResult('CITY_ACCESS_DENIED', '無權存取此城市的工作流');
    }

    // 驗證參數
    const { parameterSchema, documentSelection } = this.parseParametersSchema(workflow);
    const validationError = this.validateParameters(parameters, parameterSchema);
    if (validationError) {
      return this.createErrorResult('VALIDATION_ERROR', validationError);
    }

    // 驗證文件選擇
    if (documentSelection?.required && (!documentIds || documentIds.length === 0)) {
      return this.createErrorResult('VALIDATION_ERROR', '至少需要選擇一個文件');
    }

    if (documentSelection?.maxCount && documentIds && documentIds.length > documentSelection.maxCount) {
      return this.createErrorResult(
        'VALIDATION_ERROR',
        `最多只能選擇 ${documentSelection.maxCount} 個文件`
      );
    }

    // 獲取相關文件資訊
    let documents: DocumentInfo[] = [];
    if (documentIds && documentIds.length > 0) {
      documents = await prisma.document.findMany({
        where: { id: { in: documentIds } },
        select: {
          id: true,
          fileName: true,
          filePath: true,
          status: true,
        },
      });

      // 驗證所有文件都存在
      if (documents.length !== documentIds.length) {
        return this.createErrorResult('DOCUMENT_NOT_FOUND', '部分文件不存在');
      }
    }

    // 創建執行記錄
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowName: workflow.name,
        workflowId: workflow.n8nWorkflowId,
        workflowDefinitionId: workflow.id,
        triggerType: 'MANUAL',
        triggerSource: '手動觸發',
        triggeredBy,
        triggerData: parameters as Prisma.InputJsonValue,
        cityCode,
        status: 'PENDING',
        documentCount: documents.length,
        documents: documentIds
          ? { connect: documentIds.map((id) => ({ id })) }
          : undefined,
      },
    });

    // 準備 Webhook 請求
    const webhookPayload: WebhookTriggerPayload = {
      executionId: execution.id,
      workflowId: workflow.n8nWorkflowId,
      triggerType: 'manual',
      triggeredBy,
      cityCode,
      timestamp: new Date().toISOString(),
      parameters,
      documents: documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        blobUrl: doc.filePath,
      })),
    };

    try {
      // 發送觸發請求
      const response = await this.sendTriggerRequest(
        workflow,
        execution.id,
        webhookPayload,
        cityCode
      );

      // 更新執行記錄
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'QUEUED',
          n8nExecutionId: response.executionId,
        },
      });

      return {
        success: true,
        executionId: execution.id,
        n8nExecutionId: response.executionId,
      };
    } catch (error) {
      // 更新執行記錄為失敗
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      const errorCode = this.parseErrorCode(error);

      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorDetails: {
            message: errorMessage,
            code: errorCode,
            stage: 'trigger',
            timestamp: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      return {
        success: false,
        executionId: execution.id,
        error: errorMessage,
        errorCode,
      };
    }
  }

  /**
   * 重試觸發
   *
   * @description
   *   重新觸發失敗的執行，使用原始的參數和文件
   *
   * @param executionId - 執行記錄 ID
   * @param triggeredBy - 觸發者 ID
   * @returns 觸發結果
   */
  async retryTrigger(executionId: string, triggeredBy: string): Promise<TriggerResult> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        documents: {
          select: { id: true },
        },
      },
    });

    if (!execution) {
      return this.createErrorResult('WORKFLOW_NOT_FOUND', '找不到執行記錄');
    }

    if (execution.status !== 'FAILED') {
      return this.createErrorResult('VALIDATION_ERROR', '只能重試失敗的執行');
    }

    // 查找原始工作流定義
    let workflow: WorkflowDefinition | null = null;

    // 優先使用 workflowDefinitionId
    if (execution.workflowDefinitionId) {
      workflow = await prisma.workflowDefinition.findUnique({
        where: { id: execution.workflowDefinitionId },
      });
    }

    // 如果沒有 workflowDefinitionId，嘗試用 n8n 工作流 ID 查找
    if (!workflow && execution.workflowId) {
      workflow = await prisma.workflowDefinition.findFirst({
        where: { n8nWorkflowId: execution.workflowId },
      });
    }

    if (!workflow) {
      return this.createErrorResult('WORKFLOW_NOT_FOUND', '找不到工作流定義');
    }

    // 重新觸發
    return this.triggerWorkflow({
      workflowId: workflow.id,
      parameters: execution.triggerData as Record<string, unknown> | undefined,
      documentIds: execution.documents.map((d) => d.id),
      triggeredBy,
      cityCode: execution.cityCode,
    });
  }

  /**
   * 取消執行
   *
   * @description
   *   取消等待中或排隊中的執行
   *
   * @param executionId - 執行記錄 ID
   * @param cancelledBy - 取消者 ID
   * @returns 是否成功取消
   */
  async cancelExecution(executionId: string, cancelledBy: string): Promise<boolean> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      return false;
    }

    // 只有 PENDING 或 QUEUED 狀態可以取消
    if (!['PENDING', 'QUEUED'].includes(execution.status)) {
      return false;
    }

    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        errorDetails: {
          message: '使用者取消',
          cancelledBy,
          timestamp: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return true;
  }

  // ============================================================
  // Private Methods - 請求發送
  // ============================================================

  /**
   * 發送觸發請求
   *
   * @description
   *   向 n8n Webhook 發送觸發請求
   *
   * @param workflow - 工作流定義
   * @param executionId - 執行記錄 ID
   * @param payload - Webhook Payload
   * @param cityCode - 城市代碼
   * @returns n8n 執行 ID
   */
  private async sendTriggerRequest(
    workflow: WorkflowDefinition,
    executionId: string,
    payload: WebhookTriggerPayload,
    cityCode: string
  ): Promise<{ executionId: string }> {
    // 建構請求標頭
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Execution-Id': executionId,
      'X-Trigger-Type': 'manual',
      'X-City-Code': cityCode,
    };

    // 獲取認證 Token
    const webhookConfigs = await webhookConfigService.getActiveConfigs(cityCode);
    if (webhookConfigs.length > 0) {
      // 使用第一個配置的 ID 獲取完整配置
      const config = await prisma.webhookConfig.findUnique({
        where: { id: webhookConfigs[0].id },
      });
      if (config) {
        const decryptResult = decrypt(config.authToken);
        if (decryptResult.success) {
          headers['Authorization'] = `Bearer ${decryptResult.decrypted}`;
        }
      }
    }

    // 發送請求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TRIGGER_TIMEOUT);

    try {
      const response = await fetch(workflow.triggerUrl, {
        method: workflow.triggerMethod,
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      return {
        executionId: responseData.executionId || responseData.id || executionId,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('觸發請求超時');
      }
      throw error;
    }
  }

  // ============================================================
  // Private Methods - 驗證
  // ============================================================

  /**
   * 驗證參數
   *
   * @param values - 參數值
   * @param schema - 參數 Schema
   * @returns 驗證錯誤訊息或 null
   */
  private validateParameters(
    values: Record<string, unknown>,
    schema: WorkflowParameter[]
  ): string | null {
    for (const param of schema) {
      const value = values[param.name];

      // 檢查依賴條件
      if (param.dependsOn) {
        const dependValue = values[param.dependsOn.field];
        if (dependValue !== param.dependsOn.value) {
          continue; // 跳過不符合依賴條件的參數
        }
      }

      // 檢查必填
      if (param.required && (value === undefined || value === null || value === '')) {
        return `參數「${param.label}」為必填`;
      }

      if (value === undefined || value === null) continue;

      // 類型驗證
      const typeError = this.validateParameterType(param, value);
      if (typeError) return typeError;
    }

    return null;
  }

  /**
   * 驗證參數類型
   *
   * @param param - 參數定義
   * @param value - 參數值
   * @returns 驗證錯誤訊息或 null
   */
  private validateParameterType(param: WorkflowParameter, value: unknown): string | null {
    switch (param.type) {
      case 'number': {
        if (typeof value !== 'number' || isNaN(value)) {
          return `參數「${param.label}」必須是數字`;
        }
        const { min, max, message } = param.validation ?? {};
        if (min !== undefined && value < min) {
          return message ?? `參數「${param.label}」不能小於 ${min}`;
        }
        if (max !== undefined && value > max) {
          return message ?? `參數「${param.label}」不能大於 ${max}`;
        }
        break;
      }

      case 'string':
      case 'text': {
        if (typeof value !== 'string') {
          return `參數「${param.label}」必須是文字`;
        }
        const { minLength, maxLength, pattern, message } = param.validation ?? {};
        if (minLength !== undefined && value.length < minLength) {
          return message ?? `參數「${param.label}」至少需要 ${minLength} 個字元`;
        }
        if (maxLength !== undefined && value.length > maxLength) {
          return message ?? `參數「${param.label}」最多 ${maxLength} 個字元`;
        }
        if (pattern) {
          const regex = new RegExp(pattern);
          if (!regex.test(value)) {
            return message ?? `參數「${param.label}」格式不正確`;
          }
        }
        break;
      }

      case 'boolean': {
        if (typeof value !== 'boolean') {
          return `參數「${param.label}」必須是布林值`;
        }
        break;
      }

      case 'date': {
        if (!(value instanceof Date) && isNaN(Date.parse(value as string))) {
          return `參數「${param.label}」必須是有效的日期`;
        }
        break;
      }

      case 'select': {
        if (param.options && !param.options.some((opt) => opt.value === value)) {
          return `參數「${param.label}」的值無效`;
        }
        break;
      }

      case 'multiselect': {
        if (!Array.isArray(value)) {
          return `參數「${param.label}」必須是陣列`;
        }
        if (param.options) {
          const validValues = param.options.map((opt) => opt.value);
          if (!(value as unknown[]).every((v) => validValues.includes(v as string))) {
            return `參數「${param.label}」包含無效的值`;
          }
        }
        break;
      }
    }

    return null;
  }

  /**
   * 檢查角色權限
   *
   * @param workflow - 工作流定義
   * @param userRoles - 用戶角色列表
   * @returns 是否有權限
   */
  private hasRolePermission(workflow: WorkflowDefinition, userRoles: string[]): boolean {
    // 如果沒有限制角色，則所有人都可以觸發
    if (workflow.allowedRoles.length === 0) return true;
    // 檢查用戶是否有任一允許的角色
    return workflow.allowedRoles.some((role) => userRoles.includes(role));
  }

  // ============================================================
  // Private Methods - 工具方法
  // ============================================================

  /**
   * 創建錯誤結果
   *
   * @param code - 錯誤代碼
   * @param message - 錯誤訊息
   * @returns 錯誤結果
   */
  private createErrorResult(code: TriggerErrorCode, message: string): TriggerResult {
    return { success: false, error: message, errorCode: code };
  }

  /**
   * 解析錯誤代碼
   *
   * @param error - 錯誤對象
   * @returns 錯誤代碼
   */
  private parseErrorCode(error: unknown): TriggerErrorCode {
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('超時')) return 'TIMEOUT';
      if (error.message.includes('network') || error.message.includes('網路')) return 'NETWORK_ERROR';
      if (error.message.includes('HTTP')) return 'WEBHOOK_FAILED';
    }
    return 'UNKNOWN';
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * 工作流觸發服務單例
 */
export const workflowTriggerService = new WorkflowTriggerService();
