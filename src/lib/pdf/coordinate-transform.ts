/**
 * @fileoverview PDF 座標轉換工具
 * @description
 *   提供 PDF 座標系統與螢幕座標系統之間的轉換功能。
 *   - PDF 座標: 原點在左下角，Y 軸向上增加
 *   - 螢幕座標: 原點在左上角，Y 軸向下增加
 *
 * @module src/lib/pdf
 * @since Epic 13 - Story 13.1 (文件預覽組件與欄位高亮)
 * @lastModified 2025-01-02
 *
 * @features
 *   - PDF 座標 → 螢幕座標轉換
 *   - 支援縮放倍率調整
 *   - 批次轉換多個座標框
 *
 * @dependencies
 *   - 無外部依賴
 */

// ============================================================
// Types
// ============================================================

/**
 * PDF 原始座標 (左下角為原點)
 */
export interface PDFCoordinate {
  /** X 座標 (PDF 單位) */
  x: number
  /** Y 座標 (PDF 單位，從底部算起) */
  y: number
  /** 寬度 (PDF 單位) */
  width: number
  /** 高度 (PDF 單位) */
  height: number
}

/**
 * 螢幕座標 (左上角為原點)
 */
export interface ScreenCoordinate {
  /** 左邊界距離 (像素) */
  left: number
  /** 上邊界距離 (像素) */
  top: number
  /** 寬度 (像素) */
  width: number
  /** 高度 (像素) */
  height: number
}

/**
 * PDF 頁面尺寸資訊
 */
export interface PageDimensions {
  /** 頁面寬度 (PDF 單位) */
  width: number
  /** 頁面高度 (PDF 單位) */
  height: number
}

/**
 * 欄位邊界框資訊 (用於高亮顯示)
 */
export interface BoundingBox {
  /** 欄位唯一識別碼 */
  fieldId: string
  /** 欄位名稱 */
  fieldName: string
  /** 所在頁碼 (1-based) */
  page: number
  /** X 座標 (PDF 單位) */
  x: number
  /** Y 座標 (PDF 單位) */
  y: number
  /** 寬度 (PDF 單位) */
  width: number
  /** 高度 (PDF 單位) */
  height: number
  /** 信心度分數 (0-100) */
  confidence: number
}

/**
 * 轉換後的螢幕邊界框
 */
export interface ScreenBoundingBox {
  /** 欄位唯一識別碼 */
  fieldId: string
  /** 欄位名稱 */
  fieldName: string
  /** 所在頁碼 (1-based) */
  page: number
  /** 螢幕座標資訊 */
  rect: ScreenCoordinate
  /** 信心度分數 (0-100) */
  confidence: number
}

// ============================================================
// Constants
// ============================================================

/** 預設 PDF DPI (每英吋點數) */
export const DEFAULT_PDF_DPI = 72

/** 預設渲染縮放倍率 */
export const DEFAULT_SCALE = 1.0

/** 信心度門檻 - 高信心度 (自動通過) */
export const CONFIDENCE_HIGH = 90

/** 信心度門檻 - 中等信心度 (快速審核) */
export const CONFIDENCE_MEDIUM = 70

// ============================================================
// Coordinate Transform Functions
// ============================================================

/**
 * 將 PDF 座標轉換為螢幕座標
 *
 * @description
 *   PDF 使用左下角為原點的座標系統，而螢幕使用左上角為原點。
 *   此函數執行以下轉換:
 *   1. 翻轉 Y 軸 (從底部算起 → 從頂部算起)
 *   2. 應用縮放倍率
 *
 * @param pdfCoord - PDF 座標
 * @param pageDimensions - 頁面尺寸
 * @param scale - 縮放倍率 (預設 1.0)
 * @returns 螢幕座標
 *
 * @example
 * ```typescript
 * const screenCoord = pdfToScreenCoordinate(
 *   { x: 100, y: 700, width: 200, height: 20 },
 *   { width: 612, height: 792 },
 *   1.5
 * );
 * // 結果: { left: 150, top: 108, width: 300, height: 30 }
 * ```
 */
export function pdfToScreenCoordinate(
  pdfCoord: PDFCoordinate,
  pageDimensions: PageDimensions,
  scale: number = DEFAULT_SCALE
): ScreenCoordinate {
  // PDF Y 座標是從底部算起，需要翻轉到從頂部算起
  // 新的 top = 頁面高度 - (原始 y + 高度)
  const screenTop = pageDimensions.height - (pdfCoord.y + pdfCoord.height)

  return {
    left: pdfCoord.x * scale,
    top: screenTop * scale,
    width: pdfCoord.width * scale,
    height: pdfCoord.height * scale,
  }
}

/**
 * 將螢幕座標轉換回 PDF 座標
 *
 * @description 螢幕座標轉換為 PDF 座標 (逆向轉換)
 *
 * @param screenCoord - 螢幕座標
 * @param pageDimensions - 頁面尺寸
 * @param scale - 縮放倍率 (預設 1.0)
 * @returns PDF 座標
 */
export function screenToPdfCoordinate(
  screenCoord: ScreenCoordinate,
  pageDimensions: PageDimensions,
  scale: number = DEFAULT_SCALE
): PDFCoordinate {
  // 先還原縮放
  const unscaledLeft = screenCoord.left / scale
  const unscaledTop = screenCoord.top / scale
  const unscaledWidth = screenCoord.width / scale
  const unscaledHeight = screenCoord.height / scale

  // 翻轉 Y 軸回到 PDF 座標系統
  const pdfY = pageDimensions.height - unscaledTop - unscaledHeight

  return {
    x: unscaledLeft,
    y: pdfY,
    width: unscaledWidth,
    height: unscaledHeight,
  }
}

/**
 * 批次轉換多個邊界框
 *
 * @description
 *   將多個 BoundingBox 轉換為 ScreenBoundingBox，
 *   可選擇性過濾特定頁面的邊界框。
 *
 * @param boxes - 邊界框陣列
 * @param pageDimensions - 頁面尺寸
 * @param scale - 縮放倍率
 * @param filterPage - 可選，僅返回指定頁碼的邊界框
 * @returns 轉換後的螢幕邊界框陣列
 *
 * @example
 * ```typescript
 * const screenBoxes = transformBoundingBoxes(
 *   boundingBoxes,
 *   { width: 612, height: 792 },
 *   1.5,
 *   1 // 僅返回第 1 頁的邊界框
 * );
 * ```
 */
export function transformBoundingBoxes(
  boxes: BoundingBox[],
  pageDimensions: PageDimensions,
  scale: number = DEFAULT_SCALE,
  filterPage?: number
): ScreenBoundingBox[] {
  const filteredBoxes = filterPage
    ? boxes.filter((box) => box.page === filterPage)
    : boxes

  return filteredBoxes.map((box) => ({
    fieldId: box.fieldId,
    fieldName: box.fieldName,
    page: box.page,
    rect: pdfToScreenCoordinate(
      { x: box.x, y: box.y, width: box.width, height: box.height },
      pageDimensions,
      scale
    ),
    confidence: box.confidence,
  }))
}

// ============================================================
// Confidence Level Utilities
// ============================================================

/**
 * 信心度等級
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low'

/**
 * 根據信心度分數判斷等級
 *
 * @param confidence - 信心度分數 (0-100)
 * @returns 信心度等級
 *
 * @example
 * ```typescript
 * getConfidenceLevel(95); // 'high'
 * getConfidenceLevel(80); // 'medium'
 * getConfidenceLevel(50); // 'low'
 * ```
 */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_HIGH) {
    return 'high'
  } else if (confidence >= CONFIDENCE_MEDIUM) {
    return 'medium'
  }
  return 'low'
}

/**
 * 信心度等級對應的顏色
 */
export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: 'rgba(34, 197, 94, 0.3)', // green-500 with opacity
  medium: 'rgba(234, 179, 8, 0.3)', // yellow-500 with opacity
  low: 'rgba(239, 68, 68, 0.3)', // red-500 with opacity
}

/**
 * 信心度等級對應的邊框顏色
 */
export const CONFIDENCE_BORDER_COLORS: Record<ConfidenceLevel, string> = {
  high: 'rgb(34, 197, 94)', // green-500
  medium: 'rgb(234, 179, 8)', // yellow-500
  low: 'rgb(239, 68, 68)', // red-500
}

/**
 * 根據信心度分數獲取顏色
 *
 * @param confidence - 信心度分數 (0-100)
 * @returns 背景顏色和邊框顏色
 */
export function getConfidenceColors(confidence: number): {
  backgroundColor: string
  borderColor: string
} {
  const level = getConfidenceLevel(confidence)
  return {
    backgroundColor: CONFIDENCE_COLORS[level],
    borderColor: CONFIDENCE_BORDER_COLORS[level],
  }
}

// ============================================================
// Validation Utilities
// ============================================================

/**
 * 驗證邊界框是否有效
 *
 * @param box - 邊界框
 * @returns 是否為有效的邊界框
 */
export function isValidBoundingBox(box: BoundingBox): boolean {
  return (
    typeof box.fieldId === 'string' &&
    box.fieldId.length > 0 &&
    typeof box.page === 'number' &&
    box.page >= 1 &&
    typeof box.x === 'number' &&
    box.x >= 0 &&
    typeof box.y === 'number' &&
    box.y >= 0 &&
    typeof box.width === 'number' &&
    box.width > 0 &&
    typeof box.height === 'number' &&
    box.height > 0 &&
    typeof box.confidence === 'number' &&
    box.confidence >= 0 &&
    box.confidence <= 100
  )
}

/**
 * 過濾出有效的邊界框
 *
 * @param boxes - 邊界框陣列
 * @returns 有效的邊界框陣列
 */
export function filterValidBoundingBoxes(boxes: BoundingBox[]): BoundingBox[] {
  return boxes.filter(isValidBoundingBox)
}
