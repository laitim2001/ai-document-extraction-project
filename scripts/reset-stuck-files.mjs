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

async function reset() {
  // 重置卡在 PROCESSING 狀態但未完成的文件
  const result = await prisma.historicalFile.updateMany({
    where: {
      status: 'PROCESSING',
      processedAt: null,
      batch: {
        name: { contains: 'Azure' }
      }
    },
    data: {
      status: 'DETECTED',
      processingMethod: null,
      processingStartAt: null,
      processingEndAt: null,
      errorMessage: null
    }
  });

  console.log(`已重置 ${result.count} 個卡住的文件`);

  // 也重置批次狀態
  await prisma.historicalBatch.updateMany({
    where: {
      name: { contains: 'Azure' },
      status: 'PROCESSING'
    },
    data: {
      status: 'PENDING',
      startedAt: null,
      completedAt: null,
      processedFiles: 0,
      failedFiles: 0
    }
  });

  console.log('批次狀態已重置為 PENDING');

  // 但需要保留已完成的文件計數
  // 讓我們查看一下重置後的狀態
  const files = await prisma.historicalFile.findMany({
    where: {
      batch: { name: { contains: 'Azure' } }
    },
    select: {
      originalName: true,
      status: true
    }
  });

  console.log('\n=== 重置後狀態 ===');
  files.forEach(f => {
    console.log(`${f.originalName}: ${f.status}`);
  });

  await pool.end();
  await prisma.$disconnect();
}

reset().catch(console.error);
