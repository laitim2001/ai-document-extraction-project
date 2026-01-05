/**
 * @fileoverview 診斷並驗證 FIX-006 - Hierarchical Term Aggregation Fallback Mode
 *
 * FIX-006: 當文件沒有 documentFormatId 時，hierarchical-term-aggregation 會
 *          fallback 到只使用 documentIssuerId 進行聚合（Company → Terms 結構）
 *
 * 此腳本驗證：
 * 1. 確認批次文件沒有 documentFormatId（需要 fallback）
 * 2. 模擬 FIX-006 的 fallback 查詢邏輯
 * 3. 統計聚合結果
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

// Create Prisma client with Prisma 7.x adapter
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/ai_document_extraction'
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function debugFormatIssue() {
  const batchId = '0fdc7e9b-44ca-4eb9-9d33-8ed18f016a3c';

  console.log('='.repeat(60));
  console.log('Format ID 未設置問題診斷');
  console.log('='.repeat(60));
  console.log(`批次 ID: ${batchId}\n`);

  // 1. 檢查批次配置
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      name: true,
      status: true,
      // Format identification config
      enableFormatIdentification: true,
      formatConfidenceThreshold: true,
      autoCreateFormat: true,
      formatsIdentified: true,
      // Issuer identification config
      enableIssuerIdentification: true,
      issuerConfidenceThreshold: true,
      autoCreateIssuerCompany: true,
      issuersIdentified: true,
      // Company identification config
      enableCompanyIdentification: true,
      fuzzyMatchThreshold: true,
      companiesIdentified: true,
      // Term aggregation config
      enableTermAggregation: true,
      termSimilarityThreshold: true,
    }
  });

  console.log('📦 批次配置:');
  console.log(`  名稱: ${batch?.name}`);
  console.log(`  狀態: ${batch?.status}`);
  console.log('');
  console.log('  格式識別配置:');
  console.log(`    enableFormatIdentification: ${batch?.enableFormatIdentification}`);
  console.log(`    formatConfidenceThreshold: ${batch?.formatConfidenceThreshold}`);
  console.log(`    autoCreateFormat: ${batch?.autoCreateFormat}`);
  console.log(`    formatsIdentified: ${batch?.formatsIdentified}`);
  console.log('');
  console.log('  發行方識別配置:');
  console.log(`    enableIssuerIdentification: ${batch?.enableIssuerIdentification}`);
  console.log(`    issuerConfidenceThreshold: ${batch?.issuerConfidenceThreshold}`);
  console.log(`    autoCreateIssuerCompany: ${batch?.autoCreateIssuerCompany}`);
  console.log(`    issuersIdentified: ${batch?.issuersIdentified}`);
  console.log('');
  console.log('  公司識別配置:');
  console.log(`    enableCompanyIdentification: ${batch?.enableCompanyIdentification}`);
  console.log(`    fuzzyMatchThreshold: ${batch?.fuzzyMatchThreshold}`);
  console.log(`    companiesIdentified: ${batch?.companiesIdentified}`);
  console.log('');

  // 2. 檢查一些檔案的提取結果
  const sampleFiles = await prisma.historicalFile.findMany({
    where: { batchId, status: 'COMPLETED' },
    take: 3,
    select: {
      id: true,
      fileName: true,
      documentIssuerId: true,
      documentFormatId: true,
      extractionResult: true,
      documentIssuer: {
        select: {
          id: true,
          name: true,
          displayName: true,
        }
      }
    }
  });

  console.log('📄 範例檔案提取結果分析:');
  for (const file of sampleFiles) {
    console.log(`\n  檔案: ${file.fileName.substring(0, 50)}...`);
    console.log(`    documentIssuerId: ${file.documentIssuerId || '❌ NULL'}`);
    console.log(`    documentFormatId: ${file.documentFormatId || '❌ NULL'}`);

    if (file.documentIssuer) {
      console.log(`    issuer.id: ${file.documentIssuer.id}`);
      console.log(`    issuer.name: ${file.documentIssuer.name}`);
      console.log(`    issuer.displayName: ${file.documentIssuer.displayName || '(無)'}`);
    }

    // 檢查 extractionResult 中是否有 documentFormat
    const extraction = file.extractionResult;
    if (extraction && typeof extraction === 'object') {
      const extractionObj = extraction;
      console.log(`    extractionResult 結構:`);
      console.log(`      - 有 invoiceData: ${!!extractionObj.invoiceData}`);
      console.log(`      - 有 documentFormat: ${!!extractionObj.documentFormat}`);

      if (extractionObj.documentFormat) {
        console.log(`      - documentFormat.documentType: ${extractionObj.documentFormat.documentType || '❌ 無'}`);
        console.log(`      - documentFormat.subType: ${extractionObj.documentFormat.subType || '❌ 無'}`);
      }

      // 檢查 GPT Vision 的輸出
      if (extractionObj.gptVisionResult) {
        console.log(`      - 有 gptVisionResult: ✅`);
        if (extractionObj.gptVisionResult.documentFormat) {
          console.log(`        - gptVisionResult.documentFormat: ${JSON.stringify(extractionObj.gptVisionResult.documentFormat)}`);
        }
      }
    }
  }

  // 3. 統計 extractionResult 中有 documentFormat 的檔案數
  const allCompletedFiles = await prisma.historicalFile.findMany({
    where: { batchId, status: 'COMPLETED' },
    select: {
      extractionResult: true,
    }
  });

  let hasDocumentFormat = 0;
  let hasDocumentType = 0;

  for (const file of allCompletedFiles) {
    const extraction = file.extractionResult;
    if (extraction && typeof extraction === 'object') {
      if (extraction.documentFormat) {
        hasDocumentFormat++;
        if (extraction.documentFormat.documentType) {
          hasDocumentType++;
        }
      }
    }
  }

  console.log('\n\n📊 extractionResult.documentFormat 統計:');
  console.log(`  總 COMPLETED 檔案: ${allCompletedFiles.length}`);
  console.log(`  有 documentFormat: ${hasDocumentFormat}`);
  console.log(`  有 documentFormat.documentType: ${hasDocumentType}`);
  console.log('');

  // 4. FIX-006 驗證：模擬 fallback 聚合邏輯
  console.log('\n🔄 FIX-006 Fallback 模式驗證...\n');

  // Step 1: 嘗試標準查詢 (需要 documentIssuerId AND documentFormatId)
  const filesWithBothIds = await prisma.historicalFile.count({
    where: {
      batchId,
      status: 'COMPLETED',
      documentIssuerId: { not: null },
      documentFormatId: { not: null },
    },
  });
  console.log(`Step 1: 標準查詢 (有兩個 ID): ${filesWithBothIds} 個檔案`);

  // Step 2: Fallback 查詢 (只需要 documentIssuerId)
  const filesWithIssuerId = await prisma.historicalFile.count({
    where: {
      batchId,
      status: 'COMPLETED',
      documentIssuerId: { not: null },
    },
  });
  console.log(`Step 2: Fallback 查詢 (只有 IssuerId): ${filesWithIssuerId} 個檔案`);

  const useFallbackMode = filesWithBothIds === 0;
  console.log(`        使用 Fallback 模式: ${useFallbackMode ? '✅ 是' : '❌ 否'}`);

  // Step 3: 模擬術語提取
  if (useFallbackMode && filesWithIssuerId > 0) {
    const fallbackFiles = await prisma.historicalFile.findMany({
      where: {
        batchId,
        status: 'COMPLETED',
        documentIssuerId: { not: null },
      },
      include: {
        documentIssuer: true,
      },
    });

    const companySet = new Set();
    const termSet = new Set();
    let totalOccurrences = 0;

    for (const file of fallbackFiles) {
      if (file.documentIssuer) {
        companySet.add(file.documentIssuerId);
      }

      // 提取術語
      const extraction = file.extractionResult;
      if (extraction && typeof extraction === 'object') {
        const lineItems =
          extraction.lineItems ||
          extraction.items ||
          extraction.invoiceData?.lineItems ||
          extraction.extractedData?.lineItems ||
          [];

        for (const item of lineItems) {
          if (item.description) {
            const normalized = item.description.toUpperCase().trim();
            if (normalized.length >= 2) {
              termSet.add(normalized);
              totalOccurrences++;
            }
          }
        }
      }
    }

    console.log('\n📊 FIX-006 Fallback 聚合結果預覽:');
    console.log(`  公司數: ${companySet.size}`);
    console.log(`  唯一術語數: ${termSet.size}`);
    console.log(`  術語出現總次數: ${totalOccurrences}`);

    // 顯示部分術語範例
    if (termSet.size > 0) {
      const sampleTerms = Array.from(termSet).slice(0, 15);
      console.log('\n📝 範例術語 (前 15 個):');
      for (const term of sampleTerms) {
        const shortTerm = term.length > 50 ? term.substring(0, 47) + '...' : term;
        console.log(`  - ${shortTerm}`);
      }
    }

    console.log('\n✅ FIX-006 驗證結果:');
    if (termSet.size > 0) {
      console.log(`  🎉 成功！Fallback 模式能夠提取術語`);
      console.log(`  預期導出將包含 ${termSet.size} 個唯一術語（來自 ${companySet.size} 個公司）`);
    } else {
      console.log(`  ⚠️ 警告：Fallback 模式無法提取術語`);
      console.log(`  可能原因：extractionResult.lineItems 中沒有數據`);
    }
  } else if (!useFallbackMode) {
    console.log('\n✅ FIX-006: 不需要 Fallback 模式，標準查詢有足夠數據');
  } else {
    console.log('\n❌ 錯誤：既沒有 documentFormatId 也沒有 documentIssuerId');
  }

  await prisma.$disconnect();
  await pool.end();
}

debugFormatIssue().catch(console.error);
