/**
 * @fileoverview Monitor batch processing progress for TEST-PLAN-005
 * @description Periodically check batch status and display progress
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
const POLL_INTERVAL = 30000; // 30 seconds

async function checkProgress() {
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
      return null;
    }

    // Count files by status
    const fileStats = await prisma.historicalFile.groupBy({
      by: ['status'],
      where: { batchId: BATCH_ID },
      _count: true,
    });

    const stats = {
      total: batch._count.files,
      completed: 0,
      failed: 0,
      processing: 0,
      pending: 0,
    };

    fileStats.forEach((stat) => {
      if (stat.status === 'COMPLETED') stats.completed = stat._count;
      else if (stat.status === 'FAILED') stats.failed = stat._count;
      else if (stat.status === 'PROCESSING') stats.processing = stat._count;
      else stats.pending += stat._count;
    });

    const progress = ((stats.completed + stats.failed) / stats.total * 100).toFixed(1);
    const timestamp = new Date().toLocaleTimeString('zh-TW');

    console.log(`[${timestamp}] 批次狀態: ${batch.status}`);
    console.log(`  進度: ${stats.completed + stats.failed}/${stats.total} (${progress}%)`);
    console.log(`  ✅ 已完成: ${stats.completed} | ❌ 失敗: ${stats.failed} | 🔄 處理中: ${stats.processing} | ⏳ 待處理: ${stats.pending}`);

    if (batch.totalCost) {
      console.log(`  💰 累計成本: $${batch.totalCost.toFixed(4)}`);
    }

    return batch.status;
  } catch (error) {
    console.error('檢查進度錯誤:', error.message);
    return null;
  }
}

async function monitor() {
  console.log('='.repeat(60));
  console.log('TEST-PLAN-005 批次處理監控');
  console.log('批次 ID:', BATCH_ID);
  console.log('='.repeat(60));

  let status = await checkProgress();

  while (status === 'PROCESSING') {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    console.log('-'.repeat(40));
    status = await checkProgress();
  }

  console.log('='.repeat(60));
  if (status === 'COMPLETED') {
    console.log('✅ 批次處理完成！');
  } else if (status === 'FAILED') {
    console.log('❌ 批次處理失敗');
  } else if (status === 'AGGREGATED') {
    console.log('✅ 批次處理並聚合完成！');
  } else {
    console.log(`批次狀態: ${status}`);
  }
  console.log('='.repeat(60));

  await prisma.$disconnect();
  await pool.end();
}

monitor();
