/**
 * @fileoverview Stage 2 - 格式識別服務
 * @description
 *   使用 GPT-5-nano 識別文件格式：
 *   - 輸入：文件圖片 + Stage 1 公司識別結果
 *   - 配置決策：公司特定 → 統一格式 → LLM 推斷
 *   - 模型：GPT-5-nano（成本低、速度快）
 *   - 輸出：formatId, formatName, confidence, isNewFormat, configSource
 *
 * @module src/services/extraction-v3/stages/stage-2-format.service
 * @since CHANGE-024 - Three-Stage Extraction Architecture
 * @lastModified 2026-02-01
 *
 * @features
 *   - 分層配置查詢：公司特定 → 統一格式 → LLM 推斷
 *   - 配置來源追蹤（COMPANY_SPECIFIC / UNIVERSAL / LLM_INFERRED）
 *   - 低解析度圖片模式以降低成本
 *   - 完整的 AI 詳情記錄
 *
 * @dependencies
 *   - UnifiedGptExtractionService - GPT 調用服務
 *   - PrismaClient - 格式配置查詢
 *
 * @related
 *   - src/types/extraction-v3.types.ts - Stage2FormatResult 類型
 *   - src/services/extraction-v3/stages/stage-1-company.service.ts
 */

import { PrismaClient } from '@prisma/client';
import type {
  Stage1CompanyResult,
  Stage2FormatResult,
  StageAiDetails,
  FormatPatternForPrompt,
  FormatConfigSource,
} from '@/types/extraction-v3.types';
import { GptCallerService, type GptCallResult } from './gpt-caller.service';

// ============================================================================
// Types
// ============================================================================

/**
 * Stage 2 輸入參數
 */
export interface Stage2Input {
  /** Base64 編碼的圖片陣列 */
  imageBase64Array: string[];
  /** Stage 1 公司識別結果 */
  stage1Result: Stage1CompanyResult;
  /** 選項 */
  options?: Stage2Options;
}

/**
 * Stage 2 選項
 */
export interface Stage2Options {
  /** 是否自動創建格式（預設 true） */
  autoCreateFormat?: boolean;
}

/**
 * 格式配置載入結果
 */
interface FormatConfigLoadResult {
  /** 配置來源 */
  source: FormatConfigSource;
  /** 格式模式列表 */
  formats: FormatPatternForPrompt[];
  /** 使用的配置 ID */
  usedConfigId?: string;
  /** 該公司的格式配置數量 */
  companyFormatCount?: number;
}

/**
 * GPT 格式識別響應結構
 */
interface GptFormatIdentificationResponse {
  formatName: string;
  confidence: number;
  matchedKnownFormat: string | null;
  formatCharacteristics: string[];
}

// ============================================================================
// Service Class
// ============================================================================

/**
 * Stage 2 格式識別服務
 * @description 使用 GPT-5-nano 識別文件格式，支援分層配置查詢
 * @since CHANGE-024
 */
export class Stage2FormatService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 執行格式識別
   * @param input Stage 2 輸入參數
   * @returns Stage 2 結果
   */
  async execute(input: Stage2Input): Promise<Stage2FormatResult> {
    const startTime = Date.now();
    const { stage1Result } = input;

    try {
      // 1. 根據公司查詢格式配置（分層決策）
      const formatConfig = await this.loadFormatConfig(stage1Result.companyId);

      // 2. 組裝格式識別 Prompt（根據配置來源不同）
      const prompt = this.buildFormatIdentificationPrompt(formatConfig);

      // 3. 調用 GPT-5-nano
      // TODO: Phase 2 實現實際 GPT 調用
      const gptResult = await this.callGptNano(prompt, input.imageBase64Array);

      // 4. 解析結果
      const parsed = this.parseFormatResult(gptResult.response);

      // 5. 解析格式 ID（從資料庫匹配或 JIT 創建）
      const resolved = await this.resolveFormatId(
        parsed,
        stage1Result.companyId,
        input.options
      );

      return {
        stageName: 'STAGE_2_FORMAT_IDENTIFICATION',
        success: true,
        durationMs: Date.now() - startTime,
        formatId: resolved.formatId,
        formatName: resolved.formatName,
        confidence: parsed.confidence,
        isNewFormat: resolved.isNewFormat,
        configSource: formatConfig.source,
        configUsed: {
          formatConfigId: formatConfig.usedConfigId,
          companyConfigCount: formatConfig.companyFormatCount,
        },
        aiDetails: this.buildAiDetails(gptResult, prompt, Date.now() - startTime),
      };
    } catch (error) {
      return {
        stageName: 'STAGE_2_FORMAT_IDENTIFICATION',
        success: false,
        durationMs: Date.now() - startTime,
        formatName: '',
        confidence: 0,
        isNewFormat: false,
        configSource: 'LLM_INFERRED',
        aiDetails: this.buildEmptyAiDetails(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 載入格式配置（核心分層決策流程）
   * @description 實現 CHANGE-024 的配置決策流程：
   *   1. 公司特定配置（優先）
   *   2. 統一格式配置（fallback）
   *   3. LLM 自行推斷（最後手段）
   */
  private async loadFormatConfig(
    companyId?: string
  ): Promise<FormatConfigLoadResult> {
    // 1. 嘗試載入公司特定格式配置
    if (companyId) {
      const companyFormats = await this.prisma.documentFormat.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          documentType: true,
          documentSubtype: true,
          features: true,
          commonTerms: true,
          identificationRules: true,
        },
      });

      if (companyFormats.length > 0) {
        return {
          source: 'COMPANY_SPECIFIC',
          formats: companyFormats.map((f) => this.toFormatPattern(f)),
          companyFormatCount: companyFormats.length,
        };
      }
    }

    // 2. 沒有公司特定配置 → 返回 LLM 推斷
    // 注意：DocumentFormat 的 companyId 是必填欄位，沒有「統一格式」的概念
    // 如果需要統一格式，應該從其他來源獲取

    // 3. 都沒有 → LLM 自行判斷
    return {
      source: 'LLM_INFERRED',
      formats: [],
    };
  }

  /**
   * 將資料庫格式轉換為 Prompt 用格式模式
   */
  private toFormatPattern(format: {
    id: string;
    name: string | null;
    documentType: unknown;
    documentSubtype: unknown;
    features: unknown;
    commonTerms: string[];
    identificationRules: unknown;
  }): FormatPatternForPrompt {
    const features = (format.features as { typicalFields?: string[] } | null)
      ?.typicalFields || [];
    const commonTerms = format.commonTerms || [];
    const rules = format.identificationRules as { keywords?: string[] } | null;

    return {
      formatId: format.id,
      formatName: format.name || `Format-${format.id.slice(0, 8)}`,
      patterns: rules?.keywords || features,
      keywords: commonTerms,
    };
  }

  /**
   * 組裝格式識別 Prompt
   */
  private buildFormatIdentificationPrompt(config: FormatConfigLoadResult): {
    system: string;
    user: string;
  } {
    const hasKnownFormats = config.formats.length > 0;

    const formatList = hasKnownFormats
      ? config.formats
          .map(
            (f) =>
              `- ${f.formatName}: ${f.patterns?.join(', ') || 'No patterns'}`
          )
          .join('\n')
      : '';

    return {
      system: `You are an invoice format identification specialist.
Your task is to identify the format/template of this invoice.

${hasKnownFormats ? `Known formats (${config.source}):\n${formatList}` : 'No known formats - identify format characteristics from document.'}

Response format (JSON):
{
  "formatName": "string - identified format name",
  "confidence": number (0-100),
  "matchedKnownFormat": "string | null - if matched to known format",
  "formatCharacteristics": ["array of observed format characteristics"]
}`,
      user: 'Identify the format/template of this invoice image.',
    };
  }

  /**
   * 調用 GPT-5-nano
   * @description 使用 GptCallerService 調用 GPT-5-nano 進行格式識別
   */
  private async callGptNano(
    prompt: { system: string; user: string },
    images: string[]
  ): Promise<{
    response: string;
    tokenUsage: { input: number; output: number; total: number };
    model: string;
  }> {
    const result: GptCallResult = await GptCallerService.callNano(
      prompt.system,
      prompt.user,
      images
    );

    if (!result.success) {
      throw new Error(result.error || 'GPT-5-nano 調用失敗');
    }

    // 檢查響應是否為空（GPT-5-nano 可能將所有 token 用於 reasoning）
    if (!result.response || result.response.trim() === '') {
      throw new Error('GPT-5-nano 返回空響應（可能 maxTokens 不足）');
    }

    return {
      response: result.response,
      tokenUsage: result.tokenUsage,
      model: result.model,
    };
  }

  /**
   * 解析 GPT 響應
   */
  private parseFormatResult(
    response: string
  ): GptFormatIdentificationResponse {
    try {
      // 嘗試直接解析
      const parsed = JSON.parse(response) as GptFormatIdentificationResponse;
      return {
        formatName: parsed.formatName || '',
        confidence: parsed.confidence || 0,
        matchedKnownFormat: parsed.matchedKnownFormat || null,
        formatCharacteristics: parsed.formatCharacteristics || [],
      };
    } catch {
      // 嘗試提取 JSON 區塊（如果響應被 markdown 包裹）
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]) as GptFormatIdentificationResponse;
          return {
            formatName: parsed.formatName || '',
            confidence: parsed.confidence || 0,
            matchedKnownFormat: parsed.matchedKnownFormat || null,
            formatCharacteristics: parsed.formatCharacteristics || [],
          };
        } catch {
          // 繼續拋出原始錯誤
        }
      }

      throw new Error(`Failed to parse GPT format identification response: ${response.substring(0, 200)}`);
    }
  }

  /**
   * 解析格式 ID（從資料庫匹配或 JIT 創建）
   */
  private async resolveFormatId(
    parsed: GptFormatIdentificationResponse,
    companyId?: string,
    options?: Stage2Options
  ): Promise<{
    formatId?: string;
    formatName: string;
    isNewFormat: boolean;
  }> {
    // 1. 嘗試匹配已知格式（需要 companyId）
    if (parsed.matchedKnownFormat && companyId) {
      const format = await this.prisma.documentFormat.findFirst({
        where: {
          name: parsed.matchedKnownFormat,
          companyId,
        },
        select: { id: true, name: true },
      });

      if (format) {
        return {
          formatId: format.id,
          formatName: format.name || parsed.matchedKnownFormat,
          isNewFormat: false,
        };
      }
    }

    // 2. 嘗試模糊匹配（需要 companyId）
    if (companyId) {
      const fuzzyMatch = await this.prisma.documentFormat.findFirst({
        where: {
          name: { contains: parsed.formatName, mode: 'insensitive' },
          companyId,
        },
        select: { id: true, name: true },
      });

      if (fuzzyMatch) {
        return {
          formatId: fuzzyMatch.id,
          formatName: fuzzyMatch.name || parsed.formatName,
          isNewFormat: false,
        };
      }
    }

    // 3. 如果允許自動創建，則 JIT 創建格式
    if (options?.autoCreateFormat !== false && parsed.formatName && companyId) {
      const newFormat = await this.jitCreateFormat(
        parsed.formatName,
        companyId,
        parsed.formatCharacteristics
      );
      return {
        formatId: newFormat.id,
        formatName: newFormat.name,
        isNewFormat: true,
      };
    }

    return {
      formatId: undefined,
      formatName: parsed.formatName,
      isNewFormat: true,
    };
  }

  /**
   * JIT 創建格式
   * @description Just-in-Time 創建新格式記錄
   */
  private async jitCreateFormat(
    formatName: string,
    companyId: string,
    characteristics: string[]
  ): Promise<{ id: string; name: string }> {
    const newFormat = await this.prisma.documentFormat.create({
      data: {
        name: formatName,
        companyId,
        documentType: 'INVOICE',
        documentSubtype: 'GENERAL', // 使用 GENERAL 作為預設子類型
        commonTerms: [],
        identificationRules: {
          keywords: characteristics,
        },
        features: {
          typicalFields: [],
          formatCharacteristics: characteristics,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    return {
      id: newFormat.id,
      name: newFormat.name || formatName,
    };
  }

  /**
   * 構建 AI 詳情
   */
  private buildAiDetails(
    gptResult: {
      response: string;
      tokenUsage: { input: number; output: number; total: number };
      model: string;
    },
    prompt: { system: string; user: string },
    durationMs: number
  ): StageAiDetails {
    // 組合完整 Prompt（System + User）
    const fullPrompt = `[SYSTEM]\n${prompt.system}\n\n[USER]\n${prompt.user}`;

    return {
      stage: 'STAGE_2',
      model: gptResult.model,
      prompt: fullPrompt,
      response: gptResult.response,
      tokenUsage: gptResult.tokenUsage,
      imageDetailMode: 'low',
      durationMs,
    };
  }

  /**
   * 構建空的 AI 詳情（用於錯誤情況）
   */
  private buildEmptyAiDetails(): StageAiDetails {
    return {
      stage: 'STAGE_2',
      model: '',
      prompt: '',
      response: '',
      tokenUsage: { input: 0, output: 0, total: 0 },
      durationMs: 0,
    };
  }
}
