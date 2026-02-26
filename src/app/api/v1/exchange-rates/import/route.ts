/**
 * @fileoverview Exchange Rate API - 匯率批次導入
 * @description
 *   提供匯率資料的批次導入功能。
 *   支援 overwriteExisting、skipInvalid、createInverse 選項。
 *   返回導入結果統計，包含成功、更新、跳過和錯誤數量。
 *
 * @module src/app/api/v1/exchange-rates/import
 * @since Epic 21 - Story 21.5
 * @lastModified 2026-02-06
 *
 * @endpoints
 *   POST /api/v1/exchange-rates/import - 批次導入匯率
 */

import { NextRequest, NextResponse } from 'next/server';
import { importExchangeRates } from '@/services/exchange-rate.service';
import { importExchangeRatesSchema } from '@/lib/validations/exchange-rate.schema';
import { ZodError } from 'zod';

// =====================
// API Handlers
// =====================

/**
 * POST /api/v1/exchange-rates/import
 * 批次導入匯率資料
 *
 * @description
 *   批次導入匯率記錄。支援以下選項：
 *   - overwriteExisting: 若記錄已存在，是否覆寫
 *   - skipInvalid: 遇到錯誤時，是否跳過繼續處理
 *   - createInverse: 是否同時建立反向匯率
 *
 * @requestBody
 *   - exportVersion (optional): 導出格式版本
 *   - items: 匯率記錄列表（1-500 筆）
 *   - options (optional): 導入選項
 *     - overwriteExisting: boolean (default: false)
 *     - skipInvalid: boolean (default: false)
 *
 * @returns 導入結果統計：
 *   - imported: 新增筆數
 *   - updated: 更新筆數
 *   - skipped: 跳過筆數
 *   - errors: 錯誤列表
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 驗證請求體
    const parsed = importExchangeRatesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid import data format',
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 執行導入
    // 目前使用固定的 createdById，後續整合認證後替換
    const createdById = 'system';
    const result = await importExchangeRates(parsed.data, createdById);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[ExchangeRate:Import] Error:', error);

    // 處理 Zod 驗證錯誤
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'Invalid import data format',
          errors: error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 處理業務邏輯錯誤（skipInvalid = false 時的整批失敗）
    if (error instanceof Error && error.message.startsWith('導入第')) {
      return NextResponse.json(
        {
          type: 'https://api.example.com/errors/import-failed',
          title: 'Import Failed',
          status: 422,
          detail: error.message,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        type: 'https://api.example.com/errors/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred while importing exchange rates',
      },
      { status: 500 }
    );
  }
}
