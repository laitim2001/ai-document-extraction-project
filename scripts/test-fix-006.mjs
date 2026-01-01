/**
 * @fileoverview Test script for FIX-006 - Enhanced address term filtering
 * Tests the isAddressLikeTerm function with problematic terms from DHL extraction
 */

// Test cases from user-reported issues
const testCases = [
  // Should be filtered (address-like terms) - expected: true
  { term: 'HKG, HONG KONG\nRICOH ASIA PACIFIC OPERATIONS LIMITED', expected: true, reason: 'airport code + company name' },
  { term: 'KATHY LAM', expected: true, reason: 'person name' },
  { term: 'Quach Thi Thien Nhi', expected: true, reason: 'person name (Vietnamese)' },
  { term: 'BLR, BANGALORE', expected: true, reason: 'airport code + city' },
  { term: 'E.Town Central, 11 Doan Van', expected: true, reason: 'building name + street' },
  { term: 'SGN, HO CHI MINH CITY', expected: true, reason: 'airport code + city' },
  { term: 'SIN, SINGAPORE', expected: true, reason: 'airport code + country' },
  { term: 'RICOH ASIA PACIFIC OPERATIONS LIMITED', expected: true, reason: 'company name with LIMITED' },
  { term: 'DHL EXPRESS PTE LTD', expected: true, reason: 'company name with PTE LTD' },
  { term: 'CENTRAL PLAZA TOWER', expected: true, reason: 'building name with CENTRAL' },
  { term: 'John Smith', expected: true, reason: 'person name (English)' },
  { term: 'NGUYEN VAN ANH', expected: true, reason: 'person name (Vietnamese uppercase)' },

  // Should NOT be filtered (valid freight terms) - expected: false
  { term: 'EXPRESS WORLDWIDE NONDOC', expected: false, reason: 'valid freight service' },
  { term: 'FREIGHT CHARGES', expected: false, reason: 'valid freight charge' },
  { term: 'FUEL SURCHARGE', expected: false, reason: 'valid surcharge' },
  { term: 'CUSTOMS CLEARANCE FEE', expected: false, reason: 'valid customs charge' },
  { term: 'AIR FREIGHT HANDLING', expected: false, reason: 'valid air freight' },
  { term: 'DOCUMENT FEE', expected: false, reason: 'valid document fee' },
  { term: 'SECURITY SURCHARGE', expected: false, reason: 'valid security fee' },
  { term: 'PICKUP CHARGE', expected: false, reason: 'valid pickup charge' },
  { term: 'DELIVERY FEE', expected: false, reason: 'valid delivery fee' },
  { term: 'INSURANCE PREMIUM', expected: false, reason: 'valid insurance' },
  { term: 'FREIGHT CHARGES USD 65.00', expected: false, reason: 'price line with currency' },
];

// Simulate the isAddressLikeTerm function logic
function isAddressLikeTerm(term) {
  if (!term) return false;

  const upperTerm = term.toUpperCase();

  // Currency codes
  const CURRENCY_CODES = [
    'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'SGD', 'THB',
    'MYR', 'IDR', 'PHP', 'VND', 'TWD', 'KRW', 'INR', 'AUD',
  ];

  // Check for currency code
  const hasCurrency = CURRENCY_CODES.some(code =>
    new RegExp(`\\b${code}\\b`, 'i').test(upperTerm)
  );

  // Address keywords
  const ADDRESS_KEYWORDS = [
    'STREET', 'ROAD', 'AVENUE', 'BOULEVARD', 'LANE', 'DRIVE', 'COURT',
    'PLACE', 'SQUARE', 'WARD', 'DISTRICT', 'PROVINCE', 'CITY', 'COUNTY',
    'STATE', 'COUNTRY', 'FLOOR', 'BUILDING', 'TOWER', 'BLOCK', 'UNIT',
    'SUITE', 'APARTMENT', 'ROOM', 'HIGHWAY', 'EXPRESSWAY',
    'DUONG', 'PHO', 'QUAN', 'PHUONG', 'TINH', 'THANH PHO', 'HUYEN', 'XA',
    'TANG', 'TOA NHA', 'CAN HO', 'PHONG', 'KHU', 'KHU PHO', 'AP',
    'ST', 'RD', 'AVE', 'BLVD', 'FLR', 'BLDG', 'BLK', 'APT',
  ];

  // Check address keywords
  for (const keyword of ADDRESS_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(upperTerm)) {
      return true;
    }
  }

  // Location names
  const LOCATION_NAMES = [
    'VIETNAM', 'VIET NAM', 'CHINA', 'HONG KONG', 'SINGAPORE', 'THAILAND',
    'MALAYSIA', 'INDONESIA', 'PHILIPPINES', 'TAIWAN', 'JAPAN', 'KOREA',
    'INDIA', 'AUSTRALIA', 'UNITED STATES', 'UNITED KINGDOM', 'GERMANY', 'FRANCE',
    'HO CHI MINH', 'HOCHIMINH', 'SAIGON', 'HANOI', 'HA NOI', 'DA NANG',
    'BANGKOK', 'KUALA LUMPUR', 'JAKARTA', 'MANILA', 'TAIPEI',
    'SHANGHAI', 'BEIJING', 'SHENZHEN', 'GUANGZHOU', 'KOWLOON',
    'BANGALORE', 'BENGALURU', 'CHENNAI', 'HYDERABAD', 'KOLKATA', 'PUNE',
    'TOKYO', 'OSAKA', 'SEOUL', 'BUSAN', 'MUMBAI', 'NEW DELHI', 'DELHI',
    'SYDNEY', 'MELBOURNE', 'BRISBANE', 'PERTH', 'AUCKLAND',
  ];

  // Check location names
  for (const location of LOCATION_NAMES) {
    if (upperTerm.includes(location)) {
      return true;
    }
  }

  // FIX-006: Airport codes
  const AIRPORT_CODES = [
    'HKG', 'PEK', 'PVG', 'SHA', 'CAN', 'SZX', 'CTU', 'KMG', 'XIY', 'HGH',
    'SIN', 'BKK', 'KUL', 'CGK', 'MNL', 'SGN', 'HAN', 'DAD', 'CXR', 'PQC',
    'BLR', 'DEL', 'BOM', 'MAA', 'CCU', 'HYD', 'COK', 'AMD', 'GOI', 'PNQ',
    'NRT', 'HND', 'KIX', 'ICN', 'GMP', 'PUS', 'CJU',
    'SYD', 'MEL', 'BNE', 'PER', 'ADL', 'CBR',
    'TPE', 'KHH', 'RMQ',
    'DXB', 'DOH', 'AUH', 'SVO', 'CDG', 'LHR', 'FRA', 'AMS', 'JFK', 'LAX',
  ];

  // Check airport codes at start
  for (const code of AIRPORT_CODES) {
    const startsWithCode = new RegExp(`^${code}(?:[,\\s\\n]|$)`, 'i');
    if (startsWithCode.test(upperTerm)) {
      return true;
    }
  }

  // FIX-006: Person name patterns
  const words = upperTerm.split(/\s+/).filter(w => w.length > 1);
  if (words.length >= 2 && words.length <= 4) {
    const allWordsAreNames = words.every(word => /^[A-Z]+(?:-[A-Z]+)?$/i.test(word));
    const freightKeywords = [
      'FREIGHT', 'CHARGE', 'FEE', 'SURCHARGE', 'HANDLING', 'CUSTOMS',
      'DUTY', 'TAX', 'IMPORT', 'EXPORT', 'CLEARANCE', 'DOCUMENT', 'EXPRESS',
      'DELIVERY', 'SHIPPING', 'TRANSPORT', 'CARGO', 'AIR', 'SEA', 'OCEAN',
      'FUEL', 'SECURITY', 'INSURANCE', 'PICKUP', 'COLLECT', 'PREPAID',
    ];
    const hasFreightKeyword = words.some(w => freightKeywords.includes(w));
    if (allWordsAreNames && !hasFreightKeyword && upperTerm.length < 30) {
      return true;
    }
  }

  // FIX-006: Company name patterns
  const companyPatterns = [
    /\bLIMITED\b/i,
    /\bLTD\b/i,
    /\bCO\.\s*LTD\b/i,
    /\bCORP(?:ORATION)?\b/i,
    /\bINC(?:ORPORATED)?\b/i,
    /\bPTE\b/i,
    /\bPVT\b/i,
    /\bGMBH\b/i,
    /\bSDN\s*BHD\b/i,
    /\bS\.?A\.?\b/,
    /\bOPERATIONS\b/i,
    /\bCENTRAL\b/i,
    /\bPLAZA\b/i,
    /\bCENTRE\b/i,
    /\bCENTER\b/i,
  ];
  for (const pattern of companyPatterns) {
    if (pattern.test(upperTerm)) {
      return true;
    }
  }

  // Address patterns (skip if has currency)
  if (!hasCurrency) {
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
    for (const pattern of ADDRESS_PATTERNS) {
      if (pattern.test(upperTerm)) {
        return true;
      }
    }
  }

  // Length check (skip if has currency)
  if (!hasCurrency && upperTerm.length > 80) {
    return true;
  }

  return false;
}

// Run tests
console.log('=' .repeat(70));
console.log('FIX-006 - Enhanced Address Term Filtering Test');
console.log('=' .repeat(70));
console.log('');

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = isAddressLikeTerm(test.term);
  const success = result === test.expected;

  if (success) {
    passed++;
    console.log(`✅ PASS: "${test.term.substring(0, 40)}${test.term.length > 40 ? '...' : ''}"`);
    console.log(`   Expected: ${test.expected}, Got: ${result} (${test.reason})`);
  } else {
    failed++;
    console.log(`❌ FAIL: "${test.term.substring(0, 40)}${test.term.length > 40 ? '...' : ''}"`);
    console.log(`   Expected: ${test.expected}, Got: ${result} (${test.reason})`);
  }
  console.log('');
}

console.log('=' .repeat(70));
console.log(`Results: ${passed} passed, ${failed} failed (${Math.round(passed / testCases.length * 100)}% success rate)`);
console.log('=' .repeat(70));

if (failed > 0) {
  process.exit(1);
}
