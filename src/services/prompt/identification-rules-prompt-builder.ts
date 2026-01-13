/**
 * @fileoverview 識別規則 Prompt 生成器
 * @description
 *   將 DocumentFormat.identificationRules 轉換為 GPT Vision 可理解的 Prompt 文本。
 *   按優先級排序，讓 AI 根據規則更準確地識別文件格式。
 *
 * @module src/services/prompt
 * @since Epic 16 - Story 16.5
 * @lastModified 2026-01-13
 *
 * @features
 *   - 將識別規則轉換為結構化 Prompt
 *   - 按優先級排序格式
 *   - 支援 Logo 特徵、關鍵字、版面特徵
 *
 * @related
 *   - src/types/unified-processor.ts - FormatIdentificationRule 類型
 *   - src/types/document-format.ts - IdentificationRules 類型
 *   - src/services/unified-processor/steps/gpt-enhanced-extraction.step.ts
 */

import type { FormatIdentificationRule } from '@/types/unified-processor';
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_SUBTYPE_LABELS,
} from '@/types/document-format';

/**
 * 構建識別規則 Prompt 片段
 * @description
 *   將格式識別規則列表轉換為 GPT Vision 可理解的 Prompt 文本。
 *   規則按優先級降序排序，高優先級格式會優先被匹配。
 *
 * @param rules 格式識別規則列表
 * @returns Prompt 文本，如果沒有有效規則則返回空字串
 *
 * @example
 * ```typescript
 * const prompt = buildIdentificationRulesPrompt([
 *   {
 *     formatId: 'fmt_1',
 *     formatName: 'DHL Ocean Invoice',
 *     documentType: 'INVOICE',
 *     documentSubtype: 'OCEAN_FREIGHT',
 *     rules: {
 *       logoPatterns: [{ position: 'top-left', description: 'DHL Logo' }],
 *       keywords: ['Ocean Freight', 'B/L No'],
 *       layoutHints: '表格式發票',
 *       priority: 100,
 *     },
 *   },
 * ]);
 * ```
 */
export function buildIdentificationRulesPrompt(
  rules: FormatIdentificationRule[]
): string {
  if (!rules || rules.length === 0) {
    return '';
  }

  // 按優先級降序排序
  const sortedRules = [...rules].sort(
    (a, b) => (b.rules.priority || 50) - (a.rules.priority || 50)
  );

  // 過濾掉沒有任何規則的格式
  const validRules = sortedRules.filter(
    (r) =>
      (r.rules.logoPatterns && r.rules.logoPatterns.length > 0) ||
      (r.rules.keywords && r.rules.keywords.length > 0) ||
      r.rules.layoutHints
  );

  if (validRules.length === 0) {
    return '';
  }

  const rulesText = validRules
    .map((r, i) => formatSingleRule(r, i + 1))
    .join('\n');

  return `
## 已知文件格式識別規則

以下是此公司已知的文件格式，請根據這些規則幫助識別。如果文件符合某個格式的特徵，請優先使用該格式。

${rulesText}

請根據文件內容與上述規則，判斷最匹配的格式。如果沒有符合的格式，請根據文件本身特徵進行識別。
`;
}

/**
 * 格式化單個規則
 * @internal
 */
function formatSingleRule(
  rule: FormatIdentificationRule,
  index: number
): string {
  const { formatName, documentType, documentSubtype, rules } = rule;

  const typeLabel = DOCUMENT_TYPE_LABELS[documentType] || documentType;
  const subtypeLabel = DOCUMENT_SUBTYPE_LABELS[documentSubtype] || documentSubtype;

  const parts: string[] = [
    `### ${index}. ${formatName || '未命名格式'} (${typeLabel} - ${subtypeLabel})`,
    `- **識別優先級**: ${rules.priority || 50}/100`,
  ];

  // Logo 特徵
  if (rules.logoPatterns && rules.logoPatterns.length > 0) {
    const logoDesc = rules.logoPatterns
      .map((p) => `${getPositionLabel(p.position)}: ${p.description}`)
      .join('; ');
    parts.push(`- **Logo 特徵**: ${logoDesc}`);
  }

  // 關鍵字
  if (rules.keywords && rules.keywords.length > 0) {
    parts.push(`- **文件關鍵字**: ${rules.keywords.join(', ')}`);
  }

  // 版面特徵
  if (rules.layoutHints) {
    parts.push(`- **版面特徵**: ${rules.layoutHints}`);
  }

  return parts.join('\n');
}

/**
 * 取得位置標籤（中文）
 * @internal
 */
function getPositionLabel(position: string): string {
  const labels: Record<string, string> = {
    'top-left': '左上角',
    'top-right': '右上角',
    'top-center': '頂部中央',
    'bottom-left': '左下角',
    'bottom-right': '右下角',
    center: '中央',
  };
  return labels[position] || position;
}

/**
 * 計算是否有有效的識別規則
 * @description
 *   檢查規則列表中是否至少有一個規則包含有效的識別特徵
 *   （Logo 模式、關鍵字或版面特徵）
 *
 * @param rules 規則列表
 * @returns 是否有有效規則
 *
 * @example
 * ```typescript
 * if (hasValidIdentificationRules(context.formatIdentificationRules)) {
 *   const prompt = buildIdentificationRulesPrompt(context.formatIdentificationRules!);
 * }
 * ```
 */
export function hasValidIdentificationRules(
  rules: FormatIdentificationRule[] | undefined
): boolean {
  if (!rules || rules.length === 0) {
    return false;
  }

  return rules.some(
    (r) =>
      (r.rules.logoPatterns && r.rules.logoPatterns.length > 0) ||
      (r.rules.keywords && r.rules.keywords.length > 0) ||
      r.rules.layoutHints
  );
}
