/**
 * @fileoverview Extraction 方案對比測試 API
 * @description
 *   對比測試兩種提取架構：
 *   - 方案 A: Extraction V2 (Azure DI + GPT-mini)
 *   - 方案 B: 純 GPT-5.2 Vision 直接提取
 *
 *   測試指標：
 *   - 提取準確度（成功提取的欄位數）
 *   - 處理時間
 *   - Token 消耗
 *
 * @module src/app/api/test/extraction-compare
 * @since CHANGE-020 - Architecture Comparison Test
 * @lastModified 2026-01-29
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  runExtractionV2Pipeline,
  validateAzureDIConfig,
  validateGptMiniConfig,
} from '@/services/extraction-v2';
import {
  processImageWithVision,
  validateConfig as validateGptVisionConfig,
  convertPdfToImages,
  cleanupTempImages,
  type InvoiceExtractionResult,
} from '@/services/gpt-vision.service';
import { AzureOpenAI } from 'openai';

// ============================================================
// Types
// ============================================================

interface ExtractedField {
  value: string | number | null;
  confidence: number;
  source?: string;
}

interface ApproachResult {
  name: string;
  success: boolean;
  fields: Record<string, ExtractedField>;
  fieldsExtracted: number;
  totalFields: number;
  processingTimeMs: number;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
  details?: Record<string, unknown>;
  error?: string;
}

interface ComparisonResponse {
  success: boolean;
  comparison: {
    fileName: string;
    fileSize: number;
    // 方案 A: Extraction V2
    approachA: ApproachResult;
    // 方案 B: 純 GPT Vision
    approachB: ApproachResult;
    // 對比摘要
    summary: {
      winner: 'A' | 'B' | 'tie';
      reason: string;
      speedDifferenceMs: number;
      speedDifferencePercent: number;
      fieldsDifference: number;
      recommendation: string;
    };
  };
  error?: string;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 標準化 GPT Vision 結果為統一的欄位格式
 */
function normalizeGptVisionResult(
  result: InvoiceExtractionResult
): Record<string, ExtractedField> {
  const fields: Record<string, ExtractedField> = {};

  if (!result.invoiceData) {
    return fields;
  }

  const data = result.invoiceData;

  if (data.invoiceNumber) {
    fields.invoiceNumber = {
      value: data.invoiceNumber,
      confidence: result.confidence * 100,
      source: 'gpt-vision',
    };
  }

  if (data.invoiceDate) {
    fields.invoiceDate = {
      value: data.invoiceDate,
      confidence: result.confidence * 100,
      source: 'gpt-vision',
    };
  }

  if (data.dueDate) {
    fields.dueDate = {
      value: data.dueDate,
      confidence: result.confidence * 100,
      source: 'gpt-vision',
    };
  }

  if (data.vendor?.name) {
    fields.vendorName = {
      value: data.vendor.name,
      confidence: result.confidence * 100,
      source: 'gpt-vision',
    };
  }

  if (data.buyer?.name) {
    fields.customerName = {
      value: data.buyer.name,
      confidence: result.confidence * 100,
      source: 'gpt-vision',
    };
  }

  if (data.totalAmount !== undefined) {
    fields.totalAmount = {
      value: data.totalAmount,
      confidence: result.confidence * 100,
      source: 'gpt-vision',
    };
  }

  if (data.subtotal !== undefined) {
    fields.subtotal = {
      value: data.subtotal,
      confidence: result.confidence * 100,
      source: 'gpt-vision',
    };
  }

  if (data.currency) {
    fields.currency = {
      value: data.currency,
      confidence: result.confidence * 100,
      source: 'gpt-vision',
    };
  }

  return fields;
}

/**
 * 計算成功提取的欄位數
 */
function countExtractedFields(fields: Record<string, ExtractedField>): number {
  return Object.values(fields).filter((f) => f.value !== null && f.value !== undefined).length;
}

/**
 * 直接使用 GPT-5.2 Vision 提取標準發票欄位
 * 不經過現有的 GPT Vision 服務（該服務專注於 line items）
 */
async function extractWithDirectGptVision(
  filePath: string
): Promise<{
  success: boolean;
  fields: Record<string, ExtractedField>;
  confidence: number;
  tokensUsed?: { input: number; output: number; total: number };
  processingTimeMs: number;
  pageCount: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // 檢查配置
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-5.2';

    if (!endpoint || !apiKey) {
      throw new Error('Azure OpenAI 配置缺失');
    }

    // 讀取文件並轉換為 base64
    const fileName = path.basename(filePath);
    const isPdf = fileName.toLowerCase().endsWith('.pdf');

    let imageBase64: string;
    let pageCount = 1;
    let tempImagePaths: string[] = [];

    if (isPdf) {
      // PDF 需要轉換為圖片
      const pdfResult = await convertPdfToImages(filePath);
      tempImagePaths = pdfResult.imagePaths;
      pageCount = pdfResult.pageCount;

      if (tempImagePaths.length === 0) {
        throw new Error('無法從 PDF 提取圖片');
      }

      // 讀取第一頁圖片為 base64
      const firstPageBuffer = await fs.readFile(tempImagePaths[0]);
      imageBase64 = firstPageBuffer.toString('base64');
      console.log(`[DirectGptVision] Converted PDF to ${pageCount} images, using first page`);
    } else {
      const fileBuffer = await fs.readFile(filePath);
      imageBase64 = fileBuffer.toString('base64');
    }

    // 建立 Azure OpenAI 客戶端
    const client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion: '2024-08-01-preview',
    });

    // 專門用於提取標準發票欄位的 prompt
    const systemPrompt = `You are an expert invoice data extraction system. Extract the following standard invoice fields from the provided invoice image.

Return ONLY a valid JSON object with no additional text or explanation. The JSON must have this exact structure:

{
  "invoiceNumber": { "value": "string or null", "confidence": 0.0-1.0 },
  "invoiceDate": { "value": "YYYY-MM-DD or null", "confidence": 0.0-1.0 },
  "dueDate": { "value": "YYYY-MM-DD or null", "confidence": 0.0-1.0 },
  "vendorName": { "value": "string or null", "confidence": 0.0-1.0 },
  "customerName": { "value": "string or null", "confidence": 0.0-1.0 },
  "totalAmount": { "value": number or null, "confidence": 0.0-1.0 },
  "subtotal": { "value": number or null, "confidence": 0.0-1.0 },
  "currency": { "value": "string (3-letter code) or null", "confidence": 0.0-1.0 }
}

Rules:
- Extract values exactly as they appear on the invoice
- Use null for fields that cannot be found
- Confidence should reflect your certainty (0.9+ for clear values, 0.7-0.9 for inferred values)
- Dates must be in YYYY-MM-DD format
- Amounts should be numbers without currency symbols`;

    const userPrompt = 'Extract the standard invoice fields from this invoice image.';

    console.log(`[DirectGptVision] Calling ${deploymentName} for field extraction...`);

    // 調用 GPT-5.2 Vision
    const response = await client.chat.completions.create({
      model: deploymentName,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_completion_tokens: 1000,
      temperature: 0.1,
    });

    const tokensUsed = {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
      total: response.usage?.total_tokens || 0,
    };

    const content = response.choices[0]?.message?.content || '';
    console.log(`[DirectGptVision] Response received, tokens: ${tokensUsed.total}`);
    console.log(`[DirectGptVision] Response content: ${content.substring(0, 500)}...`);

    // 解析 JSON 響應
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('無法從響應中提取 JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const fields: Record<string, ExtractedField> = {};
    let totalConfidence = 0;
    let fieldCount = 0;

    // 轉換為標準欄位格式
    for (const [key, val] of Object.entries(parsed)) {
      const fieldData = val as { value: unknown; confidence: number };
      if (fieldData.value !== null && fieldData.value !== undefined) {
        fields[key] = {
          value: fieldData.value as string | number,
          confidence: (fieldData.confidence || 0.8) * 100,
          source: 'gpt-5.2-vision-direct',
        };
        totalConfidence += fieldData.confidence || 0.8;
        fieldCount++;
      }
    }

    const avgConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;

    // 清理臨時文件
    if (tempImagePaths.length > 0) {
      await cleanupTempImages(tempImagePaths);
    }

    return {
      success: true,
      fields,
      confidence: avgConfidence,
      tokensUsed,
      processingTimeMs: Date.now() - startTime,
      pageCount,
    };
  } catch (error) {
    console.error('[DirectGptVision] Error:', error);
    return {
      success: false,
      fields: {},
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      pageCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================
// Handlers
// ============================================================

/**
 * GET /api/test/extraction-compare
 * 檢查兩種方案的配置狀態
 */
export async function GET(): Promise<NextResponse> {
  const azureDIConfig = validateAzureDIConfig();
  const gptMiniConfig = validateGptMiniConfig();
  const gptVisionConfig = validateGptVisionConfig();

  return NextResponse.json({
    approachA: {
      name: 'Extraction V2 (Azure DI + GPT-mini)',
      configured: azureDIConfig.valid && gptMiniConfig.valid,
      components: {
        azureDI: {
          configured: azureDIConfig.valid,
          missing: azureDIConfig.missing,
        },
        gptMini: {
          configured: gptMiniConfig.valid,
          missing: gptMiniConfig.missing,
          deploymentName: gptMiniConfig.deploymentName,
        },
      },
    },
    approachB: {
      name: 'Pure GPT-5.2 Vision',
      configured: gptVisionConfig.valid,
      missing: gptVisionConfig.missing,
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-5.2',
    },
  });
}

/**
 * POST /api/test/extraction-compare
 * 執行對比測試
 */
export async function POST(request: NextRequest): Promise<NextResponse<ComparisonResponse>> {
  let tempFilePath: string | null = null;

  try {
    // 解析表單數據
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    // 驗證文件
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          comparison: null as unknown as ComparisonResponse['comparison'],
          error: 'No file provided. Please upload a PDF or image file.',
        },
        { status: 400 }
      );
    }

    // 檢查文件類型
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          comparison: null as unknown as ComparisonResponse['comparison'],
          error: `Unsupported file type: ${file.type}. Allowed: PDF, JPEG, PNG, TIFF.`,
        },
        { status: 400 }
      );
    }

    // 讀取文件為 Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(
      `[ExtractionCompare] Processing file: ${file.name}, size: ${buffer.length} bytes`
    );

    // 為 GPT Vision 創建臨時文件
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `extraction-compare-${Date.now()}-${file.name}`);
    await fs.writeFile(tempFilePath, buffer);

    const targetFields = 8; // 標準欄位數

    // ============================================================
    // 方案 A: Extraction V2 (Azure DI + GPT-mini)
    // ============================================================
    console.log('[ExtractionCompare] Running Approach A: Extraction V2...');
    const startA = Date.now();

    let approachAResult: ApproachResult;
    try {
      const resultA = await runExtractionV2Pipeline(buffer, file.name);
      const fieldsA: Record<string, ExtractedField> = {};

      // 調試日誌
      console.log('[ExtractionCompare] Approach A gptResult:', JSON.stringify({
        success: resultA.success,
        fieldsCount: Object.keys(resultA.gptResult.fields).length,
        fields: resultA.gptResult.fields,
        modelUsed: resultA.gptResult.modelUsed,
      }, null, 2));

      // 轉換為標準格式
      for (const [key, value] of Object.entries(resultA.gptResult.fields)) {
        fieldsA[key] = {
          value: value.value,
          confidence: value.confidence * 100,
          source: value.source,
        };
      }

      approachAResult = {
        name: 'Extraction V2 (Azure DI + GPT-mini)',
        success: resultA.success,
        fields: fieldsA,
        fieldsExtracted: countExtractedFields(fieldsA),
        totalFields: targetFields,
        processingTimeMs: Date.now() - startA,
        tokensUsed: resultA.gptResult.tokensUsed,
        details: {
          azureDI: {
            keyValuePairs: resultA.azureDIResult.keyValuePairs.length,
            tables: resultA.azureDIResult.tables.length,
            confidence: resultA.azureDIResult.confidence,
            timeMs: resultA.azureDIResult.processingTimeMs,
          },
          gptMini: {
            modelUsed: resultA.gptExtractionResult.modelUsed,
            timeMs: resultA.gptExtractionResult.processingTimeMs,
          },
          quality: resultA.qualityAnalysis.overallQuality,
        },
      };
    } catch (error) {
      approachAResult = {
        name: 'Extraction V2 (Azure DI + GPT-mini)',
        success: false,
        fields: {},
        fieldsExtracted: 0,
        totalFields: targetFields,
        processingTimeMs: Date.now() - startA,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // ============================================================
    // 方案 B: 純 GPT-5.2 Vision
    // ============================================================
    console.log('[ExtractionCompare] Running Approach B: Direct GPT-5.2 Vision...');
    const startB = Date.now();

    let approachBResult: ApproachResult;
    try {
      // 使用直接 GPT Vision 提取，專門針對標準發票欄位
      const resultB = await extractWithDirectGptVision(tempFilePath);
      console.log('[ExtractionCompare] Direct GPT Vision result:', JSON.stringify({
        success: resultB.success,
        confidence: resultB.confidence,
        pageCount: resultB.pageCount,
        fieldsCount: Object.keys(resultB.fields).length,
        fields: resultB.fields,
        tokensUsed: resultB.tokensUsed,
        error: resultB.error,
      }, null, 2));

      approachBResult = {
        name: 'Direct GPT-5.2 Vision',
        success: resultB.success,
        fields: resultB.fields,
        fieldsExtracted: countExtractedFields(resultB.fields),
        totalFields: targetFields,
        processingTimeMs: resultB.processingTimeMs,
        tokensUsed: resultB.tokensUsed,
        details: {
          confidence: resultB.confidence,
          pageCount: resultB.pageCount,
          model: 'gpt-5.2',
        },
        error: resultB.error,
      };
    } catch (error) {
      approachBResult = {
        name: 'Direct GPT-5.2 Vision',
        success: false,
        fields: {},
        fieldsExtracted: 0,
        totalFields: targetFields,
        processingTimeMs: Date.now() - startB,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // ============================================================
    // 計算對比摘要
    // ============================================================
    const speedDiff = approachAResult.processingTimeMs - approachBResult.processingTimeMs;
    const speedDiffPercent =
      approachBResult.processingTimeMs > 0
        ? Math.round((speedDiff / approachBResult.processingTimeMs) * 100)
        : 0;
    const fieldsDiff = approachAResult.fieldsExtracted - approachBResult.fieldsExtracted;

    // 決定贏家
    let winner: 'A' | 'B' | 'tie' = 'tie';
    let reason = '';
    let recommendation = '';

    // 優先考慮準確度（欄位提取數），次要考慮速度
    if (approachAResult.fieldsExtracted > approachBResult.fieldsExtracted) {
      winner = 'A';
      reason = `方案 A 提取了更多欄位 (${approachAResult.fieldsExtracted} vs ${approachBResult.fieldsExtracted})`;
    } else if (approachBResult.fieldsExtracted > approachAResult.fieldsExtracted) {
      winner = 'B';
      reason = `方案 B 提取了更多欄位 (${approachBResult.fieldsExtracted} vs ${approachAResult.fieldsExtracted})`;
    } else {
      // 欄位數相同，比較速度
      if (Math.abs(speedDiff) > 2000) {
        // 超過 2 秒差異
        if (speedDiff > 0) {
          winner = 'B';
          reason = `欄位數相同，但方案 B 快 ${Math.abs(speedDiff)}ms (${Math.abs(speedDiffPercent)}%)`;
        } else {
          winner = 'A';
          reason = `欄位數相同，但方案 A 快 ${Math.abs(speedDiff)}ms (${Math.abs(speedDiffPercent)}%)`;
        }
      } else {
        winner = 'tie';
        reason = `欄位數相同 (${approachAResult.fieldsExtracted})，速度差異不大 (${Math.abs(speedDiff)}ms)`;
      }
    }

    // 生成建議
    if (winner === 'B') {
      recommendation =
        '建議使用純 GPT Vision 方案：更簡單的架構、更快的速度、相當或更好的準確度。' +
        '可以移除 Azure DI 依賴以簡化系統。';
    } else if (winner === 'A') {
      recommendation =
        '方案 A (Azure DI + GPT) 在此測試中表現較佳。' +
        'Azure DI 的結構化提取可能對複雜表格有優勢。建議多測試不同類型文件。';
    } else {
      recommendation =
        '兩種方案效果相當。建議選擇更簡單的方案 B (純 GPT Vision) 以減少架構複雜度和成本。';
    }

    // 構建響應
    const response: ComparisonResponse = {
      success: true,
      comparison: {
        fileName: file.name,
        fileSize: buffer.length,
        approachA: approachAResult,
        approachB: approachBResult,
        summary: {
          winner,
          reason,
          speedDifferenceMs: speedDiff,
          speedDifferencePercent: speedDiffPercent,
          fieldsDifference: fieldsDiff,
          recommendation,
        },
      },
    };

    console.log(
      `[ExtractionCompare] Comparison complete. Winner: ${winner}. ` +
        `A: ${approachAResult.fieldsExtracted}/${targetFields} (${approachAResult.processingTimeMs}ms), ` +
        `B: ${approachBResult.fieldsExtracted}/${targetFields} (${approachBResult.processingTimeMs}ms)`
    );

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ExtractionCompare] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        comparison: null as unknown as ComparisonResponse['comparison'],
        error: errorMessage,
      },
      { status: 500 }
    );
  } finally {
    // 清理臨時文件
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // 忽略清理錯誤
      }
    }
  }
}
