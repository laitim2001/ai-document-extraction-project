/**
 * TEST-PLAN-003 批次結果驗證腳本
 * 批次 ID: a5084d5f-fb17-4cf5-9bfb-8d5bde5225bb
 */
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const { PrismaPg } = await import('@prisma/adapter-pg');
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const batchId = 'a5084d5f-fb17-4cf5-9bfb-8d5bde5225bb';

async function main() {
  console.log('=== TEST-PLAN-003 批次結果驗證 ===\n');

  // 1. 批次基本資訊
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      name: true,
      status: true,
      totalFiles: true,
      processedFiles: true,
      failedFiles: true,
      totalCost: true,
      issuersIdentified: true,
      formatsIdentified: true,
      startedAt: true,
      completedAt: true,
      aggregationStartedAt: true,
      aggregationCompletedAt: true
    }
  });
  console.log('【批次基本資訊】');
  console.log(`  批次名稱: ${batch.name}`);
  console.log(`  批次狀態: ${batch.status}`);
  console.log(`  總文件數: ${batch.totalFiles}`);
  console.log(`  已處理數: ${batch.processedFiles}`);
  console.log(`  失敗數: ${batch.failedFiles}`);
  console.log(`  識別發行者: ${batch.issuersIdentified}`);
  console.log(`  識別格式: ${batch.formatsIdentified}`);

  // 2. 術語聚合結果
  const terms = await prisma.termAggregationResult.findUnique({
    where: { batchId },
    select: {
      totalUniqueTerms: true,
      totalOccurrences: true,
      universalTermsCount: true,
      companySpecificCount: true,
      classifiedTermsCount: true
    }
  });
  console.log('\n【術語聚合結果】');
  if (terms) {
    console.log(`  唯一術語數: ${terms.totalUniqueTerms}`);
    console.log(`  總出現次數: ${terms.totalOccurrences}`);
    console.log(`  通用術語數: ${terms.universalTermsCount}`);
    console.log(`  公司特定術語: ${terms.companySpecificCount}`);
    console.log(`  已分類術語: ${terms.classifiedTermsCount}`);
  }

  // 3. 處理方法分佈
  const methodDist = await prisma.historicalFile.groupBy({
    by: ['processingMethod'],
    where: { batchId },
    _count: { id: true }
  });
  console.log('\n【處理方法分佈】');
  methodDist.forEach(m => {
    console.log(`  ${m.processingMethod}: ${m._count.id} 個文件`);
  });

  // 4. 文件狀態分佈
  const statusDist = await prisma.historicalFile.groupBy({
    by: ['status'],
    where: { batchId },
    _count: { id: true }
  });
  console.log('\n【文件狀態分佈】');
  statusDist.forEach(s => {
    console.log(`  ${s.status}: ${s._count.id} 個文件`);
  });

  // 5. 文件類型分佈
  const typeDist = await prisma.historicalFile.groupBy({
    by: ['detectedType'],
    where: { batchId },
    _count: { id: true }
  });
  console.log('\n【文件類型分佈】');
  typeDist.forEach(t => {
    console.log(`  ${t.detectedType}: ${t._count.id} 個文件`);
  });

  // 6. 發行者識別方法分佈
  const identMethodDist = await prisma.historicalFile.groupBy({
    by: ['issuerIdentificationMethod'],
    where: {
      batchId,
      issuerIdentificationMethod: { not: null }
    },
    _count: { id: true }
  });
  console.log('\n【發行者識別方法分佈】');
  identMethodDist.forEach(m => {
    console.log(`  ${m.issuerIdentificationMethod}: ${m._count.id} 個文件`);
  });

  // 7. 已識別發行者統計
  const issuerStats = await prisma.historicalFile.groupBy({
    by: ['documentIssuerId'],
    where: {
      batchId,
      documentIssuerId: { not: null }
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15
  });

  const issuerIds = issuerStats.map(i => i.documentIssuerId).filter(Boolean);
  const companies = await prisma.company.findMany({
    where: { id: { in: issuerIds } },
    select: { id: true, name: true }
  });
  const companyMap = new Map(companies.map(c => [c.id, c.name]));

  console.log('\n【Top 15 文件發行者】');
  issuerStats.forEach((i, idx) => {
    const name = companyMap.get(i.documentIssuerId) || 'Unknown';
    console.log(`  ${idx + 1}. ${name}: ${i._count.id} 個文件`);
  });

  // 8. 自動建立的公司數
  const autoCreatedCount = await prisma.company.count({
    where: { source: 'AUTO_CREATED' }
  });
  console.log(`\n【自動建立的公司數】${autoCreatedCount} 個`);

  // 9. 計算處理時間和成本
  if (batch?.startedAt && batch?.completedAt) {
    const duration = new Date(batch.completedAt).getTime() - new Date(batch.startedAt).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    console.log('\n【效能指標】');
    console.log(`  處理時間: ${minutes} 分 ${seconds} 秒`);
    console.log(`  平均每個文件: ${(duration / 132 / 1000).toFixed(2)} 秒`);
    console.log(`  總成本: $${(batch.totalCost || 0).toFixed(2)}`);
    console.log(`  平均成本/文件: $${((batch.totalCost || 0) / 132).toFixed(4)}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
