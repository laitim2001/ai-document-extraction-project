/**
 * @fileoverview Exchange Rate 匯率管理相關類型定義
 * @description
 *   定義匯率管理功能所需的 TypeScript 類型，包含：
 *   - ExchangeRate 模型的前端類型
 *   - ISO 4217 貨幣代碼常數
 *   - API 響應類型與轉換結果類型
 *
 * @module src/types/exchange-rate
 * @since Epic 21 - Story 21.1
 * @lastModified 2026-02-05
 *
 * @dependencies
 *   - @prisma/client - ExchangeRate, ExchangeRateSource Prisma 類型
 *
 * @related
 *   - prisma/schema.prisma - ExchangeRate 模型定義
 */

import type {
  ExchangeRate as PrismaExchangeRate,
  ExchangeRateSource,
} from '@prisma/client';

export type { ExchangeRateSource };

/**
 * ExchangeRate 前端類型
 *
 * @description
 *   Prisma 的 Decimal 類型在 JSON 序列化後會變為 string，
 *   前端計算時則需要 number 類型，因此 rate 定義為 number | string。
 */
export interface ExchangeRate extends Omit<PrismaExchangeRate, 'rate'> {
  rate: number | string;
}

/**
 * 常用貨幣列表（ISO 4217）
 *
 * @description APAC 地區常用貨幣代碼，用於下拉選單和驗證
 */
export const COMMON_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
] as const;

/**
 * 貨幣代碼類型
 *
 * @description 從 COMMON_CURRENCIES 常數推導的聯合類型
 */
export type CurrencyCode = (typeof COMMON_CURRENCIES)[number]['code'];

/**
 * 帶關聯資訊的匯率類型
 *
 * @description API 響應中返回的匯率記錄，包含反向匯率資訊
 */
export interface ExchangeRateWithRelations extends ExchangeRate {
  hasInverse: boolean;
  inverseRate?: {
    id: string;
    rate: number;
  };
}

/**
 * 貨幣轉換結果
 *
 * @description 匯率轉換計算的返回結果
 */
export interface ConvertResult {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  rate: number;
  path: 'direct' | 'inverse' | string; // cross:XXX→USD→YYY
  rateId?: string;
  rateIds?: string[];
  effectiveYear: number;
}

/**
 * 批次匯率查詢結果
 *
 * @description 一次查詢多個貨幣對的匯率
 */
export interface BatchRateResult {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  path: string;
  found: boolean;
  rateId?: string;
}
