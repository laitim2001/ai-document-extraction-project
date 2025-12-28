/**
 * Setup document formats and test hierarchical aggregation
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const batchId = '6198eff9-8d55-4235-905e-49f58ebbd8ac';

  console.log('=== Setup Document Formats for Test ===\n');

  // Get files with their issuers
  const files = await prisma.historicalFile.findMany({
    where: { batchId, status: 'COMPLETED' },
    include: { documentIssuer: true },
  });

  console.log('Found', files.length, 'files\n');

  // Create a document format for each issuer and link files
  for (const file of files) {
    if (!file.documentIssuerId || !file.documentIssuer) {
      console.log('Skipping file without issuer:', file.fileName);
      continue;
    }

    // Check if format already exists for this company
    let format = await prisma.documentFormat.findFirst({
      where: { companyId: file.documentIssuerId },
    });

    if (!format) {
      // Create a format
      format = await prisma.documentFormat.create({
        data: {
          companyId: file.documentIssuerId,
          documentType: 'INVOICE',
          documentSubtype: 'OCEAN_FREIGHT',
          name: file.documentIssuer.name + ' - Freight Invoice',
          commonTerms: [],
          fileCount: 0,
        },
      });
      console.log('Created format:', format.name, '- ID:', format.id);
    }

    // Update file with format
    await prisma.historicalFile.update({
      where: { id: file.id },
      data: { documentFormatId: format.id },
    });

    // Increment file count
    await prisma.documentFormat.update({
      where: { id: format.id },
      data: { fileCount: { increment: 1 } },
    });

    console.log('  Linked file:', file.fileName.substring(0, 30), '...');
  }

  console.log('\n=== Verification ===');

  // Verify the setup
  const updatedFiles = await prisma.historicalFile.findMany({
    where: {
      batchId,
      status: 'COMPLETED',
      documentIssuerId: { not: null },
      documentFormatId: { not: null },
    },
    include: {
      documentIssuer: true,
      documentFormat: true,
    },
  });

  console.log('\nFiles with issuer AND format:', updatedFiles.length);

  if (updatedFiles.length > 0) {
    console.log('\n✅ Setup complete! Now testing term extraction...\n');

    // Test term extraction
    interface ExtractionResultJson {
      lineItems?: Array<{ description?: string | null }>;
      items?: Array<{ description?: string | null }>;
      invoiceData?: { lineItems?: Array<{ description?: string | null }> };
      extractedData?: { lineItems?: Array<{ description?: string | null }> };
    }

    let totalTerms = 0;
    const termMap = new Map<string, number>();

    for (const file of updatedFiles) {
      const result = file.extractionResult as ExtractionResultJson | null;
      if (!result) continue;

      const items =
        result.lineItems ??
        result.items ??
        result.invoiceData?.lineItems ??  // FIXED in FIX-004b
        result.extractedData?.lineItems ??
        [];

      for (const item of items) {
        if (item.description) {
          const normalized = item.description.toUpperCase().trim();
          termMap.set(normalized, (termMap.get(normalized) || 0) + 1);
          totalTerms++;
        }
      }
    }

    console.log('Total Terms Extracted:', totalTerms);
    console.log('Unique Terms:', termMap.size);
    console.log('\nHierarchical Structure Ready:');
    console.log('  Companies:', new Set(updatedFiles.map(f => f.documentIssuerId)).size);
    console.log('  Formats:', new Set(updatedFiles.map(f => f.documentFormatId)).size);
    console.log('  Files:', updatedFiles.length);
    console.log('\n✅ Excel export should now work correctly!');
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
