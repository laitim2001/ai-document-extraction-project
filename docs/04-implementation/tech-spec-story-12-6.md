# Tech Spec: Story 12-6 - Data Recovery Functionality (數據恢復功能)

## 1. Overview

### 1.1 Story Information
- **Story ID**: 12-6
- **Epic**: Epic 12 - 系統管理與監控
- **Priority**: Critical
- **Estimated Points**: 13
- **FR Coverage**: FR63

### 1.2 User Story
**As a** 系統管理員,
**I want** 從備份恢復系統數據,
**So that** 在發生數據損失時可以快速恢復。

### 1.3 Scope
本 Tech Spec 涵蓋完整的數據恢復系統，包括：
- 多種恢復類型支援（完整/部分/演練/時間點）
- 恢復選項配置與確認機制
- 恢復前自動備份保護
- 即時進度追蹤與預估時間
- 恢復結果驗證與報告
- 恢復演練功能（隔離環境測試）
- 回滾機制

---

## 2. Technical Architecture

### 2.1 System Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────────────┐
│                       DATA RECOVERY SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    PRESENTATION LAYER                            │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────────┐  │   │
│  │  │RestoreManagement│ │  RestoreModal   │ │RestoreDetailModal │  │   │
│  │  │                 │ │                 │ │                   │  │   │
│  │  │ • Record List   │ │ • Backup Select │ │ • Progress View   │  │   │
│  │  │ • Status Display│ │ • Type Config   │ │ • Log Viewer      │  │   │
│  │  │ • Actions       │ │ • Confirmation  │ │ • Result Report   │  │   │
│  │  └────────┬────────┘ └────────┬────────┘ └────────┬──────────┘  │   │
│  └───────────┼───────────────────┼───────────────────┼──────────────┘   │
│              │                   │                   │                  │
│  ┌───────────▼───────────────────▼───────────────────▼──────────────┐   │
│  │                        API LAYER                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │                 /api/admin/restore/*                         │ │   │
│  │  │  GET  /          - List restore records                      │ │   │
│  │  │  POST /          - Start restore operation                   │ │   │
│  │  │  GET  /:id       - Get restore details                       │ │   │
│  │  │  DELETE /:id     - Cancel restore                            │ │   │
│  │  │  GET  /:id/logs  - Get restore logs                          │ │   │
│  │  │  POST /:id/rollback - Rollback restore                       │ │   │
│  │  │  GET  /backup/:id/preview - Preview backup contents          │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────▼────────────────────────────────┐   │
│  │                      SERVICE LAYER                                │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                   RestoreService                          │   │   │
│  │  │                                                           │   │   │
│  │  │  • startRestore()        - 開始恢復操作                   │   │   │
│  │  │  • executeRestore()      - 執行恢復流程                   │   │   │
│  │  │  • validateBackup()      - 驗證備份完整性                 │   │   │
│  │  │  • createPreRestoreBackup() - 恢復前備份                  │   │   │
│  │  │  • downloadAndDecrypt()  - 下載解密備份                   │   │   │
│  │  │  • restoreDatabase()     - 恢復數據庫                     │   │   │
│  │  │  • restoreFiles()        - 恢復文件                       │   │   │
│  │  │  • restoreConfig()       - 恢復配置                       │   │   │
│  │  │  • verifyRestoration()   - 驗證恢復結果                   │   │   │
│  │  │  • cancelRestore()       - 取消恢復                       │   │   │
│  │  │  • rollbackRestore()     - 回滾恢復                       │   │   │
│  │  │  • cleanupDrillEnvironment() - 清理演練環境               │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────▼────────────────────────────────┐   │
│  │                    DATA ACCESS LAYER                              │   │
│  │  ┌───────────────────────────────────────────────────────────┐   │   │
│  │  │                    Prisma ORM                              │   │   │
│  │  │  ┌───────────────┐ ┌──────────────┐ ┌──────────────────┐  │   │   │
│  │  │  │ RestoreRecord │ │ RestoreDrill │ │   RestoreLog     │  │   │   │
│  │  │  └───────────────┘ └──────────────┘ └──────────────────┘  │   │   │
│  │  │  ┌───────────────┐ ┌──────────────────────────────────┐   │   │   │
│  │  │  │    Backup     │ │         AuditLog                 │   │   │   │
│  │  │  └───────────────┘ └──────────────────────────────────┘   │   │   │
│  │  └───────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────▼────────────────────────────────┐   │
│  │                   EXTERNAL SERVICES                               │   │
│  │  ┌───────────────┐  ┌───────────────────┐  ┌──────────────────┐  │   │
│  │  │  PostgreSQL   │  │  Azure Blob      │  │   File System    │  │   │
│  │  │  (pg_restore) │  │  Storage         │  │                  │  │   │
│  │  │               │  │                  │  │ • Uploads dir    │  │   │
│  │  │ • Full restore│  │ • Download blob  │  │ • Temp storage   │  │   │
│  │  │ • Table select│  │ • Decrypt file   │  │ • Drill env      │  │   │
│  │  │ • Drill DB    │  │ • Stream read    │  │                  │  │   │
│  │  └───────────────┘  └───────────────────┘  └──────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Restore Execution Flow
```
┌─────────────────────────────────────────────────────────────────────────┐
│                      RESTORE EXECUTION PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐         │
│   │   SELECT    │───▶│  CONFIRM    │───▶│   CREATE RECORD     │         │
│   │   BACKUP    │    │  (2FA Text) │    │   Status: PENDING   │         │
│   └─────────────┘    └─────────────┘    └──────────┬──────────┘         │
│                                                     │                    │
│   ┌─────────────────────────────────────────────────▼──────────────────┐│
│   │                    PHASE 1: VALIDATION (5%)                        ││
│   │  • Verify backup exists in Azure Blob                              ││
│   │  • Check backup status = COMPLETED                                 ││
│   │  • Validate storage path accessible                                ││
│   │  Status: VALIDATING                                                ││
│   └─────────────────────────────────────────────────┬──────────────────┘│
│                                                     │                    │
│   ┌─────────────────────────────────────────────────▼──────────────────┐│
│   │              PHASE 2: PRE-RESTORE BACKUP (10-20%)                  ││
│   │  [Skip if DRILL mode]                                              ││
│   │  • Call BackupService.createBackup()                               ││
│   │  • Wait for backup completion (max 30 min)                         ││
│   │  • Store preRestoreBackupId for rollback                           ││
│   │  Status: PRE_BACKUP                                                ││
│   └─────────────────────────────────────────────────┬──────────────────┘│
│                                                     │                    │
│   ┌─────────────────────────────────────────────────▼──────────────────┐│
│   │              PHASE 3: DOWNLOAD & DECRYPT (20-30%)                  ││
│   │  • Download encrypted backup from Azure Blob                       ││
│   │  • Read IV from file header (first 16 bytes)                       ││
│   │  • AES-256-CBC decryption with scrypt-derived key                  ││
│   │  • Verify SHA-256 checksum matches                                 ││
│   │  • Extract tar.gz archive to temp directory                        ││
│   │  Status: IN_PROGRESS                                               ││
│   └─────────────────────────────────────────────────┬──────────────────┘│
│                                                     │                    │
│                    ┌────────────────────────────────┼─────────────────┐ │
│                    ▼                                ▼                 ▼ │
│   ┌──────────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│   │  RESTORE DATABASE    │  │  RESTORE FILES   │  │ RESTORE CONFIG  │  │
│   │  (30% - 60%)         │  │  (60% - 80%)     │  │ (80% - 85%)     │  │
│   │                      │  │                  │  │                 │  │
│   │ • pg_restore command │  │ • tar extract    │  │ • Parse JSON    │  │
│   │ • --clean option     │  │ • To uploads/    │  │ • Upsert config │  │
│   │ • Table selection    │  │ • File selection │  │ • Skip secrets  │  │
│   │ • DRILL: temp DB     │  │ • DRILL: temp dir│  │ • DRILL: skip   │  │
│   └──────────┬───────────┘  └────────┬─────────┘  └────────┬────────┘  │
│              └──────────────────────────────────────────────┘          │
│                                        │                                │
│   ┌────────────────────────────────────▼────────────────────────────┐  │
│   │                   PHASE 4: VERIFICATION (85-95%)                 │  │
│   │  • Test database connectivity and basic queries                  │  │
│   │  • Verify upload directory exists                                │  │
│   │  • Count restored records per table                              │  │
│   │  • Compare with backup contents metadata                         │  │
│   │  Status: VERIFYING                                               │  │
│   └─────────────────────────────────────────────────┬────────────────┘  │
│                                                     │                    │
│   ┌─────────────────────────────────────────────────▼──────────────────┐│
│   │                  PHASE 5: FINALIZE (95-100%)                       ││
│   │  • Cleanup temp files and directories                             ││
│   │  • Update RestoreRecord with final stats                          ││
│   │  • Set validationPassed = true/false                              ││
│   │  • Create RestoreDrill record (if DRILL mode)                     ││
│   │  • Write final audit log entry                                    ││
│   │  Status: COMPLETED                                                 ││
│   └────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Component Hierarchy
```
RestoreManagement (主容器)
├── WarningBanner
│   └── SafetyInstructions
├── ActionHeader
│   └── StartRestoreButton
├── RestoreRecordTable
│   └── RestoreRecordRow
│       ├── BackupInfo
│       ├── TypeBadge
│       ├── ScopeTags
│       ├── StatusBadge (with progress)
│       ├── UserInfo
│       ├── TimeDisplay
│       └── ActionButtons (Details/Cancel/Rollback)
├── RestoreModal (3-step wizard)
│   ├── Step1: BackupSelection
│   │   ├── BackupList
│   │   └── BackupPreview
│   ├── Step2: RestoreOptions
│   │   ├── TypeSelector (FULL/PARTIAL/DRILL)
│   │   ├── ScopeCheckboxes
│   │   └── TableSelector (PARTIAL mode)
│   └── Step3: Confirmation
│       ├── RestoreSummary
│       ├── WarningBox
│       └── ConfirmationInput
└── RestoreDetailModal
    ├── BasicInfo
    ├── ProgressBar (if in progress)
    ├── ResultStats (if completed)
    └── LogViewer
```

---

## 3. Data Models

### 3.1 Prisma Schema

```prisma
// ============================================================
// RESTORE MANAGEMENT MODELS
// ============================================================

// 恢復類型
enum RestoreType {
  FULL            // 完整恢復 - 替換所有數據
  PARTIAL         // 部分恢復 - 選擇特定表/文件
  DRILL           // 恢復演練 - 恢復至隔離環境
  POINT_IN_TIME   // 時間點恢復 - 恢復到特定時間點
}

// 恢復狀態
enum RestoreStatus {
  PENDING         // 等待執行
  VALIDATING      // 驗證備份中
  PRE_BACKUP      // 恢復前備份中
  IN_PROGRESS     // 恢復執行中
  VERIFYING       // 驗證結果中
  COMPLETED       // 恢復完成
  FAILED          // 恢復失敗
  ROLLED_BACK     // 已回滾
}

// 恢復範圍
enum RestoreScope {
  DATABASE        // 數據庫
  FILES           // 上傳文件
  CONFIG          // 系統配置
  ALL             // 全部範圍
}

// ============================================================
// 恢復記錄 - 主要恢復操作紀錄
// ============================================================
model RestoreRecord {
  id                    String          @id @default(cuid())

  // 關聯備份
  backupId              String
  backup                Backup          @relation(fields: [backupId], references: [id])

  // 恢復設定
  type                  RestoreType     // 恢復類型
  scope                 RestoreScope[]  // 恢復範圍 (可多選)
  status                RestoreStatus   @default(PENDING)

  // 恢復選項
  targetEnvironment     String?         // 目標環境識別碼
  selectedTables        String[]        // 選擇的資料表 (部分恢復時)
  selectedFiles         String[]        // 選擇的文件路徑 (部分恢復時)

  // 進度追蹤
  progress              Int             @default(0)         // 0-100
  currentStep           String?         // 當前步驟描述
  estimatedTimeRemaining Int?           // 預估剩餘時間 (秒)

  // 恢復前備份
  preRestoreBackupId    String?         // 恢復前自動備份的 ID

  // 恢復結果統計
  restoredRecords       Json?           // { tableName: recordCount, ... }
  restoredFiles         Int?            // 恢復的文件數量
  restoredConfigs       Int?            // 恢復的配置數量

  // 驗證結果
  validationPassed      Boolean?        // 驗證是否通過
  validationDetails     Json?           // { database: {...}, files: {...}, ... }

  // 錯誤資訊
  errorMessage          String?         // 錯誤訊息
  errorDetails          Json?           // 詳細錯誤資訊

  // 時間戳記
  startedAt             DateTime?       // 開始時間
  completedAt           DateTime?       // 完成時間

  // 審計資訊
  createdAt             DateTime        @default(now())
  createdBy             String
  createdByUser         User            @relation(fields: [createdBy], references: [id])

  // 二次確認
  confirmationText      String?         // 使用者輸入的確認文字
  confirmedAt           DateTime?       // 確認時間

  // 關聯
  drill                 RestoreDrill?   // 演練記錄
  logs                  RestoreLog[]    // 操作日誌

  @@index([backupId])
  @@index([status, createdAt])
  @@index([createdBy])
  @@map("restore_records")
}

// ============================================================
// 恢復演練記錄 - 演練環境資訊
// ============================================================
model RestoreDrill {
  id                    String          @id @default(cuid())

  // 關聯恢復記錄
  restoreRecordId       String          @unique
  restoreRecord         RestoreRecord   @relation(fields: [restoreRecordId], references: [id], onDelete: Cascade)

  // 演練環境資訊
  drillEnvironment      String          // 演練環境識別碼
  drillDatabaseName     String?         // 演練用數據庫名稱
  drillStoragePath      String?         // 演練用儲存路徑

  // 演練結果
  drillStatus           String?         // passed / failed / partial
  drillReport           Json?           // 詳細演練報告

  // 清理狀態
  cleanedUp             Boolean         @default(false)
  cleanedUpAt           DateTime?

  createdAt             DateTime        @default(now())

  @@index([drillStatus])
  @@map("restore_drills")
}

// ============================================================
// 恢復操作日誌 - 詳細步驟記錄
// ============================================================
model RestoreLog {
  id                    String          @id @default(cuid())

  // 關聯恢復記錄
  restoreRecordId       String
  restoreRecord         RestoreRecord   @relation(fields: [restoreRecordId], references: [id], onDelete: Cascade)

  // 日誌內容
  timestamp             DateTime        @default(now())
  level                 String          // info / warn / error
  step                  String          // 步驟名稱
  message               String          // 日誌訊息
  details               Json?           // 額外詳情

  @@index([restoreRecordId, timestamp])
  @@map("restore_logs")
}
```

### 3.2 Type Definitions

```typescript
// types/restore.types.ts

import { RestoreType, RestoreStatus, RestoreScope } from '@prisma/client';

// ============================================================
// 恢復選項
// ============================================================
export interface RestoreOptions {
  backupId: string;
  type: RestoreType;
  scope: RestoreScope[];
  selectedTables?: string[];
  selectedFiles?: string[];
  targetEnvironment?: string;
  confirmationText: string;
}

// ============================================================
// 恢復進度
// ============================================================
export interface RestoreProgress {
  restoreId: string;
  status: RestoreStatus;
  progress: number;           // 0-100
  currentStep: string;        // 當前步驟描述
  estimatedTimeRemaining?: number; // 秒
  error?: string;
}

// ============================================================
// 恢復記錄 (含關聯)
// ============================================================
export interface RestoreRecordWithRelations {
  id: string;
  backupId: string;
  type: RestoreType;
  scope: RestoreScope[];
  status: RestoreStatus;
  progress: number;
  currentStep?: string;
  estimatedTimeRemaining?: number;
  selectedTables: string[];
  selectedFiles: string[];
  preRestoreBackupId?: string;
  restoredRecords?: Record<string, number>;
  restoredFiles?: number;
  restoredConfigs?: number;
  validationPassed?: boolean;
  validationDetails?: ValidationDetails;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  backup: {
    name: string;
    type: string;
    completedAt?: Date;
  };
  createdByUser: {
    displayName: string;
  };
}

// ============================================================
// 驗證詳情
// ============================================================
export interface ValidationDetails {
  database?: {
    accessible: boolean;
    sampleCount?: number;
    error?: string;
  };
  files?: {
    directoryExists: boolean;
    fileCount?: number;
  };
  config?: {
    configCount: number;
  };
}

// ============================================================
// 備份預覽
// ============================================================
export interface BackupPreview {
  tables: string[];
  files: string[];
  configs: string[];
  summary: {
    databaseRecords: number;
    fileCount: number;
    configCount: number;
  };
}

// ============================================================
// 恢復列表選項
// ============================================================
export interface RestoreListOptions {
  status?: RestoreStatus;
  type?: RestoreType;
  limit?: number;
  offset?: number;
}

// ============================================================
// 進度回調函數
// ============================================================
export type RestoreProgressCallback = (progress: RestoreProgress) => void;

// ============================================================
// 確認文字常數
// ============================================================
export const CONFIRMATION_TEXTS = {
  RESTORE: 'RESTORE-CONFIRM',
  DRILL: 'RESTORE-DRILL',
  ROLLBACK: 'ROLLBACK-CONFIRM',
} as const;
```

---

## 4. Service Implementation

### 4.1 RestoreService

```typescript
// services/restore/restore.service.ts

import {
  PrismaClient,
  RestoreType,
  RestoreStatus,
  RestoreScope,
  Backup,
  RestoreRecord
} from '@prisma/client';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  rmSync,
  promises as fsPromises
} from 'fs';
import { pipeline } from 'stream/promises';
import { createDecipheriv, scryptSync, createHash } from 'crypto';
import * as path from 'path';
import * as os from 'os';
import {
  RestoreOptions,
  RestoreProgress,
  RestoreProgressCallback,
  ValidationDetails,
  BackupPreview,
  RestoreListOptions,
  CONFIRMATION_TEXTS
} from '@/types/restore.types';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// ============================================================
// RESTORE SERVICE - 數據恢復服務
// ============================================================
export class RestoreService {
  private containerClient: ContainerClient;
  private encryptionKey: Buffer;

  // ------------------------------------------------------------
  // 建構函數
  // ------------------------------------------------------------
  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is required');
    }

    const containerName = process.env.BACKUP_CONTAINER_NAME || 'backups';
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = blobServiceClient.getContainerClient(containerName);

    const encKey = process.env.BACKUP_ENCRYPTION_KEY;
    if (!encKey) {
      throw new Error('BACKUP_ENCRYPTION_KEY is required');
    }
    this.encryptionKey = scryptSync(encKey, 'backup-salt-v1', 32);
  }

  // ============================================================
  // 開始恢復操作
  // ============================================================
  async startRestore(
    options: RestoreOptions,
    userId: string,
    onProgress?: RestoreProgressCallback
  ): Promise<RestoreRecord> {
    // 驗證備份存在且已完成
    const backup = await prisma.backup.findUnique({
      where: { id: options.backupId },
    });

    if (!backup) {
      throw new Error('備份不存在');
    }

    if (backup.status !== 'COMPLETED') {
      throw new Error('只能從已完成的備份恢復');
    }

    // 驗證確認文字
    const expectedConfirmation = options.type === 'DRILL'
      ? CONFIRMATION_TEXTS.DRILL
      : CONFIRMATION_TEXTS.RESTORE;

    if (options.confirmationText !== expectedConfirmation) {
      throw new Error(`請輸入確認文字: ${expectedConfirmation}`);
    }

    // 創建恢復記錄
    const restoreRecord = await prisma.restoreRecord.create({
      data: {
        backupId: options.backupId,
        type: options.type,
        scope: options.scope,
        status: 'PENDING',
        selectedTables: options.selectedTables || [],
        selectedFiles: options.selectedFiles || [],
        targetEnvironment: options.targetEnvironment || 'production',
        confirmationText: options.confirmationText,
        confirmedAt: new Date(),
        createdBy: userId,
      },
    });

    // 記錄審計日誌
    await this.createAuditLog(
      userId,
      'RESTORE_INITIATED',
      restoreRecord.id,
      `開始恢復操作 - 類型: ${options.type}, 範圍: ${options.scope.join(', ')}`,
      { backupId: options.backupId, restoreType: options.type }
    );

    // 異步執行恢復
    this.executeRestore(restoreRecord.id, backup, options, onProgress).catch((error) => {
      console.error(`Restore ${restoreRecord.id} failed:`, error);
    });

    return restoreRecord;
  }

  // ============================================================
  // 執行恢復流程 (私有)
  // ============================================================
  private async executeRestore(
    restoreId: string,
    backup: Backup,
    options: RestoreOptions,
    onProgress?: RestoreProgressCallback
  ): Promise<void> {
    // 日誌記錄輔助函數
    const log = async (level: string, step: string, message: string, details?: any) => {
      await prisma.restoreLog.create({
        data: { restoreRecordId: restoreId, level, step, message, details },
      });
    };

    // 進度更新輔助函數
    const updateProgress = async (
      status: RestoreStatus,
      progress: number,
      step: string,
      estimatedTime?: number
    ) => {
      await prisma.restoreRecord.update({
        where: { id: restoreId },
        data: {
          status,
          progress,
          currentStep: step,
          estimatedTimeRemaining: estimatedTime,
          startedAt: status === 'VALIDATING' ? new Date() : undefined,
        },
      });
      onProgress?.({
        restoreId,
        status,
        progress,
        currentStep: step,
        estimatedTimeRemaining: estimatedTime
      });
    };

    try {
      // ============================================
      // Phase 1: 驗證備份
      // ============================================
      await updateProgress('VALIDATING', 5, '驗證備份完整性...');
      await log('info', 'validation', '開始驗證備份');
      await this.validateBackup(backup);
      await log('info', 'validation', '備份驗證通過');

      // ============================================
      // Phase 2: 恢復前備份 (非演練模式)
      // ============================================
      let preRestoreBackupId: string | undefined;
      if (options.type !== 'DRILL') {
        await updateProgress('PRE_BACKUP', 10, '創建恢復前備份...', 1800);
        await log('info', 'pre_backup', '開始創建恢復前備份');
        preRestoreBackupId = await this.createPreRestoreBackup(restoreId);
        await log('info', 'pre_backup', `恢復前備份完成: ${preRestoreBackupId}`);
      } else {
        await log('info', 'pre_backup', '演練模式 - 跳過恢復前備份');
      }

      // ============================================
      // Phase 3: 下載並解密備份
      // ============================================
      await updateProgress('IN_PROGRESS', 20, '下載備份檔案...', 600);
      await log('info', 'download', '開始下載備份檔案');
      const tempDir = await this.downloadAndDecrypt(backup);
      await log('info', 'download', `備份檔案下載完成: ${tempDir}`);

      // ============================================
      // Phase 4: 執行恢復
      // ============================================
      const stats: Record<string, any> = {};
      let currentProgress = 30;

      // 恢復數據庫
      if (options.scope.includes('ALL') || options.scope.includes('DATABASE')) {
        await updateProgress('IN_PROGRESS', currentProgress, '恢復數據庫...', 900);
        await log('info', 'restore_database', '開始恢復數據庫');

        stats.database = await this.restoreDatabase(
          tempDir,
          options.type,
          options.selectedTables
        );

        await log('info', 'restore_database', `數據庫恢復完成`, stats.database);
        currentProgress = 60;
      }

      // 恢復文件
      if (options.scope.includes('ALL') || options.scope.includes('FILES')) {
        await updateProgress('IN_PROGRESS', currentProgress, '恢復上傳文件...', 300);
        await log('info', 'restore_files', '開始恢復文件');

        stats.files = await this.restoreFiles(
          tempDir,
          options.type,
          options.selectedFiles
        );

        await log('info', 'restore_files', `文件恢復完成: ${stats.files} 個文件`);
        currentProgress = 80;
      }

      // 恢復配置
      if (options.scope.includes('ALL') || options.scope.includes('CONFIG')) {
        await updateProgress('IN_PROGRESS', currentProgress, '恢復系統配置...', 60);
        await log('info', 'restore_config', '開始恢復配置');

        stats.config = await this.restoreConfig(tempDir, options.type);

        await log('info', 'restore_config', `配置恢復完成: ${stats.config} 個配置`);
      }

      // ============================================
      // Phase 5: 驗證恢復結果
      // ============================================
      await updateProgress('VERIFYING', 90, '驗證恢復結果...', 120);
      await log('info', 'verification', '開始驗證恢復結果');
      const validation = await this.verifyRestoration(backup, options.scope);
      await log('info', 'verification', `驗證完成: ${validation.passed ? '通過' : '失敗'}`, validation);

      // ============================================
      // Phase 6: 完成
      // ============================================
      await this.cleanupTempDir(tempDir);

      await prisma.restoreRecord.update({
        where: { id: restoreId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          currentStep: '恢復完成',
          estimatedTimeRemaining: 0,
          preRestoreBackupId,
          restoredRecords: stats.database,
          restoredFiles: stats.files,
          restoredConfigs: stats.config,
          validationPassed: validation.passed,
          validationDetails: validation,
          completedAt: new Date(),
        },
      });

      await log('info', 'complete', '恢復操作完成');

      onProgress?.({
        restoreId,
        status: 'COMPLETED',
        progress: 100,
        currentStep: '恢復完成',
      });

      // 演練模式 - 創建演練記錄
      if (options.type === 'DRILL') {
        await this.createDrillRecord(restoreId, validation);
      }

    } catch (error: any) {
      await log('error', 'failed', `恢復失敗: ${error.message}`, {
        stack: error.stack
      });

      await prisma.restoreRecord.update({
        where: { id: restoreId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          errorDetails: { stack: error.stack },
          completedAt: new Date(),
        },
      });

      onProgress?.({
        restoreId,
        status: 'FAILED',
        progress: 0,
        currentStep: '恢復失敗',
        error: error.message,
      });

      throw error;
    }
  }

  // ============================================================
  // 驗證備份完整性
  // ============================================================
  private async validateBackup(backup: Backup): Promise<void> {
    if (!backup.storagePath) {
      throw new Error('備份檔案路徑不存在');
    }

    const blockBlobClient = this.containerClient.getBlockBlobClient(backup.storagePath);
    const exists = await blockBlobClient.exists();

    if (!exists) {
      throw new Error('備份檔案不存在於雲端儲存空間');
    }

    // 取得屬性確認可存取
    await blockBlobClient.getProperties();
  }

  // ============================================================
  // 創建恢復前備份
  // ============================================================
  private async createPreRestoreBackup(restoreId: string): Promise<string> {
    const { backupService } = await import('./backup.service');

    const backup = await backupService.createBackup(
      {
        type: 'FULL',
        source: 'FULL_SYSTEM',
        trigger: 'PRE_RESTORE',
        description: `恢復前自動備份 (restore: ${restoreId})`,
      },
      'system'
    );

    // 等待備份完成 (最多 30 分鐘)
    const maxWaitTime = 30 * 60 * 1000;
    const pollInterval = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const currentBackup = await prisma.backup.findUnique({
        where: { id: backup.id },
      });

      if (currentBackup?.status === 'COMPLETED') {
        return backup.id;
      }

      if (currentBackup?.status === 'FAILED') {
        throw new Error(`恢復前備份失敗: ${currentBackup.errorMessage}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('恢復前備份超時 (30 分鐘)');
  }

  // ============================================================
  // 下載並解密備份
  // ============================================================
  private async downloadAndDecrypt(backup: Backup): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `restore-${backup.id}-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    const encryptedPath = path.join(tempDir, 'backup.tar.gz.enc');
    const decryptedPath = path.join(tempDir, 'backup.tar.gz');

    // 下載加密備份
    const blockBlobClient = this.containerClient.getBlockBlobClient(backup.storagePath!);
    const downloadResponse = await blockBlobClient.download();

    const writeStream = createWriteStream(encryptedPath);
    await pipeline(downloadResponse.readableStreamBody!, writeStream);

    // 讀取加密檔案
    const encryptedData = await fsPromises.readFile(encryptedPath);

    // 提取 IV (前 16 bytes)
    const iv = encryptedData.subarray(0, 16);
    const encrypted = encryptedData.subarray(16);

    // AES-256-CBC 解密
    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    await fsPromises.writeFile(decryptedPath, decrypted);

    // 驗證 checksum
    if (backup.checksum) {
      const hash = createHash('sha256');
      hash.update(decrypted);
      const calculatedChecksum = hash.digest('hex');

      if (calculatedChecksum !== backup.checksum) {
        throw new Error('備份校驗碼不符，檔案可能已損壞');
      }
    }

    // 解壓縮
    await execAsync(`tar -xzf "${decryptedPath}" -C "${tempDir}"`);

    // 清理加密檔案
    await fsPromises.unlink(encryptedPath);
    await fsPromises.unlink(decryptedPath);

    return tempDir;
  }

  // ============================================================
  // 恢復數據庫
  // ============================================================
  private async restoreDatabase(
    tempDir: string,
    restoreType: RestoreType,
    selectedTables?: string[]
  ): Promise<Record<string, number>> {
    const dumpFile = path.join(tempDir, 'database.dump');

    if (!existsSync(dumpFile)) {
      throw new Error('備份中不包含數據庫檔案');
    }

    const dbHost = process.env.DATABASE_HOST || 'localhost';
    const dbPort = process.env.DATABASE_PORT || '5432';
    const dbUser = process.env.DATABASE_USER!;
    const dbPassword = process.env.DATABASE_PASSWORD!;

    let dbName = process.env.DATABASE_NAME!;

    // 設定環境變數
    const env = { ...process.env, PGPASSWORD: dbPassword };

    // 演練模式使用臨時數據庫
    if (restoreType === 'DRILL') {
      dbName = `${dbName}_drill_${Date.now()}`;
      await execAsync(
        `createdb -h ${dbHost} -p ${dbPort} -U ${dbUser} ${dbName}`,
        { env }
      );
    }

    // 執行 pg_restore
    if (selectedTables && selectedTables.length > 0) {
      // 部分恢復 - 只恢復選定的表
      for (const table of selectedTables) {
        await execAsync(
          `pg_restore -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -t ${table} --clean --if-exists "${dumpFile}"`,
          { env }
        );
      }
    } else {
      // 完整恢復
      await execAsync(
        `pg_restore -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --clean --if-exists "${dumpFile}"`,
        { env }
      );
    }

    // 統計恢復的記錄數
    const { stdout } = await execAsync(
      `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -t -c "SELECT tablename, n_live_tup FROM pg_stat_user_tables ORDER BY tablename"`,
      { env }
    );

    const stats: Record<string, number> = {};
    stdout.trim().split('\n').forEach((line) => {
      const parts = line.split('|').map((s) => s.trim());
      if (parts.length >= 2 && parts[0]) {
        stats[parts[0]] = parseInt(parts[1]) || 0;
      }
    });

    return stats;
  }

  // ============================================================
  // 恢復文件
  // ============================================================
  private async restoreFiles(
    tempDir: string,
    restoreType: RestoreType,
    selectedFiles?: string[]
  ): Promise<number> {
    const filesArchive = path.join(tempDir, 'files.tar.gz');

    if (!existsSync(filesArchive)) {
      return 0; // 無文件備份
    }

    const targetDir = restoreType === 'DRILL'
      ? path.join(os.tmpdir(), `drill-uploads-${Date.now()}`)
      : (process.env.UPLOAD_DIR || './uploads');

    mkdirSync(targetDir, { recursive: true });

    if (selectedFiles && selectedFiles.length > 0) {
      // 部分恢復 - 只恢復選定的文件
      const fileList = selectedFiles.map(f => `"${f}"`).join(' ');
      await execAsync(`tar -xzf "${filesArchive}" -C "${targetDir}" ${fileList}`);
      return selectedFiles.length;
    } else {
      // 完整恢復
      await execAsync(`tar -xzf "${filesArchive}" -C "${targetDir}"`);

      // 統計文件數量
      const { stdout } = await execAsync(`find "${targetDir}" -type f | wc -l`);
      return parseInt(stdout.trim()) || 0;
    }
  }

  // ============================================================
  // 恢復配置
  // ============================================================
  private async restoreConfig(
    tempDir: string,
    restoreType: RestoreType
  ): Promise<number> {
    const configFile = path.join(tempDir, 'config.json');

    if (!existsSync(configFile)) {
      return 0; // 無配置備份
    }

    const content = await fsPromises.readFile(configFile, 'utf-8');
    const configData = JSON.parse(content);

    // 演練模式不實際恢復配置
    if (restoreType === 'DRILL') {
      return configData.systemConfigs?.length || 0;
    }

    let restoredCount = 0;

    for (const config of configData.systemConfigs || []) {
      try {
        await prisma.systemConfig.upsert({
          where: { key: config.key },
          update: {
            value: config.value,
            updatedAt: new Date(),
          },
          create: config,
        });
        restoredCount++;
      } catch (error) {
        console.error(`Failed to restore config ${config.key}:`, error);
      }
    }

    return restoredCount;
  }

  // ============================================================
  // 驗證恢復結果
  // ============================================================
  private async verifyRestoration(
    backup: Backup,
    scope: RestoreScope[]
  ): Promise<{ passed: boolean; details: ValidationDetails }> {
    const details: ValidationDetails = {};
    let allPassed = true;

    // 驗證數據庫
    if (scope.includes('ALL') || scope.includes('DATABASE')) {
      try {
        const userCount = await prisma.user.count();
        details.database = {
          accessible: true,
          sampleCount: userCount,
        };
      } catch (error: any) {
        details.database = {
          accessible: false,
          error: error.message,
        };
        allPassed = false;
      }
    }

    // 驗證文件目錄
    if (scope.includes('ALL') || scope.includes('FILES')) {
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const filesExist = existsSync(uploadDir);
      details.files = {
        directoryExists: filesExist,
      };

      if (!filesExist) {
        allPassed = false;
      }
    }

    // 驗證配置
    if (scope.includes('ALL') || scope.includes('CONFIG')) {
      const configCount = await prisma.systemConfig.count();
      details.config = {
        configCount,
      };
    }

    return {
      passed: allPassed,
      details,
    };
  }

  // ============================================================
  // 創建演練記錄
  // ============================================================
  private async createDrillRecord(
    restoreId: string,
    validation: { passed: boolean; details: ValidationDetails }
  ): Promise<void> {
    await prisma.restoreDrill.create({
      data: {
        restoreRecordId: restoreId,
        drillEnvironment: `drill-${Date.now()}`,
        drillStatus: validation.passed ? 'passed' : 'failed',
        drillReport: validation.details,
      },
    });
  }

  // ============================================================
  // 清理臨時目錄
  // ============================================================
  private async cleanupTempDir(tempDir: string): Promise<void> {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup temp directory:', error);
    }
  }

  // ============================================================
  // 取得恢復記錄列表
  // ============================================================
  async listRestoreRecords(options: RestoreListOptions = {}): Promise<{
    records: RestoreRecord[];
    total: number;
  }> {
    const { status, type, limit = 20, offset = 0 } = options;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [records, total] = await Promise.all([
      prisma.restoreRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          backup: {
            select: { name: true, type: true, completedAt: true },
          },
          createdByUser: {
            select: { displayName: true },
          },
        },
      }),
      prisma.restoreRecord.count({ where }),
    ]);

    return { records, total };
  }

  // ============================================================
  // 取得恢復記錄詳情
  // ============================================================
  async getRestoreRecord(restoreId: string): Promise<RestoreRecord | null> {
    return prisma.restoreRecord.findUnique({
      where: { id: restoreId },
      include: {
        backup: true,
        createdByUser: {
          select: { displayName: true },
        },
        drill: true,
      },
    });
  }

  // ============================================================
  // 取得恢復日誌
  // ============================================================
  async getRestoreLogs(restoreId: string): Promise<Array<{
    timestamp: Date;
    level: string;
    step: string;
    message: string;
  }>> {
    return prisma.restoreLog.findMany({
      where: { restoreRecordId: restoreId },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        level: true,
        step: true,
        message: true,
      },
    });
  }

  // ============================================================
  // 取消恢復操作
  // ============================================================
  async cancelRestore(restoreId: string, userId: string): Promise<void> {
    const record = await prisma.restoreRecord.findUnique({
      where: { id: restoreId },
    });

    if (!record) {
      throw new Error('恢復記錄不存在');
    }

    const cancellableStatuses: RestoreStatus[] = ['PENDING', 'VALIDATING'];
    if (!cancellableStatuses.includes(record.status)) {
      throw new Error('只能取消等待中或驗證中的恢復操作');
    }

    await prisma.restoreRecord.update({
      where: { id: restoreId },
      data: {
        status: 'ROLLED_BACK',
        completedAt: new Date(),
        errorMessage: '使用者取消',
      },
    });

    await this.createAuditLog(
      userId,
      'RESTORE_CANCELLED',
      restoreId,
      '取消恢復操作'
    );
  }

  // ============================================================
  // 回滾恢復操作
  // ============================================================
  async rollbackRestore(restoreId: string, userId: string): Promise<RestoreRecord> {
    const record = await prisma.restoreRecord.findUnique({
      where: { id: restoreId },
    });

    if (!record) {
      throw new Error('恢復記錄不存在');
    }

    if (!record.preRestoreBackupId) {
      throw new Error('沒有恢復前備份，無法回滾');
    }

    if (record.type === 'DRILL') {
      throw new Error('演練模式不支援回滾');
    }

    // 使用恢復前備份進行恢復
    const rollbackRecord = await this.startRestore(
      {
        backupId: record.preRestoreBackupId,
        type: 'FULL',
        scope: record.scope as RestoreScope[],
        confirmationText: CONFIRMATION_TEXTS.RESTORE,
      },
      userId
    );

    await this.createAuditLog(
      userId,
      'RESTORE_ROLLBACK',
      restoreId,
      `回滾恢復操作，使用備份: ${record.preRestoreBackupId}`
    );

    return rollbackRecord;
  }

  // ============================================================
  // 清理演練環境
  // ============================================================
  async cleanupDrillEnvironment(drillId: string): Promise<void> {
    const drill = await prisma.restoreDrill.findUnique({
      where: { id: drillId },
    });

    if (!drill) {
      throw new Error('演練記錄不存在');
    }

    if (drill.cleanedUp) {
      return; // 已清理
    }

    const dbPassword = process.env.DATABASE_PASSWORD!;
    const env = { ...process.env, PGPASSWORD: dbPassword };

    // 清理演練數據庫
    if (drill.drillDatabaseName) {
      const dbHost = process.env.DATABASE_HOST || 'localhost';
      const dbPort = process.env.DATABASE_PORT || '5432';
      const dbUser = process.env.DATABASE_USER!;

      await execAsync(
        `dropdb -h ${dbHost} -p ${dbPort} -U ${dbUser} --if-exists ${drill.drillDatabaseName}`,
        { env }
      );
    }

    // 清理演練文件目錄
    if (drill.drillStoragePath && existsSync(drill.drillStoragePath)) {
      rmSync(drill.drillStoragePath, { recursive: true, force: true });
    }

    await prisma.restoreDrill.update({
      where: { id: drillId },
      data: {
        cleanedUp: true,
        cleanedUpAt: new Date(),
      },
    });
  }

  // ============================================================
  // 取得備份內容預覽
  // ============================================================
  async previewBackupContents(backupId: string): Promise<BackupPreview> {
    const backup = await prisma.backup.findUnique({
      where: { id: backupId },
    });

    if (!backup?.contents) {
      throw new Error('備份內容資訊不可用');
    }

    const contents = backup.contents as Record<string, any>;

    return {
      tables: contents.database?.tables || [],
      files: [],
      configs: [],
      summary: {
        databaseRecords: contents.database?.rowCount || 0,
        fileCount: contents.files?.fileCount || 0,
        configCount: contents.config?.configCount || 0,
      },
    };
  }

  // ============================================================
  // 輔助函數
  // ============================================================
  private async createAuditLog(
    userId: string,
    action: string,
    resourceId: string,
    description: string,
    metadata?: any
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resourceType: 'RestoreRecord',
        resourceId,
        description,
        metadata,
      },
    });
  }
}

// 單例匯出
export const restoreService = new RestoreService();
```

---

## 5. API Routes

### 5.1 Restore Management Routes

```typescript
// app/api/admin/restore/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { restoreService } from '@/services/restore/restore.service';
import { RestoreStatus, RestoreType } from '@prisma/client';

// GET /api/admin/restore - 取得恢復記錄列表
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as RestoreStatus | undefined;
  const type = searchParams.get('type') as RestoreType | undefined;
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  const result = await restoreService.listRestoreRecords({
    status,
    type,
    limit,
    offset
  });

  return NextResponse.json(result);
}

// POST /api/admin/restore - 開始恢復操作
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      backupId,
      type,
      scope,
      selectedTables,
      selectedFiles,
      confirmationText,
    } = body;

    // 驗證必要參數
    if (!backupId || !type || !scope || !confirmationText) {
      return NextResponse.json(
        { error: '缺少必要參數' },
        { status: 400 }
      );
    }

    const record = await restoreService.startRestore(
      {
        backupId,
        type,
        scope,
        selectedTables,
        selectedFiles,
        confirmationText,
      },
      session.user.id
    );

    return NextResponse.json({
      record,
      message: '恢復操作已開始'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '開始恢復失敗' },
      { status: 400 }
    );
  }
}
```

### 5.2 Restore Detail Routes

```typescript
// app/api/admin/restore/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { restoreService } from '@/services/restore/restore.service';

// GET /api/admin/restore/:id - 取得恢復記錄詳情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const record = await restoreService.getRestoreRecord(params.id);

  if (!record) {
    return NextResponse.json({ error: '恢復記錄不存在' }, { status: 404 });
  }

  return NextResponse.json({ record });
}

// DELETE /api/admin/restore/:id - 取消恢復操作
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  try {
    await restoreService.cancelRestore(params.id, session.user.id);
    return NextResponse.json({ message: '恢復操作已取消' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '取消失敗' },
      { status: 400 }
    );
  }
}
```

### 5.3 Restore Logs Route

```typescript
// app/api/admin/restore/[id]/logs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { restoreService } from '@/services/restore/restore.service';

// GET /api/admin/restore/:id/logs - 取得恢復日誌
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const logs = await restoreService.getRestoreLogs(params.id);
  return NextResponse.json({ logs });
}
```

### 5.4 Rollback Route

```typescript
// app/api/admin/restore/[id]/rollback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { restoreService } from '@/services/restore/restore.service';

// POST /api/admin/restore/:id/rollback - 回滾恢復操作
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  try {
    const record = await restoreService.rollbackRestore(
      params.id,
      session.user.id
    );

    return NextResponse.json({
      record,
      message: '回滾操作已開始'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '回滾失敗' },
      { status: 400 }
    );
  }
}
```

### 5.5 Backup Preview Route

```typescript
// app/api/admin/backup/[id]/preview/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { restoreService } from '@/services/restore/restore.service';

// GET /api/admin/backup/:id/preview - 預覽備份內容
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  try {
    const preview = await restoreService.previewBackupContents(params.id);
    return NextResponse.json(preview);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '預覽失敗' },
      { status: 400 }
    );
  }
}
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

```typescript
// __tests__/services/restore.service.test.ts

import { RestoreService } from '@/services/restore/restore.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');
jest.mock('@azure/storage-blob');

describe('RestoreService', () => {
  let service: RestoreService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    process.env.AZURE_STORAGE_CONNECTION_STRING = 'mock-connection';
    process.env.BACKUP_ENCRYPTION_KEY = 'test-encryption-key-32chars!!!';

    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    service = new RestoreService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startRestore', () => {
    it('should create restore record and start process', async () => {
      const mockBackup = {
        id: 'backup-1',
        status: 'COMPLETED',
        storagePath: 'path/to/backup',
      };

      const mockRestoreRecord = {
        id: 'restore-1',
        backupId: 'backup-1',
        type: 'FULL',
        scope: ['ALL'],
        status: 'PENDING',
      };

      (mockPrisma.backup.findUnique as jest.Mock).mockResolvedValue(mockBackup);
      (mockPrisma.restoreRecord.create as jest.Mock).mockResolvedValue(mockRestoreRecord);
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.startRestore(
        {
          backupId: 'backup-1',
          type: 'FULL',
          scope: ['ALL'],
          confirmationText: 'RESTORE-CONFIRM',
        },
        'user-1'
      );

      expect(result).toEqual(mockRestoreRecord);
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should reject if backup not completed', async () => {
      (mockPrisma.backup.findUnique as jest.Mock).mockResolvedValue({
        id: 'backup-1',
        status: 'IN_PROGRESS',
      });

      await expect(
        service.startRestore(
          {
            backupId: 'backup-1',
            type: 'FULL',
            scope: ['ALL'],
            confirmationText: 'RESTORE-CONFIRM',
          },
          'user-1'
        )
      ).rejects.toThrow('只能從已完成的備份恢復');
    });

    it('should reject wrong confirmation text', async () => {
      (mockPrisma.backup.findUnique as jest.Mock).mockResolvedValue({
        id: 'backup-1',
        status: 'COMPLETED',
      });

      await expect(
        service.startRestore(
          {
            backupId: 'backup-1',
            type: 'FULL',
            scope: ['ALL'],
            confirmationText: 'wrong-text',
          },
          'user-1'
        )
      ).rejects.toThrow('請輸入確認文字');
    });

    it('should use DRILL confirmation for drill type', async () => {
      (mockPrisma.backup.findUnique as jest.Mock).mockResolvedValue({
        id: 'backup-1',
        status: 'COMPLETED',
      });

      await expect(
        service.startRestore(
          {
            backupId: 'backup-1',
            type: 'DRILL',
            scope: ['ALL'],
            confirmationText: 'RESTORE-CONFIRM', // Wrong for DRILL
          },
          'user-1'
        )
      ).rejects.toThrow('請輸入確認文字: RESTORE-DRILL');
    });
  });

  describe('cancelRestore', () => {
    it('should cancel pending restore', async () => {
      (mockPrisma.restoreRecord.findUnique as jest.Mock).mockResolvedValue({
        id: 'restore-1',
        status: 'PENDING',
      });
      (mockPrisma.restoreRecord.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.cancelRestore('restore-1', 'user-1');

      expect(mockPrisma.restoreRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'restore-1' },
          data: expect.objectContaining({ status: 'ROLLED_BACK' }),
        })
      );
    });

    it('should reject cancelling in-progress restore', async () => {
      (mockPrisma.restoreRecord.findUnique as jest.Mock).mockResolvedValue({
        id: 'restore-1',
        status: 'IN_PROGRESS',
      });

      await expect(
        service.cancelRestore('restore-1', 'user-1')
      ).rejects.toThrow('只能取消等待中或驗證中的恢復操作');
    });
  });

  describe('rollbackRestore', () => {
    it('should reject rollback without pre-restore backup', async () => {
      (mockPrisma.restoreRecord.findUnique as jest.Mock).mockResolvedValue({
        id: 'restore-1',
        preRestoreBackupId: null,
      });

      await expect(
        service.rollbackRestore('restore-1', 'user-1')
      ).rejects.toThrow('沒有恢復前備份，無法回滾');
    });

    it('should reject rollback for drill mode', async () => {
      (mockPrisma.restoreRecord.findUnique as jest.Mock).mockResolvedValue({
        id: 'restore-1',
        type: 'DRILL',
        preRestoreBackupId: 'backup-1',
      });

      await expect(
        service.rollbackRestore('restore-1', 'user-1')
      ).rejects.toThrow('演練模式不支援回滾');
    });
  });
});
```

---

## 7. Dependencies

### 7.1 Pre-requisite Stories
- **Story 12-5**: 數據備份管理 (必須先完成備份才能恢復)

### 7.2 External Services
- Azure Blob Storage (下載備份)
- PostgreSQL (pg_restore)
- File System (uploads 目錄)

### 7.3 Environment Variables
```env
# Azure Blob Storage (same as backup)
AZURE_STORAGE_CONNECTION_STRING=your-azure-connection-string
BACKUP_CONTAINER_NAME=backups

# Backup Encryption (same as backup)
BACKUP_ENCRYPTION_KEY=your-32-character-encryption-key

# PostgreSQL
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=your_database
DATABASE_USER=your_user
DATABASE_PASSWORD=your_password

# Upload Directory
UPLOAD_DIR=./uploads
```

---

## 8. Acceptance Criteria Verification

### AC 12-6-1: 恢復選項選擇
| 驗證項目 | 實作位置 | 驗證方式 |
|---------|---------|---------|
| 完整恢復（替換所有數據） | RestoreType.FULL | 選擇 FULL 執行恢復 |
| 部分恢復（選擇特定表或文件） | RestoreType.PARTIAL + selectedTables | 選擇表格後執行 |
| 恢復至新環境（不影響現有數據） | RestoreType.DRILL | 演練模式執行 |

### AC 12-6-2: 恢復操作確認
| 驗證項目 | 實作位置 | 驗證方式 |
|---------|---------|---------|
| 二次確認（輸入確認文字） | confirmationText validation | 輸入 RESTORE-CONFIRM |
| 記錄恢復操作至審計日誌 | createAuditLog() | 查看 AuditLog 表 |
| 顯示恢復進度 | RestoreProgress interface | UI 進度條顯示 |

### AC 12-6-3: 恢復進度追蹤
| 驗證項目 | 實作位置 | 驗證方式 |
|---------|---------|---------|
| 當前步驟（數據庫/文件/配置） | currentStep field | UI 顯示步驟 |
| 預估剩餘時間 | estimatedTimeRemaining | UI 顯示時間 |
| 已恢復的數據量 | progress percentage | UI 顯示百分比 |

### AC 12-6-4: 恢復完成報告
| 驗證項目 | 實作位置 | 驗證方式 |
|---------|---------|---------|
| 顯示恢復結果報告 | RestoreDetailModal | UI 詳情對話框 |
| 列出恢復的數據統計 | restoredRecords/Files/Configs | 統計數據顯示 |
| 提供數據完整性驗證結果 | validationPassed + Details | 驗證結果顯示 |

### AC 12-6-5: 恢復演練功能
| 驗證項目 | 實作位置 | 驗證方式 |
|---------|---------|---------|
| 恢復至隔離環境 | DRILL type + temp database | 建立演練 DB |
| 不影響生產數據 | drillDatabaseName | 獨立數據庫 |
| 生成演練報告 | RestoreDrill.drillReport | 演練記錄 |

---

## 9. Security Considerations

### 9.1 Authentication & Authorization
- 僅 ADMIN 角色可執行恢復操作
- 所有 API endpoints 驗證 session

### 9.2 Confirmation Mechanism
- 必須輸入特定確認文字 (RESTORE-CONFIRM / RESTORE-DRILL)
- 確認文字與恢復類型匹配

### 9.3 Audit Trail
- 所有恢復操作記錄至 AuditLog
- 詳細 RestoreLog 追蹤每個步驟

### 9.4 Data Protection
- 恢復前自動備份 (非演練模式)
- 支援回滾機制
- 演練模式使用隔離環境

---

## 10. Verification Checklist

### 功能驗證
- [ ] 完整恢復功能正常運作
- [ ] 部分恢復可選擇特定表
- [ ] 恢復演練不影響生產數據
- [ ] 恢復前自動備份功能正常
- [ ] 恢復進度即時更新
- [ ] 預估時間計算合理
- [ ] 恢復完成後驗證通過
- [ ] 回滾功能正常運作
- [ ] 取消恢復功能正常

### 安全驗證
- [ ] 二次確認機制正確運作
- [ ] 確認文字驗證嚴格
- [ ] 所有恢復操作記錄審計日誌
- [ ] 僅管理員可執行恢復操作

### 效能驗證
- [ ] 大型備份恢復正常完成
- [ ] 恢復過程不導致系統崩潰
- [ ] 演練環境正確清理
- [ ] 臨時文件正確刪除
