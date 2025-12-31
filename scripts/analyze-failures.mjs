/**
 * @fileoverview Analyze failure reasons for TEST-PLAN-005 batch
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
    console.log('='.repeat(60));
    console.log('TEST-PLAN-005 失敗分析');
    console.log('='.repeat(60));

    // Get failed files
    const failedFiles = await prisma.historicalFile.findMany({
      where: {
        batchId: BATCH_ID,
        status: 'FAILED'
      },
      select: {
        id: true,
        fileName: true,
        errorMessage: true,
        processingMethod: true,
      },
      orderBy: { fileName: 'asc' }
    });

    console.log(`失敗文件數: ${failedFiles.length}\n`);

    // Group by error message
    const errorGroups = {};
    failedFiles.forEach(f => {
      const key = f.errorMessage || 'No error message';
      if (!errorGroups[key]) {
        errorGroups[key] = [];
      }
      errorGroups[key].push(f.fileName);
    });

    console.log('錯誤類型分布:');
    console.log('-'.repeat(60));
    Object.entries(errorGroups)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([error, files]) => {
        console.log(`\n[${files.length} 個文件] ${error.substring(0, 100)}...`);
        console.log('  示例文件:');
        files.slice(0, 3).forEach(f => console.log('    - ' + f));
      });

    // Get successful files for comparison
    const successFiles = await prisma.historicalFile.findMany({
      where: {
        batchId: BATCH_ID,
        status: 'COMPLETED'
      },
      select: {
        id: true,
        fileName: true,
        processingMethod: true,
        documentIssuer: true,
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('成功文件統計');
    console.log('='.repeat(60));
    console.log(`成功文件數: ${successFiles.length}`);

    // Group by processing method
    const methodGroups = {};
    successFiles.forEach(f => {
      const key = f.processingMethod || 'Unknown';
      if (!methodGroups[key]) methodGroups[key] = 0;
      methodGroups[key]++;
    });
    console.log('\n處理方法分布:');
    Object.entries(methodGroups).forEach(([method, count]) => {
      console.log(`  ${method}: ${count}`);
    });

    // Count unique issuers
    const issuers = new Set(successFiles.filter(f => f.documentIssuer).map(f => f.documentIssuer));
    console.log(`\n識別到的發行商數: ${issuers.size}`);

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('錯誤:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
