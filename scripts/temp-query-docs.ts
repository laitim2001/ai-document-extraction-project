import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const docs = await prisma.document.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { id: true, fileName: true, filePath: true, status: true, createdAt: true }
  });
  console.log(JSON.stringify(docs, null, 2));
  await prisma.$disconnect();
}

main();
