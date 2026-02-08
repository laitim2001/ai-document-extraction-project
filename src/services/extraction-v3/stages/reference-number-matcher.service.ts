/**
 * @fileoverview Reference Number Matcher 服務
 * @description
 *   在 extraction pipeline 的 FILE_PREPARATION 後執行，
 *   從文件名使用 regex 提取候選號碼，並比對 DB 中的 Reference Numbers。
 *   功能預設關閉，由 PipelineConfig 控制。
 *
 * @module src/services/extraction-v3/stages/reference-number-matcher
 * @since CHANGE-032 - Pipeline Reference Number Matching & FX Conversion
 * @lastModified 2026-02-08
 *
 * @features
 *   - 從文件名 regex 提取候選字串
 *   - 比對現有 validateReferenceNumbers 服務
 *   - 支援可配置的 reference number types 和 patterns
 *   - 非阻塞：失敗不中斷 pipeline
 *
 * @dependencies
 *   - src/services/reference-number.service.ts - validateReferenceNumbers
 *   - src/types/extraction-v3.types.ts - ReferenceNumberMatchResult
 *
 * @related
 *   - src/services/pipeline-config.service.ts - 配置解析
 *   - src/services/extraction-v3/extraction-v3.service.ts - 主 pipeline
 */

import { validateReferenceNumbers } from '@/services/reference-number.service';
import type {
  EffectivePipelineConfig,
  ReferenceNumberMatchResult,
  ReferenceNumberMatch,
} from '@/types/extraction-v3.types';

// ============================================================================
// Default Regex Patterns
// ============================================================================

/**
 * 預設的 reference number regex patterns
 * 每種類型有對應的常見格式
 */
const DEFAULT_PATTERNS: Record<string, RegExp[]> = {
  SHIPMENT: [
    /\bSHP[-_]?\d{6,15}\b/gi,
    /\b\d{3}[-_]\d{4,8}[-_]\d{2,4}\b/g,
  ],
  HAWB: [
    /\b\d{3}[-_]?\d{4}[-_]?\d{4}\b/g,
    /\bHAWB[-_]?\w{6,15}\b/gi,
  ],
  MAWB: [
    /\b\d{3}[-_]\d{8}\b/g,
    /\bMAWB[-_]?\w{6,15}\b/gi,
  ],
  BL: [
    /\bB\/L[-_]?\w{6,20}\b/gi,
    /\bBL[-_]?\w{6,20}\b/gi,
  ],
  CONTAINER: [
    /\b[A-Z]{4}\d{7}\b/g,
    /\bCNTR[-_]?\w{6,15}\b/gi,
  ],
  BOOKING: [
    /\bBKG[-_]?\w{6,15}\b/gi,
  ],
  CUSTOMS: [
    /\bCUS[-_]?\d{6,15}\b/gi,
  ],
};

// ============================================================================
// Service Class
// ============================================================================

export class ReferenceNumberMatcherService {
  /**
   * 執行 reference number 匹配
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

    const candidates: Array<{ value: string; type?: string }> = [];
    const sources: string[] = [];

    // 從文件名提取候選字串
    if (input.config.refMatchFromFilename && input.fileName) {
      const filenameCandidates = this.extractFromFilename(
        input.fileName,
        input.config.refMatchTypes,
        input.config.refMatchPatterns
      );
      candidates.push(...filenameCandidates);
      if (filenameCandidates.length > 0) {
        sources.push('filename');
      }
    }

    // 限制候選數量
    const limitedCandidates = candidates.slice(
      0,
      input.config.refMatchMaxCandidates
    );

    if (limitedCandidates.length === 0) {
      return {
        enabled: true,
        matches: [],
        summary: { candidatesFound: 0, matchesFound: 0, sources },
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 呼叫現有的 validateReferenceNumbers 服務
    const validationResult = await validateReferenceNumbers({
      numbers: limitedCandidates.map((c) => ({
        value: c.value,
        type: c.type as 'SHIPMENT' | 'DELIVERY' | 'BOOKING' | 'CONTAINER' | 'HAWB' | 'MAWB' | 'BL' | 'CUSTOMS' | 'OTHER' | undefined,
      })),
      options: {
        regionId: input.regionId,
      },
    });

    // 轉換為 ReferenceNumberMatch 格式
    const matches: ReferenceNumberMatch[] = [];
    for (const result of validationResult.results) {
      if (result.found) {
        for (const match of result.matches) {
          matches.push({
            candidate: result.value,
            referenceNumberId: match.id,
            referenceNumber: match.number,
            type: match.type,
            confidence: 100,
          });
        }
      }
    }

    return {
      enabled: true,
      matches,
      summary: {
        candidatesFound: limitedCandidates.length,
        matchesFound: matches.length,
        sources,
      },
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * 從文件名提取候選 reference numbers
   */
  private extractFromFilename(
    fileName: string,
    types: string[],
    customPatterns: Record<string, string> | null
  ): Array<{ value: string; type?: string }> {
    const candidates: Array<{ value: string; type?: string }> = [];
    const seen = new Set<string>();

    // 移除副檔名
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');

    for (const type of types) {
      // 使用自定義 pattern 或預設 pattern
      let patterns: RegExp[];
      if (customPatterns?.[type]) {
        try {
          patterns = [new RegExp(customPatterns[type], 'gi')];
        } catch {
          patterns = DEFAULT_PATTERNS[type] || [];
        }
      } else {
        patterns = DEFAULT_PATTERNS[type] || [];
      }

      for (const pattern of patterns) {
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(nameWithoutExt)) !== null) {
          const value = match[0].trim();
          if (!seen.has(value.toUpperCase())) {
            seen.add(value.toUpperCase());
            candidates.push({ value, type });
          }
        }
      }
    }

    return candidates;
  }
}
