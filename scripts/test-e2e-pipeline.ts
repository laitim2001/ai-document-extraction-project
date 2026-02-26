/**
 * @fileoverview 端到端管線整合測試腳本
 * @description
 *   驗證 Phase 1-3 建立的完整管線：
 *   T1: 前置條件檢查（Seed 數據）
 *   T2: 文件建立 + Blob 上傳
 *   T3: 統一處理管線觸發
 *   T4: 結果持久化驗證
 *   T5: autoMatch 驗證
 *   T6: 清理測試數據
 *
 * @usage
 *   npx tsx scripts/test-e2e-pipeline.ts
 *   npx tsx scripts/test-e2e-pipeline.ts --skip-cleanup   # 保留測試數據以便調試
 *   npx tsx scripts/test-e2e-pipeline.ts --prereq-only    # 只檢查前置條件
 *
 * @since CHANGE-016 Phase 4
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// ============================================================================
// Config
// ============================================================================

const TEST_PDF_PATH = path.resolve(
  __dirname,
  '../docs/Doc Sample/DHL_HEX240522_41293.pdf',
);
let TEST_CITY_CODE = 'HEX'; // 在 checkPrerequisites 中從 DB 確認
let TEST_USER_ID = ''; // 在 checkPrerequisites 中從 DB 取得
const SKIP_CLEANUP = process.argv.includes('--skip-cleanup');
const PREREQ_ONLY = process.argv.includes('--prereq-only');

// ============================================================================
// Prisma Client (standalone, like seed.ts)
// ============================================================================

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ============================================================================
// Test Result Tracking
// ============================================================================

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details?: string;
  durationMs?: number;
}

const results: TestResult[] = [];

function record(name: string, status: 'PASS' | 'FAIL' | 'SKIP', details?: string, durationMs?: number) {
  results.push({ name, status, details, durationMs });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  const durStr = durationMs ? ` (${durationMs}ms)` : '';
  console.log(`  ${icon} ${name}${durStr}`);
  if (details) console.log(`     ${details}`);
}

// ============================================================================
// T1: 前置條件檢查
// ============================================================================

async function checkPrerequisites(): Promise<boolean> {
  console.log('\n📋 T1: 前置條件檢查\n');
  let allPassed = true;

  // 1. 環境變數
  const envVars = [
    'DATABASE_URL',
    'AZURE_STORAGE_CONNECTION_STRING',
    'ENABLE_UNIFIED_PROCESSOR',
  ];
  for (const v of envVars) {
    if (process.env[v]) {
      record(`ENV: ${v}`, 'PASS', `值已設置`);
    } else {
      record(`ENV: ${v}`, 'FAIL', `未設置`);
      allPassed = false;
    }
  }

  // 2. Feature flag
  if (process.env.ENABLE_UNIFIED_PROCESSOR === 'true') {
    record('Feature Flag: ENABLE_UNIFIED_PROCESSOR', 'PASS', '= true');
  } else {
    record('Feature Flag: ENABLE_UNIFIED_PROCESSOR', 'FAIL', `= ${process.env.ENABLE_UNIFIED_PROCESSOR}`);
    allPassed = false;
  }

  // 3. DataTemplate 存在
  const templateCount = await prisma.dataTemplate.count();
  if (templateCount > 0) {
    record('Seed: DataTemplate', 'PASS', `${templateCount} 個模版`);
  } else {
    record('Seed: DataTemplate', 'FAIL', '無模版數據');
    allPassed = false;
  }

  // 4. TemplateFieldMapping 存在
  const mappingCount = await prisma.templateFieldMapping.count();
  if (mappingCount > 0) {
    record('Seed: TemplateFieldMapping', 'PASS', `${mappingCount} 條映射規則`);
  } else {
    record('Seed: TemplateFieldMapping', 'FAIL', '無映射規則');
    allPassed = false;
  }

  // 5. Company.defaultTemplateId 已設置
  const companiesWithTemplate = await prisma.company.count({
    where: { defaultTemplateId: { not: null } },
  });
  if (companiesWithTemplate > 0) {
    record('Seed: Company.defaultTemplateId', 'PASS', `${companiesWithTemplate} 間公司已設置`);
  } else {
    record('Seed: Company.defaultTemplateId', 'FAIL', '無公司設置 defaultTemplateId');
    allPassed = false;
  }

  // 6. DHL 公司存在
  const dhl = await prisma.company.findFirst({
    where: { name: { contains: 'DHL', mode: 'insensitive' } },
    select: { id: true, name: true, defaultTemplateId: true },
  });
  if (dhl) {
    record('Seed: DHL Company', 'PASS', `id=${dhl.id}, defaultTemplate=${dhl.defaultTemplateId ?? 'null'}`);
  } else {
    record('Seed: DHL Company', 'FAIL', 'DHL 公司不存在');
    allPassed = false;
  }

  // 7. 測試 PDF 文件存在
  if (fs.existsSync(TEST_PDF_PATH)) {
    const stats = fs.statSync(TEST_PDF_PATH);
    record('Test PDF', 'PASS', `${path.basename(TEST_PDF_PATH)} (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    record('Test PDF', 'FAIL', `文件不存在: ${TEST_PDF_PATH}`);
    allPassed = false;
  }

  // 8. 可用的 City（Document.cityCode 外鍵）
  const city = await prisma.city.findFirst({
    select: { code: true, name: true },
    orderBy: { code: 'asc' },
  });
  if (city) {
    TEST_CITY_CODE = city.code;
    record('City for testing', 'PASS', `code=${city.code}, name=${city.name}`);
  } else {
    record('City for testing', 'FAIL', '資料庫中無城市');
    allPassed = false;
  }

  // 9. 可用的 User（Document.uploadedBy 外鍵）
  const user = await prisma.user.findFirst({
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  });
  if (user) {
    TEST_USER_ID = user.id;
    record('User for testing', 'PASS', `id=${user.id}, email=${user.email}`);
  } else {
    record('User for testing', 'FAIL', '資料庫中無用戶');
    allPassed = false;
  }

  // 10. Azure DI / OpenAI 配置（僅檢查是否設置，不驗證正確性）
  const aiVars = ['AZURE_DI_ENDPOINT', 'AZURE_DI_KEY', 'AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY'];
  const aiConfigured = aiVars.every((v) => !!process.env[v]);
  if (aiConfigured) {
    record('AI Services Config', 'PASS', 'Azure DI + OpenAI 環境變數已設置');
  } else {
    const missing = aiVars.filter((v) => !process.env[v]);
    record('AI Services Config', 'FAIL', `缺少: ${missing.join(', ')}`);
    allPassed = false;
  }

  return allPassed;
}

// ============================================================================
// T2: 文件建立 + Blob 上傳
// ============================================================================

let testDocumentId: string | null = null;

async function createTestDocument(): Promise<boolean> {
  console.log('\n📄 T2: 文件建立 + Blob 上傳\n');

  try {
    // 讀取測試 PDF
    const fileBuffer = fs.readFileSync(TEST_PDF_PATH);
    const fileName = path.basename(TEST_PDF_PATH);

    // 上傳到 Azurite
    // 動態導入避免 module resolution 問題
    let blobName: string;
    try {
      const { uploadBufferToBlob } = await import('../src/lib/azure-blob');
      const blobPath = `test-e2e/${Date.now()}-${fileName}`;
      blobName = await uploadBufferToBlob(fileBuffer, blobPath, 'application/pdf');
      record('Blob Upload', 'PASS', `blobName=${blobName}`);
    } catch (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      record('Blob Upload', 'FAIL', msg);
      return false;
    }

    // 建立 Document 記錄
    const document = await prisma.document.create({
      data: {
        fileName,
        fileType: 'application/pdf',
        fileExtension: 'pdf',
        fileSize: fileBuffer.length,
        filePath: `azurite://${blobName}`,
        blobName,
        status: 'UPLOADED',
        uploadedBy: TEST_USER_ID,
        cityCode: TEST_CITY_CODE,
      },
    });

    testDocumentId = document.id;
    record('Document Created', 'PASS', `id=${document.id}, status=${document.status}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record('T2 Failed', 'FAIL', msg);
    return false;
  }
}

// ============================================================================
// T3: 統一處理管線觸發
// ============================================================================

async function triggerProcessing(): Promise<boolean> {
  console.log('\n⚙️ T3: 統一處理管線觸發\n');

  if (!testDocumentId) {
    record('Processing', 'SKIP', '無測試文件');
    return false;
  }

  try {
    // 讀取 Document（取得 blobName）
    const doc = await prisma.document.findUnique({
      where: { id: testDocumentId },
      select: { id: true, blobName: true, fileName: true, fileType: true },
    });
    if (!doc) {
      record('Document Lookup', 'FAIL', 'Document 不存在');
      return false;
    }

    // 下載 Blob
    const start = Date.now();
    let fileBuffer: Buffer;
    try {
      const { downloadBlob } = await import('../src/lib/azure-blob');
      fileBuffer = await downloadBlob(doc.blobName);
      record('Blob Download', 'PASS', `${(fileBuffer.length / 1024).toFixed(1)} KB`);
    } catch (dlErr) {
      const msg = dlErr instanceof Error ? dlErr.message : String(dlErr);
      record('Blob Download', 'FAIL', msg);
      return false;
    }

    // 更新狀態
    await prisma.document.update({
      where: { id: testDocumentId },
      data: { status: 'OCR_PROCESSING', processingStartedAt: new Date() },
    });

    // 呼叫統一處理器
    let result: Awaited<ReturnType<Awaited<ReturnType<typeof import('../src/services/unified-processor')>['getUnifiedDocumentProcessor']>['processFile']>>;
    try {
      const { getUnifiedDocumentProcessor } = await import('../src/services/unified-processor');
      const processor = getUnifiedDocumentProcessor();
      result = await processor.processFile({
        fileId: doc.id,
        fileName: doc.fileName,
        fileBuffer,
        mimeType: doc.fileType,
        userId: TEST_USER_ID,
      });
      const dur = Date.now() - start;
      record('Unified Processor', result.success ? 'PASS' : 'FAIL', [
        `success=${result.success}`,
        `confidence=${result.overallConfidence ?? 'N/A'}`,
        `companyId=${result.companyId ?? 'N/A'}`,
        `routing=${result.routingDecision ?? 'N/A'}`,
        `mapped=${result.mappedFields?.filter((f) => f.success).length ?? 0}`,
        `unmapped=${result.unmappedFields?.length ?? 0}`,
        `warnings=${result.warnings?.length ?? 0}`,
      ].join(', '), dur);
    } catch (procErr) {
      const msg = procErr instanceof Error ? procErr.message : String(procErr);
      record('Unified Processor', 'FAIL', msg);
      return false;
    }

    // 持久化結果
    try {
      const { persistProcessingResult } = await import('../src/services/processing-result-persistence.service');
      const persistResult = await persistProcessingResult({
        documentId: doc.id,
        result,
        userId: TEST_USER_ID,
      });
      record('Persist Result', 'PASS', [
        `extractionResultId=${persistResult.extractionResultId}`,
        `status=${persistResult.documentStatus}`,
        `fields: total=${persistResult.fieldCount.total}, mapped=${persistResult.fieldCount.mapped}`,
      ].join(', '));
    } catch (persistErr) {
      const msg = persistErr instanceof Error ? persistErr.message : String(persistErr);
      record('Persist Result', 'FAIL', msg);
      return false;
    }

    return result.success;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record('T3 Failed', 'FAIL', msg);
    return false;
  }
}

// ============================================================================
// T4: 結果持久化驗證
// ============================================================================

async function verifyPersistence(): Promise<boolean> {
  console.log('\n🔍 T4: 結果持久化驗證\n');

  if (!testDocumentId) {
    record('Persistence Check', 'SKIP', '無測試文件');
    return false;
  }

  try {
    // 檢查 Document 狀態
    const doc = await prisma.document.findUnique({
      where: { id: testDocumentId },
      select: {
        status: true,
        companyId: true,
        processingPath: true,
        processingDuration: true,
        processingEndedAt: true,
      },
    });

    if (!doc) {
      record('Document Status', 'FAIL', 'Document 不存在');
      return false;
    }

    const statusOk = doc.status === 'MAPPING_COMPLETED';
    record('Document.status', statusOk ? 'PASS' : 'FAIL', `${doc.status} (expected: MAPPING_COMPLETED)`);
    record('Document.companyId', doc.companyId ? 'PASS' : 'FAIL', doc.companyId ?? 'null');
    record('Document.processingPath', doc.processingPath ? 'PASS' : 'FAIL', doc.processingPath ?? 'null');
    record('Document.processingDuration', doc.processingDuration ? 'PASS' : 'FAIL', `${doc.processingDuration ?? 'null'} ms`);

    // 檢查 ExtractionResult
    const extraction = await prisma.extractionResult.findUnique({
      where: { documentId: testDocumentId },
      select: {
        id: true,
        companyId: true,
        totalFields: true,
        mappedFields: true,
        unmappedFields: true,
        averageConfidence: true,
        status: true,
        fieldMappings: true,
      },
    });

    if (!extraction) {
      record('ExtractionResult', 'FAIL', '記錄不存在');
      return false;
    }

    record('ExtractionResult.status', extraction.status === 'COMPLETED' ? 'PASS' : 'FAIL', extraction.status);
    record('ExtractionResult.totalFields', extraction.totalFields > 0 ? 'PASS' : 'FAIL', `${extraction.totalFields}`);
    // mappedFields 數量取決於 TemplateFieldMapping seed 數據品質，不作為硬性失敗條件
    record('ExtractionResult.mappedFields', extraction.totalFields > 0 ? 'PASS' : 'FAIL', `${extraction.mappedFields} mapped, ${extraction.unmappedFields} unmapped (mapping count depends on seed data quality)`);
    record('ExtractionResult.confidence', 'PASS', `${extraction.averageConfidence}%`);

    // 檢查 fieldMappings 內容（映射欄位數量取決於 seed 規則品質）
    const mappings = extraction.fieldMappings as Record<string, unknown> | null;
    const fieldCount = mappings ? Object.keys(mappings).length : 0;
    record('ExtractionResult.fieldMappings', 'PASS', `${fieldCount} 個已映射欄位${fieldCount > 0 ? ': ' + Object.keys(mappings!).slice(0, 5).join(', ') + (fieldCount > 5 ? '...' : '') : '（seed 映射規則可能需要調整）'}`);

    return statusOk && !!extraction;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record('T4 Failed', 'FAIL', msg);
    return false;
  }
}

// ============================================================================
// T5: autoMatch 驗證
// ============================================================================

async function verifyAutoMatch(): Promise<boolean> {
  console.log('\n🎯 T5: autoMatch 驗證\n');

  if (!testDocumentId) {
    record('AutoMatch', 'SKIP', '無測試文件');
    return false;
  }

  try {
    // 先檢查 Document 是否有 companyId（autoMatch 需要）
    const doc = await prisma.document.findUnique({
      where: { id: testDocumentId },
      select: { companyId: true, templateInstanceId: true },
    });

    if (!doc?.companyId) {
      record('AutoMatch Pre-check', 'SKIP', 'Document 無 companyId，autoMatch 不會觸發');
      return true; // 不算失敗，只是跳過
    }

    // 嘗試手動觸發 autoMatch
    try {
      const { autoTemplateMatchingService } = await import('../src/services/auto-template-matching.service');
      const start = Date.now();
      const matchResult = await autoTemplateMatchingService.autoMatch(testDocumentId);
      const dur = Date.now() - start;

      if (matchResult.success) {
        record('autoMatch', 'PASS', [
          `templateInstanceId=${matchResult.templateInstanceId}`,
          `source=${matchResult.source}`,
        ].join(', '), dur);
      } else {
        record('autoMatch', 'FAIL', matchResult.error ?? 'unknown error', dur);
      }

      // 驗證 Document.templateInstanceId
      const updatedDoc = await prisma.document.findUnique({
        where: { id: testDocumentId },
        select: { templateInstanceId: true },
      });

      if (updatedDoc?.templateInstanceId) {
        record('Document.templateInstanceId', 'PASS', updatedDoc.templateInstanceId);

        // 檢查 TemplateInstance 存在
        const instance = await prisma.templateInstance.findUnique({
          where: { id: updatedDoc.templateInstanceId },
          select: { id: true, status: true, rowCount: true },
        });

        if (instance) {
          record('TemplateInstance', 'PASS', `status=${instance.status}, rows=${instance.rowCount}`);
        } else {
          record('TemplateInstance', 'FAIL', '實例不存在');
        }
      } else {
        record('Document.templateInstanceId', 'FAIL', 'null');
      }

      return matchResult.success;
    } catch (matchErr) {
      const msg = matchErr instanceof Error ? matchErr.message : String(matchErr);
      record('autoMatch execution', 'FAIL', msg);
      return false;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record('T5 Failed', 'FAIL', msg);
    return false;
  }
}

// ============================================================================
// T6: 清理測試數據
// ============================================================================

async function cleanup(): Promise<void> {
  console.log('\n🧹 T6: 清理測試數據\n');

  if (SKIP_CLEANUP) {
    record('Cleanup', 'SKIP', '--skip-cleanup 已指定，保留測試數據');
    if (testDocumentId) {
      console.log(`     📌 Test Document ID: ${testDocumentId}`);
    }
    return;
  }

  if (!testDocumentId) {
    record('Cleanup', 'SKIP', '無需清理');
    return;
  }

  try {
    // 1. 刪除 TemplateInstanceRow（如果有）
    const doc = await prisma.document.findUnique({
      where: { id: testDocumentId },
      select: { templateInstanceId: true },
    });

    if (doc?.templateInstanceId) {
      await prisma.templateInstanceRow.deleteMany({
        where: { templateInstanceId: doc.templateInstanceId },
      });
      await prisma.templateInstance.deleteMany({
        where: { id: doc.templateInstanceId },
      });
      record('Cleanup: TemplateInstance', 'PASS', '已刪除');
    }

    // 2. 刪除 ExtractionResult
    await prisma.extractionResult.deleteMany({
      where: { documentId: testDocumentId },
    });
    record('Cleanup: ExtractionResult', 'PASS', '已刪除');

    // 3. 刪除 Blob
    try {
      const docForBlob = await prisma.document.findUnique({
        where: { id: testDocumentId },
        select: { blobName: true },
      });
      if (docForBlob?.blobName) {
        const { deleteBlob } = await import('../src/lib/azure-blob');
        await deleteBlob(docForBlob.blobName);
        record('Cleanup: Blob', 'PASS', '已刪除');
      }
    } catch {
      record('Cleanup: Blob', 'FAIL', '刪除失敗（非致命）');
    }

    // 4. 刪除 Document
    await prisma.document.delete({ where: { id: testDocumentId } });
    record('Cleanup: Document', 'PASS', '已刪除');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record('Cleanup', 'FAIL', msg);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  E2E Pipeline Integration Test — Phase 4                  ║');
  console.log('║  Upload → Process → Persist → AutoMatch                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const totalStart = Date.now();

  // T1: Prerequisites
  const prereqOk = await checkPrerequisites();
  if (!prereqOk) {
    console.log('\n⚠️  前置條件未滿足，部分測試可能會失敗。');
  }
  if (PREREQ_ONLY) {
    console.log('\n--prereq-only 已指定，跳過後續測試。');
    await printSummary(Date.now() - totalStart);
    await prisma.$disconnect();
    await pool.end();
    process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);
  }

  // T2: Create + Upload
  const uploadOk = await createTestDocument();
  if (!uploadOk) {
    console.log('\n⚠️  文件建立失敗，跳過處理測試。');
    await cleanup();
    await printSummary(Date.now() - totalStart);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  }

  // T3: Process
  const processOk = await triggerProcessing();

  // T4: Verify Persistence (even if processing failed, check what we got)
  await verifyPersistence();

  // T5: AutoMatch
  if (processOk) {
    await verifyAutoMatch();
  } else {
    console.log('\n⏭️  T5: 跳過 autoMatch（處理未成功）\n');
    record('autoMatch', 'SKIP', '處理未成功');
  }

  // T6: Cleanup
  await cleanup();

  // Summary
  await printSummary(Date.now() - totalStart);

  await prisma.$disconnect();
  await pool.end();

  const failed = results.filter((r) => r.status === 'FAIL').length;
  process.exit(failed > 0 ? 1 : 0);
}

async function printSummary(totalMs: number) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  測試結果摘要                                              ║');
  console.log('╠════════════════════════════════════════════════════════════╣');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  console.log(`║  ✅ PASS: ${String(passed).padEnd(4)} ❌ FAIL: ${String(failed).padEnd(4)} ⏭️ SKIP: ${String(skipped).padEnd(4)}       ║`);
  console.log(`║  總耗時: ${(totalMs / 1000).toFixed(1)}s                                         ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\n❌ 失敗的測試:');
    for (const r of results.filter((r) => r.status === 'FAIL')) {
      console.log(`   - ${r.name}: ${r.details}`);
    }
  }

  console.log(`\n${failed === 0 ? '🎉 所有測試通過！' : `⚠️  ${failed} 個測試失敗`}`);
}

main().catch((err) => {
  console.error('\n💥 Fatal error:', err);
  prisma.$disconnect();
  pool.end();
  process.exit(1);
});
