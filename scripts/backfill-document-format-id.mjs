/**
 * @fileoverview FIX-006 回填腳本 - 修復缺少 documentFormatId 的歷史文件
 * @description
 *   此腳本用於修復因 batch-processor.service.ts 欄位映射錯誤
 *   導致 documentFormatId 未被設置的歷史文件
 *
 * @usage node scripts/backfill-document-format-id.mjs [batchId]
 * @example node scripts/backfill-document-format-id.mjs d8beb4ba-3501-45f0-9a92-3cfdf2e9f1a5
 */

import { config } from 'dotenv';
import pg from 'pg';
import crypto from 'crypto';

// Load environment variables
config();

/**
 * 生成類似 cuid 的 ID
 * 格式：25 字符，類似 "clp1234567890abcdefghij"
 */
function generateCuid() {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(12).toString('base64url').substring(0, 16);
  return `cl${timestamp}${randomPart}`.substring(0, 25);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/ai_doc_extraction'
});

/**
 * DocumentSubtype 映射：GPT Vision 返回值 → 資料庫 Enum 值
 */
const SUBTYPE_MAPPING = {
  'OCEAN': 'OCEAN_FREIGHT',
  'OCEAN_FREIGHT': 'OCEAN_FREIGHT',
  'AIR': 'AIR_FREIGHT',
  'AIR_FREIGHT': 'AIR_FREIGHT',
  'LAND': 'LAND_TRANSPORT',
  'LAND_TRANSPORT': 'LAND_TRANSPORT',
  'WAREHOUSE': 'WAREHOUSING',
  'WAREHOUSING': 'WAREHOUSING',
  'COURIER': 'GENERAL',
  'CUSTOMS': 'CUSTOMS_CLEARANCE',
  'CUSTOMS_CLEARANCE': 'CUSTOMS_CLEARANCE',
  'GENERAL': 'GENERAL'
};

/**
 * DocumentType 映射（大部分一致，處理特殊情況）
 */
const TYPE_MAPPING = {
  'INVOICE': 'INVOICE',
  'DEBIT_NOTE': 'DEBIT_NOTE',
  'CREDIT_NOTE': 'CREDIT_NOTE',
  'STATEMENT': 'STATEMENT',
  'QUOTATION': 'QUOTATION',
  'BILL_OF_LADING': 'BILL_OF_LADING',
  'CUSTOMS_DECLARATION': 'CUSTOMS_DECLARATION',
  'OTHER': 'OTHER',
  'UNKNOWN': 'OTHER'
};

/**
 * 從 extraction_result 中提取 documentFormat 資訊
 */
function extractDocumentFormat(extractionResult) {
  if (!extractionResult) return null;

  // FIX-006: 正確的路徑是 extractionResult.documentFormat
  const documentFormat = extractionResult.documentFormat;
  if (!documentFormat) return null;

  // 映射 GPT Vision 返回值到資料庫 enum 值
  const rawType = documentFormat.documentType || 'UNKNOWN';
  const rawSubtype = documentFormat.documentSubtype || 'GENERAL';

  return {
    documentType: TYPE_MAPPING[rawType] || 'OTHER',
    documentSubtype: SUBTYPE_MAPPING[rawSubtype] || 'GENERAL',
    formatConfidence: documentFormat.formatConfidence || 0,
    formatFeatures: documentFormat.formatFeatures || null
  };
}

/**
 * 查找或創建 DocumentFormat 記錄
 * 表名: document_formats
 */
async function findOrCreateFormat(client, companyId, formatData) {
  if (!formatData || !formatData.documentType) {
    return null;
  }

  // 先嘗試查找現有的格式
  const existing = await client.query(`
    SELECT id FROM document_formats
    WHERE company_id = $1 AND document_type = $2 AND (document_subtype = $3 OR ($3 IS NULL AND document_subtype IS NULL))
    LIMIT 1
  `, [companyId, formatData.documentType, formatData.documentSubtype]);

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // 創建新的格式記錄
  // 使用正確的欄位名：id, created_at, updated_at, name, features
  const newId = generateCuid();
  const now = new Date();
  const result = await client.query(`
    INSERT INTO document_formats (id, company_id, document_type, document_subtype, name, features, file_count, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $7)
    RETURNING id
  `, [
    newId,
    companyId,
    formatData.documentType,
    formatData.documentSubtype,
    `${formatData.documentType}/${formatData.documentSubtype || 'GENERAL'}`,
    JSON.stringify(formatData.formatFeatures || {}),
    now
  ]);

  console.log(`  ✨ Created new DocumentFormat: ${formatData.documentType}/${formatData.documentSubtype || 'N/A'}`);
  return result.rows[0].id;
}

async function backfillDocumentFormatId(batchId) {
  const client = await pool.connect();

  try {
    console.log(`\n🔧 FIX-006 Backfill Script`);
    console.log(`📦 Batch ID: ${batchId}`);
    console.log('='.repeat(60));

    // 1. 查找需要回填的文件
    // historical_files.document_issuer_id -> companies.id
    const filesResult = await client.query(`
      SELECT
        hf.id,
        hf.file_name,
        hf.extraction_result,
        hf.document_issuer_id,
        hf.document_issuer_id as company_id
      FROM historical_files hf
      WHERE hf.batch_id = $1
        AND hf.document_format_id IS NULL
        AND hf.extraction_result IS NOT NULL
    `, [batchId]);

    const totalFiles = filesResult.rows.length;
    console.log(`\n📊 Found ${totalFiles} files needing backfill`);

    if (totalFiles === 0) {
      console.log('✅ No files need backfill - all files already have documentFormatId');
      return;
    }

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 2. 處理每個文件
    for (let i = 0; i < filesResult.rows.length; i++) {
      const file = filesResult.rows[i];
      const progress = `[${i + 1}/${totalFiles}]`;

      try {
        // 提取 documentFormat 資訊
        const formatData = extractDocumentFormat(file.extraction_result);

        if (!formatData || !formatData.documentType) {
          console.log(`${progress} ⏭️ ${file.file_name} - No documentFormat data in extraction_result`);
          skippedCount++;
          continue;
        }

        // 檢查是否有關聯的公司 (document_issuer_id 直接指向 companies 表)
        if (!file.document_issuer_id) {
          console.log(`${progress} ⏭️ ${file.file_name} - No documentIssuerId (company) association`);
          skippedCount++;
          continue;
        }

        // 查找或創建 DocumentFormat
        const formatId = await findOrCreateFormat(client, file.document_issuer_id, formatData);

        if (!formatId) {
          console.log(`${progress} ⏭️ ${file.file_name} - Could not find/create DocumentFormat`);
          skippedCount++;
          continue;
        }

        // 更新文件的 documentFormatId 和 formatConfidence
        await client.query(`
          UPDATE historical_files
          SET
            document_format_id = $1,
            format_confidence = $2,
            updated_at = NOW()
          WHERE id = $3
        `, [formatId, formatData.formatConfidence, file.id]);

        console.log(`${progress} ✅ ${file.file_name} -> ${formatData.documentType}/${formatData.documentSubtype || 'N/A'} (${formatData.formatConfidence}%)`);
        successCount++;

      } catch (error) {
        console.error(`${progress} ❌ ${file.file_name} - Error: ${error.message}`);
        errorCount++;
      }
    }

    // 3. 輸出統計
    console.log('\n' + '='.repeat(60));
    console.log('📈 Backfill Results:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ⏭️ Skipped: ${skippedCount}`);
    console.log(`   ❌ Errors:  ${errorCount}`);
    console.log(`   📊 Total:   ${totalFiles}`);

    // 4. 驗證結果
    const verifyResult = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE document_format_id IS NOT NULL) as with_format,
        COUNT(*) FILTER (WHERE document_format_id IS NULL) as without_format,
        COUNT(*) as total
      FROM historical_files
      WHERE batch_id = $1
    `, [batchId]);

    console.log('\n📊 Post-backfill Statistics:');
    console.log(`   With documentFormatId:    ${verifyResult.rows[0].with_format}`);
    console.log(`   Without documentFormatId: ${verifyResult.rows[0].without_format}`);
    console.log(`   Total files:              ${verifyResult.rows[0].total}`);

    // 5. 檢查是否可以匯出
    const exportReadyResult = await client.query(`
      SELECT COUNT(*) as ready
      FROM historical_files
      WHERE batch_id = $1
        AND document_issuer_id IS NOT NULL
        AND document_format_id IS NOT NULL
    `, [batchId]);

    console.log(`\n🎯 Export-ready files (has BOTH issuerId AND formatId): ${exportReadyResult.rows[0].ready}`);

    if (parseInt(exportReadyResult.rows[0].ready) > 0) {
      console.log('\n✅ You can now export the hierarchical terms report!');
    } else {
      console.log('\n⚠️ Still no files ready for export. Check if files have documentIssuerId.');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

// Main execution
const batchId = process.argv[2] || 'd8beb4ba-3501-45f0-9a92-3cfdf2e9f1a5';
backfillDocumentFormatId(batchId).catch(console.error);
