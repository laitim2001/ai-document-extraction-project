---
document_type: deployment_procedure
step_id: STEP-04
title: Container Build & Push to ACR
estimated_duration: 15-30 minutes
requires_approval: false
approver: none
environment: uat
status: ✅ 完整內容（v1.0 階段 C）
prerequisites:
  - STEP-02 completed（ACR ready）
  - Dockerfile exists at project root（Phase 2 前置產出）
  - .dockerignore exists at project root（Phase 2 前置產出）
  - next.config.ts 已啟用 output: 'standalone'（Phase 2 前置產出）
  - Local Docker daemon running
  - Azure CLI logged in（同 STEP-01）
  - 對 ACR 有 AcrPush role
outputs:
  - image_repository: ${ACR_NAME}.azurecr.io/ai-document-extraction
  - image_tag: <git-sha-short>-uat-<YYYYMMDD-HHMMSS>
  - image_digest: sha256:<digest>
  - image_secondary_tag: uat-latest
---

# STEP-04: Container Build & Push to ACR

> **狀態**：✅ 完整內容（v1.0 階段 C）

## 🎯 Objective

從本地或 CI 環境 build Next.js production image，加上唯一 tag + `uat-latest` 移動 tag，推送到 Azure Container Registry，並把 image digest 寫入 deployment state file。

---

## 🏷️ Image Tagging 策略

| Tag 類型 | 範例 | 用途 | 不變？ |
|---------|------|------|------|
| **唯一 tag** | `acraidocextractuat.azurecr.io/ai-document-extraction:a1b2c3d-uat-20260513-093000` | 部署 / Rollback / Audit 唯一識別 | ✅ Immutable（推送後不覆蓋） |
| **移動 tag** | `acraidocextractuat.azurecr.io/ai-document-extraction:uat-latest` | 方便 dev 拉最新 image | ❌ 每次 build 移動 |
| ❌ **禁止** | `:latest` | 不允許使用，無環境前綴會混淆 | — |

> **唯一 tag 格式**：`<git-sha-short>-uat-<YYYYMMDD-HHMMSS>`
> - `git-sha-short`：`git rev-parse --short HEAD` 7 字元
> - 時間戳：避免同 commit 重 build 衝突
> - 環境前綴 `uat`：跨環境一眼可識

---

## 🔧 Environment Variables（增補 STEP-00 §5）

```bash
export IMAGE_REPO="ai-document-extraction"
export GIT_SHA="$(git rev-parse --short HEAD)"
export BUILD_TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
export IMAGE_TAG="${GIT_SHA}-uat-${BUILD_TIMESTAMP}"
export IMAGE_FULL="${ACR_NAME}.azurecr.io/${IMAGE_REPO}:${IMAGE_TAG}"
export IMAGE_LATEST="${ACR_NAME}.azurecr.io/${IMAGE_REPO}:uat-latest"
```

---

## 📋 Actions

### Action 4.1: 驗證 Dockerfile multi-stage 結構

**Command**：
```bash
test -f Dockerfile || { echo "❌ Dockerfile 不存在"; exit 1; }
FROM_COUNT=$(grep -c "^FROM" Dockerfile)
grep -E "^FROM (node:20-alpine|node:22-alpine)" Dockerfile
grep -E "^USER " Dockerfile
grep -i "HEALTHCHECK" Dockerfile || true
```

**Verify**：
- `FROM_COUNT >= 3`（deps / builder / runner 三階段）
- 至少一個 base image 是 `node:20-alpine` 或更新版本
- 有 `USER nextjs`（或類似非 root user）出現在 runner 階段
- `HEALTHCHECK` 或 Container App health probe（任一即可，Container App 端可後補）

**Expected Output**：
```
FROM_COUNT >= 3
FROM node:20-alpine AS deps
FROM node:20-alpine AS builder
FROM node:20-alpine AS runner
USER nextjs
```

**If Fails**：
- Dockerfile 不存在 → 該檔由 Phase 2 STEP-04 前置任務產出，請先完成 Dockerfile 撰寫
- 只有 1-2 個 FROM → 重構為 multi-stage（deps 拉依賴 / builder 編譯 / runner 最小執行環境）
- 用 `node:20`（非 alpine） → 改 `node:20-alpine` 縮小 image
- 缺 `USER nextjs` → runner 階段必須切非 root，安全要求
- 完整 Dockerfile 範本參考 Phase 2 deliverable

---

### Action 4.2: 驗證 next.config.ts 已啟用 standalone

**Command**：
```bash
grep -E "output:\s*['\"]standalone['\"]" next.config.ts
```

**Verify**：grep exit code 為 0，且輸出包含 `output: 'standalone'`

**Expected Output**：
```
  output: 'standalone',
```

**If Fails**（目前實際狀態：未啟用）：
1. 編輯 `next.config.ts`，在 `nextConfig` 物件中加入：
   ```typescript
   const nextConfig: NextConfig = {
     output: 'standalone',  // 新增此行
     reactStrictMode: true,
     // ... 其他配置
   }
   ```
2. 本地驗證 build：
   ```bash
   npm run build
   ls -la .next/standalone/server.js
   ```
3. 確認 `.next/standalone/` 目錄產生後再進入 Action 4.3
4. 此修改屬於 Phase 2 前置任務，建議獨立 commit（不在 STEP-04 執行）

---

### Action 4.3: Build image locally

**Command**：
```bash
docker build \
  --platform linux/amd64 \
  --pull \
  -t ${IMAGE_FULL} \
  -t ${IMAGE_LATEST} \
  --build-arg NODE_ENV=production \
  --progress=plain \
  .
```

**Verify**：
```bash
docker images ${ACR_NAME}.azurecr.io/${IMAGE_REPO} --format "{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
IMAGE_SIZE_MB=$(docker image inspect ${IMAGE_FULL} --format='{{.Size}}' | awk '{printf "%.0f", $1/1024/1024}')
echo "Image size: ${IMAGE_SIZE_MB} MB"
[[ ${IMAGE_SIZE_MB} -lt 500 ]] || echo "⚠️ Image > 500 MB，請參考優化建議"
```

**Expected Output**：
```
a1b2c3d-uat-20260513-093000   320MB   2026-05-13 09:35:00
uat-latest                    320MB   2026-05-13 09:35:00
Image size: 320 MB
```

**Build 預估時間**：5-10 分鐘（含 `npm ci` + `prisma generate` + `next build`）

**If Fails**：
- `--platform linux/amd64` 在 Apple Silicon 上必加（Container Apps 跑 amd64）
- npm ci 失敗 → 檢查 package-lock.json 是否同步
- prisma generate 失敗 → 確認 schema.prisma 在 build context 內，且 `.dockerignore` 沒排除 `prisma/`
- next build 失敗 → 在本地先 `npm run build` 排除錯誤
- Image size > 500 MB → 見下方「Image Size 優化建議」

---

### Action 4.4: ACR Login

**Command**：
```bash
az acr login --name ${ACR_NAME}
```

**Verify**：
```bash
cat ~/.docker/config.json | jq -r '.auths | keys[]' | grep "${ACR_NAME}.azurecr.io"
```

**Expected Output**：
```
Login Succeeded
acraidocextractuat.azurecr.io
```

**If Fails**：
- `Error: 401 Unauthorized` → 帳戶缺 `AcrPush` role：
  ```bash
  USER_ID=$(az ad signed-in-user show --query id -o tsv)
  ACR_ID=$(az acr show --name ${ACR_NAME} --query id -o tsv)
  az role assignment create --assignee ${USER_ID} --role AcrPush --scope ${ACR_ID}
  ```
- `subscription mismatch` → `az account set --subscription ${SUBSCRIPTION_ID}` 後重試
- `credential cache 過期` → `az logout && az login` 重新登入後再 `az acr login`
- Docker daemon 未啟動 → 啟動 Docker Desktop / `sudo systemctl start docker`

---

### Action 4.5: Push image to ACR

**Command**：
```bash
docker push ${IMAGE_FULL}
docker push ${IMAGE_LATEST}
```

**Verify**：兩個 push 命令都需 exit code 0，最後一行印出 digest

**Expected Output**：
```
The push refers to repository [acraidocextractuat.azurecr.io/ai-document-extraction]
...
a1b2c3d-uat-20260513-093000: digest: sha256:8f3e... size: 2840
uat-latest: digest: sha256:8f3e... size: 2840
```

**Push 預估時間**：3-5 分鐘（視網路頻寬，~150 MB layer 上傳）

**If Push 速度慢（> 10 分鐘）**：
- VPN / Proxy 限速 → 暫時關 VPN 或改用辦公網路
- ACR region 與本機距離遠 → 確認 ACR 在 `southeastasia`，本機在亞太
- 多層大 layer 一起推 → 改用 BuildKit 的 `--cache-from` 善用 layer cache
- Docker 限制頻寬 → Docker Desktop → Resources → Network 確認沒設限制
- ACR SKU 是 Basic（10 MB/s 限制） → 升級到 Standard（25 MB/s）— 詳見 Action 4.4 of STEP-02

**If Fails**：
- `denied: requested access to the resource is denied` → 重跑 Action 4.4 ACR login
- `unknown blob` / push 中斷 → 重試 push 命令（Docker 會 resume layer）
- `quota exceeded` → ACR 容量滿，到 Azure Portal 看 ACR usage 並清理舊 tag

---

### Action 4.6: 驗證 image 在 ACR 可見

**Command**：
```bash
# 列出該 repo 的所有 tags
az acr repository show-tags \
  --name ${ACR_NAME} \
  --repository ${IMAGE_REPO} \
  --orderby time_desc \
  --output tsv

# 取得唯一 tag 的 manifest digest
IMAGE_DIGEST=$(az acr repository show \
  --name ${ACR_NAME} \
  --image ${IMAGE_REPO}:${IMAGE_TAG} \
  --query "digest" -o tsv)
echo "Digest: ${IMAGE_DIGEST}"

# 取得 manifest size（合理範圍：100-300 MB）
MANIFEST_SIZE_MB=$(az acr manifest show-metadata \
  --registry ${ACR_NAME} \
  --name ${IMAGE_REPO}:${IMAGE_TAG} \
  --query "imageSize" -o tsv | awk '{printf "%.0f", $1/1024/1024}')
echo "Manifest size: ${MANIFEST_SIZE_MB} MB"
```

**Expected Output**：
```
a1b2c3d-uat-20260513-093000
uat-latest
Digest: sha256:8f3e9c2a1b4d...
Manifest size: 145 MB
```

**Verify**：
- `${IMAGE_TAG}` 與 `uat-latest` 都出現在 tags 列表
- digest 為 `sha256:...` 開頭的 64 字元 hex
- Manifest size 在 100-300 MB 區間（壓縮後）

**If Fails**：
- Tag 列表缺 `${IMAGE_TAG}` → push 沒成功，回 Action 4.5
- digest 取不到 → 確認 `${IMAGE_TAG}` 寫對（區分大小寫）

---

### Action 4.7: 寫入 deployment state file

**Command**：
```bash
yq -i ".resources.image = {
  \"repository\": \"${ACR_NAME}.azurecr.io/${IMAGE_REPO}\",
  \"tag\": \"${IMAGE_TAG}\",
  \"digest\": \"${IMAGE_DIGEST}\",
  \"latest_tag\": \"uat-latest\",
  \"pushed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"size_mb\": ${MANIFEST_SIZE_MB}
}" ${DEPLOYMENT_STATE_FILE}

yq -i ".steps_completed += [{
  \"step_id\": \"STEP-04\",
  \"completed_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"status\": \"success\"
}]" ${DEPLOYMENT_STATE_FILE}

yq -i ".next_step = \"STEP-05\"" ${DEPLOYMENT_STATE_FILE}
```

**Verify**：
```bash
yq '.resources.image' ${DEPLOYMENT_STATE_FILE}
yq '.next_step' ${DEPLOYMENT_STATE_FILE}
```

**Expected Output**：
```yaml
repository: acraidocextractuat.azurecr.io/ai-document-extraction
tag: a1b2c3d-uat-20260513-093000
digest: sha256:8f3e9c2a1b4d...
latest_tag: uat-latest
pushed_at: 2026-05-13T09:42:15Z
size_mb: 145
```
```
STEP-05
```

**If Fails**：
- `yq: command not found` → 安裝 yq（`brew install yq` / `winget install MikeFarah.yq`）
- state file 不存在 → 從 STEP-01 開始建立

---

## 📦 Image Size 優化建議

若 image > 500 MB，依序檢查：

| 優化項 | 預期縮減 | 操作 |
|--------|---------|------|
| **多階段 build**（已要求） | 50-70% | runner 只 COPY `.next/standalone` + `.next/static` + `public` |
| **`output: 'standalone'`**（已要求） | 30-40% | 自動排除 dev dependencies |
| **`.dockerignore`** | 10-30% | 排除 `node_modules`、`.next`（builder 內重 build）、`docs/`、`tests/`、`*.md`、`.git/` |
| **base image alpine** | 200-300 MB | 用 `node:20-alpine` 而非 `node:20` |
| **production deps only** | 100-200 MB | runner 階段 `npm ci --omit=dev` |
| **清 npm cache** | 30-50 MB | `npm ci --omit=dev && npm cache clean --force` |
| **清 Prisma engine 多餘 binary** | 20-50 MB | `binaryTargets` 只留 `linux-musl-openssl-3.0.x` |

---

## 🔄 GitHub Actions 替代路徑（Phase 3 預告）

> 此節為**未來 Phase 3** 預告，UAT 階段 C 不執行。

UAT 進入 Phase 3 後，本 STEP 將由 GitHub Actions 自動化：

```yaml
# .github/workflows/uat-deploy.yml（Phase 3 產出）
name: UAT Deploy
on:
  push:
    branches: [main]
jobs:
  build-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}     # OIDC federated identity
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - run: az acr login --name ${{ vars.ACR_NAME }}
      - run: |
          IMAGE_TAG="${GITHUB_SHA::7}-uat-$(date -u +%Y%m%d-%H%M%S)"
          docker build --platform linux/amd64 \
            -t ${{ vars.ACR_NAME }}.azurecr.io/ai-document-extraction:${IMAGE_TAG} \
            -t ${{ vars.ACR_NAME }}.azurecr.io/ai-document-extraction:uat-latest .
          docker push ${{ vars.ACR_NAME }}.azurecr.io/ai-document-extraction:${IMAGE_TAG}
          docker push ${{ vars.ACR_NAME }}.azurecr.io/ai-document-extraction:uat-latest
```

**Phase 3 重點**：OIDC federated identity（無需 secret）、PR build 驗證、自動 trigger STEP-08。

---

## ✅ Exit Criteria

- [ ] Dockerfile multi-stage 驗證通過（FROM >=3、alpine、非 root user）
- [ ] `next.config.ts` 已啟用 `output: 'standalone'`
- [ ] Image 成功 build，size < 500 MB
- [ ] Image 成功推送到 ACR（唯一 tag + `uat-latest` 兩個 tag）
- [ ] `az acr repository show-tags` 可見兩個 tags
- [ ] image digest 已記錄
- [ ] `deployment-state/uat.yaml` 已寫入 `resources.image`、`steps_completed[STEP-04]`、`next_step: STEP-05`
- [ ] 進入 STEP-05（Database Migration）

---

*文件版本: v1.0（階段 C 完成）*
*最後更新: 2026-04-27*
*維護者: AI 助手 + 開發團隊*
