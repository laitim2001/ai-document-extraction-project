/**
 * Runtime DB schema bootstrap (CHANGE-055 — Azure DEV container startup).
 *
 * 在容器啟動時執行：偵測 public schema 是否已有資料表，
 * 若沒有（全新空庫）才套用 prisma/init.sql（涵蓋全部 122 models / 113 enums 的 DDL）。
 * 已有 schema 則跳過 —— 因此重啟 / scale 不會重建表。
 *
 * 設計重點：
 * - 只依賴 `pg`（已包含在 Next.js standalone runtime，因 app 本身用 pg adapter）
 * - 不需要 Prisma CLI / schema engine（init.sql 在 docker build 階段已產生）
 * - Azure PostgreSQL 需 TLS：偵測 sslmode=require 或 azure host 時啟用
 *
 * 用法：node prisma/bootstrap-db.js
 */
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

function resolveSsl() {
  const url = process.env.DATABASE_URL || ''
  if (/sslmode=require/i.test(url) || /\.postgres\.database\.azure\.com/i.test(url)) {
    return { rejectUnauthorized: false }
  }
  return false
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[bootstrap] DATABASE_URL not set — cannot continue')
    process.exit(1)
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolveSsl(),
    connectionTimeoutMillis: 30000,
  })

  await client.connect()
  try {
    // FORCE_SCHEMA_RESET:DEV 專用一次性重設。當 DB schema 落後於映像的 Prisma schema
    // 時(bootstrap 只「空庫才建表」、不會遷移既有 schema),設此旗標清空 public schema,
    // 讓下方邏輯重套當前映像的 init.sql(完整最新 schema)。
    // ⚠️ 破壞性:會 DROP 所有資料表。預設關閉;成功後務必把旗標設回 false 避免下次重啟再清。
    if (process.env.FORCE_SCHEMA_RESET === 'true') {
      console.log('[bootstrap] FORCE_SCHEMA_RESET=true -> dropping & recreating public schema (DESTRUCTIVE)')
      await client.query('drop schema if exists public cascade')
      await client.query('create schema public')
      console.log('[bootstrap] public schema reset done')
    }

    const { rows } = await client.query(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"
    )
    const tableCount = rows[0].n

    if (tableCount > 0) {
      console.log(`[bootstrap] public schema already has ${tableCount} tables -> skip init.sql`)
      return
    }

    console.log('[bootstrap] public schema is empty -> applying init.sql ...')
    const sqlPath = path.join(__dirname, 'init.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    await client.query(sql)

    const after = await client.query(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"
    )
    console.log(`[bootstrap] init.sql applied -> ${after.rows[0].n} tables created`)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('[bootstrap] FAILED:', e.message)
  process.exit(1)
})
