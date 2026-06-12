/**
 * @fileoverview 上傳檔案 MIME magic byte（檔案簽章）驗證
 * @description
 *   以檔案內容前數個位元組（magic byte / 檔案簽章）判定檔案真實類型，
 *   取代僅依賴客戶端宣告的 `file.type`（multipart 表單欄位，可偽造）。
 *
 *   用途（FIX-071）：昂貴 AI/OCR 端點在將上傳檔案送入 Azure Document
 *   Intelligence / GPT Vision 前，先確認內容確為宣告的類型，阻擋
 *   「宣告 application/pdf 但內容為他物（如可執行檔 / 壓縮炸彈）」的偽造上傳。
 *
 *   涵蓋類型：PDF、JPEG、PNG、TIFF、WebP（與既有 AI/OCR 端點接受的類型一致）。
 *   採 Node.js 原生 `Buffer` 比對，零新依賴。
 *
 * @module src/lib/upload/magic-byte
 * @author Development Team
 * @since FIX-071 (成本型 DoS — MIME magic byte 驗證)
 * @lastModified 2026-06-11
 */

/**
 * 以「前綴位元組」比對的檔案簽章（檔案頭位元組）。
 * - PDF：`%PDF`（25 50 44 46）
 * - JPEG：FF D8 FF
 * - PNG：89 50 4E 47 0D 0A 1A 0A（8-byte 完整簽章）
 * - TIFF：49 49 2A 00（little-endian）/ 4D 4D 00 2A（big-endian）
 */
const MAGIC_SIGNATURES: ReadonlyArray<{ mime: string; bytes: number[] }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/tiff', bytes: [0x49, 0x49, 0x2a, 0x00] },
  { mime: 'image/tiff', bytes: [0x4d, 0x4d, 0x00, 0x2a] },
]

/**
 * 比對 buffer 開頭是否符合指定的位元組序列。
 */
function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[i] !== bytes[i]) return false
  }
  return true
}

/**
 * WebP 判定：`RIFF`（0-3）+ `WEBP`（8-11），非單純前綴，需獨立檢查。
 */
function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  )
}

/**
 * 正規化 MIME 別名（`image/jpg` → `image/jpeg`），用於相容性比對。
 */
function normalizeMime(mime: string): string {
  return mime === 'image/jpg' ? 'image/jpeg' : mime
}

/**
 * 從 magic byte 偵測檔案的真實 MIME 類型。
 *
 * @param buffer 檔案內容（至少含檔案頭數個位元組）
 * @returns 偵測到的 MIME 類型；不符任何已知簽章則回 `null`
 */
export function detectMimeFromMagicBytes(buffer: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (startsWith(buffer, sig.bytes)) return sig.mime
  }
  if (isWebp(buffer)) return 'image/webp'
  return null
}

/**
 * 驗證檔案內容的 magic byte 與宣告的 MIME 類型相符（且為已知安全類型）。
 *
 * @description
 *   不採信客戶端宣告的 `file.type`，以「內容偵測到的實際類型」為準：
 *   1. 內容必須為已知安全類型（PDF/JPEG/PNG/TIFF/WebP），否則拒絕（擋惡意偽裝）。
 *   2. 偵測類型須與宣告類型一致（`image/jpg` 與 `image/jpeg` 視為相同）。
 *
 * @param buffer 檔案內容（至少含檔案頭）
 * @param declaredMime 客戶端宣告的 MIME 類型
 * @returns 內容為已知安全類型且與宣告一致 → `true`
 */
export function verifyMagicByte(buffer: Buffer, declaredMime: string): boolean {
  const detected = detectMimeFromMagicBytes(buffer)
  if (!detected) return false
  return normalizeMime(detected) === normalizeMime(declaredMime)
}
