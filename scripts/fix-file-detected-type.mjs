/**
 * @fileoverview Fix file detectedType for TEST-PLAN-005 batch
 * @description Set detectedType to NATIVE_PDF for all files to enable processing
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
  console.log('='.repeat(60));
  console.log('修復文件 detectedType 欄位');
  console.log('='.repeat(60));

  try {
    // Step 1: Check current state
    console.log('\n[Step 1] 檢查當前文件狀態...');
    const files = await prisma.historicalFile.findMany({
      where: { batchId: BATCH_ID },
      select: { id: true, fileName: true, detectedType: true, status: true }
    });

    const withType = files.filter(f => f.detectedType !== null);
    const withoutType = files.filter(f => f.detectedType === null);

    console.log(`  總文件數: ${files.length}`);
    console.log(`  已檢測類型: ${withType.length}`);
    console.log(`  未檢測類型: ${withoutType.length}`);

    if (withoutType.length === 0) {
      console.log('  ✅ 所有文件已有檢測類型');
      return;
    }

    // Step 2: Update files with detectedType
    console.log('\n[Step 2] 設定文件類型為 NATIVE_PDF...');
    const updateResult = await prisma.historicalFile.updateMany({
      where: {
        batchId: BATCH_ID,
        detectedType: null
      },
      data: {
        detectedType: 'NATIVE_PDF',
        detectedAt: new Date(),
        status: 'DETECTED'
      }
    });
    console.log(`  ✅ 已更新 ${updateResult.count} 個文件`);

    // Step 3: Verify
    console.log('\n[Step 3] 驗證更新結果...');
    const updatedFiles = await prisma.historicalFile.findMany({
      where: { batchId: BATCH_ID },
      select: { detectedType: true, status: true }
    });

    const detectedCount = updatedFiles.filter(f => f.detectedType !== null).length;
    const pendingCount = updatedFiles.filter(f => f.status === 'DETECTED').length;

    console.log(`  已檢測類型文件: ${detectedCount}/${files.length}`);
    console.log(`  DETECTED 狀態文件: ${pendingCount}/${files.length}`);

    // Step 4: Ensure batch is in PENDING status
    console.log('\n[Step 4] 確認批次狀態...');
    const batch = await prisma.historicalBatch.findUnique({
      where: { id: BATCH_ID }
    });

    if (batch?.status !== 'PENDING') {
      await prisma.historicalBatch.update({
        where: { id: BATCH_ID },
        data: { status: 'PENDING' }
      });
      console.log('  ✅ 批次狀態已設為 PENDING');
    } else {
      console.log(`  批次狀態: ${batch.status}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('完成！請在 UI 中刷新頁面並點擊「開始處理」按鈕');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
