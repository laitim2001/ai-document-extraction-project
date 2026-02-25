/**
 * @fileoverview classifiedAs 值正規化工具
 * @description
 *   將 GPT 輸出的 category/classifiedAs 值正規化為一致的 Title Case 格式。
 *   解決 GPT 輸出格式不一致的問題（底線、連字號、大小寫差異）。
 *
 * @module src/services/extraction-v3/utils/classify-normalizer
 * @since CHANGE-046
 * @lastModified 2026-02-25
 *
 * @example
 * ```typescript
 * normalizeClassifiedAs('Terminal_Handling_Charge')  // → 'Terminal Handling Charge'
 * normalizeClassifiedAs('cleaning-at-destination')   // → 'Cleaning At Destination'
 * normalizeClassifiedAs('FREIGHT CHARGES')           // → 'Freight Charges'
 * normalizeClassifiedAs('Delivery Order Fee')        // → 'Delivery Order Fee'
 * ```
 */

/**
 * 正規化 classifiedAs 值為 Title Case 格式
 *
 * @description
 *   GPT 輸出的 category 可能使用不同格式（底線、連字號、全大寫等），
 *   而用戶在 UI 配置的 filter 使用自然語言格式（空格分隔 Title Case）。
 *   此函數確保所有 classifiedAs 值統一為 Title Case 格式。
 *
 * 轉換規則：
 *   1. 底線 `_` 和連字號 `-` 替換為空格
 *   2. 去除首尾空白、壓縮連續空白
 *   3. 每個單詞首字母大寫、其餘小寫（Title Case）
 *
 * @param value - 原始 classifiedAs 值
 * @returns 正規化後的 Title Case 字串
 */
export function normalizeClassifiedAs(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
