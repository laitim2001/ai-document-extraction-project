/**
 * @fileoverview 規則快取版本 API 端點
 * @description
 *   提供全域規則快取版本查詢功能：
 *   - 查詢 mapping_rules 版本
 *   - 查詢 companies 版本 (REFACTOR-001: 原 forwarders)
 *   - 用於客戶端同步檢測
 *
 *   端點：
 *   - GET /api/rules/version - 獲取快取版本
 *
 * @module src/app/api/rules/version/route
 * @since Epic 6 - Story 6.5 (Global Rule Sharing)
 * @lastModified 2025-12-22
 * @refactor REFACTOR-001 (Forwarder → Company)
 *
 * @dependencies
 *   - next/server - Next.js API 處理
 *   - @/lib/auth - NextAuth 認證
 *   - @/services/rule-resolver - 規則解析服務
 *
 * @related
 *   - src/hooks/useRuleVersion.ts - React Query Hook
 *   - src/services/rule-resolver.ts - 版本追蹤
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ruleResolver, ENTITY_TYPES } from '@/services/rule-resolver';

// ============================================================
// Types
// ============================================================

/**
 * 版本響應資料
 */
interface VersionData {
  /** 映射規則版本 */
  mappingRules: number;
  /** Companies 版本 (REFACTOR-001: 原 forwarders) */
  companies: number;
  /** 版本查詢時間 */
  timestamp: string;
}

// ============================================================
// GET /api/rules/version
// ============================================================

/**
 * GET /api/rules/version
 * 獲取全域規則快取版本
 *
 * @description
 *   返回 mapping_rules 和 forwarders 的當前版本號。
 *   客戶端可透過定期輪詢此端點，檢測規則是否有更新。
 *   當版本號增加時，客戶端應重新獲取最新規則。
 *
 * @returns 版本資訊
 *
 * @example
 *   Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "mappingRules": 5,
 *       "companies": 3,
 *       "timestamp": "2025-12-19T10:30:00.000Z"
 *     }
 *   }
 */
export async function GET() {
  try {
    // 認證檢查
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          type: 'unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // 取得版本號
    // REFACTOR-001: ENTITY_TYPES.FORWARDERS 已更新為 ENTITY_TYPES.COMPANIES
    const [mappingRulesVersion, companiesVersion] = await Promise.all([
      ruleResolver.getGlobalVersion(ENTITY_TYPES.MAPPING_RULES),
      ruleResolver.getGlobalVersion(ENTITY_TYPES.COMPANIES),
    ]);

    const data: VersionData = {
      mappingRules: mappingRulesVersion,
      companies: companiesVersion,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[RulesVersionAPI] Error:', error);

    return NextResponse.json(
      {
        type: 'internal_error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to fetch rule versions',
      },
      { status: 500 }
    );
  }
}
