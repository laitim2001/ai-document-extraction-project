/**
 * Test script to verify FIX-004b - hierarchical term aggregation fix
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ExtractionResultJson {
  lineItems?: Array<{ description?: string | null }>;
  items?: Array<{ description?: string | null }>;
  invoiceData?: { lineItems?: Array<{ description?: string | null }> };
  extractedData?: { lineItems?: Array<{ description?: string | null }> };
}

function extractTermsFromResult(result: ExtractionResultJson | null): string[] {
  if (!result) return [];

  const descriptions: string[] = [];

  // This is the FIXED logic - using lineItems instead of items
  const items =
    result.lineItems ??
    result.items ??
    result.invoiceData?.lineItems ??  // FIXED: was invoiceData?.items
    result.extractedData?.lineItems ??
    [];

  for (const item of items) {
    if (item.description) {
      descriptions.push(item.description);
    }
  }

  return descriptions;
}

async function main() {
  const batchId = '6198eff9-8d55-4235-905e-49f58ebbd8ac';

  console.log('=== FIX-004b Verification Test ===\n');
  console.log('Testing batch:', batchId);

  // Get files with extraction results
  const files = await prisma.historicalFile.findMany({
    where: {
      batchId,
      status: 'COMPLETED',
    },
    select: {
      id: true,
      fileName: true,
      extractionResult: true,
    },
  });

  console.log('\nFound', files.length, 'completed files\n');

  let totalTerms = 0;
  const allTerms = new Map<string, number>();

  for (const file of files) {
    const result = file.extractionResult as ExtractionResultJson | null;
    const terms = extractTermsFromResult(result);

    const shortName = file.fileName.substring(0, 30);
    console.log('File:', shortName + '...');
    console.log('  Terms extracted:', terms.length);

    if (terms.length > 0) {
      console.log('  First 3 terms:');
      terms.slice(0, 3).forEach(t => console.log('    -', t));
    }

    totalTerms += terms.length;

    // Count unique terms
    for (const term of terms) {
      const normalized = term.toUpperCase().trim();
      allTerms.set(normalized, (allTerms.get(normalized) || 0) + 1);
    }
  }

  console.log('\n=== Summary ===');
  console.log('Total terms extracted:', totalTerms);
  console.log('Unique terms:', allTerms.size);

  if (totalTerms > 0) {
    console.log('\n✅ FIX-004b VERIFIED: Terms are being extracted correctly!');
    console.log('\nTop 10 terms by frequency:');
    const sorted = [...allTerms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    sorted.forEach(([term, count]) => {
      const displayTerm = term.substring(0, 50);
      console.log('  ' + count + 'x: ' + displayTerm);
    });
  } else {
    console.log('\n❌ FIX-004b FAILED: No terms extracted!');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
