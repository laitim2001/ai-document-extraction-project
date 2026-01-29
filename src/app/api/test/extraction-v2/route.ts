/**
 * @fileoverview Extraction V2 測試 API
 * @description
 *   提供測試端點驗證新提取架構（CHANGE-020）：
 *   - POST: 上傳文件執行新提取流程
 *   - GET: 檢查服務配置狀態
 *
 *   此 API 為獨立測試端點，不影響現有 unified-processor 流程。
 *
 * @module src/app/api/test/extraction-v2
 * @since CHANGE-020 - Extraction V2 Architecture
 * @lastModified 2026-01-29
 *
 * @features
 *   - 獨立測試環境
 *   - 詳細返回各階段結果
 *   - 服務配置狀態檢查
 *
 * @related
 *   - src/services/extraction-v2/ - Extraction V2 服務
 *   - claudedocs/4-changes/feature-changes/CHANGE-020-extraction-v2-prebuilt-document-gpt-mini.md
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runExtractionV2Pipeline,
  validateAzureDIConfig,
  validateGptMiniConfig,
  testAzureDIConnection,
  testGptMiniConnection,
  type FieldDefinition,
} from '@/services/extraction-v2';

// ============================================================
// Types
// ============================================================

interface ExtractionV2TestResponse {
  success: boolean;
  data?: {
    // Azure DI 結果摘要
    azureDI: {
      success: boolean;
      keyValuePairsCount: number;
      tablesCount: number;
      pageCount: number;
      confidence: number;
      processingTimeMs: number;
      keyValuePairs: Array<{
        key: string;
        value: string;
        confidence: number;
      }>;
      tables: Array<{
        index: number;
        rowCount: number;
        columnCount: number;
        headers: string[];
      }>;
    };
    // 精選數據
    selectedData: {
      markdown: string;
      tokenEstimate: number;
      keyValuePairsCount: number;
      tablesCount: number;
      truncated: boolean;
    };
    // 品質分析
    qualityAnalysis: {
      overallQuality: string;
      keyValuePairsQuality: string;
      hasUsefulTables: boolean;
      avgConfidence: number;
      recommendations: string[];
    };
    // GPT 提取結果
    gptExtraction: {
      success: boolean;
      fields: Record<
        string,
        {
          value: string | number | null;
          confidence: number;
          source: string;
          originalLabel?: string;
        }
      >;
      tokensUsed: {
        input: number;
        output: number;
        total: number;
      };
      processingTimeMs: number;
      modelUsed: string;
    };
    // 總計
    totalProcessingTimeMs: number;
  };
  error?: string;
}

interface ConfigStatusResponse {
  azureDI: {
    configured: boolean;
    missing: string[];
  };
  gptMini: {
    configured: boolean;
    missing: string[];
    deploymentName: string;
  };
  connectionTests?: {
    azureDI?: {
      success: boolean;
      message: string;
      latencyMs?: number;
    };
    gptMini?: {
      success: boolean;
      message: string;
      latencyMs?: number;
      modelUsed?: string;
    };
  };
}

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/test/extraction-v2
 * 檢查服務配置狀態
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ConfigStatusResponse>> {
  const testConnections = request.nextUrl.searchParams.get('testConnections') === 'true';

  // 檢查配置
  const azureDIConfig = validateAzureDIConfig();
  const gptMiniConfig = validateGptMiniConfig();

  const response: ConfigStatusResponse = {
    azureDI: {
      configured: azureDIConfig.valid,
      missing: azureDIConfig.missing,
    },
    gptMini: {
      configured: gptMiniConfig.valid,
      missing: gptMiniConfig.missing,
      deploymentName: gptMiniConfig.deploymentName,
    },
  };

  // 如果要求測試連線
  if (testConnections) {
    response.connectionTests = {};

    if (azureDIConfig.valid) {
      response.connectionTests.azureDI = await testAzureDIConnection();
    }

    if (gptMiniConfig.valid) {
      response.connectionTests.gptMini = await testGptMiniConnection();
    }
  }

  return NextResponse.json(response);
}

/**
 * POST /api/test/extraction-v2
 * 執行文件提取測試
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ExtractionV2TestResponse>> {
  try {
    // 解析表單數據
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fieldsJson = formData.get('fields') as string | null;

    // 驗證文件
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'No file provided. Please upload a PDF or image file.',
        },
        { status: 400 }
      );
    }

    // 檢查文件類型
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${file.type}. Allowed: PDF, JPEG, PNG, TIFF.`,
        },
        { status: 400 }
      );
    }

    // 解析自定義欄位（如果提供）
    let customFields: FieldDefinition[] | undefined;
    if (fieldsJson) {
      try {
        customFields = JSON.parse(fieldsJson);
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid fields JSON format.',
          },
          { status: 400 }
        );
      }
    }

    // 讀取文件為 Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(
      `[ExtractionV2 API] Processing file: ${file.name}, size: ${buffer.length} bytes`
    );

    // 執行 Extraction V2 流程
    const result = await runExtractionV2Pipeline(buffer, file.name, {
      fields: customFields,
    });

    // 構建響應
    const response: ExtractionV2TestResponse = {
      success: result.success,
      data: {
        azureDI: {
          success: result.azureDIResult.success,
          keyValuePairsCount: result.azureDIResult.keyValuePairs.length,
          tablesCount: result.azureDIResult.tables.length,
          pageCount: result.azureDIResult.pageCount,
          confidence: result.azureDIResult.confidence,
          processingTimeMs: result.azureDIResult.processingTimeMs,
          keyValuePairs: result.azureDIResult.keyValuePairs,
          tables: result.azureDIResult.tables.map((t) => ({
            index: t.index,
            rowCount: t.rowCount,
            columnCount: t.columnCount,
            headers: t.headers,
          })),
        },
        selectedData: {
          markdown: result.selectedData.markdown,
          tokenEstimate: result.selectedData.tokenEstimate,
          keyValuePairsCount: result.selectedData.keyValuePairsCount,
          tablesCount: result.selectedData.tablesCount,
          truncated: result.selectedData.truncated,
        },
        qualityAnalysis: result.qualityAnalysis,
        gptExtraction: {
          success: result.gptResult.success,
          fields: result.gptResult.fields,
          tokensUsed: result.gptResult.tokensUsed,
          processingTimeMs: result.gptResult.processingTimeMs,
          modelUsed: result.gptResult.modelUsed,
        },
        totalProcessingTimeMs: result.totalProcessingTimeMs,
      },
    };

    if (result.error) {
      response.error = result.error;
    }

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ExtractionV2 API] Error: ${errorMessage}`);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
