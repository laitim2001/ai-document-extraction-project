/**
 * @fileoverview Prompt 配置測試 API
 * @description
 *   提供 Prompt 配置的測試功能。
 *   接收文件和配置 ID，使用配置處理文件並返回結果。
 *
 *   整合真實的 Azure OpenAI GPT-5.2 服務：
 *   - 載入用戶指定的 Prompt 配置
 *   - 解析變數並生成最終 Prompt
 *   - 使用 GPT Vision 服務處理上傳的文件
 *   - 返回真實的提取結果
 *
 * @module src/app/api/v1/prompt-configs/test
 * @since Epic 14 - Story 14.2
 * @lastModified 2026-01-07
 *
 * @features
 *   - POST: 測試 Prompt 配置效果（真實 GPT Vision 調用）
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *   - gpt-vision.service - GPT Vision 服務
 *   - Azure OpenAI - GPT-5.2 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AzureOpenAI } from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// PDF 轉圖片依賴 - 使用動態導入避免 webpack 問題
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfToImg: any = null;

/**
 * 動態載入 pdf-to-img 模組
 */
async function loadPdfToImg() {
  if (!pdfToImg) {
    const pdfModule = await import('pdf-to-img');
    pdfToImg = pdfModule.pdf;
  }
  return pdfToImg;
}

// ============================================================================
// Types
// ============================================================================

interface TestResult {
  success: boolean;
  extractedData?: Record<string, unknown>;
  rawResponse?: string;
  executionTimeMs: number;
  tokensUsed: {
    prompt: number;
    completion: number;
  };
  error?: string;
  pageCount?: number;
  promptInfo: {
    configId: string;
    configName: string;
    promptType: string;
    resolvedSystemPrompt: string;
    resolvedUserPrompt: string;
    variables: Record<string, string>;
  };
  fileInfo: {
    name: string;
    size: number;
    type: string;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 將文件轉換為 Base64
 */
async function fileToBase64(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return buffer.toString('base64');
}

/**
 * 獲取圖片的 MIME 類型
 */
function getMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    pdf: 'application/pdf',
  };
  return mimeTypes[ext || ''] || 'image/jpeg';
}

/**
 * 檢查文件是否為支援的類型
 */
function isValidFileType(mimeType: string): boolean {
  const validTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/tiff',
    'image/webp',
  ];
  return validTypes.includes(mimeType);
}

/**
 * 檢查文件是否為 PDF
 */
function isPdfFile(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/**
 * 將 PDF 轉換為圖片 (PNG) - 支援多頁
 *
 * @param pdfPath - PDF 文件路徑
 * @param maxPages - 最大處理頁數（預設 10 頁，避免 token 過多）
 * @returns 轉換後的圖片路徑列表和頁數
 */
async function convertPdfToImages(pdfPath: string, maxPages: number = 10): Promise<{
  imagePaths: string[];
  pageCount: number;
}> {
  const tempDir = path.dirname(pdfPath);

  try {
    const pdf = await loadPdfToImg();
    console.log(`[Prompt Test API] Converting PDF to images (max ${maxPages} pages)...`);

    const imagePaths: string[] = [];
    let pageNum = 0;

    // 處理多頁 PDF
    for await (const image of await pdf(pdfPath, { scale: 2 })) {
      pageNum++;
      if (pageNum > maxPages) {
        console.log(`[Prompt Test API] Reached max pages limit (${maxPages}), stopping...`);
        break;
      }

      const imagePath = path.join(tempDir, `page-${pageNum}.png`);
      await fs.writeFile(imagePath, image);
      imagePaths.push(imagePath);
    }

    console.log(`[Prompt Test API] PDF converted: ${imagePaths.length} page(s) of ${pageNum} total`);

    return {
      imagePaths,
      pageCount: imagePaths.length,
    };
  } catch (error) {
    console.error('[Prompt Test API] PDF conversion error:', error);
    throw new Error(`PDF 轉換失敗: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 解析 GPT 回應中的 JSON
 */
function parseGPTResponse(content: string): Record<string, unknown> {
  try {
    return JSON.parse(content);
  } catch {
    // 嘗試提取 JSON 塊
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    // 如果無法解析 JSON，返回原始文字
    return { rawText: content };
  }
}

// ============================================================================
// POST /api/v1/prompt-configs/test - 測試配置
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let tempFilePath: string | null = null;

  try {
    // 1. 解析 FormData
    const formData = await request.formData();
    const configId = formData.get('configId') as string;
    const file = formData.get('file') as File | null;

    if (!configId) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '缺少 configId 參數',
          instance: '/api/v1/prompt-configs/test',
        },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: '缺少測試文件',
          instance: '/api/v1/prompt-configs/test',
        },
        { status: 400 }
      );
    }

    // 驗證文件類型
    if (!isValidFileType(file.type)) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: `不支援的文件類型: ${file.type}。請上傳 PDF 或圖片文件。`,
          instance: '/api/v1/prompt-configs/test',
        },
        { status: 400 }
      );
    }

    // 2. 獲取配置
    const config = await prisma.promptConfig.findUnique({
      where: { id: configId },
      include: {
        company: { select: { id: true, name: true } },
        documentFormat: { select: { id: true, name: true } },
      },
    });

    if (!config) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `找不到配置 ID: ${configId}`,
          instance: '/api/v1/prompt-configs/test',
        },
        { status: 404 }
      );
    }

    // 3. 準備變數替換
    const variables: Record<string, string> = {
      companyName: config.company?.name ?? 'Unknown Company',
      documentFormatName: config.documentFormat?.name ?? 'Unknown Format',
      knownTerms: '[]', // 預設空的已知術語
    };

    // 4. 替換 Prompt 中的變數
    let resolvedSystemPrompt = config.systemPrompt;
    let resolvedUserPrompt = config.userPromptTemplate;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      resolvedSystemPrompt = resolvedSystemPrompt.replace(new RegExp(placeholder, 'g'), value);
      resolvedUserPrompt = resolvedUserPrompt.replace(new RegExp(placeholder, 'g'), value);
    }

    // 5. 保存文件到臨時目錄
    const tempDir = path.join(os.tmpdir(), `prompt-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    const fileExtension = file.name.split('.').pop() || 'pdf';
    tempFilePath = path.join(tempDir, `upload.${fileExtension}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(tempFilePath, buffer);

    console.log(`[Prompt Test API] Processing file: ${file.name} (${file.type})`);
    console.log(`[Prompt Test API] Using config: ${config.name} (${config.promptType})`);

    // 6. 檢查 Azure OpenAI 配置
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-5.2';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-03-01-preview';

    if (!endpoint || !apiKey) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/configuration',
          title: 'Configuration Error',
          status: 500,
          detail: 'Azure OpenAI 尚未配置。請設置 AZURE_OPENAI_ENDPOINT 和 AZURE_OPENAI_API_KEY 環境變數。',
          instance: '/api/v1/prompt-configs/test',
        },
        { status: 500 }
      );
    }

    // 7. 創建 Azure OpenAI 客戶端
    const client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion,
    });

    // 8. 處理文件（PDF 需要先轉換為圖片）
    let imagePaths: string[] = [];
    let pageCount = 1;

    if (isPdfFile(file.type)) {
      console.log(`[Prompt Test API] Detected PDF, converting to images...`);
      const conversionResult = await convertPdfToImages(tempFilePath, 10); // 最多處理 10 頁
      imagePaths = conversionResult.imagePaths;
      pageCount = conversionResult.pageCount;
    } else {
      // 非 PDF 文件，直接使用
      imagePaths = [tempFilePath];
    }

    // 9. 組合最終 Prompt
    const finalPrompt = resolvedSystemPrompt
      ? `${resolvedSystemPrompt}\n\n${resolvedUserPrompt}`
      : resolvedUserPrompt;

    // 10. 構建多圖片的 content 數組
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentArray: any[] = [
      { type: 'text', text: finalPrompt },
    ];

    // 添加所有頁面的圖片
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      const imageBase64 = await fileToBase64(imagePath);
      const mimeType = isPdfFile(file.type) ? 'image/png' : getMimeType(file.name);

      console.log(`[Prompt Test API] Adding page ${i + 1}/${imagePaths.length} to request...`);

      contentArray.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${imageBase64}`,
          detail: 'high',
        },
      });
    }

    console.log(`[Prompt Test API] Calling GPT Vision with ${imagePaths.length} page(s)...`);

    // 11. 調用 GPT Vision API（支援多圖片）
    const response = await client.chat.completions.create({
      model: deploymentName,
      messages: [
        {
          role: 'user',
          content: contentArray,
        },
      ],
      max_completion_tokens: 8192, // 增加 token 限制以容納多頁輸出
    });

    const executionTimeMs = Date.now() - startTime;

    // 12. 解析回應
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('GPT Vision 返回空回應');
    }

    const extractedData = parseGPTResponse(content);
    const usage = response.usage;

    console.log(`[Prompt Test API] Extraction successful in ${executionTimeMs}ms (${pageCount} page(s))`);

    // 13. 構建測試結果
    const testResult: TestResult = {
      success: true,
      extractedData,
      rawResponse: content,
      executionTimeMs,
      pageCount,
      tokensUsed: {
        prompt: usage?.prompt_tokens ?? 0,
        completion: usage?.completion_tokens ?? 0,
      },
      promptInfo: {
        configId: config.id,
        configName: config.name,
        promptType: config.promptType,
        resolvedSystemPrompt,
        resolvedUserPrompt,
        variables,
      },
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
    };

    return NextResponse.json(testResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '測試執行失敗';
    console.error('[Prompt Test API] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        executionTimeMs: Date.now() - startTime,
        tokensUsed: { prompt: 0, completion: 0 },
      },
      { status: 500 }
    );
  } finally {
    // 清理臨時文件
    if (tempFilePath) {
      try {
        const tempDir = path.dirname(tempFilePath);
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`[Prompt Test API] Cleaned up temp directory`);
      } catch (cleanupError) {
        console.warn('[Prompt Test API] Failed to cleanup temp files:', cleanupError);
      }
    }
  }
}
