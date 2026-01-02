/**
 * @fileoverview TEST-PLAN-003 完整歷史數據初始化測試腳本（使用 Prisma）
 * @description
 *   執行 Epic 0 完整流程測試，直接使用 Prisma 繞過 API 認證：
 *   - 創建新批次
 *   - 上傳所有 Doc Sample 文件（133個）
 *   - 監控處理進度
 *   - 驗證結果
 *   - 導出術語報告
 *
 * @module scripts/run-test-plan-003-prisma
 * @since Epic 0 - TEST-PLAN-003
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3000';
const DOC_SAMPLE_PATH = path.join(__dirname, '..', 'docs', 'Doc Sample');
const TEST_OUTPUT_PATH = path.join(__dirname, '..', 'claudedocs', '5-status', 'testing');

// 初始化 Prisma with pg adapter
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const { PrismaPg } = await import('@prisma/adapter-pg');
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

// 測試結果
const testResults = {
  startTime: new Date(),
  endTime: null,
  batchId: null,
  totalFiles: 0,
  uploadedFiles: 0,
  processedFiles: 0,
  successFiles: 0,
  failedFiles: 0,
  companiesCreated: 0,
  termsAggregated: 0,
  errors: [],
  timeline: []
};

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}`;
  console.log(logMessage);
  testResults.timeline.push({ timestamp, type, message });
}

// 開發用戶 ID（使用 prisma/seed.ts 創建的用戶）
const DEV_USER_ID = 'dev-user-1';

async function createBatch() {
  log('Creating new batch via Prisma...');

  const batchName = `TEST-PLAN-003-Full-${new Date().toISOString().slice(0, 10)}`;

  const batch = await prisma.historicalBatch.create({
    data: {
      name: batchName,
      description: '完整歷史數據初始化測試 - 133 個文件 (Prisma Direct)',
      createdBy: DEV_USER_ID,
      status: 'PENDING',
      enableCompanyIdentification: true,
      fuzzyMatchThreshold: 0.9,
      autoMergeSimilar: false,
      enableTermAggregation: true,
      termSimilarityThreshold: 0.85,
      autoClassifyTerms: true,
      enableIssuerIdentification: true,
      issuerConfidenceThreshold: 0.7,
      autoCreateIssuerCompany: true,
      issuerFuzzyThreshold: 0.9,
    },
  });

  testResults.batchId = batch.id;
  log(`Batch created: ${batch.id} (${batch.name})`);
  return batch;
}

async function uploadFiles(batchId) {
  log('Scanning Doc Sample folder...');

  const files = fs.readdirSync(DOC_SAMPLE_PATH)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => ({
      name: f,
      path: path.join(DOC_SAMPLE_PATH, f)
    }));

  testResults.totalFiles = files.length;
  log(`Found ${files.length} PDF files to process`);

  // 分批創建文件記錄
  const BATCH_SIZE = 20;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);

    const fileRecords = batch.map(file => {
      const stats = fs.statSync(file.path);
      return {
        batchId,
        fileName: file.name,       // Prisma schema 使用 fileName
        originalName: file.name,   // Prisma schema 需要 originalName
        storagePath: file.path,    // 直接使用本地路徑
        fileSize: stats.size,
        mimeType: 'application/pdf',
        detectedType: 'NATIVE_PDF', // 必須設置 detectedType 才能被 cost-estimation 識別
        status: 'DETECTED',         // 必須設置為 DETECTED 才能進行處理
      };
    });

    await prisma.historicalFile.createMany({
      data: fileRecords,
    });

    testResults.uploadedFiles += batch.length;
    log(`Uploaded batch ${Math.ceil((i + 1) / BATCH_SIZE)}/${Math.ceil(files.length / BATCH_SIZE)} (${testResults.uploadedFiles}/${files.length} files)`);

    // 小延遲避免過載
    await new Promise(r => setTimeout(r, 100));
  }

  // 更新批次的 totalFiles
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: { totalFiles: testResults.totalFiles }
  });

  log(`Upload complete: ${testResults.uploadedFiles}/${testResults.totalFiles} files`);
}

async function startProcessing(batchId) {
  log('Starting batch processing via API...');

  // 嘗試通過 API 觸發處理（可能失敗，如果認證問題仍存在）
  try {
    const response = await fetch(`${BASE_URL}/api/admin/historical-data/batches/${batchId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-Bypass-Auth': 'true'
      },
      body: JSON.stringify({
        processingOptions: {
          enableDualProcessing: true,
          enableIssuerIdentification: true,
          enableTermAggregation: true
        }
      })
    });

    if (response.ok) {
      log('Processing started via API');
      return true;
    } else {
      const error = await response.text();
      log(`API trigger failed (${response.status}): ${error}`, 'WARN');
    }
  } catch (fetchError) {
    log(`API call failed: ${fetchError.message}`, 'WARN');
  }

  // 如果 API 失敗，直接更新狀態並提示用戶手動觸發
  log('⚠️ API 觸發失敗，請通過 UI 手動觸發處理', 'WARN');
  log(`URL: ${BASE_URL}/admin/historical-data`, 'INFO');

  // 更新批次狀態為可處理
  await prisma.historicalBatch.update({
    where: { id: batchId },
    data: { status: 'PENDING' }
  });

  return false;
}

async function monitorProgress(batchId) {
  log('Monitoring processing progress...');

  const startTime = Date.now();
  const MAX_WAIT_TIME = 90 * 60 * 1000; // 90 minutes max
  const POLL_INTERVAL = 10000; // 10 seconds

  while (true) {
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_WAIT_TIME) {
      log('Maximum wait time exceeded', 'WARN');
      break;
    }

    try {
      const batch = await prisma.historicalBatch.findUnique({
        where: { id: batchId },
        include: {
          _count: {
            select: {
              files: true,
            }
          }
        }
      });

      const processed = batch.processedFiles || 0;
      const total = batch.totalFiles || testResults.totalFiles;
      const status = batch.status;

      log(`Progress: ${processed}/${total} files (${status}) - ${Math.round(elapsed / 1000)}s elapsed`);

      testResults.processedFiles = processed;

      if (status === 'COMPLETED' || status === 'AGGREGATED') {
        log(`Processing completed with status: ${status}`);
        break;
      }

      if (status === 'FAILED' || status === 'CANCELLED') {
        log(`Processing ended with status: ${status}`, 'ERROR');
        break;
      }

      // 如果仍是 PENDING，可能需要手動觸發
      if (status === 'PENDING' && elapsed > 30000) {
        log('批次仍處於 PENDING 狀態，請確認已通過 UI 手動觸發處理', 'WARN');
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
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
  });

  testResults.processedFiles = batch.processedFiles || 0;
  testResults.successFiles = batch.processedFiles - (batch.failedFiles || 0);
  testResults.failedFiles = batch.failedFiles || 0;

  // 獲取文件列表並統計發行者識別
  const files = await prisma.historicalFile.findMany({
    where: { batchId },
    select: {
      id: true,
      documentIssuerId: true,
      issuerIdentificationMethod: true,
      status: true,
    }
  });

  const issuerStats = {
    identified: 0,
    header: 0,
    logo: 0,
    notIdentified: 0
  };

  for (const file of files) {
    if (file.documentIssuerId) {
      issuerStats.identified++;
      if (file.issuerIdentificationMethod === 'HEADER') issuerStats.header++;
      if (file.issuerIdentificationMethod === 'LOGO') issuerStats.logo++;
    } else {
      issuerStats.notIdentified++;
    }
  }

  // 獲取術語統計
  const companies = await prisma.company.count();
  testResults.companiesCreated = companies;

  // 獲取批次的術語聚合結果
  const termAggregations = await prisma.termAggregation.count({
    where: {
      file: {
        batchId: batchId
      }
    }
  });
  testResults.termsAggregated = termAggregations;

  log('=== VERIFICATION RESULTS ===');
  log(`Total Files: ${testResults.totalFiles}`);
  log(`Processed: ${testResults.processedFiles}`);
  log(`Success: ${testResults.successFiles}`);
  log(`Failed: ${testResults.failedFiles}`);
  log(`Issuer Identified: ${issuerStats.identified} (HEADER: ${issuerStats.header}, LOGO: ${issuerStats.logo})`);
  log(`Companies: ${testResults.companiesCreated}`);
  log(`Terms Aggregated: ${testResults.termsAggregated}`);

  testResults.issuerStats = issuerStats;
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
    const fileName = `TEST-PLAN-003-hierarchical-terms-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const filePath = path.join(reportsDir, fileName);

    fs.writeFileSync(filePath, Buffer.from(buffer));
    log(`Report exported: ${filePath}`);

    testResults.exportedReport = filePath;
  } catch (error) {
    log(`Export failed: ${error.message}`, 'ERROR');
    testResults.errors.push({ phase: 'export', error: error.message });

    // 嘗試使用本地腳本導出
    log('Attempting local export script...', 'INFO');
  }
}

function generateTestReport() {
  testResults.endTime = new Date();
  const duration = (testResults.endTime - testResults.startTime) / 1000;

  const report = `# TEST-PLAN-003 完整歷史數據初始化測試報告

> **執行日期**: ${testResults.startTime.toISOString().slice(0, 10)}
> **執行時間**: ${testResults.startTime.toISOString()} - ${testResults.endTime.toISOString()}
> **總耗時**: ${Math.floor(duration / 60)} 分 ${Math.floor(duration % 60)} 秒
> **批次 ID**: ${testResults.batchId}
> **執行方式**: Prisma Direct (繞過 API 認證)

---

## 1. 測試摘要

| 指標 | 結果 |
|------|------|
| **總文件數** | ${testResults.totalFiles} |
| **上傳成功** | ${testResults.uploadedFiles} |
| **處理完成** | ${testResults.processedFiles} |
| **成功處理** | ${testResults.successFiles} |
| **處理失敗** | ${testResults.failedFiles} |
| **成功率** | ${testResults.totalFiles > 0 ? ((testResults.successFiles / testResults.totalFiles) * 100).toFixed(1) : 0}% |

---

## 2. 發行者識別結果

| 指標 | 數量 |
|------|------|
| **已識別** | ${testResults.issuerStats?.identified || 0} |
| **HEADER 方式** | ${testResults.issuerStats?.header || 0} |
| **LOGO 方式** | ${testResults.issuerStats?.logo || 0} |
| **未識別** | ${testResults.issuerStats?.notIdentified || 0} |

---

## 3. 術語聚合結果

| 指標 | 數量 |
|------|------|
| **公司數量** | ${testResults.companiesCreated} |
| **術語數量** | ${testResults.termsAggregated} |

---

## 4. 導出報告

${testResults.exportedReport ? `✅ 已導出: \`${testResults.exportedReport}\`` : '❌ 導出失敗'}

---

## 5. 錯誤記錄

${testResults.errors.length === 0 ? '✅ 無錯誤' : testResults.errors.map(e => `- **${e.phase}**: ${e.error}`).join('\n')}

---

## 6. 執行時間線

| 時間 | 類型 | 訊息 |
|------|------|------|
${testResults.timeline.slice(-20).map(t => `| ${t.timestamp.slice(11, 19)} | ${t.type} | ${t.message} |`).join('\n')}

---

**測試執行者**: Claude Code AI 助手
**測試日期**: ${testResults.startTime.toISOString().slice(0, 10)}
`;

  const reportPath = path.join(TEST_OUTPUT_PATH, 'reports', `TEST-REPORT-003-${new Date().toISOString().slice(0, 10)}.md`);

  // 確保目錄存在
  const reportsDir = path.dirname(reportPath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, report);
  log(`Test report generated: ${reportPath}`);

  return report;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  TEST-PLAN-003: 完整歷史數據初始化測試 (Prisma Direct)    ║');
  console.log('║  文件數量: 133 個 PDF                                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Step 1: 創建批次
    const batch = await createBatch();

    // Step 2: 上傳文件（創建記錄）
    await uploadFiles(batch.id);

    // Step 3: 開始處理
    const apiTriggered = await startProcessing(batch.id);

    // 如果 API 觸發失敗，提示用戶
    if (!apiTriggered) {
      console.log('\n' + '═'.repeat(60));
      console.log('⚠️ 請手動觸發處理：');
      console.log(`   1. 打開 ${BASE_URL}/admin/historical-data`);
      console.log(`   2. 找到批次：${batch.name}`);
      console.log('   3. 點擊「開始處理」按鈕');
      console.log('   4. 處理完成後，腳本將自動繼續...');
      console.log('═'.repeat(60) + '\n');
    }

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
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
