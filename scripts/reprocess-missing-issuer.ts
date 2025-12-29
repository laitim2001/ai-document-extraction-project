/**
 * @fileoverview 重新處理缺少發行者識別的文件
 * @description
 *   FIX-005: 針對 GPT_VISION 處理的文件重新執行 classifyDocument()
 *   以獲取 documentIssuer 和 documentFormat 資訊
 *
 * @module scripts/reprocess-missing-issuer
 * @since FIX-005 - GPT_VISION 發行者識別修復
 * @lastModified 2025-12-28
 *
 * @usage
 *   npx ts-node scripts/reprocess-missing-issuer.ts [batchId]
 *   npx ts-node scripts/reprocess-missing-issuer.ts fec633d9-1e14-45fd-b215-d85527750c62
 */

// FIX-005: 載入環境變數
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient, IssuerIdentificationMethod, CompanySource, CompanyStatus, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as pg from 'pg';
import * as path from 'path';
import * as fs from 'fs';

// Prisma 7.x: 使用 driver adapter
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/ai_document_extraction?schema=public';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 動態導入 classifyDocument（避免 ESM/CJS 問題）
type ClassifyDocumentFn = (filePath: string) => Promise<{
  success: boolean;
  documentIssuer?: {
    name: string;
    identificationMethod: string;
    confidence: number;
    rawText?: string;
  };
  documentFormat?: {
    documentType: string;
    documentSubtype: string;
    formatConfidence: number;
  };
  pageCount: number;
  error?: string;
}>;

let classifyDocument: ClassifyDocumentFn;

interface ReprocessResult {
  fileId: string;
  fileName: string;
  status: 'success' | 'failed' | 'skipped';
  issuerName?: string;
  issuerMethod?: string;
  confidence?: number;
  documentType?: string;
  error?: string;
}

async function loadClassifyDocument() {
  try {
    const gptVisionService = await import('../src/services/gpt-vision.service');
    classifyDocument = gptVisionService.classifyDocument as ClassifyDocumentFn;
    console.log('✅ Loaded classifyDocument from gpt-vision.service');
  } catch (error) {
    console.error('❌ Failed to load classifyDocument:', error);
    throw error;
  }
}

async function findFilesWithoutIssuer(batchId: string) {
  console.log(`\n📋 Finding files without issuer identification in batch: ${batchId}`);

  const files = await prisma.historicalFile.findMany({
    where: {
      batchId,
      status: 'COMPLETED',
      processingMethod: 'GPT_VISION',
      documentIssuerId: null,
    },
    select: {
      id: true,
      originalName: true,
      storagePath: true,
      extractionResult: true,
    },
  });

  console.log(`📊 Found ${files.length} files without issuer identification`);
  return files;
}

async function reprocessFile(
  file: { id: string; originalName: string; storagePath: string }
): Promise<ReprocessResult> {
  // storagePath 已經包含完整相對路徑（如 uploads/historical/...）
  const filePath = path.join(process.cwd(), file.storagePath);

  // 檢查文件是否存在
  if (!fs.existsSync(filePath)) {
    return {
      fileId: file.id,
      fileName: file.originalName,
      status: 'skipped',
      error: `File not found: ${filePath}`,
    };
  }

  try {
    console.log(`  🔄 Processing: ${file.originalName}`);

    // 執行分類
    const result = await classifyDocument(filePath);

    if (!result.success) {
      return {
        fileId: file.id,
        fileName: file.originalName,
        status: 'failed',
        error: result.error || 'Classification failed',
      };
    }

    // 準備更新數據（使用 UncheckedUpdateInput 類型直接更新 ID 欄位）
    const updateData: Prisma.HistoricalFileUncheckedUpdateInput = {};

    // 處理 documentIssuer
    if (result.documentIssuer) {
      // 嘗試匹配或創建公司
      let company = await prisma.company.findFirst({
        where: {
          OR: [
            { name: result.documentIssuer.name },
            { nameVariants: { has: result.documentIssuer.name } },
          ],
        },
      });

      if (!company) {
        // 創建新公司
        company = await prisma.company.create({
          data: {
            name: result.documentIssuer.name,
            displayName: result.documentIssuer.name, // 必填欄位
            source: CompanySource.AUTO_CREATED,
            status: CompanyStatus.ACTIVE,
            createdById: 'dev-user-1', // FIX-002: 使用存在的用戶
          },
        });
        console.log(`    📝 Created new Company: ${result.documentIssuer.name}`);
      }

      updateData.documentIssuerId = company.id;
      updateData.issuerIdentificationMethod = result.documentIssuer.identificationMethod as IssuerIdentificationMethod;
      updateData.issuerConfidence = result.documentIssuer.confidence;
    }

    // 更新 extractionResult 中的分類信息
    const existingResult = await prisma.historicalFile.findUnique({
      where: { id: file.id },
      select: { extractionResult: true },
    });

    const extractionResult = (existingResult?.extractionResult as Record<string, unknown>) || {};
    if (result.documentIssuer) {
      extractionResult.documentIssuer = result.documentIssuer;
    }
    if (result.documentFormat) {
      extractionResult.documentFormat = result.documentFormat;
    }
    extractionResult.classificationSuccess = true;
    extractionResult.reprocessedAt = new Date().toISOString();

    updateData.extractionResult = extractionResult as Prisma.InputJsonValue;

    // 更新文件記錄
    if (Object.keys(updateData).length > 0) {
      await prisma.historicalFile.update({
        where: { id: file.id },
        data: updateData,
      });
    }

    return {
      fileId: file.id,
      fileName: file.originalName,
      status: 'success',
      issuerName: result.documentIssuer?.name,
      issuerMethod: result.documentIssuer?.identificationMethod,
      confidence: result.documentIssuer?.confidence,
      documentType: result.documentFormat?.documentType,
    };
  } catch (error) {
    return {
      fileId: file.id,
      fileName: file.originalName,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const batchId = process.argv[2] || 'fec633d9-1e14-45fd-b215-d85527750c62';

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  FIX-005: Reprocess Files Missing Issuer Identification');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Batch ID: ${batchId}`);
  console.log(`  Working Dir: ${process.cwd()}`);
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // 載入 classifyDocument
    await loadClassifyDocument();

    // 找出缺少發行者識別的文件
    const files = await findFilesWithoutIssuer(batchId);

    if (files.length === 0) {
      console.log('\n✅ No files need reprocessing!');
      return;
    }

    // 重新處理每個文件
    const results: ReprocessResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    console.log(`\n🚀 Starting reprocessing of ${files.length} files...\n`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`[${i + 1}/${files.length}] ${file.originalName}`);

      const result = await reprocessFile(file);
      results.push(result);

      switch (result.status) {
        case 'success':
          successCount++;
          console.log(`    ✅ Success: ${result.issuerName} (${result.issuerMethod}, ${result.confidence}%)`);
          break;
        case 'failed':
          failedCount++;
          console.log(`    ❌ Failed: ${result.error}`);
          break;
        case 'skipped':
          skippedCount++;
          console.log(`    ⚠️ Skipped: ${result.error}`);
          break;
      }

      // 每處理 10 個文件顯示進度
      if ((i + 1) % 10 === 0) {
        console.log(`\n  📊 Progress: ${i + 1}/${files.length} (${Math.round(((i + 1) / files.length) * 100)}%)\n`);
      }
    }

    // 輸出結果摘要
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Reprocessing Summary');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Total Files: ${files.length}`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed: ${failedCount}`);
    console.log(`  ⚠️ Skipped: ${skippedCount}`);
    console.log('═══════════════════════════════════════════════════════════');

    // 輸出成功的發行者統計
    const successResults = results.filter((r) => r.status === 'success');
    if (successResults.length > 0) {
      console.log('\n📋 Identified Issuers:');
      const issuerStats = new Map<string, number>();
      for (const r of successResults) {
        const key = `${r.issuerName} (${r.issuerMethod})`;
        issuerStats.set(key, (issuerStats.get(key) || 0) + 1);
      }
      for (const [issuer, count] of Array.from(issuerStats.entries()).sort((a, b) => b[1] - a[1])) {
        console.log(`  - ${issuer}: ${count} files`);
      }
    }

    // 輸出失敗的文件列表
    const failedResults = results.filter((r) => r.status === 'failed');
    if (failedResults.length > 0) {
      console.log('\n❌ Failed Files:');
      for (const r of failedResults) {
        console.log(`  - ${r.fileName}: ${r.error}`);
      }
    }
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
