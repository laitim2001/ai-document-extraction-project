# Docker 服務架構與進階操作

> **建立日期**: 2026-04-22（CHANGE-054）
> **對應檔案**: `docker-compose.yml`（專案根目錄）
> **適用環境**: 本地開發

本文件詳細說明本地 Docker 服務的架構、port 映射、volume 配置，以及常見的進階操作（日誌檢視、容器 shell、備份還原等）。

---

## 🏗️ 服務拓撲圖

```
┌──────────────────────────────────────────────────────────────────┐
│  Host（你的電腦）                                                 │
│                                                                   │
│  Next.js dev server (npm run dev)                                 │
│      │  port 3005                                                 │
│      │                                                            │
│      ├──► localhost:5433 ──┐                                      │
│      ├──► localhost:10010 ─┼─┐                                    │
│      ├──► localhost:8000  ─┼─┼─┐                                  │
│      └──► localhost:8001  ─┼─┼─┼─┐                                │
│                            │ │ │ │                                │
│  ┌─────────────────────────▼─▼─▼─▼─────────────────────────────┐ │
│  │  Docker Network（bridge）                                    │ │
│  │                                                              │ │
│  │  ┌────────────────────────────────────────────┐             │ │
│  │  │ ai-doc-extraction-db  (postgres:15)        │  :5433→5432 │ │
│  │  │   Volume: postgres_data                    │             │ │
│  │  │   Health: pg_isready                       │             │ │
│  │  └────────────────┬───────────────────────────┘             │ │
│  │                   │                                          │ │
│  │  ┌────────────────▼───────────────────────────┐             │ │
│  │  │ ai-doc-extraction-pgadmin  (pgadmin4)      │  :5050→80   │ │
│  │  └────────────────────────────────────────────┘             │ │
│  │                                                              │ │
│  │  ┌────────────────────────────────────────────┐             │ │
│  │  │ ai-doc-extraction-azurite                  │  :10010→10000│ │
│  │  │   Volume: azurite_data                     │  :10011→10001│ │
│  │  └────────────────────────────────────────────┘  :10012→10002│ │
│  │                                                              │ │
│  │  ┌────────────────────────────────────────────┐             │ │
│  │  │ ai-doc-extraction-ocr  (python-services/)  │  :8000      │ │
│  │  │   Build: python-services/extraction/       │             │ │
│  │  └────────────────────────────────────────────┘             │ │
│  │                                                              │ │
│  │  ┌────────────────────────────────────────────┐             │ │
│  │  │ ai-doc-extraction-mapping (python-services)│  :8001      │ │
│  │  │   Build: python-services/mapping/          │             │ │
│  │  └────────────────────────────────────────────┘             │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📦 容器明細

### 1. `ai-doc-extraction-db` — PostgreSQL 15

| 屬性 | 值 |
|------|------|
| Image | `postgres:15-alpine` |
| Port | **5433 → 5432**（⚠️ 常見陷阱） |
| Volume | `postgres_data`（匿名 volume，資料持久化） |
| Health Check | `pg_isready -U postgres` |
| 必要性 | 🔴 缺了應用完全無法啟動 |
| 連線方式 | `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_document_extraction` |

### 2. `ai-doc-extraction-pgadmin` — pgAdmin 4

| 屬性 | 值 |
|------|------|
| Image | `dpage/pgadmin4:latest` |
| Port | **5050 → 80** |
| 必要性 | 🟢 僅為管理 UI，不影響應用 |
| 訪問 | http://localhost:5050 |
| 預設登入 | 由 docker-compose.yml 設定 |

### 3. `ai-doc-extraction-azurite` — Azure Storage 模擬器

| 屬性 | 值 |
|------|------|
| Image | `mcr.microsoft.com/azure-storage/azurite:latest` |
| Port | **10010 → 10000**（Blob）/ **10011 → 10001**（Queue）/ **10012 → 10002**（Table） |
| Volume | `azurite_data` |
| 必要性 | 🟡 文件上傳功能需要 |
| 連線字串 | `.env.example` 中的 `AZURE_STORAGE_CONNECTION_STRING` 已提供（標準開發金鑰，安全） |

### 4. `ai-doc-extraction-ocr` — Python OCR Service

| 屬性 | 值 |
|------|------|
| Build | `python-services/extraction/Dockerfile` |
| Port | **8000 → 8000** |
| 必要性 | 🟡 OCR 功能需要 |
| Health Check | 有（具體路徑見 docker-compose.yml） |
| 依賴 | 需要 `AZURE_DI_ENDPOINT` / `AZURE_DI_KEY` 環境變數 |

### 5. `ai-doc-extraction-mapping` — Python Mapping Service

| 屬性 | 值 |
|------|------|
| Build | `python-services/mapping/Dockerfile` |
| Port | **8001 → 8001** |
| 必要性 | 🟡 三層映射系統需要 |
| Health Check | 有 |

---

## 🎛️ 常用操作

### 生命週期

```bash
docker-compose up -d                 # 啟動所有服務（detached）
docker-compose up -d postgres        # 只啟動 PostgreSQL
docker-compose down                  # 停止並移除容器（保留 volume）
docker-compose down -v               # 停止並移除容器 + volume（⚠️ 資料會遺失）
docker-compose restart db            # 重啟單一服務
docker-compose ps                    # 查看狀態
```

### 日誌

```bash
docker-compose logs -f db            # 跟蹤 db log（tail -f）
docker-compose logs --tail=100 ocr   # 最後 100 行
docker-compose logs -f --since 5m    # 最近 5 分鐘

# 直接 docker 命令
docker logs ai-doc-extraction-db -f
```

### 進入容器

```bash
# PostgreSQL psql
docker exec -it ai-doc-extraction-db psql -U postgres -d ai_document_extraction

# 一般 shell（若容器有 /bin/sh）
docker exec -it ai-doc-extraction-db /bin/sh

# OCR / Mapping 服務 shell
docker exec -it ai-doc-extraction-ocr /bin/sh
```

### 健康檢查

```bash
# PostgreSQL
docker exec ai-doc-extraction-db pg_isready -U postgres

# 從 host 連線測試
nc -zv localhost 5433                 # Unix
Test-NetConnection localhost -Port 5433  # PowerShell
```

---

## 💾 資料備份與還原

### 備份資料庫

```bash
# Dump 整個 database
docker exec ai-doc-extraction-db pg_dump -U postgres ai_document_extraction \
  > backup-$(date +%Y%m%d).sql

# 只 dump schema（用於建立 migration baseline）
docker exec ai-doc-extraction-db pg_dump -U postgres -s ai_document_extraction \
  > schema-$(date +%Y%m%d).sql

# 只 dump 資料（無 schema）
docker exec ai-doc-extraction-db pg_dump -U postgres -a ai_document_extraction \
  > data-$(date +%Y%m%d).sql
```

### 還原資料庫

```bash
# 從 SQL 檔還原
cat backup-20260422.sql | docker exec -i ai-doc-extraction-db \
  psql -U postgres -d ai_document_extraction

# 完全重建（危險）
docker exec ai-doc-extraction-db psql -U postgres -c \
  "DROP DATABASE ai_document_extraction;"
docker exec ai-doc-extraction-db psql -U postgres -c \
  "CREATE DATABASE ai_document_extraction;"
cat backup.sql | docker exec -i ai-doc-extraction-db \
  psql -U postgres -d ai_document_extraction
```

### 備份 Azurite 資料

```bash
# Azurite 將資料存在 volume 中
docker run --rm -v azurite_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/azurite-backup.tar.gz -C /data .

# 還原
docker run --rm -v azurite_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/azurite-backup.tar.gz -C /data
```

---

## 🔍 除錯常見問題

### 問題 1：容器無法啟動

```bash
docker-compose logs <service>           # 看 log 找錯誤
docker-compose ps                       # 看狀態

# 若 status 為 "Exited (X)"，查退出碼
docker inspect ai-doc-extraction-db --format '{{.State.ExitCode}} {{.State.Error}}'
```

### 問題 2：port 5433 被佔用

```bash
# Windows
netstat -ano | findstr :5433 | findstr LISTENING
taskkill /F /PID <PID>

# Unix
lsof -i :5433
kill -9 <PID>

# 或修改 docker-compose.yml 的 port 映射（然後同步改 DATABASE_URL）
```

### 問題 3：Azurite 連線被拒

```bash
# 檢查是否 running
docker-compose ps azurite

# 檢查連線
curl http://localhost:10010/devstoreaccount1

# 查 log
docker-compose logs azurite
```

### 問題 4：DOCKER_HOST 環境變數指向錯誤

**症狀**：`docker ps` 報 `dial tcp [::1]:2375: connection refused`

**原因**：`DOCKER_HOST=tcp://localhost:2375` 是舊式 TCP，Docker Desktop 現在用 named pipe。

**解決**：
```bash
# 臨時（當前 shell）
unset DOCKER_HOST         # Unix / Git Bash
$env:DOCKER_HOST=$null    # PowerShell

# 切換 context
docker context use desktop-linux

# 永久（Windows）：控制台 → 環境變數 → 刪除 DOCKER_HOST
```

### 問題 5：容器間無法互連

```bash
# 檢查 network
docker network ls | grep ai-doc
docker network inspect ai-document-extraction-project_default

# 測試容器間連線
docker exec ai-doc-extraction-mapping \
  curl http://ai-doc-extraction-ocr:8000/health
```

---

## 🧹 清理與維護

```bash
# 清理停止的容器
docker container prune

# 清理無用 image
docker image prune -a

# 清理無用 volume（⚠️ 慎用）
docker volume prune

# 一次清理所有（⚠️ 非常危險）
docker system prune -a --volumes

# 完全重置本項目（⚠️ 會刪除所有本地資料）
docker-compose down -v
docker-compose up -d
npm run init-env    # 重新初始化
```

---

## 📊 資源監控

```bash
docker stats                     # 即時 CPU / 記憶體
docker stats --no-stream         # 單次快照
docker inspect ai-doc-extraction-db | grep -i memory  # 容器資源配置
```

---

## 🔗 相關文件

- 主要指南：[`project-initialization-guide.md`](./project-initialization-guide.md)
- 環境變數：[`environment-variables-reference.md`](./environment-variables-reference.md)
- Docker Compose 設定：專案根目錄 `docker-compose.yml`
- 問題排解：`project-initialization-guide.md` §9
