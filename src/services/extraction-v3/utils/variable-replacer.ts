/**
 * @fileoverview 變數替換工具 - Prompt 模板變數處理
 * @description
 *   提供 Prompt 模板中 ${xxx} 變數的替換功能：
 *   - 支援靜態變數（companyName, documentFormatName）
 *   - 支援動態變數（knownCompanies, knownFormats, mappings）
 *   - 支援上下文變數（currentDate, pageCount, fileName）
 *   - 未知變數保留原樣並警告
 *
 * @module src/services/extraction-v3/utils/variable-replacer
 * @since CHANGE-026 - Prompt 配置與 Stage 服務整合
 * @lastModified 2026-02-03
 *
 * @features
 *   - ${xxx} 格式變數替換
 *   - 類型安全的變數上下文
 *   - 未知變數的優雅處理
 *   - 調試日誌支援
 *
 * @related
 *   - src/services/extraction-v3/utils/prompt-merger.ts - Prompt 合併工具
 *   - src/services/extraction-v3/prompt-assembly.service.ts - Prompt 組裝服務
 *   - src/services/extraction-v3/stages/*.service.ts - Stage 服務
 */

// ============================================================================
// Types
// ============================================================================

/**
 * 變數替換上下文
 *
 * @description
 *   包含所有可用於 Prompt 模板替換的變數：
 *   - 靜態變數：從 Company/DocumentFormat 表獲取
 *   - 動態變數：由各 Stage 服務在運行時構建
 *   - 上下文變數：來自當前處理的文件信息
 */
export interface VariableContext {
  // ─────────────────────────────────────────────────────────────────────────
  // 靜態變數（從資料庫實體獲取）
  // ─────────────────────────────────────────────────────────────────────────

  /** 文件發行公司名稱 */
  companyName?: string;
  /** 文件格式名稱 */
  documentFormatName?: string;
  /** 公司別名列表（逗號分隔） */
  companyAliases?: string;

  // ─────────────────────────────────────────────────────────────────────────
  // 動態變數（由 Stage 服務在運行時構建）
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 已知公司列表（格式化字串）
   * @example "- DHL Express (Aliases: DHL, DHLX)\n- FedEx\n- UPS"
   */
  knownCompanies?: string;

  /**
   * 已知格式列表（格式化字串）
   * @example "- DHL Invoice Template\n- FedEx Billing Statement"
   */
  knownFormats?: string;

  /**
   * Tier 1 通用映射規則（格式化字串）
   * @example "Freight Charge → Freight\nHandling Fee → Handling"
   */
  universalMappings?: string;

  /**
   * Tier 2 公司專用映射規則（格式化字串）
   * @example "Express Handling → Handling\nDHL Express Fee → Express"
   */
  companyMappings?: string;

  /**
   * 標準欄位定義（逗號分隔或 JSON）
   * @example "invoiceNumber, invoiceDate, totalAmount, currency"
   */
  standardFields?: string;

  /**
   * 自定義欄位定義（逗號分隔或 JSON）
   * @example "shipmentWeight, awbNumber, dimensions"
   */
  customFields?: string;

  /**
   * 欄位定義 JSON Schema
   * @example "{\"type\":\"object\",\"properties\":{...}}"
   */
  fieldSchema?: string;

  // ─────────────────────────────────────────────────────────────────────────
  // 上下文變數（來自當前處理的文件）
  // ─────────────────────────────────────────────────────────────────────────

  /** 當前日期（YYYY-MM-DD 格式） */
  currentDate?: string;
  /** 文件頁數 */
  pageCount?: number | string;
  /** 檔案名稱 */
  fileName?: string;
  /** 文件 MIME 類型 */
  mimeType?: string;
  /** 處理階段（1, 2, 3） */
  stage?: number | string;

  // CHANGE-032: Pipeline 擴展變數
  /** 匹配的參考號碼（格式化字串） */
  matchedReferenceNumbers?: string;
  /** 匯率資訊（格式化字串） */
  exchangeRateInfo?: string;
}

/**
 * 變數替換選項
 */
export interface ReplaceVariablesOptions {
  /** 是否在控制台輸出警告（預設 true） */
  warnOnUnknown?: boolean;
  /** 未知變數的處理方式 */
  unknownHandling?: 'preserve' | 'empty' | 'error';
  /** 變數前綴（預設 '${'） */
  prefix?: string;
  /** 變數後綴（預設 '}'） */
  suffix?: string;
}

/**
 * 變數替換結果
 */
export interface ReplaceVariablesResult {
  /** 替換後的字串 */
  result: string;
  /** 已替換的變數列表 */
  replacedVariables: string[];
  /** 未知的變數列表（保留原樣） */
  unknownVariables: string[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<ReplaceVariablesOptions> = {
  warnOnUnknown: true,
  unknownHandling: 'preserve',
  prefix: '${',
  suffix: '}',
};

// ============================================================================
// Functions
// ============================================================================

/**
 * 替換 Prompt 模板中的變數
 *
 * @description
 *   將模板字串中的 ${variableName} 格式變數替換為實際值。
 *   - 已知變數：替換為 context 中對應的值
 *   - 未知變數：根據 options.unknownHandling 處理
 *
 * @param template - 包含 ${xxx} 變數的模板字符串
 * @param context - 變數上下文（鍵值對映射）
 * @param options - 替換選項
 * @returns 替換後的字符串
 *
 * @example
 * const result = replaceVariables(
 *   'Hello ${companyName}, you have ${pageCount} pages.',
 *   { companyName: 'DHL Express', pageCount: 3 }
 * );
 * // result: "Hello DHL Express, you have 3 pages."
 */
export function replaceVariables(
  template: string,
  context: VariableContext,
  options?: ReplaceVariablesOptions
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { prefix, suffix, warnOnUnknown, unknownHandling } = opts;

  // 構建正則表達式：匹配 ${xxx} 格式
  const escapedPrefix = escapeRegExp(prefix);
  const escapedSuffix = escapeRegExp(suffix);
  const regex = new RegExp(`${escapedPrefix}(\\w+)${escapedSuffix}`, 'g');

  return template.replace(regex, (match, varName: string) => {
    const value = context[varName as keyof VariableContext];

    // 變數存在且有值
    if (value !== undefined && value !== null) {
      return String(value);
    }

    // 未知變數處理
    if (warnOnUnknown) {
      console.warn(`[VariableReplacer] Unknown variable: ${varName}`);
    }

    switch (unknownHandling) {
      case 'empty':
        return '';
      case 'error':
        throw new Error(`Unknown variable in template: ${varName}`);
      case 'preserve':
      default:
        return match; // 保留原樣
    }
  });
}

/**
 * 替換變數並返回詳細結果
 *
 * @description
 *   與 replaceVariables 相同功能，但返回更詳細的結果資訊，
 *   包括已替換和未知的變數列表。
 *
 * @param template - 模板字符串
 * @param context - 變數上下文
 * @param options - 替換選項
 * @returns 包含結果和變數資訊的物件
 *
 * @example
 * const { result, replacedVariables, unknownVariables } = replaceVariablesWithDetails(
 *   'Hello ${companyName}, ID: ${unknownVar}',
 *   { companyName: 'DHL' }
 * );
 * // result: "Hello DHL, ID: ${unknownVar}"
 * // replacedVariables: ['companyName']
 * // unknownVariables: ['unknownVar']
 */
export function replaceVariablesWithDetails(
  template: string,
  context: VariableContext,
  options?: ReplaceVariablesOptions
): ReplaceVariablesResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { prefix, suffix } = opts;

  const escapedPrefix = escapeRegExp(prefix);
  const escapedSuffix = escapeRegExp(suffix);
  const regex = new RegExp(`${escapedPrefix}(\\w+)${escapedSuffix}`, 'g');

  const replacedVariables: string[] = [];
  const unknownVariables: string[] = [];

  const result = template.replace(regex, (match, varName: string) => {
    const value = context[varName as keyof VariableContext];

    if (value !== undefined && value !== null) {
      replacedVariables.push(varName);
      return String(value);
    }

    unknownVariables.push(varName);

    switch (opts.unknownHandling) {
      case 'empty':
        return '';
      case 'error':
        throw new Error(`Unknown variable in template: ${varName}`);
      case 'preserve':
      default:
        return match;
    }
  });

  return {
    result,
    replacedVariables: [...new Set(replacedVariables)],
    unknownVariables: [...new Set(unknownVariables)],
  };
}

/**
 * 從模板中提取所有變數名稱
 *
 * @param template - 模板字符串
 * @param options - 選項（prefix/suffix）
 * @returns 變數名稱陣列（去重）
 *
 * @example
 * const vars = extractVariableNames('Hello ${name}, your ID is ${id}');
 * // vars: ['name', 'id']
 */
export function extractVariableNames(
  template: string,
  options?: Pick<ReplaceVariablesOptions, 'prefix' | 'suffix'>
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { prefix, suffix } = opts;

  const escapedPrefix = escapeRegExp(prefix);
  const escapedSuffix = escapeRegExp(suffix);
  const regex = new RegExp(`${escapedPrefix}(\\w+)${escapedSuffix}`, 'g');

  const variables: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

/**
 * 驗證模板中的變數是否都在上下文中
 *
 * @param template - 模板字符串
 * @param context - 變數上下文
 * @returns 驗證結果
 *
 * @example
 * const validation = validateTemplateVariables(
 *   'Hello ${companyName} and ${unknownVar}',
 *   { companyName: 'DHL' }
 * );
 * // validation.valid: false
 * // validation.missingVariables: ['unknownVar']
 */
export function validateTemplateVariables(
  template: string,
  context: VariableContext
): { valid: boolean; missingVariables: string[] } {
  const templateVars = extractVariableNames(template);
  const contextKeys = Object.keys(context);

  const missingVariables = templateVars.filter(
    (varName) =>
      !contextKeys.includes(varName) ||
      context[varName as keyof VariableContext] === undefined ||
      context[varName as keyof VariableContext] === null
  );

  return {
    valid: missingVariables.length === 0,
    missingVariables,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 轉義正則表達式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 構建 Stage 1 的變數上下文
 *
 * @description
 *   為 Stage 1（公司識別）構建標準變數上下文。
 *   這是一個便利函數，供 Stage 1 服務使用。
 *
 * @param input - Stage 1 輸入參數
 * @returns 變數上下文
 */
export function buildStage1VariableContext(input: {
  knownCompanies: Array<{ name: string; aliases?: string[] | null }>;
  fileName?: string;
  pageCount?: number;
}): VariableContext {
  return {
    knownCompanies: input.knownCompanies
      .map(
        (c) =>
          `- ${c.name}${c.aliases?.length ? ` (Aliases: ${c.aliases.join(', ')})` : ''}`
      )
      .join('\n'),
    currentDate: new Date().toISOString().split('T')[0],
    pageCount: input.pageCount,
    fileName: input.fileName,
    stage: 1,
  };
}

/**
 * 構建 Stage 2 的變數上下文
 *
 * @description
 *   為 Stage 2（格式識別）構建標準變數上下文。
 *
 * @param input - Stage 2 輸入參數
 * @returns 變數上下文
 */
export function buildStage2VariableContext(input: {
  companyName: string;
  companyAliases?: string[];
  knownFormats: Array<{ name: string; description?: string | null }>;
  fileName?: string;
  pageCount?: number;
}): VariableContext {
  return {
    companyName: input.companyName,
    companyAliases: input.companyAliases?.join(', '),
    knownFormats: input.knownFormats
      .map(
        (f) =>
          `- ${f.name}${f.description ? `: ${f.description}` : ''}`
      )
      .join('\n'),
    currentDate: new Date().toISOString().split('T')[0],
    pageCount: input.pageCount,
    fileName: input.fileName,
    stage: 2,
  };
}

/**
 * 構建 Stage 3 的變數上下文
 *
 * @description
 *   為 Stage 3（欄位提取）構建標準變數上下文。
 *
 * @param input - Stage 3 輸入參數
 * @returns 變數上下文
 */
export function buildStage3VariableContext(input: {
  companyName: string;
  documentFormatName: string;
  universalMappings?: Array<{ sourceTerm: string; targetCategory: string }>;
  companyMappings?: Array<{ sourceTerm: string; targetCategory: string }>;
  standardFields?: string[];
  customFields?: string[];
  fieldSchema?: string;
  fileName?: string;
  pageCount?: number;
}): VariableContext {
  return {
    companyName: input.companyName,
    documentFormatName: input.documentFormatName,
    universalMappings: input.universalMappings
      ?.map((m) => `${m.sourceTerm} → ${m.targetCategory}`)
      .join('\n'),
    companyMappings: input.companyMappings
      ?.map((m) => `${m.sourceTerm} → ${m.targetCategory}`)
      .join('\n'),
    standardFields: input.standardFields?.join(', '),
    customFields: input.customFields?.join(', '),
    fieldSchema: input.fieldSchema,
    currentDate: new Date().toISOString().split('T')[0],
    pageCount: input.pageCount,
    fileName: input.fileName,
    stage: 3,
  };
}
