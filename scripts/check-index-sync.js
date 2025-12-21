#!/usr/bin/env node

/**
 * @fileoverview PROJECT-INDEX.md 同步檢查腳本
 * @description 檢查 PROJECT-INDEX.md 中的文件連結是否有效，
 *              並發現可能需要加入索引的新文件。
 *
 * @module scripts/check-index-sync
 * @author AI Assistant
 * @since 2025-12-21
 *
 * @usage
 *   npm run index:check
 *   node scripts/check-index-sync.js
 */

const fs = require('fs');
const path = require('path');

// 配置
const config = {
  indexFile: 'PROJECT-INDEX.md',
  importantPaths: [
    'src/services/*.ts',
    'docs/04-implementation/stories/*.md',
    'docs/04-implementation/tech-specs/**/*.md',
    'src/app/api/**/*.ts',
  ],
  ignorePaths: [
    'node_modules',
    '.next',
    '.git',
    'dist',
    'coverage',
    '*.d.ts',
  ],
};

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(type, message) {
  const icons = {
    success: `${colors.green}✅`,
    error: `${colors.red}❌`,
    warning: `${colors.yellow}⚠️`,
    info: `${colors.blue}ℹ️`,
    header: `${colors.cyan}📋`,
  };
  console.log(`${icons[type]} ${message}${colors.reset}`);
}

/**
 * 從 PROJECT-INDEX.md 提取所有 Markdown 連結
 * @returns {string[]} 連結路徑陣列
 */
function extractLinksFromIndex() {
  const indexPath = path.join(process.cwd(), config.indexFile);

  if (!fs.existsSync(indexPath)) {
    log('error', `找不到 ${config.indexFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(indexPath, 'utf8');

  // 匹配 Markdown 連結格式: [text](path)
  const linkRegex = /\[([^\]]+)\]\((\.[^\)]+)\)/g;
  const links = [];
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const linkPath = match[2];
    // 過濾掉外部連結和錨點
    if (linkPath.startsWith('./') || linkPath.startsWith('../')) {
      links.push(linkPath);
    }
  }

  return [...new Set(links)]; // 去重
}

/**
 * 檢查文件是否存在
 * @param {string} relativePath - 相對路徑
 * @returns {boolean}
 */
function fileExists(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);
  return fs.existsSync(absolutePath);
}

/**
 * 遞歸獲取目錄下的所有文件
 * @param {string} dir - 目錄路徑
 * @param {string[]} extensions - 要包含的副檔名
 * @returns {string[]}
 */
function getFilesRecursively(dir, extensions = ['.ts', '.md']) {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relativePath = './' + path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

    // 跳過忽略的路徑
    if (config.ignorePaths.some(ignore =>
      fullPath.includes(ignore) || item.name.match(new RegExp(ignore.replace('*', '.*')))
    )) {
      continue;
    }

    if (item.isDirectory()) {
      files.push(...getFilesRecursively(fullPath, extensions));
    } else if (extensions.some(ext => item.name.endsWith(ext))) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * 檢查可能缺失的重要文件
 * @param {string[]} indexedLinks - 已索引的連結
 * @returns {string[]} 可能缺失的文件
 */
function findMissingImportantFiles(indexedLinks) {
  const missingFiles = [];

  // 檢查 services 目錄
  const services = getFilesRecursively('./src/services', ['.ts']);
  const indexedServices = indexedLinks.filter(l => l.includes('/services/'));

  for (const service of services) {
    if (!service.includes('index.ts') && !indexedServices.some(l => service.includes(l) || l.includes(service))) {
      missingFiles.push(service);
    }
  }

  // 檢查 stories 目錄
  const stories = getFilesRecursively('./docs/04-implementation/stories', ['.md']);
  const indexedStories = indexedLinks.filter(l => l.includes('/stories/'));

  for (const story of stories) {
    const storyName = path.basename(story);
    if (!indexedStories.some(l => l.includes(storyName))) {
      missingFiles.push(story);
    }
  }

  return missingFiles;
}

/**
 * 主函數
 */
async function main() {
  console.log('\n');
  log('header', `PROJECT-INDEX.md 同步檢查`);
  console.log('─'.repeat(50));

  // 步驟 1: 提取索引中的連結
  log('info', '正在解析 PROJECT-INDEX.md...');
  const links = extractLinksFromIndex();
  console.log(`   找到 ${links.length} 個連結\n`);

  // 步驟 2: 驗證連結有效性
  log('header', '驗證連結有效性');
  console.log('─'.repeat(50));

  let validCount = 0;
  let invalidCount = 0;
  const invalidLinks = [];

  for (const link of links) {
    if (fileExists(link)) {
      validCount++;
      // 僅顯示前 5 個有效連結作為示例
      if (validCount <= 5) {
        log('success', `找到文件: ${link}`);
      }
    } else {
      invalidCount++;
      invalidLinks.push(link);
      log('error', `缺失文件: ${link}`);
    }
  }

  if (validCount > 5) {
    console.log(`   ... 還有 ${validCount - 5} 個有效文件\n`);
  }

  // 步驟 3: 檢查可能缺失的重要文件
  console.log('');
  log('header', '檢查可能缺失的文件');
  console.log('─'.repeat(50));

  const missingFiles = findMissingImportantFiles(links);

  if (missingFiles.length === 0) {
    log('success', '沒有發現可能缺失的重要文件');
  } else {
    for (const file of missingFiles.slice(0, 10)) {
      log('warning', `可能需要索引: ${file}`);
    }
    if (missingFiles.length > 10) {
      console.log(`   ... 還有 ${missingFiles.length - 10} 個可能缺失的文件\n`);
    }
  }

  // 步驟 4: 總結
  console.log('\n');
  log('header', '檢查摘要');
  console.log('─'.repeat(50));
  console.log(`   總連結數: ${links.length}`);
  console.log(`   ${colors.green}有效連結: ${validCount}${colors.reset}`);
  console.log(`   ${colors.red}無效連結: ${invalidCount}${colors.reset}`);
  console.log(`   ${colors.yellow}可能缺失: ${missingFiles.length}${colors.reset}`);
  console.log('');

  // 設定退出碼
  if (invalidCount > 0) {
    log('error', '索引存在無效連結，請修復後重試');
    process.exit(1);
  } else if (missingFiles.length > 0) {
    log('warning', '索引可能不完整，建議檢查並更新');
    process.exit(0);
  } else {
    log('success', '索引同步狀態良好！');
    process.exit(0);
  }
}

// 執行
main().catch(err => {
  log('error', `執行失敗: ${err.message}`);
  process.exit(1);
});
