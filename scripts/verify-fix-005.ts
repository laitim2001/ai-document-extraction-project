/**
 * FIX-005 驗證腳本 - 重新聚合術語並比較效果
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Prisma 7.x 需要使用 driver adapter
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ============================================================================
// 從 term-aggregation.service.ts 複製的函數和常數
// ============================================================================

const ADDRESS_KEYWORDS = [
  'STREET', 'ROAD', 'AVENUE', 'BOULEVARD', 'LANE', 'DRIVE', 'COURT',
  'PLACE', 'SQUARE', 'WARD', 'DISTRICT', 'PROVINCE', 'CITY', 'COUNTY',
  'STATE', 'COUNTRY', 'FLOOR', 'BUILDING', 'TOWER', 'BLOCK', 'UNIT',
  'SUITE', 'APARTMENT', 'ROOM', 'HIGHWAY', 'EXPRESSWAY',
  'DUONG', 'PHO', 'QUAN', 'PHUONG', 'TINH', 'THANH PHO', 'HUYEN', 'XA',
  'TANG', 'TOA NHA', 'CAN HO', 'PHONG', 'KHU', 'KHU PHO', 'AP',
  'ST', 'RD', 'AVE', 'BLVD', 'FLR', 'BLDG', 'BLK', 'APT',
];

const LOCATION_NAMES = [
  'VIETNAM', 'VIET NAM', 'CHINA', 'HONG KONG', 'SINGAPORE', 'THAILAND',
  'MALAYSIA', 'INDONESIA', 'PHILIPPINES', 'TAIWAN', 'JAPAN', 'KOREA',
  'INDIA', 'AUSTRALIA', 'UNITED STATES', 'UNITED KINGDOM', 'GERMANY', 'FRANCE',
  'HO CHI MINH', 'HOCHIMINH', 'SAIGON', 'HANOI', 'HA NOI', 'DA NANG',
  'HAI PHONG', 'CAN THO', 'NHA TRANG', 'VUNG TAU', 'BIEN HOA',
  'BINH DUONG', 'DONG NAI', 'LONG AN', 'BAC NINH', 'QUANG NINH',
  'SHANGHAI', 'BEIJING', 'SHENZHEN', 'GUANGZHOU', 'KOWLOON', 'TSIM SHA TSUI',
  'BANGKOK', 'KUALA LUMPUR', 'JAKARTA', 'MANILA', 'TAIPEI',
  'TOKYO', 'OSAKA', 'SEOUL', 'MUMBAI', 'NEW DELHI', 'SYDNEY', 'MELBOURNE',
];

const ADDRESS_PATTERNS = [
  /\b\d+\s*(?:F|\/F|FL|FLR|FLOOR|TANG)\b/i,
  /\b(?:F|\/F|FL|FLR|FLOOR|TANG)\s*\d+\b/i,
  /\b(?:NO\.?|SO)\s*\d+/i,
  /^\d+[A-Z]?\s+(?:STREET|ROAD|DUONG|PHO)/i,
  /\b\d{5,6}\b/,
  /^[^,]+,[^,]+,[^,]+/,
  /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
];

/**
 * FIX-005.1: Currency codes that indicate the term is a price/charge line item
 * If a term contains any of these codes, it should NOT be filtered out
 * even if it matches ADDRESS_PATTERNS (e.g., postal code pattern matching exchange rates)
 */
const CURRENCY_CODES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'SGD', 'THB',
  'MYR', 'IDR', 'PHP', 'VND', 'TWD', 'KRW', 'INR', 'AUD',
  'NZD', 'CAD', 'CHF', 'AED', 'SAR', 'KWD', 'BHD', 'QAR',
];

function normalizeForAggregation(term: string): string {
  if (!term || typeof term !== 'string') return '';
  return term
    .toUpperCase()
    .trim()
    .replace(/[^\w\s\-\/\.&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * FIX-005.1: Checks if a term contains any currency code
 * Used to identify price/charge line items that should not be filtered out
 */
function containsCurrencyCode(term: string): boolean {
  for (const code of CURRENCY_CODES) {
    const pattern = new RegExp(`\\b${code}\\b`, 'i');
    if (pattern.test(term)) {
      return true;
    }
  }
  return false;
}

function isAddressLikeTerm(term: string): boolean {
  if (!term) return false;
  const upperTerm = term.toUpperCase();

  // FIX-005.1: Check if term contains currency code
  const hasCurrency = containsCurrencyCode(upperTerm);

  // Check for address keywords (always check regardless of currency)
  for (const keyword of ADDRESS_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(upperTerm)) return true;
  }

  // Check for location names (always check regardless of currency)
  for (const location of LOCATION_NAMES) {
    if (upperTerm.includes(location)) return true;
  }

  // FIX-005.1: Skip ADDRESS_PATTERNS check if term contains currency code
  // This prevents price lines like "FREIGHT CHARGES USD 65.00 7.881487" from being
  // incorrectly filtered by the postal code pattern matching "881487"
  if (!hasCurrency) {
    for (const pattern of ADDRESS_PATTERNS) {
      if (pattern.test(upperTerm)) return true;
    }
  }

  // Skip length check if term contains currency (price lines can be longer)
  if (!hasCurrency && upperTerm.length > 80) return true;

  return false;
}

interface LineItem {
  description?: string | null;
  chargeType?: string | null;
  name?: string | null;
}

interface ExtractionResult {
  invoiceData?: {
    lineItems?: LineItem[];
    items?: LineItem[];
  };
  extractedData?: {
    lineItems?: LineItem[];
  };
}

async function main() {
  console.log('=== FIX-005 術語過濾驗證 ===\n');

  // 1. 找到最近完成的批次
  const batch = await prisma.historicalBatch.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      totalFiles: true,
    }
  });

  if (!batch) {
    console.log('❌ 找不到已完成的批次');
    return;
  }

  console.log(`批次 ID: ${batch.id}`);
  console.log(`批次名稱: ${batch.name}`);
  console.log(`文件數量: ${batch.totalFiles}`);
  console.log('');

  // 2. 獲取該批次的所有文件提取結果
  const files = await prisma.historicalFile.findMany({
    where: {
      batchId: batch.id,
      status: 'COMPLETED',
      extractionResult: { not: Prisma.JsonNull }
    },
    select: {
      id: true,
      fileName: true,
      extractionResult: true,
    }
  });

  console.log(`已處理文件: ${files.length}\n`);

  // 3. 統計過濾前後的術語
  let totalTermsBefore = 0;
  let totalTermsAfter = 0;
  const filteredOutTerms: string[] = [];
  const validTerms: string[] = [];

  for (const file of files) {
    const result = file.extractionResult as ExtractionResult | null;
    if (!result) continue;

    // 從 invoiceData.lineItems 提取
    const lineItems = result.invoiceData?.lineItems || result.invoiceData?.items || [];
    for (const item of lineItems) {
      if (item.description) {
        const normalized = normalizeForAggregation(item.description);
        if (normalized.length >= 2) {
          totalTermsBefore++;
          if (isAddressLikeTerm(normalized)) {
            filteredOutTerms.push(normalized);
          } else {
            totalTermsAfter++;
            validTerms.push(normalized);
          }
        }
      }
    }

    // 從 extractedData.lineItems 提取 (GPT Vision)
    const gptLineItems = result.extractedData?.lineItems || [];
    for (const item of gptLineItems) {
      if (item.description) {
        const normalized = normalizeForAggregation(item.description);
        if (normalized.length >= 2) {
          totalTermsBefore++;
          if (isAddressLikeTerm(normalized)) {
            filteredOutTerms.push(normalized);
          } else {
            totalTermsAfter++;
            validTerms.push(normalized);
          }
        }
      }
      if (item.chargeType) {
        const normalized = normalizeForAggregation(item.chargeType);
        if (normalized.length >= 2) {
          totalTermsBefore++;
          if (isAddressLikeTerm(normalized)) {
            filteredOutTerms.push(normalized);
          } else {
            totalTermsAfter++;
            validTerms.push(normalized);
          }
        }
      }
    }
  }

  // 4. 輸出統計結果
  console.log('=== 過濾統計 ===');
  console.log(`過濾前術語總數: ${totalTermsBefore}`);
  console.log(`過濾後術語總數: ${totalTermsAfter}`);
  console.log(`被過濾的術語數: ${filteredOutTerms.length}`);
  console.log(`過濾比例: ${((filteredOutTerms.length / totalTermsBefore) * 100).toFixed(1)}%`);
  console.log('');

  // 5. 顯示被過濾的術語樣本 (去重)
  const uniqueFiltered = [...new Set(filteredOutTerms)];
  console.log(`=== 被過濾的術語樣本 (共 ${uniqueFiltered.length} 種) ===`);
  uniqueFiltered.slice(0, 30).forEach((term, i) => {
    console.log(`${i + 1}. ${term}`);
  });
  if (uniqueFiltered.length > 30) {
    console.log(`... 還有 ${uniqueFiltered.length - 30} 個`);
  }
  console.log('');

  // 6. 顯示有效術語樣本 (去重，按頻率排序)
  const termFrequency = new Map<string, number>();
  validTerms.forEach(term => {
    termFrequency.set(term, (termFrequency.get(term) || 0) + 1);
  });

  const sortedTerms = [...termFrequency.entries()]
    .sort((a, b) => b[1] - a[1]);

  console.log(`=== 有效術語 Top 30 (共 ${termFrequency.size} 種) ===`);
  sortedTerms.slice(0, 30).forEach(([term, count], i) => {
    console.log(`${i + 1}. ${term} (${count}次)`);
  });

  console.log('\n✅ FIX-005 驗證完成');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
