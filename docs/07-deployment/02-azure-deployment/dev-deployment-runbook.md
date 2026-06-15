# Azure DEV 部署 Runbook — 實戰問題與解法

> **建立日期**: 2026-06-15
> **狀態**: ✅ DEV 環境已成功上線(首次)
> **適用**: Azure DEV 環境(App Service for Containers,**非**規劃文件假設的 Container Apps)
> **相關**: [`CHANGE-055`](../../../claudedocs/4-changes/feature-changes/CHANGE-055-azure-deployment-foundation.md)、[`local-vs-azure-differences.md`](../local-vs-azure-differences.md)、[`11-troubleshooting.md`](./uat-deployment/11-troubleshooting.md)(後者為規劃架構,部分不適用)

---

## 0. 一句話總結

DEV 首次部署時,容器啟動**無限重啟、對外回 HTTP 503**。根因是 **VNet 自訂 DNS 連不到,導致容器解析不到私有 PostgreSQL**;以 App Service 設定 `WEBSITE_DNS_SERVER=168.63.129.16`(改用 Azure 平台 DNS)**暫時繞過**後成功上線。另有「公司內網 DNS 解析不到公開網址」「登入錯誤訊息誤導」兩個獨立議題。

---

## 1. 最終成功狀態(基準)

| 項目 | 值 |
|------|-----|
| 健康檢查 | `GET /api/health` → `200` `{"status":"healthy","services":{"database":"connected"}}` |
| Schema | bootstrap 套用 `init.sql` → **122 表** |
| 管理員 | `admin@rci-t.com`(seed 建立,ACTIVE / globalAdmin / emailVerified) |
| 公開網址 | `https://webapp-raposcm-aidocprocessing-dev-f8dua6b5eqerbrbk.eastasia-01.azurewebsites.net` |
| 自訂網域 | `https://raposcm-aidocprocessing-dev.rci-t.com` |
| 公開 IP | `13.75.34.162` |
| 容器映像 | `acrscmdocprocessingdev.azurecr.io/ai-document-extraction:dev` |

登入帳密:email = `admin@rci-t.com`(全小寫;seed 會 `.toLowerCase().trim()`);密碼 = `SEED_ADMIN_PASSWORD` 的值(在 `.env.azure-dev.local`,**不入 git**)。

---

## 2. 問題 1(主阻塞):容器無限重啟 → HTTP 503

### 症狀
- 外部訪問回 `503 Application Error`,`/api/health` 等數十秒才回 503。
- 容器日誌 `*_default_docker.log` 反覆出現:
  ```
  [entrypoint] Step 1/3: bootstrap database schema (if needed)
  [bootstrap] FAILED: timeout expired      ← 約 30 秒後
  Container has finished running with exit code: 1
  ```
- 平台層日誌:`Site startup probe failed` / `ContainerTimeout`。

### 根因(逐層確認)
1. `prisma/bootstrap-db.js` 用 `pg` 連線,`connectionTimeoutMillis: 30000` → 「timeout expired」就是這 30 秒**連線逾時**。
2. VNet 整合本身**正常**(整合到 `RG-RCITest-HKG-Infra` 的 `vnet-rcitest-hkg` / `Subnet-RCITest-D-WebApp-DEV`,`vnetRouteAllEnabled: true`)。
3. 容器內實測:`nslookup pgsql-...postgres.database.azure.com` → **`connection timed out; no servers could be reached`**。`/etc/resolv.conf` 顯示容器 DNS 伺服器是 VNet 配置的 **`10.160.65.4`**,但這台 DNS **從 WebApp 子網路連不到** → PG 主機名稱解析不出來 → 連線逾時。
4. 結論:**不是 DB 權限問題、不是程式問題,是網路/DNS 設定問題**(網路資源在 infra RG,app 部署身分無權限檢視/修改)。

---

## 3. 解法(暫時繞法,已套用)

在 App Service 應用程式設定加:

```
WEBSITE_DNS_SERVER = 168.63.129.16
```

(`168.63.129.16` 是 Azure 平台 DNS,VNet 內必達。)

套用後容器內實測:
- `nslookup ... 168.63.129.16` → 解析到私有端點 IP **`10.160.68.56`**(代表 `privatelink.postgres.database.azure.com` 私有 DNS 區域其實**已**連到 VNet)。
- `curl -v telnet://10.160.68.56:5432` → **`Connected`**(TCP 通)。
- 下一次容器啟動 → bootstrap 連上 DB → 建 122 表 → seed → Next.js Ready。

> ⚠️ **這是暫時繞法,不是正解。改動前請勿移除此設定。**

---

## 4. 問題 2:平台「重啟退避」會延遲修復生效

容器反覆崩潰後,App Service 進入**退避**,自然重試間隔拉長到**約 35 分鐘**(實測 04:33 → 05:08 → 05:43 → 06:17)。

實測 **`az webapp restart`、`stop`+`start`、改 appsetting、`az webapp config container set` 都無法強制立即重啟**——套了修復後,常需**等下一次自然重試**才生效。別誤判「修復沒用」。

---

## 5. 問題 3:公司內網 DNS 解析不到 app 公開網址

### 症狀
公司網路內的瀏覽器打不開 app 網址(兩個網址都一樣)。

### 根因
公司 DNS `10.160.50.4` 對 app 公開網址**回傳空(無 A 紀錄)**;公用 DNS(8.8.8.8 / 1.1.1.1)則正常解析到公開 IP `13.75.34.162`。即 app 公網可達,但**內網解析不到**。

### 暫時繞法
- 手機行動網路(走公用 DNS)直接開,或
- 編輯 hosts(`C:\Windows\System32\drivers\etc\hosts`,需系統管理員)加:
  ```
  13.75.34.162  webapp-raposcm-aidocprocessing-dev-f8dua6b5eqerbrbk.eastasia-01.azurewebsites.net
  ```
  (用預設 `azurewebsites.net` 網址,憑證一定對;`rci-t.com` 自訂網域憑證未必綁好。)

### 正解(待 infra)
讓內網 DNS `10.160.50.4` 能解析此 app 網址(回公開 IP,或建好私有端點 + 內部 DNS 紀錄 + 內網可路由到該私有 IP)。

---

## 6. 問題 4:登入「An unknown error occurred」其實是帳密錯誤

### 症狀
登入頁顯示「An unknown error occurred. Please try again later.」

### 真相
這是前端對 Auth.js **`CredentialsSignin`** 的通用訊息 = **email 或密碼不符**,**非系統錯誤**。容器日誌:
```
[Auth] Production mode - verifying credentials
[Auth] Credential check failed
[auth][error] CredentialsSignin
```
(`AUTH_URL` / `AUTH_SECRET` / `AUTH_TRUST_HOST` 設定皆正確;帳號本身 ACTIVE。)

### 解法
- Email:`admin@rci-t.com`(全小寫;**勿用**本地的 `admin@ai-document-extraction.com`)。
- 密碼:`.env.azure-dev.local` 的 `SEED_ADMIN_PASSWORD`(14 字元,**不會 trim**)→ 注意前後空格、手機鍵盤自動大寫、特殊符號。
- 若密碼遺失:更新 `SEED_ADMIN_PASSWORD` 設定 → 重跑 seed(idempotent upsert)→ 受退避影響需等重啟生效。

---

## 7. 診斷技巧(本次用到,可重複使用)

對外封閉 / 私網後 / 本機 DNS 又攔截解析時:

| 需求 | 做法 |
|------|------|
| 連對外封閉的 app/SCM | `nslookup <host> 8.8.8.8` 取公開 IP,再 `curl --resolve <host>:443:<IP> https://<host>/...` |
| 抓容器 docker log(SCM basic auth 被停 → 401) | 用 AAD bearer:`TOK=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)`;`curl -H "Authorization: Bearer $TOK" https://<scm>/api/logs/docker`(列檔)→ `.../api/vfs/LogFiles/<file>`(抓內容)。app stdout 在 `*_default_docker.log` |
| 容器內測 DNS/TCP | Kudu `POST https://<scm>/api/command`(帶 Bearer),`{"command":"nslookup <host>","dir":"/home"}`。**不走完整 shell**(無 `&&`/`;`/`/dev/tcp`),一次一指令;TCP 用 `curl -v -m 8 telnet://<host>:<port>` |
| Git Bash 路徑陷阱 | az 帶 `/subscriptions/...` resource ID 時加 `export MSYS_NO_PATHCONV=1`,或改用 `-g/-n` |

`<scm>` = `webapp-raposcm-aidocprocessing-dev-f8dua6b5eqerbrbk.scm.eastasia-01.azurewebsites.net`

---

## 8. 待 infra 的正解 vs 目前的暫時繞法(交接清單)

| # | 議題 | 目前暫時繞法 | 正解(infra) |
|---|------|------------|--------------|
| 1 | 容器連不到私有 PG(VNet DNS) | App Service 設 `WEBSITE_DNS_SERVER=168.63.129.16` | 修好自訂 DNS `10.160.65.4` 從 WebApp 子網路的可達性,或正式確認改用 Azure DNS |
| 2 | 公司內網解析不到 app 網址 | hosts / 手機行動網路 | 內網 DNS `10.160.50.4` 能解析此網址(公開 IP 或私有端點 + 內部紀錄) |
| 3 | 對外存取暫時開啟 | infra 已暫時把 `publicNetworkAccess` 設 `Enabled` | 決定最終是否關回 `Disabled`,並約定驗收訪問路徑 |

---

## 9. 非阻塞問題(後續 FIX 候選)

容器日誌出現(不影響啟動):
```
Warning: Cannot load "@napi-rs/canvas" package ... pdf-to-img/pdfjs-dist
Warning: Cannot polyfill `DOMMatrix` / `ImageData` / `Path2D`
```
影響:PDF 轉圖/預覽渲染品質可能受限。建議列為後續 FIX(映像補 `@napi-rs/canvas` 或對應 native 依賴)。

---

*維護者: AI 助手 + 開發團隊*
*最後更新: 2026-06-15*
