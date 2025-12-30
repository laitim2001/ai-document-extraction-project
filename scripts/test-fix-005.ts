/**
 * FIX-005 地址過濾驗證腳本
 */
import { isAddressLikeTerm } from '../src/services/term-aggregation.service';

// 測試案例
const testCases = [
  // 應該被過濾的地址類術語 (true = 是地址)
  { term: 'BO STREET WARD 13 DISTRICT 4', expected: true },
  { term: 'HO CHI MINH CITY VIETNAM', expected: true },
  { term: '123 NGUYEN HUE STREET', expected: true },
  { term: 'BANGKOK THAILAND', expected: true },
  { term: 'TOKYO JAPAN', expected: true },
  { term: 'SHANGHAI CHINA', expected: true },
  { term: 'SINGAPORE 049483', expected: true },
  { term: 'CENTRAL DISTRICT HONG KONG', expected: true },
  { term: 'UNIT 301 BUILDING A', expected: true },
  { term: 'P O BOX 12345', expected: true },
  
  // 有效的運費術語 (false = 不是地址)
  { term: 'EXPRESS WORLDWIDE NONDOC', expected: false },
  { term: 'FUEL SURCHARGE', expected: false },
  { term: 'DUTIES & TAXES', expected: false },
  { term: 'HANDLING FEE', expected: false },
  { term: 'FREIGHT CHARGE', expected: false },
  { term: 'IMPORT DUTY', expected: false },
  { term: 'CUSTOMS CLEARANCE', expected: false },
  { term: 'AIR FREIGHT', expected: false },
  { term: 'OCEAN FREIGHT', expected: false },
  { term: 'DOCUMENTATION FEE', expected: false },
];

console.log('=== FIX-005 isAddressLikeTerm 函數驗證 ===\n');
let passed = 0;
let failed = 0;

testCases.forEach(({ term, expected }) => {
  const result = isAddressLikeTerm(term);
  const status = result === expected ? '✅' : '❌';
  if (result === expected) passed++;
  else failed++;
  console.log(`${status} "${term}" → ${result} (expected: ${expected})`);
});

console.log('\n=== 測試結果 ===');
console.log(`通過: ${passed}/${testCases.length}`);
console.log(`失敗: ${failed}/${testCases.length}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ FIX-005 地址過濾邏輯運作正常！');
}
