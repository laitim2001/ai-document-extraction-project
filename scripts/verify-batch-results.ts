import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Prisma client with Prisma 7.x driver adapter
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

async function main() {
  console.log('=== TEST-PLAN-002 批次結果驗證 ===\n');

  const batchId = 'fec633d9-1e14-45fd-b215-d85527750c62';

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
  console.log(JSON.stringify(batch, null, 2));

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
  console.log(JSON.stringify(terms, null, 2));

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

  // 5. 已識別發行者（按文件數排序）
  const issuerStats = await prisma.historicalFile.groupBy({
    by: ['documentIssuerId'],
    where: {
      batchId,
      documentIssuerId: { not: null }
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 20
  });

  // 獲取發行者名稱
  const issuerIds = issuerStats.map(i => i.documentIssuerId).filter(Boolean) as string[];
  const companies = await prisma.company.findMany({
    where: { id: { in: issuerIds } },
    select: { id: true, name: true }
  });
  const companyMap = new Map(companies.map(c => [c.id, c.name]));

  console.log('\n【Top 20 文件發行者】');
  issuerStats.forEach((i, idx) => {
    const name = companyMap.get(i.documentIssuerId!) || 'Unknown';
    console.log(`  ${idx + 1}. ${name}: ${i._count.id} 個文件`);
  });

  // 6. 自動建立的公司
  const autoCreatedCompanies = await prisma.company.findMany({
    where: { source: 'AUTO_CREATED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      displayName: true,
      createdAt: true
    }
  });
  console.log(`\n【自動建立的公司】(${autoCreatedCompanies.length} 個)`);
  autoCreatedCompanies.slice(0, 15).forEach((c, idx) => {
    console.log(`  ${idx + 1}. ${c.name}`);
  });

  // 7. 發行者識別方法分佈
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

  // 8. 計算處理時間
  if (batch?.startedAt && batch?.completedAt) {
    const duration = new Date(batch.completedAt).getTime() - new Date(batch.startedAt).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    console.log(`\n【處理時間】${minutes} 分 ${seconds} 秒`);
    console.log(`【平均每個文件】${(duration / 131 / 1000).toFixed(2)} 秒`);
    console.log(`【總成本】$${batch.totalCost?.toFixed(2)}`);
    console.log(`【平均成本/文件】$${((batch.totalCost || 0) / 131).toFixed(4)}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
