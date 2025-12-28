/**
 * Test script to verify complete hierarchical term aggregation service
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

// Simplified term normalization for testing
function normalizeForAggregation(term: string): string {
  return term.toUpperCase().trim().replace(/\s+/g, ' ');
}

function extractTermsFromResult(result: ExtractionResultJson | null): string[] {
  if (!result) return [];
  const descriptions: string[] = [];

  // FIXED logic - using lineItems instead of items
  const items =
    result.lineItems ??
    result.items ??
    result.invoiceData?.lineItems ??  // FIXED
    result.extractedData?.lineItems ??
    [];

  for (const item of items) {
    if (item.description) {
      descriptions.push(item.description);
    }
  }
  return descriptions;
}

interface InternalTermData {
  count: number;
  examples: string[];
}

async function main() {
  const batchId = '6198eff9-8d55-4235-905e-49f58ebbd8ac';

  console.log('=== Hierarchical Term Aggregation Test ===\n');
  console.log('Testing batch:', batchId);

  // 1. Get files with issuer and format info (like the real service)
  const files = await prisma.historicalFile.findMany({
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

  console.log('\nFound', files.length, 'completed files with issuer and format\n');

  // 2. Build hierarchical structure
  type CompanyData = {
    company: NonNullable<typeof files[0]['documentIssuer']>;
    formats: Map<string, {
      format: NonNullable<typeof files[0]['documentFormat']>;
      terms: Map<string, InternalTermData>;
    }>;
  };

  const companyMap = new Map<string, CompanyData>();

  for (const file of files) {
    const issuerId = file.documentIssuerId!;
    const formatId = file.documentFormatId!;

    // Ensure company node exists
    if (!companyMap.has(issuerId)) {
      companyMap.set(issuerId, {
        company: file.documentIssuer!,
        formats: new Map(),
      });
    }

    const companyNode = companyMap.get(issuerId)!;

    // Ensure format node exists
    if (!companyNode.formats.has(formatId)) {
      companyNode.formats.set(formatId, {
        format: file.documentFormat!,
        terms: new Map(),
      });
    }

    const formatNode = companyNode.formats.get(formatId)!;

    // Extract and aggregate terms
    const extractionResult = file.extractionResult as ExtractionResultJson | null;
    const lineItems = extractTermsFromResult(extractionResult);

    for (const description of lineItems) {
      if (!description) continue;
      const normalizedTerm = normalizeForAggregation(description);
      if (!normalizedTerm || normalizedTerm.length < 2) continue;

      const existing = formatNode.terms.get(normalizedTerm);
      if (existing) {
        existing.count++;
        if (existing.examples.length < 3) {
          existing.examples.push(description);
        }
      } else {
        formatNode.terms.set(normalizedTerm, {
          count: 1,
          examples: [description],
        });
      }
    }
  }

  // 3. Output results
  console.log('=== Aggregation Results ===\n');

  let totalCompanies = 0;
  let totalFormats = 0;
  let totalUniqueTerms = 0;
  let totalTermOccurrences = 0;

  for (const [companyId, companyData] of companyMap) {
    totalCompanies++;
    console.log('Company:', companyData.company.name);
    console.log('  ID:', companyId);

    for (const [formatId, formatData] of companyData.formats) {
      totalFormats++;
      console.log('  Format:', formatData.format.name || formatData.format.documentType);
      console.log('    ID:', formatId);
      console.log('    Terms:', formatData.terms.size);

      totalUniqueTerms += formatData.terms.size;

      // Show first 5 terms
      let count = 0;
      for (const [term, data] of formatData.terms) {
        if (count++ >= 5) break;
        totalTermOccurrences += data.count;
        console.log('      -', term.substring(0, 40), '(', data.count, 'x)');
      }

      // Count remaining
      for (const [, data] of Array.from(formatData.terms.entries()).slice(5)) {
        totalTermOccurrences += data.count;
      }
    }
    console.log('');
  }

  console.log('=== Summary (What Excel Report Should Show) ===');
  console.log('Total Companies:', totalCompanies);
  console.log('Total Formats:', totalFormats);
  console.log('Total Unique Terms:', totalUniqueTerms);
  console.log('Total Term Occurrences:', totalTermOccurrences);

  if (totalUniqueTerms > 0) {
    console.log('\n✅ SUCCESS: Data is available for Excel export!');
    console.log('Excel report should show non-zero values for all metrics.');
  } else {
    console.log('\n❌ FAILED: No data available for Excel export');
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
