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

async function checkStatus() {
  const batch = await prisma.historicalBatch.findFirst({
    where: { id: batchId },
    include: {
      _count: {
        select: { files: true }
      }
    }
  });

  const completed = await prisma.historicalFile.count({
    where: { batchId, status: 'COMPLETED' }
  });

  const processing = await prisma.historicalFile.count({
    where: { batchId, status: 'PROCESSING' }
  });

  const failed = await prisma.historicalFile.count({
    where: { batchId, status: 'FAILED' }
  });

  const pending = await prisma.historicalFile.count({
    where: { batchId, status: { in: ['PENDING', 'DETECTED'] } }
  });

  console.log('=== Batch Status (Real-time) ===');
  console.log('Batch ID:', batch.id);
  console.log('Batch Name:', batch.name);
  console.log('Batch Status:', batch.status);
  console.log('Total Files:', batch._count.files);
  console.log('');
  console.log('File Status:');
  console.log('  ✅ Completed:', completed);
  console.log('  🔄 Processing:', processing);
  console.log('  ⏳ Pending:', pending);
  console.log('  ❌ Failed:', failed);
  console.log('');
  console.log('Progress:', Math.round((completed / batch._count.files) * 100) + '%');

  await prisma.$disconnect();
}

checkStatus().catch(console.error);
