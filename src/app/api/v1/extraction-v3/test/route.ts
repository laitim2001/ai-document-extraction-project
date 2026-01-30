/**
 * @fileoverview Extraction V3 測試 API
 * @description
 *   提供 V3 提取服務的測試端點：
 *   - POST: 測試文件提取
 *   - GET: 檢查服務健康狀態
 *
 * @module src/app/api/v1/extraction-v3/test
 * @since CHANGE-021 - Unified Processor V3 Refactoring
 * @lastModified 2026-01-30
 *
 * @endpoints
 *   - GET /api/v1/extraction-v3/test - 健康檢查
 *   - POST /api/v1/extraction-v3/test - 測試文件提取
 *
 * @related
 *   - src/services/extraction-v3/ - V3 提取服務
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ExtractionV3Service,
  checkExtractionV3Health,
  ROUTING_THRESHOLDS_V3,
} from '@/services/extraction-v3';
import type { ExtractionV3Input } from '@/types/extraction-v3.types';

// ============================================================================
// GET - Health Check
// ============================================================================

/**
 * 健康檢查端點
 *
 * @returns 服務健康狀態
 *
 * @example
 * GET /api/v1/extraction-v3/test
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "healthy": true,
 *     "components": {
 *       "pdfConverter": true,
 *       "promptAssembly": true,
 *       "gptService": true
 *     },
 *     "version": "3.0.0",
 *     "thresholds": {
 *       "AUTO_APPROVE": 90,
 *       "QUICK_REVIEW": 70
 *     }
 *   }
 * }
 */
export async function GET() {
  try {
    const health = await checkExtractionV3Health();

    return NextResponse.json({
      success: true,
      data: {
        ...health,
        version: '3.0.0',
        thresholds: ROUTING_THRESHOLDS_V3,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '健康檢查失敗',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Test Extraction
// ============================================================================

/**
 * 測試文件提取端點
 *
 * @param request - 包含文件的 FormData
 * @returns 提取結果
 *
 * @example
 * POST /api/v1/extraction-v3/test
 * Content-Type: multipart/form-data
 *
 * Form Fields:
 * - file: File (required)
 * - cityCode: string (required)
 * - debug: boolean (optional)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "result": { ... },
 *     "confidenceResult": { ... },
 *     "routingDecision": { ... },
 *     "timing": { ... }
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 解析 FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cityCode = formData.get('cityCode') as string | null;
    const debug = formData.get('debug') === 'true';

    // 驗證必要欄位
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要欄位: file',
        },
        { status: 400 }
      );
    }

    if (!cityCode) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要欄位: cityCode',
        },
        { status: 400 }
      );
    }

    // 讀取文件內容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 構建輸入
    const input: ExtractionV3Input = {
      fileId: `test_${Date.now()}`,
      fileBuffer: buffer,
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      cityCode,
      options: {
        autoCreateCompany: false, // 測試模式不自動創建
        autoCreateFormat: false,
      },
    };

    // 執行提取
    const service = new ExtractionV3Service({
      debug,
      flags: {
        useExtractionV3: true,
        extractionV3Percentage: 100,
        fallbackToV2OnError: false,
        enableAzureDIFallback: false,
        logPromptAssembly: debug,
        logGptResponse: debug,
      },
    });

    const result = await service.processFile(input);

    // 返回結果
    return NextResponse.json({
      success: result.success,
      data: {
        result: result.result,
        confidenceResult: result.confidenceResult,
        routingDecision: result.routingDecision,
        timing: result.timing,
        stepResults: result.stepResults,
        warnings: result.warnings,
      },
      error: result.error,
    });
  } catch (error) {
    console.error('[ExtractionV3 Test] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '處理請求時發生錯誤',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Configuration
// ============================================================================

/** API 路由配置 */
export const config = {
  api: {
    bodyParser: false, // 使用 FormData
  },
};
