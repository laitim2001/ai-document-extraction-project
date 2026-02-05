import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const companyId = '4a2da1d6-9dc2-451d-8f28-ea993d6149a2';
  const formatId = 'cml7q21ru000jzcxgiac6ch16';

  console.log('=== 查詢 Kintetsu 相關的 Prompt Configs ===\n');

  // 1. 查詢該公司的所有 prompt configs
  const companyConfigs = await prisma.promptConfig.findMany({
    where: { companyId },
    include: {
      company: { select: { name: true } },
      documentFormat: { select: { id: true, documentType: true, documentSubtype: true } },
    },
  });

  console.log(`公司 ${companyId} 的 Prompt Configs (${companyConfigs.length} 條):\n`);
  companyConfigs.forEach((c, i) => {
    console.log(`${i + 1}. ID: ${c.id}`);
    console.log(`   Name: ${c.name}`);
    console.log(`   Type: ${c.promptType}`);
    console.log(`   Scope: ${c.scope}`);
    console.log(`   CompanyId: ${c.companyId}`);
    console.log(`   DocumentFormatId: ${c.documentFormatId}`);
    if (c.documentFormat) {
      console.log(`   Format: ${c.documentFormat.documentType} / ${c.documentFormat.documentSubtype}`);
    }
    console.log('');
  });

  // 2. 查詢該文件格式的所有 prompt configs
  const formatConfigs = await prisma.promptConfig.findMany({
    where: { documentFormatId: formatId },
  });

  console.log(`\n文件格式 ${formatId} 的 Prompt Configs (${formatConfigs.length} 條):\n`);
  formatConfigs.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name} (${c.promptType}) - Scope: ${c.scope}`);
  });

  // 3. 查詢該文件格式的詳細信息
  const format = await prisma.documentFormat.findUnique({
    where: { id: formatId },
    include: {
      company: { select: { id: true, name: true } },
      promptConfigs: true,
    },
  });

  console.log(`\n=== 文件格式詳情 ===`);
  if (format) {
    console.log(`ID: ${format.id}`);
    console.log(`Company: ${format.company?.name} (${format.companyId})`);
    console.log(`Type: ${format.documentType} / ${format.documentSubtype}`);
    console.log(`Prompt Configs: ${format.promptConfigs.length}`);
    format.promptConfigs.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} (${c.promptType})`);
    });
  } else {
    console.log('找不到該文件格式');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
