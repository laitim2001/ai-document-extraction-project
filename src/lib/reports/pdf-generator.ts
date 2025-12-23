/**
 * @fileoverview PDF 報告生成器
 * @description
 *   生成規則測試結果的 PDF 報告，包含：
 *   - 基本測試資訊
 *   - 測試結果摘要統計
 *   - 決策建議
 *   - 測試詳情列表（前 50 筆）
 *
 * @module src/lib/reports/pdf-generator
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @dependencies
 *   - pdfkit - PDF 生成庫
 *   - @prisma/client - TestChangeType enum
 */

import PDFDocument from 'pdfkit'
import type { TestChangeType } from '@prisma/client'

// ============================================================
// Types
// ============================================================

/**
 * 報告數據結構
 */
export interface ReportData {
  /** 測試任務資訊 */
  task: {
    id: string
    rule: {
      fieldName: string
      extractionType: string
    }
    /** Company 資訊 (REFACTOR-001: 原 forwarder) */
    company: {
      name: string
      code: string | null
    }
    totalDocuments: number
    startedAt: Date | null
    completedAt: Date | null
  }
  /** 測試結果摘要 */
  results: {
    improved: number
    regressed: number
    unchanged: number
    bothWrong: number
    bothRight: number
    improvementRate: number
    regressionRate: number
    netImprovement: number
  }
  /** 測試詳情列表 */
  details: {
    document: { fileName: string }
    originalResult: string | null
    originalConfidence: number | null
    testResult: string | null
    testConfidence: number | null
    actualValue: string | null
    changeType: TestChangeType
  }[]
  /** 報告產生時間 */
  generatedAt: Date
  /** 報告產生者 */
  generatedBy: string
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 根據測試結果生成決策建議
 *
 * @param results - 測試結果摘要
 * @returns 決策建議文字
 */
function generateRecommendation(results: ReportData['results']): string {
  const { improvementRate, regressionRate, netImprovement, regressed } = results

  if (regressed > 0 && regressionRate > 0.05) {
    return `不建議採用此變更。惡化案例達 ${regressed} 筆 (${(regressionRate * 100).toFixed(1)}%)，超過 5% 閾值。建議重新檢視規則 Pattern 或增加更多測試案例。`
  }

  if (netImprovement > 0 && regressionRate <= 0.02) {
    return `建議採用此變更。淨改善 ${netImprovement} 筆，惡化率 ${(regressionRate * 100).toFixed(1)}% 在可接受範圍內。`
  }

  if (netImprovement <= 0) {
    return `此變更無明顯改善效果 (淨改善: ${netImprovement})。建議重新評估變更的必要性。`
  }

  return `變更效果中等。改善率 ${(improvementRate * 100).toFixed(1)}%，惡化率 ${(regressionRate * 100).toFixed(1)}%。建議根據實際業務需求決定是否採用。`
}

/**
 * 取得變更類型的標籤
 *
 * @param type - 變更類型
 * @returns 變更類型標籤
 */
function getChangeTypeLabel(type: TestChangeType): string {
  const labels: Record<TestChangeType, string> = {
    IMPROVED: '改善',
    REGRESSED: '惡化',
    BOTH_RIGHT: '都對',
    BOTH_WRONG: '都錯',
    UNCHANGED: '無變化',
  }
  return labels[type]
}

/**
 * 格式化日期為台灣格式
 *
 * @param date - 日期物件
 * @returns 格式化後的日期字串
 */
function formatDate(date: Date | null): string {
  if (!date) return 'N/A'
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// ============================================================
// Main Export
// ============================================================

/**
 * 生成 PDF 測試報告
 *
 * @description
 *   使用 pdfkit 生成包含測試結果摘要和詳情的 PDF 報告。
 *   報告包含：
 *   1. 標題頁 - 基本測試資訊
 *   2. 結果摘要 - 改善/惡化統計
 *   3. 決策建議 - 根據結果自動生成
 *   4. 測試詳情 - 前 50 筆測試結果
 *
 * @param data - 報告數據
 * @returns PDF Buffer
 *
 * @example
 *   const pdfBuffer = await generatePDFReport({
 *     task: { id: '...', rule: {...}, forwarder: {...}, ... },
 *     results: { improved: 10, regressed: 2, ... },
 *     details: [...],
 *     generatedAt: new Date(),
 *     generatedBy: 'User Name'
 *   });
 */
export async function generatePDFReport(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ========================================
    // 標題
    // ========================================
    doc.fontSize(20).text('規則測試報告', { align: 'center' })
    doc.moveDown()

    // ========================================
    // 基本資訊
    // ========================================
    doc.fontSize(14).text('基本資訊', { underline: true })
    doc.fontSize(10)
    doc.text(
      `Company: ${data.task.company.name}${data.task.company.code ? ` (${data.task.company.code})` : ''}`
    )
    doc.text(`欄位名稱: ${data.task.rule.fieldName}`)
    doc.text(`提取類型: ${data.task.rule.extractionType}`)
    doc.text(`測試文件數: ${data.task.totalDocuments}`)
    doc.text(`開始時間: ${formatDate(data.task.startedAt)}`)
    doc.text(`完成時間: ${formatDate(data.task.completedAt)}`)
    doc.moveDown()

    // ========================================
    // 測試結果摘要
    // ========================================
    doc.fontSize(14).text('測試結果摘要', { underline: true })
    doc.fontSize(10)
    doc.text(
      `改善 (原錯→新對): ${data.results.improved} (${(data.results.improvementRate * 100).toFixed(1)}%)`
    )
    doc.text(
      `惡化 (原對→新錯): ${data.results.regressed} (${(data.results.regressionRate * 100).toFixed(1)}%)`
    )
    doc.text(`都對: ${data.results.bothRight}`)
    doc.text(`都錯: ${data.results.bothWrong}`)
    doc.text(`無變化: ${data.results.unchanged}`)
    doc.text(`淨改善: ${data.results.netImprovement}`)
    doc.moveDown()

    // ========================================
    // 決策建議
    // ========================================
    doc.fontSize(14).text('決策建議', { underline: true })
    doc.fontSize(10)
    const recommendation = generateRecommendation(data.results)
    doc.text(recommendation)
    doc.moveDown()

    // ========================================
    // 測試詳情（前 50 筆）
    // ========================================
    if (data.details.length > 0) {
      doc.addPage()
      doc.fontSize(14).text('測試詳情 (前 50 筆)', { underline: true })
      doc.fontSize(8)

      const detailsToShow = data.details.slice(0, 50)
      detailsToShow.forEach((detail, index) => {
        const changeLabel = getChangeTypeLabel(detail.changeType)
        doc.text(`${index + 1}. ${detail.document.fileName}`)
        doc.text(
          `   原結果: ${detail.originalResult ?? '(無)'} | 新結果: ${detail.testResult ?? '(無)'}`
        )
        doc.text(
          `   實際值: ${detail.actualValue ?? '(無)'} | 變化: ${changeLabel}`
        )
        doc.moveDown(0.5)
      })
    }

    // ========================================
    // 頁腳
    // ========================================
    doc.fontSize(8)
    doc.text(`報告產生時間: ${formatDate(data.generatedAt)}`, { align: 'right' })
    doc.text(`產生者: ${data.generatedBy}`, { align: 'right' })

    doc.end()
  })
}
