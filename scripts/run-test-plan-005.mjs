/**
 * @fileoverview TEST-PLAN-005 完整歷史數據初始化測試腳本
 * @description 執行 Epic 0 完整流程測試：
 *   - 創建新批次
 *   - 上傳所有 Doc Sample 文件（132個）
 *   - 監控處理進度
 *   - 驗證結果
 *   - 導出術語報告
 *
 * @module scripts/run-test-plan-005
 * @since Epic 0 - TEST-PLAN-005
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3010';
const DOC_SAMPLE_PATH = path.join(__dirname, '..', 'docs', 'Doc Sample');
const TEST_OUTPUT_PATH = path.join(__dirname, '..', 'claudedocs', '5-status', 'testing');

// 測試結果
const testResults = {
  startTime: new Date(),
  endTime: null,
  batchId: null,
  batchName: null,
  totalFiles: 0,
  uploadedFiles: 0,
  processedFiles: 0,
  successFiles: 0,
  failedFiles: 0,
  companiesCreated: 0,
  formatsCreated: 0,
  termsAggregated: 0,
  totalOccurrences: 0,
  errors: [],
  timeline: [],
  processingMethods: {},
  issuerStats: null,
  estimatedCost: 0
};

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp.slice(11, 19)}] [${type}] ${message}`;
  console.log(logMessage);
  testResults.timeline.push({ timestamp, type, message });
}

async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    log(`Request failed: ${endpoint} - ${error.message}`, 'ERROR');
    throw error;
  }
}

async function createBatch() {
  log('Creating new batch...');

  const batchName = `TEST-PLAN-005-Full-${new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')}`;

  const result = await makeRequest('/api/admin/historical-data/batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: batchName,
      description: 'TEST-PLAN-005: 完整歷史數據初始化測試 - 132 個 PDF 文件'
    })
  });

  testResults.batchId = result.data.id;
  testResults.batchName = batchName;
  log(`Batch created: ${result.data.id} (${batchName})`);
  return result.data;
}

async function uploadFiles(batchId) {
  log('Scanning Doc Sample folder...');

  const files = fs.readdirSync(DOC_SAMPLE_PATH)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(DOC_SAMPLE_PATH, f));

  testResults.totalFiles = files.length;
  log(`Found ${files.length} PDF files to upload`);

  // 分批上傳（每批 10 個文件）
  const BATCH_SIZE = 10;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const formData = new FormData();

    for (const filePath of batch) {
      const fileName = path.basename(filePath);
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      formData.append('files', blob, fileName);
    }
    formData.append('batchId', batchId);

    try {
      const result = await makeRequest('/api/admin/historical-data/files/upload', {
        method: 'POST',
        body: formData
      });

      testResults.uploadedFiles += batch.length;
      log(`Uploaded batch ${Math.ceil((i + 1) / BATCH_SIZE)}/${Math.ceil(files.length / BATCH_SIZE)} (${testResults.uploadedFiles}/${files.length} files)`);
    } catch (error) {
      log(`Upload batch failed: ${error.message}`, 'ERROR');
      testResults.errors.push({ phase: 'upload', batch: i, error: error.message });
    }

    // 小延遲避免過載
    await new Promise(r => setTimeout(r, 500));
  }

  log(`Upload complete: ${testResults.uploadedFiles}/${testResults.totalFiles} files`);
}

async function startProcessing(batchId) {
  log('Starting batch processing...');

  await makeRequest(`/api/admin/historical-data/batches/${batchId}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      processingOptions: {
        enableDualProcessing: true,
        enableIssuerIdentification: true,
        enableTermAggregation: true
      }
    })
  });

  log('Processing started');
}

async function monitorProgress(batchId) {
  log('Monitoring processing progress...');

  const startTime = Date.now();
  const MAX_WAIT_TIME = 90 * 60 * 1000; // 90 minutes max
  const POLL_INTERVAL = 15000; // 15 seconds

  while (true) {
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_WAIT_TIME) {
      log('Maximum wait time exceeded', 'WARN');
      break;
    }

    try {
      const result = await makeRequest(`/api/admin/historical-data/batches/${batchId}`);
      const batch = result.data;

      const processed = batch.processedCount || 0;
      const total = batch.totalCount || testResults.totalFiles;
      const status = batch.status;
      const elapsedMin = Math.floor(elapsed / 60000);
      const elapsedSec = Math.floor((elapsed % 60000) / 1000);

      log(`Progress: ${processed}/${total} files (${status}) - ${elapsedMin}m ${elapsedSec}s elapsed`);

      testResults.processedFiles = processed;

      if (status === 'COMPLETED' || status === 'AGGREGATED') {
        log(`Processing completed with status: ${status}`);
        break;
      }

      if (status === 'FAILED' || status === 'CANCELLED') {
        log(`Processing ended with status: ${status}`, 'ERROR');
        break;
      }

    } catch (error) {
      log(`Progress check failed: ${error.message}`, 'WARN');
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

async function verifyResults(batchId) {
  log('Verifying results...');

  // 獲取批次詳情
  const batchResult = await makeRequest(`/api/admin/historical-data/batches/${batchId}`);
  const batch = batchResult.data;

  testResults.processedFiles = batch.processedCount || 0;
  testResults.successFiles = batch.successCount || 0;
  testResults.failedFiles = batch.failedCount || 0;

  // 獲取文件列表
  const filesResult = await makeRequest(`/api/admin/historical-data/batches/${batchId}/files?limit=200`);
  const files = filesResult.data || [];

  // 統計發行者識別和處理方式
  const issuerStats = {
    identified: 0,
    header: 0,
    logo: 0,
    notIdentified: 0
  };

  const processingMethods = {
    DUAL_PROCESSING: 0,
    GPT_VISION: 0,
    AZURE_DI: 0,
    OTHER: 0
  };

  for (const file of files) {
    // 發行者統計
    if (file.documentIssuerId) {
      issuerStats.identified++;
      if (file.issuerIdentificationMethod === 'HEADER') issuerStats.header++;
      if (file.issuerIdentificationMethod === 'LOGO') issuerStats.logo++;
    } else {
      issuerStats.notIdentified++;
    }

    // 處理方式統計
    const method = file.processingMethod || 'OTHER';
    if (processingMethods[method] !== undefined) {
      processingMethods[method]++;
    } else {
      processingMethods.OTHER++;
    }
  }

  testResults.issuerStats = issuerStats;
  testResults.processingMethods = processingMethods;

  // 獲取術語統計
  try {
    const termsResult = await makeRequest(`/api/admin/historical-data/batches/${batchId}/hierarchical-terms`);
    if (termsResult.data) {
      testResults.companiesCreated = termsResult.data.totalCompanies || 0;
      testResults.formatsCreated = termsResult.data.totalFormats || 0;
      testResults.termsAggregated = termsResult.data.totalTerms || 0;
      testResults.totalOccurrences = termsResult.data.totalOccurrences || 0;
    }
  } catch (error) {
    log(`Term stats failed: ${error.message}`, 'WARN');
  }

  // 估算成本
  // DUAL_PROCESSING: ~$0.02/page, GPT_VISION: ~$0.03/page
  testResults.estimatedCost =
    processingMethods.DUAL_PROCESSING * 0.02 +
    processingMethods.GPT_VISION * 0.03 +
    processingMethods.AZURE_DI * 0.01;

  log('=== VERIFICATION RESULTS ===');
  log(`Total Files: ${testResults.totalFiles}`);
  log(`Processed: ${testResults.processedFiles}`);
  log(`Success: ${testResults.successFiles}`);
  log(`Failed: ${testResults.failedFiles}`);
  log(`Issuer Identified: ${issuerStats.identified} (HEADER: ${issuerStats.header}, LOGO: ${issuerStats.logo})`);
  log(`Processing Methods: DUAL=${processingMethods.DUAL_PROCESSING}, GPT=${processingMethods.GPT_VISION}`);
  log(`Companies: ${testResults.companiesCreated}`);
  log(`Formats: ${testResults.formatsCreated}`);
  log(`Terms: ${testResults.termsAggregated} (${testResults.totalOccurrences} occurrences)`);
  log(`Estimated Cost: $${testResults.estimatedCost.toFixed(2)}`);
}

async function exportReport(batchId) {
  log('Exporting hierarchical terms report...');

  // 確保輸出目錄存在
  const reportsDir = path.join(TEST_OUTPUT_PATH, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  try {
    const response = await fetch(`${BASE_URL}/api/admin/historical-data/batches/${batchId}/hierarchical-terms/export`);

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const fileName = `TEST-PLAN-005-hierarchical-terms-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const filePath = path.join(reportsDir, fileName);

    fs.writeFileSync(filePath, Buffer.from(buffer));
    log(`Report exported: ${filePath}`);

    testResults.exportedReport = filePath;
  } catch (error) {
    log(`Export failed: ${error.message}`, 'ERROR');
    testResults.errors.push({ phase: 'export', error: error.message });
  }
}

function generateTestReport() {
  testResults.endTime = new Date();
  const duration = (testResults.endTime - testResults.startTime) / 1000;

  const report = `# TEST-REPORT-005: Epic 0 完整歷史數據初始化測試報告

> **版本**: 1.0.0
> **執行日期**: ${testResults.startTime.toISOString().slice(0, 10)}
> **批次 ID**: \`${testResults.batchId}\`
> **批次名稱**: ${testResults.batchName}
> **總耗時**: ${Math.floor(duration / 60)} 分 ${Math.floor(duration % 60)} 秒

---

## 1. 測試概覽

### 1.1 測試目的
驗證 Epic 0 歷史數據初始化完整流程，包括：
- 批次文件上傳
- 雙重處理（Native PDF / Scanned PDF）
- 文件發行者識別
- 階層式術語聚合
- 報告導出

### 1.2 測試環境
- **伺服器**: localhost:3010
- **文件來源**: docs/Doc Sample/
- **測試日期**: ${testResults.startTime.toISOString().slice(0, 10)}

---

## 2. 執行結果

### 2.1 文件處理統計

| 指標 | 結果 |
|------|------|
| **總文件數** | ${testResults.totalFiles} |
| **上傳成功** | ${testResults.uploadedFiles} |
| **處理完成** | ${testResults.processedFiles} |
| **成功處理** | ${testResults.successFiles} |
| **處理失敗** | ${testResults.failedFiles} |
| **成功率** | ${testResults.totalFiles > 0 ? ((testResults.successFiles / testResults.totalFiles) * 100).toFixed(1) : 0}% |

### 2.2 處理方式分佈

| 處理方式 | 數量 | 說明 |
|----------|------|------|
| **DUAL_PROCESSING** | ${testResults.processingMethods.DUAL_PROCESSING || 0} | Native PDF (GPT 分類 + Azure DI 提取) |
| **GPT_VISION** | ${testResults.processingMethods.GPT_VISION || 0} | Scanned PDF (GPT Vision 完整處理) |
| **AZURE_DI** | ${testResults.processingMethods.AZURE_DI || 0} | Azure Document Intelligence |
| **OTHER** | ${testResults.processingMethods.OTHER || 0} | 其他方式 |

### 2.3 發行者識別結果

| 指標 | 數量 |
|------|------|
| **已識別** | ${testResults.issuerStats?.identified || 0} |
| **HEADER 方式** | ${testResults.issuerStats?.header || 0} |
| **LOGO 方式** | ${testResults.issuerStats?.logo || 0} |
| **未識別** | ${testResults.issuerStats?.notIdentified || 0} |
| **識別率** | ${testResults.totalFiles > 0 ? ((testResults.issuerStats?.identified / testResults.totalFiles) * 100).toFixed(1) : 0}% |

### 2.4 術語聚合結果

| 指標 | 數量 |
|------|------|
| **公司數量** | ${testResults.companiesCreated} |
| **格式數量** | ${testResults.formatsCreated} |
| **唯一術語** | ${testResults.termsAggregated} |
| **總出現次數** | ${testResults.totalOccurrences} |

### 2.5 成本估算

| 指標 | 金額 |
|------|------|
| **總成本** | $${testResults.estimatedCost.toFixed(2)} |
| **平均每文件** | $${testResults.totalFiles > 0 ? (testResults.estimatedCost / testResults.totalFiles).toFixed(4) : 0} |

---

## 3. 導出報告

${testResults.exportedReport ? `✅ **已成功導出**: \`${path.basename(testResults.exportedReport)}\`` : '❌ **導出失敗**'}

---

## 4. 錯誤記錄

${testResults.errors.length === 0 ? '✅ **無錯誤**' : testResults.errors.map(e => `- **${e.phase}**: ${e.error}`).join('\n')}

---

## 5. 執行時間線

| 時間 | 類型 | 訊息 |
|------|------|------|
${testResults.timeline.slice(-30).map(t => `| ${t.timestamp.slice(11, 19)} | ${t.type} | ${t.message} |`).join('\n')}

---

## 6. 測試結論

### 6.1 通過標準

| 標準 | 目標 | 實際 | 結果 |
|------|------|------|------|
| 文件處理成功率 | ≥95% | ${testResults.totalFiles > 0 ? ((testResults.successFiles / testResults.totalFiles) * 100).toFixed(1) : 0}% | ${(testResults.successFiles / testResults.totalFiles) >= 0.95 ? '✅ PASS' : '❌ FAIL'} |
| 發行者識別率 | ≥70% | ${testResults.totalFiles > 0 ? ((testResults.issuerStats?.identified / testResults.totalFiles) * 100).toFixed(1) : 0}% | ${(testResults.issuerStats?.identified / testResults.totalFiles) >= 0.70 ? '✅ PASS' : '⚠️ REVIEW'} |
| 術語聚合完成 | >0 | ${testResults.termsAggregated} | ${testResults.termsAggregated > 0 ? '✅ PASS' : '❌ FAIL'} |
| 報告導出 | 成功 | ${testResults.exportedReport ? '成功' : '失敗'} | ${testResults.exportedReport ? '✅ PASS' : '❌ FAIL'} |

### 6.2 整體結論

${
  (testResults.successFiles / testResults.totalFiles) >= 0.95 &&
  testResults.termsAggregated > 0 &&
  testResults.exportedReport
    ? '**✅ TEST-PLAN-005 測試通過**'
    : '**⚠️ TEST-PLAN-005 測試需要審核**'
}

---

**測試執行者**: Claude Code AI 助手
**報告生成時間**: ${testResults.endTime.toISOString()}
`;

  const reportPath = path.join(TEST_OUTPUT_PATH, 'reports', `TEST-REPORT-005-EPIC-0-FULL-E2E.md`);
  fs.writeFileSync(reportPath, report);
  log(`Test report generated: ${reportPath}`);

  return report;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  TEST-PLAN-005: 完整歷史數據初始化測試                     ║');
  console.log('║  文件數量: 132 個 PDF                                     ║');
  console.log('║  伺服器: localhost:3010                                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Step 1: 創建批次
    const batch = await createBatch();

    // Step 2: 上傳文件
    await uploadFiles(batch.id);

    // Step 3: 開始處理
    await startProcessing(batch.id);

    // Step 4: 監控進度
    await monitorProgress(batch.id);

    // Step 5: 驗證結果
    await verifyResults(batch.id);

    // Step 6: 導出報告
    await exportReport(batch.id);

    // Step 7: 生成測試報告
    const report = generateTestReport();

    console.log('\n' + '═'.repeat(60));
    console.log('TEST COMPLETED');
    console.log('═'.repeat(60));
    console.log(report);

  } catch (error) {
    log(`Test failed: ${error.message}`, 'FATAL');
    console.error(error);
    process.exit(1);
  }
}

main();
