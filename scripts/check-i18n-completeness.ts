/**
 * @fileoverview i18n 完整性檢查腳本
 * @description
 *   檢查 TypeScript 常量定義是否有對應的 i18n 翻譯
 *   - 解析 PROMPT_TYPES 等常量
 *   - 對照 messages/ 下的翻譯文件
 *   - 報告缺失的翻譯 key
 *
 * @usage
 *   npm run i18n:check
 *
 * @module scripts/check-i18n-completeness
 * @since CHANGE-026
 * @lastModified 2026-02-03
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 配置：常量與 i18n 的映射規則
// ============================================================

interface MappingRule {
  /** 常量來源文件 */
  sourceFile: string;
  /** 常量名稱 */
  constantName: string;
  /** 對應的 i18n 文件（不含 locale） */
  i18nFile: string;
  /** i18n 中的路徑前綴 */
  i18nKeyPrefix: string;
  /** 如何從常量值提取 key */
  keyExtractor: (value: string) => string;
}

const MAPPING_RULES: MappingRule[] = [
  {
    sourceFile: 'src/types/prompt-config.ts',
    constantName: 'PROMPT_TYPES',
    i18nFile: 'promptConfig.json',
    i18nKeyPrefix: 'types',
    keyExtractor: (value) => value, // 直接使用 value
  },
  // 可以繼續添加其他映射規則
];

const SUPPORTED_LOCALES = ['en', 'zh-TW', 'zh-CN'];

// ============================================================
// 工具函數
// ============================================================

/**
 * 從 TypeScript 文件中提取常量的 key（改進版）
 */
function extractConstantKeys(filePath: string, constantName: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');

  // 找到常量開始的位置
  const constStart = content.indexOf(`export const ${constantName}`);
  if (constStart === -1) {
    console.warn(`Warning: Could not find constant ${constantName} in ${filePath}`);
    return [];
  }

  // 找到常量結束的位置（} as const 或 };）
  let braceCount = 0;
  let started = false;
  let endPos = constStart;

  for (let i = constStart; i < content.length; i++) {
    const char = content[i];
    if (char === '{') {
      braceCount++;
      started = true;
    } else if (char === '}') {
      braceCount--;
      if (started && braceCount === 0) {
        endPos = i + 1;
        break;
      }
    }
  }

  const constantBody = content.substring(constStart, endPos);

  // 提取所有頂層 key（例如 ISSUER_IDENTIFICATION:）
  // 使用更精確的正則表達式
  const keys: string[] = [];
  const lines = constantBody.split('\n');

  for (const line of lines) {
    // 匹配類似 "  KEY_NAME: {" 的模式
    const match = line.match(/^\s+([A-Z][A-Z0-9_]*)\s*:\s*\{/);
    if (match) {
      keys.push(match[1]);
    }
  }

  return keys;
}

/**
 * 從 i18n JSON 文件中提取指定路徑下的 key
 */
function extractI18nKeys(filePath: string, keyPrefix: string): string[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: i18n file not found: ${filePath}`);
    return [];
  }

  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // 根據 keyPrefix 導航到正確的位置
  const parts = keyPrefix.split('.');
  let current = content;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      console.warn(`Warning: Key prefix "${keyPrefix}" not found in ${filePath}`);
      return [];
    }
  }

  if (typeof current !== 'object') {
    return [];
  }

  return Object.keys(current);
}

/**
 * 檢查單個映射規則
 */
function checkMappingRule(rule: MappingRule): {
  rule: MappingRule;
  missingByLocale: Record<string, string[]>;
  extraByLocale: Record<string, string[]>;
} {
  const sourceKeys = extractConstantKeys(
    path.join(process.cwd(), rule.sourceFile),
    rule.constantName
  );

  console.log(`   發現常量 keys: ${sourceKeys.join(', ')}`);

  const missingByLocale: Record<string, string[]> = {};
  const extraByLocale: Record<string, string[]> = {};

  for (const locale of SUPPORTED_LOCALES) {
    const i18nPath = path.join(process.cwd(), 'messages', locale, rule.i18nFile);
    const i18nKeys = extractI18nKeys(i18nPath, rule.i18nKeyPrefix);

    // 找出缺失的翻譯（在常量中但不在 i18n 中）
    const missing = sourceKeys.filter(
      (key) => !i18nKeys.includes(rule.keyExtractor(key))
    );

    // 找出多餘的翻譯（在 i18n 中但不在常量中）
    const extra = i18nKeys.filter(
      (i18nKey) => !sourceKeys.some((key) => rule.keyExtractor(key) === i18nKey)
    );

    if (missing.length > 0) {
      missingByLocale[locale] = missing;
    }
    if (extra.length > 0) {
      extraByLocale[locale] = extra;
    }
  }

  return { rule, missingByLocale, extraByLocale };
}

// ============================================================
// 主程序
// ============================================================

function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║            i18n 完整性檢查                                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let hasErrors = false;

  for (const rule of MAPPING_RULES) {
    console.log(`\n📋 檢查: ${rule.constantName}`);
    console.log(`   來源: ${rule.sourceFile}`);
    console.log(`   i18n: messages/*/${rule.i18nFile} → ${rule.i18nKeyPrefix}`);
    console.log('   ─────────────────────────────────────────');

    const result = checkMappingRule(rule);

    // 報告缺失的翻譯
    const hasMissing = Object.keys(result.missingByLocale).length > 0;
    if (hasMissing) {
      hasErrors = true;
      console.log('\n   ❌ 缺失的翻譯:');
      for (const [locale, keys] of Object.entries(result.missingByLocale)) {
        console.log(`      [${locale}]`);
        for (const key of keys) {
          console.log(`        - ${result.rule.i18nKeyPrefix}.${key}`);
        }
      }
    }

    // 報告多餘的翻譯（警告，非錯誤）
    const hasExtra = Object.keys(result.extraByLocale).length > 0;
    if (hasExtra) {
      console.log('\n   ⚠️  多餘的翻譯（可能是舊的、未清理）:');
      for (const [locale, keys] of Object.entries(result.extraByLocale)) {
        console.log(`      [${locale}]`);
        for (const key of keys) {
          console.log(`        - ${result.rule.i18nKeyPrefix}.${key}`);
        }
      }
    }

    if (!hasMissing && !hasExtra) {
      console.log('\n   ✅ 所有翻譯完整');
    }
  }

  console.log('\n');
  console.log('════════════════════════════════════════════════════════════');

  if (hasErrors) {
    console.log('❌ 檢查失敗：有缺失的翻譯，請更新 messages/ 文件');
    process.exit(1);
  } else {
    console.log('✅ 檢查通過：所有 i18n 翻譯完整');
    process.exit(0);
  }
}

main();
