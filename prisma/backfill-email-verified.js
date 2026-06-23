/**
 * @fileoverview 一次性 email_verified backfill（FIX-092）。
 *   FIX-090 讓 createUser 對「有密碼的本地帳號」直接標記 email 已驗證，但僅影響
 *   「建立時」，不回填 FIX-090 之前已建立的帳號。那些既有帳號 email_verified 為
 *   null → 登入時被 auth.config.ts 的 EmailNotVerified 檢查擋住；而 Azure 環境
 *   未配置 SMTP、發不出驗證信 → 該類帳號永遠無法登入。
 *
 *   本 script 把所有「有密碼（本地帳號）但尚未驗證」的帳號補上 email_verified
 *   （視為可信，與 FIX-090 邏輯一致）。沒設密碼的帳號走 Azure AD SSO、不經
 *   credentials 的 emailVerified 檢查，故 WHERE 排除（password IS NOT NULL）。
 *
 *   設計重點（比照 apply-schema-drift.js / bootstrap-db.js）：
 *   - 只依賴 `pg`（已含於 standalone runtime），不需 Prisma CLI
 *   - Azure PostgreSQL 需 TLS：偵測 sslmode=require 或 azure host 時啟用
 *   - 冪等：只更新 email_verified IS NULL 的列，重跑不會覆蓋已驗證者
 *
 *   由 docker-entrypoint.sh 的 RUN_EMAIL_VERIFIED_BACKFILL=true 觸發；非致命；
 *   補完後把旗標設回 false。
 *
 * @module prisma/backfill-email-verified
 * @since FIX-092 (2026-06-23)
 * @lastModified 2026-06-23
 */
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
    console.error('[email-verified-backfill] DATABASE_URL not set — cannot continue')
    process.exit(1)
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolveSsl(),
    connectionTimeoutMillis: 30000,
  })

  await client.connect()
  try {
    // 有密碼（本地帳號）且尚未驗證 → 補上 email_verified（與 FIX-090 一致，視為可信）。
    const res = await client.query(
      `update users set email_verified = now()
       where password is not null and email_verified is null`
    )
    console.log(
      `[email-verified-backfill] done — ${res.rowCount} local account(s) marked verified`
    )
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('[email-verified-backfill] FAILED:', e.message)
  process.exit(1)
})
