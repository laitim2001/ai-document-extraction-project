/**
 * @fileoverview Stage 3 - 欄位提取服務
 * @description
 *   使用 GPT-5.2 進行精準欄位提取：
 *   - 輸入：文件圖片 + Stage 1&2 結果 + 完整配置
 *   - 配置組裝：PromptConfig + FieldMappingConfig + MappingRule
 *   - 模型：GPT-5.2（高精度、複雜任務）
 *   - 輸出：standardFields, lineItems, extraCharges, customFields
 *
 * @module src/services/extraction-v3/stages/stage-3-extraction.service
 * @since CHANGE-024 - Three-Stage Extraction Architecture
 * @lastModified 2026-02-01
 *
 * @features
 *   - 分層 PromptConfig 載入：FORMAT > COMPANY > GLOBAL
 *   - 術語映射整合：Tier 1 (通用) + Tier 2 (公司特定)
 *   - JSON Schema 強制結構化輸出
 *   - 完整的配置來源追蹤
 *   - 高解析度圖片模式（auto/high）
 *
 * @dependencies
 *   - UnifiedGptExtractionService - GPT 調用服務
 *   - PrismaClient - 配置查詢
 *
 * @related
 *   - src/types/extraction-v3.types.ts - Stage3ExtractionResult 類型
 *   - src/services/extraction-v3/stages/stage-1-company.service.ts
 *   - src/services/extraction-v3/stages/stage-2-format.service.ts
 */

import { PrismaClient } from '@prisma/client';
import type {
  Stage1CompanyResult,
  Stage2FormatResult,
  Stage3ExtractionResult,
  Stage3ConfigUsed,
  StageAiDetails,
  StandardFieldsV3,
  LineItemV3,
  ExtraChargeV3,
  FieldValue,
  FieldDefinition,
  PromptConfigScope,
} from '@/types/extraction-v3.types';
import {
  GptCallerService,
  type GptCallResult,
  type ImageDetailMode,
} from './gpt-caller.service';

// ============================================================================
// Types
// ============================================================================

/**
 * Stage 3 輸入參數
 */
export interface Stage3Input {
  /** Base64 編碼的圖片陣列 */
  imageBase64Array: string[];
  /** Stage 1 公司識別結果 */
  stage1Result: Stage1CompanyResult;
  /** Stage 2 格式識別結果 */
  stage2Result: Stage2FormatResult;
  /** 選項 */
  options?: Stage3Options;
}

/**
 * Stage 3 選項
 */
export interface Stage3Options {
  /** 圖片詳情模式（預設 auto） */
  imageDetailMode?: 'auto' | 'low' | 'high';
}

/**
 * 完整提取配置
 */
interface ExtractionConfig {
  // Prompt 配置
  promptConfigScope: PromptConfigScope;
  promptConfigId?: string;
  systemPrompt: string;
  userPromptTemplate: string;

  // 欄位映射配置
  fieldMappingConfigId?: string;
  standardFields: FieldDefinition[];
  customFields: FieldDefinition[];

  // 術語映射（三層映射系統）
  universalMappings: Record<string, string>;
  companyMappings: Record<string, string>;
  universalMappingsCount: number;
  companyMappingsCount: number;

  // 輸出 Schema
  outputSchema: Record<string, unknown>;

  // 其他配置
  imageDetailMode: 'auto' | 'low' | 'high';
}

/**
 * GPT 提取響應結構
 */
interface GptExtractionResponse {
  standardFields: StandardFieldsV3;
  customFields?: Record<string, FieldValue>;
  lineItems: LineItemV3[];
  extraCharges?: ExtraChargeV3[];
  overallConfidence: number;
}

// ============================================================================
// Service Class
// ============================================================================

/**
 * Stage 3 欄位提取服務
 * @description 使用 GPT-5.2 進行精準欄位提取，基於 Stage 1&2 結果查詢配置
 * @since CHANGE-024
 */
export class Stage3ExtractionService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 執行欄位提取
   * @param input Stage 3 輸入參數
   * @returns Stage 3 結果
   */
  async execute(input: Stage3Input): Promise<Stage3ExtractionResult> {
    const startTime = Date.now();
    const { stage1Result, stage2Result } = input;

    try {
      // 1. 基於 Stage 1&2 結果載入完整配置
      const config = await this.loadExtractionConfig(
        stage1Result.companyId,
        stage2Result.formatId
      );

      // 2. 組裝完整的提取 Prompt
      const prompt = this.buildExtractionPrompt(config);

      // 3. 調用 GPT-5.2（精準提取）
      // TODO: Phase 2 實現實際 GPT 調用
      const gptResult = await this.callGpt52(
        prompt,
        input.imageBase64Array,
        config.outputSchema,
        input.options?.imageDetailMode || config.imageDetailMode
      );

      // 4. 解析和驗證結果
      const parsed = this.parseExtractionResult(gptResult.response);

      // 計算 overallConfidence（如果 GPT 沒有返回，從欄位信心度平均計算）
      const overallConfidence = parsed.overallConfidence > 0
        ? parsed.overallConfidence
        : this.calculateOverallConfidence(parsed.standardFields);

      return {
        stageName: 'STAGE_3_FIELD_EXTRACTION',
        success: true,
        durationMs: Date.now() - startTime,
        standardFields: parsed.standardFields,
        customFields: parsed.customFields,
        lineItems: parsed.lineItems,
        extraCharges: parsed.extraCharges,
        overallConfidence,
        configUsed: {
          promptConfigScope: config.promptConfigScope,
          promptConfigId: config.promptConfigId,
          fieldMappingConfigId: config.fieldMappingConfigId,
          universalMappingsCount: config.universalMappingsCount,
          companyMappingsCount: config.companyMappingsCount,
        },
        tokenUsage: gptResult.tokenUsage,
        aiDetails: this.buildAiDetails(
          gptResult,
          prompt,
          input.options?.imageDetailMode || config.imageDetailMode,
          Date.now() - startTime
        ),
      };
    } catch (error) {
      return {
        stageName: 'STAGE_3_FIELD_EXTRACTION',
        success: false,
        durationMs: Date.now() - startTime,
        standardFields: this.buildEmptyStandardFields(),
        lineItems: [],
        overallConfidence: 0,
        configUsed: this.buildEmptyConfigUsed(),
        tokenUsage: { input: 0, output: 0, total: 0 },
        aiDetails: this.buildEmptyAiDetails(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 載入提取配置（完整配置組裝）
   * @description 基於 companyId 和 formatId 載入所有相關配置
   */
  private async loadExtractionConfig(
    companyId?: string,
    formatId?: string
  ): Promise<ExtractionConfig> {
    // 1. 載入 PromptConfig（優先級: FORMAT > COMPANY > GLOBAL）
    const promptConfig = await this.loadPromptConfigHierarchical(
      companyId,
      formatId
    );

    // 2. 載入 FieldMappingConfig
    const fieldMappingConfig = await this.loadFieldMappingConfig(
      companyId,
      formatId
    );

    // 3. 載入術語映射（Tier 1 + Tier 2）
    const universalMappings = await this.loadTier1Mappings();
    const companyMappings = companyId
      ? await this.loadTier2Mappings(companyId)
      : {};

    // 4. 載入格式特定欄位定義
    const customFields = formatId
      ? await this.loadFormatCustomFields(formatId)
      : [];

    // 5. 生成 JSON Schema
    const outputSchema = this.generateOutputSchema(
      fieldMappingConfig.standardFields,
      customFields
    );

    return {
      promptConfigScope: promptConfig.scope,
      promptConfigId: promptConfig.id,
      systemPrompt: promptConfig.systemPrompt,
      userPromptTemplate: promptConfig.userPromptTemplate,
      fieldMappingConfigId: fieldMappingConfig.id,
      standardFields: fieldMappingConfig.standardFields,
      customFields,
      universalMappings,
      companyMappings,
      universalMappingsCount: Object.keys(universalMappings).length,
      companyMappingsCount: Object.keys(companyMappings).length,
      outputSchema,
      imageDetailMode: promptConfig.imageDetailMode || 'auto',
    };
  }

  /**
   * 分層載入 PromptConfig
   * @description 實現 FORMAT > COMPANY > GLOBAL 優先級
   */
  private async loadPromptConfigHierarchical(
    companyId?: string,
    formatId?: string
  ): Promise<{
    id?: string;
    scope: PromptConfigScope;
    systemPrompt: string;
    userPromptTemplate: string;
    imageDetailMode?: 'auto' | 'low' | 'high';
  }> {
    // 1. 嘗試 FORMAT 級配置
    if (formatId && companyId) {
      const formatConfig = await this.prisma.promptConfig.findFirst({
        where: {
          scope: 'FORMAT',
          documentFormatId: formatId,
          companyId,
          isActive: true,
        },
      });
      if (formatConfig) {
        return {
          id: formatConfig.id,
          scope: 'FORMAT',
          systemPrompt: formatConfig.systemPrompt || '',
          userPromptTemplate: formatConfig.userPromptTemplate || '',
          imageDetailMode: 'auto', // PromptConfig 沒有此欄位，使用預設值
        };
      }
    }

    // 2. 嘗試 COMPANY 級配置
    if (companyId) {
      const companyConfig = await this.prisma.promptConfig.findFirst({
        where: {
          scope: 'COMPANY',
          companyId,
          isActive: true,
        },
      });
      if (companyConfig) {
        return {
          id: companyConfig.id,
          scope: 'COMPANY',
          systemPrompt: companyConfig.systemPrompt || '',
          userPromptTemplate: companyConfig.userPromptTemplate || '',
          imageDetailMode: 'auto',
        };
      }
    }

    // 3. 使用 GLOBAL 級配置
    const globalConfig = await this.prisma.promptConfig.findFirst({
      where: {
        scope: 'GLOBAL',
        isActive: true,
      },
    });

    if (!globalConfig) {
      // 返回預設配置
      return {
        scope: 'GLOBAL',
        systemPrompt: this.getDefaultSystemPrompt(),
        userPromptTemplate: this.getDefaultUserPrompt(),
        imageDetailMode: 'auto',
      };
    }

    return {
      id: globalConfig.id,
      scope: 'GLOBAL',
      systemPrompt: globalConfig.systemPrompt || '',
      userPromptTemplate: globalConfig.userPromptTemplate || '',
      imageDetailMode: 'auto',
    };
  }

  /**
   * 載入 FieldMappingConfig
   */
  private async loadFieldMappingConfig(
    _companyId?: string,
    _formatId?: string
  ): Promise<{
    id?: string;
    standardFields: FieldDefinition[];
  }> {
    // TODO: Phase 2 - 從資料庫載入 FieldMappingConfig
    // 目前返回預設標準欄位
    return {
      standardFields: this.getDefaultStandardFieldDefinitions(),
    };
  }

  /**
   * 載入 Tier 1 通用術語映射
   * @description 載入沒有 companyId 的通用映射規則
   * TODO: Phase 2 - 實現完整的術語映射載入，可能需要額外的資料表
   */
  private async loadTier1Mappings(): Promise<Record<string, string>> {
    // MappingRule 模型使用 fieldName/fieldLabel 而非 originalTerm/standardTerm
    // 這裡載入通用規則（companyId 為 null 的規則）
    const mappings = await this.prisma.mappingRule.findMany({
      where: {
        companyId: null,
        isActive: true,
      },
      select: {
        fieldName: true,
        fieldLabel: true,
      },
    });

    // 將 fieldName -> fieldLabel 作為術語映射
    return Object.fromEntries(
      mappings.map((m) => [m.fieldName, m.fieldLabel])
    );
  }

  /**
   * 載入 Tier 2 公司特定術語映射
   * @description 載入特定公司的映射規則覆蓋
   * TODO: Phase 2 - 實現完整的術語映射載入
   */
  private async loadTier2Mappings(
    companyId: string
  ): Promise<Record<string, string>> {
    const mappings = await this.prisma.mappingRule.findMany({
      where: {
        companyId,
        isActive: true,
      },
      select: {
        fieldName: true,
        fieldLabel: true,
      },
    });

    return Object.fromEntries(
      mappings.map((m) => [m.fieldName, m.fieldLabel])
    );
  }

  /**
   * 載入格式特定欄位定義
   * @description 從格式的 features 欄位中提取自定義欄位定義
   */
  private async loadFormatCustomFields(
    formatId: string
  ): Promise<FieldDefinition[]> {
    const format = await this.prisma.documentFormat.findUnique({
      where: { id: formatId },
      select: { features: true },
    });

    if (!format?.features) return [];

    // 從 features JSON 中提取自定義欄位
    // features 結構可能包含 typicalFields 等資訊
    const featuresJson = format.features as {
      typicalFields?: string[];
      customFields?: Record<
        string,
        { type: string; required?: boolean; hints?: string[] }
      >;
    };

    // 如果有 customFields 定義，使用它
    if (featuresJson.customFields) {
      return Object.entries(featuresJson.customFields).map(([key, value]) => ({
        key,
        displayName: key,
        type:
          (value.type as 'string' | 'number' | 'date' | 'currency') || 'string',
        required: value.required || false,
        extractionHints: value.hints,
      }));
    }

    // 否則返回空陣列
    return [];
  }

  /**
   * 生成輸出 JSON Schema
   */
  private generateOutputSchema(
    standardFields: FieldDefinition[],
    customFields: FieldDefinition[]
  ): Record<string, unknown> {
    // TODO: Phase 2 - 實現完整的 JSON Schema 生成
    return {
      type: 'object',
      properties: {
        standardFields: {
          type: 'object',
          description: 'Standard invoice fields',
        },
        customFields: {
          type: 'object',
          description: 'Custom fields specific to this format',
        },
        lineItems: {
          type: 'array',
          description: 'Line items with term classification',
        },
        extraCharges: {
          type: 'array',
          description: 'Extra charges with term classification',
        },
        overallConfidence: {
          type: 'number',
          description: 'Overall extraction confidence (0-100)',
        },
      },
    };
  }

  /**
   * 組裝完整的提取 Prompt
   */
  private buildExtractionPrompt(config: ExtractionConfig): {
    system: string;
    user: string;
  } {
    // 構建術語映射部分
    const mappingsSection = this.buildMappingsSection(
      config.universalMappings,
      config.companyMappings
    );

    // 構建欄位定義部分
    const fieldsSection = this.buildFieldsSection(
      config.standardFields,
      config.customFields
    );

    const systemPrompt =
      config.systemPrompt ||
      `You are an expert invoice data extraction specialist.
Extract all requested fields accurately from the provided invoice image.

${fieldsSection}

${mappingsSection}

Respond in valid JSON format matching the provided schema.`;

    const userPrompt =
      config.userPromptTemplate ||
      'Extract all invoice data from this image according to the field definitions.';

    return {
      system: systemPrompt,
      user: userPrompt,
    };
  }

  /**
   * 構建術語映射 Prompt 部分
   */
  private buildMappingsSection(
    universalMappings: Record<string, string>,
    companyMappings: Record<string, string>
  ): string {
    const sections: string[] = [];

    if (Object.keys(universalMappings).length > 0) {
      sections.push(
        `Universal Term Mappings (Tier 1):\n${Object.entries(universalMappings)
          .map(([from, to]) => `  "${from}" → "${to}"`)
          .join('\n')}`
      );
    }

    if (Object.keys(companyMappings).length > 0) {
      sections.push(
        `Company-Specific Mappings (Tier 2 - override Tier 1):\n${Object.entries(
          companyMappings
        )
          .map(([from, to]) => `  "${from}" → "${to}"`)
          .join('\n')}`
      );
    }

    return sections.length > 0
      ? `Term Classification Rules:\n${sections.join('\n\n')}`
      : '';
  }

  /**
   * 構建欄位定義 Prompt 部分
   */
  private buildFieldsSection(
    standardFields: FieldDefinition[],
    customFields: FieldDefinition[]
  ): string {
    const standardSection = standardFields
      .map(
        (f) =>
          `- ${f.key} (${f.type}${f.required ? ', required' : ''}): ${f.displayName}`
      )
      .join('\n');

    const customSection =
      customFields.length > 0
        ? customFields
            .map(
              (f) =>
                `- ${f.key} (${f.type}${f.required ? ', required' : ''}): ${f.displayName}`
            )
            .join('\n')
        : '';

    return `Standard Fields:\n${standardSection}${customSection ? `\n\nCustom Fields:\n${customSection}` : ''}`;
  }

  /**
   * 調用 GPT-5.2
   * @description 使用 GptCallerService 調用 GPT-5.2 進行欄位提取
   */
  private async callGpt52(
    prompt: { system: string; user: string },
    images: string[],
    _outputSchema: Record<string, unknown>,
    imageDetailMode: 'auto' | 'low' | 'high'
  ): Promise<{
    response: string;
    tokenUsage: { input: number; output: number; total: number };
    model: string;
  }> {
    const result: GptCallResult = await GptCallerService.callFull(
      prompt.system,
      prompt.user,
      images,
      imageDetailMode as ImageDetailMode
    );

    if (!result.success) {
      throw new Error(result.error || 'GPT-5.2 調用失敗');
    }

    return {
      response: result.response,
      tokenUsage: result.tokenUsage,
      model: result.model,
    };
  }

  /**
   * 解析 GPT 響應
   * @description 支援兩種格式：
   *   1. 標準格式：包含 standardFields 結構
   *   2. 原始格式：GPT 返回的原始發票數據，需要轉換
   */
  private parseExtractionResult(response: string): GptExtractionResponse {
    try {
      const parsed = JSON.parse(response) as Record<string, unknown>;

      // 檢查是否為標準格式（包含 standardFields）
      if (parsed.standardFields) {
        const typedParsed = parsed as unknown as GptExtractionResponse;
        return {
          standardFields: typedParsed.standardFields || this.buildEmptyStandardFields(),
          customFields: typedParsed.customFields,
          lineItems: typedParsed.lineItems || [],
          extraCharges: typedParsed.extraCharges,
          overallConfidence: typedParsed.overallConfidence || 0,
        };
      }

      // 原始格式：轉換為標準格式
      return this.convertRawResponseToStandardFormat(parsed);
    } catch {
      throw new Error('Failed to parse GPT extraction response');
    }
  }

  /**
   * 將 GPT 原始響應轉換為標準格式
   * @description 處理 GPT 返回的原始發票數據結構
   */
  private convertRawResponseToStandardFormat(
    raw: Record<string, unknown>
  ): GptExtractionResponse {
    // 預設信心度（原始格式沒有欄位級別信心度，使用預設值）
    const DEFAULT_CONFIDENCE = 85;

    // 提取標準欄位
    const invoiceNumber = this.extractFieldValue(
      raw,
      ['invoice_number', 'invoiceNumber', 'InvoiceNumber'],
      DEFAULT_CONFIDENCE
    );

    const invoiceDate = this.extractFieldValue(
      raw,
      ['invoice_date', 'invoiceDate', 'InvoiceDate'],
      DEFAULT_CONFIDENCE,
      // 也檢查 nested 結構
      raw.invoice_metadata as Record<string, unknown> | undefined
    );

    const vendorName = this.extractFieldValue(
      raw,
      ['vendor_name', 'vendorName', 'seller_name', 'name'],
      DEFAULT_CONFIDENCE,
      raw.seller as Record<string, unknown> | undefined
    );

    const totalAmount = this.extractFieldValue(
      raw,
      ['total_amount', 'totalAmount', 'total', 'amount'],
      DEFAULT_CONFIDENCE,
      raw.totals as Record<string, unknown> | undefined
    );

    const currency = this.extractFieldValue(
      raw,
      ['currency', 'Currency'],
      DEFAULT_CONFIDENCE
    );

    const standardFields: StandardFieldsV3 = {
      invoiceNumber,
      invoiceDate,
      vendorName,
      totalAmount,
      currency,
    };

    // 轉換 line items
    const lineItems = this.convertRawLineItems(raw.line_items as unknown[] | undefined);

    // 計算整體信心度
    const overallConfidence = this.calculateFieldsConfidence(standardFields);

    return {
      standardFields,
      lineItems,
      overallConfidence,
    };
  }

  /**
   * 從原始數據中提取欄位值
   */
  private extractFieldValue(
    data: Record<string, unknown>,
    possibleKeys: string[],
    confidence: number,
    nestedData?: Record<string, unknown>
  ): FieldValue {
    // 先檢查主數據
    for (const key of possibleKeys) {
      if (data[key] !== undefined && data[key] !== null) {
        return { value: data[key] as string | number | null, confidence };
      }
    }

    // 再檢查嵌套數據
    if (nestedData) {
      for (const key of possibleKeys) {
        if (nestedData[key] !== undefined && nestedData[key] !== null) {
          return { value: nestedData[key] as string | number | null, confidence };
        }
      }
    }

    return { value: null, confidence: 0 };
  }

  /**
   * 轉換原始 line items
   */
  private convertRawLineItems(
    rawItems: unknown[] | undefined
  ): LineItemV3[] {
    if (!rawItems || !Array.isArray(rawItems)) {
      return [];
    }

    return rawItems.map((item, index) => {
      const rawItem = item as Record<string, unknown>;
      return {
        description: (rawItem.description as string) || '',
        classifiedAs: rawItem.category as string | undefined,
        quantity: rawItem.quantity as number | undefined,
        unitPrice: (rawItem.unit_price ?? rawItem.unitPrice) as number | undefined,
        amount: (rawItem.amount as number) || 0,
        confidence: 85,
        needsClassification: !rawItem.category,
      };
    });
  }

  /**
   * 計算欄位的平均信心度
   */
  private calculateFieldsConfidence(fields: StandardFieldsV3): number {
    const fieldList = [
      fields.invoiceNumber,
      fields.invoiceDate,
      fields.vendorName,
      fields.totalAmount,
      fields.currency,
    ];

    const validFields = fieldList.filter(
      (f) => f && f.value !== null && f.value !== '' && f.confidence > 0
    );

    if (validFields.length === 0) {
      return 0;
    }

    return Math.round(
      validFields.reduce((sum, f) => sum + f.confidence, 0) / validFields.length
    );
  }

  /**
   * 構建空的標準欄位
   */
  private buildEmptyStandardFields(): StandardFieldsV3 {
    const emptyField: FieldValue = { value: null, confidence: 0 };
    return {
      invoiceNumber: emptyField,
      invoiceDate: emptyField,
      vendorName: emptyField,
      totalAmount: emptyField,
      currency: emptyField,
    };
  }

  /**
   * 構建空的配置使用詳情
   */
  private buildEmptyConfigUsed(): Stage3ConfigUsed {
    return {
      promptConfigScope: 'GLOBAL',
      universalMappingsCount: 0,
      companyMappingsCount: 0,
    };
  }

  /**
   * 計算整體信心度（從標準欄位的信心度平均值）
   * @description 當 GPT 沒有返回 overallConfidence 時，從提取的欄位計算
   */
  private calculateOverallConfidence(standardFields: StandardFieldsV3): number {
    const fields = [
      standardFields.invoiceNumber,
      standardFields.invoiceDate,
      standardFields.vendorName,
      standardFields.totalAmount,
      standardFields.currency,
    ];

    // 過濾有效欄位（有值且有信心度）
    const validFields = fields.filter(
      (f) => f && f.value !== null && f.value !== '' && f.confidence > 0
    );

    if (validFields.length === 0) {
      // 如果沒有有效欄位，基於欄位是否有值給一個基本信心度
      const filledCount = fields.filter((f) => f && f.value !== null && f.value !== '').length;
      return filledCount > 0 ? 60 + (filledCount / fields.length) * 30 : 0;
    }

    // 計算平均信心度
    const avgConfidence =
      validFields.reduce((sum, f) => sum + f.confidence, 0) / validFields.length;

    return Math.round(avgConfidence * 100) / 100;
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
    imageDetailMode: 'auto' | 'low' | 'high',
    durationMs: number
  ): StageAiDetails {
    // 組合完整 Prompt（System + User）
    const fullPrompt = `[SYSTEM]\n${prompt.system}\n\n[USER]\n${prompt.user}`;

    return {
      stage: 'STAGE_3',
      model: gptResult.model,
      prompt: fullPrompt,
      response: gptResult.response,
      tokenUsage: gptResult.tokenUsage,
      imageDetailMode,
      durationMs,
    };
  }

  /**
   * 構建空的 AI 詳情
   */
  private buildEmptyAiDetails(): StageAiDetails {
    return {
      stage: 'STAGE_3',
      model: '',
      prompt: '',
      response: '',
      tokenUsage: { input: 0, output: 0, total: 0 },
      durationMs: 0,
    };
  }

  /**
   * 預設 System Prompt
   */
  private getDefaultSystemPrompt(): string {
    return `You are an expert invoice data extraction specialist.
Your task is to accurately extract all fields from the provided invoice image.
Classify line items and extra charges using the provided term mappings.
Respond in valid JSON format.`;
  }

  /**
   * 預設 User Prompt
   */
  private getDefaultUserPrompt(): string {
    return 'Extract all invoice data from this image.';
  }

  /**
   * 預設標準欄位定義
   */
  private getDefaultStandardFieldDefinitions(): FieldDefinition[] {
    return [
      {
        key: 'invoiceNumber',
        displayName: 'Invoice Number',
        type: 'string',
        required: true,
      },
      {
        key: 'invoiceDate',
        displayName: 'Invoice Date',
        type: 'date',
        required: true,
      },
      { key: 'dueDate', displayName: 'Due Date', type: 'date', required: false },
      {
        key: 'vendorName',
        displayName: 'Vendor Name',
        type: 'string',
        required: true,
      },
      {
        key: 'customerName',
        displayName: 'Customer Name',
        type: 'string',
        required: false,
      },
      {
        key: 'totalAmount',
        displayName: 'Total Amount',
        type: 'currency',
        required: true,
      },
      {
        key: 'subtotal',
        displayName: 'Subtotal',
        type: 'currency',
        required: false,
      },
      {
        key: 'currency',
        displayName: 'Currency',
        type: 'string',
        required: true,
      },
    ];
  }
}
