/**
 * @fileoverview Quick check of batch status for TEST-PLAN-005
 */

import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const { PrismaPg } = await import('@prisma/adapter-pg');
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

const BATCH_ID = '3175c6da-22a1-4870-a620-d6a1da2f60ed';

async function main() {
  try {
    const batch = await prisma.historicalBatch.findUnique({
      where: { id: BATCH_ID },
      include: {
        _count: {
          select: {
            files: true,
          },
        },
      },
    });

    if (!batch) {
      console.log('批次不存在');
      return;
    }

    // Count files by status
    const fileStats = await prisma.historicalFile.groupBy({
      by: ['status'],
      where: { batchId: BATCH_ID },
      _count: true,
    });

    console.log('='.repeat(60));
    console.log('TEST-PLAN-005 批次狀態檢查');
    console.log('='.repeat(60));
    console.log('時間:', new Date().toLocaleString('zh-TW'));
    console.log('批次 ID:', BATCH_ID);
    console.log('批次狀態:', batch.status);
    console.log('總文件數:', batch._count.files);
    console.log('');
    console.log('文件狀態分布:');

    let completed = 0, failed = 0, processing = 0, pending = 0;
    fileStats.forEach((stat) => {
      console.log('  ' + stat.status + ':', stat._count);
      if (stat.status === 'COMPLETED') completed = stat._count;
      else if (stat.status === 'FAILED') failed = stat._count;
      else if (stat.status === 'PROCESSING') processing = stat._count;
      else pending += stat._count;
    });

    console.log('');
    console.log(`進度: ${completed + failed}/${batch._count.files} (${((completed + failed) / batch._count.files * 100).toFixed(1)}%)`);
    console.log(`✅ 已完成: ${completed} | ❌ 失敗: ${failed} | 🔄 處理中: ${processing} | ⏳ 待處理: ${pending}`);

    if (batch.totalCost) {
      console.log('');
      console.log('💰 總成本: $' + batch.totalCost.toFixed(4));
    }

    console.log('='.repeat(60));

  } catch (error) {
    console.error('錯誤:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
