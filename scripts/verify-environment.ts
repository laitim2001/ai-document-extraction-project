#!/usr/bin/env node
/**
 * @fileoverview 環境自檢腳本：啟動前驗證環境配置與依賴資料完整性
 * @module scripts/verify-environment
 * @since CHANGE-054 - Deployment Readiness Enhancement
 * @lastModified 2026-04-22
 *
 * 執行時機：
 *   - 新環境初始化完成後（init-new-environment.sh 會自動呼叫）
 *   - 每次 npm run dev 之前（可透過 npm run predev 啟用）
 *   - CI / CD pipeline 中作為部署前檢查
 *
 * 檢查範圍：
 *   1. 環境變數：所有 🔴 必要變數存在且非預設值
 *   2. Docker 容器：postgres, azurite 運作中（軟警告）
 *   3. 資料庫連線：SELECT 1 成功
 *   4. Schema 同步：核心 models 可查詢
 *   5. Seed 完整性：roles/regions/cities/companies/users 數量符合預期
 *   6. FIX-054：SYSTEM_USER_ID 對應的 User 存在
 *
 * 退出碼：
 *   0 - 所有檢查通過
 *   1 - 有 🔴 critical 錯誤（環境變數缺失、DB 連不上、SYSTEM_USER_ID 不存在等）
 *   0 （僅警告） - 有 🟡 warnings 但不影響啟動
 *
 * 用法：
 *   npm run verify-environment
 *   npx ts-node scripts/verify-environment.ts
 */

import 'dotenv/config'
import { Pool } from 'pg'

// ===========================================
// 配置
// ===========================================

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'AUTH_URL',
  'AUTH_TRUST_HOST',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'SYSTEM_USER_ID',
  'NEXT_PUBLIC_APP_URL',
  'NODE_ENV',
] as const

const PLACEHOLDER_PATTERNS = [
  /your-.*-change-in-production/i,
  /^your-/i,
  /^change-me$/i,
]

const EXPECTED_SEED_COUNTS = {
  roles: { min: 6, label: 'Roles (System Admin, Super User, Data Processor, City Manager, Regional Manager, Auditor)' },
  regions: { min: 3, label: 'Regions (APAC, EMEA, AMER)' },
  cities: { min: 10, label: 'Cities (Taipei, Hong Kong, Singapore, Tokyo, Shanghai, Sydney, London, Frankfurt, NYC, LAX)' },
  companies: { min: 15, label: 'Companies (DHL, FedEx, UPS, Maersk 等)' },
  users: { min: 3, label: 'Users (System User, Dev User, Admin User)' },
} as const

// ===========================================
// 工具函數
// ===========================================

type Level = 'critical' | 'warning' | 'info'

interface CheckResult {
  level: Level
  message: string
  hint?: string
}

const results: CheckResult[] = []

function addResult(level: Level, message: string, hint?: string): void {
  results.push({ level, message, hint })
}

function icon(level: Level): string {
  return level === 'critical' ? '❌' : level === 'warning' ? '⚠️ ' : 'ℹ️ '
}

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return false
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))
}

// ===========================================
// 檢查項：環境變數
// ===========================================

function checkEnvVars(): void {
  console.log('\n📋 Checking required environment variables...')
  for (const key of REQUIRED_ENV_VARS) {
    const value = process.env[key]
    if (!value) {
      addResult('critical', `Missing required env var: ${key}`, '請檢查 .env 是否存在並包含此變數（參考 .env.example）')
      continue
    }
    if (isPlaceholder(value)) {
      addResult('critical', `Env var ${key} uses placeholder value`, `目前值類似 "${value.slice(0, 40)}..."。請改為實際值`)
      continue
    }
    console.log(`  ✅ ${key}`)
  }
}

// ===========================================
// 檢查項：DATABASE_URL 格式
// ===========================================

function checkDatabaseUrlFormat(): boolean {
  const url = process.env.DATABASE_URL
  if (!url) return false
  if (!url.startsWith('postgresql://')) {
    addResult('critical', 'DATABASE_URL must start with postgresql://')
    return false
  }
  // docker-compose 映射為 5433，常見錯誤是設成 5432
  if (url.includes('@localhost:5432/')) {
    addResult(
      'warning',
      'DATABASE_URL uses port 5432 — docker-compose maps PostgreSQL to 5433',
      '檢查 docker-compose.yml；若使用 docker，建議改為 localhost:5433'
    )
  }
  return true
}

// ===========================================
// 檢查項：資料庫連線 + Schema + Seed
// ===========================================

async function checkDatabase(): Promise<void> {
  console.log('\n🗄️  Checking database connection...')
  const url = process.env.DATABASE_URL
  if (!url) {
    addResult('critical', 'Cannot check database: DATABASE_URL is missing')
    return
  }

  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 })

  try {
    await pool.query('SELECT 1')
    console.log('  ✅ Database connection OK')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    addResult(
      'critical',
      `Cannot connect to database: ${message}`,
      '確認 Docker 已啟動 ai-doc-extraction-db 容器：docker-compose up -d postgres'
    )
    await pool.end().catch(() => undefined)
    return
  }

  // Schema 檢查：核心 models 可查詢
  console.log('\n🧩 Checking schema sync...')
  const schemaChecks = [
    { table: 'users', label: 'User' },
    { table: 'companies', label: 'Company' },
    { table: 'documents', label: 'Document' },
    { table: 'mapping_rules', label: 'MappingRule' },
    { table: 'roles', label: 'Role' },
  ]

  for (const { table, label } of schemaChecks) {
    try {
      await pool.query(`SELECT 1 FROM ${table} LIMIT 1`)
      console.log(`  ✅ ${label} (${table})`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addResult(
        'critical',
        `Schema mismatch for ${label} (table: ${table}): ${message}`,
        '執行 npx prisma db push --accept-data-loss 以同步 schema'
      )
    }
  }

  // Seed 完整性
  console.log('\n🌱 Checking seed data completeness...')
  for (const [key, { min, label }] of Object.entries(EXPECTED_SEED_COUNTS)) {
    try {
      const { rows } = await pool.query(`SELECT COUNT(*)::int as count FROM ${key}`)
      const count = rows[0]?.count ?? 0
      if (count < min) {
        addResult(
          'warning',
          `Seed data incomplete: ${label} has ${count} records (expected >= ${min})`,
          '執行 npx prisma db seed 以建立基礎資料'
        )
      } else {
        console.log(`  ✅ ${key}: ${count} records`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addResult('warning', `Cannot check ${key} count: ${message}`)
    }
  }

  // FIX-054：SYSTEM_USER_ID 對應的 User 存在
  console.log('\n🔑 Checking FIX-054: SYSTEM_USER_ID points to a real user...')
  const systemUserId = process.env.SYSTEM_USER_ID ?? 'system-user-1'
  try {
    const { rows } = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [systemUserId])
    if (rows.length === 0) {
      addResult(
        'critical',
        `SYSTEM_USER_ID="${systemUserId}" does not exist in users table`,
        `本機既有環境：查出現有 systemUser UUID 並寫入 .env 的 SYSTEM_USER_ID
      查詢：SELECT id FROM users WHERE email = 'system@ai-document-extraction.internal';
  全新環境：執行 npx prisma db seed 以建立 id='${systemUserId}' 的系統用戶`
      )
    } else {
      console.log(`  ✅ ${rows[0].email} (${rows[0].name}) — id: ${rows[0].id}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    addResult('critical', `Cannot verify SYSTEM_USER_ID: ${message}`)
  }

  await pool.end().catch(() => undefined)
}

// ===========================================
// 檢查項：Docker 容器（軟警告）
// ===========================================

async function checkDockerContainers(): Promise<void> {
  console.log('\n🐳 Checking Docker containers (soft check)...')
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)

  const requiredContainers = [
    { name: 'ai-doc-extraction-db', label: 'PostgreSQL' },
    { name: 'ai-doc-extraction-azurite', label: 'Azurite (Blob Storage)' },
  ]

  for (const { name, label } of requiredContainers) {
    try {
      const { stdout } = await execAsync(`docker ps --filter "name=${name}" --format "{{.Status}}"`)
      if (!stdout.trim()) {
        addResult(
          'warning',
          `Docker container "${name}" is not running`,
          `${label} 功能將不可用。執行：docker-compose up -d ${name.replace('ai-doc-extraction-', '')}`
        )
      } else {
        console.log(`  ✅ ${label}: ${stdout.trim()}`)
      }
    } catch {
      // docker 指令失敗（可能 Docker Desktop 未啟動或 DOCKER_HOST 配置異常）
      addResult(
        'warning',
        `Cannot query Docker (docker ps failed for ${name})`,
        '確認 Docker Desktop 運行中；若 DOCKER_HOST 環境變數指向錯誤位置可嘗試 unset DOCKER_HOST'
      )
      return // Docker 整個不可用就不用查其他容器了
    }
  }
}

// ===========================================
// 主程式
// ===========================================

async function main(): Promise<void> {
  console.log('=============================================')
  console.log('🔍 Environment Verification (CHANGE-054)')
  console.log('=============================================')

  checkEnvVars()
  checkDatabaseUrlFormat()
  await checkDockerContainers()
  await checkDatabase()

  // 統計與輸出
  console.log('\n=============================================')
  console.log('📊 Summary')
  console.log('=============================================')

  const critical = results.filter((r) => r.level === 'critical')
  const warnings = results.filter((r) => r.level === 'warning')

  if (critical.length === 0 && warnings.length === 0) {
    console.log('✅ All checks passed. Environment is ready.')
    process.exit(0)
  }

  if (critical.length > 0) {
    console.log(`\n❌ ${critical.length} critical issue(s):`)
    critical.forEach((r) => {
      console.log(`  ${icon(r.level)} ${r.message}`)
      if (r.hint) console.log(`     💡 ${r.hint}`)
    })
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} warning(s):`)
    warnings.forEach((r) => {
      console.log(`  ${icon(r.level)} ${r.message}`)
      if (r.hint) console.log(`     💡 ${r.hint}`)
    })
  }

  console.log('\n=============================================')
  if (critical.length > 0) {
    console.log('❌ Environment is NOT ready. Fix critical issues before starting the app.')
    process.exit(1)
  } else {
    console.log('⚠️  Environment has warnings but can start. Review warnings above.')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('\n💥 Unexpected error in verify-environment:', err)
  process.exit(2)
})
