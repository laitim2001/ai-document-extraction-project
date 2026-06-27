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

/**
 * 標籤對照的正規化形式
 *
 * @description
 *   將欄位 label / lineItem 的 classifiedAs / alias 轉為統一的對照鍵，
 *   用於 CHANGE-094 的確定性費用回填。與 {@link normalizeClassifiedAs} 不同，
 *   此函數產出全小寫、去標點的形式，專供「相等 / 子字串」比對使用（非顯示用）。
 *
 * 轉換規則：
 *   1. 全部轉小寫
 *   2. 底線 `_`、連字號 `-` 與其他非字母數字字符替換為空格
 *   3. 壓縮連續空白、去除首尾空白
 *
 * @param value - 原始標籤字串
 * @returns 正規化後的對照鍵（如 `"Origin THC - Terminal Handling Charge"` → `"origin thc terminal handling charge"`）
 * @since CHANGE-094
 */
export function canonicalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * 標籤對照結果種類
 * @since CHANGE-094
 */
export type LabelMatchKind = 'exact' | 'substring' | null;

/**
 * 判定候選字串與目標標籤的對照種類
 *
 * @description
 *   CHANGE-094 確定性回填的核心對照函數。比對 lineItem 的 `classifiedAs`
 *   （候選）與 field definition 的 `label` / `aliases`（目標）：
 *   - 正規化後完全相等 → `'exact'`
 *   - 較短一方為較長一方的子字串，且較短一方足夠長（≥ 8 字元且 ≥ 2 詞，
 *     避免 `"Fee"` / `"Charge"` 等通用短詞誤命中）→ `'substring'`
 *   - 其餘 → `null`
 *
 *   子字串對照刻意保守：呼叫端（回填）會在「多個目標皆子字串命中」時
 *   視為歧義並跳過，確保寧可不填、不可填錯。
 *
 * @param candidate - 候選字串（通常為 lineItem.classifiedAs）
 * @param target - 目標標籤（field def 的 label 或某個 alias）
 * @returns 對照種類
 * @since CHANGE-094
 */
export function matchLabel(candidate: string, target: string): LabelMatchKind {
  const a = canonicalizeLabel(candidate);
  const b = canonicalizeLabel(target);
  if (!a || !b) return null;
  if (a === b) return 'exact';

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  const isWordBounded = longer === shorter
    || longer.includes(` ${shorter} `)
    || longer.startsWith(`${shorter} `)
    || longer.endsWith(` ${shorter}`);
  if (isWordBounded && shorter.length >= 8 && shorter.split(' ').length >= 2) {
    return 'substring';
  }
  return null;
}
