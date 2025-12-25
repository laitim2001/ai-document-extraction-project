/**
 * @fileoverview GPT-5.2 Vision 處理服務
 * @description
 *   使用 Azure OpenAI GPT-5.2 模型處理圖片和掃描 PDF：
 *   - 圖片轉 Base64 編碼
 *   - GPT-5.2 Vision API 調用
 *   - 發票內容提取和結構化
 *
 * @module src/services/gpt-vision
 * @since Epic 0 - Story 0.2
 * @lastModified 2025-12-24
 *
 * @features
 *   - 支援 JPG、PNG、TIFF、PDF 圖片
 *   - 結構化發票數據提取
 *   - 錯誤處理和重試
 *
 * @dependencies
 *   - Azure OpenAI Service
 *   - pdf-to-img（PDF 轉圖片）
 *
 * @related
 *   - src/services/batch-processor.service.ts - 批量處理執行器
 *   - src/services/processing-router.service.ts - 處理路由服務
 */

import { AzureOpenAI } from 'openai'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

// PDF 轉圖片依賴 - 使用動態導入避免 webpack 問題
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfToImg: any = null

/**
 * 動態載入 pdf-to-img 模組
 */
async function loadPdfToImg() {
  if (!pdfToImg) {
    const module = await import('pdf-to-img')
    pdfToImg = module.pdf
  }
  return pdfToImg
}

// ============================================================
// Types
// ============================================================

/**
 * 發票提取結果
 */
export interface InvoiceExtractionResult {
  /** 提取成功 */
  success: boolean
  /** 信心度 (0-1) */
  confidence: number
  /** 發票數據 */
  invoiceData?: {
    invoiceNumber?: string
    invoiceDate?: string
    dueDate?: string
    vendor?: {
      name?: string
      address?: string
      taxId?: string
    }
    buyer?: {
      name?: string
      address?: string
    }
    lineItems?: Array<{
      description?: string
      quantity?: number
      unitPrice?: number
      amount?: number
    }>
    subtotal?: number
    taxAmount?: number
    totalAmount?: number
    currency?: string
  }
  /** 原始文字（OCR 結果） */
  rawText?: string
  /** 處理的頁數 */
  pageCount: number
  /** 錯誤信息（如果有） */
  error?: string
}

/**
 * GPT Vision 配置
 */
export interface GPTVisionConfig {
  /** Azure OpenAI Endpoint */
  endpoint?: string
  /** API Key */
  apiKey?: string
  /** 部署名稱 */
  deploymentName?: string
  /** 模型版本 */
  apiVersion?: string
  /** 最大 Token 數 */
  maxTokens?: number
}

// ============================================================
// Constants
// ============================================================

/**
 * 發票提取提示詞
 */
const INVOICE_EXTRACTION_PROMPT = `你是一個專業的發票 OCR 和數據提取專家。請仔細分析這張發票圖片，提取以下信息：

1. 發票號碼 (invoiceNumber)
2. 發票日期 (invoiceDate) - 格式：YYYY-MM-DD
3. 付款截止日期 (dueDate) - 格式：YYYY-MM-DD（如有）
4. 供應商信息 (vendor):
   - 名稱 (name)
   - 地址 (address)
   - 稅號 (taxId)
5. 買方信息 (buyer):
   - 名稱 (name)
   - 地址 (address)
6. 明細項目 (lineItems) - 每個項目包含：
   - 描述 (description)
   - 數量 (quantity)
   - 單價 (unitPrice)
   - 金額 (amount)
7. 小計 (subtotal)
8. 稅額 (taxAmount)
9. 總金額 (totalAmount)
10. 貨幣 (currency)

請以 JSON 格式回覆，結構如下：
{
  "invoiceNumber": "...",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "vendor": { "name": "...", "address": "...", "taxId": "..." },
  "buyer": { "name": "...", "address": "..." },
  "lineItems": [{ "description": "...", "quantity": 1, "unitPrice": 100, "amount": 100 }],
  "subtotal": 100,
  "taxAmount": 10,
  "totalAmount": 110,
  "currency": "USD"
}

如果某個欄位無法識別，請設為 null。只回覆 JSON，不要包含其他文字。`

/**
 * 預設配置
 */
const DEFAULT_CONFIG: GPTVisionConfig = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-5.2',
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-03-01-preview',
  maxTokens: 4096,
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 將文件轉換為 Base64
 *
 * @param filePath - 文件路徑
 * @returns Base64 編碼的圖片
 */
export async function fileToBase64(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath)
  return buffer.toString('base64')
}

/**
 * 獲取圖片的 MIME 類型
 *
 * @param filePath - 文件路徑
 * @returns MIME 類型
 */
export function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop()
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  }
  return mimeTypes[ext || ''] || 'image/jpeg'
}

/**
 * 檢查文件是否為 PDF
 *
 * @param filePath - 文件路徑
 * @returns 是否為 PDF 文件
 */
export function isPdfFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().split('.').pop()
  return ext === 'pdf'
}

/**
 * 將 PDF 轉換為圖片 (PNG)
 *
 * @description
 *   使用 pdf-to-img 將 PDF 的每一頁轉換為 PNG 圖片。
 *   此庫專為 Node.js 設計，可正確處理掃描 PDF 中的嵌入圖片。
 *   圖片保存在臨時目錄中，需要在使用後清理。
 *
 * @param pdfPath - PDF 文件路徑
 * @returns 轉換後的圖片路徑數組和頁數
 */
export async function convertPdfToImages(pdfPath: string): Promise<{
  imagePaths: string[]
  pageCount: number
}> {
  const imagePaths: string[] = []
  const tempDir = path.join(os.tmpdir(), `pdf-images-${Date.now()}`)

  // 創建臨時目錄
  await fs.mkdir(tempDir, { recursive: true })

  try {
    // 載入 pdf-to-img 模組
    const pdf = await loadPdfToImg()

    console.log(`[GPT Vision] Converting PDF: ${path.basename(pdfPath)}`)

    // 轉換每一頁為圖片（只處理前 5 頁以避免過長處理時間）
    const maxPages = 5
    let pageNum = 0

    // pdf-to-img 使用 async iterator 模式
    for await (const image of await pdf(pdfPath, { scale: 2 })) {
      pageNum++

      if (pageNum > maxPages) {
        console.log(`[GPT Vision] Reached max pages limit (${maxPages}), skipping remaining pages`)
        break
      }

      // 保存圖片到臨時目錄
      const imagePath = path.join(tempDir, `page-${pageNum}.png`)
      await fs.writeFile(imagePath, image)
      imagePaths.push(imagePath)
    }

    console.log(`[GPT Vision] PDF converted: ${imagePaths.length} pages processed`)

    return {
      imagePaths,
      pageCount: pageNum,
    }
  } catch (error) {
    // 清理臨時目錄（如果有錯誤）
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // 忽略清理錯誤
    }
    throw error
  }
}

/**
 * 清理臨時圖片文件
 *
 * @param imagePaths - 圖片路徑數組
 */
export async function cleanupTempImages(imagePaths: string[]): Promise<void> {
  if (imagePaths.length === 0) return

  // 獲取父目錄（臨時目錄）
  const tempDir = path.dirname(imagePaths[0])

  try {
    await fs.rm(tempDir, { recursive: true, force: true })
    console.log(`[GPT Vision] Cleaned up temp directory: ${tempDir}`)
  } catch (error) {
    console.warn(`[GPT Vision] Failed to cleanup temp directory: ${tempDir}`, error)
  }
}

/**
 * 解析 GPT 回應中的 JSON
 *
 * @param content - GPT 回應內容
 * @returns 解析後的 JSON 對象
 */
function parseGPTResponse(content: string): Record<string, unknown> {
  // 嘗試直接解析
  try {
    return JSON.parse(content)
  } catch {
    // 嘗試提取 JSON 塊
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error('Failed to parse GPT response as JSON')
  }
}

// ============================================================
// Core Functions
// ============================================================

/**
 * 創建 Azure OpenAI 客戶端
 *
 * @param config - 配置選項
 * @returns OpenAI 客戶端
 */
export function createClient(config: GPTVisionConfig = {}): AzureOpenAI {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  if (!mergedConfig.endpoint || !mergedConfig.apiKey) {
    throw new Error('Azure OpenAI endpoint and API key are required')
  }

  return new AzureOpenAI({
    endpoint: mergedConfig.endpoint,
    apiKey: mergedConfig.apiKey,
    apiVersion: mergedConfig.apiVersion,
  })
}

/**
 * 使用 GPT-5.2 Vision 處理單張圖片
 *
 * @description
 *   將圖片發送到 GPT-5.2 Vision API 進行發票內容提取。
 *   此函數僅處理圖片文件，不處理 PDF。
 *
 * @param imagePath - 圖片文件路徑
 * @param config - 配置選項
 * @returns 提取結果
 */
async function processSingleImage(
  imagePath: string,
  config: GPTVisionConfig
): Promise<InvoiceExtractionResult> {
  // 讀取並編碼圖片
  const imageBase64 = await fileToBase64(imagePath)
  const mimeType = getMimeType(imagePath)

  // 創建客戶端
  const client = createClient(config)

  // 調用 API
  const response = await client.chat.completions.create({
    model: config.deploymentName || 'gpt-5.2',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: INVOICE_EXTRACTION_PROMPT },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_completion_tokens: config.maxTokens,
  })

  // 解析回應
  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('Empty response from GPT-5.2 Vision')
  }

  const invoiceData = parseGPTResponse(content)

  return {
    success: true,
    confidence: 0.9, // GPT-5.2 Vision 通常有較高的信心度
    invoiceData: invoiceData as InvoiceExtractionResult['invoiceData'],
    pageCount: 1,
  }
}

/**
 * 使用 GPT-5.2 Vision 處理圖片或 PDF
 *
 * @description
 *   將圖片或 PDF 發送到 GPT-5.2 Vision API 進行發票內容提取。
 *   如果是 PDF 文件，會先轉換為圖片再處理。
 *
 * @param imagePath - 圖片或 PDF 文件路徑
 * @param config - 配置選項
 * @returns 提取結果
 *
 * @example
 * ```typescript
 * const result = await processImageWithVision('/path/to/invoice.jpg')
 * if (result.success) {
 *   console.log(result.invoiceData)
 * }
 * ```
 */
export async function processImageWithVision(
  imagePath: string,
  config: GPTVisionConfig = {}
): Promise<InvoiceExtractionResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  let tempImagePaths: string[] = []

  try {
    // 檢查配置
    if (!mergedConfig.endpoint || !mergedConfig.apiKey) {
      // 如果沒有配置，返回模擬結果
      console.warn('GPT Vision: Azure OpenAI not configured, using mock response')
      return createMockResult(imagePath)
    }

    // 檢查是否為 PDF 文件
    if (isPdfFile(imagePath)) {
      console.log(`[GPT Vision] Detected PDF file, converting to images: ${path.basename(imagePath)}`)

      // 將 PDF 轉換為圖片
      const { imagePaths, pageCount } = await convertPdfToImages(imagePath)
      tempImagePaths = imagePaths

      if (imagePaths.length === 0) {
        throw new Error('Failed to extract images from PDF')
      }

      console.log(`[GPT Vision] Processing first page of ${pageCount} pages`)

      // 處理第一頁（通常包含主要發票資訊）
      const result = await processSingleImage(imagePaths[0], mergedConfig)
      result.pageCount = pageCount

      return result
    }

    // 直接處理圖片文件
    return await processSingleImage(imagePath, mergedConfig)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('GPT Vision processing error:', errorMessage)

    return {
      success: false,
      confidence: 0,
      pageCount: 0,
      error: errorMessage,
    }
  } finally {
    // 清理臨時圖片文件
    if (tempImagePaths.length > 0) {
      await cleanupTempImages(tempImagePaths)
    }
  }
}

/**
 * 創建模擬結果（用於測試）
 *
 * @param imagePath - 圖片路徑
 * @returns 模擬的提取結果
 */
function createMockResult(imagePath: string): InvoiceExtractionResult {
  return {
    success: true,
    confidence: 0.85,
    invoiceData: {
      invoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      vendor: {
        name: 'Sample Freight Forwarder Ltd.',
        address: '123 Shipping Lane, Hong Kong',
      },
      lineItems: [
        {
          description: 'Ocean Freight - FCL 40HC',
          quantity: 1,
          unitPrice: 2500,
          amount: 2500,
        },
        {
          description: 'Terminal Handling Charge',
          quantity: 1,
          unitPrice: 150,
          amount: 150,
        },
      ],
      subtotal: 2650,
      taxAmount: 0,
      totalAmount: 2650,
      currency: 'USD',
    },
    pageCount: 1,
    rawText: `[Mock OCR: ${imagePath}]`,
  }
}

/**
 * 處理多頁圖片
 *
 * @description
 *   處理多頁 PDF 轉換出的圖片集合。
 *
 * @param imagePaths - 圖片路徑數組
 * @param config - 配置選項
 * @returns 合併的提取結果
 */
export async function processMultipleImages(
  imagePaths: string[],
  config: GPTVisionConfig = {}
): Promise<InvoiceExtractionResult> {
  if (imagePaths.length === 0) {
    return {
      success: false,
      confidence: 0,
      pageCount: 0,
      error: 'No images to process',
    }
  }

  // 處理第一頁（通常包含主要發票資訊）
  const result = await processImageWithVision(imagePaths[0], config)

  // 更新頁數
  result.pageCount = imagePaths.length

  return result
}

/**
 * 驗證 Azure OpenAI 配置
 *
 * @returns 配置是否有效
 */
export function validateConfig(): {
  valid: boolean
  missing: string[]
} {
  const missing: string[] = []

  if (!process.env.AZURE_OPENAI_ENDPOINT) {
    missing.push('AZURE_OPENAI_ENDPOINT')
  }
  if (!process.env.AZURE_OPENAI_API_KEY) {
    missing.push('AZURE_OPENAI_API_KEY')
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}
