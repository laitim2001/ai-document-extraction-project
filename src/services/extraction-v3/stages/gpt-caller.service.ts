/**
 * @fileoverview GPT Caller Service - 三階段共用的 GPT 調用服務
 * @description
 *   提供統一的 GPT API 調用接口，支援：
 *   - GPT-5-nano：Stage 1 & 2 使用（快速、低成本）
 *   - GPT-5.2：Stage 3 使用（高精度、複雜任務）
 *
 * @module src/services/extraction-v3/stages/gpt-caller.service
 * @since CHANGE-024 - Three-Stage Extraction Architecture
 * @lastModified 2026-02-01
 *
 * @features
 *   - 模型選擇：GPT-5-nano vs GPT-5.2
 *   - 圖片處理：支援 low/high/auto 詳情模式
 *   - 重試機制：自動重試失敗的請求
 *   - Token 追蹤：記錄輸入/輸出 Token 使用量
 *   - 結構化輸出：強制 JSON 格式響應
 *
 * @dependencies
 *   - Azure OpenAI Service
 *
 * @related
 *   - src/services/extraction-v3/unified-gpt-extraction.service.ts
 *   - src/services/extraction-v3/stages/stage-1-company.service.ts
 *   - src/services/extraction-v3/stages/stage-2-format.service.ts
 *   - src/services/extraction-v3/stages/stage-3-extraction.service.ts
 */

// ============================================================================
// Types
// ============================================================================

/**
 * GPT 模型類型
 */
export type GptModelType = 'gpt-5-nano' | 'gpt-5.2';

/**
 * 圖片詳情模式
 */
export type ImageDetailMode = 'auto' | 'low' | 'high';

/**
 * GPT 調用配置
 */
export interface GptCallerConfig {
  /** Azure OpenAI 端點 */
  endpoint?: string;
  /** API 金鑰 */
  apiKey?: string;
  /** GPT-5-nano 部署名稱 */
  nanoDeploymentName?: string;
  /** GPT-5.2 部署名稱 */
  fullDeploymentName?: string;
  /** 最大 Token 數 */
  maxTokens?: number;
  /** 溫度（0-1） */
  temperature?: number;
  /** 超時時間（毫秒） */
  timeout?: number;
  /** 重試次數 */
  retryCount?: number;
  /** 重試延遲（毫秒） */
  retryDelay?: number;
}

/**
 * GPT 調用輸入
 */
export interface GptCallInput {
  /** 模型類型 */
  model: GptModelType;
  /** System Prompt */
  systemPrompt: string;
  /** User Prompt */
  userPrompt: string;
  /** Base64 圖片陣列 */
  imageBase64Array: string[];
  /** 圖片詳情模式 */
  imageDetailMode?: ImageDetailMode;
  /** JSON Schema（可選） */
  jsonSchema?: Record<string, unknown>;
}

/**
 * GPT 調用結果
 */
export interface GptCallResult {
  /** 是否成功 */
  success: boolean;
  /** 響應內容 */
  response: string;
  /** 錯誤訊息 */
  error?: string;
  /** Token 使用情況 */
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  /** 使用的模型 */
  model: string;
  /** 處理時間（毫秒） */
  durationMs: number;
}

/**
 * GPT Vision 訊息內容
 */
interface GptMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: ImageDetailMode;
  };
}

/**
 * GPT 訊息
 */
interface GptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | GptMessageContent[];
}

/**
 * GPT API 響應
 */
interface GptApiResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/** API 版本 */
const API_VERSION = '2024-06-01';

/** 預設配置 */
const DEFAULT_CONFIG: Required<GptCallerConfig> = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
  apiKey: process.env.AZURE_OPENAI_API_KEY || '',
  nanoDeploymentName:
    process.env.AZURE_OPENAI_NANO_DEPLOYMENT_NAME || 'gpt-5-nano',
  fullDeploymentName:
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-5-2-vision',
  maxTokens: 4096,
  temperature: 0.1,
  timeout: 60000,
  retryCount: 2,
  retryDelay: 1000,
};

/** 模型配置 */
const MODEL_CONFIG = {
  'gpt-5-nano': {
    // 輕量模型：用於識別任務（Stage 1 & 2）
    // 注意：GPT-5-nano 會使用 reasoning_tokens，需要留足夠空間給實際輸出
    // 典型情況：reasoning 用 512-1024 tokens，實際輸出需要額外 256-512 tokens
    maxTokens: 2048, // 增加到 2048 以確保有足夠空間輸出 JSON 響應
    temperature: undefined as number | undefined, // GPT-5-nano 不支援自定義 temperature，只能使用預設值 1
    defaultImageDetail: 'low' as ImageDetailMode, // 低解析度以節省成本
  },
  'gpt-5.2': {
    // 完整模型：用於提取任務（Stage 3）
    maxTokens: 4096, // 更多 Token
    temperature: 0.1 as number | undefined,
    defaultImageDetail: 'auto' as ImageDetailMode, // 自動選擇解析度
  },
};

// ============================================================================
// Service Class
// ============================================================================

/**
 * GPT Caller 服務
 * @description 提供統一的 GPT API 調用接口，支援 Stage 1/2/3
 * @since CHANGE-024
 */
export class GptCallerService {
  private config: Required<GptCallerConfig>;

  constructor(config: GptCallerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 調用 GPT API
   * @param input GPT 調用輸入
   * @returns GPT 調用結果
   */
  async call(input: GptCallInput): Promise<GptCallResult> {
    const startTime = Date.now();

    try {
      // 驗證配置
      if (!this.config.endpoint || !this.config.apiKey) {
        return {
          success: false,
          response: '',
          error: 'Azure OpenAI 配置缺失（endpoint 或 apiKey）',
          tokenUsage: { input: 0, output: 0, total: 0 },
          model: input.model,
          durationMs: Date.now() - startTime,
        };
      }

      // 驗證輸入
      if (!input.imageBase64Array || input.imageBase64Array.length === 0) {
        return {
          success: false,
          response: '',
          error: '沒有提供圖片',
          tokenUsage: { input: 0, output: 0, total: 0 },
          model: input.model,
          durationMs: Date.now() - startTime,
        };
      }

      // 獲取模型配置
      const modelConfig = MODEL_CONFIG[input.model];
      const deploymentName =
        input.model === 'gpt-5-nano'
          ? this.config.nanoDeploymentName
          : this.config.fullDeploymentName;

      // 構建訊息
      const messages = this.buildMessages(
        input.systemPrompt,
        input.userPrompt,
        input.imageBase64Array,
        input.imageDetailMode || modelConfig.defaultImageDetail
      );

      // 調用 GPT API（帶重試）
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
        try {
          const response = await this.callGptApi(
            deploymentName,
            messages,
            modelConfig.maxTokens,
            modelConfig.temperature
          );

          return {
            success: true,
            response: response.choices[0]?.message.content || '',
            tokenUsage: {
              input: response.usage.prompt_tokens,
              output: response.usage.completion_tokens,
              total: response.usage.total_tokens,
            },
            model: input.model,
            durationMs: Date.now() - startTime,
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // 如果是最後一次嘗試，不再重試
          if (attempt === this.config.retryCount) break;

          // 等待後重試
          await this.delay(this.config.retryDelay * (attempt + 1));
        }
      }

      return {
        success: false,
        response: '',
        error: lastError?.message || '未知錯誤',
        tokenUsage: { input: 0, output: 0, total: 0 },
        model: input.model,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        response: '',
        error: error instanceof Error ? error.message : '未知錯誤',
        tokenUsage: { input: 0, output: 0, total: 0 },
        model: input.model,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 構建 GPT 訊息
   */
  private buildMessages(
    systemPrompt: string,
    userPrompt: string,
    imageBase64Array: string[],
    imageDetailMode: ImageDetailMode
  ): GptMessage[] {
    const messages: GptMessage[] = [];

    // System message
    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    // User message with images
    const userContent: GptMessageContent[] = [];

    // 添加圖片
    for (const imageBase64 of imageBase64Array) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: imageBase64,
          detail: imageDetailMode,
        },
      });
    }

    // 添加用戶指示文字
    userContent.push({
      type: 'text',
      text: userPrompt,
    });

    messages.push({
      role: 'user',
      content: userContent,
    });

    return messages;
  }

  /**
   * 調用 GPT API
   */
  private async callGptApi(
    deploymentName: string,
    messages: GptMessage[],
    maxTokens: number,
    temperature: number | undefined
  ): Promise<GptApiResponse> {
    const url = `${this.config.endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${API_VERSION}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      // 構建請求體（GPT-5-nano 不支援自定義 temperature）
      const requestBody: Record<string, unknown> = {
        messages,
        max_completion_tokens: maxTokens,
        response_format: { type: 'json_object' },
      };

      // 只有支援 temperature 的模型才傳遞該參數
      if (temperature !== undefined) {
        requestBody.temperature = temperature;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GPT API 錯誤: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 延遲函數
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Static Methods
  // ============================================================================

  /**
   * 快速調用 GPT-5-nano（Stage 1 & 2 使用）
   */
  static async callNano(
    systemPrompt: string,
    userPrompt: string,
    imageBase64Array: string[],
    config?: GptCallerConfig
  ): Promise<GptCallResult> {
    const service = new GptCallerService(config);
    return service.call({
      model: 'gpt-5-nano',
      systemPrompt,
      userPrompt,
      imageBase64Array,
      imageDetailMode: 'low',
    });
  }

  /**
   * 快速調用 GPT-5.2（Stage 3 使用）
   */
  static async callFull(
    systemPrompt: string,
    userPrompt: string,
    imageBase64Array: string[],
    imageDetailMode: ImageDetailMode = 'auto',
    config?: GptCallerConfig
  ): Promise<GptCallResult> {
    const service = new GptCallerService(config);
    return service.call({
      model: 'gpt-5.2',
      systemPrompt,
      userPrompt,
      imageBase64Array,
      imageDetailMode,
    });
  }

  /**
   * 檢查服務是否可用
   */
  static async checkHealth(config?: GptCallerConfig): Promise<{
    nanoAvailable: boolean;
    fullAvailable: boolean;
  }> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    if (!mergedConfig.endpoint || !mergedConfig.apiKey) {
      return { nanoAvailable: false, fullAvailable: false };
    }

    const checkDeployment = async (deploymentName: string): Promise<boolean> => {
      try {
        const url = `${mergedConfig.endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${API_VERSION}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': mergedConfig.apiKey,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'ping' }],
            max_completion_tokens: 5,
          }),
          signal: AbortSignal.timeout(10000),
        });
        return response.ok;
      } catch {
        return false;
      }
    };

    const [nanoAvailable, fullAvailable] = await Promise.all([
      checkDeployment(mergedConfig.nanoDeploymentName),
      checkDeployment(mergedConfig.fullDeploymentName),
    ]);

    return { nanoAvailable, fullAvailable };
  }
}
