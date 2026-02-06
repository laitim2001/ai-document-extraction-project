/**
 * @fileoverview Exchange Rate 匯率管理服務層
 * @description
 *   提供 Exchange Rate 的 CRUD 操作和轉換邏輯功能。
 *
 *   主要功能：
 *   - getExchangeRates: 分頁列表查詢（支援篩選、排序）
 *   - getExchangeRateById: 單一記錄查詢（含反向匯率資訊）
 *   - createExchangeRate: 建立記錄（含可選自動反向匯率）
 *   - updateExchangeRate: 更新記錄（只更新提供的欄位）
 *   - deleteExchangeRate: 刪除記錄（含自動刪除反向記錄）
 *   - toggleExchangeRate: 切換啟用/停用狀態
 *   - convert: 匯率轉換計算（含 Fallback: direct → inverse → cross）
 *   - batchGetRates: 批次查詢多個貨幣對匯率
 *   - exportExchangeRates: 導出匯率資料為 JSON（Story 21-5）
 *   - importExchangeRates: 批次導入匯率資料（Story 21-5）
 *
 *   設計決策：
 *   - 自動反向匯率：建立時可選 createInverse，使用 transaction 確保一致性
 *   - Convert Fallback: direct → inverse → cross(USD) → error
 *   - 刪除級聯：刪除記錄時同時刪除以此為來源的反向記錄
 *   - 唯一約束：(fromCurrency, toCurrency, effectiveYear) 組合唯一
 *
 * @module src/services/exchange-rate.service
 * @since Epic 21 - Story 21.2
 * @lastModified 2026-02-06
 *
 * @dependencies
 *   - prisma - 資料庫 ORM
 *
 * @related
 *   - src/lib/validations/exchange-rate.schema.ts - 驗證 Schema
 *   - src/types/exchange-rate.ts - 類型定義
 *   - prisma/schema.prisma - ExchangeRate 模型定義
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type {
  CreateExchangeRateInput,
  UpdateExchangeRateInput,
  GetExchangeRatesQuery,
  ExportExchangeRatesQuery,
  ImportExchangeRatesInput,
} from '@/lib/validations/exchange-rate.schema';
import type { ConvertResult, BatchRateResult } from '@/types/exchange-rate';

// ============================================================================
// Types
// ============================================================================

/**
 * Exchange Rate 列表項目
 *
 * @description 列表查詢返回的格式化項目，rate 轉為 number，日期轉為 ISO string
 */
export interface ExchangeRateListItem {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveYear: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  source: string;
  inverseOfId: string | null;
  description: string | null;
  createdById: string | null;
  hasInverse: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Exchange Rate 詳情
 *
 * @description 單一記錄查詢返回，包含反向匯率資訊
 */
export interface ExchangeRateDetail extends ExchangeRateListItem {
  inverseRate?: {
    id: string;
    rate: number;
  };
}

/**
 * 分頁資訊
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * 列表查詢結果
 */
export interface ExchangeRateListResult {
  items: ExchangeRateListItem[];
  pagination: PaginationInfo;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 格式化日期為 ISO 字串
 */
function formatDate(date: Date | null | undefined): string | null {
  return date?.toISOString() ?? null;
}

/**
 * 查找直接匯率記錄
 *
 * @description 在資料庫中查找指定貨幣對和年份的啟用匯率
 * @param from - 來源貨幣代碼
 * @param to - 目標貨幣代碼
 * @param year - 生效年份
 * @returns 匯率記錄（含 id 和 rate）或 null
 */
async function findDirectRate(
  from: string,
  to: string,
  year: number
): Promise<{ id: string; rate: number } | null> {
  const item = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency: from,
      toCurrency: to,
      effectiveYear: year,
      isActive: true,
    },
    select: { id: true, rate: true },
  });

  if (!item) return null;

  return {
    id: item.id,
    rate: item.rate.toNumber(),
  };
}

/**
 * 查找匯率（含反向）
 *
 * @description 先查找直接匯率，未找到再查找反向匯率並計算 1/rate
 * @param from - 來源貨幣代碼
 * @param to - 目標貨幣代碼
 * @param year - 生效年份
 * @returns 匯率資訊（含 id 和 rate）或 null
 */
async function findRate(
  from: string,
  to: string,
  year: number
): Promise<{ id: string; rate: number } | null> {
  const direct = await findDirectRate(from, to, year);
  if (direct) return direct;

  const inverse = await findDirectRate(to, from, year);
  if (inverse) {
    return {
      id: inverse.id,
      rate: 1 / inverse.rate,
    };
  }

  return null;
}

// ============================================================================
// List
// ============================================================================

/**
 * 查詢 Exchange Rate 列表
 *
 * @description 支援分頁、篩選（year, fromCurrency, toCurrency, isActive, source）、排序
 * @param query - 查詢參數
 * @returns 列表結果（含分頁資訊）
 */
export async function getExchangeRates(
  query: GetExchangeRatesQuery
): Promise<ExchangeRateListResult> {
  const {
    page,
    limit,
    year,
    fromCurrency,
    toCurrency,
    isActive,
    source,
    sortBy,
    sortOrder,
  } = query;

  const where: Prisma.ExchangeRateWhereInput = {};

  if (year !== undefined) {
    where.effectiveYear = year;
  }
  if (fromCurrency) {
    where.fromCurrency = fromCurrency;
  }
  if (toCurrency) {
    where.toCurrency = toCurrency;
  }
  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (source) {
    where.source = source;
  }

  const [items, total] = await Promise.all([
    prisma.exchangeRate.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.exchangeRate.count({ where }),
  ]);

  // 批次檢查每筆記錄是否有反向記錄
  const inverseOfIds = items.map((item) => item.id);
  const inverseCounts = await prisma.exchangeRate.groupBy({
    by: ['inverseOfId'],
    where: {
      inverseOfId: { in: inverseOfIds },
    },
    _count: { id: true },
  });
  const inverseCountMap = new Map(
    inverseCounts.map((c) => [c.inverseOfId, c._count.id])
  );

  const formattedItems: ExchangeRateListItem[] = items.map((item) => ({
    id: item.id,
    fromCurrency: item.fromCurrency,
    toCurrency: item.toCurrency,
    rate: item.rate.toNumber(),
    effectiveYear: item.effectiveYear,
    effectiveFrom: formatDate(item.effectiveFrom),
    effectiveTo: formatDate(item.effectiveTo),
    isActive: item.isActive,
    source: item.source,
    inverseOfId: item.inverseOfId,
    description: item.description,
    createdById: item.createdById,
    hasInverse: (inverseCountMap.get(item.id) ?? 0) > 0,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return {
    items: formattedItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ============================================================================
// Get By ID
// ============================================================================

/**
 * 查詢單一 Exchange Rate
 *
 * @description 返回匯率詳情，包含反向匯率資訊
 * @param id - Exchange Rate ID
 * @returns Exchange Rate 詳情，或 null（不存在）
 */
export async function getExchangeRateById(
  id: string
): Promise<ExchangeRateDetail | null> {
  const item = await prisma.exchangeRate.findUnique({
    where: { id },
    include: {
      inverseRates: {
        select: { id: true, rate: true },
      },
    },
  });

  if (!item) return null;

  const firstInverse = item.inverseRates[0];

  return {
    id: item.id,
    fromCurrency: item.fromCurrency,
    toCurrency: item.toCurrency,
    rate: item.rate.toNumber(),
    effectiveYear: item.effectiveYear,
    effectiveFrom: formatDate(item.effectiveFrom),
    effectiveTo: formatDate(item.effectiveTo),
    isActive: item.isActive,
    source: item.source,
    inverseOfId: item.inverseOfId,
    description: item.description,
    createdById: item.createdById,
    hasInverse: item.inverseRates.length > 0,
    inverseRate: firstInverse
      ? {
          id: firstInverse.id,
          rate: firstInverse.rate.toNumber(),
        }
      : undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

// ============================================================================
// Create (with optional inverse)
// ============================================================================

/**
 * 建立 Exchange Rate
 *
 * @description
 *   建立匯率記錄。若 createInverse = true，使用 transaction 同時建立反向記錄。
 *   反向記錄的 rate = 1 / 原始 rate，source = AUTO_INVERSE。
 *
 * @param input - 建立資料（含 createInverse 選項）
 * @param createdById - 建立者 ID
 * @returns 建立的 Exchange Rate 詳情
 * @throws Error - 唯一約束違反
 */
export async function createExchangeRate(
  input: CreateExchangeRateInput,
  createdById: string
): Promise<ExchangeRateDetail> {
  const { createInverse, ...data } = input;

  // 檢查唯一約束
  const existing = await prisma.exchangeRate.findUnique({
    where: {
      fromCurrency_toCurrency_effectiveYear: {
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        effectiveYear: data.effectiveYear,
      },
    },
  });

  if (existing) {
    throw new Error(
      `匯率記錄已存在：${data.fromCurrency} → ${data.toCurrency}（年份：${data.effectiveYear}）`
    );
  }

  // 若需建立反向，也檢查反向的唯一約束
  if (createInverse) {
    const existingInverse = await prisma.exchangeRate.findUnique({
      where: {
        fromCurrency_toCurrency_effectiveYear: {
          fromCurrency: data.toCurrency,
          toCurrency: data.fromCurrency,
          effectiveYear: data.effectiveYear,
        },
      },
    });

    if (existingInverse) {
      throw new Error(
        `反向匯率記錄已存在：${data.toCurrency} → ${data.fromCurrency}（年份：${data.effectiveYear}）`
      );
    }
  }

  const baseData = {
    fromCurrency: data.fromCurrency,
    toCurrency: data.toCurrency,
    rate: data.rate,
    effectiveYear: data.effectiveYear,
    effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
    effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
    description: data.description ?? null,
    source: 'MANUAL' as const,
    createdById,
  };

  if (createInverse) {
    const result = await prisma.$transaction(async (tx) => {
      // 建立原始記錄
      const original = await tx.exchangeRate.create({
        data: baseData,
      });

      // 建立反向記錄
      const inverseRate = 1 / Number(data.rate);
      const inverseRecord = await tx.exchangeRate.create({
        data: {
          fromCurrency: data.toCurrency,
          toCurrency: data.fromCurrency,
          rate: inverseRate,
          effectiveYear: data.effectiveYear,
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : null,
          effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
          description: data.description
            ? `[反向] ${data.description}`
            : '[自動建立的反向匯率]',
          source: 'AUTO_INVERSE' as const,
          inverseOfId: original.id,
          createdById,
        },
      });

      return {
        ...original,
        inverseRates: [inverseRecord],
      };
    });

    const firstInverse = result.inverseRates[0];

    return {
      id: result.id,
      fromCurrency: result.fromCurrency,
      toCurrency: result.toCurrency,
      rate: result.rate.toNumber(),
      effectiveYear: result.effectiveYear,
      effectiveFrom: formatDate(result.effectiveFrom),
      effectiveTo: formatDate(result.effectiveTo),
      isActive: result.isActive,
      source: result.source,
      inverseOfId: result.inverseOfId,
      description: result.description,
      createdById: result.createdById,
      hasInverse: true,
      inverseRate: {
        id: firstInverse.id,
        rate: firstInverse.rate.toNumber(),
      },
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  // 不建立反向，單筆建立
  const created = await prisma.exchangeRate.create({
    data: baseData,
  });

  return {
    id: created.id,
    fromCurrency: created.fromCurrency,
    toCurrency: created.toCurrency,
    rate: created.rate.toNumber(),
    effectiveYear: created.effectiveYear,
    effectiveFrom: formatDate(created.effectiveFrom),
    effectiveTo: formatDate(created.effectiveTo),
    isActive: created.isActive,
    source: created.source,
    inverseOfId: created.inverseOfId,
    description: created.description,
    createdById: created.createdById,
    hasInverse: false,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

// ============================================================================
// Update
// ============================================================================

/**
 * 更新 Exchange Rate
 *
 * @description 只更新提供的欄位，未提供的欄位保持不變
 * @param id - Exchange Rate ID
 * @param input - 更新資料
 * @returns 更新後的 Exchange Rate 詳情
 * @throws Error - 記錄不存在
 */
export async function updateExchangeRate(
  id: string,
  input: UpdateExchangeRateInput
): Promise<ExchangeRateDetail> {
  const existing = await prisma.exchangeRate.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('匯率記錄不存在');
  }

  const updateData: Prisma.ExchangeRateUpdateInput = {};

  if (input.rate !== undefined) {
    updateData.rate = input.rate;
  }
  if (input.effectiveFrom !== undefined) {
    updateData.effectiveFrom = input.effectiveFrom
      ? new Date(input.effectiveFrom)
      : null;
  }
  if (input.effectiveTo !== undefined) {
    updateData.effectiveTo = input.effectiveTo
      ? new Date(input.effectiveTo)
      : null;
  }
  if (input.description !== undefined) {
    updateData.description = input.description;
  }
  if (input.isActive !== undefined) {
    updateData.isActive = input.isActive;
  }

  const updated = await prisma.exchangeRate.update({
    where: { id },
    data: updateData,
    include: {
      inverseRates: {
        select: { id: true, rate: true },
      },
    },
  });

  const firstInverse = updated.inverseRates[0];

  return {
    id: updated.id,
    fromCurrency: updated.fromCurrency,
    toCurrency: updated.toCurrency,
    rate: updated.rate.toNumber(),
    effectiveYear: updated.effectiveYear,
    effectiveFrom: formatDate(updated.effectiveFrom),
    effectiveTo: formatDate(updated.effectiveTo),
    isActive: updated.isActive,
    source: updated.source,
    inverseOfId: updated.inverseOfId,
    description: updated.description,
    createdById: updated.createdById,
    hasInverse: updated.inverseRates.length > 0,
    inverseRate: firstInverse
      ? {
          id: firstInverse.id,
          rate: firstInverse.rate.toNumber(),
        }
      : undefined,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ============================================================================
// Delete (with inverse)
// ============================================================================

/**
 * 刪除 Exchange Rate（含反向記錄）
 *
 * @description
 *   使用 transaction 確保一致性。
 *   先刪除以此記錄為來源的反向記錄，再刪除記錄本身。
 *
 * @param id - Exchange Rate ID
 * @throws Error - 記錄不存在
 */
export async function deleteExchangeRate(id: string): Promise<void> {
  const existing = await prisma.exchangeRate.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('匯率記錄不存在');
  }

  await prisma.$transaction(async (tx) => {
    // 先刪除以此為來源的反向記錄
    await tx.exchangeRate.deleteMany({
      where: { inverseOfId: id },
    });

    // 刪除本身
    await tx.exchangeRate.delete({
      where: { id },
    });
  });
}

// ============================================================================
// Toggle
// ============================================================================

/**
 * 切換 Exchange Rate 啟用/停用狀態
 *
 * @param id - Exchange Rate ID
 * @returns 更新後的 Exchange Rate 詳情
 * @throws Error - 記錄不存在
 */
export async function toggleExchangeRate(
  id: string
): Promise<ExchangeRateDetail> {
  const item = await prisma.exchangeRate.findUnique({
    where: { id },
    select: { isActive: true },
  });

  if (!item) {
    throw new Error('匯率記錄不存在');
  }

  const updated = await prisma.exchangeRate.update({
    where: { id },
    data: { isActive: !item.isActive },
    include: {
      inverseRates: {
        select: { id: true, rate: true },
      },
    },
  });

  const firstInverse = updated.inverseRates[0];

  return {
    id: updated.id,
    fromCurrency: updated.fromCurrency,
    toCurrency: updated.toCurrency,
    rate: updated.rate.toNumber(),
    effectiveYear: updated.effectiveYear,
    effectiveFrom: formatDate(updated.effectiveFrom),
    effectiveTo: formatDate(updated.effectiveTo),
    isActive: updated.isActive,
    source: updated.source,
    inverseOfId: updated.inverseOfId,
    description: updated.description,
    createdById: updated.createdById,
    hasInverse: updated.inverseRates.length > 0,
    inverseRate: firstInverse
      ? {
          id: firstInverse.id,
          rate: firstInverse.rate.toNumber(),
        }
      : undefined,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ============================================================================
// Convert
// ============================================================================

/**
 * 匯率轉換計算
 *
 * @description
 *   Fallback 邏輯：
 *   1. 直接查詢：fromCurrency → toCurrency
 *   2. 反向計算：toCurrency → fromCurrency，使用 1/rate
 *   3. 交叉匯率：fromCurrency → USD → toCurrency
 *   4. 找不到：拋出錯誤
 *
 * @param fromCurrency - 來源貨幣代碼
 * @param toCurrency - 目標貨幣代碼
 * @param amount - 轉換金額
 * @param year - 生效年份（預設為當前年份）
 * @returns 轉換結果
 * @throws Error - 找不到匹配的匯率記錄
 */
export async function convert(
  fromCurrency: string,
  toCurrency: string,
  amount: number,
  year?: number
): Promise<ConvertResult> {
  const effectiveYear = year ?? new Date().getFullYear();

  // 1. 直接查詢
  const direct = await findDirectRate(fromCurrency, toCurrency, effectiveYear);
  if (direct) {
    return {
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount: amount * direct.rate,
      rate: direct.rate,
      path: 'direct',
      rateId: direct.id,
      effectiveYear,
    };
  }

  // 2. 反向計算
  const inverse = await findDirectRate(toCurrency, fromCurrency, effectiveYear);
  if (inverse) {
    const rate = 1 / inverse.rate;
    return {
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount: amount * rate,
      rate,
      path: 'inverse',
      rateId: inverse.id,
      effectiveYear,
    };
  }

  // 3. 交叉匯率（通過 USD）
  if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
    const toUsd = await findRate(fromCurrency, 'USD', effectiveYear);
    const fromUsd = await findRate('USD', toCurrency, effectiveYear);

    if (toUsd && fromUsd) {
      const rate = toUsd.rate * fromUsd.rate;
      return {
        fromCurrency,
        toCurrency,
        amount,
        convertedAmount: amount * rate,
        rate,
        path: `cross:${fromCurrency}→USD→${toCurrency}`,
        rateIds: [toUsd.id, fromUsd.id],
        effectiveYear,
      };
    }
  }

  // 4. 找不到
  throw new Error(
    `找不到 ${fromCurrency} → ${toCurrency} 的匯率記錄（年份：${effectiveYear}）`
  );
}

// ============================================================================
// Batch Get Rates
// ============================================================================

/**
 * 批次查詢多個貨幣對匯率
 *
 * @description
 *   並行查詢所有貨幣對，每個貨幣對使用 convert 方法（amount=1）。
 *   失敗的貨幣對返回 found=false 而非拋出錯誤。
 *
 * @param pairs - 貨幣對列表
 * @param year - 生效年份（預設為當前年份）
 * @returns 每個貨幣對的匯率結果
 */
export async function batchGetRates(
  pairs: Array<{ fromCurrency: string; toCurrency: string }>,
  year?: number
): Promise<BatchRateResult[]> {
  const effectiveYear = year ?? new Date().getFullYear();

  return Promise.all(
    pairs.map(async ({ fromCurrency, toCurrency }) => {
      try {
        const result = await convert(
          fromCurrency,
          toCurrency,
          1,
          effectiveYear
        );
        return {
          fromCurrency,
          toCurrency,
          rate: result.rate,
          path: result.path,
          found: true,
          rateId: result.rateId,
        };
      } catch {
        return {
          fromCurrency,
          toCurrency,
          rate: 0,
          path: 'not_found',
          found: false,
        };
      }
    })
  );
}

// ============================================================================
// Export (Story 21-5)
// ============================================================================

/**
 * 導出項目格式
 */
export interface ExportExchangeRateItem {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveYear: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  source: string;
  isActive: boolean;
  description: string | null;
}

/**
 * 導出結果格式
 */
export interface ExportExchangeRatesResult {
  exportVersion: string;
  exportedAt: string;
  totalCount: number;
  items: ExportExchangeRateItem[];
}

/**
 * 導出匯率資料
 *
 * @description
 *   導出匯率記錄為 JSON 格式。
 *   支援 year 和 isActive 篩選。
 *   返回包含版本和時間戳的完整導出資料。
 *
 * @param query - 導出查詢參數（year, isActive）
 * @returns 導出結果（含 exportVersion, exportedAt, items）
 */
export async function exportExchangeRates(
  query: ExportExchangeRatesQuery
): Promise<ExportExchangeRatesResult> {
  const where: Prisma.ExchangeRateWhereInput = {};

  if (query.year !== undefined) {
    where.effectiveYear = query.year;
  }
  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  const items = await prisma.exchangeRate.findMany({
    where,
    orderBy: [
      { effectiveYear: 'desc' },
      { fromCurrency: 'asc' },
      { toCurrency: 'asc' },
    ],
  });

  return {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    totalCount: items.length,
    items: items.map((item) => ({
      fromCurrency: item.fromCurrency,
      toCurrency: item.toCurrency,
      rate: item.rate.toString(),
      effectiveYear: item.effectiveYear,
      effectiveFrom: item.effectiveFrom?.toISOString() ?? null,
      effectiveTo: item.effectiveTo?.toISOString() ?? null,
      source: item.source,
      isActive: item.isActive,
      description: item.description,
    })),
  };
}

// ============================================================================
// Import (Story 21-5)
// ============================================================================

/**
 * 導入錯誤項目
 */
export interface ImportErrorItem {
  index: number;
  error: string;
}

/**
 * 導入結果統計
 */
export interface ImportExchangeRatesResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: ImportErrorItem[];
}

/**
 * 批次導入匯率資料
 *
 * @description
 *   批次導入匯率記錄。支援以下選項：
 *   - overwriteExisting: 若記錄已存在，是否覆寫
 *   - skipInvalid: 遇到錯誤時，是否跳過繼續處理
 *   - createInverse: 每筆記錄是否同時建立反向匯率
 *
 *   處理邏輯：
 *   1. 驗證 fromCurrency !== toCurrency
 *   2. 檢查唯一約束（fromCurrency, toCurrency, effectiveYear）
 *   3. 若已存在：overwriteExisting=true 則更新，否則跳過
 *   4. 若需 createInverse：使用 transaction 同時建立反向記錄
 *
 * @param input - 導入資料（items + options）
 * @param createdById - 建立者 ID
 * @returns 導入結果統計（imported, updated, skipped, errors）
 * @throws Error - skipInvalid=false 且遇到錯誤時
 */
export async function importExchangeRates(
  input: ImportExchangeRatesInput,
  createdById: string
): Promise<ImportExchangeRatesResult> {
  const { items, options } = input;
  const { overwriteExisting, skipInvalid } = options;

  const result: ImportExchangeRatesResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    try {
      // 驗證貨幣代碼不同
      if (item.fromCurrency === item.toCurrency) {
        throw new Error('來源和目標貨幣不能相同');
      }

      // 檢查是否已存在
      const existing = await prisma.exchangeRate.findUnique({
        where: {
          fromCurrency_toCurrency_effectiveYear: {
            fromCurrency: item.fromCurrency,
            toCurrency: item.toCurrency,
            effectiveYear: item.effectiveYear,
          },
        },
      });

      if (existing) {
        if (overwriteExisting) {
          // 更新現有記錄
          await prisma.exchangeRate.update({
            where: { id: existing.id },
            data: {
              rate: item.rate,
              effectiveFrom: item.effectiveFrom
                ? new Date(item.effectiveFrom)
                : null,
              effectiveTo: item.effectiveTo
                ? new Date(item.effectiveTo)
                : null,
              description: item.description ?? null,
              isActive: item.isActive,
            },
          });
          result.updated++;
        } else {
          // 跳過已存在的記錄
          result.skipped++;
        }
      } else {
        // 建立新記錄
        if (item.createInverse) {
          // 使用 transaction 同時建立原始和反向記錄
          await prisma.$transaction(async (tx) => {
            const original = await tx.exchangeRate.create({
              data: {
                fromCurrency: item.fromCurrency,
                toCurrency: item.toCurrency,
                rate: item.rate,
                effectiveYear: item.effectiveYear,
                effectiveFrom: item.effectiveFrom
                  ? new Date(item.effectiveFrom)
                  : null,
                effectiveTo: item.effectiveTo
                  ? new Date(item.effectiveTo)
                  : null,
                description: item.description ?? null,
                isActive: item.isActive,
                source: 'IMPORTED',
                createdById,
              },
            });

            // 檢查反向記錄是否已存在
            const inverseExisting = await tx.exchangeRate.findUnique({
              where: {
                fromCurrency_toCurrency_effectiveYear: {
                  fromCurrency: item.toCurrency,
                  toCurrency: item.fromCurrency,
                  effectiveYear: item.effectiveYear,
                },
              },
            });

            if (!inverseExisting) {
              const inverseRate = 1 / Number(item.rate);
              await tx.exchangeRate.create({
                data: {
                  fromCurrency: item.toCurrency,
                  toCurrency: item.fromCurrency,
                  rate: inverseRate,
                  effectiveYear: item.effectiveYear,
                  effectiveFrom: item.effectiveFrom
                    ? new Date(item.effectiveFrom)
                    : null,
                  effectiveTo: item.effectiveTo
                    ? new Date(item.effectiveTo)
                    : null,
                  description: item.description
                    ? `[反向] ${item.description}`
                    : '[自動建立的反向匯率]',
                  isActive: item.isActive,
                  source: 'AUTO_INVERSE',
                  inverseOfId: original.id,
                  createdById,
                },
              });
            }
          });
        } else {
          // 只建立原始記錄
          await prisma.exchangeRate.create({
            data: {
              fromCurrency: item.fromCurrency,
              toCurrency: item.toCurrency,
              rate: item.rate,
              effectiveYear: item.effectiveYear,
              effectiveFrom: item.effectiveFrom
                ? new Date(item.effectiveFrom)
                : null,
              effectiveTo: item.effectiveTo
                ? new Date(item.effectiveTo)
                : null,
              description: item.description ?? null,
              isActive: item.isActive,
              source: 'IMPORTED',
              createdById,
            },
          });
        }
        result.imported++;
      }
    } catch (error) {
      if (skipInvalid) {
        // 記錄錯誤並跳過
        result.errors.push({
          index: i,
          error: error instanceof Error ? error.message : '未知錯誤',
        });
        result.skipped++;
      } else {
        // 整批失敗
        throw new Error(
          `導入第 ${i + 1} 筆資料失敗：${error instanceof Error ? error.message : '未知錯誤'}`
        );
      }
    }
  }

  return result;
}
