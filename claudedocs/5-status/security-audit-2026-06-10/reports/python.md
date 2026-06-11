# 安全審查報告 — Python Services（extraction + mapping）

> 審查日期：2026-06-10 | Scope：scopes/python.txt | Agent：python-services 安全審查 agent

## 1. 覆蓋清單

| # | 檔案 | 行數 | 完整讀取 |
|---|------|------|----------|
| 1 | python-services/extraction/.env.example | 15 | ✅ |
| 2 | python-services/extraction/Dockerfile | 51 | ✅ |
| 3 | python-services/extraction/requirements.txt | 24 | ✅ |
| 4 | python-services/extraction/src/__init__.py | 7 | ✅ |
| 5 | python-services/extraction/src/main.py | 292 | ✅ |
| 6 | python-services/extraction/src/ocr/__init__.py | 10 | ✅ |
| 7 | python-services/extraction/src/ocr/azure_di.py | 319 | ✅ |
| 8 | python-services/extraction/src/ocr/processor.py | 268 | ✅ |
| 9 | python-services/mapping/.env.example | 14 | ✅ |
| 10 | python-services/mapping/Dockerfile | 35 | ✅ |
| 11 | python-services/mapping/requirements.txt | 22 | ✅ |
| 12 | python-services/mapping/src/__init__.py | 9 | ✅ |
| 13 | python-services/mapping/src/identifier/__init__.py | 9 | ✅ |
| 14 | python-services/mapping/src/identifier/matcher.py | 310 | ✅ |
| 15 | python-services/mapping/src/main.py | 539 | ✅ |
| 16 | python-services/mapping/src/mapper/__init__.py | 49 | ✅ |
| 17 | python-services/mapping/src/mapper/field_mapper.py | 694 | ✅ |
| 18 | python-services/mapping/src/mapper/models.py | 213 | ✅ |

**總計**：18 個檔案，2,880 行，全部完整讀取。

---

## 2. 發現

### [High] PY-01 兩個 FastAPI 服務完全無認證且無速率限制
- **檔案**：`python-services/extraction/src/main.py:200`、`:231`；`python-services/mapping/src/main.py:386`、`:447`、`:376`
- **類別**：A（認證與授權）、K（DoS）
- **描述**：extraction 服務（port 8000）的 `/extract/url`、`/extract/file` 與 mapping 服務（port 8001）的 `/identify`、`/map-fields`、`/forwarders` 全部沒有任何 API key / token / session 檢查。任何能連到該 port 的人都能直接呼叫，觸發昂貴的 Azure Document Intelligence OCR 分析（產生雲端費用），或讓服務以攻擊者提供的 URL / 檔案執行處理。也沒有任何速率限制，單一呼叫者即可灌爆服務造成 DoS 與帳單放大。
- **證據**：
  ```python
  # extraction/src/main.py:200
  @app.post("/extract/url", response_model=ExtractResponse)
  async def extract_from_url(request: ExtractUrlRequest) -> ExtractResponse:
      if processor is None:
          raise HTTPException(status_code=503, ...)
      # 無任何認證檢查，直接執行 OCR
  ```
  ```python
  # mapping/src/main.py:386
  @app.post("/identify", response_model=IdentifyResponse)
  async def identify_forwarder(request: IdentifyRequest) -> IdentifyResponse:
      if matcher is None:
          raise HTTPException(status_code=503, ...)
      # 無認證
  ```
- **影響緩解因素**：在預期部署中這兩個服務應僅由內部 Node.js 後端透過內網呼叫（docker-compose 未對外發佈時、或 Azure 私有端點）。但 docker-compose.yml 第 48 / 69 行把 8000、8001 直接 bind 到主機（`"8000:8000"` / `"8001:8001"`），開發機上即對 localhost 全開放；若主機防火牆或雲端 NSG 配置不當會直接外露。
- **建議**：在兩個服務加上共享密鑰（如 `X-Internal-API-Key` header 驗證，從環境變數讀取）作為內部服務間認證；部署時確保 8000/8001 僅綁定內網介面（不要對公網發佈）；對 OCR 端點加上基本速率限制。屬縱深防禦缺層，標記為 High 因端點直接觸發雲端計費與外部資源讀取。

### [High] PY-02 `/extract/url` 的 SSRF：服務會抓取使用者提供的任意 URL
- **檔案**：`python-services/extraction/src/main.py:200-228`；`python-services/extraction/src/ocr/azure_di.py:58-97`
- **類別**：G（SSRF）
- **描述**：`/extract/url` 接收請求 body 中的 `documentUrl`，原樣傳給 Azure Document Intelligence 的 `AnalyzeDocumentRequest(url_source=document_url)`。Pydantic 的 `HttpUrl` 僅驗證 URL 是 http/https 格式，不限制目標主機。實際抓取由 Azure 端執行（Azure 會去 fetch 該 URL），因此 SSRF 面主要落在 Azure 服務側而非本服務的網路；但設計上仍允許呼叫者讓系統對任意外部 / 內部 URL 發起抓取，且結合 PY-01 無認證，外部人可指定任意 URL。若未來改為本地端 fetch（如加 fallback 下載）會立即變成 Critical SSRF。
- **證據**：
  ```python
  # main.py:107
  documentUrl: HttpUrl = Field(..., description="文件 URL（需要 SAS token）")
  # azure_di.py:78
  analyze_request = AnalyzeDocumentRequest(url_source=document_url)
  ```
- **建議**：對 `documentUrl` 做白名單驗證（僅允許預期的 Azure Blob Storage / SharePoint 主機，或要求 SAS token 格式）；拒絕指向私有網段（169.254.x.x、10.x、127.x、metadata endpoint）的 URL。配合 PY-01 的認證限制可降低風險。

### [Medium] PY-03 兩個服務 CORS 同時 `allow_credentials=True` 且 `allow_methods/headers=["*"]`
- **檔案**：`python-services/extraction/src/main.py:176-182`；`python-services/mapping/src/main.py:352-358`
- **類別**：A / F（跨來源）
- **描述**：兩個服務都設定 `allow_credentials=True` 搭配 `allow_methods=["*"]`、`allow_headers=["*"]`。雖然 `allow_origins` 來自環境變數（預設 `http://localhost:3000`，非萬用 `*`），但若部署時把 `CORS_ORIGINS` 設成多個或被誤設為過寬來源，`allow_credentials=True` 會讓帶 cookie / 認證的跨來源請求被接受。再者，這兩個服務本身無認證（PY-01），CORS 設 credentials 沒有實際保護價值，反而是錯誤配置風險面。`split(",")` 未 trim 空白（第 178 / 354 行），若 env 寫成 `a, b` 會產生帶前導空白的來源字串而比對失敗（功能性問題，間接導致有人改用 `*`）。
- **證據**：
  ```python
  # main.py:176
  app.add_middleware(
      CORSMiddleware,
      allow_origins=settings.cors_origins.split(","),
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
- **建議**：內部服務不需 credentials，設 `allow_credentials=False`；明確列舉 methods（`POST`, `GET`）；對 `CORS_ORIGINS` 做 `.strip()` 處理；嚴禁部署時用 `*`。

### [Medium] PY-04 mapping 服務以使用者輸入字串作為 regex 並對全文執行（ReDoS）
- **檔案**：`python-services/mapping/src/identifier/matcher.py:233-236`；`python-services/mapping/src/mapper/field_mapper.py:306-307`、`:652`
- **類別**：B（注入）/ K（DoS）
- **描述**：
  - matcher 將 `pattern.formats` 內每個字串 `re.compile(fmt, re.IGNORECASE)` 後對 `original_text`（OCR 全文，可能很長）執行 `findall`。
  - field_mapper 用 `MappingRule.extraction_pattern` 內的 `pattern` 字串直接 `re.search(regex_pattern, ocr_text, flags)`，並用 `validation_pattern` 做 `re.match`。
  這些 regex 來源是「映射規則」（由 mapping 服務的 `/map-fields` 請求 body 或 DB 載入的 forwarder patterns）。若呼叫者（在 PY-01 無認證下任何人）提供惡意 regex（如災難性回溯 `(a+)+$`），搭配長 OCR 文本可造成 CPU 100% 的 ReDoS，阻塞 async event loop（這些 regex 是同步呼叫，會卡住整個服務）。雖有 `try/except re.error` 但只擋語法錯誤，不擋回溯爆炸。
- **證據**：
  ```python
  # field_mapper.py:306
  match = re.search(regex_pattern, ocr_text, flags)   # regex 來自請求
  # matcher.py:235
  regex = re.compile(fmt, re.IGNORECASE)
  matches = regex.findall(original_text)
  ```
- **建議**：regex 來源視為不可信時，限制 pattern 長度、用具 timeout 的 regex 引擎（如 `regex` 套件的 `timeout` 參數）或在 worker thread 執行並設逾時；或限制只接受 DB 內預先審核過的 pattern（搭配 PY-01 的認證確保 `/map-fields` 僅由內部後端呼叫）。

### [Medium] PY-05 mapping 服務以原始 SQL 連線並查詢，依賴環境變數正確性
- **檔案**：`python-services/mapping/src/main.py:262-299`
- **類別**：B（SQL）/ D（設定）
- **描述**：`load_patterns_from_db()` 用 `psycopg2.connect(settings.database_url)` 直接連 DB，SQL 為固定字串無使用者輸入拼接，**沒有 SQL injection**（查詢條件全為硬編碼，`WHERE is_active = true`）。屬於正向確認。風險點在於：connection 未使用連線池且在 lifespan 啟動時一次性查詢後關閉（可接受）；`database_url` 含明文密碼，若 exception 將 `str(e)` 記入 log（第 305 行 `logger.error("failed_to_load_patterns_from_db", error=str(e))`），psycopg2 連線錯誤訊息「可能」包含連線參數（host/user/db，通常不含密碼，但部分版本錯誤訊息會帶 DSN）。
- **證據**：
  ```python
  # main.py:266
  conn = psycopg2.connect(settings.database_url)
  cur.execute("""SELECT id, code, ... FROM forwarders WHERE is_active = true ...""")
  # main.py:305
  logger.error("failed_to_load_patterns_from_db", error=str(e))
  ```
- **建議**：SQL 本身安全，保留。針對日誌，確認 psycopg2 例外訊息不含 DSN；建議只記錄 `type(e).__name__` 與安全摘要，避免潛在連線字串外洩。

### [Medium] PY-06 Python 依賴版本固定但部分有已知 CVE / 偏舊（aiohttp、psycopg2-binary、未鎖定版本）
- **檔案**：`python-services/extraction/requirements.txt:1-24`；`python-services/mapping/requirements.txt:1-22`
- **類別**：D / K（供應鏈）
- **描述**：
  - extraction 服務固定 `aiohttp==3.11.11`。aiohttp 3.11.x 早期版本有數個已揭露問題（request smuggling / 解析相關 CVE，例如 CVE-2024-52304 影響 < 3.11.0 已修，但 3.11.x 後續又陸續有修補版本如 3.11.16+）。需確認 3.11.11 是否涵蓋最新修補；且 `aiohttp` 在 extraction 服務中**未被 import 使用**（main/azure_di/processor 皆用 Azure SDK 與內建，無 aiohttp 呼叫），屬未使用但引入攻擊面的依賴。
  - mapping 服務全部用 `>=` 下限而非固定版本（`fastapi>=0.109.0`、`uvicorn>=0.27.0`、`psycopg2-binary>=2.9.9` 等）。`>=` 不可重現建置，且會在重建時自動拉入未經測試的新版本，供應鏈風險與不可預測性高。
  - `psycopg2-binary` 官方建議生產環境用 `psycopg2`（source）而非 binary wheel，binary 在某些平台有 libpq 連結安全性顧慮（非直接漏洞，最佳實踐）。
- **證據**：
  ```
  # extraction/requirements.txt:13
  aiohttp==3.11.11        # 服務內未使用
  # mapping/requirements.txt:5-16
  fastapi>=0.109.0
  uvicorn[standard]>=0.27.0
  psycopg2-binary>=2.9.9
  ```
- **建議**：移除 extraction 未使用的 `aiohttp`（縮小攻擊面）；mapping 全部改為固定版本（`==`）並產生 lock 檔；定期跑 `pip-audit` / Dependabot 掃描；確認 aiohttp 升至已修補版本（若保留）。

### [Low] PY-07 mapping 服務 Dockerfile 以 root 執行（缺 non-root user）
- **檔案**：`python-services/mapping/Dockerfile:1-35`
- **類別**：K（容器安全）
- **描述**：extraction 的 Dockerfile（第 34-35 行）有建立 `appuser` 並 `USER appuser`，但 mapping 的 Dockerfile **沒有**建立非 root 使用者，容器以 root 執行。若服務被攻破（如 PY-04 的 RCE/ReDoS 鏈），root 權限放大影響。兩個 Dockerfile 安全基線不一致。
- **證據**：
  ```dockerfile
  # mapping/Dockerfile 全檔無 useradd / USER 指令，預設 root
  CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
  ```
- **建議**：比照 extraction Dockerfile 加入非 root 使用者。

### [Low] PY-08 mapping 服務基礎映像為 Python 3.11，extraction 為 3.12（版本不一致 + 偏舊）
- **檔案**：`python-services/mapping/Dockerfile:4`；`python-services/extraction/Dockerfile:9,23`
- **類別**：K
- **描述**：extraction 用 `python:3.12-slim`，mapping 用 `python:3.11-slim`。版本不一致增加維運與相依性管理負擔；`-slim` tag 未鎖 digest（`python:3.12-slim` 而非 `python:3.12-slim@sha256:...`），重建可能拉到不同底層映像。`slim` 雖較小但仍含 apt，且未鎖 patch 版本。
- **建議**：統一 Python 版本並鎖 digest；定期重建以取得 OS 安全更新。

### [Low] PY-09 OCR 上傳檔案無大小上限，整檔讀入記憶體
- **檔案**：`python-services/extraction/src/main.py:231-277`
- **類別**：H（檔案處理）/ K（DoS）
- **描述**：`/extract/file` 用 `document_bytes = await file.read()` 把整個上傳檔案一次讀入記憶體，沒有任何大小上限檢查。配合 PY-01 無認證，攻擊者可上傳超大檔案造成記憶體耗盡（OOM）DoS。`SUPPORTED_MIME_TYPES` 僅依賴 client 提供的 `content_type`（第 253 行 `file.content_type`），未驗證實際檔案 magic bytes，可被偽造（不過下游 Azure DI 會再驗，影響有限）。
- **證據**：
  ```python
  # main.py:253
  content_type = file.content_type or "application/octet-stream"
  if content_type not in DocumentProcessor.SUPPORTED_MIME_TYPES: ...
  # main.py:261
  document_bytes = await file.read()   # 無大小上限
  ```
- **建議**：加上 `Content-Length` / 讀取上限檢查（如 50MB），超過即回 413；考慮串流處理或暫存檔。

### [Low] PY-10 OCR 結果完整 `rawResult` 原樣回傳，可能含敏感發票內容
- **檔案**：`python-services/extraction/src/ocr/azure_di.py:191-198`；`python-services/extraction/src/main.py:117`
- **類別**：E / J（資訊洩漏）
- **描述**：`_parse_result` 將 `result.as_dict()`（Azure DI 的完整原始輸出，含發票上所有 PII：供應商/客戶名稱、地址、金額、發票號）放進回應的 `rawResult` 欄位整包回傳。雖然這是內部服務對內部後端的回傳（屬設計需要），但若 PY-01 / PY-03 的暴露面成立，等同把完整發票 PII 暴露給能呼叫端點的人。日誌方面，URL 有截斷處理（`[:100]`，第 220 行），這點良好；但 `rawResult` 不應在任何 log 落地（目前未 log，正向）。
- **證據**：
  ```python
  # azure_di.py:192
  "rawResult": result.as_dict(),
  ```
- **建議**：確認 `rawResult` 僅在受信任的內部通道傳遞；若無下游需求可考慮移除或裁剪。配合 PY-01 認證為主要緩解。

### [Info] PY-11 兩服務未對 OCR / regex 等同步阻塞操作做執行緒隔離
- **檔案**：`python-services/extraction/src/ocr/azure_di.py:81-88`；`python-services/mapping/src/mapper/field_mapper.py:306`
- **類別**：K
- **描述**：`begin_analyze_document(...).result()` 是同步阻塞呼叫，卻放在 `async def` 內直接 `await process_func(*args)`（processor.py:164 實際呼叫的是同步函式被當 coroutine await — 注意 `analyze_document_from_url` 宣告為 `async def` 但內部全為同步阻塞，無真正 await 點）。這會阻塞 event loop，降低併發並使單一慢請求拖累全服務，間接擴大 DoS 面。屬效能 / 可用性觀察，非直接漏洞。
- **建議**：將阻塞呼叫移到 `run_in_executor` / `anyio.to_thread`，或使用 Azure SDK 的 async client。

### [Info] PY-12 `.env.example` 內容無真實機密（正向確認）
- **檔案**：`python-services/extraction/.env.example`；`python-services/mapping/.env.example`
- **類別**：D
- **描述**：兩個 `.env.example` 皆為佔位值（`your-api-key`、`your-resource`、本地預設 DB 帳密 `postgres:postgres`）。無真實 Azure key / 生產連線字串硬編碼，符合規範。mapping 的範例 DATABASE_URL 指向 localhost:5432（注意與專案慣例 5433 不同，但屬範例，非安全問題）。
- **建議**：無。維持現狀。

### [Info] PY-13 matcher 對 DB 載入的 regex 有 try/except 保護（正向）
- **檔案**：`python-services/mapping/src/identifier/matcher.py:252-258`；`field_mapper.py:348-350`、`:656-658`
- **類別**：B
- **描述**：對 regex 編譯 / 執行有 `except re.error` 保護並記 warning，避免無效 pattern 造成 crash。良好實踐（惟不防 ReDoS，見 PY-04）。
- **建議**：無，與 PY-04 建議併同處理。

---

## 3. 統計

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0 | 2 | 4 | 4 | 3 |

---

## 4. 區域整體觀察

1. **系統性「無認證內部服務」模式**：兩個 Python FastAPI 服務（extraction:8000、mapping:8001）都假設「只會被內部 Node.js 後端呼叫」因此完全不做認證或速率限制（PY-01）。整個目錄 0% 端點有認證。這在私有網路內可接受，但 docker-compose 直接把 port bind 到主機，且無服務間共享密鑰作為縱深防禦。這是本區域最大的系統性風險，所有「需登入才安全」的假設都建立在網路隔離正確配置之上。

2. **不可信 regex 是貫穿性風險**：matcher 與 field_mapper 都把外部來源（請求 body 或 DB pattern）的字串當 regex 對長文本執行（PY-04），且為同步阻塞（PY-11），ReDoS 可直接卡死 async 服務。

3. **兩個服務的安全基線不一致**：extraction 較成熟（Python 3.12、non-root user、固定版本依賴、URL 日誌截斷），mapping 較弱（Python 3.11、root 執行、`>=` 浮動版本依賴）。建議將 extraction 的基線推廣到 mapping。

4. **無 PII 落地日誌的回歸**：本區域日誌使用 structlog 結構化輸出，OCR URL 有截斷（`[:100]`），未發現將 email / token / 完整發票內容寫入 log 的情況（FIX-050 類問題未在 Python 側重現）。`rawResult`（含發票 PII）僅放在 API 回應、未進 log，屬正向；但其暴露程度取決於 PY-01 的網路隔離。

5. **SQL 安全**：mapping 唯一的原始 SQL（`load_patterns_from_db`）為固定查詢、無輸入拼接，無注入風險（與 FIX-051 的 db-context.ts 問題不同層）。
