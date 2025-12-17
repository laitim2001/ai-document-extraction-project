# Tech Spec: Story 12-5 - Data Backup Management (數據備份管理)

## 1. Overview

### 1.1 Story Information
- **Story ID**: 12-5
- **Epic**: Epic 12 - 系統管理與監控
- **Priority**: Critical
- **Estimated Points**: 13
- **FR Coverage**: FR63

### 1.2 User Story
**As a** 系統管理員,
**I want** 管理系統數據備份,
**So that** 確保數據安全並可在需要時恢復。

### 1.3 Scope
本 Tech Spec 涵蓋完整的數據備份管理系統，包括：
- 備份狀態監控與儀表板
- 手動與排程備份執行
- 多種備份類型支援（完整/增量/差異）
- 多種備份來源（數據庫/文件/配置/完整系統）
- Azure Blob Storage 雲端儲存整合
- AES-256-CBC 加密保護
- 備份保留策略與自動清理
- 儲存空間使用監控

---

## 2. Technical Architecture

### 2.1 System Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKUP MANAGEMENT SYSTEM                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    PRESENTATION LAYER                            │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────────┐  │   │
│  │  │ BackupManagement│ │  StatusCard     │ │   ScheduleModal   │  │   │
│  │  │   Component     │ │  Components     │ │    Component      │  │   │
│  │  │                 │ │                 │ │                   │  │   │
│  │  │ • Status Overview│ │ • Auto Backup  │ │ • Cron Builder   │  │   │
│  │  │ • Backup List   │ │ • Last Backup  │ │ • Retention Rules │  │   │
│  │  │ • Schedule Mgmt │ │ • Storage Usage│ │ • Source Select   │  │   │
│  │  └────────┬────────┘ └────────┬────────┘ └────────┬──────────┘  │   │
│  └───────────┼───────────────────┼───────────────────┼──────────────┘   │
│              │                   │                   │                  │
│  ┌───────────▼───────────────────▼───────────────────▼──────────────┐   │
│  │                        API LAYER                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │                  /api/admin/backup/*                         │ │   │
│  │  │  GET  /          - List backups with pagination              │ │   │
│  │  │  POST /          - Create manual backup                      │ │   │
│  │  │  GET  /:id       - Get backup details                        │ │   │
│  │  │  DELETE /:id     - Delete backup                             │ │   │
│  │  │  GET  /status    - Get backup status overview                │ │   │
│  │  │  GET  /schedule  - List schedules                            │ │   │
│  │  │  POST /schedule  - Create schedule                           │ │   │
│  │  │  PATCH /schedule/:id - Update schedule                       │ │   │
│  │  │  DELETE /schedule/:id - Delete schedule                      │ │   │
│  │  │  GET  /:id/download - Download backup file                   │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────▼────────────────────────────────┐   │
│  │                      SERVICE LAYER                                │   │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────┐   │   │
│  │  │    BackupService        │  │  BackupSchedulerService     │   │   │
│  │  │                         │  │                             │   │   │
│  │  │  • createBackup()      │  │  • initialize()             │   │   │
│  │  │  • executeBackup()     │  │  • addSchedule()            │   │   │
│  │  │  • backupDatabase()    │  │  • removeSchedule()         │   │   │
│  │  │  • backupFiles()       │  │  • executeScheduledBackup() │   │   │
│  │  │  • backupConfig()      │  │  • enforceRetentionPolicy() │   │   │
│  │  │  • createArchive()     │  │  • updateNextRunTime()      │   │   │
│  │  │  • uploadToBlob()      │  │  • CRUD operations          │   │   │
│  │  │  • listBackups()       │  │                             │   │   │
│  │  │  • deleteBackup()      │  └─────────────────────────────┘   │   │
│  │  │  • getStorageUsage()   │                                     │   │
│  │  └─────────────────────────┘                                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────▼────────────────────────────────┐   │
│  │                    DATA ACCESS LAYER                              │   │
│  │  ┌───────────────────────────────────────────────────────────┐   │   │
│  │  │                    Prisma ORM                              │   │   │
│  │  │  ┌──────────┐  ┌────────────────┐  ┌────────────────────┐ │   │   │
│  │  │  │  Backup  │  │ BackupSchedule │  │ BackupStorageUsage │ │   │   │
│  │  │  └──────────┘  └────────────────┘  └────────────────────┘ │   │   │
│  │  │  ┌──────────────────┐  ┌─────────────────────────────────┐│   │   │
│  │  │  │   BackupConfig   │  │         RestoreRecord          ││   │   │
│  │  │  └──────────────────┘  └─────────────────────────────────┘│   │   │
│  │  └───────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────▼────────────────────────────────┐   │
│  │                   EXTERNAL SERVICES                               │   │
│  │  ┌───────────────┐  ┌───────────────────┐  ┌──────────────────┐  │   │
│  │  │  PostgreSQL   │  │  Azure Blob      │  │   node-cron      │  │   │
│  │  │  (pg_dump)    │  │  Storage         │  │   Scheduler      │  │   │
│  │  │               │  │                  │  │                  │  │   │
│  │  │ • Full backup │  │ • Encrypted blob │  │ • Cron parsing  │  │   │
│  │  │ • Incremental │  │ • Stream upload  │  │ • Job execution │  │   │
│  │  │ • Custom fmt  │  │ • Multi-part     │  │ • Timezone aware│  │   │
│  │  └───────────────┘  └───────────────────┘  └──────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Backup Execution Flow
```
┌─────────────────────────────────────────────────────────────────────────┐
│                       BACKUP EXECUTION PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│   │   TRIGGER   │───▶│   CREATE    │───▶│   EXECUTE   │                 │
│   │             │    │   RECORD    │    │   BACKUP    │                 │
│   │ • Manual    │    │             │    │             │                 │
│   │ • Scheduled │    │ Status:     │    │ Progress:   │                 │
│   │ • Pre-restore│   │ PENDING     │    │ IN_PROGRESS │                 │
│   └─────────────┘    └─────────────┘    └──────┬──────┘                 │
│                                                 │                        │
│                    ┌────────────────────────────┼─────────────────────┐ │
│                    ▼                            ▼                     ▼ │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────┐  │
│   │   BACKUP DATABASE   │  │   BACKUP FILES      │  │ BACKUP CONFIG │  │
│   │   (10% - 40%)       │  │   (40% - 70%)       │  │ (70% - 80%)   │  │
│   │                     │  │                     │  │               │  │
│   │ • pg_dump execution │  │ • tar compression   │  │ • Export JSON │  │
│   │ • Custom format     │  │ • Upload directory  │  │ • Safe configs│  │
│   │ • Table statistics  │  │ • File count        │  │ • Env vars    │  │
│   └──────────┬──────────┘  └──────────┬──────────┘  └───────┬───────┘  │
│              └─────────────────────────┴────────────────────┘          │
│                                        │                                │
│                                        ▼                                │
│               ┌────────────────────────────────────────┐               │
│               │         CREATE ARCHIVE (80%)           │               │
│               │                                        │               │
│               │   • tar -czf (compress all content)    │               │
│               │   • AES-256-CBC encryption             │               │
│               │   • IV prepended to file               │               │
│               │   • scrypt key derivation              │               │
│               └───────────────────┬────────────────────┘               │
│                                   │                                     │
│                                   ▼                                     │
│               ┌────────────────────────────────────────┐               │
│               │      UPLOAD TO AZURE BLOB (90%)        │               │
│               │                                        │               │
│               │   • Stream upload (4MB chunks)         │               │
│               │   • 20 concurrent connections          │               │
│               │   • Path: YYYY/MM-DD/backupId.enc      │               │
│               └───────────────────┬────────────────────┘               │
│                                   │                                     │
│                                   ▼                                     │
│               ┌────────────────────────────────────────┐               │
│               │         FINALIZE (100%)                 │               │
│               │                                        │               │
│               │   • Calculate SHA-256 checksum         │               │
│               │   • Update backup record               │               │
│               │   • Set expiration date                │               │
│               │   • Cleanup temp files                 │               │
│               │   • Enforce retention policy           │               │
│               │   • Send notification                  │               │
│               └────────────────────────────────────────┘               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Component Hierarchy
```
BackupManagement (主容器)
├── StatusCard (狀態卡片)
│   ├── AutoBackupStatus
│   ├── LastBackupInfo
│   ├── StorageUsageDisplay
│   └── NextScheduledBackup
├── ActionButtons
│   ├── FullBackupButton
│   ├── DatabaseOnlyButton
│   └── ManageScheduleButton
├── TabNavigation
│   ├── BackupsTab
│   └── SchedulesTab
├── BackupListTable
│   ├── BackupRow
│   │   ├── BackupName
│   │   ├── TypeBadge
│   │   ├── SourceBadge
│   │   ├── StatusBadge (with progress)
│   │   ├── SizeDisplay
│   │   ├── TimeDisplay
│   │   └── ActionButtons (Download/Delete)
│   └── Pagination
├── ScheduleList
│   └── ScheduleCard
│       ├── ScheduleInfo
│       ├── CronDisplay
│       ├── RetentionInfo
│       └── ToggleButton
└── ScheduleModal
    ├── NameInput
    ├── TypeSelector
    ├── SourceSelector
    ├── CronExpressionInput
    ├── RetentionSettings
    └── ActionButtons
```

---

## 3. Data Models

### 3.1 Prisma Schema

```prisma
// ============================================================
// BACKUP MANAGEMENT MODELS
// ============================================================

// 備份類型
enum BackupType {
  FULL          // 完整備份 - 所有數據
  INCREMENTAL   // 增量備份 - 僅變更數據
  DIFFERENTIAL  // 差異備份 - 與上次完整備份的差異
}

// 備份狀態
enum BackupStatus {
  PENDING       // 等待執行
  IN_PROGRESS   // 執行中
  COMPLETED     // 完成
  FAILED        // 失敗
  CANCELLED     // 已取消
}

// 備份來源類型
enum BackupSource {
  DATABASE      // 數據庫
  FILES         // 上傳文件
  CONFIG        // 系統配置
  FULL_SYSTEM   // 完整系統 (含所有來源)
}

// 備份觸發方式
enum BackupTrigger {
  SCHEDULED     // 排程觸發
  MANUAL        // 手動觸發
  PRE_RESTORE   // 恢復前自動備份
}

// ============================================================
// 備份記錄 - 主要備份紀錄表
// ============================================================
model Backup {
  id              String        @id @default(cuid())

  // 備份基本資訊
  name            String        // 備份名稱 (自動生成)
  description     String?       // 備份描述
  type            BackupType    // 備份類型
  source          BackupSource  // 備份來源
  trigger         BackupTrigger // 觸發方式

  // 執行狀態
  status          BackupStatus  @default(PENDING)
  progress        Int           @default(0)       // 進度百分比 0-100
  errorMessage    String?       // 錯誤訊息 (若失敗)

  // 儲存資訊
  storagePath     String?       // Azure Blob 路徑
  sizeBytes       BigInt?       // 備份大小 (bytes)
  checksum        String?       // SHA-256 校驗碼

  // 備份內容詳情 (JSON)
  // {
  //   database: { sizeBytes, tables: [], rowCount },
  //   files: { sizeBytes, fileCount },
  //   config: { sizeBytes, configCount }
  // }
  contents        Json?

  // 時間戳記
  startedAt       DateTime?     // 開始時間
  completedAt     DateTime?     // 完成時間
  expiresAt       DateTime?     // 過期時間 (依保留策略)

  // 審計資訊
  createdAt       DateTime      @default(now())
  createdBy       String?
  createdByUser   User?         @relation(fields: [createdBy], references: [id])

  // 關聯排程 (若由排程觸發)
  scheduleId      String?
  schedule        BackupSchedule? @relation(fields: [scheduleId], references: [id])

  // 恢復記錄
  restores        RestoreRecord[]

  @@index([status, createdAt])
  @@index([type, source])
  @@index([expiresAt])
  @@index([scheduleId])
  @@map("backups")
}

// ============================================================
// 備份排程 - 自動備份排程設定
// ============================================================
model BackupSchedule {
  id              String        @id @default(cuid())

  // 排程基本資訊
  name            String        // 排程名稱
  description     String?       // 排程描述
  isEnabled       Boolean       @default(true) // 是否啟用

  // 備份設定
  backupType      BackupType    // 備份類型
  backupSource    BackupSource  // 備份來源

  // 排程設定 (Cron 表達式)
  // 格式: 分 時 日 月 週
  // 例如: "0 2 * * *" = 每天凌晨 2:00
  // 例如: "0 3 * * 0" = 每週日凌晨 3:00
  cronExpression  String
  timezone        String        @default("Asia/Taipei")

  // 保留策略
  retentionDays   Int           @default(30)  // 保留天數
  maxBackups      Int           @default(10)  // 最大備份數量

  // 執行時間
  nextRunAt       DateTime?     // 下次執行時間
  lastRunAt       DateTime?     // 上次執行時間

  // 審計資訊
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  createdBy       String?
  createdByUser   User?         @relation(fields: [createdBy], references: [id])

  // 關聯備份
  backups         Backup[]

  @@index([isEnabled, nextRunAt])
  @@map("backup_schedules")
}

// ============================================================
// 備份配置 - 全域備份設定
// ============================================================
model BackupConfig {
  id                      String    @id @default(cuid())
  key                     String    @unique @default("default")

  // Azure Blob Storage 設定
  storageConnectionString String?   // 加密儲存
  containerName           String    @default("backups")

  // PostgreSQL 設定
  databaseHost            String?
  databasePort            Int       @default(5432)
  databaseName            String?

  // 備份選項
  compressionEnabled      Boolean   @default(true)
  encryptionEnabled       Boolean   @default(true)
  encryptionKey           String?   // 加密儲存

  // 通知設定
  notifyOnSuccess         Boolean   @default(false)
  notifyOnFailure         Boolean   @default(true)
  notificationEmails      String[]  // 通知郵件列表

  // 配額設定
  quotaGigabytes          Int?      // 儲存配額 (GB)

  updatedAt               DateTime  @updatedAt

  @@map("backup_configs")
}

// ============================================================
// 備份儲存使用量 - 歷史使用量記錄
// ============================================================
model BackupStorageUsage {
  id              String        @id @default(cuid())
  recordedAt      DateTime      @default(now())

  // 使用量統計
  totalSizeBytes  BigInt        // 總使用量
  backupCount     Int           // 備份數量
  oldestBackupAt  DateTime?     // 最舊備份時間
  newestBackupAt  DateTime?     // 最新備份時間

  // 配額資訊
  quotaBytes      BigInt?       // 配額限制
  usagePercent    Float?        // 使用百分比

  @@index([recordedAt])
  @@map("backup_storage_usage")
}

// ============================================================
// 恢復記錄 - 備份恢復操作記錄
// ============================================================
model RestoreRecord {
  id              String        @id @default(cuid())

  // 關聯備份
  backupId        String
  backup          Backup        @relation(fields: [backupId], references: [id])

  // 恢復狀態
  status          String        // PENDING, IN_PROGRESS, COMPLETED, FAILED
  progress        Int           @default(0)
  errorMessage    String?

  // 恢復選項
  restoreDatabase Boolean       @default(true)
  restoreFiles    Boolean       @default(true)
  restoreConfig   Boolean       @default(true)

  // 時間戳記
  startedAt       DateTime?
  completedAt     DateTime?

  // 審計資訊
  createdAt       DateTime      @default(now())
  createdBy       String?
  createdByUser   User?         @relation(fields: [createdBy], references: [id])

  @@index([backupId, createdAt])
  @@map("restore_records")
}
```

### 3.2 Type Definitions

```typescript
// types/backup.types.ts

import { BackupType, BackupStatus, BackupSource, BackupTrigger } from '@prisma/client';

// ============================================================
// 備份選項
// ============================================================
export interface BackupOptions {
  type: BackupType;
  source: BackupSource;
  trigger: BackupTrigger;
  description?: string;
  scheduleId?: string;
}

// ============================================================
// 備份進度
// ============================================================
export interface BackupProgress {
  backupId: string;
  status: BackupStatus;
  progress: number;        // 0-100
  currentStep: string;     // 當前步驟描述
  error?: string;
}

// ============================================================
// 備份列表選項
// ============================================================
export interface BackupListOptions {
  status?: BackupStatus;
  type?: BackupType;
  source?: BackupSource;
  trigger?: BackupTrigger;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'completedAt' | 'sizeBytes';
  sortOrder?: 'asc' | 'desc';
}

// ============================================================
// 備份列表回應
// ============================================================
export interface BackupListResponse {
  backups: BackupWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================
// 帶關聯的備份
// ============================================================
export interface BackupWithRelations {
  id: string;
  name: string;
  description?: string;
  type: BackupType;
  source: BackupSource;
  trigger: BackupTrigger;
  status: BackupStatus;
  progress: number;
  sizeBytes?: bigint;
  storagePath?: string;
  checksum?: string;
  contents?: BackupContents;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  createdByUser?: { displayName: string };
  schedule?: { name: string };
}

// ============================================================
// 備份內容詳情
// ============================================================
export interface BackupContents {
  database?: {
    sizeBytes: number;
    tables: string[];
    rowCount: number;
  };
  files?: {
    sizeBytes: number;
    fileCount: number;
  };
  config?: {
    sizeBytes: number;
    configCount: number;
  };
}

// ============================================================
// 儲存空間使用量
// ============================================================
export interface StorageUsage {
  totalSizeBytes: number;
  backupCount: number;
  quotaBytes?: number;
  usagePercent?: number;
  oldestBackup?: Date;
  newestBackup?: Date;
}

// ============================================================
// 備份狀態概覽
// ============================================================
export interface BackupStatusOverview {
  lastSuccessful?: BackupWithRelations;
  lastFailed?: BackupWithRelations;
  nextScheduled?: Date;
  isAutoBackupEnabled: boolean;
  activeBackups: number;
  storage: StorageUsage;
}

// ============================================================
// 排程創建資料
// ============================================================
export interface CreateScheduleData {
  name: string;
  description?: string;
  backupType: BackupType;
  backupSource: BackupSource;
  cronExpression: string;
  timezone?: string;
  retentionDays?: number;
  maxBackups?: number;
}

// ============================================================
// 排程更新資料
// ============================================================
export interface UpdateScheduleData {
  name?: string;
  description?: string;
  cronExpression?: string;
  timezone?: string;
  retentionDays?: number;
  maxBackups?: number;
  isEnabled?: boolean;
}

// ============================================================
// 進度回調函數
// ============================================================
export type ProgressCallback = (progress: BackupProgress) => void;

// ============================================================
// Cron 預設值
// ============================================================
export const CRON_PRESETS = {
  DAILY_2AM: { expression: '0 2 * * *', label: '每天凌晨 2:00' },
  DAILY_3AM: { expression: '0 3 * * *', label: '每天凌晨 3:00' },
  WEEKLY_SUNDAY: { expression: '0 3 * * 0', label: '每週日凌晨 3:00' },
  WEEKLY_SATURDAY: { expression: '0 3 * * 6', label: '每週六凌晨 3:00' },
  MONTHLY_FIRST: { expression: '0 2 1 * *', label: '每月 1 號凌晨 2:00' },
  HOURLY: { expression: '0 * * * *', label: '每小時整點' },
} as const;
```

---

## 4. Service Implementation

### 4.1 BackupService

```typescript
// services/backup/backup.service.ts

import { PrismaClient, BackupType, BackupStatus, BackupSource, BackupTrigger, Backup } from '@prisma/client';
import { BlobServiceClient, ContainerClient, BlockBlobClient } from '@azure/storage-blob';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream, createWriteStream, promises as fsPromises } from 'fs';
import { pipeline } from 'stream/promises';
import { createHash, createCipheriv, randomBytes, scryptSync } from 'crypto';
import * as path from 'path';
import * as os from 'os';
import {
  BackupOptions,
  BackupProgress,
  BackupListOptions,
  BackupListResponse,
  StorageUsage,
  BackupStatusOverview,
  BackupContents,
  ProgressCallback,
} from '@/types/backup.types';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// ============================================================
// BACKUP SERVICE - 主要備份服務
// ============================================================
export class BackupService {
  private containerClient: ContainerClient;
  private encryptionKey: Buffer;

  // ------------------------------------------------------------
  // 建構函數
  // ------------------------------------------------------------
  constructor() {
    // Azure Blob Storage 初始化
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is required');
    }

    const containerName = process.env.BACKUP_CONTAINER_NAME || 'backups';
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = blobServiceClient.getContainerClient(containerName);

    // 加密金鑰初始化 (使用 scrypt 進行金鑰衍生)
    const encKey = process.env.BACKUP_ENCRYPTION_KEY;
    if (!encKey) {
      throw new Error('BACKUP_ENCRYPTION_KEY is required');
    }
    this.encryptionKey = scryptSync(encKey, 'backup-salt-v1', 32);
  }

  // ============================================================
  // 創建備份
  // ============================================================
  async createBackup(
    options: BackupOptions,
    userId: string,
    onProgress?: ProgressCallback
  ): Promise<Backup> {
    // 生成備份名稱
    const backupName = this.generateBackupName(options.type, options.source);

    // 創建備份記錄
    const backup = await prisma.backup.create({
      data: {
        name: backupName,
        description: options.description,
        type: options.type,
        source: options.source,
        trigger: options.trigger,
        status: 'PENDING',
        progress: 0,
        scheduleId: options.scheduleId,
        createdBy: userId,
      },
    });

    // 異步執行備份 (不阻塞回應)
    this.executeBackup(backup.id, options, onProgress).catch((error) => {
      console.error(`Backup ${backup.id} failed:`, error);
    });

    return backup;
  }

  // ============================================================
  // 執行備份流程 (私有)
  // ============================================================
  private async executeBackup(
    backupId: string,
    options: BackupOptions,
    onProgress?: ProgressCallback
  ): Promise<void> {
    // 進度更新輔助函數
    const updateProgress = async (progress: number, step: string) => {
      await prisma.backup.update({
        where: { id: backupId },
        data: { progress, status: 'IN_PROGRESS' },
      });
      onProgress?.({
        backupId,
        status: 'IN_PROGRESS',
        progress,
        currentStep: step,
      });
    };

    try {
      // 標記開始備份
      await prisma.backup.update({
        where: { id: backupId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date()
        },
      });

      // 創建臨時目錄
      const tempDir = path.join(os.tmpdir(), `backup-${backupId}`);
      await fsPromises.mkdir(tempDir, { recursive: true });

      const contents: BackupContents = {};
      let totalSize = 0;

      // 根據備份來源執行對應備份
      if (options.source === 'FULL_SYSTEM' || options.source === 'DATABASE') {
        await updateProgress(10, '備份數據庫...');
        const dbResult = await this.backupDatabase(tempDir, options.type);
        contents.database = dbResult;
        totalSize += dbResult.sizeBytes;
      }

      if (options.source === 'FULL_SYSTEM' || options.source === 'FILES') {
        await updateProgress(40, '備份上傳文件...');
        const filesResult = await this.backupFiles(tempDir);
        contents.files = filesResult;
        totalSize += filesResult.sizeBytes;
      }

      if (options.source === 'FULL_SYSTEM' || options.source === 'CONFIG') {
        await updateProgress(70, '備份系統配置...');
        const configResult = await this.backupConfig(tempDir);
        contents.config = configResult;
        totalSize += configResult.sizeBytes;
      }

      await updateProgress(80, '壓縮和加密...');

      // 打包並加密所有備份文件
      const archivePath = await this.createArchive(tempDir, backupId);
      const archiveStats = await fsPromises.stat(archivePath);

      await updateProgress(90, '上傳至雲端儲存...');

      // 計算校驗碼
      const checksum = await this.calculateChecksum(archivePath);

      // 上傳到 Azure Blob Storage
      const blobName = this.generateBlobPath(backupId);
      await this.uploadToBlob(archivePath, blobName);

      // 計算過期時間
      const schedule = options.scheduleId
        ? await prisma.backupSchedule.findUnique({ where: { id: options.scheduleId } })
        : null;
      const retentionDays = schedule?.retentionDays || 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + retentionDays);

      // 更新備份記錄為完成
      await prisma.backup.update({
        where: { id: backupId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          storagePath: blobName,
          sizeBytes: BigInt(archiveStats.size),
          checksum,
          contents,
          completedAt: new Date(),
          expiresAt,
        },
      });

      // 清理臨時文件
      await this.cleanupTempFiles(tempDir, archivePath);

      // 清理過期備份
      await this.cleanupExpiredBackups();

      // 發送完成通知
      onProgress?.({
        backupId,
        status: 'COMPLETED',
        progress: 100,
        currentStep: '備份完成',
      });

      await this.sendNotification(backupId, 'success');

    } catch (error: any) {
      // 錯誤處理
      await prisma.backup.update({
        where: { id: backupId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });

      onProgress?.({
        backupId,
        status: 'FAILED',
        progress: 0,
        currentStep: '備份失敗',
        error: error.message,
      });

      await this.sendNotification(backupId, 'failure', error.message);
      throw error;
    }
  }

  // ============================================================
  // 備份數據庫
  // ============================================================
  private async backupDatabase(
    tempDir: string,
    backupType: BackupType
  ): Promise<{ sizeBytes: number; tables: string[]; rowCount: number }> {
    const dbHost = process.env.DATABASE_HOST || 'localhost';
    const dbPort = process.env.DATABASE_PORT || '5432';
    const dbName = process.env.DATABASE_NAME!;
    const dbUser = process.env.DATABASE_USER!;
    const dbPassword = process.env.DATABASE_PASSWORD!;

    const outputFile = path.join(tempDir, 'database.dump');

    // 設定 PostgreSQL 密碼環境變數
    const env = { ...process.env, PGPASSWORD: dbPassword };

    // 構建 pg_dump 命令
    let pgDumpArgs = [
      `-h ${dbHost}`,
      `-p ${dbPort}`,
      `-U ${dbUser}`,
      `-d ${dbName}`,
      '--format=custom',  // 自定義格式 (支援增量恢復)
      '--compress=9',     // 最大壓縮
      `-f "${outputFile}"`,
    ];

    if (backupType === 'INCREMENTAL') {
      // 增量備份僅備份數據
      pgDumpArgs.push('--data-only');
    }

    const command = `pg_dump ${pgDumpArgs.join(' ')}`;
    await execAsync(command, { env });

    const stats = await fsPromises.stat(outputFile);

    // 獲取表格統計資訊
    const tableQuery = `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `;
    const { stdout: tableList } = await execAsync(
      `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -t -c "${tableQuery}"`,
      { env }
    );
    const tables = tableList
      .trim()
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    // 獲取總行數
    const rowCountQuery = `
      SELECT SUM(n_live_tup)::integer
      FROM pg_stat_user_tables
    `;
    const { stdout: rowCountResult } = await execAsync(
      `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -t -c "${rowCountQuery}"`,
      { env }
    );
    const rowCount = parseInt(rowCountResult.trim()) || 0;

    return {
      sizeBytes: stats.size,
      tables,
      rowCount,
    };
  }

  // ============================================================
  // 備份上傳文件
  // ============================================================
  private async backupFiles(
    tempDir: string
  ): Promise<{ sizeBytes: number; fileCount: number }> {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const outputFile = path.join(tempDir, 'files.tar.gz');

    // 檢查目錄是否存在
    try {
      await fsPromises.access(uploadDir);
    } catch {
      // 目錄不存在，返回空結果
      return { sizeBytes: 0, fileCount: 0 };
    }

    // 使用 tar 壓縮上傳目錄
    await execAsync(`tar -czf "${outputFile}" -C "${uploadDir}" .`);

    const stats = await fsPromises.stat(outputFile);

    // 計算檔案數量
    const { stdout: fileCountStr } = await execAsync(
      `find "${uploadDir}" -type f | wc -l`
    );
    const fileCount = parseInt(fileCountStr.trim()) || 0;

    return {
      sizeBytes: stats.size,
      fileCount,
    };
  }

  // ============================================================
  // 備份系統配置
  // ============================================================
  private async backupConfig(
    tempDir: string
  ): Promise<{ sizeBytes: number; configCount: number }> {
    const outputFile = path.join(tempDir, 'config.json');

    // 從數據庫導出配置 (排除加密配置)
    const configs = await prisma.systemConfig.findMany({
      where: { isEncrypted: false },
      select: {
        key: true,
        value: true,
        category: true,
        valueType: true,
        name: true,
        description: true,
      },
    });

    // 導出安全的環境變數
    const safeEnvVars = [
      'NODE_ENV',
      'APP_NAME',
      'APP_VERSION',
      'DATABASE_NAME',
      'NEXT_PUBLIC_APP_URL',
    ];

    const envConfig: Record<string, string> = {};
    for (const key of safeEnvVars) {
      if (process.env[key]) {
        envConfig[key] = process.env[key]!;
      }
    }

    const configData = {
      exportedAt: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      systemConfigs: configs,
      environmentConfigs: envConfig,
    };

    await fsPromises.writeFile(
      outputFile,
      JSON.stringify(configData, null, 2),
      'utf-8'
    );

    const stats = await fsPromises.stat(outputFile);

    return {
      sizeBytes: stats.size,
      configCount: configs.length,
    };
  }

  // ============================================================
  // 創建加密壓縮檔案
  // ============================================================
  private async createArchive(
    tempDir: string,
    backupId: string
  ): Promise<string> {
    const tarPath = path.join(os.tmpdir(), `${backupId}.tar.gz`);
    const archivePath = path.join(os.tmpdir(), `${backupId}.tar.gz.enc`);

    // 創建 tar.gz 壓縮檔
    await execAsync(`tar -czf "${tarPath}" -C "${tempDir}" .`);

    // AES-256-CBC 加密
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);

    const input = createReadStream(tarPath);
    const output = createWriteStream(archivePath);

    // 寫入 IV 到檔案開頭 (解密時需要)
    output.write(iv);

    // 串流加密
    await pipeline(input, cipher, output);

    // 刪除未加密的 tar.gz
    await fsPromises.unlink(tarPath);

    return archivePath;
  }

  // ============================================================
  // 上傳到 Azure Blob Storage
  // ============================================================
  private async uploadToBlob(
    filePath: string,
    blobName: string
  ): Promise<void> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

    const fileStream = createReadStream(filePath);
    const stats = await fsPromises.stat(filePath);

    // 使用串流上傳 (4MB 區塊, 20 並行連接)
    await blockBlobClient.uploadStream(
      fileStream,
      4 * 1024 * 1024,  // 4MB buffer size
      20,               // max concurrency
      {
        blobHTTPHeaders: {
          blobContentType: 'application/octet-stream',
        },
        metadata: {
          encrypted: 'true',
          algorithm: 'aes-256-cbc',
        },
      }
    );
  }

  // ============================================================
  // 計算 SHA-256 校驗碼
  // ============================================================
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  // ============================================================
  // 取得備份列表
  // ============================================================
  async listBackups(options: BackupListOptions = {}): Promise<BackupListResponse> {
    const {
      status,
      type,
      source,
      trigger,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // 建立查詢條件
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (source) where.source = source;
    if (trigger) where.trigger = trigger;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [backups, total] = await Promise.all([
      prisma.backup.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
        include: {
          createdByUser: {
            select: { displayName: true },
          },
          schedule: {
            select: { name: true },
          },
        },
      }),
      prisma.backup.count({ where }),
    ]);

    return { backups, total, limit, offset };
  }

  // ============================================================
  // 取得備份詳情
  // ============================================================
  async getBackup(backupId: string): Promise<Backup | null> {
    return prisma.backup.findUnique({
      where: { id: backupId },
      include: {
        createdByUser: {
          select: { displayName: true },
        },
        schedule: {
          select: { name: true },
        },
        restores: {
          orderBy: { startedAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  // ============================================================
  // 取得儲存空間使用量
  // ============================================================
  async getStorageUsage(): Promise<StorageUsage> {
    const result = await prisma.backup.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { sizeBytes: true },
      _count: true,
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    // 從環境變數取得配額
    const quotaGB = parseInt(process.env.BACKUP_QUOTA_GB || '100');
    const quotaBytes = quotaGB * 1024 * 1024 * 1024;
    const totalSizeBytes = Number(result._sum.sizeBytes || 0);

    const usage: StorageUsage = {
      totalSizeBytes,
      backupCount: result._count,
      quotaBytes,
      usagePercent: quotaBytes ? (totalSizeBytes / quotaBytes) * 100 : undefined,
      oldestBackup: result._min.createdAt || undefined,
      newestBackup: result._max.createdAt || undefined,
    };

    // 記錄使用量歷史
    await prisma.backupStorageUsage.create({
      data: {
        totalSizeBytes: BigInt(totalSizeBytes),
        backupCount: result._count,
        quotaBytes: quotaBytes ? BigInt(quotaBytes) : null,
        usagePercent: usage.usagePercent,
        oldestBackupAt: result._min.createdAt,
        newestBackupAt: result._max.createdAt,
      },
    });

    return usage;
  }

  // ============================================================
  // 取得備份狀態概覽
  // ============================================================
  async getBackupStatusOverview(): Promise<BackupStatusOverview> {
    const [
      lastSuccessful,
      lastFailed,
      nextSchedule,
      activeBackups,
      storage,
    ] = await Promise.all([
      prisma.backup.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        include: {
          createdByUser: { select: { displayName: true } },
          schedule: { select: { name: true } },
        },
      }),
      prisma.backup.findFirst({
        where: { status: 'FAILED' },
        orderBy: { completedAt: 'desc' },
        include: {
          createdByUser: { select: { displayName: true } },
          schedule: { select: { name: true } },
        },
      }),
      prisma.backupSchedule.findFirst({
        where: { isEnabled: true },
        orderBy: { nextRunAt: 'asc' },
      }),
      prisma.backup.count({
        where: { status: 'IN_PROGRESS' },
      }),
      this.getStorageUsage(),
    ]);

    return {
      lastSuccessful: lastSuccessful || undefined,
      lastFailed: lastFailed || undefined,
      nextScheduled: nextSchedule?.nextRunAt || undefined,
      isAutoBackupEnabled: !!nextSchedule,
      activeBackups,
      storage,
    };
  }

  // ============================================================
  // 刪除備份
  // ============================================================
  async deleteBackup(backupId: string, userId: string): Promise<void> {
    const backup = await prisma.backup.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new Error('備份不存在');
    }

    // 從 Azure Blob Storage 刪除
    if (backup.storagePath) {
      const blockBlobClient = this.containerClient.getBlockBlobClient(
        backup.storagePath
      );
      await blockBlobClient.deleteIfExists();
    }

    // 刪除數據庫記錄
    await prisma.backup.delete({
      where: { id: backupId },
    });

    // 記錄審計日誌
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'BACKUP_DELETE',
        resourceType: 'Backup',
        resourceId: backupId,
        description: `刪除備份: ${backup.name}`,
      },
    });
  }

  // ============================================================
  // 下載備份檔案
  // ============================================================
  async downloadBackup(backupId: string): Promise<NodeJS.ReadableStream> {
    const backup = await prisma.backup.findUnique({
      where: { id: backupId },
    });

    if (!backup || !backup.storagePath) {
      throw new Error('備份不存在或檔案不可用');
    }

    const blockBlobClient = this.containerClient.getBlockBlobClient(
      backup.storagePath
    );

    const downloadResponse = await blockBlobClient.download(0);

    if (!downloadResponse.readableStreamBody) {
      throw new Error('無法讀取備份檔案');
    }

    return downloadResponse.readableStreamBody;
  }

  // ============================================================
  // 清理過期備份 (私有)
  // ============================================================
  private async cleanupExpiredBackups(): Promise<void> {
    const expiredBackups = await prisma.backup.findMany({
      where: {
        expiresAt: { lt: new Date() },
        status: 'COMPLETED',
      },
    });

    for (const backup of expiredBackups) {
      try {
        if (backup.storagePath) {
          const blockBlobClient = this.containerClient.getBlockBlobClient(
            backup.storagePath
          );
          await blockBlobClient.deleteIfExists();
        }
        await prisma.backup.delete({ where: { id: backup.id } });

        console.log(`Cleaned up expired backup: ${backup.id}`);
      } catch (error) {
        console.error(`Failed to cleanup backup ${backup.id}:`, error);
      }
    }
  }

  // ============================================================
  // 輔助函數
  // ============================================================

  private generateBackupName(type: BackupType, source: BackupSource): string {
    const timestamp = this.formatTimestamp();
    return `backup-${source.toLowerCase()}-${type.toLowerCase()}-${timestamp}`;
  }

  private generateBlobPath(backupId: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}/${month}-${day}/${backupId}.tar.gz.enc`;
  }

  private formatTimestamp(): string {
    return new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
  }

  private async cleanupTempFiles(
    tempDir: string,
    archivePath: string
  ): Promise<void> {
    try {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
      await fsPromises.rm(archivePath, { force: true });
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }

  private async sendNotification(
    backupId: string,
    status: 'success' | 'failure',
    error?: string
  ): Promise<void> {
    try {
      const config = await prisma.backupConfig.findFirst();
      if (!config) return;

      if (status === 'success' && !config.notifyOnSuccess) return;
      if (status === 'failure' && !config.notifyOnFailure) return;

      // TODO: 整合通知服務 (Email/Slack)
      // await notificationService.sendBackupNotification({
      //   backupId,
      //   status,
      //   error,
      //   recipients: config.notificationEmails,
      // });
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
  }
}

// 單例匯出
export const backupService = new BackupService();
```

### 4.2 BackupSchedulerService

```typescript
// services/backup/backup-scheduler.service.ts

import { PrismaClient, BackupSchedule, BackupType, BackupSource } from '@prisma/client';
import * as cron from 'node-cron';
import * as cronParser from 'cron-parser';
import { backupService } from './backup.service';
import { CreateScheduleData, UpdateScheduleData } from '@/types/backup.types';

const prisma = new PrismaClient();

// ============================================================
// 排程任務介面
// ============================================================
interface ScheduledTask {
  scheduleId: string;
  task: cron.ScheduledTask;
}

// ============================================================
// BACKUP SCHEDULER SERVICE - 備份排程服務
// ============================================================
export class BackupSchedulerService {
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private isInitialized: boolean = false;

  // ============================================================
  // 初始化所有排程
  // ============================================================
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('BackupScheduler already initialized');
      return;
    }

    const schedules = await prisma.backupSchedule.findMany({
      where: { isEnabled: true },
    });

    for (const schedule of schedules) {
      this.addSchedule(schedule);
    }

    this.isInitialized = true;
    console.log(`BackupScheduler initialized with ${schedules.length} schedules`);
  }

  // ============================================================
  // 新增排程
  // ============================================================
  addSchedule(schedule: BackupSchedule): void {
    // 移除既有排程 (如有)
    if (this.scheduledTasks.has(schedule.id)) {
      this.removeSchedule(schedule.id);
    }

    // 驗證 Cron 表達式
    if (!cron.validate(schedule.cronExpression)) {
      console.error(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}`);
      return;
    }

    // 創建 cron 任務
    const task = cron.schedule(
      schedule.cronExpression,
      async () => {
        await this.executeScheduledBackup(schedule);
      },
      {
        timezone: schedule.timezone,
        scheduled: true,
      }
    );

    this.scheduledTasks.set(schedule.id, {
      scheduleId: schedule.id,
      task,
    });

    // 更新下次執行時間
    this.updateNextRunTime(schedule.id).catch(console.error);

    console.log(`Added backup schedule: ${schedule.name} (${schedule.cronExpression})`);
  }

  // ============================================================
  // 移除排程
  // ============================================================
  removeSchedule(scheduleId: string): void {
    const scheduled = this.scheduledTasks.get(scheduleId);
    if (scheduled) {
      scheduled.task.stop();
      this.scheduledTasks.delete(scheduleId);
      console.log(`Removed backup schedule: ${scheduleId}`);
    }
  }

  // ============================================================
  // 執行排程備份
  // ============================================================
  private async executeScheduledBackup(schedule: BackupSchedule): Promise<void> {
    console.log(`Executing scheduled backup: ${schedule.name}`);

    try {
      // 創建備份
      await backupService.createBackup(
        {
          type: schedule.backupType,
          source: schedule.backupSource,
          trigger: 'SCHEDULED',
          description: `排程備份: ${schedule.name}`,
          scheduleId: schedule.id,
        },
        'system' // 系統使用者
      );

      // 更新最後執行時間
      await prisma.backupSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: new Date() },
      });

      // 執行保留策略
      await this.enforceRetentionPolicy(schedule);

      // 更新下次執行時間
      await this.updateNextRunTime(schedule.id);

      console.log(`Scheduled backup completed: ${schedule.name}`);
    } catch (error) {
      console.error(`Scheduled backup failed for ${schedule.name}:`, error);
    }
  }

  // ============================================================
  // 執行保留策略
  // ============================================================
  private async enforceRetentionPolicy(schedule: BackupSchedule): Promise<void> {
    // 取得此排程的所有已完成備份
    const backups = await prisma.backup.findMany({
      where: {
        scheduleId: schedule.id,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
    });

    // 刪除超過最大數量的備份
    if (backups.length > schedule.maxBackups) {
      const toDelete = backups.slice(schedule.maxBackups);

      for (const backup of toDelete) {
        try {
          await backupService.deleteBackup(backup.id, 'system');
          console.log(`Retention policy: deleted backup ${backup.id}`);
        } catch (error) {
          console.error(`Failed to delete backup ${backup.id}:`, error);
        }
      }
    }
  }

  // ============================================================
  // 更新下次執行時間
  // ============================================================
  private async updateNextRunTime(scheduleId: string): Promise<void> {
    const schedule = await prisma.backupSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) return;

    try {
      // 使用 cron-parser 計算下次執行時間
      const interval = cronParser.parseExpression(schedule.cronExpression, {
        tz: schedule.timezone,
      });
      const nextRun = interval.next().toDate();

      await prisma.backupSchedule.update({
        where: { id: scheduleId },
        data: { nextRunAt: nextRun },
      });
    } catch (error) {
      console.error(`Failed to update next run time for ${scheduleId}:`, error);
    }
  }

  // ============================================================
  // 創建備份排程
  // ============================================================
  async createSchedule(
    data: CreateScheduleData,
    userId: string
  ): Promise<BackupSchedule> {
    // 驗證 cron 表達式
    if (!cron.validate(data.cronExpression)) {
      throw new Error('無效的 Cron 表達式');
    }

    // 計算首次執行時間
    const interval = cronParser.parseExpression(data.cronExpression, {
      tz: data.timezone || 'Asia/Taipei',
    });
    const nextRunAt = interval.next().toDate();

    const schedule = await prisma.backupSchedule.create({
      data: {
        name: data.name,
        description: data.description,
        backupType: data.backupType,
        backupSource: data.backupSource,
        cronExpression: data.cronExpression,
        timezone: data.timezone || 'Asia/Taipei',
        retentionDays: data.retentionDays || 30,
        maxBackups: data.maxBackups || 10,
        isEnabled: true,
        nextRunAt,
        createdBy: userId,
      },
    });

    // 啟動排程
    this.addSchedule(schedule);

    return schedule;
  }

  // ============================================================
  // 更新備份排程
  // ============================================================
  async updateSchedule(
    scheduleId: string,
    data: UpdateScheduleData
  ): Promise<BackupSchedule> {
    // 驗證 cron 表達式 (如有更新)
    if (data.cronExpression && !cron.validate(data.cronExpression)) {
      throw new Error('無效的 Cron 表達式');
    }

    const schedule = await prisma.backupSchedule.update({
      where: { id: scheduleId },
      data,
    });

    // 重新啟動排程
    if (schedule.isEnabled) {
      this.addSchedule(schedule);
    } else {
      this.removeSchedule(scheduleId);
    }

    return schedule;
  }

  // ============================================================
  // 刪除備份排程
  // ============================================================
  async deleteSchedule(scheduleId: string): Promise<void> {
    this.removeSchedule(scheduleId);

    await prisma.backupSchedule.delete({
      where: { id: scheduleId },
    });
  }

  // ============================================================
  // 取得所有排程
  // ============================================================
  async listSchedules(): Promise<BackupSchedule[]> {
    return prisma.backupSchedule.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: {
          select: { displayName: true },
        },
        _count: {
          select: { backups: true },
        },
      },
    });
  }

  // ============================================================
  // 取得排程詳情
  // ============================================================
  async getSchedule(scheduleId: string): Promise<BackupSchedule | null> {
    return prisma.backupSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        createdByUser: {
          select: { displayName: true },
        },
        backups: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { backups: true },
        },
      },
    });
  }

  // ============================================================
  // 手動觸發排程
  // ============================================================
  async triggerSchedule(scheduleId: string): Promise<void> {
    const schedule = await prisma.backupSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new Error('排程不存在');
    }

    await this.executeScheduledBackup(schedule);
  }

  // ============================================================
  // 停止所有排程
  // ============================================================
  stopAll(): void {
    for (const [id, scheduled] of this.scheduledTasks) {
      scheduled.task.stop();
    }
    this.scheduledTasks.clear();
    this.isInitialized = false;
    console.log('All backup schedules stopped');
  }
}

// 單例匯出
export const backupScheduler = new BackupSchedulerService();
```

---

## 5. API Routes

### 5.1 Backup Management Routes

```typescript
// app/api/admin/backup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { backupService } from '@/services/backup/backup.service';
import { BackupType, BackupSource, BackupStatus } from '@prisma/client';

// ============================================================
// GET /api/admin/backup - 取得備份列表
// ============================================================
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const options = {
    status: searchParams.get('status') as BackupStatus | undefined,
    type: searchParams.get('type') as BackupType | undefined,
    source: searchParams.get('source') as BackupSource | undefined,
    limit: parseInt(searchParams.get('limit') || '20'),
    offset: parseInt(searchParams.get('offset') || '0'),
    sortBy: searchParams.get('sortBy') as 'createdAt' | 'completedAt' | 'sizeBytes' || 'createdAt',
    sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc',
  };

  const result = await backupService.listBackups(options);

  return NextResponse.json(result);
}

// ============================================================
// POST /api/admin/backup - 創建手動備份
// ============================================================
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      type = 'FULL',
      source = 'FULL_SYSTEM',
      description
    } = body;

    // 驗證參數
    if (!['FULL', 'INCREMENTAL', 'DIFFERENTIAL'].includes(type)) {
      return NextResponse.json({ error: '無效的備份類型' }, { status: 400 });
    }

    if (!['DATABASE', 'FILES', 'CONFIG', 'FULL_SYSTEM'].includes(source)) {
      return NextResponse.json({ error: '無效的備份來源' }, { status: 400 });
    }

    const backup = await backupService.createBackup(
      {
        type,
        source,
        trigger: 'MANUAL',
        description,
      },
      session.user.id
    );

    return NextResponse.json({
      backup,
      message: '備份已開始執行'
    });
  } catch (error: any) {
    console.error('Failed to create backup:', error);
    return NextResponse.json(
      { error: error.message || '創建備份失敗' },
      { status: 500 }
    );
  }
}
```

### 5.2 Backup Detail Routes

```typescript
// app/api/admin/backup/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { backupService } from '@/services/backup/backup.service';

// ============================================================
// GET /api/admin/backup/:id - 取得備份詳情
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const backup = await backupService.getBackup(params.id);

  if (!backup) {
    return NextResponse.json({ error: '備份不存在' }, { status: 404 });
  }

  return NextResponse.json({ backup });
}

// ============================================================
// DELETE /api/admin/backup/:id - 刪除備份
// ============================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  try {
    await backupService.deleteBackup(params.id, session.user.id);
    return NextResponse.json({ message: '備份已刪除' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '刪除失敗' },
      { status: 400 }
    );
  }
}
```

### 5.3 Backup Status Route

```typescript
// app/api/admin/backup/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { backupService } from '@/services/backup/backup.service';

// ============================================================
// GET /api/admin/backup/status - 取得備份狀態概覽
// ============================================================
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  try {
    const status = await backupService.getBackupStatusOverview();
    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Failed to get backup status:', error);
    return NextResponse.json(
      { error: '取得狀態失敗' },
      { status: 500 }
    );
  }
}
```

### 5.4 Backup Schedule Routes

```typescript
// app/api/admin/backup/schedule/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { backupScheduler } from '@/services/backup/backup-scheduler.service';

// ============================================================
// GET /api/admin/backup/schedule - 取得備份排程列表
// ============================================================
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const schedules = await backupScheduler.listSchedules();
  return NextResponse.json({ schedules });
}

// ============================================================
// POST /api/admin/backup/schedule - 創建備份排程
// ============================================================
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  try {
    const body = await request.json();

    // 驗證必要欄位
    if (!body.name || !body.cronExpression || !body.backupType || !body.backupSource) {
      return NextResponse.json(
        { error: '缺少必要欄位' },
        { status: 400 }
      );
    }

    const schedule = await backupScheduler.createSchedule(body, session.user.id);
    return NextResponse.json({ schedule });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '創建排程失敗' },
      { status: 400 }
    );
  }
}
```

### 5.5 Schedule Detail Routes

```typescript
// app/api/admin/backup/schedule/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { backupScheduler } from '@/services/backup/backup-scheduler.service';

// ============================================================
// GET /api/admin/backup/schedule/:id - 取得排程詳情
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const schedule = await backupScheduler.getSchedule(params.id);

  if (!schedule) {
    return NextResponse.json({ error: '排程不存在' }, { status: 404 });
  }

  return NextResponse.json({ schedule });
}

// ============================================================
// PATCH /api/admin/backup/schedule/:id - 更新排程
// ============================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const schedule = await backupScheduler.updateSchedule(params.id, body);
    return NextResponse.json({ schedule });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '更新失敗' },
      { status: 400 }
    );
  }
}

// ============================================================
// DELETE /api/admin/backup/schedule/:id - 刪除排程
// ============================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  try {
    await backupScheduler.deleteSchedule(params.id);
    return NextResponse.json({ message: '排程已刪除' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '刪除失敗' },
      { status: 400 }
    );
  }
}
```

### 5.6 Backup Download Route

```typescript
// app/api/admin/backup/[id]/download/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { backupService } from '@/services/backup/backup.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// GET /api/admin/backup/:id/download - 下載備份檔案
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  try {
    const backup = await prisma.backup.findUnique({
      where: { id: params.id },
    });

    if (!backup) {
      return NextResponse.json({ error: '備份不存在' }, { status: 404 });
    }

    if (backup.status !== 'COMPLETED' || !backup.storagePath) {
      return NextResponse.json(
        { error: '備份檔案不可用' },
        { status: 400 }
      );
    }

    const stream = await backupService.downloadBackup(params.id);

    // 設定回應標頭
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set(
      'Content-Disposition',
      `attachment; filename="${backup.name}.tar.gz.enc"`
    );
    if (backup.sizeBytes) {
      headers.set('Content-Length', backup.sizeBytes.toString());
    }

    // 記錄下載操作
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'BACKUP_DOWNLOAD',
        resourceType: 'Backup',
        resourceId: params.id,
        description: `下載備份: ${backup.name}`,
      },
    });

    return new NextResponse(stream as any, { headers });
  } catch (error: any) {
    console.error('Download backup failed:', error);
    return NextResponse.json(
      { error: error.message || '下載失敗' },
      { status: 500 }
    );
  }
}
```

---

## 6. React Components

### 6.1 BackupManagement Component

```typescript
// components/admin/backup/BackupManagement.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BackupType, BackupStatus, BackupSource } from '@prisma/client';
import { StatusCard } from './StatusCard';
import { BackupListTable } from './BackupListTable';
import { ScheduleList } from './ScheduleList';
import { ScheduleModal } from './ScheduleModal';
import { BackupStatusOverview, BackupWithRelations } from '@/types/backup.types';

// ============================================================
// 標籤定義
// ============================================================
const STATUS_LABELS: Record<BackupStatus, string> = {
  PENDING: '等待中',
  IN_PROGRESS: '進行中',
  COMPLETED: '完成',
  FAILED: '失敗',
  CANCELLED: '已取消',
};

const TYPE_LABELS: Record<BackupType, string> = {
  FULL: '完整備份',
  INCREMENTAL: '增量備份',
  DIFFERENTIAL: '差異備份',
};

const SOURCE_LABELS: Record<BackupSource, string> = {
  DATABASE: '數據庫',
  FILES: '上傳文件',
  CONFIG: '系統配置',
  FULL_SYSTEM: '完整系統',
};

// ============================================================
// BackupManagement 主組件
// ============================================================
export function BackupManagement() {
  // 狀態
  const [status, setStatus] = useState<BackupStatusOverview | null>(null);
  const [backups, setBackups] = useState<BackupWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'backups' | 'schedules'>('backups');
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // 資料載入
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/backup/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch backup status:', error);
    }
  }, []);

  const fetchBackups = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/backup?limit=50');
      const data = await response.json();
      setBackups(data.backups);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    await Promise.all([fetchStatus(), fetchBackups()]);
    setLoading(false);
  }, [fetchStatus, fetchBackups]);

  // 初始化與輪詢
  useEffect(() => {
    fetchData();

    // 每 30 秒刷新狀態
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchData, fetchStatus]);

  // 創建備份
  const handleCreateBackup = async (type: BackupType, source: BackupSource) => {
    setCreatingBackup(true);
    try {
      const response = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          source,
          description: '手動備份'
        }),
      });

      if (response.ok) {
        alert('備份已開始，請查看備份列表追蹤進度');
        fetchBackups();
        fetchStatus();
      } else {
        const data = await response.json();
        alert(`備份失敗: ${data.error}`);
      }
    } catch (error) {
      alert('備份失敗');
    } finally {
      setCreatingBackup(false);
    }
  };

  // 刪除備份
  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('確定要刪除此備份嗎？此操作無法復原。')) return;

    try {
      const response = await fetch(`/api/admin/backup/${backupId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchBackups();
        fetchStatus();
      } else {
        const data = await response.json();
        alert(`刪除失敗: ${data.error}`);
      }
    } catch (error) {
      alert('刪除失敗');
    }
  };

  // 格式化大小
  const formatSize = (bytes?: bigint | number | string) => {
    if (!bytes) return '-';
    const num = typeof bytes === 'bigint'
      ? Number(bytes)
      : typeof bytes === 'string'
        ? parseInt(bytes)
        : bytes;

    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    if (num < 1024 * 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)} MB`;
    return `${(num / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">載入中...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 標題 */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">數據備份管理</h1>
        {status?.activeBackups && status.activeBackups > 0 && (
          <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-sm animate-pulse">
            {status.activeBackups} 個備份進行中
          </span>
        )}
      </div>

      {/* 狀態概覽卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          title="自動備份"
          value={status?.isAutoBackupEnabled ? '已啟用' : '已停用'}
          icon={status?.isAutoBackupEnabled ? '✅' : '⚠️'}
          color={status?.isAutoBackupEnabled ? 'green' : 'yellow'}
        />
        <StatusCard
          title="最近成功備份"
          value={
            status?.lastSuccessful?.completedAt
              ? new Date(status.lastSuccessful.completedAt).toLocaleString('zh-TW')
              : '無'
          }
          icon="📦"
          color="blue"
        />
        <StatusCard
          title="儲存空間使用"
          value={
            status?.storage
              ? `${formatSize(status.storage.totalSizeBytes)} / ${formatSize(status.storage.quotaBytes)}`
              : '-'
          }
          subtitle={
            status?.storage?.usagePercent
              ? `${status.storage.usagePercent.toFixed(1)}%`
              : undefined
          }
          icon="💾"
          color="purple"
          progress={status?.storage?.usagePercent}
        />
        <StatusCard
          title="下次排程備份"
          value={
            status?.nextScheduled
              ? new Date(status.nextScheduled).toLocaleString('zh-TW')
              : '無排程'
          }
          icon="🕐"
          color="gray"
        />
      </div>

      {/* 操作按鈕 */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => handleCreateBackup('FULL', 'FULL_SYSTEM')}
          disabled={creatingBackup}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                     flex items-center gap-2"
        >
          {creatingBackup ? (
            <>
              <span className="animate-spin">⏳</span>
              備份中...
            </>
          ) : (
            <>
              🔄 立即完整備份
            </>
          )}
        </button>
        <button
          onClick={() => handleCreateBackup('FULL', 'DATABASE')}
          disabled={creatingBackup}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          📊 僅備份數據庫
        </button>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600
                     transition-colors"
        >
          ⏰ 新增排程
        </button>
      </div>

      {/* 標籤切換 */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('backups')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'backups'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            備份記錄 ({backups.length})
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'schedules'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            備份排程
          </button>
        </nav>
      </div>

      {/* 內容區域 */}
      {activeTab === 'backups' ? (
        <BackupListTable
          backups={backups}
          onDelete={handleDeleteBackup}
          onRefresh={fetchBackups}
          formatSize={formatSize}
          statusLabels={STATUS_LABELS}
          typeLabels={TYPE_LABELS}
          sourceLabels={SOURCE_LABELS}
        />
      ) : (
        <ScheduleList onRefresh={fetchStatus} />
      )}

      {/* 排程建立對話框 */}
      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          onCreated={() => {
            fetchStatus();
            setShowScheduleModal(false);
          }}
        />
      )}
    </div>
  );
}

export default BackupManagement;
```

### 6.2 StatusCard Component

```typescript
// components/admin/backup/StatusCard.tsx
'use client';

import React from 'react';

interface StatusCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  color: 'green' | 'yellow' | 'blue' | 'purple' | 'gray' | 'red';
  progress?: number;
}

const colorClasses: Record<string, string> = {
  green: 'bg-green-50 border-green-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  blue: 'bg-blue-50 border-blue-200',
  purple: 'bg-purple-50 border-purple-200',
  gray: 'bg-gray-50 border-gray-200',
  red: 'bg-red-50 border-red-200',
};

export function StatusCard({
  title,
  value,
  subtitle,
  icon,
  color,
  progress
}: StatusCardProps) {
  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]} transition-all hover:shadow-md`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-500 font-medium">{title}</div>
          <div className="font-semibold text-gray-900 truncate" title={value}>
            {value}
          </div>
          {subtitle && (
            <div className="text-sm text-gray-400">{subtitle}</div>
          )}
          {progress !== undefined && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    progress > 80 ? 'bg-red-500' :
                    progress > 60 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 6.3 ScheduleModal Component

```typescript
// components/admin/backup/ScheduleModal.tsx
'use client';

import React, { useState } from 'react';
import { BackupType, BackupSource } from '@prisma/client';
import { CRON_PRESETS } from '@/types/backup.types';

interface ScheduleModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function ScheduleModal({ onClose, onCreated }: ScheduleModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    backupType: 'FULL' as BackupType,
    backupSource: 'FULL_SYSTEM' as BackupSource,
    cronExpression: '0 2 * * *',
    timezone: 'Asia/Taipei',
    retentionDays: 30,
    maxBackups: 10,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/backup/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onCreated();
      } else {
        const data = await response.json();
        setError(data.error || '建立失敗');
      }
    } catch (err) {
      setError('建立失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">新增備份排程</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 排程名稱 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                排程名稱 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                           focus:ring-blue-500 focus:border-blue-500"
                placeholder="例：每日完整備份"
              />
            </div>

            {/* 描述 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                           focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="選填"
              />
            </div>

            {/* 備份類型 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備份類型 *
                </label>
                <select
                  value={formData.backupType}
                  onChange={(e) => setFormData({ ...formData, backupType: e.target.value as BackupType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                             focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="FULL">完整備份</option>
                  <option value="INCREMENTAL">增量備份</option>
                  <option value="DIFFERENTIAL">差異備份</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備份來源 *
                </label>
                <select
                  value={formData.backupSource}
                  onChange={(e) => setFormData({ ...formData, backupSource: e.target.value as BackupSource })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                             focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="FULL_SYSTEM">完整系統</option>
                  <option value="DATABASE">僅數據庫</option>
                  <option value="FILES">僅上傳文件</option>
                  <option value="CONFIG">僅系統配置</option>
                </select>
              </div>
            </div>

            {/* Cron 預設 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                快速選擇排程
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CRON_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({ ...formData, cronExpression: preset.expression })}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      formData.cronExpression === preset.expression
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cron 表達式 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cron 表達式 *
              </label>
              <input
                type="text"
                value={formData.cronExpression}
                onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono
                           focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0 2 * * *"
              />
              <p className="mt-1 text-xs text-gray-500">
                格式: 分 時 日 月 週 (例: 0 2 * * * = 每天凌晨 2:00)
              </p>
            </div>

            {/* 保留設定 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  保留天數
                </label>
                <input
                  type="number"
                  value={formData.retentionDays}
                  onChange={(e) => setFormData({
                    ...formData,
                    retentionDays: parseInt(e.target.value) || 30
                  })}
                  min={1}
                  max={365}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                             focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最大備份數
                </label>
                <input
                  type="number"
                  value={formData.maxBackups}
                  onChange={(e) => setFormData({
                    ...formData,
                    maxBackups: parseInt(e.target.value) || 10
                  })}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                             focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* 按鈕 */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200
                           rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600
                           rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? '建立中...' : '建立排程'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// __tests__/services/backup.service.test.ts

import { BackupService } from '@/services/backup/backup.service';
import { PrismaClient } from '@prisma/client';
import { BlobServiceClient } from '@azure/storage-blob';

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('@azure/storage-blob');

describe('BackupService', () => {
  let service: BackupService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Setup mocks
    process.env.AZURE_STORAGE_CONNECTION_STRING = 'mock-connection-string';
    process.env.BACKUP_ENCRYPTION_KEY = 'test-encryption-key-32chars!!!';

    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    service = new BackupService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBackup', () => {
    it('should create a backup record with PENDING status', async () => {
      const mockBackup = {
        id: 'backup-1',
        name: 'backup-full_system-full-2024-01-15',
        type: 'FULL',
        source: 'FULL_SYSTEM',
        trigger: 'MANUAL',
        status: 'PENDING',
        progress: 0,
        createdAt: new Date(),
      };

      (mockPrisma.backup.create as jest.Mock).mockResolvedValue(mockBackup);

      const result = await service.createBackup(
        {
          type: 'FULL',
          source: 'FULL_SYSTEM',
          trigger: 'MANUAL',
          description: '手動備份',
        },
        'user-1'
      );

      expect(result.status).toBe('PENDING');
      expect(result.progress).toBe(0);
      expect(mockPrisma.backup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'FULL',
            source: 'FULL_SYSTEM',
            trigger: 'MANUAL',
            createdBy: 'user-1',
          }),
        })
      );
    });
  });

  describe('listBackups', () => {
    it('should return paginated backup list', async () => {
      const mockBackups = [
        { id: 'backup-1', name: 'backup-1', status: 'COMPLETED' },
        { id: 'backup-2', name: 'backup-2', status: 'IN_PROGRESS' },
      ];

      (mockPrisma.backup.findMany as jest.Mock).mockResolvedValue(mockBackups);
      (mockPrisma.backup.count as jest.Mock).mockResolvedValue(2);

      const result = await service.listBackups({ limit: 20, offset: 0 });

      expect(result.backups).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it('should filter by status', async () => {
      (mockPrisma.backup.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.backup.count as jest.Mock).mockResolvedValue(0);

      await service.listBackups({ status: 'COMPLETED' });

      expect(mockPrisma.backup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );
    });

    it('should filter by type and source', async () => {
      (mockPrisma.backup.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.backup.count as jest.Mock).mockResolvedValue(0);

      await service.listBackups({
        type: 'FULL',
        source: 'DATABASE'
      });

      expect(mockPrisma.backup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'FULL',
            source: 'DATABASE',
          }),
        })
      );
    });
  });

  describe('getStorageUsage', () => {
    it('should calculate storage usage correctly', async () => {
      (mockPrisma.backup.aggregate as jest.Mock).mockResolvedValue({
        _sum: { sizeBytes: BigInt(1073741824) }, // 1 GB
        _count: 5,
        _min: { createdAt: new Date('2024-01-01') },
        _max: { createdAt: new Date('2024-01-15') },
      });
      (mockPrisma.backupStorageUsage.create as jest.Mock).mockResolvedValue({});

      process.env.BACKUP_QUOTA_GB = '100';

      const result = await service.getStorageUsage();

      expect(result.totalSizeBytes).toBe(1073741824);
      expect(result.backupCount).toBe(5);
      expect(result.quotaBytes).toBe(100 * 1024 * 1024 * 1024);
      expect(result.usagePercent).toBeCloseTo(1.0, 1);
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup from storage and database', async () => {
      const mockBackup = {
        id: 'backup-1',
        name: 'backup-1',
        storagePath: '2024/01-15/backup-1.tar.gz.enc',
      };

      (mockPrisma.backup.findUnique as jest.Mock).mockResolvedValue(mockBackup);
      (mockPrisma.backup.delete as jest.Mock).mockResolvedValue(mockBackup);
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.deleteBackup('backup-1', 'user-1');

      expect(mockPrisma.backup.delete).toHaveBeenCalledWith({
        where: { id: 'backup-1' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw error if backup not found', async () => {
      (mockPrisma.backup.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.deleteBackup('non-existent', 'user-1')
      ).rejects.toThrow('備份不存在');
    });
  });
});
```

### 7.2 Integration Tests

```typescript
// __tests__/integration/backup.integration.test.ts

import { BackupService } from '@/services/backup/backup.service';
import { BackupSchedulerService } from '@/services/backup/backup-scheduler.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Backup Integration Tests', () => {
  beforeAll(async () => {
    // Setup test database
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Manual Backup Flow', () => {
    it('should create and track backup progress', async () => {
      // Test implementation
    });
  });

  describe('Scheduled Backup Flow', () => {
    it('should execute backup on schedule', async () => {
      // Test implementation
    });

    it('should enforce retention policy', async () => {
      // Test implementation
    });
  });

  describe('Backup Cleanup', () => {
    it('should cleanup expired backups', async () => {
      // Test implementation
    });
  });
});
```

---

## 8. Dependencies

### 8.1 Pre-requisite Stories
- **Story 1-0**: 專案初始化與基礎架構
- **Story 12-4**: 系統配置管理（配置備份）

### 8.2 NPM Packages
```json
{
  "dependencies": {
    "@azure/storage-blob": "^12.17.0",
    "node-cron": "^3.0.3",
    "cron-parser": "^4.9.0"
  },
  "devDependencies": {
    "@types/node-cron": "^3.0.11"
  }
}
```

### 8.3 Environment Variables
```env
# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your-azure-connection-string
BACKUP_CONTAINER_NAME=backups

# Backup Encryption
BACKUP_ENCRYPTION_KEY=your-32-character-encryption-key

# PostgreSQL (for pg_dump)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=your_database
DATABASE_USER=your_user
DATABASE_PASSWORD=your_password

# Upload Directory
UPLOAD_DIR=./uploads

# Quota
BACKUP_QUOTA_GB=100
```

---

## 9. Acceptance Criteria Verification

### AC 12-5-1: 備份狀態顯示
| 驗證項目 | 實作位置 | 驗證方式 |
|---------|---------|---------|
| 自動備份狀態（啟用/停用） | StatusCard + getBackupStatusOverview() | UI 顯示 isAutoBackupEnabled |
| 最近一次備份時間 | StatusCard + lastSuccessful | UI 顯示 completedAt |
| 備份保留策略 | ScheduleCard + retentionDays/maxBackups | UI 顯示排程設定 |
| 儲存空間使用情況 | StatusCard + getStorageUsage() | UI 顯示 totalSize/quota/percent |

### AC 12-5-2: 備份列表顯示
| 驗證項目 | 實作位置 | 驗證方式 |
|---------|---------|---------|
| 備份時間 | BackupListTable + createdAt/completedAt | UI 顯示時間 |
| 備份類型（完整/增量） | BackupListTable + type | UI 顯示 TYPE_LABELS |
| 備份大小 | BackupListTable + sizeBytes | UI 顯示 formatSize() |
| 備份狀態 | BackupListTable + status | UI 顯示 STATUS_LABELS + 顏色 |

### AC 12-5-3: 手動立即備份
| 驗證項目 | 實作位置 | 驗證方式 |
|---------|---------|---------|
| 點擊「立即備份」 | handleCreateBackup() | UI 按鈕事件 |
| 顯示備份進度 | BackupProgress + progress | UI 顯示百分比 |
| 完成後顯示結果 | status (COMPLETED/FAILED) | UI 顯示狀態 |
| 備份包含：數據庫、上傳文件、系統配置 | backupDatabase/Files/Config() | 備份內容驗證 |

### AC 12-5-4: 備份排程配置
| 驗證項目 | 實作位置 | 驗證方式 |
|---------|---------|---------|
| 備份頻率（每日/每週） | ScheduleModal + cronExpression | Cron 表達式設定 |
| 備份時間（選擇低峰時段） | CRON_PRESETS | 預設凌晨 2-3 點 |
| 保留期限（保留最近 N 個備份） | retentionDays + maxBackups | 保留策略設定 |
| 備份類型（完整/增量） | backupType selector | UI 選擇器 |

---

## 10. Performance Considerations

### 10.1 Backup Performance
- **串流處理**: 使用 Node.js streams 處理大型檔案
- **並行上傳**: Azure Blob 20 並行連接
- **壓縮優化**: pg_dump compress=9 最大壓縮
- **非阻塞執行**: 備份異步執行，不阻塞 API 回應

### 10.2 Database Considerations
- **索引優化**: status + createdAt 複合索引
- **分頁查詢**: 預設 limit=20, offset 分頁
- **BigInt 處理**: sizeBytes 使用 BigInt 支援大型備份

### 10.3 Storage Optimization
- **分層路徑**: YYYY/MM-DD/backupId.enc 組織結構
- **自動清理**: 過期備份自動刪除
- **配額監控**: 使用量百分比追蹤

---

## 11. Security Considerations

### 11.1 Encryption
- **AES-256-CBC**: 備份檔案加密
- **scrypt**: 密鑰衍生函數
- **IV 隨機生成**: 每次加密使用隨機 IV

### 11.2 Access Control
- **ADMIN 權限**: 所有備份操作需 ADMIN 角色
- **審計日誌**: 刪除/下載操作記錄

### 11.3 Sensitive Data
- **排除加密配置**: 備份時排除 isEncrypted=true 的配置
- **安全環境變數**: 僅備份非敏感環境變數

---

## 12. Monitoring & Observability

### 12.1 Metrics
```typescript
// 備份指標
const backupMetrics = {
  backup_total: 'Counter - 備份總數',
  backup_success: 'Counter - 成功備份數',
  backup_failed: 'Counter - 失敗備份數',
  backup_duration_seconds: 'Histogram - 備份耗時',
  backup_size_bytes: 'Histogram - 備份大小',
  storage_usage_percent: 'Gauge - 儲存使用率',
};
```

### 12.2 Alerts
- 備份失敗通知
- 儲存空間使用率 > 80% 警告
- 排程備份未執行警告

### 12.3 Logging
```typescript
// 日誌格式
{
  timestamp: '2024-01-15T02:00:00Z',
  level: 'info',
  service: 'backup',
  action: 'backup_completed',
  backupId: 'cuid...',
  duration: 120000,
  sizeBytes: 1073741824,
}
```

---

## 13. Verification Checklist

### 功能驗證
- [ ] 備份狀態概覽正確顯示
- [ ] 備份列表正確載入與分頁
- [ ] 手動備份功能正常運作
- [ ] 備份進度即時更新
- [ ] 備份排程正確執行
- [ ] Cron 表達式驗證正確
- [ ] 保留策略正確執行
- [ ] 過期備份自動清理
- [ ] 備份下載功能正常
- [ ] 備份刪除功能正常

### 安全驗證
- [ ] 備份檔案正確 AES-256-CBC 加密
- [ ] 敏感配置不包含在備份中
- [ ] 僅 ADMIN 角色可操作備份功能
- [ ] 審計日誌正確記錄

### 效能驗證
- [ ] 大型數據庫備份正常完成
- [ ] 備份不影響系統正常運作
- [ ] 儲存空間使用量正確計算
- [ ] 串流上傳正確處理大型檔案

### 整合驗證
- [ ] Azure Blob Storage 連接正常
- [ ] PostgreSQL pg_dump 執行正常
- [ ] node-cron 排程正常運作
- [ ] 通知服務整合正常
