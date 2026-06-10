# CHANGE-080: Python 服務認證 + Rate Limit（PY-01 / PY-03 / PY-06）

> **狀態**: ⏳ 待實作（H1 架構，用戶暫未 approve，需先確認部署網路拓撲）
> **來源**: SECURITY-ASSESSMENT.md §5 主題 E（PY-01）、REMEDIATION-ROADMAP.md WP-8
> **H1 note**: Python 服務認證架構改動；實作前需用戶確認網路拓撲後 approve
> **日期**: 2026-06-10
> **優先級**: P1（High）
> **類型**: Security
> **影響範圍**: `python-services/extraction/src/main.py`、`python-services/mapping/src/main.py`、兩個 `requirements.txt`、`src/services/extraction.service.ts` / `mapping.service.ts` / `identification/identification.service.ts`（呼叫端需帶內部金鑰）、`docker-compose.yml`、`.env.example`
> **涵蓋安全發現**: PY-01（High，認證 + rate limit）、PY-03（Medium，CORS 過寬）、PY-06（Medium，依賴 CVE / 浮動版本）
> **相依**: 與 CHANGE-077（WP-1 auth fail-open）、CHANGE-078（WP-2 middleware 閘）同屬安全治理批次，但本 WP 範圍獨立於 Node 端認證（Python 服務有自己的服務間信任邊界）

---

## 變更背景

2026-06-10 全面安全審查（逐檔逐行）發現：**兩個 Python FastAPI 服務（extraction port 8000、mapping port 8001）所有業務端點完全無認證、無速率限制**，且 CORS 配置與依賴版本存在縱深防禦缺層。

這兩個服務的安全模型完全建立在「只會被內部 Node.js 後端透過內網呼叫」這個**假設**之上，但程式碼層面沒有任何服務間認證作為縱深防禦，且 `docker-compose.yml` 把 8000 / 8001 直接 bind 到主機。一旦部署網路隔離配置不當（防火牆 / NSG / 私有端點），即等同對可達網路全開放，攻擊者可：

- 直接觸發昂貴的 Azure Document Intelligence OCR 分析（雲端帳單放大）。
- 灌爆服務造成 DoS（無速率限制）。
- 讀取完整發票 PII（`rawResult` 原樣回傳，見 python.md PY-10）。

> ⚠️ **本 WP 的核心前置問題**：「兩個服務是否僅綁私網、是否對外可達」**直接決定本 WP 的優先級與必要性**。若已確認僅綁私網且不對外，則服務間認證屬縱深防禦（仍建議做但可降優先）；若任一環境對外可達，則 PY-01 立即升為必須立即處置。**故實作前必須先確認部署網路拓撲（見下方專節）。**

---

## 現狀盤點（已逐行 Read 驗證）

### 服務 1：extraction（OCR 提取，port 8000）

| 維度 | 現狀 | 證據 |
|------|------|------|
| **認證** | ❌ 完全無認證 | `main.py:200` `/extract/url`、`:231` `/extract/file`、`:189` `/health` 全部無任何 API key / token / session 檢查 |
| **速率限制** | ❌ 無 | 全檔無 rate limit 中介層 |
| **CORS** | ⚠️ 過寬配置 | `main.py:176-182`：`allow_origins=settings.cors_origins.split(",")`（預設 `http://localhost:3000`，非 `*`）但 `allow_credentials=True` + `allow_methods=["*"]` + `allow_headers=["*"]`；`split(",")` 未 `.strip()` |
| **Host 綁定** | 🔴 `0.0.0.0` | `main.py:53` `host: str = Field(default="0.0.0.0", ...)`；`Dockerfile` CMD 亦 `--host 0.0.0.0` |
| **檔案大小上限** | ❌ 無（PY-09 Low） | `main.py:261` `await file.read()` 整檔讀入記憶體，無上限 |

### 服務 2：mapping（Forwarder 識別 + 欄位映射，port 8001）

| 維度 | 現狀 | 證據 |
|------|------|------|
| **認證** | ❌ 完全無認證 | `main.py:386` `/identify`、`:447` `/map-fields`、`:376` `/forwarders`、`:365` `/health` 全部無認證 |
| **速率限制** | ❌ 無 | 全檔無 rate limit 中介層 |
| **CORS** | ⚠️ 過寬配置 | `main.py:352-358`：與 extraction 相同模式（`allow_credentials=True` + `["*"]` methods/headers，`split(",")` 未 trim） |
| **Host 綁定** | 🔴 `0.0.0.0` | `main.py:65` `host: str = Field(default="0.0.0.0", ...)` |
| **DB 連線** | ⚠️ 明文連線字串 | `main.py:266` `psycopg2.connect(settings.database_url)`；SQL 固定無注入，但 `:305` 例外記 `str(e)` 可能含 DSN（PY-05 Medium） |

### 部署面現狀

| 項目 | 現狀 | 證據 |
|------|------|------|
| **docker-compose port 綁定** | 🔴 直接 bind 主機 | `docker-compose.yml:48` `"8000:8000"`、`:69` `"8001:8001"`（開發機對 localhost 全開放） |
| **Node 端呼叫方式** | 環境變數 URL | `extraction.service.ts:41` `OCR_SERVICE_URL`（預設 `http://localhost:8000`）；`mapping.service.ts:48` / `identification.service.ts:95` `MAPPING_SERVICE_URL` / `PYTHON_MAPPING_SERVICE_URL`（預設 `http://localhost:8001`）|
| **呼叫目標主機是否含使用者輸入** | ✅ 否（無 SSRF） | 目標主機固定來自 env，URL 不含使用者輸入（見 services-unified.md） |
| **Azure 規劃（CHANGE-069 ACA）** | `externalIngress: false` | CHANGE-069 規劃 ACA internal-only + Web app 指向 internal FQDN（`pythonExtraction.outputs.fqdn`）|
| **Azure DEV 實際（memory）** | App Service for Containers + 私有端點 | ⚠️ memory 記載實際部署**非** CHANGE-069 規劃的 ACA，是 App Service for Containers + 私有端點 — **需確認這兩個 Python 服務在實際 Azure 部署中的暴露狀態** |

### 依賴版本現狀（PY-06）

| 服務 | 問題 | 證據 |
|------|------|------|
| extraction | `aiohttp==3.11.11` 固定但偏舊，且**服務內未被 import 使用**（多餘攻擊面） | `extraction/requirements.txt:13` |
| extraction | 其餘依賴固定版本（`==`），相對良好 | `requirements.txt:1-24` |
| mapping | **全部用 `>=` 浮動下限**（`fastapi>=0.109.0`、`uvicorn>=0.27.0`、`psycopg2-binary>=2.9.9` 等），不可重現建置 | `mapping/requirements.txt:5-19` |
| 兩服務 | 未跑 `pip-audit` / Dependabot；無 lock 檔 | — |

> **補充（非本 WP 主範圍，記入觀察）**：python.md 另列 PY-02（`/extract/url` SSRF，併入 WP-5）、PY-04（ReDoS，併入 WP-6）、PY-07/08（Dockerfile root / 映像版本不一致，Low）、PY-09（檔案大小上限，Low）。本 WP 聚焦 PY-01 / PY-03 / PY-06。

---

## ⚠️ 待確認事項：部署網路拓撲（實作前必須回答）

> 本節為 **H1 approve 的前置條件**。在以下問題未獲明確回答前，不得開始實作。

| # | 問題 | 為何重要 | 已知線索 |
|---|------|----------|----------|
| 1 | Node 後端如何呼叫這兩個 Python 服務？同一容器 / 同一私網 / 跨網段？ | 決定服務間認證的信任邊界與金鑰傳遞方式 | 透過 `OCR_SERVICE_URL` / `MAPPING_SERVICE_URL` env（本地預設 localhost）|
| 2 | Azure 實際部署中，8000 / 8001 兩個 port 是否對公網暴露？ | **直接決定本 WP 優先級**：對外可達 → 立即必做；僅私網 → 縱深防禦可降優先 | CHANGE-069 規劃 ACA `externalIngress: false`；memory 記載 DEV 實際為 **App Service for Containers + 私有端點**（與規劃不符，需確認 Python 服務側狀態）|
| 3 | 實際 Azure 部署是 ACA（CHANGE-069 規劃）還是 App Service for Containers（memory 記載）？兩個 Python 服務各自如何託管？ | 兩種託管的網路隔離與 ingress 控制機制不同，影響「是否需程式碼層認證」的判斷 | memory `project_azure_dev_environment.md`：實際 App Service + 私有端點（**非** ACA）|
| 4 | UAT / staging / prod 各環境的暴露狀態是否一致？ | 任一環境對外可達即拉高整體風險等級 | CHANGE-069 規劃 UAT `externalIngress: true`（Pilot 方便）、Prod `false` |
| 5 | docker-compose 把 8000/8001 bind 到主機是否僅限本機開發？生產是否改用 internal network（不發佈 port）？ | 開發機 bind 主機可接受；生產若沿用即外露 | `docker-compose.yml:48,69` `"8000:8000"` / `"8001:8001"` |
| 6 | 內部 API Key 由誰管理、如何輪替、存放於何處（Key Vault / env）？ | memory 記載 SP 僅 Contributor、**不能用 Key Vault / Managed Identity** → 影響金鑰存放方案 | memory `project_azure_dev_environment.md` |

**決策分支**：
- **若 Q2/Q4 確認「所有環境僅綁私網、不對外可達」** → PY-01 服務間認證降為縱深防禦（仍建議做），本 WP 可降優先或僅做 CORS 收緊 + 依賴升級。
- **若任一環境對外可達或無法確認** → PY-01 升為必須立即處置（內部 API Key + rate limit 全做）。

---

## 技術設計

> ⚠️ 以下為**待 approve 的提案設計**，非已定案。最終方案依「待確認事項」答覆調整。

### 設計 1：內部 API Key 驗證（FastAPI dependency）— 對應 PY-01

兩個服務各加一個共享密鑰驗證 dependency，從環境變數讀取，套用於所有業務端點（`/health` 維持公開供 healthcheck）。

```python
# 概念示意（提案，未實作）
from fastapi import Header, HTTPException, Depends

INTERNAL_API_KEY = settings.internal_api_key  # 從 INTERNAL_API_KEY env 讀取

async def require_internal_key(x_internal_api_key: str = Header(default="")):
    # fail-closed：未配置金鑰時拒絕（避免「沒設就放行」的 fail-open）
    if not INTERNAL_API_KEY:
        raise HTTPException(status_code=503, detail="Internal auth not configured")
    if not secrets.compare_digest(x_internal_api_key, INTERNAL_API_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized")

# 套用：@app.post("/extract/url", dependencies=[Depends(require_internal_key)])
```

**對應 Node 端改動**：`extraction.service.ts` / `mapping.service.ts` / `identification.service.ts` 呼叫時於 header 帶 `X-Internal-API-Key`（從 Node 端同名 env 讀取，兩側共享同一金鑰）。

**設計決策**：
- **fail-closed**：未配置 `INTERNAL_API_KEY` 時拒絕（503），對齊 CHANGE-077 的 fail-closed 原則，避免「沒設就全放行」。
- **`secrets.compare_digest`**：常數時間比較，避免 timing attack。
- **`/health` 維持公開**：供 docker-compose / Azure healthcheck 探測（不洩漏業務資料）。

### 設計 2：速率限制 — 對應 PY-01（DoS 面）

對昂貴端點（`/extract/url`、`/extract/file`、`/map-fields`）加基本速率限制（如 `slowapi` 或自訂計數器）。
> ⚠️ **H2 提醒**：`slowapi` 為新 Python 依賴，加入 `requirements.txt` 需 H2 approve。替代方案：用既有依賴實作簡易計數器（避免新增套件）。實作前確認用戶偏好。

### 設計 3：CORS 收緊 — 對應 PY-03

| 項目 | 現狀 | 提案 |
|------|------|------|
| `allow_credentials` | `True` | `False`（內部服務不需 cookie 認證，改用 header API Key）|
| `allow_methods` | `["*"]` | 明確列舉 `["GET", "POST"]` |
| `allow_headers` | `["*"]` | 明確列舉（含 `X-Internal-API-Key`）|
| `cors_origins.split(",")` | 未 trim | 加 `.strip()` 處理 |
| 部署值 | env 控制 | 嚴禁設 `*`；文件標註 |

### 設計 4：依賴升級 — 對應 PY-06

| 動作 | 範圍 |
|------|------|
| 移除 extraction 未使用的 `aiohttp` | `extraction/requirements.txt:13`（縮小攻擊面）|
| mapping 全部 `>=` 改固定 `==` 版本 | `mapping/requirements.txt`（可重現建置）|
| 跑 `pip-audit` 確認無已知 CVE，必要時升級至已修補版 | 兩服務 |
| 產生 lock 檔（如 `pip-compile`）| 兩服務（H2：新工具，需確認）|

> ⚠️ **H2 提醒**：依賴版本變更本身在 H2「既有套件 minor/patch 升級」例外內可自行做；但移除 `aiohttp`、新增 lock 工具、major 升級需確認。

### i18n / 資料庫影響
無 i18n 影響（Python 服務無 UI 字串）。無 Prisma schema 變更（mapping 的 `forwarders` 唯讀查詢不變）。

---

## ⚠️ 風險評估

| 風險 | 等級 | 緩解 |
|------|------|------|
| 加 API Key 後 Node 端未同步帶 header → 全鏈路 503/401 中斷 | 高 | Node 端與 Python 端**同批改動 + 同步部署**；fail-closed 前先在所有呼叫端確認帶 header；可先以「監測模式」記錄缺 header 的呼叫 |
| 金鑰存放方案受限（SP 僅 Contributor，不能用 Key Vault / Managed Identity）| 中 | 待確認事項 Q6；過渡用 App Service / 容器 env 注入，記錄為技術債待 KV 到位 |
| `slowapi` 新依賴觸發 H2 | 中 | 優先用既有依賴自訂計數器；或明確 H2 approve |
| 降低 `allow_credentials` 影響現有跨來源呼叫 | 低 | 內部服務間呼叫不依賴 cookie；改 header 認證後無影響 |
| mapping `>=` 改 `==` 鎖到的版本與現行行為差異 | 低 | 鎖定當前實際安裝版本，先 `pip freeze` 對照 |
| 實際拓撲確認後發現「僅私網」→ 本 WP 過度工程 | 低 | 待確認事項先行；縱深防禦仍有價值，但可降優先 |

## 回滾計劃
- API Key dependency 可由移除 `dependencies=[Depends(...)]` 或將 `INTERNAL_API_KEY` 留空 + 改回 fail-open 邏輯回滾（不建議，僅緊急用）。
- CORS / 依賴變更為獨立 commit，可單獨 revert。
- Node 端帶 header 改動與 Python 端為配對 commit，回滾需成對。

---

## 驗收標準

| # | 驗收項目 | 驗收標準 | 優先級 |
|---|----------|----------|--------|
| 1 | 內部 API Key 強制 | 不帶 / 帶錯 `X-Internal-API-Key` 呼叫業務端點 → 401 | High |
| 2 | 合法呼叫放行 | Node 後端帶正確金鑰 → 200，提取 / 映射功能正常 | High |
| 3 | fail-closed | 未配置 `INTERNAL_API_KEY` → 業務端點 503（不放行）| High |
| 4 | health 公開 | `/health` 無金鑰仍可探測 → 200 | High |
| 5 | 速率限制 | 短時間超量呼叫昂貴端點 → 429 | Medium |
| 6 | CORS 收緊 | `allow_credentials=False`、methods/headers 明確列舉、origins 已 trim | Medium |
| 7 | 依賴升級 | extraction 移除 aiohttp；mapping 全 `==`；`pip-audit` 無未修補 High/Critical | Medium |
| 8 | 全鏈路迴歸 | 文件上傳 → OCR → 識別 → 映射 全流程在帶金鑰下正常 | High |
| 9 | 拓撲確認記錄 | 「待確認事項」六題已獲答覆並記錄於本文件實作記錄 | High |

## 測試場景

| # | 場景 | 步驟 | 預期 |
|---|------|------|------|
| 1 | 無金鑰直呼 | 直接 `curl POST :8000/extract/url`（無 header）| 401 |
| 2 | 錯誤金鑰 | 帶錯誤 `X-Internal-API-Key` | 401 |
| 3 | 正確金鑰 | Node 端帶正確金鑰呼叫 | 200 + 正常結果 |
| 4 | 金鑰未配置 | `INTERNAL_API_KEY` 留空啟動 → 呼叫業務端點 | 503 |
| 5 | health 探測 | `curl :8000/health`、`:8001/health` 無金鑰 | 200 |
| 6 | 速率超量 | 連續超過限額呼叫 | 429 |

---

## H1 / H2 約束說明

- **H1（架構改動，需 approve）**：在兩個 Python FastAPI 服務引入服務間認證屬認證架構改動，且 Node 端呼叫鏈需配套修改。**用戶 2026-06-10 暫未 approve，需先確認部署網路拓撲（見待確認事項）後 approve 方可實作。**
- **H2（依賴）**：`slowapi`（速率限制）、`pip-compile`（lock 工具）為新依賴/工具，需 H2 approve；移除 `aiohttp` 與 mapping `>=`→`==` 鎖定屬清理 / minor 範疇但建議併入 approve 一併確認。

---

## 相關文件
- `claudedocs/5-status/security-audit-2026-06-10/SECURITY-ASSESSMENT.md` §5 主題 E（PY-01）、§6 模式 7、§9 python 區域統計（H:2 / M:4 / L:4 / I:3，18 檔）
- `claudedocs/5-status/security-audit-2026-06-10/REMEDIATION-ROADMAP.md` WP-8
- `claudedocs/5-status/security-audit-2026-06-10/reports/python.md`（PY-01 ~ PY-13 完整逐項）
- 配套：CHANGE-077（WP-1 auth fail-open）、CHANGE-078（WP-2 middleware 閘）
- 部署線索：CHANGE-069（ACA 規劃 internal-only）、memory `project_azure_dev_environment.md`（DEV 實際 App Service + 私有端點）
