/**
 * @fileoverview 階層式術語報告匯出腳本
 * @description 直接調用服務層生成 Excel 報告，繞過 API 認證
 * @since Epic 0 - TEST-PLAN-002
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Create Prisma client with Prisma 7.x driver adapter
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

// Excel.js for creating Excel files
import ExcelJS from 'exceljs';

interface TermData {
  term: string;
  frequency: number;
  companyName: string;
  formatName: string;
}

interface CompanyData {
  id: string;
  name: string;
  displayName: string | null;
  termsCount: number;
}

interface FormatData {
  id: string;
  name: string;
  companyName: string;
  termsCount: number;
}

async function main() {
  console.log('=== 階層式術語報告匯出 ===\n');

  // Use command line argument or default batch
  const batchId = process.argv[2] || 'fec633d9-1e14-45fd-b215-d85527750c62';

  // 1. 獲取批次資訊
  const batch = await prisma.historicalBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      name: true,
      status: true,
      totalFiles: true,
      processedFiles: true,
      startedAt: true,
      completedAt: true,
    },
  });

  if (!batch) {
    console.error('批次不存在:', batchId);
    process.exit(1);
  }

  console.log('批次:', batch.name);
  console.log('狀態:', batch.status);

  // 2. 獲取所有文件的術語數據
  const files = await prisma.historicalFile.findMany({
    where: { batchId },
    select: {
      id: true,
      fileName: true,
      documentIssuerId: true,
      documentIssuer: {
        select: {
          id: true,
          name: true,
          displayName: true,
        },
      },
      extractionResult: true,
    },
  });

  console.log('文件數:', files.length);

  // 3. 聚合術語數據
  const companyTerms = new Map<string, Map<string, Map<string, number>>>();
  const companies = new Map<string, CompanyData>();

  for (const file of files) {
    if (!file.documentIssuer) continue;

    const companyId = file.documentIssuer.id;
    const companyName = file.documentIssuer.displayName || file.documentIssuer.name;

    if (!companies.has(companyId)) {
      companies.set(companyId, {
        id: companyId,
        name: file.documentIssuer.name,
        displayName: file.documentIssuer.displayName,
        termsCount: 0,
      });
    }

    if (!companyTerms.has(companyId)) {
      companyTerms.set(companyId, new Map());
    }

    // 從 extractionResult 提取術語
    const extractionResult = file.extractionResult as any;
    if (extractionResult?.invoiceData?.lineItems) {
      const formatName = 'Invoice'; // 暫時使用固定格式名稱

      if (!companyTerms.get(companyId)!.has(formatName)) {
        companyTerms.get(companyId)!.set(formatName, new Map());
      }

      for (const item of extractionResult.invoiceData.lineItems) {
        const term = item.description || item.productCode || 'Unknown';
        if (term && term !== 'Unknown') {
          const formatTerms = companyTerms.get(companyId)!.get(formatName)!;
          formatTerms.set(term, (formatTerms.get(term) || 0) + 1);
        }
      }
    }
  }

  // 4. 創建 Excel 工作簿
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI Document Extraction System';
  workbook.created = new Date();

  // --- 摘要工作表 ---
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: '項目', key: 'item', width: 30 },
    { header: '值', key: 'value', width: 50 },
  ];

  // 計算統計
  let totalTerms = 0;
  let totalOccurrences = 0;
  let totalFormats = 0;

  companyTerms.forEach((formats) => {
    totalFormats += formats.size;
    formats.forEach((terms) => {
      totalTerms += terms.size;
      terms.forEach((count) => {
        totalOccurrences += count;
      });
    });
  });

  summarySheet.addRows([
    { item: '批次 ID', value: batch.id },
    { item: '批次名稱', value: batch.name },
    { item: '開始時間', value: batch.startedAt?.toISOString() || '-' },
    { item: '完成時間', value: batch.completedAt?.toISOString() || '-' },
    { item: '總文件數', value: batch.totalFiles },
    { item: '已處理文件', value: batch.processedFiles },
    { item: '', value: '' },
    { item: '公司數量', value: companies.size },
    { item: '格式數量', value: totalFormats },
    { item: '唯一術語數', value: totalTerms },
    { item: '術語總出現次數', value: totalOccurrences },
    { item: '', value: '' },
    { item: '報告生成時間', value: new Date().toISOString() },
  ]);

  // 設置標題樣式
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // --- 公司工作表 ---
  const companiesSheet = workbook.addWorksheet('Companies');
  companiesSheet.columns = [
    { header: '公司 ID', key: 'id', width: 30 },
    { header: '公司名稱', key: 'name', width: 40 },
    { header: '顯示名稱', key: 'displayName', width: 40 },
    { header: '格式數量', key: 'formatsCount', width: 15 },
    { header: '術語數量', key: 'termsCount', width: 15 },
  ];

  companies.forEach((company, companyId) => {
    const formats = companyTerms.get(companyId);
    let termsCount = 0;
    if (formats) {
      formats.forEach((terms) => {
        termsCount += terms.size;
      });
    }
    companiesSheet.addRow({
      id: company.id,
      name: company.name,
      displayName: company.displayName || '-',
      formatsCount: formats?.size || 0,
      termsCount,
    });
  });

  companiesSheet.getRow(1).font = { bold: true };
  companiesSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  companiesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // --- 術語工作表 ---
  const termsSheet = workbook.addWorksheet('Terms');
  termsSheet.columns = [
    { header: '公司名稱', key: 'company', width: 30 },
    { header: '格式', key: 'format', width: 20 },
    { header: '術語', key: 'term', width: 50 },
    { header: '頻率', key: 'frequency', width: 10 },
  ];

  const allTerms: TermData[] = [];
  companyTerms.forEach((formats, companyId) => {
    const company = companies.get(companyId);
    formats.forEach((terms, formatName) => {
      terms.forEach((frequency, term) => {
        allTerms.push({
          term,
          frequency,
          companyName: company?.displayName || company?.name || 'Unknown',
          formatName,
        });
      });
    });
  });

  // 按頻率排序
  allTerms.sort((a, b) => b.frequency - a.frequency);

  allTerms.forEach((item) => {
    termsSheet.addRow({
      company: item.companyName,
      format: item.formatName,
      term: item.term,
      frequency: item.frequency,
    });
  });

  termsSheet.getRow(1).font = { bold: true };
  termsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  termsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // 高頻術語標記（頻率 > 3）
  for (let i = 2; i <= allTerms.length + 1; i++) {
    const row = termsSheet.getRow(i);
    const freq = row.getCell('frequency').value as number;
    if (freq > 3) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF2CC' },
      };
    }
  }

  // 5. 儲存 Excel 文件
  const outputDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `hierarchical-terms-${batch.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const outputPath = path.join(outputDir, fileName);

  await workbook.xlsx.writeFile(outputPath);

  console.log('\n✅ Excel 報告已生成:', outputPath);
  console.log('\n統計摘要:');
  console.log('  - 公司數:', companies.size);
  console.log('  - 格式數:', totalFormats);
  console.log('  - 唯一術語:', totalTerms);
  console.log('  - 總出現次數:', totalOccurrences);

  await prisma.$disconnect();
}

main().catch(console.error);
