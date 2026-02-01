/**
 * @fileoverview Stage 1 - 公司識別服務
 * @description
 *   使用 GPT-5-nano 識別文件發行公司：
 *   - 輸入：文件圖片 + 已知公司列表
 *   - 模型：GPT-5-nano（成本低、速度快）
 *   - 輸出：companyId, companyName, confidence, isNewCompany
 *
 * @module src/services/extraction-v3/stages/stage-1-company.service
 * @since CHANGE-024 - Three-Stage Extraction Architecture
 * @lastModified 2026-02-01
 *
 * @features
 *   - 公司識別方法：LOGO / HEADER / ADDRESS / TAX_ID / LLM_INFERRED
 *   - 支援已知公司列表匹配
 *   - 低解析度圖片模式以降低成本
 *   - 完整的 AI 詳情記錄
 *
 * @dependencies
 *   - UnifiedGptExtractionService - GPT 調用服務
 *   - PrismaClient - 公司 ID 解析
 *
 * @related
 *   - src/types/extraction-v3.types.ts - Stage1CompanyResult 類型
 *   - src/services/extraction-v3/unified-gpt-extraction.service.ts
 */

import { PrismaClient } from '@prisma/client';
import type {
  Stage1CompanyResult,
  StageAiDetails,
  KnownCompanyForPrompt,
  CompanyIdentificationMethod,
} from '@/types/extraction-v3.types';
import { GptCallerService, type GptCallResult } from './gpt-caller.service';

// ============================================================================
// Types
// ============================================================================

/**
 * Stage 1 輸入參數
 */
export interface Stage1Input {
  /** Base64 編碼的圖片陣列 */
  imageBase64Array: string[];
  /** 已知公司列表（用於 Prompt 提示） */
  knownCompanies: KnownCompanyForPrompt[];
  /** 選項 */
  options?: Stage1Options;
}

/**
 * Stage 1 選項
 */
export interface Stage1Options {
  /** 是否自動創建公司（預設 true） */
  autoCreateCompany?: boolean;
  /** 城市代碼（用於 JIT 創建公司） */
  cityCode?: string;
}

/**
 * GPT 公司識別響應結構
 */
interface GptCompanyIdentificationResponse {
  companyName: string;
  identificationMethod: CompanyIdentificationMethod;
  confidence: number;
  matchedKnownCompany: string | null;
}

// ============================================================================
// Service Class
// ============================================================================

/**
 * Stage 1 公司識別服務
 * @description 使用 GPT-5-nano 識別文件發行公司
 * @since CHANGE-024
 */
export class Stage1CompanyService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 執行公司識別
   * @param input Stage 1 輸入參數
   * @returns Stage 1 結果
   */
  async execute(input: Stage1Input): Promise<Stage1CompanyResult> {
    const startTime = Date.now();

    try {
      // 1. 組裝公司識別 Prompt
      const prompt = this.buildCompanyIdentificationPrompt(input.knownCompanies);

      // 2. 調用 GPT-5-nano
      const gptResult = await this.callGptNano(prompt, input.imageBase64Array);

      // 3. 解析結果
      const parsed = this.parseCompanyResult(gptResult.response);

      // 4. 解析公司 ID（從資料庫匹配或 JIT 創建）
      const resolved = await this.resolveCompanyId(parsed, input.options);

      return {
        stageName: 'STAGE_1_COMPANY_IDENTIFICATION',
        success: true,
        durationMs: Date.now() - startTime,
        companyId: resolved.companyId,
        companyName: resolved.companyName,
        identificationMethod: parsed.identificationMethod,
        confidence: parsed.confidence,
        isNewCompany: resolved.isNewCompany,
        aiDetails: this.buildAiDetails(gptResult, prompt, Date.now() - startTime),
      };
    } catch (error) {
      return {
        stageName: 'STAGE_1_COMPANY_IDENTIFICATION',
        success: false,
        durationMs: Date.now() - startTime,
        companyName: '',
        identificationMethod: 'LLM_INFERRED',
        confidence: 0,
        isNewCompany: false,
        aiDetails: this.buildEmptyAiDetails(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 組裝公司識別 Prompt
   * @param knownCompanies 已知公司列表
   * @returns System 和 User Prompt
   */
  private buildCompanyIdentificationPrompt(
    knownCompanies: KnownCompanyForPrompt[]
  ): { system: string; user: string } {
    const companyList =
      knownCompanies.length > 0
        ? knownCompanies
            .map(
              (c) =>
                `- ${c.name}${c.aliases?.length ? ` (Aliases: ${c.aliases.join(', ')})` : ''}`
            )
            .join('\n')
        : '(No known companies - identify from document)';

    return {
      system: `You are an invoice issuer identification specialist.
Your task is to identify the company that issued this invoice.

Known companies:
${companyList}

Identification methods (in priority order):
1. LOGO - Company logo on the document
2. HEADER - Company name in header/letterhead
3. ADDRESS - Company address information
4. TAX_ID - Tax identification number

Response format (JSON):
{
  "companyName": "string - identified company name",
  "identificationMethod": "LOGO" | "HEADER" | "ADDRESS" | "TAX_ID",
  "confidence": number (0-100),
  "matchedKnownCompany": "string | null - if matched to known company"
}`,
      user: 'Identify the issuing company from this invoice image.',
    };
  }

  /**
   * 調用 GPT-5-nano
   * @description 使用 GptCallerService 調用 GPT-5-nano 進行公司識別
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

    return {
      response: result.response,
      tokenUsage: result.tokenUsage,
      model: result.model,
    };
  }

  /**
   * 解析 GPT 響應
   */
  private parseCompanyResult(
    response: string
  ): GptCompanyIdentificationResponse {
    try {
      const parsed = JSON.parse(response) as GptCompanyIdentificationResponse;
      return {
        companyName: parsed.companyName || '',
        identificationMethod: parsed.identificationMethod || 'LLM_INFERRED',
        confidence: parsed.confidence || 0,
        matchedKnownCompany: parsed.matchedKnownCompany || null,
      };
    } catch {
      throw new Error('Failed to parse GPT company identification response');
    }
  }

  /**
   * 解析公司 ID（從資料庫匹配或 JIT 創建）
   */
  private async resolveCompanyId(
    parsed: GptCompanyIdentificationResponse,
    options?: Stage1Options
  ): Promise<{
    companyId?: string;
    companyName: string;
    isNewCompany: boolean;
  }> {
    // 1. 嘗試匹配已知公司
    if (parsed.matchedKnownCompany) {
      const company = await this.prisma.company.findFirst({
        where: {
          OR: [
            { name: parsed.matchedKnownCompany },
            { nameVariants: { has: parsed.matchedKnownCompany } },
          ],
          status: 'ACTIVE',
        },
        select: { id: true, name: true },
      });

      if (company) {
        return {
          companyId: company.id,
          companyName: company.name,
          isNewCompany: false,
        };
      }
    }

    // 2. 嘗試模糊匹配
    const fuzzyMatch = await this.prisma.company.findFirst({
      where: {
        name: { contains: parsed.companyName, mode: 'insensitive' },
        status: 'ACTIVE',
      },
      select: { id: true, name: true },
    });

    if (fuzzyMatch) {
      return {
        companyId: fuzzyMatch.id,
        companyName: fuzzyMatch.name,
        isNewCompany: false,
      };
    }

    // 3. 如果允許自動創建，則 JIT 創建公司
    if (options?.autoCreateCompany !== false && parsed.companyName) {
      const newCompany = await this.jitCreateCompany(
        parsed.companyName,
        options?.cityCode
      );
      return {
        companyId: newCompany.id,
        companyName: newCompany.name,
        isNewCompany: true,
      };
    }

    return {
      companyId: undefined,
      companyName: parsed.companyName,
      isNewCompany: true,
    };
  }

  /**
   * JIT 創建公司
   * @description Just-in-Time 創建新公司記錄
   */
  private async jitCreateCompany(
    companyName: string,
    _cityCode?: string // cityCode 保留參數但不使用（Company 沒有 city 關聯）
  ): Promise<{ id: string; name: string }> {
    // 查找系統用戶作為創建者
    // 優先嘗試多種可能的 system 用戶 email 格式
    const systemUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: 'system', mode: 'insensitive' } },
          { name: { equals: 'System', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    // 如果找不到 system 用戶，拋出錯誤（不能使用無效的 ID）
    if (!systemUser) {
      throw new Error(
        'System user not found. Please ensure a system user exists in the database.'
      );
    }

    // Note: Company model 沒有 cityId 欄位，只需創建基本公司記錄
    const newCompany = await this.prisma.company.create({
      data: {
        name: companyName,
        displayName: companyName, // 顯示名稱與名稱相同
        status: 'ACTIVE',
        source: 'AUTO_CREATED', // 自動建立（AI 識別）
        priority: 0, // 預設優先級
        nameVariants: [],
        identificationPatterns: [],
        createdById: systemUser.id, // 系統創建
        // cityCode 用於 Document 記錄，非 Company
      },
      select: {
        id: true,
        name: true,
      },
    });

    return newCompany;
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
      stage: 'STAGE_1',
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
      stage: 'STAGE_1',
      model: '',
      prompt: '',
      response: '',
      tokenUsage: { input: 0, output: 0, total: 0 },
      durationMs: 0,
    };
  }
}
