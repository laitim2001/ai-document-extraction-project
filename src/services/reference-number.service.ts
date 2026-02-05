/**
 * @fileoverview Reference Number 服務層
 * @description
 *   提供 Reference Number 的 CRUD 操作功能。
 *
 *   主要功能：
 *   - list: 分頁列表查詢（支援篩選、排序）
 *   - getById: 單一記錄查詢
 *   - create: 建立新記錄（含自動生成 code）
 *   - update: 更新記錄
 *   - delete: 軟刪除記錄
 *   - importReferenceNumbers: 批次導入
 *   - exportReferenceNumbers: 批次導出
 *   - validateReferenceNumbers: 批次驗證
 *
 *   設計決策：
 *   - code 欄位自動生成：格式為 REF-{YEAR}-{REGION_CODE}-{RANDOM}
 *   - 軟刪除：刪除時設定 isActive = false
 *   - 唯一約束：(number, type, year, regionId) 組合唯一
 *
 * @module src/services/reference-number.service
 * @since Epic 20 - Story 20.3
 * @lastModified 2026-02-05 (Story 20.4: Import/Export/Validate)
 *
 * @dependencies
 *   - prisma - 資料庫 ORM
 *   - crypto - 隨機碼生成
 *
 * @related
 *   - src/lib/validations/reference-number.schema.ts - 驗證 Schema
 *   - src/app/api/v1/reference-numbers/ - API 端點
 */

import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import type {
  CreateReferenceNumberInput,
  UpdateReferenceNumberInput,
  GetReferenceNumbersQuery,
  ImportReferenceNumbersInput,
  ExportReferenceNumbersQuery,
  ValidateReferenceNumbersInput,
} from '@/lib/validations/reference-number.schema';

// ============================================================================
// Types
// ============================================================================

/**
 * Reference Number 列表項目
 */
export interface ReferenceNumberListItem {
  id: string;
  code: string;
  number: string;
  type: string;
  status: string;
  year: number;
  regionId: string;
  regionCode: string;
  regionName: string;
  description: string | null;
  validFrom: string | null;
  validUntil: string | null;
  matchCount: number;
  lastMatchedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Reference Number 詳情
 */
export interface ReferenceNumberDetail extends ReferenceNumberListItem {
  createdById: string;
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
export interface ReferenceNumberListResult {
  items: ReferenceNumberListItem[];
  pagination: PaginationInfo;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 生成隨機碼（6 字元大寫英數字）
 */
function generateRandomCode(): string {
  return randomBytes(4)
    .toString('base64')
    .replace(/[^A-Za-z0-9]/g, '')
    .substring(0, 6)
    .toUpperCase();
}

/**
 * 生成 Reference Number code
 * 格式: REF-{YEAR}-{REGION_CODE}-{RANDOM}
 * 範例: REF-2026-APAC-A1B2C3
 */
async function generateCode(year: number, regionCode: string): Promise<string> {
  const random = generateRandomCode();
  const code = `REF-${year}-${regionCode}-${random}`;

  // 確保唯一性
  const existing = await prisma.referenceNumber.findUnique({ where: { code } });
  if (existing) {
    return generateCode(year, regionCode);
  }

  return code;
}

/**
 * 格式化日期為 ISO 字串
 */
function formatDate(date: Date | null | undefined): string | null {
  return date?.toISOString() ?? null;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * 查詢 Reference Number 列表
 *
 * @param query - 查詢參數
 * @returns 列表結果（含分頁資訊）
 */
export async function getReferenceNumbers(
  query: GetReferenceNumbersQuery
): Promise<ReferenceNumberListResult> {
  const {
    page,
    limit,
    year,
    regionId,
    type,
    status,
    isActive,
    search,
    sortBy,
    sortOrder,
  } = query;

  // 建立查詢條件
  const where: Prisma.ReferenceNumberWhereInput = {};

  if (year !== undefined) {
    where.year = year;
  }

  if (regionId) {
    where.regionId = regionId;
  }

  if (type) {
    where.type = type;
  }

  if (status) {
    where.status = status;
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (search) {
    where.number = { contains: search, mode: 'insensitive' };
  }

  // 並行查詢資料和總數
  const [items, total] = await Promise.all([
    prisma.referenceNumber.findMany({
      where,
      include: {
        region: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.referenceNumber.count({ where }),
  ]);

  // 格式化結果
  const formattedItems: ReferenceNumberListItem[] = items.map((item) => ({
    id: item.id,
    code: item.code,
    number: item.number,
    type: item.type,
    status: item.status,
    year: item.year,
    regionId: item.regionId,
    regionCode: item.region.code,
    regionName: item.region.name,
    description: item.description,
    validFrom: formatDate(item.validFrom),
    validUntil: formatDate(item.validUntil),
    matchCount: item.matchCount,
    lastMatchedAt: formatDate(item.lastMatchedAt),
    isActive: item.isActive,
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

/**
 * 查詢單一 Reference Number
 *
 * @param id - Reference Number ID
 * @returns Reference Number 詳情，或 null（不存在）
 */
export async function getReferenceNumberById(
  id: string
): Promise<ReferenceNumberDetail | null> {
  const item = await prisma.referenceNumber.findUnique({
    where: { id },
    include: {
      region: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  if (!item) {
    return null;
  }

  return {
    id: item.id,
    code: item.code,
    number: item.number,
    type: item.type,
    status: item.status,
    year: item.year,
    regionId: item.regionId,
    regionCode: item.region.code,
    regionName: item.region.name,
    description: item.description,
    validFrom: formatDate(item.validFrom),
    validUntil: formatDate(item.validUntil),
    matchCount: item.matchCount,
    lastMatchedAt: formatDate(item.lastMatchedAt),
    isActive: item.isActive,
    createdById: item.createdById,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

/**
 * 建立 Reference Number
 *
 * @param input - 建立資料
 * @param createdById - 建立者 ID
 * @returns 建立的 Reference Number
 * @throws Error - 地區不存在或唯一約束違反
 */
export async function createReferenceNumber(
  input: CreateReferenceNumberInput,
  createdById: string
): Promise<ReferenceNumberDetail> {
  // 取得 region 資訊
  const region = await prisma.region.findUnique({
    where: { id: input.regionId },
    select: { id: true, code: true, name: true },
  });

  if (!region) {
    throw new Error('地區不存在');
  }

  // 檢查唯一約束
  const existing = await prisma.referenceNumber.findFirst({
    where: {
      number: input.number,
      type: input.type,
      year: input.year,
      regionId: input.regionId,
    },
  });

  if (existing) {
    throw new Error(
      `此組合已存在：number=${input.number}, type=${input.type}, year=${input.year}, regionId=${input.regionId}`
    );
  }

  // 生成或使用提供的 code
  const code = input.code || (await generateCode(input.year, region.code));

  // 檢查 code 唯一性
  if (input.code) {
    const existingCode = await prisma.referenceNumber.findUnique({
      where: { code: input.code },
    });
    if (existingCode) {
      throw new Error(`識別碼 ${input.code} 已存在`);
    }
  }

  // 建立記錄
  const item = await prisma.referenceNumber.create({
    data: {
      code,
      number: input.number,
      type: input.type,
      year: input.year,
      regionId: input.regionId,
      description: input.description ?? null,
      validFrom: input.validFrom ? new Date(input.validFrom) : null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      createdById,
    },
    include: {
      region: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  return {
    id: item.id,
    code: item.code,
    number: item.number,
    type: item.type,
    status: item.status,
    year: item.year,
    regionId: item.regionId,
    regionCode: item.region.code,
    regionName: item.region.name,
    description: item.description,
    validFrom: formatDate(item.validFrom),
    validUntil: formatDate(item.validUntil),
    matchCount: item.matchCount,
    lastMatchedAt: formatDate(item.lastMatchedAt),
    isActive: item.isActive,
    createdById: item.createdById,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

/**
 * 更新 Reference Number
 *
 * @param id - Reference Number ID
 * @param input - 更新資料
 * @returns 更新後的 Reference Number
 * @throws Error - 記錄不存在或唯一約束違反
 */
export async function updateReferenceNumber(
  id: string,
  input: UpdateReferenceNumberInput
): Promise<ReferenceNumberDetail> {
  // 檢查記錄是否存在
  const existing = await prisma.referenceNumber.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Reference Number 不存在');
  }

  // 如果更新了會影響唯一約束的欄位，需要檢查
  const newNumber = input.number ?? existing.number;
  const newType = input.type ?? existing.type;
  const newYear = input.year ?? existing.year;
  const newRegionId = input.regionId ?? existing.regionId;

  // 檢查更新後是否會違反唯一約束
  if (
    input.number !== undefined ||
    input.type !== undefined ||
    input.year !== undefined ||
    input.regionId !== undefined
  ) {
    const duplicate = await prisma.referenceNumber.findFirst({
      where: {
        number: newNumber,
        type: newType,
        year: newYear,
        regionId: newRegionId,
        id: { not: id }, // 排除自己
      },
    });

    if (duplicate) {
      throw new Error(
        `此組合已存在：number=${newNumber}, type=${newType}, year=${newYear}, regionId=${newRegionId}`
      );
    }
  }

  // 如果更新了 regionId，驗證新地區存在
  if (input.regionId) {
    const region = await prisma.region.findUnique({
      where: { id: input.regionId },
    });
    if (!region) {
      throw new Error('地區不存在');
    }
  }

  // 建立更新資料
  const updateData: Prisma.ReferenceNumberUpdateInput = {};

  if (input.number !== undefined) {
    updateData.number = input.number;
  }
  if (input.type !== undefined) {
    updateData.type = input.type;
  }
  if (input.status !== undefined) {
    updateData.status = input.status;
  }
  if (input.year !== undefined) {
    updateData.year = input.year;
  }
  if (input.regionId !== undefined) {
    updateData.region = { connect: { id: input.regionId } };
  }
  if (input.description !== undefined) {
    updateData.description = input.description;
  }
  if (input.validFrom !== undefined) {
    updateData.validFrom = input.validFrom ? new Date(input.validFrom) : null;
  }
  if (input.validUntil !== undefined) {
    updateData.validUntil = input.validUntil ? new Date(input.validUntil) : null;
  }
  if (input.isActive !== undefined) {
    updateData.isActive = input.isActive;
  }

  // 執行更新
  const item = await prisma.referenceNumber.update({
    where: { id },
    data: updateData,
    include: {
      region: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  return {
    id: item.id,
    code: item.code,
    number: item.number,
    type: item.type,
    status: item.status,
    year: item.year,
    regionId: item.regionId,
    regionCode: item.region.code,
    regionName: item.region.name,
    description: item.description,
    validFrom: formatDate(item.validFrom),
    validUntil: formatDate(item.validUntil),
    matchCount: item.matchCount,
    lastMatchedAt: formatDate(item.lastMatchedAt),
    isActive: item.isActive,
    createdById: item.createdById,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

/**
 * 刪除 Reference Number（軟刪除）
 *
 * @param id - Reference Number ID
 * @throws Error - 記錄不存在
 */
export async function deleteReferenceNumber(id: string): Promise<void> {
  // 檢查記錄是否存在
  const existing = await prisma.referenceNumber.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Reference Number 不存在');
  }

  // 軟刪除
  await prisma.referenceNumber.update({
    where: { id },
    data: { isActive: false },
  });
}

/**
 * 檢查 Reference Number 是否存在
 *
 * @param id - Reference Number ID
 * @returns 是否存在
 */
export async function referenceNumberExists(id: string): Promise<boolean> {
  const count = await prisma.referenceNumber.count({
    where: { id },
  });
  return count > 0;
}

// ============================================================================
// Import (Story 20.4)
// ============================================================================

/**
 * 導入結果統計
 */
export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; error: string }>;
}

/**
 * 批次導入 Reference Numbers
 *
 * @description
 *   使用 code 匹配現有記錄，regionCode 關聯地區。
 *   支援 overwriteExisting（覆蓋）和 skipInvalid（跳過無效）選項。
 *   skipInvalid = false 時，遇到錯誤整批失敗。
 *
 * @param input - 導入請求資料
 * @param createdById - 建立者 ID
 * @returns 導入結果統計
 */
export async function importReferenceNumbers(
  input: ImportReferenceNumbersInput,
  createdById: string
): Promise<ImportResult> {
  const { items, options } = input;
  const { overwriteExisting, skipInvalid } = options;

  const result: ImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // 預先載入所有 region 代碼映射，避免 N+1 查詢
  const regions = await prisma.region.findMany({
    select: { id: true, code: true },
  });
  const regionMap = new Map(
    regions.map((r) => [r.code.toUpperCase(), r.id])
  );

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    try {
      // 查找 region
      const regionId = regionMap.get(item.regionCode.toUpperCase());
      if (!regionId) {
        throw new Error(`地區代碼 ${item.regionCode} 不存在`);
      }

      // 檢查是否已存在（優先 by code，其次唯一約束）
      let existing = null;
      if (item.code) {
        existing = await prisma.referenceNumber.findUnique({
          where: { code: item.code },
        });
      }

      if (!existing) {
        existing = await prisma.referenceNumber.findFirst({
          where: {
            number: item.number,
            type: item.type,
            year: item.year,
            regionId,
          },
        });
      }

      if (existing) {
        if (overwriteExisting) {
          await prisma.referenceNumber.update({
            where: { id: existing.id },
            data: {
              number: item.number,
              type: item.type,
              year: item.year,
              regionId,
              description: item.description ?? null,
              validFrom: item.validFrom ? new Date(item.validFrom) : null,
              validUntil: item.validUntil ? new Date(item.validUntil) : null,
              isActive: item.isActive,
            },
          });
          result.updated++;
        } else {
          result.skipped++;
        }
      } else {
        // 生成或使用提供的 code
        const code = item.code || (await generateCode(item.year, item.regionCode));

        await prisma.referenceNumber.create({
          data: {
            code,
            number: item.number,
            type: item.type,
            year: item.year,
            regionId,
            description: item.description ?? null,
            validFrom: item.validFrom ? new Date(item.validFrom) : null,
            validUntil: item.validUntil ? new Date(item.validUntil) : null,
            isActive: item.isActive,
            createdById,
          },
        });
        result.imported++;
      }
    } catch (error) {
      if (skipInvalid) {
        result.errors.push({
          index: i,
          error: error instanceof Error ? error.message : '未知錯誤',
        });
        result.skipped++;
      } else {
        // skipInvalid = false：整批失敗，拋出帶有 index 資訊的錯誤
        throw new Error(
          `導入第 ${i + 1} 筆時失敗：${error instanceof Error ? error.message : '未知錯誤'}`
        );
      }
    }
  }

  return result;
}

// ============================================================================
// Export (Story 20.4)
// ============================================================================

/**
 * 導出項目結構
 */
export interface ExportItem {
  code: string;
  number: string;
  type: string;
  status: string;
  year: number;
  regionCode: string;
  description: string | null;
  validFrom: string | null;
  validUntil: string | null;
  matchCount: number;
  isActive: boolean;
}

/**
 * 導出結果結構
 */
export interface ExportResult {
  exportVersion: string;
  exportedAt: string;
  totalCount: number;
  items: ExportItem[];
}

/**
 * 批次導出 Reference Numbers
 *
 * @description
 *   支援按年份、地區、類型、狀態、啟用狀態篩選。
 *   返回 JSON 格式，使用 code 和 regionCode（而非 ID）。
 *
 * @param query - 篩選條件
 * @returns 導出結果
 */
export async function exportReferenceNumbers(
  query: ExportReferenceNumbersQuery
): Promise<ExportResult> {
  const where: Prisma.ReferenceNumberWhereInput = {};

  if (query.year !== undefined) {
    where.year = query.year;
  }
  if (query.regionId) {
    where.regionId = query.regionId;
  }
  if (query.type) {
    where.type = query.type;
  }
  if (query.status) {
    where.status = query.status;
  }
  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  const items = await prisma.referenceNumber.findMany({
    where,
    include: {
      region: { select: { code: true } },
    },
    orderBy: [
      { year: 'desc' },
      { number: 'asc' },
    ],
  });

  return {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    totalCount: items.length,
    items: items.map((item) => ({
      code: item.code,
      number: item.number,
      type: item.type,
      status: item.status,
      year: item.year,
      regionCode: item.region.code,
      description: item.description,
      validFrom: formatDate(item.validFrom),
      validUntil: formatDate(item.validUntil),
      matchCount: item.matchCount,
      isActive: item.isActive,
    })),
  };
}

// ============================================================================
// Validate (Story 20.4)
// ============================================================================

/**
 * 驗證匹配結果
 */
export interface ValidateMatch {
  id: string;
  number: string;
  type: string;
  year: number;
  regionCode: string;
  status: string;
}

/**
 * 驗證單一結果
 */
export interface ValidateResultItem {
  value: string;
  found: boolean;
  matches: ValidateMatch[];
}

/**
 * 驗證摘要
 */
export interface ValidateSummary {
  total: number;
  found: number;
  notFound: number;
}

/**
 * 驗證結果
 */
export interface ValidateResult {
  results: ValidateResultItem[];
  summary: ValidateSummary;
}

/**
 * 批次驗證 Reference Numbers
 *
 * @description
 *   檢查號碼列表是否存在於系統中。
 *   匹配成功時自動增加 matchCount 和更新 lastMatchedAt。
 *   只匹配 isActive = true 且 status = ACTIVE 的記錄。
 *
 * @param input - 驗證請求資料
 * @returns 驗證結果（含每個號碼的匹配詳情和摘要）
 */
export async function validateReferenceNumbers(
  input: ValidateReferenceNumbersInput
): Promise<ValidateResult> {
  const { numbers, options } = input;

  const results = await Promise.all(
    numbers.map(async ({ value, type }) => {
      const where: Prisma.ReferenceNumberWhereInput = {
        number: { equals: value, mode: 'insensitive' },
        isActive: true,
        status: 'ACTIVE',
      };

      if (type) {
        where.type = type;
      }
      if (options?.year) {
        where.year = options.year;
      }
      if (options?.regionId) {
        where.regionId = options.regionId;
      }

      const matches = await prisma.referenceNumber.findMany({
        where,
        include: {
          region: { select: { code: true } },
        },
        take: 5, // 限制每個號碼最多 5 個匹配
      });

      // 更新匹配計數
      if (matches.length > 0) {
        await prisma.referenceNumber.updateMany({
          where: { id: { in: matches.map((m) => m.id) } },
          data: {
            matchCount: { increment: 1 },
            lastMatchedAt: new Date(),
          },
        });
      }

      return {
        value,
        found: matches.length > 0,
        matches: matches.map((m) => ({
          id: m.id,
          number: m.number,
          type: m.type,
          year: m.year,
          regionCode: m.region.code,
          status: m.status,
        })),
      };
    })
  );

  const foundCount = results.filter((r) => r.found).length;

  return {
    results,
    summary: {
      total: numbers.length,
      found: foundCount,
      notFound: numbers.length - foundCount,
    },
  };
}
