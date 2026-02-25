/**
 * @fileoverview Stage 3 - 欄位提取服務
 * @description
 *   使用 GPT-5.2 進行精準欄位提取：
 *   - 輸入：文件圖片 + Stage 1&2 結果 + 完整配置
 *   - 配置組裝：PromptConfig + FieldMappingConfig + MappingRule
 *   - 模型：GPT-5.2（高精度、複雜任務）
 *   - 輸出：standardFields, lineItems, customFields (CHANGE-045: extraCharges removed)
 *
 *   CHANGE-026：整合 PromptConfig 可配置化
 *   - 支援變數替換（${universalMappings}, ${companyMappings} 等）
 *   - 保留現有分層配置載入邏輯
 *
 * @module src/services/extraction-v3/stages/stage-3-extraction.service
 * @since CHANGE-024 - Three-Stage Extraction Architecture
 * @lastModified 2026-02-24
 *
 * @features
 *   - 分層 PromptConfig 載入：FORMAT > COMPANY > GLOBAL
 *   - 術語映射整合：Tier 1 (通用) + Tier 2 (公司特定)
 *   - JSON Schema 強制結構化輸出
 *   - 完整的配置來源追蹤
 *   - 高解析度圖片模式（auto/high）
 *   - CHANGE-026: PromptConfig 變數替換支援
 *
 * @dependencies
 *   - UnifiedGptExtractionService - GPT 調用服務
 *   - PrismaClient - 配置查詢
 *
 * @related
 *   - src/types/extraction-v3.types.ts - Stage3ExtractionResult 類型
 *   - src/services/extraction-v3/stages/stage-1-company.service.ts
 *   - src/services/extraction-v3/stages/stage-2-format.service.ts
 *   - src/services/extraction-v3/prompt-assembly.service.ts - Prompt 組裝服務
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
  FieldDefinitionEntry,
} from '@/types/extraction-v3.types';
import { toFieldDefinition } from '@/types/extraction-v3.types';
import {
  INVOICE_FIELDS,
  findFieldByAlias,
  type InvoiceFieldDefinition,
} from '@/types/invoice-fields';
import {
  GptCallerService,
  type GptCallResult,
  type ImageDetailMode,
} from './gpt-caller.service';
// CHANGE-026: 變數替換支援
import {
  replaceVariables,
  buildStage3VariableContext,
  extractVariableNames,
  type VariableContext,
} from '../utils/variable-replacer';
// CHANGE-046: classifiedAs 正規化
import { normalizeClassifiedAs } from '../utils/classify-normalizer';

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

  // CHANGE-026: PromptConfig 變數替換參數
  /** 檔案名稱（用於變數替換） */
  fileName?: string;

  // CHANGE-042 Phase 3: Feedback recording
  /** 文件 ID（用於記錄 FieldExtractionFeedback） */
  documentId?: string;
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

  // CHANGE-042: 動態欄位定義
  fieldDefinitions: FieldDefinitionEntry[];
  fieldDefinitionSetId?: string;

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
  /** CHANGE-042: 動態欄位（所有欄位統一為 Record） */
  fields?: Record<string, FieldValue>;
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

      // CHANGE-026: 構建變數上下文
      const variableContext = this.buildVariableContextForConfig(input, config);

      // 2. 組裝完整的提取 Prompt（支援變數替換）
      const prompt = this.buildExtractionPrompt(config, variableContext);

      // 3. 調用 GPT-5.2（精準提取）
      // TODO: Phase 2 實現實際 GPT 調用
      const gptResult = await this.callGpt52(
        prompt,
        input.imageBase64Array,
        config.outputSchema,
        input.options?.imageDetailMode || config.imageDetailMode
      );

      // 4. CHANGE-042: 解析和驗證結果（傳入 fieldDefinitions 以支援動態映射）
      const parsed = this.parseExtractionResult(
        gptResult.response,
        config.fieldDefinitions
      );

      // 計算 overallConfidence（優先使用動態 fields，fallback 到 standardFields）
      const overallConfidence = parsed.overallConfidence > 0
        ? parsed.overallConfidence
        : this.calculateOverallConfidence(parsed.standardFields, parsed.fields);

      // CHANGE-042 Phase 3: Fire-and-forget feedback recording
      if (config.fieldDefinitionSetId && input.documentId) {
        this.recordExtractionFeedback(
          config.fieldDefinitionSetId,
          input.documentId,
          config.fieldDefinitions,
          parsed.fields
        ).catch(() => {
          // Silently ignore feedback recording errors — must not block pipeline
        });
      }

      return {
        stageName: 'STAGE_3_FIELD_EXTRACTION',
        success: true,
        durationMs: Date.now() - startTime,
        standardFields: parsed.standardFields,
        customFields: parsed.customFields,
        fields: parsed.fields,
        lineItems: parsed.lineItems,
        extraCharges: parsed.extraCharges,
        overallConfidence,
        fieldDefinitionSetId: config.fieldDefinitionSetId,
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

    // 2. CHANGE-042: 載入 FieldDefinitionSet（取代舊的 loadFieldMappingConfig stub）
    const fieldDefSet = await this.loadFieldDefinitionSet(companyId, formatId);

    // 將 FieldDefinitionEntry[] 轉為 FieldDefinition[]（向下兼容 buildFieldsSection）
    const allFieldDefs = fieldDefSet.fields.map(toFieldDefinition);
    const standardFields = allFieldDefs.filter((f) => f.required);
    const customFields = allFieldDefs.filter((f) => !f.required);

    // 3. 載入術語映射（Tier 1 + Tier 2）
    const universalMappings = await this.loadTier1Mappings();
    const companyMappings = companyId
      ? await this.loadTier2Mappings(companyId)
      : {};

    // 4. CHANGE-042 Phase 2: 動態生成 JSON Schema（基於 fieldDefinitions）
    const outputSchema = this.generateOutputSchema(fieldDefSet.fields);

    return {
      promptConfigScope: promptConfig.scope,
      promptConfigId: promptConfig.id,
      systemPrompt: promptConfig.systemPrompt,
      userPromptTemplate: promptConfig.userPromptTemplate,
      fieldMappingConfigId: fieldDefSet.id,
      standardFields,
      customFields,
      fieldDefinitions: fieldDefSet.fields,
      fieldDefinitionSetId: fieldDefSet.id,
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
    // FIX-043: 加入 promptType 過濾，避免載入 TERM_CLASSIFICATION 等非提取類型的 PromptConfig
    const extractionPromptTypes = ['STAGE_3_FIELD_EXTRACTION', 'FIELD_EXTRACTION'] as const;

    // 1. 嘗試 FORMAT 級配置
    if (formatId && companyId) {
      const formatConfig = await this.prisma.promptConfig.findFirst({
        where: {
          scope: 'FORMAT',
          documentFormatId: formatId,
          companyId,
          isActive: true,
          promptType: { in: [...extractionPromptTypes] },
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
          promptType: { in: [...extractionPromptTypes] },
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
        promptType: { in: [...extractionPromptTypes] },
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
   * CHANGE-042: 從 DB 載入 FieldDefinitionSet（三層解析）
   * @description 查詢優先級: FORMAT > COMPANY > GLOBAL，合併後返回完整欄位定義
   */
  private async loadFieldDefinitionSet(
    companyId?: string,
    formatId?: string
  ): Promise<{
    id?: string;
    fields: FieldDefinitionEntry[];
  }> {
    // 1. 查 FORMAT scope (companyId + formatId)
    let formatSet: { id: string; fields: unknown } | null = null;
    if (companyId && formatId) {
      formatSet = await this.prisma.fieldDefinitionSet.findFirst({
        where: {
          scope: 'FORMAT',
          companyId,
          documentFormatId: formatId,
          isActive: true,
        },
        select: { id: true, fields: true },
      });
    }

    // 2. 查 COMPANY scope (companyId, formatId=null)
    let companySet: { id: string; fields: unknown } | null = null;
    if (companyId) {
      companySet = await this.prisma.fieldDefinitionSet.findFirst({
        where: {
          scope: 'COMPANY',
          companyId,
          documentFormatId: null,
          isActive: true,
        },
        select: { id: true, fields: true },
      });
    }

    // 3. 查 GLOBAL scope
    const globalSet = await this.prisma.fieldDefinitionSet.findFirst({
      where: {
        scope: 'GLOBAL',
        companyId: null,
        documentFormatId: null,
        isActive: true,
      },
      select: { id: true, fields: true },
    });

    // 4. 合併: GLOBAL 為基底 → COMPANY 覆蓋/追加 → FORMAT 覆蓋/追加
    const mergedFields = new Map<string, FieldDefinitionEntry>();

    const parseFields = (raw: unknown): FieldDefinitionEntry[] => {
      if (!raw || !Array.isArray(raw)) return [];
      return raw as FieldDefinitionEntry[];
    };

    // GLOBAL base
    if (globalSet) {
      for (const f of parseFields(globalSet.fields)) {
        mergedFields.set(f.key, f);
      }
    }

    // COMPANY override
    if (companySet) {
      for (const f of parseFields(companySet.fields)) {
        mergedFields.set(f.key, f);
      }
    }

    // FORMAT override
    if (formatSet) {
      for (const f of parseFields(formatSet.fields)) {
        mergedFields.set(f.key, f);
      }
    }

    // 5. 如果全部沒找到 → fallback 到 invoice-fields.ts 的 isRequired 欄位
    if (mergedFields.size === 0) {
      return {
        fields: this.getFallbackFieldDefinitions(),
      };
    }

    // 返回最具體的 set ID（FORMAT > COMPANY > GLOBAL）
    const setId = formatSet?.id || companySet?.id || globalSet?.id;

    return {
      id: setId,
      fields: Array.from(mergedFields.values()),
    };
  }

  /**
   * CHANGE-042: Fallback 欄位定義（從 invoice-fields.ts 生成）
   * @description 當 DB 中沒有任何 FieldDefinitionSet 時使用
   */
  private getFallbackFieldDefinitions(): FieldDefinitionEntry[] {
    return Object.values(INVOICE_FIELDS)
      .filter((f: InvoiceFieldDefinition) => f.isRequired)
      .map((f: InvoiceFieldDefinition): FieldDefinitionEntry => ({
        key: f.name,
        label: f.label,
        category: f.category,
        dataType: f.dataType === 'address' || f.dataType === 'phone' || f.dataType === 'email'
          || f.dataType === 'weight' || f.dataType === 'dimension'
          ? 'string'
          : f.dataType as 'string' | 'number' | 'date' | 'currency',
        required: f.isRequired,
        description: f.description,
        aliases: f.aliases,
      }));
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
   * CHANGE-042 Phase 2: 動態生成輸出 JSON Schema
   * @description 根據 FieldDefinitionEntry[] 動態生成 JSON Schema，
   *   用於 GPT response_format structured output
   */
  private generateOutputSchema(
    fieldDefinitions: FieldDefinitionEntry[]
  ): Record<string, unknown> {
    const fieldProperties: Record<string, unknown> = {};

    for (const def of fieldDefinitions) {
      fieldProperties[def.key] = {
        type: 'object',
        properties: {
          value: {
            type: this.mapDataTypeToJsonType(def.dataType),
            description: def.description || def.label,
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            description: `Extraction confidence for ${def.label}`,
          },
        },
        required: ['value', 'confidence'],
      };
    }

    return {
      type: 'object',
      properties: {
        fields: {
          type: 'object',
          properties: fieldProperties,
          description: 'All extracted fields as key-value pairs with confidence scores',
        },
        lineItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              category: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'number' },
              amount: { type: 'number' },
              confidence: { type: 'number', minimum: 0, maximum: 100 },
            },
            required: ['description', 'amount'],
          },
          description: 'Line items with term classification',
        },
        // CHANGE-045: extraCharges removed — data already covered by lineItems and fields
        overallConfidence: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Overall extraction confidence (0-100)',
        },
      },
      required: ['fields', 'lineItems', 'overallConfidence'],
    };
  }

  /**
   * CHANGE-042 Phase 2: 資料類型映射為 JSON Schema 類型
   */
  private mapDataTypeToJsonType(dataType: string): string | string[] {
    switch (dataType) {
      case 'number':
      case 'currency':
        return ['number', 'null'];
      case 'date':
      case 'string':
      default:
        return ['string', 'null'];
    }
  }

  /**
   * CHANGE-026: 構建變數上下文（用於自定義配置）
   */
  private buildVariableContextForConfig(
    input: Stage3Input,
    config: ExtractionConfig
  ): VariableContext {
    return buildStage3VariableContext({
      companyName: input.stage1Result.companyName,
      documentFormatName: input.stage2Result.formatName,
      universalMappings: Object.entries(config.universalMappings).map(
        ([sourceTerm, targetCategory]) => ({ sourceTerm, targetCategory })
      ),
      companyMappings: Object.entries(config.companyMappings).map(
        ([sourceTerm, targetCategory]) => ({ sourceTerm, targetCategory })
      ),
      standardFields: config.standardFields.map((f) => f.key),
      customFields: config.customFields.map((f) => f.key),
      fieldSchema: JSON.stringify(config.outputSchema),
      fileName: input.fileName,
      pageCount: input.imageBase64Array.length,
    });
  }

  /**
   * 組裝完整的提取 Prompt
   * @description CHANGE-026: 支援變數替換
   */
  private buildExtractionPrompt(
    config: ExtractionConfig,
    variableContext?: VariableContext
  ): {
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

    // FIX-043: 保存原始 systemPrompt（變數替換前），用於判斷是否需注入 FieldDefinitionSet
    const rawSystemPrompt = config.systemPrompt || '';

    let systemPrompt =
      config.systemPrompt ||
      `You are an expert invoice data extraction specialist.
Extract all requested fields accurately from the provided invoice image.

${fieldsSection}

${mappingsSection}

Respond in valid JSON format matching the provided schema.`;

    let userPrompt =
      config.userPromptTemplate ||
      'Extract all invoice data from this image according to the field definitions.';

    // CHANGE-026: 執行變數替換（如果有自定義配置）
    if (config.promptConfigId && variableContext) {
      systemPrompt = replaceVariables(systemPrompt, variableContext);
      userPrompt = replaceVariables(userPrompt, variableContext);
      console.log(
        `[Stage3] Applied variable replacement for PromptConfig (scope: ${config.promptConfigScope})`
      );
    }

    // FIX-043: 自動注入 FieldDefinitionSet 欄位定義
    // 當 PromptConfig 提供自定義 systemPrompt 且未包含欄位變數時，
    // 自動追加 FieldDefinitionSet 的欄位定義段落
    if (
      rawSystemPrompt &&
      config.fieldDefinitions &&
      config.fieldDefinitions.length > 0 &&
      this.shouldInjectFieldDefinitions(rawSystemPrompt)
    ) {
      const fieldDefsSection = this.buildFieldDefinitionsSection(
        config.fieldDefinitions
      );
      if (fieldDefsSection) {
        systemPrompt = systemPrompt + '\n' + fieldDefsSection;
        console.log(
          `[Stage3] Injected ${config.fieldDefinitions.length} field definitions from FieldDefinitionSet`
        );
      }
    }

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
   * FIX-043: 判斷是否需要自動注入 FieldDefinitionSet 欄位定義
   * @description 檢查原始 systemPrompt 是否已包含欄位相關變數（如 ${standardFields}、${fieldSchema}）。
   *              如已包含，說明用戶在 PromptConfig 模板中主動嵌入了欄位，無需重複注入。
   */
  private shouldInjectFieldDefinitions(rawSystemPrompt: string): boolean {
    const fieldRelatedVars = [
      'standardFields',
      'customFields',
      'fieldSchema',
      'fieldsSection',
    ];
    const existingVars = extractVariableNames(rawSystemPrompt);
    return !fieldRelatedVars.some((v) => existingVars.includes(v));
  }

  /**
   * FIX-043: 構建 FieldDefinitionSet 欄位定義注入段落
   * @description 當 PromptConfig 的自定義 systemPrompt 未包含欄位變數時，
   *              自動追加此段落以確保 FieldDefinitionSet 欄位被使用於提取。
   *              同時注入明確的 JSON 輸出格式指示，確保 GPT 輸出結構與
   *              ExtractionResult.fieldMappings 的儲存格式一致。
   */
  private buildFieldDefinitionsSection(
    fieldDefinitions: FieldDefinitionEntry[]
  ): string {
    if (!fieldDefinitions || fieldDefinitions.length === 0) return '';

    const requiredFields = fieldDefinitions.filter((f) => f.required);
    const optionalFields = fieldDefinitions.filter((f) => !f.required);

    const fieldKeys = fieldDefinitions.map((f) => f.key);

    const lines: string[] = [
      '\n--- Field Extraction Requirements ---',
      `Total fields to extract: ${fieldDefinitions.length}`,
    ];

    if (requiredFields.length > 0) {
      lines.push('\nRequired Fields (MUST extract):');
      for (const f of requiredFields) {
        const hints = f.extractionHints
          ? ` (Hints: ${f.extractionHints})`
          : '';
        const aliases =
          f.aliases && f.aliases.length > 0
            ? ` [Also known as: ${f.aliases.join(', ')}]`
            : '';
        lines.push(
          `  - ${f.label} (${f.key}, type: ${f.dataType})${aliases}${hints}`
        );
      }
    }

    if (optionalFields.length > 0) {
      lines.push('\nOptional Fields (extract if available):');
      for (const f of optionalFields) {
        const hints = f.extractionHints
          ? ` (Hints: ${f.extractionHints})`
          : '';
        const aliases =
          f.aliases && f.aliases.length > 0
            ? ` [Also known as: ${f.aliases.join(', ')}]`
            : '';
        lines.push(
          `  - ${f.label} (${f.key}, type: ${f.dataType})${aliases}${hints}`
        );
      }
    }

    // 注入明確的 JSON 輸出格式指示，與 ExtractionResult 儲存結構對齊
    lines.push('\n--- Required Output Format ---');
    lines.push(
      'You MUST respond with a JSON object in the following structure:'
    );
    lines.push('{');
    lines.push('  "fields": {');
    lines.push(
      `    // Use EXACTLY these keys: ${fieldKeys.slice(0, 5).join(', ')}${fieldKeys.length > 5 ? ', ...' : ''}`
    );
    lines.push('    "<field_key>": {');
    lines.push(
      '      "value": "<extracted_value or null if not found>",  // string, number, or null'
    );
    lines.push(
      '      "confidence": <0-100>  // 0 if not found, higher means more certain'
    );
    lines.push('    }');
    lines.push('  },');
    lines.push('  "lineItems": [');
    lines.push('    {');
    lines.push(
      '      "description": "<item description>",  // required'
    );
    lines.push(
      '      "category": "<charge category>",      // MUST use Title Case with spaces, e.g. "Terminal Handling Charge", "Freight Charges"'
    );
    lines.push('      "quantity": <number>,');
    lines.push('      "unitPrice": <number>,');
    lines.push(
      '      "amount": <number>,                   // required'
    );
    lines.push('      "confidence": <0-100>');
    lines.push('    }');
    lines.push('  ],');
    lines.push('  "overallConfidence": <0-100>');
    lines.push('}');
    lines.push('');
    lines.push('IMPORTANT:');
    lines.push(
      '- The "fields" object MUST contain ALL field keys listed above, even if the value is null.'
    );
    lines.push(
      '- Do NOT add fields that are not in the list above.'
    );
    lines.push(
      '- Each field value MUST be an object with "value" and "confidence" properties.'
    );

    return lines.join('\n');
  }

  /**
   * 調用 GPT-5.2
   * @description 使用 GptCallerService 調用 GPT-5.2 進行欄位提取
   * CHANGE-042 Phase 2: 傳遞 outputSchema 給 GptCallerService 以啟用 structured output
   */
  private async callGpt52(
    prompt: { system: string; user: string },
    images: string[],
    outputSchema: Record<string, unknown>,
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
      imageDetailMode as ImageDetailMode,
      undefined, // config
      outputSchema // CHANGE-042 Phase 2: JSON Schema for structured output
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
   * CHANGE-042: 解析 GPT 響應（支援三種格式）
   * @description
   *   Case 1: 有 "fields" key（新格式） → 直接使用，同時生成 standardFields 向下兼容
   *   Case 2: 有 "standardFields" key（舊格式） → 展平為 fields Record
   *   Case 3: 原始格式（GPT 直接回傳 key-value） → 用 fieldDefinitions + aliases 動態查找
   */
  private parseExtractionResult(
    response: string,
    fieldDefinitions?: FieldDefinitionEntry[]
  ): GptExtractionResponse {
    try {
      const parsed = JSON.parse(response) as Record<string, unknown>;

      // Case 1: 新格式 — 有 "fields" key
      if (parsed.fields && typeof parsed.fields === 'object') {
        const fieldsRecord = parsed.fields as Record<string, unknown>;
        const fields: Record<string, FieldValue> = {};

        for (const [key, val] of Object.entries(fieldsRecord)) {
          if (val && typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
            fields[key] = val as FieldValue;
          } else {
            fields[key] = { value: val as string | number | null, confidence: 85 };
          }
        }

        // 從 fields 生成向下兼容的 standardFields
        const standardFields = this.buildStandardFieldsFromRecord(fields);

        return {
          standardFields,
          fields,
          lineItems: this.convertRawLineItems(
            (parsed.lineItems ?? parsed.line_items) as unknown[] | undefined
          ),
          extraCharges: parsed.extraCharges as ExtraChargeV3[] | undefined,
          overallConfidence: (parsed.overallConfidence as number) || 0,
        };
      }

      // Case 2: 舊格式 — 有 "standardFields" key
      if (parsed.standardFields) {
        const typedParsed = parsed as unknown as GptExtractionResponse;
        const standardFields =
          typedParsed.standardFields || this.buildEmptyStandardFields();

        // 展平 standardFields 為 fields Record
        const fields = this.flattenStandardFieldsToRecord(
          standardFields,
          typedParsed.customFields
        );

        return {
          standardFields,
          customFields: typedParsed.customFields,
          fields,
          lineItems: typedParsed.lineItems || [],
          extraCharges: typedParsed.extraCharges,
          overallConfidence: typedParsed.overallConfidence || 0,
        };
      }

      // Case 3: 原始格式 — 用 fieldDefinitions + aliases 動態映射
      return this.convertRawResponseDynamic(parsed, fieldDefinitions);
    } catch {
      throw new Error('Failed to parse GPT extraction response');
    }
  }

  /**
   * CHANGE-042: 動態映射原始 GPT 響應
   * @description 基於 fieldDefinitions + invoice-fields.ts aliases 進行智能匹配
   */
  private convertRawResponseDynamic(
    raw: Record<string, unknown>,
    fieldDefinitions?: FieldDefinitionEntry[]
  ): GptExtractionResponse {
    const DEFAULT_CONFIDENCE = 85;
    const fields: Record<string, FieldValue> = {};

    // 建立搜索清單: fieldDefinitions + invoice-fields.ts 全部欄位
    const searchEntries: Array<{
      key: string;
      aliases: string[];
    }> = [];

    // 從 fieldDefinitions 構建
    if (fieldDefinitions && fieldDefinitions.length > 0) {
      for (const def of fieldDefinitions) {
        const baseAliases = [
          def.key,
          this.toCamelCase(def.key),
          this.toPascalCase(def.key),
        ];
        // 加入 DB 定義的 aliases
        const dbAliases = def.aliases || [];
        // 加入 invoice-fields.ts 的 aliases
        const invoiceField = findFieldByAlias(def.key);
        const invoiceAliases = invoiceField?.aliases || [];

        searchEntries.push({
          key: def.key,
          aliases: [...new Set([...baseAliases, ...dbAliases, ...invoiceAliases])],
        });
      }
    } else {
      // Fallback: 使用 invoice-fields.ts 所有欄位
      for (const field of Object.values(INVOICE_FIELDS)) {
        const baseAliases = [
          field.name,
          this.toCamelCase(field.name),
          this.toPascalCase(field.name),
        ];
        searchEntries.push({
          key: field.name,
          aliases: [...new Set([...baseAliases, ...(field.aliases || [])])],
        });
      }
    }

    // 對每個欄位進行搜索
    for (const entry of searchEntries) {
      const value = this.findValueInRaw(raw, entry.aliases);
      if (value !== undefined) {
        fields[entry.key] =
          value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)
            ? (value as FieldValue)
            : { value: value as string | number | null, confidence: DEFAULT_CONFIDENCE };
      }
    }

    // 向下兼容 standardFields
    const standardFields = this.buildStandardFieldsFromRecord(fields);

    // 轉換 line items
    const lineItems = this.convertRawLineItems(
      (raw.lineItems ?? raw.line_items) as unknown[] | undefined
    );

    // 計算信心度
    const overallConfidence = this.calculateDynamicFieldsConfidence(fields);

    return {
      standardFields,
      fields,
      lineItems,
      extraCharges: raw.extraCharges as ExtraChargeV3[] | undefined,
      overallConfidence,
    };
  }

  /**
   * CHANGE-042: 在原始數據中搜索值
   */
  private findValueInRaw(
    raw: Record<string, unknown>,
    aliases: string[]
  ): unknown | undefined {
    for (const alias of aliases) {
      if (raw[alias] !== undefined && raw[alias] !== null) {
        return raw[alias];
      }
    }
    // 嵌套搜索（常見嵌套 key）
    const nestedKeys = ['invoice_metadata', 'seller', 'totals', 'header'];
    for (const nk of nestedKeys) {
      if (raw[nk] && typeof raw[nk] === 'object') {
        const nested = raw[nk] as Record<string, unknown>;
        for (const alias of aliases) {
          if (nested[alias] !== undefined && nested[alias] !== null) {
            return nested[alias];
          }
        }
      }
    }
    return undefined;
  }

  /**
   * CHANGE-042: snake_case → camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  }

  /**
   * CHANGE-042: snake_case → PascalCase
   */
  private toPascalCase(str: string): string {
    const camel = this.toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }

  /**
   * CHANGE-042: 從 fields Record 建構向下兼容的 StandardFieldsV3
   */
  private buildStandardFieldsFromRecord(
    fields: Record<string, FieldValue>
  ): StandardFieldsV3 {
    const emptyField: FieldValue = { value: null, confidence: 0 };
    return {
      invoiceNumber: fields['invoice_number'] || fields['invoiceNumber'] || emptyField,
      invoiceDate: fields['invoice_date'] || fields['invoiceDate'] || emptyField,
      dueDate: fields['due_date'] || fields['dueDate'],
      vendorName: fields['vendor_name'] || fields['vendorName']
        || fields['forwarder_name'] || fields['forwarderName'] || emptyField,
      customerName: fields['customer_name'] || fields['customerName']
        || fields['shipper_name'] || fields['shipperName'],
      totalAmount: fields['total_amount'] || fields['totalAmount'] || emptyField,
      subtotal: fields['subtotal'],
      currency: fields['currency'] || emptyField,
    };
  }

  /**
   * CHANGE-042: 展平 StandardFieldsV3 + customFields 為 fields Record
   */
  private flattenStandardFieldsToRecord(
    sf: StandardFieldsV3,
    customFields?: Record<string, FieldValue>
  ): Record<string, FieldValue> {
    const fields: Record<string, FieldValue> = {
      invoice_number: sf.invoiceNumber,
      invoice_date: sf.invoiceDate,
      vendor_name: sf.vendorName,
      total_amount: sf.totalAmount,
      currency: sf.currency,
    };
    if (sf.dueDate) fields['due_date'] = sf.dueDate;
    if (sf.customerName) fields['customer_name'] = sf.customerName;
    if (sf.subtotal) fields['subtotal'] = sf.subtotal;
    if (customFields) {
      for (const [k, v] of Object.entries(customFields)) {
        fields[k] = v;
      }
    }
    return fields;
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
        classifiedAs: rawItem.category
          ? normalizeClassifiedAs(rawItem.category as string)
          : undefined,
        quantity: rawItem.quantity as number | undefined,
        unitPrice: (rawItem.unit_price ?? rawItem.unitPrice) as number | undefined,
        amount: (rawItem.amount as number) || 0,
        confidence: 85,
        needsClassification: !rawItem.category,
      };
    });
  }

  /**
   * 計算欄位的平均信心度（StandardFieldsV3 向下兼容版本）
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
   * CHANGE-042: 動態計算所有 fields 的平均信心度
   */
  private calculateDynamicFieldsConfidence(
    fields: Record<string, FieldValue>
  ): number {
    const allValues = Object.values(fields);
    const validFields = allValues.filter(
      (f) => f && f.value !== null && f.value !== '' && f.confidence > 0
    );

    if (validFields.length === 0) {
      const filledCount = allValues.filter(
        (f) => f && f.value !== null && f.value !== ''
      ).length;
      return filledCount > 0 ? 60 + (filledCount / Math.max(allValues.length, 1)) * 30 : 0;
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
   * CHANGE-042: 計算整體信心度（支援動態 fields 或 standardFields）
   * @description 優先使用 fields Record 動態計算；fallback 到 standardFields
   */
  private calculateOverallConfidence(
    standardFields: StandardFieldsV3,
    dynamicFields?: Record<string, FieldValue>
  ): number {
    // 優先使用動態 fields
    if (dynamicFields && Object.keys(dynamicFields).length > 0) {
      return this.calculateDynamicFieldsConfidence(dynamicFields);
    }

    // Fallback: 從 standardFields 計算
    const fieldList = [
      standardFields.invoiceNumber,
      standardFields.invoiceDate,
      standardFields.vendorName,
      standardFields.totalAmount,
      standardFields.currency,
    ];

    const validFields = fieldList.filter(
      (f) => f && f.value !== null && f.value !== '' && f.confidence > 0
    );

    if (validFields.length === 0) {
      const filledCount = fieldList.filter((f) => f && f.value !== null && f.value !== '').length;
      return filledCount > 0 ? 60 + (filledCount / fieldList.length) * 30 : 0;
    }

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

  // ============================================================================
  // CHANGE-042 Phase 3: Feedback Recording
  // ============================================================================

  /**
   * CHANGE-042 Phase 3: 記錄提取回饋（fire-and-forget）
   * @description
   *   比對 fieldDefinitions（定義欄位）vs 提取結果，計算覆蓋率並寫入 DB。
   *   此方法不應阻塞主管線，呼叫端應以 `.catch()` 靜默忽略錯誤。
   */
  private async recordExtractionFeedback(
    fieldDefinitionSetId: string,
    documentId: string,
    fieldDefinitions: FieldDefinitionEntry[],
    extractedFields?: Record<string, FieldValue>
  ): Promise<void> {
    const definedKeys = fieldDefinitions.map((f) => f.key);
    const extractedKeys = extractedFields
      ? Object.keys(extractedFields).filter((k) => {
          const val = extractedFields[k];
          return val && val.value !== null && val.value !== '';
        })
      : [];

    const definedSet = new Set(definedKeys);
    const extractedSet = new Set(extractedKeys);

    const foundFields = definedKeys.filter((k) => extractedSet.has(k));
    const missingFields = definedKeys.filter((k) => !extractedSet.has(k));
    const unexpectedFields = extractedKeys.filter((k) => !definedSet.has(k));

    const coverageRate =
      definedKeys.length > 0
        ? Math.round((foundFields.length / definedKeys.length) * 10000) / 10000
        : 0;

    await this.prisma.fieldExtractionFeedback.create({
      data: {
        fieldDefinitionSetId,
        documentId,
        definedFields: definedKeys,
        foundFields,
        missingFields,
        unexpectedFields,
        definedCount: definedKeys.length,
        foundCount: foundFields.length,
        missingCount: missingFields.length,
        unexpectedCount: unexpectedFields.length,
        coverageRate,
      },
    });
  }

}
