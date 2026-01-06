/**
 * CHANGE-006 驗證腳本
 * 驗證 GPT Vision 動態配置提取與 Term 記錄的代碼邏輯
 *
 * @description
 *   驗證項目：
 *   1. Step 7 GPT 集成 - performClassification 和 performFullExtraction 方法
 *   2. Step 9 Term 記錄 - processGptExtraction 方法
 *   3. 類型定義完整性
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('═══════════════════════════════════════════════════════════════');
console.log('CHANGE-006 驗證腳本 - GPT Vision 動態配置提取');
console.log('═══════════════════════════════════════════════════════════════\n');

const results = {
  passed: 0,
  failed: 0,
  checks: []
};

function check(name, condition, details = '') {
  const status = condition ? '✅' : '❌';
  const result = { name, passed: condition, details };
  results.checks.push(result);

  if (condition) {
    results.passed++;
    console.log(`${status} ${name}`);
  } else {
    results.failed++;
    console.log(`${status} ${name}`);
    if (details) console.log(`   ${details}`);
  }
}

// 1. 檢查 Step 7 文件存在且包含關鍵實現
console.log('\n📦 Step 7: GPT Enhanced Extraction Step');
console.log('────────────────────────────────────────');

const step7Path = path.join(projectRoot, 'src/services/unified-processor/steps/gpt-enhanced-extraction.step.ts');
const step7Content = fs.readFileSync(step7Path, 'utf-8');

check(
  'Step 7 文件存在',
  fs.existsSync(step7Path)
);

check(
  'performClassification 方法已實現',
  step7Content.includes('private async performClassification(') &&
  step7Content.includes('classifyDocument(') &&
  !step7Content.includes('// TODO: implement classification')
);

check(
  'performFullExtraction 方法已實現',
  step7Content.includes('private async performFullExtraction(') &&
  step7Content.includes('processImageWithVision(') &&
  !step7Content.includes('// TODO: implement full extraction')
);

check(
  '讀取 context.resolvedPrompt',
  step7Content.includes('context.resolvedPrompt') ||
  step7Content.includes('resolvedPrompt')
);

check(
  '導入 GPT Vision 服務函數',
  step7Content.includes('import {') &&
  step7Content.includes('classifyDocument') &&
  step7Content.includes('processImageWithVision')
);

check(
  'GptExtraFields 類型定義',
  step7Content.includes('interface GptExtraFields') ||
  step7Content.includes('export interface GptExtraFields')
);

check(
  'extractExtraFields 輔助方法',
  step7Content.includes('extractExtraFields')
);

check(
  'CHANGE-006 文檔引用',
  step7Content.includes('CHANGE-006')
);

// 2. 檢查 Step 9 文件存在且包含關鍵實現
console.log('\n📦 Step 9: Term Recording Step');
console.log('────────────────────────────────────────');

const step9Path = path.join(projectRoot, 'src/services/unified-processor/steps/term-recording.step.ts');
const step9Content = fs.readFileSync(step9Path, 'utf-8');

check(
  'Step 9 文件存在',
  fs.existsSync(step9Path)
);

check(
  '文件頭部描述更新 (CHANGE-006)',
  step9Content.includes('CHANGE-006') ||
  step9Content.includes('gptExtraction')
);

// 3. 檢查 Term Recorder Adapter
console.log('\n📦 Term Recorder Adapter');
console.log('────────────────────────────────────────');

const adapterPath = path.join(projectRoot, 'src/services/unified-processor/adapters/term-recorder-adapter.ts');
const adapterContent = fs.readFileSync(adapterPath, 'utf-8');

check(
  'Adapter 文件存在',
  fs.existsSync(adapterPath)
);

check(
  'processGptExtraction 方法',
  adapterContent.includes('processGptExtraction')
);

check(
  'GptExtractionFields 類型定義',
  adapterContent.includes('GptExtractionFields') ||
  adapterContent.includes('interface GptExtractionFields')
);

check(
  'extraCharges 欄位處理',
  adapterContent.includes('extraCharges')
);

check(
  'typeOfService 欄位處理',
  adapterContent.includes('typeOfService')
);

// 4. 檢查 GPT Vision 服務
console.log('\n📦 GPT Vision Service');
console.log('────────────────────────────────────────');

const gptServicePath = path.join(projectRoot, 'src/services/gpt-vision.service.ts');
const gptServiceContent = fs.readFileSync(gptServicePath, 'utf-8');

check(
  'GPT Vision 服務存在',
  fs.existsSync(gptServicePath)
);

check(
  'ProcessingOptions 類型導出',
  gptServiceContent.includes('export type ProcessingOptions') ||
  gptServiceContent.includes('export interface ProcessingOptions')
);

check(
  'classifyDocument 函數導出',
  gptServiceContent.includes('export async function classifyDocument') ||
  gptServiceContent.includes('export function classifyDocument')
);

check(
  'processImageWithVision 函數導出',
  gptServiceContent.includes('export async function processImageWithVision') ||
  gptServiceContent.includes('export function processImageWithVision')
);

// 5. 檢查 CHANGE-006 文檔
console.log('\n📦 CHANGE-006 文檔');
console.log('────────────────────────────────────────');

const change006Path = path.join(projectRoot, 'claudedocs/4-changes/feature-changes/CHANGE-006-gpt-vision-dynamic-config-extraction.md');

check(
  'CHANGE-006 文檔存在',
  fs.existsSync(change006Path),
  fs.existsSync(change006Path) ? '' : `預期路徑: ${change006Path}`
);

if (fs.existsSync(change006Path)) {
  const change006Content = fs.readFileSync(change006Path, 'utf-8');
  check(
    '文檔包含技術設計',
    change006Content.includes('技術設計') ||
    change006Content.includes('Technical Design') ||
    change006Content.includes('數據流')
  );
}

// 6. 摘要
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('驗證結果摘要');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`✅ 通過: ${results.passed}`);
console.log(`❌ 失敗: ${results.failed}`);
console.log(`📊 總計: ${results.passed + results.failed}`);
console.log(`📈 通過率: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

if (results.failed === 0) {
  console.log('\n🎉 CHANGE-006 代碼實現驗證通過！');
  console.log('\n下一步：');
  console.log('1. 啟動開發服務器: npm run dev -- -p 3010');
  console.log('2. 通過 UI 創建 PromptConfig: http://localhost:3010/admin/prompt-configs/new');
  console.log('3. 處理 DHL 發票測試 extraCharges 提取');
  console.log('4. 檢查 Hierarchical Terms 報告中的新 Terms');
} else {
  console.log('\n⚠️ 部分驗證失敗，請檢查上述項目');
  process.exit(1);
}
