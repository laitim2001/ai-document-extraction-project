/**
 * @fileoverview 查詢批次 ID 腳本
 * @description 查詢指定名稱的歷史數據批次
 */

import { PrismaClient, HistoricalBatchStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const batches = await prisma.historicalBatch.findMany({
      where: { name: { contains: 'E2E-TEST-132' } },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        _count: { select: { files: true } }
      }
    });

    console.log('=== Batch Found ===');
    console.log(JSON.stringify(batches, null, 2));

    if (batches.length > 0) {
      console.log('\n=== Batch ID ===');
      console.log(batches[0].id);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
