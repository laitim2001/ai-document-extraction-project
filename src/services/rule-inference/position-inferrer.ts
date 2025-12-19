/**
 * @fileoverview 位置模式推斷器
 * @description
 *   根據文件中的位置資訊（邊界框）推斷位置提取規則。
 *   當多個樣本在文件中具有相似的位置時，可以使用位置規則進行提取。
 *
 * @module src/services/rule-inference/position-inferrer
 * @since Epic 4 - Story 4.4 (規則升級建議生成)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 邊界框聚類分析
 *   - 相對位置計算
 *   - 區域定義生成
 *
 * @dependencies
 *   - @/types/suggestion - InferredRule, CorrectionSample 類型
 */

import { InferredRule, CorrectionSample } from '@/types/suggestion'

// ============================================================
// Types
// ============================================================

/**
 * 邊界框
 */
interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 位置規則配置
 */
interface PositionConfig {
  type: 'position'
  region: {
    x: { min: number; max: number }
    y: { min: number; max: number }
    page?: number
  }
  anchor?: {
    text: string
    direction: 'below' | 'right' | 'above' | 'left'
    distance: number
  }
}

// ============================================================
// Main Function
// ============================================================

/**
 * 位置模式推斷
 *
 * @description
 *   根據樣本的邊界框資訊推斷位置提取規則。
 *   需要至少 2 個具有位置資訊的樣本。
 *
 * @param samples - 修正樣本陣列（必須包含 context.boundingBox）
 * @returns 推斷的規則，若無法推斷則返回 null
 *
 * @example
 * ```typescript
 * const samples = [
 *   {
 *     originalValue: 'INV-123',
 *     correctedValue: 'INV123',
 *     context: { boundingBox: { x: 100, y: 200, width: 50, height: 20 } }
 *   },
 *   // ...
 * ];
 * const result = await inferPositionPattern(samples);
 * ```
 */
export async function inferPositionPattern(
  samples: CorrectionSample[]
): Promise<InferredRule | null> {
  // 過濾出有邊界框資訊的樣本
  const samplesWithBox = samples.filter(
    (s) => s.context?.boundingBox && isValidBoundingBox(s.context.boundingBox)
  )

  if (samplesWithBox.length < 2) {
    return null
  }

  // 提取邊界框
  const boundingBoxes = samplesWithBox.map((s) => s.context!.boundingBox!)

  // 計算邊界框的統計資訊
  const stats = calculateBoundingBoxStats(boundingBoxes)

  // 檢查位置一致性
  if (!isPositionConsistent(stats)) {
    return null
  }

  // 生成位置規則
  const config = generatePositionConfig(stats, samplesWithBox)

  return {
    type: 'POSITION',
    pattern: JSON.stringify(config),
    confidence: calculatePositionConfidence(stats),
    explanation: generateExplanation(stats),
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 驗證邊界框是否有效
 */
function isValidBoundingBox(box: BoundingBox): boolean {
  return (
    typeof box.x === 'number' &&
    typeof box.y === 'number' &&
    typeof box.width === 'number' &&
    typeof box.height === 'number' &&
    box.width > 0 &&
    box.height > 0
  )
}

/**
 * 邊界框統計資訊
 */
interface BoundingBoxStats {
  x: { min: number; max: number; mean: number; std: number }
  y: { min: number; max: number; mean: number; std: number }
  width: { min: number; max: number; mean: number; std: number }
  height: { min: number; max: number; mean: number; std: number }
  count: number
}

/**
 * 計算邊界框統計資訊
 */
function calculateBoundingBoxStats(boxes: BoundingBox[]): BoundingBoxStats {
  const n = boxes.length

  const xValues = boxes.map((b) => b.x)
  const yValues = boxes.map((b) => b.y)
  const widthValues = boxes.map((b) => b.width)
  const heightValues = boxes.map((b) => b.height)

  return {
    x: calculateStats(xValues),
    y: calculateStats(yValues),
    width: calculateStats(widthValues),
    height: calculateStats(heightValues),
    count: n,
  }
}

/**
 * 計算數值統計
 */
function calculateStats(values: number[]): {
  min: number
  max: number
  mean: number
  std: number
} {
  const n = values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  const mean = values.reduce((sum, v) => sum + v, 0) / n
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n
  const std = Math.sqrt(variance)

  return { min, max, mean, std }
}

/**
 * 檢查位置是否一致
 *
 * @description
 *   當 X 和 Y 座標的變異係數（CV）都小於閾值時，認為位置一致。
 *   CV = std / mean，表示相對變異程度。
 */
function isPositionConsistent(stats: BoundingBoxStats): boolean {
  // 計算變異係數（CV = std / mean）
  const xCV = stats.x.mean > 0 ? stats.x.std / stats.x.mean : 0
  const yCV = stats.y.mean > 0 ? stats.y.std / stats.y.mean : 0

  // 當 CV 小於 0.2 時認為位置一致
  const threshold = 0.2

  return xCV < threshold && yCV < threshold
}

/**
 * 計算位置信心度
 */
function calculatePositionConfidence(stats: BoundingBoxStats): number {
  // 基於變異係數計算信心度
  const xCV = stats.x.mean > 0 ? stats.x.std / stats.x.mean : 0
  const yCV = stats.y.mean > 0 ? stats.y.std / stats.y.mean : 0

  // CV 越小，信心度越高
  const xConfidence = Math.max(0, 1 - xCV * 5)
  const yConfidence = Math.max(0, 1 - yCV * 5)

  // 樣本數量也影響信心度
  const sampleConfidence = Math.min(1, stats.count / 5)

  return (xConfidence + yConfidence) / 2 * sampleConfidence * 0.8
}

/**
 * 生成位置規則配置
 */
function generatePositionConfig(
  stats: BoundingBoxStats,
  samples: CorrectionSample[]
): PositionConfig {
  // 使用平均值加減標準差作為區域範圍
  const margin = 1.5 // 1.5 倍標準差

  const config: PositionConfig = {
    type: 'position',
    region: {
      x: {
        min: Math.max(0, stats.x.mean - stats.x.std * margin),
        max: stats.x.mean + stats.x.std * margin + stats.width.mean,
      },
      y: {
        min: Math.max(0, stats.y.mean - stats.y.std * margin),
        max: stats.y.mean + stats.y.std * margin + stats.height.mean,
      },
    },
  }

  // 如果有頁碼資訊，添加頁碼限制
  const pageNumbers = samples
    .map((s) => s.context?.pageNumber)
    .filter((p): p is number => typeof p === 'number')

  if (pageNumbers.length > 0) {
    const uniquePages = [...new Set(pageNumbers)]
    if (uniquePages.length === 1) {
      config.region.page = uniquePages[0]
    }
  }

  // 嘗試找出錨點（如果有周圍文字資訊）
  const anchor = findAnchor(samples)
  if (anchor) {
    config.anchor = anchor
  }

  return config
}

/**
 * 嘗試找出錨點
 */
function findAnchor(
  samples: CorrectionSample[]
): PositionConfig['anchor'] | undefined {
  // 檢查是否有周圍文字資訊
  const surroundingTexts = samples
    .map((s) => s.context?.surroundingText)
    .filter((t): t is string => typeof t === 'string' && t.length > 0)

  if (surroundingTexts.length < 2) {
    return undefined
  }

  // 找出共同的前綴或標籤
  const commonPrefix = findCommonPrefix(surroundingTexts)

  if (commonPrefix && commonPrefix.length >= 3) {
    return {
      text: commonPrefix.trim(),
      direction: 'right', // 假設值在標籤右邊
      distance: 10, // 預設距離
    }
  }

  return undefined
}

/**
 * 找出字串陣列的共同前綴
 */
function findCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return ''

  let prefix = strings[0]
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1)
      if (prefix.length === 0) return ''
    }
  }

  return prefix
}

/**
 * 生成解釋說明
 */
function generateExplanation(stats: BoundingBoxStats): string {
  const xRange = `X: ${Math.round(stats.x.min)}-${Math.round(stats.x.max + stats.width.mean)}`
  const yRange = `Y: ${Math.round(stats.y.min)}-${Math.round(stats.y.max + stats.height.mean)}`

  return `位置規則（區域 ${xRange}, ${yRange}，基於 ${stats.count} 個樣本）`
}
