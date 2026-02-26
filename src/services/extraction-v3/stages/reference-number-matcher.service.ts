/**
 * @fileoverview Reference Number Matcher 服務
 * @description
 *   在 extraction pipeline 的 FILE_PREPARATION 後執行，
 *   使用 DB-first substring 匹配（ILIKE）從文件名中匹配 Reference Numbers。
 *   功能預設關閉，由 PipelineConfig 控制。
 *
 * @module src/services/extraction-v3/stages/reference-number-matcher
 * @since CHANGE-032 - Pipeline Reference Number Matching & FX Conversion
 * @lastModified 2026-02-10 (CHANGE-036: 移除 regex，改用 DB substring 匹配)
 *
 * @features
 *   - DB-first substring 匹配（CHANGE-036）
 *   - 按 number 長度降序排列，避免短號碼假陽性
 *   - 支援可配置的 reference number types
 *   - 條件阻塞：當 refMatchEnabled=true 且 matchesFound=0 時，
 *     由調用方（extraction-v3.service.ts）決定中止 pipeline（FIX-036）
 *
 * @dependencies
 *   - src/services/reference-number.service.ts - findMatchesInText
 *   - src/types/extraction-v3.types.ts - ReferenceNumberMatchResult
 *
 * @related
 *   - src/services/pipeline-config.service.ts - 配置解析
 *   - src/services/extraction-v3/extraction-v3.service.ts - 主 pipeline
 */

import { findMatchesInText } from '@/services/reference-number.service';
import type {
  EffectivePipelineConfig,
  ReferenceNumberMatchResult,
  ReferenceNumberMatch,
} from '@/types/extraction-v3.types';

// ============================================================================
// Service Class
// ============================================================================

export class ReferenceNumberMatcherService {
  /**
   * 執行 reference number 匹配
   *
   * @description
   *   CHANGE-036: 使用 DB substring 匹配取代 regex 提取。
   *   直接將文件名傳入 findMatchesInText()，由 PostgreSQL ILIKE 執行匹配。
   *
   * @param input - 匹配輸入參數
   * @returns 匹配結果
   */
  async match(input: {
    fileName: string;
    config: EffectivePipelineConfig;
    regionId?: string;
  }): Promise<ReferenceNumberMatchResult> {
    const startTime = Date.now();

    // 功能未啟用
    if (!input.config.refMatchEnabled) {
      return {
        enabled: false,
        matches: [],
        summary: { candidatesFound: 0, matchesFound: 0, sources: [] },
        processingTimeMs: Date.now() - startTime,
      };
    }

    if (!input.fileName) {
      return {
        enabled: true,
        matches: [],
        summary: { candidatesFound: 0, matchesFound: 0, sources: [] },
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 移除副檔名後進行匹配
    const nameWithoutExt = input.fileName.replace(/\.[^.]+$/, '');

    // CHANGE-036: DB-first substring 匹配
    const dbMatches = await findMatchesInText({
      text: nameWithoutExt,
      types: input.config.refMatchTypes,
      regionId: input.regionId,
      maxResults: input.config.refMatchMaxResults,
    });

    // 轉換為 ReferenceNumberMatch 格式
    const matches: ReferenceNumberMatch[] = dbMatches.map((m) => ({
      candidate: nameWithoutExt,
      referenceNumberId: m.id,
      referenceNumber: m.number,
      type: m.type,
      confidence: 100,
    }));

    return {
      enabled: true,
      matches,
      summary: {
        candidatesFound: dbMatches.length > 0 ? 1 : 0,
        matchesFound: matches.length,
        sources: dbMatches.length > 0 ? ['filename'] : [],
      },
      processingTimeMs: Date.now() - startTime,
      // FIX-036: 啟用且無匹配時標記為應中止
      shouldAbortPipeline: matches.length === 0,
    };
  }
}
