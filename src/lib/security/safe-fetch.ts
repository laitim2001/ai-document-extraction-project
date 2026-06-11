/**
 * @fileoverview SSRF 防護：安全外呼工具（assertSafeUrl + safeFetch）
 * @description
 *   在發出任何「使用者可控 URL」的出站請求前，封鎖內網／雲端 metadata 位址，
 *   防止 SSRF（Server-Side Request Forgery）。包含 DNS 解析後再驗證以防 DNS rebinding。
 *
 *   設計原則：
 *   - 預設全封鎖私網／loopback／link-local／unique-local 位址
 *   - 部署可用 SSRF_ALLOWED_HOSTS（逗號分隔 hostname）覆寫，放行合法內部服務（如 docker network 內的 n8n）
 *   - 錯誤訊息為開發者導向（SsrfBlockedError），由呼叫端轉為 4xx，不洩漏內部探測結果
 *
 * @module src/lib/security/safe-fetch
 * @since FIX-068 - SSRF host 白名單（WP-5）
 * @lastModified 2026-06-10
 */

import type { LookupAddress } from 'node:dns'
import { lookup } from 'node:dns/promises'
import { isIP, isIPv4, isIPv6 } from 'node:net'

/**
 * SSRF 攔截錯誤（開發者導向）。
 * 呼叫端應捕獲後轉為 4xx（RFC 7807），不直接回傳內部細節給終端使用者。
 */
export class SsrfBlockedError extends Error {
  constructor(
    message: string,
    public readonly url: string
  ) {
    super(message)
    this.name = 'SsrfBlockedError'
  }
}

/**
 * 部署可覆寫的允許 host 清單（逗號分隔 hostname），預設為空（全封鎖私網）。
 * 用於合法的內部服務 webhook（如 docker network 內的 n8n）。
 */
function getAllowedHosts(): Set<string> {
  const raw = process.env.SSRF_ALLOWED_HOSTS ?? ''
  return new Set(
    raw
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
  )
}

/**
 * 判斷 IP 是否落在封鎖網段（私網／loopback／link-local／metadata／unique-local）。
 * IPv4-mapped IPv6（如 ::ffff:127.0.0.1）會先正規化為 IPv4 再比對，避免繞過。
 */
export function isBlockedIp(ip: string): boolean {
  let addr = ip
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i)
  if (mapped) addr = mapped[1]

  if (isIPv4(addr)) {
    const [a, b] = addr.split('.').map(Number)
    if (a === 0) return true // 0.0.0.0/8 unspecified
    if (a === 127) return true // 127.0.0.0/8 loopback
    if (a === 10) return true // 10.0.0.0/8 私網 A
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12 私網 B
    if (a === 192 && b === 168) return true // 192.168.0.0/16 私網 C
    if (a === 169 && b === 254) return true // 169.254.0.0/16 link-local / 雲端 metadata
    return false
  }

  if (isIPv6(addr)) {
    const lower = addr.toLowerCase()
    if (lower === '::1' || lower === '::') return true // loopback / unspecified
    if (lower.startsWith('fe80')) return true // fe80::/10 link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true // fc00::/7 unique-local
    return false
  }

  // 無法判定的 IP 字面值，保守封鎖
  return true
}

/**
 * 主機名層級的封鎖（localhost / *.localhost / *.local / 空）。
 */
function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '')
  if (!h) return true
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (h.endsWith('.local')) return true
  return false
}

/**
 * 驗證 URL 是否安全可外呼（純驗證，可單元測試）。不安全時 throw SsrfBlockedError。
 *
 * - protocol 僅允許 http/https（拒絕 file/gopher/ftp 等）
 * - hostname 層封鎖 localhost/.local
 * - IP 字面值直接比對封鎖網段
 * - 主機名經 DNS 解析後逐一比對所有 IP（防 DNS rebinding）
 * - SSRF_ALLOWED_HOSTS 中的 host 直接放行（部署覆寫）
 */
export async function assertSafeUrl(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new SsrfBlockedError('Invalid URL', url)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError(`Protocol not allowed: ${parsed.protocol}`, url)
  }

  // URL.hostname 對 IPv6 會帶方括號（如 [::1]），去除後再判斷
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')

  // 部署覆寫：明確允許的 host 直接放行
  if (getAllowedHosts().has(hostname)) return

  if (isBlockedHostname(hostname)) {
    throw new SsrfBlockedError(`Hostname not allowed: ${hostname}`, url)
  }

  // IP 字面值直接判斷
  if (isIP(hostname) !== 0) {
    if (isBlockedIp(hostname)) {
      throw new SsrfBlockedError(`Target IP is in a blocked range: ${hostname}`, url)
    }
    return
  }

  // 主機名 → DNS 解析後逐一驗證（防 DNS rebinding）
  let addresses: LookupAddress[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    throw new SsrfBlockedError(`DNS resolution failed: ${hostname}`, url)
  }
  if (addresses.length === 0) {
    throw new SsrfBlockedError(`No DNS records: ${hostname}`, url)
  }
  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      throw new SsrfBlockedError(`Resolved IP is in a blocked range: ${hostname} -> ${address}`, url)
    }
  }
}

/**
 * 安全版 fetch：先驗證 URL，通過才發出請求。
 * 保留原生 fetch 的 init（signal / headers / method 等）與回傳介面。
 *
 * @throws SsrfBlockedError 當目標 URL 落在封鎖範圍
 */
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  await assertSafeUrl(url)
  return fetch(url, init)
}
