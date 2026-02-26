/**
 * @fileoverview 數據精選服務
 * @description
 *   將 Azure DI prebuilt-document 返回的完整數據精選為 GPT 輸入：
 *   - 只保留 keyValuePairs + tables
 *   - 過濾不必要的元數據
 *   - 格式化為 Markdown 便於 GPT 理解
 *   - 控制 token 數量
 *
 *   此服務是 CHANGE-020 新提取架構的關鍵組件，
 *   負責將 Azure DI 的大量返回數據精簡為 GPT 可處理的輸入。
 *
 * @module src/services/extraction-v2/data-selector
 * @since CHANGE-020 - Extraction V2 Architecture
 * @lastModified 2026-01-29
 *
 * @features
 *   - 精選 keyValuePairs 和 tables
 *   - 過濾低信心度數據
 *   - 格式化為 Markdown
 *   - Token 估算和控制
 *
 * @related
 *   - src/services/extraction-v2/azure-di-document.service.ts - Azure DI 服務
 *   - src/services/extraction-v2/gpt-mini-extractor.service.ts - GPT 提取服務
 */

import type {
  AzureDIDocumentResult,
  ExtractedKeyValuePair,
  ExtractedTable,
} from './azure-di-document.service';

// ============================================================
// Types
// ============================================================

/**
 * 精選後的數據
 */
export interface SelectedData {
  /** 格式化為 Markdown 的數據 */
  markdown: string;
  /** 估算的 token 數量 */
  tokenEstimate: number;
  /** 包含的 keyValuePairs 數量 */
  keyValuePairsCount: number;
  /** 包含的 tables 數量 */
  tablesCount: number;
  /** 是否因超出限制而截斷 */
  truncated: boolean;
  /** 原始統計 */
  originalStats: {
    keyValuePairsCount: number;
    tablesCount: number;
    contentLength: number;
  };
}

/**
 * 數據精選配置
 */
export interface DataSelectorConfig {
  /** 最大 token 數量（預設 1500） */
  maxTokens?: number;
  /** 最小信心度閾值（0-1，低於此值的 keyValuePairs 會被過濾，預設 0.3） */
  minConfidence?: number;
  /** 是否包含全文內容作為備用（預設 false） */
  includeContent?: boolean;
  /** 最大 keyValuePairs 數量（預設 50） */
  maxKeyValuePairs?: number;
  /** 最大 tables 數量（預設 5） */
  maxTables?: number;
  /** 每個表格最大行數（預設 20） */
  maxTableRows?: number;
}

// ============================================================
// Constants
// ============================================================

/**
 * 預設配置
 */
const DEFAULT_CONFIG: Required<DataSelectorConfig> = {
  maxTokens: 1500,
  minConfidence: 0.3,
  includeContent: false,
  maxKeyValuePairs: 50,
  maxTables: 5,
  maxTableRows: 20,
};

/**
 * Token 估算係數
 * 根據 GPT tokenizer 的經驗值，英文約 4 字符 = 1 token，中文約 1-2 字符 = 1 token
 * 這裡使用保守估計
 */
const CHARS_PER_TOKEN = 3;

// ============================================================
// Helper Functions
// ============================================================

/**
 * 估算 token 數量
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * 格式化 keyValuePairs 為 Markdown 表格
 */
function formatKeyValuePairsAsMarkdown(
  kvPairs: ExtractedKeyValuePair[]
): string {
  if (kvPairs.length === 0) {
    return '';
  }

  const lines: string[] = [
    '## Identified Key-Value Pairs',
    '',
    '| Label | Value | Confidence |',
    '|-------|-------|------------|',
  ];

  for (const kvp of kvPairs) {
    const confidence = Math.round(kvp.confidence * 100);
    // 轉義表格中的 | 字符
    const key = kvp.key.replace(/\|/g, '\\|');
    const value = kvp.value.replace(/\|/g, '\\|');
    lines.push(`| ${key} | ${value} | ${confidence}% |`);
  }

  return lines.join('\n');
}

/**
 * 格式化單個表格為 Markdown
 */
function formatTableAsMarkdown(
  table: ExtractedTable,
  maxRows: number
): string {
  const lines: string[] = [
    `### Table ${table.index + 1} (${table.rowCount} rows x ${table.columnCount} cols)`,
    '',
  ];

  // 表頭
  if (table.headers.length > 0) {
    const headerRow = table.headers.map((h) => h.replace(/\|/g, '\\|')).join(' | ');
    lines.push(`| ${headerRow} |`);
    lines.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
  }

  // 數據行
  const rowsToInclude = table.rows.slice(0, maxRows);
  for (const row of rowsToInclude) {
    const rowContent = row.map((cell) => cell.replace(/\|/g, '\\|')).join(' | ');
    lines.push(`| ${rowContent} |`);
  }

  // 如果有截斷，顯示提示
  if (table.rows.length > maxRows) {
    lines.push('');
    lines.push(`*... and ${table.rows.length - maxRows} more rows*`);
  }

  return lines.join('\n');
}

/**
 * 格式化所有表格為 Markdown
 */
function formatTablesAsMarkdown(
  tables: ExtractedTable[],
  maxTableRows: number
): string {
  if (tables.length === 0) {
    return '';
  }

  const lines: string[] = ['## Extracted Tables', ''];

  for (const table of tables) {
    lines.push(formatTableAsMarkdown(table, maxTableRows));
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// Core Functions
// ============================================================

/**
 * 精選 Azure DI 返回數據為 GPT 輸入
 *
 * @description
 *   將 Azure DI prebuilt-document 的完整返回精選為 GPT 輸入：
 *   1. 過濾低信心度的 keyValuePairs
 *   2. 限制 keyValuePairs 和 tables 數量
 *   3. 格式化為 Markdown
 *   4. 控制 token 數量
 *
 * @param documentResult - Azure DI 提取結果
 * @param config - 精選配置
 * @returns 精選後的數據
 *
 * @example
 * ```typescript
 * const selected = selectDataForGpt(azureResult, { maxTokens: 1000 });
 * console.log('Token estimate:', selected.tokenEstimate);
 * console.log('Markdown:', selected.markdown);
 * ```
 */
export function selectDataForGpt(
  documentResult: AzureDIDocumentResult,
  config: DataSelectorConfig = {}
): SelectedData {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // 記錄原始統計
  const originalStats = {
    keyValuePairsCount: documentResult.keyValuePairs.length,
    tablesCount: documentResult.tables.length,
    contentLength: documentResult.content.length,
  };

  // 1. 過濾和限制 keyValuePairs
  let filteredKvPairs = documentResult.keyValuePairs.filter(
    (kvp) => kvp.confidence >= mergedConfig.minConfidence
  );

  // 按信心度排序（高到低）
  filteredKvPairs.sort((a, b) => b.confidence - a.confidence);

  // 限制數量
  if (filteredKvPairs.length > mergedConfig.maxKeyValuePairs) {
    filteredKvPairs = filteredKvPairs.slice(0, mergedConfig.maxKeyValuePairs);
  }

  // 2. 限制 tables
  let selectedTables = documentResult.tables.slice(0, mergedConfig.maxTables);

  // 3. 格式化為 Markdown
  let markdown = '';
  let truncated = false;

  // 先加入 keyValuePairs
  const kvPairsMarkdown = formatKeyValuePairsAsMarkdown(filteredKvPairs);
  markdown += kvPairsMarkdown;

  // 檢查 token 數量
  let currentTokens = estimateTokens(markdown);

  // 加入 tables（如果還有空間）
  if (currentTokens < mergedConfig.maxTokens && selectedTables.length > 0) {
    const tablesMarkdown = formatTablesAsMarkdown(
      selectedTables,
      mergedConfig.maxTableRows
    );

    const newTokens = estimateTokens(markdown + '\n\n' + tablesMarkdown);

    if (newTokens <= mergedConfig.maxTokens) {
      markdown += '\n\n' + tablesMarkdown;
      currentTokens = newTokens;
    } else {
      // 嘗試只加入部分表格
      for (let i = 0; i < selectedTables.length; i++) {
        const singleTableMarkdown = formatTableAsMarkdown(
          selectedTables[i],
          mergedConfig.maxTableRows
        );
        const testMarkdown =
          markdown +
          (markdown ? '\n\n## Extracted Tables\n\n' : '') +
          singleTableMarkdown;
        const testTokens = estimateTokens(testMarkdown);

        if (testTokens <= mergedConfig.maxTokens) {
          markdown = testMarkdown;
          currentTokens = testTokens;
        } else {
          truncated = true;
          selectedTables = selectedTables.slice(0, i);
          break;
        }
      }
    }
  }

  // 4. 如果配置要求且還有空間，加入 content 摘要
  if (
    mergedConfig.includeContent &&
    currentTokens < mergedConfig.maxTokens &&
    documentResult.content
  ) {
    const remainingTokens = mergedConfig.maxTokens - currentTokens - 50; // 預留一些空間
    const maxContentChars = remainingTokens * CHARS_PER_TOKEN;

    if (maxContentChars > 100) {
      let contentSnippet = documentResult.content.slice(0, maxContentChars);
      if (documentResult.content.length > maxContentChars) {
        contentSnippet += '...';
        truncated = true;
      }

      markdown += '\n\n## Raw Content (Excerpt)\n\n```\n' + contentSnippet + '\n```';
      currentTokens = estimateTokens(markdown);
    }
  }

  return {
    markdown,
    tokenEstimate: currentTokens,
    keyValuePairsCount: filteredKvPairs.length,
    tablesCount: selectedTables.length,
    truncated,
    originalStats,
  };
}

/**
 * 生成 GPT 提取提示的上下文部分
 *
 * @description
 *   生成用於 GPT 提取的完整上下文，包含精選數據和提取指示
 *
 * @param selectedData - 精選後的數據
 * @param fieldsToExtract - 要提取的欄位列表
 * @returns 完整的 GPT 上下文
 */
export function generateGptContext(
  selectedData: SelectedData,
  fieldsToExtract: string[]
): string {
  const lines: string[] = [
    '# Document Data Extraction',
    '',
    'The following structured data was extracted from a document using OCR:',
    '',
    selectedData.markdown,
    '',
    '---',
    '',
    '## Fields to Extract',
    '',
    'Please extract the following fields from the above data:',
    '',
  ];

  for (const field of fieldsToExtract) {
    lines.push(`- ${field}`);
  }

  lines.push('');
  lines.push('## Output Format');
  lines.push('');
  lines.push('Return a JSON object with the extracted field values.');
  lines.push(
    'For each field, include the value and your confidence (0-1) in the extraction.'
  );
  lines.push('If a field cannot be found, set value to null.');

  return lines.join('\n');
}

/**
 * 快速分析 Azure DI 結果品質
 *
 * @description
 *   分析 Azure DI 結果的品質，幫助決定是否需要 GPT 補強
 *
 * @param documentResult - Azure DI 提取結果
 * @returns 品質分析結果
 */
export function analyzeResultQuality(documentResult: AzureDIDocumentResult): {
  overallQuality: 'high' | 'medium' | 'low';
  keyValuePairsQuality: 'high' | 'medium' | 'low';
  hasUsefulTables: boolean;
  avgConfidence: number;
  recommendations: string[];
} {
  const recommendations: string[] = [];

  // 計算平均信心度
  const avgConfidence =
    documentResult.keyValuePairs.length > 0
      ? documentResult.keyValuePairs.reduce((sum, kvp) => sum + kvp.confidence, 0) /
        documentResult.keyValuePairs.length
      : 0;

  // 評估 keyValuePairs 品質
  let keyValuePairsQuality: 'high' | 'medium' | 'low' = 'low';
  if (documentResult.keyValuePairs.length >= 5 && avgConfidence >= 0.8) {
    keyValuePairsQuality = 'high';
  } else if (documentResult.keyValuePairs.length >= 3 && avgConfidence >= 0.6) {
    keyValuePairsQuality = 'medium';
  }

  // 檢查是否有有用的表格
  const hasUsefulTables = documentResult.tables.some(
    (t) => t.rowCount >= 2 && t.columnCount >= 2
  );

  // 評估整體品質
  let overallQuality: 'high' | 'medium' | 'low' = 'low';
  if (keyValuePairsQuality === 'high' || (keyValuePairsQuality === 'medium' && hasUsefulTables)) {
    overallQuality = 'high';
  } else if (keyValuePairsQuality === 'medium' || hasUsefulTables) {
    overallQuality = 'medium';
  }

  // 生成建議
  if (documentResult.keyValuePairs.length < 3) {
    recommendations.push('Few key-value pairs detected. Consider GPT-5.2 visual extraction.');
  }
  if (avgConfidence < 0.6) {
    recommendations.push('Low average confidence. Results may need verification.');
  }
  if (!hasUsefulTables && documentResult.content.includes('|')) {
    recommendations.push('Tables may not be properly detected. Check raw content.');
  }

  return {
    overallQuality,
    keyValuePairsQuality,
    hasUsefulTables,
    avgConfidence,
    recommendations,
  };
}
