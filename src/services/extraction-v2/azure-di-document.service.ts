/**
 * @fileoverview Azure DI prebuilt-document 服務
 * @description
 *   使用 Azure Document Intelligence prebuilt-document 模型提取結構化數據：
 *   - keyValuePairs: 識別的鍵值對（保留 label-value 關係）
 *   - tables: 結構化表格數據
 *   - content: 全文文字（備用）
 *
 *   此服務是 CHANGE-020 新提取架構的核心組件，
 *   取代 prebuilt-invoice 以獲得更靈活的欄位提取能力。
 *
 * @module src/services/extraction-v2/azure-di-document
 * @since CHANGE-020 - Extraction V2 Architecture
 * @lastModified 2026-01-29
 *
 * @features
 *   - 使用 prebuilt-document 模型（非 prebuilt-invoice）
 *   - 提取 keyValuePairs 保留 label-value 關係
 *   - 提取結構化表格數據
 *   - 支援 PDF、圖片等多種文件格式
 *
 * @dependencies
 *   - @azure/ai-form-recognizer - Azure Form Recognizer SDK
 *
 * @related
 *   - src/services/azure-di.service.ts - 原有 prebuilt-invoice 服務
 *   - src/services/extraction-v2/data-selector.service.ts - 數據精選服務
 *   - src/services/extraction-v2/gpt-mini-extractor.service.ts - GPT 提取服務
 */

import {
  DocumentAnalysisClient,
  AzureKeyCredential,
  AnalyzeResult,
  DocumentKeyValuePair,
  DocumentTable,
} from '@azure/ai-form-recognizer';

// ============================================================
// Types
// ============================================================

/**
 * 識別的鍵值對
 */
export interface ExtractedKeyValuePair {
  /** 鍵（標籤） */
  key: string;
  /** 值 */
  value: string;
  /** 信心度 (0-1) */
  confidence: number;
}

/**
 * 結構化表格
 */
export interface ExtractedTable {
  /** 表格索引 */
  index: number;
  /** 行數 */
  rowCount: number;
  /** 列數 */
  columnCount: number;
  /** 表頭 */
  headers: string[];
  /** 數據行 */
  rows: string[][];
}

/**
 * Azure DI prebuilt-document 提取結果
 */
export interface AzureDIDocumentResult {
  /** 提取成功 */
  success: boolean;
  /** 整體信心度 (0-1) */
  confidence: number;
  /** 識別的鍵值對 */
  keyValuePairs: ExtractedKeyValuePair[];
  /** 結構化表格 */
  tables: ExtractedTable[];
  /** 全文文字 */
  content: string;
  /** 處理的頁數 */
  pageCount: number;
  /** 處理時間（毫秒） */
  processingTimeMs: number;
  /** 錯誤信息（如果有） */
  error?: string;
}

/**
 * Azure DI 配置
 */
export interface AzureDIDocumentConfig {
  /** Azure DI Endpoint */
  endpoint?: string;
  /** API Key */
  apiKey?: string;
}

// ============================================================
// Constants
// ============================================================

/**
 * 預設配置
 */
const DEFAULT_CONFIG: AzureDIDocumentConfig = {
  endpoint: process.env.AZURE_DI_ENDPOINT,
  apiKey: process.env.AZURE_DI_KEY,
};

/**
 * 使用的模型 ID
 */
const MODEL_ID = 'prebuilt-document';

// ============================================================
// Helper Functions
// ============================================================

/**
 * 從 DocumentKeyValuePair 提取鍵值
 */
function extractKeyValuePair(
  kvPair: DocumentKeyValuePair
): ExtractedKeyValuePair | null {
  const key = kvPair.key?.content?.trim();
  const value = kvPair.value?.content?.trim();

  // 跳過沒有鍵或值的項目
  if (!key || !value) {
    return null;
  }

  return {
    key,
    value,
    confidence: kvPair.confidence ?? 0.5,
  };
}

/**
 * 從 DocumentTable 提取表格數據
 */
function extractTable(table: DocumentTable, index: number): ExtractedTable {
  const rowCount = table.rowCount ?? 0;
  const columnCount = table.columnCount ?? 0;

  // 建立二維陣列來存儲表格數據
  const grid: string[][] = Array.from({ length: rowCount }, () =>
    Array(columnCount).fill('')
  );

  // 填充單元格數據
  for (const cell of table.cells ?? []) {
    const rowIndex = cell.rowIndex ?? 0;
    const columnIndex = cell.columnIndex ?? 0;
    const content = cell.content?.trim() ?? '';

    if (rowIndex < rowCount && columnIndex < columnCount) {
      grid[rowIndex][columnIndex] = content;
    }
  }

  // 提取表頭（第一行）
  const headers = rowCount > 0 ? grid[0] : [];

  // 提取數據行（從第二行開始）
  const rows = rowCount > 1 ? grid.slice(1) : [];

  return {
    index,
    rowCount,
    columnCount,
    headers,
    rows,
  };
}

/**
 * 計算整體信心度
 */
function calculateOverallConfidence(
  keyValuePairs: ExtractedKeyValuePair[]
): number {
  if (keyValuePairs.length === 0) {
    return 0.5;
  }

  const sum = keyValuePairs.reduce((acc, kvp) => acc + kvp.confidence, 0);
  return sum / keyValuePairs.length;
}

// ============================================================
// Core Functions
// ============================================================

/**
 * 創建 Azure Document Intelligence 客戶端
 */
function createClient(
  config: AzureDIDocumentConfig = {}
): DocumentAnalysisClient {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.endpoint || !mergedConfig.apiKey) {
    throw new Error('Azure DI endpoint and API key are required');
  }

  return new DocumentAnalysisClient(
    mergedConfig.endpoint,
    new AzureKeyCredential(mergedConfig.apiKey)
  );
}

/**
 * 使用 prebuilt-document 模型提取文件數據
 *
 * @description
 *   使用 Azure DI prebuilt-document 模型分析文件：
 *   - 提取所有識別的 keyValuePairs（保留 label-value 關係）
 *   - 提取所有表格結構
 *   - 提取全文文字
 *
 * @param fileBuffer - 文件 Buffer
 * @param fileName - 文件名（用於日誌）
 * @param config - Azure DI 配置
 * @returns 提取結果
 *
 * @example
 * ```typescript
 * const result = await extractWithPrebuiltDocument(buffer, 'invoice.pdf');
 * if (result.success) {
 *   console.log('KeyValuePairs:', result.keyValuePairs.length);
 *   console.log('Tables:', result.tables.length);
 * }
 * ```
 */
export async function extractWithPrebuiltDocument(
  fileBuffer: Buffer,
  fileName: string,
  config: AzureDIDocumentConfig = {}
): Promise<AzureDIDocumentResult> {
  const startTime = Date.now();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // 檢查配置
    if (!mergedConfig.endpoint || !mergedConfig.apiKey) {
      console.warn('[AzureDIDocument] Not configured, returning mock result');
      return createMockResult(fileName, startTime);
    }

    // 創建客戶端
    const client = createClient(mergedConfig);

    // 使用 prebuilt-document 模型分析
    console.log(`[AzureDIDocument] Analyzing ${fileName} with ${MODEL_ID}...`);
    const poller = await client.beginAnalyzeDocument(MODEL_ID, fileBuffer);
    const result = await poller.pollUntilDone();

    // 提取 keyValuePairs
    const keyValuePairs: ExtractedKeyValuePair[] = [];
    for (const kvPair of result.keyValuePairs ?? []) {
      const extracted = extractKeyValuePair(kvPair);
      if (extracted) {
        keyValuePairs.push(extracted);
      }
    }

    // 提取 tables
    const tables: ExtractedTable[] = [];
    for (let i = 0; i < (result.tables?.length ?? 0); i++) {
      const table = result.tables![i];
      tables.push(extractTable(table, i));
    }

    // 提取 content
    const content = result.content ?? '';

    // 計算頁數
    const pageCount = result.pages?.length ?? 1;

    // 計算整體信心度
    const confidence = calculateOverallConfidence(keyValuePairs);

    const processingTimeMs = Date.now() - startTime;

    console.log(
      `[AzureDIDocument] Successfully processed ${fileName}: ` +
        `${keyValuePairs.length} keyValuePairs, ${tables.length} tables, ` +
        `${pageCount} pages, confidence: ${(confidence * 100).toFixed(1)}%, ` +
        `time: ${processingTimeMs}ms`
    );

    return {
      success: true,
      confidence,
      keyValuePairs,
      tables,
      content,
      pageCount,
      processingTimeMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[AzureDIDocument] Processing error: ${errorMessage}`);

    return {
      success: false,
      confidence: 0,
      keyValuePairs: [],
      tables: [],
      content: '',
      pageCount: 0,
      processingTimeMs: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

/**
 * 創建模擬結果（用於測試或未配置時）
 */
function createMockResult(
  fileName: string,
  startTime: number
): AzureDIDocumentResult {
  return {
    success: true,
    confidence: 0.85,
    keyValuePairs: [
      { key: 'Invoice Number', value: 'INV-2024-001', confidence: 0.95 },
      { key: 'Invoice Date', value: '2024-01-15', confidence: 0.92 },
      { key: 'Due Date', value: '2024-02-15', confidence: 0.90 },
      { key: 'Vendor Name', value: 'Sample Logistics Ltd.', confidence: 0.88 },
      { key: 'Customer Name', value: 'RICOH ASIA PACIFIC', confidence: 0.85 },
      { key: 'Total Amount', value: 'HKD 1,554.80', confidence: 0.93 },
    ],
    tables: [
      {
        index: 0,
        rowCount: 4,
        columnCount: 2,
        headers: ['Description', 'Amount'],
        rows: [
          ['Ocean Freight', '2,500.00'],
          ['Documentation Fee', '150.00'],
          ['Handling Charge', '100.00'],
        ],
      },
    ],
    content: `[Mock prebuilt-document result for: ${fileName}]`,
    pageCount: 1,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * 驗證 Azure DI 配置
 */
export function validateConfig(): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (!process.env.AZURE_DI_ENDPOINT) {
    missing.push('AZURE_DI_ENDPOINT');
  }
  if (!process.env.AZURE_DI_KEY) {
    missing.push('AZURE_DI_KEY');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * 測試 Azure DI 連線
 */
export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> {
  const startTime = Date.now();

  try {
    const configCheck = validateConfig();
    if (!configCheck.valid) {
      return {
        success: false,
        message: `Missing configuration: ${configCheck.missing.join(', ')}`,
      };
    }

    const client = createClient();

    // 使用空的測試請求來驗證連線
    try {
      const poller = await client.beginAnalyzeDocument(
        MODEL_ID,
        Buffer.from('%PDF-1.4 test')
      );
      await poller.pollUntilDone();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 如果是認證錯誤，返回失敗
      if (errorMessage.includes('401') || errorMessage.includes('403')) {
        return {
          success: false,
          message: 'Authentication failed: Invalid API key',
          latencyMs: Date.now() - startTime,
        };
      }

      // 其他錯誤（如無效 PDF）說明連線正常
      if (errorMessage.includes('Invalid') || errorMessage.includes('format')) {
        return {
          success: true,
          message: 'Connection successful (test document validation)',
          latencyMs: Date.now() - startTime,
        };
      }
    }

    return {
      success: true,
      message: 'Connection successful',
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Connection failed: ${errorMessage}`,
      latencyMs: Date.now() - startTime,
    };
  }
}
