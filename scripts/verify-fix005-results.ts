/**
 * @fileoverview FIX-005 驗證腳本
 * @description 驗證 E2E-TEST-132-PDF-FIX005-2025-12-29 批次處理結果
 */

import { PrismaClient, HistoricalFileStatus, IssuerIdentificationMethod } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BATCH_ID = 'd8beb4ba-3501-45f0-9a92-3cfdf2e9f1a5';

async function main() {
  console.log('='.repeat(80));
  console.log('FIX-005 驗證報告 - E2E-TEST-132-PDF-FIX005-2025-12-29');
  console.log('='.repeat(80));
  console.log(`\n批次 ID: ${BATCH_ID}\n`);

  try {
    // 1. 驗證批次狀態
    console.log('\n📦 1. 批次狀態驗證');
    console.log('-'.repeat(40));

    const batch = await prisma.historicalBatch.findUnique({
      where: { id: BATCH_ID },
      select: {
        id: true,
        name: true,
        status: true,
        totalFiles: true,
        processedFiles: true,
        failedFiles: true,
        totalCost: true,
        createdAt: true,
        completedAt: true,
        aggregationCompletedAt: true,
        _count: {
          select: { files: true }
        }
      }
    });

    if (!batch) {
      console.log('❌ 批次不存在！');
      return;
    }

    console.log(`名稱: ${batch.name}`);
    console.log(`狀態: ${batch.status} ${batch.status === 'COMPLETED' ? '✅' : '❌'}`);
    console.log(`總文件數: ${batch.totalFiles}`);
    console.log(`已處理: ${batch.processedFiles}`);
    console.log(`失敗: ${batch.failedFiles}`);
    console.log(`總成本: $${batch.totalCost?.toFixed(2) || '0.00'}`);
    console.log(`創建時間: ${batch.createdAt}`);
    console.log(`完成時間: ${batch.completedAt}`);
    console.log(`術語聚合完成: ${batch.aggregationCompletedAt}`);

    // 2. 驗證文件處理狀態
    console.log('\n📄 2. 文件處理狀態驗證');
    console.log('-'.repeat(40));

    const fileStatusCounts = await prisma.historicalFile.groupBy({
      by: ['status'],
      where: { batchId: BATCH_ID },
      _count: { status: true }
    });

    console.log('文件狀態分布:');
    let totalFiles = 0;
    let completedFiles = 0;
    for (const item of fileStatusCounts) {
      const count = item._count.status;
      totalFiles += count;
      if (item.status === HistoricalFileStatus.COMPLETED) completedFiles = count;
      const icon = item.status === HistoricalFileStatus.COMPLETED ? '✅' : item.status === HistoricalFileStatus.FAILED ? '❌' : '⏳';
      console.log(`  ${icon} ${item.status}: ${count}`);
    }
    console.log(`處理成功率: ${((completedFiles / totalFiles) * 100).toFixed(1)}%`);

    // 3. 驗證處理方法分布
    console.log('\n🔧 3. 處理方法分布');
    console.log('-'.repeat(40));

    const processingMethodCounts = await prisma.historicalFile.groupBy({
      by: ['processingMethod'],
      where: { batchId: BATCH_ID },
      _count: { processingMethod: true }
    });

    for (const item of processingMethodCounts) {
      console.log(`  ${item.processingMethod || 'UNKNOWN'}: ${item._count.processingMethod}`);
    }

    // 4. 驗證 Document Issuer 識別（FIX-005 核心驗證）
    console.log('\n🏢 4. Document Issuer 驗證 (FIX-005 核心)');
    console.log('-'.repeat(40));

    const filesWithIssuers = await prisma.historicalFile.findMany({
      where: { batchId: BATCH_ID },
      select: {
        id: true,
        fileName: true,
        processingMethod: true,
        documentIssuerId: true,
        issuerIdentificationMethod: true,
        issuerConfidence: true,
        documentIssuer: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    let hasIssuer = 0;
    let noIssuer = 0;
    const issuerMethodCounts: Record<string, number> = {};
    const uniqueIssuers = new Set<string>();

    for (const file of filesWithIssuers) {
      if (file.documentIssuerId && file.documentIssuer) {
        hasIssuer++;
        uniqueIssuers.add(file.documentIssuer.name);

        const method = file.issuerIdentificationMethod || 'UNKNOWN';
        issuerMethodCounts[method] = (issuerMethodCounts[method] || 0) + 1;
      } else {
        noIssuer++;
      }
    }

    console.log(`有 Issuer 的文件: ${hasIssuer} ✅`);
    console.log(`無 Issuer 的文件: ${noIssuer} ${noIssuer === 0 ? '✅' : '⚠️'}`);
    console.log(`唯一 Issuer 數量: ${uniqueIssuers.size}`);
    console.log(`\n識別方法分布:`);
    for (const [method, count] of Object.entries(issuerMethodCounts)) {
      console.log(`  ${method}: ${count}`);
    }

    // 5. 驗證 GPT Vision 分類（FIX-005 特別驗證）
    console.log('\n🤖 5. GPT Vision 分類驗證 (FIX-005)');
    console.log('-'.repeat(40));

    const gptVisionFiles = await prisma.historicalFile.findMany({
      where: {
        batchId: BATCH_ID,
        processingMethod: 'GPT_VISION'
      },
      select: {
        fileName: true,
        documentIssuerId: true,
        issuerIdentificationMethod: true,
        issuerConfidence: true,
        documentIssuer: {
          select: {
            name: true
          }
        }
      }
    });

    console.log(`GPT_VISION 處理的文件數: ${gptVisionFiles.length}`);

    let gptVisionWithIssuer = 0;
    let gptVisionWithoutIssuer = 0;
    const missingIssuerFiles: string[] = [];

    for (const file of gptVisionFiles) {
      if (file.documentIssuerId && file.documentIssuer) {
        gptVisionWithIssuer++;
      } else {
        gptVisionWithoutIssuer++;
        missingIssuerFiles.push(file.fileName);
      }
    }

    console.log(`\nGPT_VISION 文件 Issuer 識別:`);
    console.log(`  有 Issuer: ${gptVisionWithIssuer} ${gptVisionWithIssuer === gptVisionFiles.length ? '✅' : '⚠️'}`);
    console.log(`  無 Issuer: ${gptVisionWithoutIssuer}`);

    if (missingIssuerFiles.length > 0) {
      console.log(`\n  ⚠️ 無 Issuer 的文件:`);
      for (const f of missingIssuerFiles.slice(0, 10)) {
        console.log(`    - ${f}`);
      }
      if (missingIssuerFiles.length > 10) {
        console.log(`    ... 還有 ${missingIssuerFiles.length - 10} 個文件`);
      }
    }

    const fix005Status = gptVisionWithoutIssuer === 0 ? 'PASSED ✅' : 'NEEDS REVIEW ⚠️';
    console.log(`\n🎯 FIX-005 驗證結果: ${fix005Status}`);

    // 6. 驗證術語聚合
    console.log('\n📊 6. 術語聚合驗證');
    console.log('-'.repeat(40));

    const termAggResult = await prisma.termAggregationResult.findUnique({
      where: { batchId: BATCH_ID }
    });

    if (termAggResult) {
      console.log(`總術語數: ${termAggResult.totalUniqueTerms}`);
      console.log(`總出現次數: ${termAggResult.totalOccurrences}`);
      console.log(`通用術語數: ${termAggResult.universalTermsCount}`);
      console.log(`公司特定術語數: ${termAggResult.companySpecificCount}`);
      console.log(`已分類術語數: ${termAggResult.classifiedTermsCount}`);
      console.log(`聚合完成時間: ${termAggResult.aggregatedAt}`);
    } else {
      console.log('⚠️ 找不到術語聚合結果');
    }

    // 7. 驗證公司記錄
    console.log('\n🏭 7. 公司記錄驗證');
    console.log('-'.repeat(40));

    const companyCounts = await prisma.historicalFile.groupBy({
      by: ['documentIssuerId'],
      where: {
        batchId: BATCH_ID,
        documentIssuerId: { not: null }
      },
      _count: { documentIssuerId: true }
    });

    console.log(`關聯的公司數量: ${companyCounts.length}`);

    // 取得前10個最常出現的公司
    const topCompanies = await prisma.historicalFile.groupBy({
      by: ['documentIssuerId'],
      where: {
        batchId: BATCH_ID,
        documentIssuerId: { not: null }
      },
      _count: { documentIssuerId: true },
      orderBy: {
        _count: {
          documentIssuerId: 'desc'
        }
      },
      take: 10
    });

    if (topCompanies.length > 0) {
      console.log(`\n前 10 個最常出現的 Document Issuer:`);
      for (const tc of topCompanies) {
        const company = await prisma.company.findUnique({
          where: { id: tc.documentIssuerId! },
          select: { name: true }
        });
        console.log(`  - ${company?.name || 'Unknown'}: ${tc._count.documentIssuerId} 個文件`);
      }
    }

    // 8. 驗證文件格式識別
    console.log('\n📋 8. 文件格式識別驗證');
    console.log('-'.repeat(40));

    const formatCounts = await prisma.historicalFile.groupBy({
      by: ['documentFormatId'],
      where: { batchId: BATCH_ID },
      _count: { documentFormatId: true }
    });

    const hasFormat = formatCounts.filter(f => f.documentFormatId !== null).reduce((sum, f) => sum + f._count.documentFormatId, 0);
    const noFormat = formatCounts.filter(f => f.documentFormatId === null).reduce((sum, f) => sum + f._count.documentFormatId, 0);

    console.log(`有 Format 的文件: ${hasFormat}`);
    console.log(`無 Format 的文件: ${noFormat}`);

    // 9. 總結
    console.log('\n' + '='.repeat(80));
    console.log('📋 驗證總結');
    console.log('='.repeat(80));

    const allPassed =
      batch.status === 'COMPLETED' &&
      completedFiles === totalFiles &&
      noIssuer === 0 &&
      gptVisionWithoutIssuer === 0;

    console.log(`\n批次狀態: ${batch.status === 'COMPLETED' ? '✅ COMPLETED' : '❌ ' + batch.status}`);
    console.log(`文件處理: ${completedFiles}/${totalFiles} ${completedFiles === totalFiles ? '✅' : '❌'}`);
    console.log(`Issuer 識別: ${hasIssuer}/${totalFiles} ${noIssuer === 0 ? '✅' : '⚠️'}`);
    console.log(`FIX-005 驗證: ${fix005Status}`);
    console.log(`術語聚合: ${termAggResult ? termAggResult.totalUniqueTerms + ' 術語 ✅' : '⚠️'}`);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎯 整體驗證結果: ${allPassed ? '全部通過 ✅' : '需要檢查 ⚠️'}`);
    console.log('='.repeat(80));

    // 輸出 JSON 格式摘要（供報告使用）
    const summary = {
      batchId: BATCH_ID,
      batchName: batch.name,
      batchStatus: batch.status,
      totalFiles,
      completedFiles,
      failedFiles: batch.failedFiles,
      totalCost: batch.totalCost,
      issuerIdentified: hasIssuer,
      issuerMissing: noIssuer,
      uniqueIssuers: uniqueIssuers.size,
      gptVisionFiles: gptVisionFiles.length,
      gptVisionWithIssuer,
      gptVisionWithoutIssuer,
      fix005Status: gptVisionWithoutIssuer === 0 ? 'PASSED' : 'NEEDS_REVIEW',
      termAggregation: termAggResult ? {
        uniqueTerms: termAggResult.totalUniqueTerms,
        totalOccurrences: termAggResult.totalOccurrences,
        universalTerms: termAggResult.universalTermsCount
      } : null,
      verifiedAt: new Date().toISOString()
    };

    console.log('\n📊 JSON 摘要:');
    console.log(JSON.stringify(summary, null, 2));

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
