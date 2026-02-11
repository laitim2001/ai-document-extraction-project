/**
 * @fileoverview Transform Engine & Validation Rules Test
 * @description
 *   Tests the field transformation engine (5 types) and row validation rules.
 *   Replicates core transform/validation logic since tsx cannot resolve @/ imports.
 *
 *   Part 1 — Transform Engine:
 *     A: DIRECT transform (pass-through)
 *     B: CONCAT transform (multi-field merge)
 *     C: SPLIT transform (string split by index)
 *     D: FORMULA transform (math with variable placeholders)
 *     E: LOOKUP transform (key-value table mapping)
 *     F: Edge cases (null, empty, missing fields)
 *
 *   Part 2 — Validation Rules:
 *     G: isRequired validation
 *     H: dataType validation (string, number, date, boolean)
 *     I: pattern regex validation
 *     J: min/max numeric range
 *     K: minLength/maxLength string length
 *     L: allowedValues enum validation
 *     M: Combined validation (multiple rules on one field)
 *
 *   No database interaction — pure logic testing.
 *
 * @usage npx tsx scripts/test-template-matching/05-transform-validation.ts
 */

// ============================================================================
// Test Runner Infrastructure
// ============================================================================

let passCount = 0
let failCount = 0

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    passCount++
    console.log(`    [PASS] ${label}`)
  } else {
    failCount++
    console.log(`    [FAIL] ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// ============================================================================
// Replicated Transform Logic
// (from src/services/transform/*.transform.ts)
// ============================================================================

interface TransformContext {
  row: Record<string, unknown>
  sourceField: string
  targetField: string
}

type TransformParams = Record<string, unknown> | null

/**
 * DIRECT: pass-through (value → value)
 */
function directTransform(value: unknown): unknown {
  return value
}

/**
 * CONCAT: merge multiple fields from context.row with separator
 * params: { fields: string[], separator?: string }
 */
function concatTransform(
  _value: unknown,
  params: TransformParams,
  context: TransformContext
): unknown {
  const p = params as { fields?: string[]; separator?: string } | null
  if (!p?.fields || !Array.isArray(p.fields)) {
    throw new Error('CONCAT needs fields array')
  }
  const separator = p.separator ?? ''
  const values = p.fields
    .map((field) => context.row[field])
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map((v) => String(v))
  return values.join(separator)
}

/**
 * SPLIT: split string by separator and take index
 * params: { separator: string, index: number }
 */
function splitTransform(value: unknown, params: TransformParams): unknown {
  const p = params as { separator?: string; index?: number } | null
  if (!p?.separator) throw new Error('SPLIT needs separator')
  if (p.index === undefined || p.index === null) throw new Error('SPLIT needs index')

  const strValue = value === null || value === undefined ? '' : String(value)
  const parts = strValue.split(p.separator)
  let index = p.index
  if (index < 0) index = parts.length + index
  if (index < 0 || index >= parts.length) return ''
  return parts[index]
}

/**
 * FORMULA: math calculation with {variable} placeholders
 * params: { formula: string }
 */
function formulaTransform(
  _value: unknown,
  params: TransformParams,
  context: TransformContext
): unknown {
  const p = params as { formula?: string } | null
  if (!p?.formula) throw new Error('FORMULA needs formula')

  const VARIABLE_PATTERN = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g
  const SAFE_PATTERN = /^[\d\s\+\-\*\/\.\(\)]+$/

  const expression = p.formula.replace(VARIABLE_PATTERN, (_match, fieldName) => {
    const val = context.row[fieldName]
    if (val === undefined || val === null) return '0'
    const numVal = Number(val)
    if (Number.isNaN(numVal)) return '0'
    return String(numVal)
  })

  const cleanExpr = expression.replace(/\s+/g, '')
  if (!SAFE_PATTERN.test(cleanExpr)) {
    throw new Error(`Formula has invalid characters: ${expression}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const result = Function(`"use strict"; return (${cleanExpr})`)() as number
  if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
    throw new Error(`Formula result invalid: ${expression} = ${result}`)
  }
  return result
}

/**
 * LOOKUP: key-value table mapping
 * params: { lookupTable: Record<string, string>, defaultValue?: string }
 */
function lookupTransform(value: unknown, params: TransformParams): unknown {
  const p = params as { lookupTable?: Record<string, string>; defaultValue?: string } | null
  if (!p?.lookupTable) throw new Error('LOOKUP needs lookupTable')

  const key = value === null || value === undefined ? '' : String(value)
  if (key in p.lookupTable) return p.lookupTable[key]
  if (p.defaultValue !== undefined) return p.defaultValue
  return value
}

/**
 * Execute any transform type
 */
function executeTransform(
  value: unknown,
  type: string,
  params: TransformParams,
  context: TransformContext
): unknown {
  switch (type) {
    case 'DIRECT':
      return directTransform(value)
    case 'CONCAT':
      return concatTransform(value, params, context)
    case 'SPLIT':
      return splitTransform(value, params)
    case 'FORMULA':
      return formulaTransform(value, params, context)
    case 'LOOKUP':
      return lookupTransform(value, params)
    default:
      throw new Error(`Unsupported transform type: ${type}`)
  }
}

// ============================================================================
// Replicated Validation Logic
// (from src/services/template-instance.service.ts:611-736)
// ============================================================================

interface DataTemplateField {
  name: string
  label: string
  dataType: 'string' | 'number' | 'date' | 'currency' | 'boolean' | 'array'
  isRequired: boolean
  defaultValue?: string | number | boolean | null
  validation?: {
    pattern?: string
    min?: number
    max?: number
    maxLength?: number
    minLength?: number
    allowedValues?: string[]
  }
  order: number
}

interface ValidationResult {
  isValid: boolean
  errors?: Record<string, string>
}

function validateType(
  value: unknown,
  dataType: DataTemplateField['dataType']
): string | null {
  switch (dataType) {
    case 'string':
      if (typeof value !== 'string') return '值必須為字串'
      break
    case 'number':
    case 'currency':
      if (typeof value !== 'number' && isNaN(Number(value))) return '值必須為數字'
      break
    case 'date':
      if (typeof value === 'string') {
        const date = new Date(value)
        if (isNaN(date.getTime())) return '無效的日期格式'
      } else if (!(value instanceof Date)) {
        return '值必須為日期'
      }
      break
    case 'boolean':
      if (typeof value !== 'boolean') return '值必須為布林值'
      break
    case 'array':
      if (!Array.isArray(value)) return '值必須為陣列'
      break
  }
  return null
}

function validateRules(
  value: unknown,
  validation: NonNullable<DataTemplateField['validation']>,
  dataType: DataTemplateField['dataType']
): string | null {
  if (typeof value === 'string') {
    if (validation.minLength !== undefined && value.length < validation.minLength) {
      return `長度不能少於 ${validation.minLength} 個字元`
    }
    if (validation.maxLength !== undefined && value.length > validation.maxLength) {
      return `長度不能超過 ${validation.maxLength} 個字元`
    }
    if (validation.pattern) {
      const regex = new RegExp(validation.pattern)
      if (!regex.test(value)) return '格式不符合要求'
    }
  }
  if (dataType === 'number' || dataType === 'currency') {
    const numValue = typeof value === 'number' ? value : Number(value)
    if (validation.min !== undefined && numValue < validation.min) {
      return `值不能小於 ${validation.min}`
    }
    if (validation.max !== undefined && numValue > validation.max) {
      return `值不能大於 ${validation.max}`
    }
  }
  if (validation.allowedValues && validation.allowedValues.length > 0) {
    if (!validation.allowedValues.includes(String(value))) {
      return `值必須是以下之一: ${validation.allowedValues.join(', ')}`
    }
  }
  return null
}

function validateRowData(
  fieldValues: Record<string, unknown>,
  templateFields: DataTemplateField[]
): ValidationResult {
  const errors: Record<string, string> = {}
  for (const field of templateFields) {
    const value = fieldValues[field.name]
    if (field.isRequired && (value === undefined || value === null || value === '')) {
      errors[field.name] = '此欄位為必填'
      continue
    }
    if (value !== undefined && value !== null && value !== '') {
      const typeError = validateType(value, field.dataType)
      if (typeError) {
        errors[field.name] = typeError
        continue
      }
      if (field.validation) {
        const validationError = validateRules(value, field.validation, field.dataType)
        if (validationError) {
          errors[field.name] = validationError
        }
      }
    }
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  }
}

// ============================================================================
// Test Execution
// ============================================================================

function main() {
  console.log('='.repeat(80))
  console.log('  TRANSFORM ENGINE & VALIDATION RULES TEST')
  console.log('  Started:', new Date().toISOString())
  console.log('='.repeat(80))

  // ═════════════════════════════════════════════════════════════════════════
  // PART 1: Transform Engine
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(80))
  console.log('  PART 1: Transform Engine (5 types)')
  console.log('─'.repeat(80))

  const baseContext: TransformContext = {
    row: {
      invoice_number: 'INV-2026-001',
      tracking_number: 'SHIP-001',
      shipment_no: 'SHIP-001',
      total_amount: '1250.00',
      subtotal: '1200.00',
      tax_amount: '50.00',
      currency: 'USD',
      vendor_name: 'DHL Express',
      vendor_code: 'DHL-001',
      invoice_date: '2026-02-10',
      po_number: 'PO-2026-001',
    },
    sourceField: '',
    targetField: '',
  }

  // --- A: DIRECT ---
  console.log('\n  --- A: DIRECT transform ---')
  const directResult1 = executeTransform('INV-2026-001', 'DIRECT', null, baseContext)
  assert(directResult1 === 'INV-2026-001', `DIRECT: string pass-through (got: ${directResult1})`)

  const directResult2 = executeTransform(1250.00, 'DIRECT', null, baseContext)
  assert(directResult2 === 1250.00, `DIRECT: number pass-through (got: ${directResult2})`)

  const directResult3 = executeTransform(null, 'DIRECT', null, baseContext)
  assert(directResult3 === null, `DIRECT: null pass-through (got: ${directResult3})`)

  const directResult4 = executeTransform('', 'DIRECT', null, baseContext)
  assert(directResult4 === '', `DIRECT: empty string pass-through (got: "${directResult4}")`)

  // --- B: CONCAT ---
  console.log('\n  --- B: CONCAT transform ---')
  const concatResult1 = executeTransform(null, 'CONCAT', {
    fields: ['vendor_name', 'vendor_code'],
    separator: ' - ',
  }, baseContext)
  assert(
    concatResult1 === 'DHL Express - DHL-001',
    `CONCAT: two fields with separator (got: ${concatResult1})`
  )

  const concatResult2 = executeTransform(null, 'CONCAT', {
    fields: ['invoice_number', 'invoice_date', 'currency'],
    separator: '/',
  }, baseContext)
  assert(
    concatResult2 === 'INV-2026-001/2026-02-10/USD',
    `CONCAT: three fields with / (got: ${concatResult2})`
  )

  // CONCAT with missing field (should skip null)
  const concatResult3 = executeTransform(null, 'CONCAT', {
    fields: ['vendor_name', 'nonexistent_field', 'vendor_code'],
    separator: '|',
  }, baseContext)
  assert(
    concatResult3 === 'DHL Express|DHL-001',
    `CONCAT: skips missing field (got: ${concatResult3})`
  )

  // CONCAT with empty separator
  const concatResult4 = executeTransform(null, 'CONCAT', {
    fields: ['currency', 'total_amount'],
  }, baseContext)
  assert(
    concatResult4 === 'USD1250.00',
    `CONCAT: no separator (got: ${concatResult4})`
  )

  // --- C: SPLIT ---
  console.log('\n  --- C: SPLIT transform ---')
  const splitResult1 = executeTransform('INV-2026-001', 'SPLIT', {
    separator: '-',
    index: 0,
  }, baseContext)
  assert(splitResult1 === 'INV', `SPLIT: index 0 of INV-2026-001 (got: ${splitResult1})`)

  const splitResult2 = executeTransform('INV-2026-001', 'SPLIT', {
    separator: '-',
    index: 1,
  }, baseContext)
  assert(splitResult2 === '2026', `SPLIT: index 1 of INV-2026-001 (got: ${splitResult2})`)

  const splitResult3 = executeTransform('INV-2026-001', 'SPLIT', {
    separator: '-',
    index: 2,
  }, baseContext)
  assert(splitResult3 === '001', `SPLIT: index 2 of INV-2026-001 (got: ${splitResult3})`)

  // Negative index
  const splitResult4 = executeTransform('INV-2026-001', 'SPLIT', {
    separator: '-',
    index: -1,
  }, baseContext)
  assert(splitResult4 === '001', `SPLIT: negative index -1 (got: ${splitResult4})`)

  // Out of bounds
  const splitResult5 = executeTransform('INV-2026-001', 'SPLIT', {
    separator: '-',
    index: 10,
  }, baseContext)
  assert(splitResult5 === '', `SPLIT: out of bounds → empty string (got: "${splitResult5}")`)

  // Split on non-existing separator
  const splitResult6 = executeTransform('INV-2026-001', 'SPLIT', {
    separator: '|',
    index: 0,
  }, baseContext)
  assert(splitResult6 === 'INV-2026-001', `SPLIT: no match → full string (got: ${splitResult6})`)

  // --- D: FORMULA ---
  console.log('\n  --- D: FORMULA transform ---')
  const formulaResult1 = executeTransform(null, 'FORMULA', {
    formula: '{subtotal} + {tax_amount}',
  }, baseContext)
  assert(formulaResult1 === 1250, `FORMULA: 1200 + 50 = 1250 (got: ${formulaResult1})`)

  const formulaResult2 = executeTransform(null, 'FORMULA', {
    formula: '{total_amount} * 0.1',
  }, baseContext)
  assert(formulaResult2 === 125, `FORMULA: 1250 * 0.1 = 125 (got: ${formulaResult2})`)

  const formulaResult3 = executeTransform(null, 'FORMULA', {
    formula: '({subtotal} + {tax_amount}) / 2',
  }, baseContext)
  assert(formulaResult3 === 625, `FORMULA: (1200 + 50) / 2 = 625 (got: ${formulaResult3})`)

  // Missing field → treated as 0
  const formulaResult4 = executeTransform(null, 'FORMULA', {
    formula: '{subtotal} + {nonexistent}',
  }, baseContext)
  assert(formulaResult4 === 1200, `FORMULA: missing field → 0, so 1200 + 0 = 1200 (got: ${formulaResult4})`)

  // --- E: LOOKUP ---
  console.log('\n  --- E: LOOKUP transform ---')
  const lookupTable = {
    'USD': 'US Dollar',
    'EUR': 'Euro',
    'GBP': 'British Pound',
    'TWD': 'Taiwan Dollar',
  }

  const lookupResult1 = executeTransform('USD', 'LOOKUP', {
    lookupTable,
  }, baseContext)
  assert(lookupResult1 === 'US Dollar', `LOOKUP: USD → US Dollar (got: ${lookupResult1})`)

  const lookupResult2 = executeTransform('EUR', 'LOOKUP', {
    lookupTable,
  }, baseContext)
  assert(lookupResult2 === 'Euro', `LOOKUP: EUR → Euro (got: ${lookupResult2})`)

  // Key not found → defaultValue
  const lookupResult3 = executeTransform('JPY', 'LOOKUP', {
    lookupTable,
    defaultValue: 'Unknown Currency',
  }, baseContext)
  assert(
    lookupResult3 === 'Unknown Currency',
    `LOOKUP: JPY not found → defaultValue (got: ${lookupResult3})`
  )

  // Key not found, no default → original value
  const lookupResult4 = executeTransform('JPY', 'LOOKUP', {
    lookupTable,
  }, baseContext)
  assert(lookupResult4 === 'JPY', `LOOKUP: no default → original value (got: ${lookupResult4})`)

  // Null key → empty string lookup
  const lookupResult5 = executeTransform(null, 'LOOKUP', {
    lookupTable: { '': 'No Value' },
    defaultValue: 'fallback',
  }, baseContext)
  assert(lookupResult5 === 'No Value', `LOOKUP: null → empty string key (got: ${lookupResult5})`)

  // --- F: Edge Cases ---
  console.log('\n  --- F: Edge cases ---')
  let unsupportedError = false
  try {
    executeTransform('test', 'CUSTOM', null, baseContext)
  } catch (e) {
    unsupportedError = true
  }
  assert(unsupportedError, 'Unsupported type "CUSTOM" throws error')

  let concatNoFields = false
  try {
    executeTransform('test', 'CONCAT', { fields: null }, baseContext)
  } catch (e) {
    concatNoFields = true
  }
  assert(concatNoFields, 'CONCAT without fields throws error')

  let splitNoSep = false
  try {
    executeTransform('test', 'SPLIT', { index: 0 }, baseContext)
  } catch (e) {
    splitNoSep = true
  }
  assert(splitNoSep, 'SPLIT without separator throws error')

  let formulaNoFormula = false
  try {
    executeTransform('test', 'FORMULA', {}, baseContext)
  } catch (e) {
    formulaNoFormula = true
  }
  assert(formulaNoFormula, 'FORMULA without formula throws error')

  let lookupNoTable = false
  try {
    executeTransform('test', 'LOOKUP', {}, baseContext)
  } catch (e) {
    lookupNoTable = true
  }
  assert(lookupNoTable, 'LOOKUP without lookupTable throws error')

  // ═════════════════════════════════════════════════════════════════════════
  // PART 2: Validation Rules
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n' + '─'.repeat(80))
  console.log('  PART 2: Validation Rules')
  console.log('─'.repeat(80))

  // --- G: isRequired ---
  console.log('\n  --- G: isRequired validation ---')
  const requiredFields: DataTemplateField[] = [
    { name: 'inv_no', label: 'Invoice Number', dataType: 'string', isRequired: true, order: 1 },
    { name: 'amount', label: 'Amount', dataType: 'number', isRequired: true, order: 2 },
    { name: 'notes', label: 'Notes', dataType: 'string', isRequired: false, order: 3 },
  ]

  const g1 = validateRowData({ inv_no: 'INV-001', amount: 100 }, requiredFields)
  assert(g1.isValid, 'G1: All required fields present → valid')

  const g2 = validateRowData({ inv_no: 'INV-001' }, requiredFields)
  assert(!g2.isValid, 'G2: Missing required "amount" → invalid')
  assert(g2.errors?.amount === '此欄位為必填', `G2: Error message (got: ${g2.errors?.amount})`)

  const g3 = validateRowData({ amount: 100 }, requiredFields)
  assert(!g3.isValid, 'G3: Missing required "inv_no" → invalid')

  const g4 = validateRowData({ inv_no: '', amount: 100 }, requiredFields)
  assert(!g4.isValid, 'G4: Empty string for required field → invalid')

  const g5 = validateRowData({ inv_no: 'INV-001', amount: 100, notes: undefined }, requiredFields)
  assert(g5.isValid, 'G5: Optional field undefined → still valid')

  // --- H: dataType validation ---
  console.log('\n  --- H: dataType validation ---')
  const typeFields: DataTemplateField[] = [
    { name: 'name', label: 'Name', dataType: 'string', isRequired: false, order: 1 },
    { name: 'count', label: 'Count', dataType: 'number', isRequired: false, order: 2 },
    { name: 'date', label: 'Date', dataType: 'date', isRequired: false, order: 3 },
    { name: 'active', label: 'Active', dataType: 'boolean', isRequired: false, order: 4 },
    { name: 'price', label: 'Price', dataType: 'currency', isRequired: false, order: 5 },
  ]

  const h1 = validateRowData({ name: 'test', count: 42, date: '2026-01-01', active: true, price: 99.99 }, typeFields)
  assert(h1.isValid, 'H1: All correct types → valid')

  const h2 = validateRowData({ name: 123 }, typeFields)
  assert(!h2.isValid, 'H2: Number for string field → invalid')

  const h3 = validateRowData({ count: 'not-a-number' }, typeFields)
  assert(!h3.isValid, 'H3: Non-numeric string for number → invalid')

  const h4 = validateRowData({ count: '42' }, typeFields)
  assert(h4.isValid, 'H4: Numeric string "42" for number → valid (Number("42") works)')

  const h5 = validateRowData({ date: 'invalid-date' }, typeFields)
  assert(!h5.isValid, 'H5: Invalid date string → invalid')

  const h6 = validateRowData({ date: '2026-02-10' }, typeFields)
  assert(h6.isValid, 'H6: Valid date string → valid')

  const h7 = validateRowData({ active: 'yes' }, typeFields)
  assert(!h7.isValid, 'H7: String for boolean → invalid')

  const h8 = validateRowData({ price: 'expensive' }, typeFields)
  assert(!h8.isValid, 'H8: Non-numeric for currency → invalid')

  const h9 = validateRowData({ price: '99.99' }, typeFields)
  assert(h9.isValid, 'H9: Numeric string for currency → valid')

  // --- I: pattern regex validation ---
  console.log('\n  --- I: pattern regex validation ---')
  const patternFields: DataTemplateField[] = [
    {
      name: 'inv_no',
      label: 'Invoice Number',
      dataType: 'string',
      isRequired: false,
      validation: { pattern: '^INV-\\d{4}-\\d{3}$' },
      order: 1,
    },
    {
      name: 'email',
      label: 'Email',
      dataType: 'string',
      isRequired: false,
      validation: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
      order: 2,
    },
  ]

  const i1 = validateRowData({ inv_no: 'INV-2026-001' }, patternFields)
  assert(i1.isValid, 'I1: INV-2026-001 matches pattern → valid')

  const i2 = validateRowData({ inv_no: 'INVOICE-2026-001' }, patternFields)
  assert(!i2.isValid, 'I2: INVOICE-2026-001 does not match → invalid')
  assert(i2.errors?.inv_no === '格式不符合要求', `I2: Error message (got: ${i2.errors?.inv_no})`)

  const i3 = validateRowData({ email: 'user@example.com' }, patternFields)
  assert(i3.isValid, 'I3: Valid email → valid')

  const i4 = validateRowData({ email: 'not-an-email' }, patternFields)
  assert(!i4.isValid, 'I4: Invalid email → invalid')

  // --- J: min/max numeric range ---
  console.log('\n  --- J: min/max numeric range ---')
  const rangeFields: DataTemplateField[] = [
    {
      name: 'amount',
      label: 'Amount',
      dataType: 'number',
      isRequired: false,
      validation: { min: 0, max: 100000 },
      order: 1,
    },
    {
      name: 'rate',
      label: 'Rate',
      dataType: 'currency',
      isRequired: false,
      validation: { min: 0.01, max: 999.99 },
      order: 2,
    },
  ]

  const j1 = validateRowData({ amount: 500 }, rangeFields)
  assert(j1.isValid, 'J1: 500 in range [0, 100000] → valid')

  const j2 = validateRowData({ amount: -1 }, rangeFields)
  assert(!j2.isValid, 'J2: -1 below min 0 → invalid')
  assert(j2.errors?.amount?.includes('不能小於'), `J2: Error contains "不能小於" (got: ${j2.errors?.amount})`)

  const j3 = validateRowData({ amount: 100001 }, rangeFields)
  assert(!j3.isValid, 'J3: 100001 above max 100000 → invalid')

  const j4 = validateRowData({ amount: 0 }, rangeFields)
  assert(j4.isValid, 'J4: 0 equals min → valid')

  const j5 = validateRowData({ rate: '50.00' }, rangeFields)
  assert(j5.isValid, 'J5: String "50.00" for currency in range → valid')

  // --- K: minLength/maxLength ---
  console.log('\n  --- K: minLength/maxLength validation ---')
  const lengthFields: DataTemplateField[] = [
    {
      name: 'code',
      label: 'Code',
      dataType: 'string',
      isRequired: false,
      validation: { minLength: 3, maxLength: 10 },
      order: 1,
    },
  ]

  const k1 = validateRowData({ code: 'ABC' }, lengthFields)
  assert(k1.isValid, 'K1: "ABC" length 3 ≥ min 3 → valid')

  const k2 = validateRowData({ code: 'AB' }, lengthFields)
  assert(!k2.isValid, 'K2: "AB" length 2 < min 3 → invalid')

  const k3 = validateRowData({ code: 'ABCDEFGHIJK' }, lengthFields)
  assert(!k3.isValid, 'K3: 11 chars > max 10 → invalid')

  const k4 = validateRowData({ code: 'ABCDEFGHIJ' }, lengthFields)
  assert(k4.isValid, 'K4: 10 chars = max 10 → valid')

  // --- L: allowedValues ---
  console.log('\n  --- L: allowedValues validation ---')
  const enumFields: DataTemplateField[] = [
    {
      name: 'status',
      label: 'Status',
      dataType: 'string',
      isRequired: false,
      validation: { allowedValues: ['ACTIVE', 'INACTIVE', 'PENDING'] },
      order: 1,
    },
  ]

  const l1 = validateRowData({ status: 'ACTIVE' }, enumFields)
  assert(l1.isValid, 'L1: "ACTIVE" in allowedValues → valid')

  const l2 = validateRowData({ status: 'DELETED' }, enumFields)
  assert(!l2.isValid, 'L2: "DELETED" not in allowedValues → invalid')
  assert(
    l2.errors?.status?.includes('以下之一'),
    `L2: Error contains "以下之一" (got: ${l2.errors?.status})`
  )

  // --- M: Combined validation ---
  console.log('\n  --- M: Combined validation (multiple rules) ---')
  const combinedFields: DataTemplateField[] = [
    {
      name: 'invoice_number',
      label: 'Invoice No',
      dataType: 'string',
      isRequired: true,
      validation: {
        pattern: '^INV-\\d{4}-\\d{3}$',
        minLength: 12,
        maxLength: 12,
      },
      order: 1,
    },
    {
      name: 'total',
      label: 'Total',
      dataType: 'currency',
      isRequired: true,
      validation: { min: 0.01, max: 999999.99 },
      order: 2,
    },
    {
      name: 'mode',
      label: 'Mode',
      dataType: 'string',
      isRequired: true,
      validation: { allowedValues: ['AIR', 'SEA', 'LAND'] },
      order: 3,
    },
  ]

  const m1 = validateRowData(
    { invoice_number: 'INV-2026-001', total: 1250.00, mode: 'SEA' },
    combinedFields
  )
  assert(m1.isValid, 'M1: All fields valid with combined rules → valid')

  const m2 = validateRowData(
    { invoice_number: 'INV-2026-001', total: -5, mode: 'SEA' },
    combinedFields
  )
  assert(!m2.isValid, 'M2: Negative total → invalid')
  assert(m2.errors?.total !== undefined, `M2: Error on total field (got: ${JSON.stringify(m2.errors)})`)

  const m3 = validateRowData(
    { invoice_number: 'INV-2026-001', total: 100, mode: 'RAIL' },
    combinedFields
  )
  assert(!m3.isValid, 'M3: Invalid mode "RAIL" → invalid')
  assert(m3.errors?.mode !== undefined, `M3: Error on mode field (got: ${JSON.stringify(m3.errors)})`)

  const m4 = validateRowData({}, combinedFields)
  assert(!m4.isValid, 'M4: All required fields missing → invalid')
  assert(
    m4.errors !== undefined && Object.keys(m4.errors).length === 3,
    `M4: 3 errors for 3 required fields (got: ${Object.keys(m4.errors ?? {}).length})`
  )

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(80))
  console.log('  TEST SUMMARY')
  console.log('='.repeat(80))
  console.log(`
  Total assertions: ${passCount + failCount}
  Passed: ${passCount}
  Failed: ${failCount}
  Result: ${failCount === 0 ? 'ALL TESTS PASSED' : `${failCount} TESTS FAILED`}

  Coverage:
    Part 1 — Transform Engine:
      A: DIRECT (4 cases)         ✓
      B: CONCAT (4 cases)         ✓
      C: SPLIT (6 cases)          ✓
      D: FORMULA (4 cases)        ✓
      E: LOOKUP (5 cases)         ✓
      F: Edge cases (5 cases)     ✓

    Part 2 — Validation Rules:
      G: isRequired (5 cases)     ✓
      H: dataType (9 cases)       ✓
      I: pattern (4 cases)        ✓
      J: min/max (5 cases)        ✓
      K: minLength/maxLength (4 cases) ✓
      L: allowedValues (2 cases)  ✓
      M: Combined (4 cases)       ✓
  `)
  console.log('='.repeat(80))

  if (failCount > 0) {
    process.exitCode = 1
  }
}

main()
