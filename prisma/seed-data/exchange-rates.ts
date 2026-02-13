/**
 * @fileoverview ExchangeRate Seed 數據
 * @description
 *   提供主要貨幣兌 USD 的基礎匯率資料（8 對正向 + 8 對反向 = 16 筆記錄），
 *   確保 V3.1 管線中的匯率轉換步驟有基礎資料可用。
 *
 *   匯率為 2026 年度參考值，部署後應透過 Admin UI 更新為最新匯率。
 *
 * @module prisma/seed-data/exchange-rates
 * @since CHANGE-039
 * @lastModified 2026-02-13
 */

export interface ExchangeRateSeed {
  fromCurrency: string
  toCurrency: string
  rate: number
  effectiveYear: number
  source: string
  description: string
}

/**
 * 生成正向和反向匯率對
 *
 * @param fromCurrency - 來源貨幣
 * @param toCurrency - 目標貨幣
 * @param rate - 匯率（1 fromCurrency = rate toCurrency）
 * @param description - 匯率說明
 * @returns 正向和反向匯率 seed
 */
function createRatePair(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  description: string
): [ExchangeRateSeed, ExchangeRateSeed] {
  const inverseRate = parseFloat((1 / rate).toFixed(8))

  return [
    {
      fromCurrency,
      toCurrency,
      rate,
      effectiveYear: 2026,
      source: 'MANUAL',
      description,
    },
    {
      fromCurrency: toCurrency,
      toCurrency: fromCurrency,
      rate: inverseRate,
      effectiveYear: 2026,
      source: 'AUTO_INVERSE',
      description: `${description} (inverse)`,
    },
  ]
}

/**
 * 8 對主要貨幣匯率（正向 + 反向 = 16 筆記錄）
 *
 * 基礎匯率為 2026 年度參考值：
 * - USD → TWD: 32.50
 * - USD → HKD: 7.82
 * - USD → SGD: 1.35
 * - USD → JPY: 155.00
 * - USD → CNY: 7.25
 * - USD → EUR: 0.92
 * - USD → GBP: 0.79
 * - USD → AUD: 1.55
 */
export const EXCHANGE_RATE_SEEDS: ExchangeRateSeed[] = [
  ...createRatePair('USD', 'TWD', 32.50, 'USD to TWD - 2026 reference rate'),
  ...createRatePair('USD', 'HKD', 7.82, 'USD to HKD - 2026 reference rate'),
  ...createRatePair('USD', 'SGD', 1.35, 'USD to SGD - 2026 reference rate'),
  ...createRatePair('USD', 'JPY', 155.00, 'USD to JPY - 2026 reference rate'),
  ...createRatePair('USD', 'CNY', 7.25, 'USD to CNY - 2026 reference rate'),
  ...createRatePair('USD', 'EUR', 0.92, 'USD to EUR - 2026 reference rate'),
  ...createRatePair('USD', 'GBP', 0.79, 'USD to GBP - 2026 reference rate'),
  ...createRatePair('USD', 'AUD', 1.55, 'USD to AUD - 2026 reference rate'),
]
