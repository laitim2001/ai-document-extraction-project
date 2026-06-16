/**
 * Dev business data import — one-off, idempotent (DEV data sync).
 *
 * 把 `prisma/dev-snapshot.json`(由本地 DB 匯出的 14 張業務/設定表)匯入目標 DB。
 * 設計與 bootstrap-db.js 一致:只依賴 `pg`(已在 standalone runtime),不需 Prisma CLI。
 *
 * 觸發:由 docker-entrypoint.sh 在 `RUN_DEV_DATA_IMPORT=true` 時呼叫(非致命:失敗不擋啟動)。
 * 冪等:若 field_definition_sets 已有資料則整個略過;INSERT 一律 ON CONFLICT DO NOTHING。
 *
 * FK 處理(跨環境):
 * - owner 使用者欄位(created_by / created_by_id / updated_by)→ 改指目標 DB 的 admin
 * - 指向「未匯入的表」之 FK(default_template_id / first_seen_document_id / merged_into_id /
 *   forwarder_id / suggestion_id / inverse_of_id)→ 設 null
 * - 指向 essential seed 表的 FK(region_id)→ 以 code 重映射(snapshot._refs.regions 提供本地 id→code)
 * - 同批匯入的 FK(company_id / document_format_id / data_template_id / ...)→ 保留(父表先匯,id 保留)
 *
 * 型別安全:以 information_schema 取得各欄位型別,jsonb 欄位 JSON.stringify、ARRAY 欄位傳 JS 陣列。
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

// 匯入順序(父表先)+ 每表 FK 覆寫規則
const PLAN = [
  { table: 'companies',        setAdmin: ['created_by_id'],            setNull: ['default_template_id', 'first_seen_document_id', 'merged_into_id'] },
  { table: 'document_formats', setAdmin: [],                           setNull: ['default_template_id'] },
  { table: 'mapping_rules',    setAdmin: ['created_by'],               setNull: ['forwarder_id', 'suggestion_id'] },
  { table: 'prompt_configs',   setAdmin: ['created_by', 'updated_by'], setNull: [] },
  { table: 'exchange_rates',   setAdmin: ['created_by_id'],            setNull: ['inverse_of_id'] },
  // --- 設定子系統補件(模板 / 欄位定義 / 欄位映射 / 管線 / 參考編號)---
  // FK 全指向上方已匯入的表(companies / document_formats / data_templates / field_mapping_configs /
  // template_instances)或 essential seed 已建的表(regions),故 setNull 皆為空。
  { table: 'field_definition_sets',   setAdmin: ['created_by'],               setNull: [] },
  { table: 'data_templates',          setAdmin: ['created_by'],               setNull: [] },
  { table: 'field_mapping_configs',   setAdmin: ['created_by'],               setNull: [] },
  { table: 'field_mapping_rules',     setAdmin: [],                           setNull: [] },
  { table: 'template_field_mappings', setAdmin: ['created_by'],               setNull: [] },
  { table: 'template_instances',      setAdmin: ['created_by', 'exported_by'], setNull: [] },
  { table: 'template_instance_rows',  setAdmin: [],                           setNull: [] },
  // region_id 指向 essential seed 建立的 regions(跨環境 UUID 不同)→ 以 code 重映射
  { table: 'pipeline_configs',        setAdmin: [],                           setNull: [], remapRegion: ['region_id'] },
  { table: 'reference_numbers',       setAdmin: ['created_by_id'],            setNull: [], remapRegion: ['region_id'] },
]

async function getColumnTypes(client, table) {
  const { rows } = await client.query(
    `select column_name, data_type from information_schema.columns
     where table_schema = 'public' and table_name = $1`,
    [table]
  )
  const map = {}
  for (const r of rows) map[r.column_name] = r.data_type
  return map
}

async function resolveOwnerId(client) {
  const email = process.env.SEED_ADMIN_EMAIL
  if (email) {
    const r = await client.query('select id from users where lower(email) = lower($1) limit 1', [email])
    if (r.rows[0]) return r.rows[0].id
  }
  const r2 = await client.query('select id from users where is_global_admin = true order by created_at asc limit 1')
  if (r2.rows[0]) return r2.rows[0].id
  const r3 = await client.query('select id from users order by created_at asc limit 1')
  if (r3.rows[0]) return r3.rows[0].id
  throw new Error('no user found in target DB to use as owner (run essential seed first)')
}

async function importTable(client, spec, rows, ownerId, regionRemap) {
  if (!rows || rows.length === 0) {
    console.log(`  - ${spec.table}: snapshot empty, skip`)
    return
  }
  const colTypes = await getColumnTypes(client, spec.table)
  let inserted = 0

  for (const row of rows) {
    for (const c of spec.setAdmin) if (c in row) row[c] = ownerId
    for (const c of spec.setNull) if (c in row) row[c] = null
    for (const c of spec.remapRegion || []) {
      if (c in row && row[c] != null) {
        const mapped = regionRemap.get(row[c])
        if (!mapped) {
          throw new Error(
            `${spec.table}.${c}: 無法重映射 region id ${row[c]}(目標 DB regions 找不到對應 code)`
          )
        }
        row[c] = mapped
      }
    }

    const cols = Object.keys(row).filter((k) => k in colTypes)
    const values = cols.map((c) => {
      const v = row[c]
      if (v === null || v === undefined) return null
      const t = colTypes[c]
      if (t === 'jsonb' || t === 'json') return JSON.stringify(v) // jsonb 需字串化
      return v // ARRAY → node-pg 會把 JS 陣列轉成 pg array;scalar 直接傳
    })
    const placeholders = cols.map((_, i) => `$${i + 1}`)
    const sql =
      `insert into "${spec.table}" (${cols.map((c) => `"${c}"`).join(', ')}) ` +
      `values (${placeholders.join(', ')}) on conflict do nothing`
    const res = await client.query(sql, values)
    inserted += res.rowCount
  }
  console.log(`  ✓ ${spec.table}: ${inserted}/${rows.length} inserted`)
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[import] DATABASE_URL not set — abort')
    process.exit(1)
  }
  const snapshotPath = path.join(__dirname, 'dev-snapshot.json')
  if (!fs.existsSync(snapshotPath)) {
    console.log('[import] dev-snapshot.json not found — nothing to import, skip')
    return
  }
  const data = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolveSsl(),
    connectionTimeoutMillis: 30000,
  })
  await client.connect()
  try {
    // 冪等守衛:以擴充批次的代表表 field_definition_sets 為哨兵。
    // 已有資料代表「完整同步」已跑過 -> 整批略過;否則執行(原 5 張表會 ON CONFLICT DO NOTHING,只補新表)。
    const guard = await client.query('select count(*)::int as n from field_definition_sets')
    if (guard.rows[0].n > 0) {
      console.log(`[import] field_definition_sets already has ${guard.rows[0].n} rows -> skip (idempotent)`)
      return
    }

    const ownerId = await resolveOwnerId(client)
    console.log(`[import] owner user id = ${ownerId}`)

    // region 重映射:本地 region id -> code(來自 snapshot._refs.regions)-> 目標 DB region id。
    // regions 由 essential seed 以 code upsert(id 為隨機 UUID),跨環境不同,故需重映射。
    const localRegions = (data._refs && data._refs.regions) || []
    const localIdToCode = new Map(localRegions.map((r) => [r.id, r.code]))
    const tgtRegions = await client.query('select id, code from regions')
    const codeToTargetId = new Map(tgtRegions.rows.map((r) => [r.code, r.id]))
    const regionRemap = new Map()
    for (const [id, code] of localIdToCode) {
      const tgt = codeToTargetId.get(code)
      if (tgt) regionRemap.set(id, tgt)
    }
    console.log(`[import] region remap entries = ${regionRemap.size}`)

    for (const spec of PLAN) {
      await importTable(client, spec, data[spec.table], ownerId, regionRemap)
    }
    console.log('[import] business data import done')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('[import] FAILED:', e.message)
  process.exit(1)
})
