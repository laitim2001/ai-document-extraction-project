import { config } from 'dotenv';
config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  const files = await prisma.historicalFile.findMany({
    where: {
      batch: {
        name: { contains: 'Azure' }
      }
    },
    select: {
      originalName: true,
      status: true,
      processingMethod: true,
      actualCost: true,
      extractionResult: true,
      processedAt: true
    }
  });

  console.log('=== 文件處理狀態 ===');
  files.forEach(f => {
    console.log('---');
    console.log('文件:', f.originalName);
    console.log('狀態:', f.status);
    console.log('方法:', f.processingMethod);
    console.log('成本:', f.actualCost);
    console.log('已處理:', f.processedAt ? '是' : '否');
    if (f.extractionResult) {
      const preview = JSON.stringify(f.extractionResult).substring(0, 300);
      console.log('提取結果預覽:', preview);
    }
  });

  // 檢查批次狀態
  const batch = await prisma.historicalBatch.findFirst({
    where: { name: { contains: 'Azure' } },
    select: {
      name: true,
      status: true,
      processedFiles: true,
      failedFiles: true,
      totalFiles: true
    }
  });

  console.log('\n=== 批次狀態 ===');
  console.log('批次:', batch?.name);
  console.log('狀態:', batch?.status);
  console.log('總文件:', batch?.totalFiles);
  console.log('已處理:', batch?.processedFiles);
  console.log('失敗:', batch?.failedFiles);

  await pool.end();
  await prisma.$disconnect();
}

check().catch(console.error);
