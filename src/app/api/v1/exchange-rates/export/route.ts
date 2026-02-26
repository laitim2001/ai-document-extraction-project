/**
 * @fileoverview Exchange Rate API - 匯率導出
 * @description
 *   提供匯率資料的 JSON 格式導出功能。
 *   支援 year 和 isActive 篩選條件。
 *   返回包含 exportVersion 和時間戳的完整資料。
 *
 * @module src/app/api/v1/exchange-rates/export
 * @since Epic 21 - Story 21.5
 * @lastModified 2026-02-06
 *
 * @endpoints
 *   GET /api/v1/exchange-rates/export - 導出匯率資料
 */

import { NextRequest, NextResponse } from 'next/server';
import { exportExchangeRates } from '@/services/exchange-rate.service';
import { exportExchangeRatesQuerySchema } from '@/lib/validations/exchange-rate.schema';
import { ZodError } from 'zod';

// =====================
// API Handlers
// =====================

/**
 * GET /api/v1/exchange-rates/export
 * 導出匯率資料
 *
 * @description
 *   導出匯率記錄為 JSON 格式。
 *   支援篩選條件：
 *   - year: 生效年份
 *   - isActive: 是否啟用
 *
 * @queryParams
 *   - year (optional): 生效年份（2000-2100）
 *   - isActive (optional): "true" 或 "false"
 *
 * @returns 導出資料，包含：
 *   - exportVersion: 導出格式版本
 *   - exportedAt: 導出時間
 *   - totalCount: 記錄總數
 *   - items: 匯率記錄列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryObject: Record<string, string> = {};

    // 只取有值的參數
    const year = searchParams.get('year');
    const isActive = searchParams.get('isActive');
    if (year) queryObject.year = year;
    if (isActive) queryObject.isActive = isActive;

    // 驗證查詢參數
    const parsed = exportExchangeRatesQuerySchema.safeParse(queryObject);
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid query parameters',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 執行導出
    const result = await exportExchangeRates(parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ExchangeRate:Export] Error:', error);

    // 處理 Zod 驗證錯誤
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid query parameters',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while exporting exchange rates',
      },
      { status: 500 }
    );
  }
}
