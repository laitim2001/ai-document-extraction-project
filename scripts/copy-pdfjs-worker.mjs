/**
 * @fileoverview 將 pdfjs-dist 的 PDF worker 複製到 public/pdfjs/（FIX-082）
 * @description
 *   兩個 PDF viewer（document-preview/PDFViewer、review/PdfViewer）原本從
 *   unpkg.com CDN 載入 pdf.worker。封閉網路 / proxy 擋 unpkg 時，PDF 預覽會失敗。
 *   本腳本在 build / dev 前把 worker 從 node_modules 複製到 public/，改由本站自身
 *   提供，徹底移除對外部 CDN 的依賴。
 *
 *   版本安全：直接從 react-pdf 解析到的 pdfjs-dist 取檔，確保 worker 版本 == react-pdf
 *   實際使用的 pdfjs API 版本（react-pdf 會比對兩者，不一致即報錯）。
 *
 * @usage  node scripts/copy-pdfjs-worker.mjs（由 package.json 的 prebuild / predev 觸發）
 * @since  FIX-082
 */

import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 以 react-pdf 為基準解析 pdfjs-dist，保證取到 react-pdf 實際使用的那一份（含巢狀情形）
let pdfjsPkgPath;
try {
  const reactPdfEntry = require.resolve('react-pdf');
  pdfjsPkgPath = require.resolve('pdfjs-dist/package.json', { paths: [dirname(reactPdfEntry)] });
} catch {
  pdfjsPkgPath = require.resolve('pdfjs-dist/package.json');
}

const pdfjsDir = dirname(pdfjsPkgPath);
const { version } = require(pdfjsPkgPath);

// 兩個 viewer 各自使用「一般版」與「legacy 版」worker，兩者都複製以保留現有行為
const targets = [
  {
    src: join(pdfjsDir, 'build', 'pdf.worker.min.mjs'),
    dest: join(projectRoot, 'public', 'pdfjs', 'pdf.worker.min.mjs'),
  },
  {
    src: join(pdfjsDir, 'legacy', 'build', 'pdf.worker.min.mjs'),
    dest: join(projectRoot, 'public', 'pdfjs', 'legacy', 'pdf.worker.min.mjs'),
  },
];

for (const { src, dest } of targets) {
  if (!existsSync(src)) {
    console.error(`[copy-pdfjs-worker] 找不到來源檔: ${src}`);
    process.exit(1); // 故意讓 build 失敗，避免靜默 ship 出壞掉的 worker
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`[copy-pdfjs-worker] ${src} -> ${dest}`);
}

console.log(`[copy-pdfjs-worker] pdfjs-dist@${version} worker 已複製到 public/pdfjs/`);
