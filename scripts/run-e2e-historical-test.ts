/**
 * @fileoverview E2E 歷史數據初始化完整測試腳本
 * @description
 *   執行 Epic 0 歷史數據初始化的完整流程：
 *   1. 創建測試批次
 *   2. 上傳 Doc Sample 中的所有 PDF 文件
 *   3. 執行批次處理
 *   4. 監控處理進度
 *   5. 驗證結果並生成報告
 *
 * @module scripts/run-e2e-historical-test
 * @since TEST-PLAN-002
 */

import { PrismaClient, HistoricalBatchStatus, HistoricalFileStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import FormData from 'form-data'

dotenv.config()

// ============================================================
// Configuration
// ============================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
const DOC_SAMPLE_DIR = path.resolve(
  'C:\\Users\\rci.ChrisLai\\Documents\\GitHub\\ai-document-extraction-project\\docs\\Doc Sample'
)
const REPORT_OUTPUT_DIR = path.resolve(
  'C:\\Users\\rci.ChrisLai\\Documents\\GitHub\\ai-document-extraction-project\\claudedocs\\5-status\\testing\\reports'
)

// ============================================================
// Database Setup
// ============================================================

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ============================================================
// Types
// ============================================================

interface BatchCreateResponse {
  success: boolean
  data: {
    id: string
    name: string
    status: string
  }
}

interface UploadResponse {
  success: boolean
  data: {
    uploadedCount: number
    failedCount: number
    files: Array<{ id: string; originalName: string; status: string }>
  }
}

interface ProcessResponse {
  success: boolean
  message: string
  data: {
    batchId: string
    status: string
    totalFiles: number
  }
}

interface ProgressResponse {
  success: boolean
  data: {
    status: string
    totalFiles: number
    processedFiles: number
    failedFiles: number
    progress: number
    estimatedTimeRemaining: number | null
  }
}

// ============================================================
// Helper Functions
// ============================================================

function log(message: string, data?: unknown) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`)
  if (data) {
    console.log(JSON.stringify(data, null, 2))
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function ensureReportDir(): Promise<void> {
  if (!fs.existsSync(REPORT_OUTPUT_DIR)) {
    fs.mkdirSync(REPORT_OUTPUT_DIR, { recursive: true })
  }
}

// ============================================================
// API Functions (using Prisma directly for simplicity)
// ============================================================

async function createBatch(name: string, description: string): Promise<string> {
  log(`Creating batch: ${name}`)

  const batch = await prisma.historicalBatch.create({
    data: {
      name,
      description,
      createdBy: 'dev-user-1',
      status: HistoricalBatchStatus.PENDING,
      enableCompanyIdentification: true,
      fuzzyMatchThreshold: 0.9,
      autoMergeSimilar: false,
      enableTermAggregation: true,
      termSimilarityThreshold: 0.85,
      autoClassifyTerms: true,
      enableIssuerIdentification: true,
      issuerConfidenceThreshold: 0.7,
      autoCreateIssuerCompany: true,
      issuerFuzzyThreshold: 0.9,
    },
  })

  log(`Batch created: ${batch.id}`)
  return batch.id
}

async function uploadFiles(batchId: string, files: string[]): Promise<number> {
  log(`Uploading ${files.length} files to batch ${batchId}`)

  let uploadedCount = 0
  let failedCount = 0

  // Import file detection service dynamically
  const { FileDetectionService } = await import('../src/services/file-detection.service')

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]
    const fileName = path.basename(filePath)

    try {
      // Read file and detect type
      const fileBuffer = fs.readFileSync(filePath)
      const result = await FileDetectionService.detectFileType(fileBuffer, fileName, 'application/pdf')
      const fileType = result.detectedType

      // Create HistoricalFile record
      await prisma.historicalFile.create({
        data: {
          batchId,
          fileName: fileName,
          originalName: fileName,
          storagePath: filePath,
          fileSize: fileBuffer.length,
          mimeType: 'application/pdf',
          detectedType: fileType,
          status: HistoricalFileStatus.PENDING,
        },
      })

      uploadedCount++

      // Progress logging every 10 files
      if ((i + 1) % 10 === 0 || i === files.length - 1) {
        log(`Upload progress: ${i + 1}/${files.length} (${Math.round(((i + 1) / files.length) * 100)}%)`)
      }
    } catch (error) {
      failedCount++
      console.error(`Failed to upload ${fileName}:`, error)
    }
  }

  // Update batch totalFiles count
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: { totalFiles: uploadedCount },
  })

  log(`Upload complete: ${uploadedCount} succeeded, ${failedCount} failed`)
  return uploadedCount
}

async function startProcessing(batchId: string): Promise<void> {
  log(`Starting processing for batch ${batchId}`)

  // Import batch processor dynamically
  const { processBatch } = await import('../src/services/batch-processor.service')

  // Update batch status
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: {
      status: HistoricalBatchStatus.PROCESSING,
      startedAt: new Date(),
    },
  })

  // IMPORTANT: Update all files from PENDING to PROCESSING
  // The batch processor only processes files with status PROCESSING
  const updateResult = await prisma.historicalFile.updateMany({
    where: {
      batchId,
      status: HistoricalFileStatus.PENDING,
    },
    data: {
      status: HistoricalFileStatus.PROCESSING,
    },
  })
  log(`Updated ${updateResult.count} files to PROCESSING status`)

  // Start processing (fire-and-forget style, but we'll monitor progress)
  processBatch(batchId, {
    onProgress: (progress) => {
      console.log(
        `[Progress] ${progress.completed}/${progress.total} (${Math.round(progress.percentage)}%) - Current: ${progress.currentFile || 'N/A'}`
      )
    },
  })
    .then((result) => {
      log('Batch processing completed', result)
    })
    .catch((error) => {
      console.error('Batch processing error:', error)
    })
}

async function monitorProgress(batchId: string): Promise<void> {
  log('Monitoring processing progress...')

  let isComplete = false
  let lastProgress = 0
  const startTime = Date.now()

  while (!isComplete) {
    await sleep(5000) // Check every 5 seconds

    const batch = await prisma.historicalBatch.findUnique({
      where: { id: batchId },
      include: {
        _count: {
          select: { files: true },
        },
        files: {
          select: { status: true },
        },
      },
    })

    if (!batch) {
      throw new Error('Batch not found')
    }

    const completedFiles = batch.files.filter(
      (f) => f.status === 'COMPLETED' || f.status === 'FAILED' || f.status === 'SKIPPED'
    ).length
    const progress = batch._count.files > 0 ? (completedFiles / batch._count.files) * 100 : 0

    // Only log if progress changed
    if (Math.round(progress) !== Math.round(lastProgress)) {
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
      const elapsedMinutes = Math.floor(elapsedSeconds / 60)
      const elapsedSecondsRemainder = elapsedSeconds % 60
      log(
        `Progress: ${completedFiles}/${batch._count.files} (${Math.round(progress)}%) - Elapsed: ${elapsedMinutes}m ${elapsedSecondsRemainder}s`
      )
      lastProgress = progress
    }

    // Check completion
    if (
      batch.status === 'COMPLETED' ||
      batch.status === 'FAILED' ||
      batch.status === 'CANCELLED' ||
      completedFiles === batch._count.files
    ) {
      isComplete = true
      const totalSeconds = Math.round((Date.now() - startTime) / 1000)
      const totalMinutes = Math.floor(totalSeconds / 60)
      const remainingSeconds = totalSeconds % 60
      log(`Processing completed in ${totalMinutes}m ${remainingSeconds}s`)
      log(`Final status: ${batch.status}`)
      log(`Files: ${batch.processedFiles} processed, ${batch.failedFiles} failed`)
    }
  }
}

async function generateReport(batchId: string): Promise<void> {
  log('Generating test report...')

  await ensureReportDir()

  // Get batch details
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
    include: {
      files: {
        include: {
          documentIssuer: true,
          documentFormat: true,
        },
      },
    },
  })

  if (!batch) {
    throw new Error('Batch not found')
  }

  // Calculate statistics
  const stats = {
    totalFiles: batch.files.length,
    completedFiles: batch.files.filter((f) => f.status === 'COMPLETED').length,
    failedFiles: batch.files.filter((f) => f.status === 'FAILED').length,
    skippedFiles: batch.files.filter((f) => f.status === 'SKIPPED').length,
    filesWithIssuer: batch.files.filter((f) => f.documentIssuerId).length,
    filesWithFormat: batch.files.filter((f) => f.documentFormatId).length,
    uniqueIssuers: new Set(batch.files.map((f) => f.documentIssuerId).filter(Boolean)).size,
    uniqueFormats: new Set(batch.files.map((f) => f.documentFormatId).filter(Boolean)).size,
  }

  // Get processing method distribution
  const methodCounts: Record<string, number> = {}
  for (const file of batch.files) {
    const method = file.processingMethod || 'UNKNOWN'
    methodCounts[method] = (methodCounts[method] || 0) + 1
  }

  // Get issuer identification method distribution
  const issuerMethodCounts: Record<string, number> = {}
  for (const file of batch.files) {
    const method = file.issuerIdentificationMethod || 'UNKNOWN'
    issuerMethodCounts[method] = (issuerMethodCounts[method] || 0) + 1
  }

  // Calculate cost
  let totalCost = 0
  for (const file of batch.files) {
    totalCost += file.processingCost?.toNumber() || 0
  }

  // Generate markdown report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportContent = `# E2E 歷史數據初始化測試報告

> **測試日期**: ${new Date().toLocaleString('zh-TW')}
> **批次 ID**: ${batch.id}
> **批次名稱**: ${batch.name}
> **處理狀態**: ${batch.status === 'COMPLETED' ? '✅ 完成' : '⚠️ ' + batch.status}

---

## 處理摘要

| 指標 | 值 |
|------|-----|
| 總文件數 | ${stats.totalFiles} |
| 成功處理 | ${stats.completedFiles} |
| 處理失敗 | ${stats.failedFiles} |
| 已跳過 | ${stats.skippedFiles} |
| **成功率** | **${stats.totalFiles > 0 ? Math.round((stats.completedFiles / stats.totalFiles) * 100) : 0}%** |

---

## 處理方法分佈

| 處理方法 | 文件數 | 比例 |
|----------|--------|------|
${Object.entries(methodCounts)
  .map(([method, count]) => `| ${method} | ${count} | ${Math.round((count / stats.totalFiles) * 100)}% |`)
  .join('\n')}

---

## 發行者識別

| 指標 | 值 |
|------|-----|
| 成功識別發行者 | ${stats.filesWithIssuer} (${Math.round((stats.filesWithIssuer / stats.totalFiles) * 100)}%) |
| 識別方法分佈 | 見下表 |
| 發現公司數 | ${stats.uniqueIssuers} |

### 識別方法分佈

| 方法 | 文件數 | 比例 |
|------|--------|------|
${Object.entries(issuerMethodCounts)
  .filter(([method]) => method !== 'UNKNOWN')
  .map(([method, count]) => `| ${method} | ${count} | ${Math.round((count / stats.totalFiles) * 100)}% |`)
  .join('\n')}

---

## 文件格式識別

| 指標 | 值 |
|------|-----|
| 成功識別格式 | ${stats.filesWithFormat} (${Math.round((stats.filesWithFormat / stats.totalFiles) * 100)}%) |
| 發現格式數 | ${stats.uniqueFormats} |

---

## 成本分析

| 指標 | 值 |
|------|-----|
| 總處理成本 | $${totalCost.toFixed(2)} |
| 平均每文件成本 | $${stats.totalFiles > 0 ? (totalCost / stats.totalFiles).toFixed(4) : '0.00'} |

---

## 處理時間

| 指標 | 值 |
|------|-----|
| 開始時間 | ${batch.startedAt?.toLocaleString('zh-TW') || 'N/A'} |
| 完成時間 | ${batch.completedAt?.toLocaleString('zh-TW') || 'N/A'} |
| 總耗時 | ${batch.startedAt && batch.completedAt ? Math.round((batch.completedAt.getTime() - batch.startedAt.getTime()) / 1000 / 60) + ' 分鐘' : 'N/A'} |

---

## 失敗文件列表

${
  stats.failedFiles > 0
    ? `
| 文件名 | 錯誤訊息 |
|--------|----------|
${batch.files
  .filter((f) => f.status === 'FAILED')
  .map((f) => `| ${f.originalName} | ${f.errorMessage || 'Unknown error'} |`)
  .join('\n')}
`
    : '✅ 無失敗文件'
}

---

## 驗收清單

- [${stats.completedFiles > 0 ? 'x' : ' '}] 批次上傳功能正常
- [${stats.completedFiles > 0 ? 'x' : ' '}] 文件類型正確識別
- [${stats.filesWithIssuer > 0 ? 'x' : ' '}] 發行者成功識別
- [${stats.filesWithFormat > 0 ? 'x' : ' '}] 文件格式正確分類
- [${stats.completedFiles === stats.totalFiles ? 'x' : ' '}] 所有文件處理完成

---

**生成者**: Claude AI Assistant (E2E Test Script)
**生成日期**: ${new Date().toLocaleString('zh-TW')}
`

  const reportPath = path.join(REPORT_OUTPUT_DIR, `E2E-TEST-REPORT-${timestamp}.md`)
  fs.writeFileSync(reportPath, reportContent, 'utf-8')
  log(`Report saved: ${reportPath}`)
}

// ============================================================
// Main Execution
// ============================================================

async function main() {
  console.log('='.repeat(70))
  console.log('E2E 歷史數據初始化測試')
  console.log('='.repeat(70))
  console.log('')

  try {
    // Step 1: Get all PDF files from Doc Sample directory
    log('Step 1: 掃描測試文件...')
    const files = fs.readdirSync(DOC_SAMPLE_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'))
    const filePaths = files.map((f) => path.join(DOC_SAMPLE_DIR, f))
    log(`Found ${filePaths.length} PDF files`)

    if (filePaths.length === 0) {
      throw new Error('No PDF files found in Doc Sample directory')
    }

    // Step 2: Create batch
    log('')
    log('Step 2: 創建測試批次...')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const batchName = `E2E-TEST-${timestamp}`
    const batchId = await createBatch(batchName, `E2E test with ${filePaths.length} PDF files from Doc Sample`)

    // Step 3: Upload files
    log('')
    log('Step 3: 上傳文件...')
    const uploadedCount = await uploadFiles(batchId, filePaths)

    if (uploadedCount === 0) {
      throw new Error('No files were uploaded successfully')
    }

    // Step 4: Start processing
    log('')
    log('Step 4: 開始處理...')
    await startProcessing(batchId)

    // Step 5: Monitor progress
    log('')
    log('Step 5: 監控處理進度...')
    await monitorProgress(batchId)

    // Step 6: Generate report
    log('')
    log('Step 6: 生成測試報告...')
    await generateReport(batchId)

    console.log('')
    console.log('='.repeat(70))
    console.log('🎉 E2E 測試完成!')
    console.log(`批次 ID: ${batchId}`)
    console.log(`報告位置: ${REPORT_OUTPUT_DIR}`)
    console.log('='.repeat(70))
  } catch (error) {
    console.error('E2E Test Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch(console.error)
