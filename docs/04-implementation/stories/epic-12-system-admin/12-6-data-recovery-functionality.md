# Story 12-6: 數據恢復功能

## Story 資訊
- **Story ID**: 12-6
- **Epic**: Epic 12 - 系統管理與監控
- **優先級**: Critical
- **預估點數**: 13
- **FR 覆蓋**: FR63

## User Story
**As a** 系統管理員,
**I want** 從備份恢復系統數據,
**So that** 在發生數據損失時可以快速恢復。

## Acceptance Criteria

### AC 12-6-1: 恢復選項選擇
```gherkin
Given 系統管理員在備份管理頁面
When 需要恢復數據
Then 選擇備份點後顯示恢復選項：
  - 完整恢復（替換所有數據）
  - 部分恢復（選擇特定表或文件）
  - 恢復至新環境（不影響現有數據）
```

### AC 12-6-2: 恢復操作確認
```gherkin
Given 選擇恢復
When 開始恢復操作
Then 系統要求：
  - 二次確認（輸入確認文字）
  - 記錄恢復操作至審計日誌
  - 顯示恢復進度
```

### AC 12-6-3: 恢復進度追蹤
```gherkin
Given 恢復進行中
When 查看進度
Then 顯示：
  - 當前步驟（數據庫/文件/配置）
  - 預估剩餘時間
  - 已恢復的數據量
```

### AC 12-6-4: 恢復完成報告
```gherkin
Given 恢復完成
When 操作結束
Then 系統：
  - 顯示恢復結果報告
  - 列出恢復的數據統計
  - 提供數據完整性驗證結果
```

### AC 12-6-5: 恢復演練功能
```gherkin
Given 恢復測試
When 需要驗證備份可用性
Then 支援「恢復演練」功能：
  - 恢復至隔離環境
  - 不影響生產數據
  - 生成演練報告
```

## Technical Specifications

### 1. Prisma Data Models

```prisma
// 恢復類型
enum RestoreType {
  FULL            // 完整恢復
  PARTIAL         // 部分恢復
  DRILL           // 恢復演練
  POINT_IN_TIME   // 時間點恢復
}

// 恢復狀態
enum RestoreStatus {
  PENDING         // 等待中
  VALIDATING      // 驗證中
  PRE_BACKUP      // 恢復前備份
  IN_PROGRESS     // 恢復中
  VERIFYING       // 驗證中
  COMPLETED       // 完成
  FAILED          // 失敗
  ROLLED_BACK     // 已回滾
}

// 恢復範圍
enum RestoreScope {
  DATABASE        // 數據庫
  FILES           // 文件
  CONFIG          // 配置
  ALL             // 全部
}

// 恢復記錄
model RestoreRecord {
  id              String        @id @default(cuid())

  // 關聯備份
  backupId        String
  backup          Backup        @relation(fields: [backupId], references: [id])

  // 恢復類型
  type            RestoreType
  scope           RestoreScope[]
  status          RestoreStatus @default(PENDING)

  // 恢復選項
  targetEnvironment String?     // 目標環境 (生產/演練)
  selectedTables    String[]    // 選擇的資料表 (部分恢復時)
  selectedFiles     String[]    // 選擇的文件路徑 (部分恢復時)

  // 進度追蹤
  progress        Int           @default(0)
  currentStep     String?
  estimatedTimeRemaining Int?   // 秒

  // 恢復前備份
  preRestoreBackupId String?

  // 結果統計
  restoredRecords   Json?       // {table: count, ...}
  restoredFiles     Int?
  restoredConfigs   Int?

  // 驗證結果
  validationPassed  Boolean?
  validationDetails Json?       // {checksumMatch, recordCount, ...}

  // 錯誤資訊
  errorMessage    String?
  errorDetails    Json?

  // 時間
  startedAt       DateTime?
  completedAt     DateTime?

  // 審計
  createdAt       DateTime      @default(now())
  createdBy       String
  createdByUser   User          @relation(fields: [createdBy], references: [id])

  // 確認資訊
  confirmationText String?      // 使用者輸入的確認文字
  confirmedAt     DateTime?

  @@index([backupId])
  @@index([status, createdAt])
}

// 恢復演練記錄
model RestoreDrill {
  id              String        @id @default(cuid())

  // 關聯恢復記錄
  restoreRecordId String        @unique
  restoreRecord   RestoreRecord @relation(fields: [restoreRecordId], references: [id])

  // 演練環境
  drillEnvironment String       // 演練環境識別碼
  drillDatabaseName String?     // 演練用數據庫名稱
  drillStoragePath String?      // 演練用儲存路徑

  // 演練結果
  drillStatus     String?       // passed/failed/partial
  drillReport     Json?         // 詳細演練報告

  // 清理狀態
  cleanedUp       Boolean       @default(false)
  cleanedUpAt     DateTime?

  createdAt       DateTime      @default(now())

  @@index([drillStatus])
}

// 恢復操作日誌
model RestoreLog {
  id              String        @id @default(cuid())
  restoreRecordId String
  restoreRecord   RestoreRecord @relation(fields: [restoreRecordId], references: [id], onDelete: Cascade)

  // 日誌內容
  timestamp       DateTime      @default(now())
  level           String        // info/warn/error
  step            String        // 步驟名稱
  message         String
  details         Json?

  @@index([restoreRecordId, timestamp])
}
```

### 2. 恢復服務

```typescript
// services/restore/restore.service.ts
import { PrismaClient, RestoreType, RestoreStatus, RestoreScope, Backup, RestoreRecord } from '@prisma/client';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream, createWriteStream, mkdirSync, existsSync, rmSync } from 'fs';
import { pipeline } from 'stream/promises';
import { createDecipheriv, scryptSync, createHash } from 'crypto';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

interface RestoreOptions {
  backupId: string;
  type: RestoreType;
  scope: RestoreScope[];
  selectedTables?: string[];
  selectedFiles?: string[];
  targetEnvironment?: string;
  confirmationText: string;
}

interface RestoreProgress {
  restoreId: string;
  status: RestoreStatus;
  progress: number;
  currentStep: string;
  estimatedTimeRemaining?: number;
  error?: string;
}

type ProgressCallback = (progress: RestoreProgress) => void;

export class RestoreService {
  private containerClient: ContainerClient;
  private encryptionKey: Buffer;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    const containerName = process.env.BACKUP_CONTAINER_NAME || 'backups';
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = blobServiceClient.getContainerClient(containerName);

    const encKey = process.env.BACKUP_ENCRYPTION_KEY!;
    this.encryptionKey = scryptSync(encKey, 'backup-salt', 32);
  }

  /**
   * 開始恢復操作
   */
  async startRestore(
    options: RestoreOptions,
    userId: string,
    onProgress?: ProgressCallback
  ): Promise<RestoreRecord> {
    // 驗證備份
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
      ? 'RESTORE-DRILL'
      : 'RESTORE-CONFIRM';

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
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'RESTORE_INITIATED',
        resourceType: 'RestoreRecord',
        resourceId: restoreRecord.id,
        description: `開始恢復操作，類型: ${options.type}，範圍: ${options.scope.join(', ')}`,
        metadata: {
          backupId: options.backupId,
          restoreType: options.type,
        },
      },
    });

    // 異步執行恢復
    this.executeRestore(restoreRecord.id, backup, options, onProgress).catch((error) => {
      console.error(`Restore ${restoreRecord.id} failed:`, error);
    });

    return restoreRecord;
  }

  /**
   * 執行恢復流程
   */
  private async executeRestore(
    restoreId: string,
    backup: Backup,
    options: RestoreOptions,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const log = async (level: string, step: string, message: string, details?: any) => {
      await prisma.restoreLog.create({
        data: { restoreRecordId: restoreId, level, step, message, details },
      });
    };

    const updateProgress = async (
      status: RestoreStatus,
      progress: number,
      step: string,
      estimatedTime?: number
    ) => {
      await prisma.restoreRecord.update({
        where: { id: restoreId },
        data: { status, progress, currentStep: step, estimatedTimeRemaining: estimatedTime },
      });
      onProgress?.({ restoreId, status, progress, currentStep: step, estimatedTimeRemaining: estimatedTime });
    };

    try {
      // 1. 驗證階段
      await updateProgress('VALIDATING', 5, '驗證備份完整性...');
      await log('info', 'validation', '開始驗證備份');
      await this.validateBackup(backup);
      await log('info', 'validation', '備份驗證通過');

      // 2. 恢復前備份 (非演練模式)
      let preRestoreBackupId: string | undefined;
      if (options.type !== 'DRILL') {
        await updateProgress('PRE_BACKUP', 10, '創建恢復前備份...', 300);
        await log('info', 'pre_backup', '開始創建恢復前備份');
        preRestoreBackupId = await this.createPreRestoreBackup(restoreId);
        await log('info', 'pre_backup', `恢復前備份完成: ${preRestoreBackupId}`);
      }

      // 3. 下載並解密備份
      await updateProgress('IN_PROGRESS', 20, '下載備份檔案...', 600);
      await log('info', 'download', '開始下載備份檔案');
      const tempDir = await this.downloadAndDecrypt(backup);
      await log('info', 'download', '備份檔案下載完成');

      // 4. 執行恢復
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
        await log('info', 'restore_database', `數據庫恢復完成: ${JSON.stringify(stats.database)}`);
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

      // 5. 驗證恢復結果
      await updateProgress('VERIFYING', 90, '驗證恢復結果...', 120);
      await log('info', 'verification', '開始驗證恢復結果');
      const validation = await this.verifyRestoration(backup, options.scope);
      await log('info', 'verification', `驗證完成: ${validation.passed ? '通過' : '失敗'}`);

      // 6. 清理臨時文件
      await this.cleanupTempDir(tempDir);

      // 7. 更新恢復記錄
      await prisma.restoreRecord.update({
        where: { id: restoreId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          currentStep: '恢復完成',
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

      // 8. 演練模式 - 創建演練記錄
      if (options.type === 'DRILL') {
        await this.createDrillRecord(restoreId, validation);
      }

    } catch (error: any) {
      await log('error', 'failed', `恢復失敗: ${error.message}`, { stack: error.stack });

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

  /**
   * 驗證備份完整性
   */
  private async validateBackup(backup: Backup): Promise<void> {
    if (!backup.storagePath) {
      throw new Error('備份檔案路徑不存在');
    }

    // 檢查 Blob 是否存在
    const blockBlobClient = this.containerClient.getBlockBlobClient(backup.storagePath);
    const exists = await blockBlobClient.exists();

    if (!exists) {
      throw new Error('備份檔案不存在於儲存空間');
    }

    // 驗證校驗碼 (下載後驗證)
  }

  /**
   * 創建恢復前備份
   */
  private async createPreRestoreBackup(restoreId: string): Promise<string> {
    // 調用備份服務創建快照
    const { BackupService } = await import('./backup.service');
    const backupService = new BackupService();

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
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const currentBackup = await prisma.backup.findUnique({
        where: { id: backup.id },
      });

      if (currentBackup?.status === 'COMPLETED') {
        return backup.id;
      }

      if (currentBackup?.status === 'FAILED') {
        throw new Error('恢復前備份失敗');
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    throw new Error('恢復前備份超時');
  }

  /**
   * 下載並解密備份
   */
  private async downloadAndDecrypt(backup: Backup): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `restore-${backup.id}-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    const encryptedPath = path.join(tempDir, 'backup.tar.gz.enc');
    const decryptedPath = path.join(tempDir, 'backup.tar.gz');

    // 下載
    const blockBlobClient = this.containerClient.getBlockBlobClient(backup.storagePath!);
    const downloadResponse = await blockBlobClient.download();

    const writeStream = createWriteStream(encryptedPath);
    await pipeline(downloadResponse.readableStreamBody!, writeStream);

    // 解密
    const readStream = createReadStream(encryptedPath);
    const chunks: Buffer[] = [];

    for await (const chunk of readStream) {
      chunks.push(chunk);
    }

    const encryptedData = Buffer.concat(chunks);
    const iv = encryptedData.slice(0, 16);
    const encrypted = encryptedData.slice(16);

    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    const fs = await import('fs/promises');
    await fs.writeFile(decryptedPath, decrypted);

    // 驗證校驗碼
    if (backup.checksum) {
      const hash = createHash('sha256');
      const fileContent = await fs.readFile(decryptedPath);
      hash.update(fileContent);
      const calculatedChecksum = hash.digest('hex');

      if (calculatedChecksum !== backup.checksum) {
        throw new Error('備份校驗碼不符，檔案可能已損壞');
      }
    }

    // 解壓縮
    await execAsync(`tar -xzf "${decryptedPath}" -C "${tempDir}"`);

    return tempDir;
  }

  /**
   * 恢復數據庫
   */
  private async restoreDatabase(
    tempDir: string,
    restoreType: RestoreType,
    selectedTables?: string[]
  ): Promise<Record<string, number>> {
    const dumpFile = path.join(tempDir, 'database.sql');

    if (!existsSync(dumpFile)) {
      throw new Error('備份中不包含數據庫');
    }

    const dbHost = process.env.DATABASE_HOST || 'localhost';
    const dbPort = process.env.DATABASE_PORT || '5432';
    const dbUser = process.env.DATABASE_USER!;
    const dbPassword = process.env.DATABASE_PASSWORD!;

    let dbName = process.env.DATABASE_NAME!;

    // 演練模式使用臨時數據庫
    if (restoreType === 'DRILL') {
      dbName = `${dbName}_drill_${Date.now()}`;
      await execAsync(
        `PGPASSWORD=${dbPassword} createdb -h ${dbHost} -p ${dbPort} -U ${dbUser} ${dbName}`
      );
    }

    process.env.PGPASSWORD = dbPassword;

    if (selectedTables && selectedTables.length > 0) {
      // 部分恢復 - 只恢復選定的表
      for (const table of selectedTables) {
        await execAsync(
          `pg_restore -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -t ${table} --clean "${dumpFile}"`
        );
      }
    } else {
      // 完整恢復
      await execAsync(
        `pg_restore -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --clean "${dumpFile}"`
      );
    }

    // 統計恢復的記錄數
    const { stdout } = await execAsync(
      `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -t -c "SELECT tablename, n_live_tup FROM pg_stat_user_tables"`
    );

    const stats: Record<string, number> = {};
    stdout.trim().split('\n').forEach((line) => {
      const [table, count] = line.split('|').map((s) => s.trim());
      if (table && count) {
        stats[table] = parseInt(count);
      }
    });

    return stats;
  }

  /**
   * 恢復文件
   */
  private async restoreFiles(
    tempDir: string,
    restoreType: RestoreType,
    selectedFiles?: string[]
  ): Promise<number> {
    const filesArchive = path.join(tempDir, 'files.tar.gz');

    if (!existsSync(filesArchive)) {
      return 0;
    }

    const uploadDir = restoreType === 'DRILL'
      ? path.join(os.tmpdir(), `drill-uploads-${Date.now()}`)
      : process.env.UPLOAD_DIR || './uploads';

    mkdirSync(uploadDir, { recursive: true });

    if (selectedFiles && selectedFiles.length > 0) {
      // 部分恢復
      const fileList = selectedFiles.join(' ');
      await execAsync(`tar -xzf "${filesArchive}" -C "${uploadDir}" ${fileList}`);
      return selectedFiles.length;
    } else {
      // 完整恢復
      await execAsync(`tar -xzf "${filesArchive}" -C "${uploadDir}"`);

      // 統計文件數量
      const { stdout } = await execAsync(`find "${uploadDir}" -type f | wc -l`);
      return parseInt(stdout.trim()) || 0;
    }
  }

  /**
   * 恢復配置
   */
  private async restoreConfig(
    tempDir: string,
    restoreType: RestoreType
  ): Promise<number> {
    const configFile = path.join(tempDir, 'config.json');

    if (!existsSync(configFile)) {
      return 0;
    }

    const fs = await import('fs/promises');
    const content = await fs.readFile(configFile, 'utf-8');
    const configData = JSON.parse(content);

    if (restoreType === 'DRILL') {
      // 演練模式不實際恢復配置
      return configData.systemConfigs?.length || 0;
    }

    let restoredCount = 0;

    for (const config of configData.systemConfigs || []) {
      try {
        await prisma.systemConfig.upsert({
          where: { key: config.key },
          update: { value: config.value },
          create: config,
        });
        restoredCount++;
      } catch (error) {
        console.error(`Failed to restore config ${config.key}:`, error);
      }
    }

    return restoredCount;
  }

  /**
   * 驗證恢復結果
   */
  private async verifyRestoration(
    backup: Backup,
    scope: RestoreScope[]
  ): Promise<{ passed: boolean; details: Record<string, any> }> {
    const details: Record<string, any> = {};
    let allPassed = true;

    // 驗證數據庫
    if (scope.includes('ALL') || scope.includes('DATABASE')) {
      try {
        // 執行基本查詢確認數據庫可用
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

    // 驗證文件
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

  /**
   * 創建演練記錄
   */
  private async createDrillRecord(
    restoreId: string,
    validation: { passed: boolean; details: Record<string, any> }
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

  /**
   * 清理臨時目錄
   */
  private async cleanupTempDir(tempDir: string): Promise<void> {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup temp directory:', error);
    }
  }

  /**
   * 取得恢復記錄列表
   */
  async listRestoreRecords(options: {
    status?: RestoreStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    records: RestoreRecord[];
    total: number;
  }> {
    const { status, limit = 20, offset = 0 } = options;

    const where: any = {};
    if (status) where.status = status;

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

  /**
   * 取得恢復記錄詳情
   */
  async getRestoreRecord(restoreId: string): Promise<RestoreRecord | null> {
    return prisma.restoreRecord.findUnique({
      where: { id: restoreId },
      include: {
        backup: true,
        createdByUser: {
          select: { displayName: true },
        },
      },
    });
  }

  /**
   * 取得恢復日誌
   */
  async getRestoreLogs(restoreId: string): Promise<Array<{
    timestamp: Date;
    level: string;
    step: string;
    message: string;
  }>> {
    const logs = await prisma.restoreLog.findMany({
      where: { restoreRecordId: restoreId },
      orderBy: { timestamp: 'asc' },
    });

    return logs;
  }

  /**
   * 取消恢復操作
   */
  async cancelRestore(restoreId: string, userId: string): Promise<void> {
    const record = await prisma.restoreRecord.findUnique({
      where: { id: restoreId },
    });

    if (!record) {
      throw new Error('恢復記錄不存在');
    }

    if (!['PENDING', 'VALIDATING'].includes(record.status)) {
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

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'RESTORE_CANCELLED',
        resourceType: 'RestoreRecord',
        resourceId: restoreId,
        description: '取消恢復操作',
      },
    });
  }

  /**
   * 回滾恢復操作
   */
  async rollbackRestore(restoreId: string, userId: string): Promise<void> {
    const record = await prisma.restoreRecord.findUnique({
      where: { id: restoreId },
    });

    if (!record) {
      throw new Error('恢復記錄不存在');
    }

    if (!record.preRestoreBackupId) {
      throw new Error('沒有恢復前備份，無法回滾');
    }

    // 使用恢復前備份進行恢復
    await this.startRestore(
      {
        backupId: record.preRestoreBackupId,
        type: 'FULL',
        scope: record.scope as RestoreScope[],
        confirmationText: 'RESTORE-CONFIRM',
      },
      userId
    );
  }

  /**
   * 清理演練環境
   */
  async cleanupDrillEnvironment(drillId: string): Promise<void> {
    const drill = await prisma.restoreDrill.findUnique({
      where: { id: drillId },
    });

    if (!drill) {
      throw new Error('演練記錄不存在');
    }

    if (drill.cleanedUp) {
      return;
    }

    // 清理演練數據庫
    if (drill.drillDatabaseName) {
      const dbHost = process.env.DATABASE_HOST || 'localhost';
      const dbPort = process.env.DATABASE_PORT || '5432';
      const dbUser = process.env.DATABASE_USER!;
      const dbPassword = process.env.DATABASE_PASSWORD!;

      await execAsync(
        `PGPASSWORD=${dbPassword} dropdb -h ${dbHost} -p ${dbPort} -U ${dbUser} --if-exists ${drill.drillDatabaseName}`
      );
    }

    // 清理演練文件
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

  /**
   * 取得備份內容預覽
   */
  async previewBackupContents(backupId: string): Promise<{
    tables: string[];
    files: string[];
    configs: string[];
    summary: Record<string, any>;
  }> {
    const backup = await prisma.backup.findUnique({
      where: { id: backupId },
    });

    if (!backup?.contents) {
      throw new Error('備份內容資訊不可用');
    }

    const contents = backup.contents as Record<string, any>;

    return {
      tables: contents.database?.tables || [],
      files: contents.files?.samplePaths || [],
      configs: contents.config?.keys || [],
      summary: {
        databaseRecords: contents.database?.rowCount || 0,
        fileCount: contents.files?.fileCount || 0,
        configCount: contents.config?.configCount || 0,
      },
    };
  }
}
```

### 3. API Routes

```typescript
// app/api/admin/restore/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RestoreService } from '@/services/restore/restore.service';

const restoreService = new RestoreService();

// GET /api/admin/restore - 取得恢復記錄列表
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as any;
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  const result = await restoreService.listRestoreRecords({ status, limit, offset });

  return NextResponse.json(result);
}

// POST /api/admin/restore - 開始恢復操作
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 });
  }

  const body = await request.json();
  const {
    backupId,
    type,
    scope,
    selectedTables,
    selectedFiles,
    confirmationText,
  } = body;

  if (!backupId || !type || !scope || !confirmationText) {
    return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
  }

  try {
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

    return NextResponse.json({ record });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

```typescript
// app/api/admin/restore/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RestoreService } from '@/services/restore/restore.service';

const restoreService = new RestoreService();

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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

```typescript
// app/api/admin/restore/[id]/logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RestoreService } from '@/services/restore/restore.service';

const restoreService = new RestoreService();

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

```typescript
// app/api/admin/restore/[id]/rollback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RestoreService } from '@/services/restore/restore.service';

const restoreService = new RestoreService();

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
    await restoreService.rollbackRestore(params.id, session.user.id);
    return NextResponse.json({ message: '回滾操作已開始' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

```typescript
// app/api/admin/backup/[id]/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RestoreService } from '@/services/restore/restore.service';

const restoreService = new RestoreService();

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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

### 4. React Components

```typescript
// components/admin/restore/RestoreManagement.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { RestoreStatus, RestoreType, RestoreScope, Backup } from '@prisma/client';

interface RestoreRecord {
  id: string;
  type: RestoreType;
  scope: RestoreScope[];
  status: RestoreStatus;
  progress: number;
  currentStep?: string;
  estimatedTimeRemaining?: number;
  restoredRecords?: Record<string, number>;
  restoredFiles?: number;
  restoredConfigs?: number;
  validationPassed?: boolean;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  backup: {
    name: string;
    type: string;
    completedAt: string;
  };
  createdByUser: { displayName: string };
}

interface BackupPreview {
  tables: string[];
  files: string[];
  configs: string[];
  summary: {
    databaseRecords: number;
    fileCount: number;
    configCount: number;
  };
}

const STATUS_LABELS: Record<RestoreStatus, string> = {
  PENDING: '等待中',
  VALIDATING: '驗證中',
  PRE_BACKUP: '恢復前備份',
  IN_PROGRESS: '恢復中',
  VERIFYING: '驗證結果',
  COMPLETED: '完成',
  FAILED: '失敗',
  ROLLED_BACK: '已回滾',
};

const STATUS_COLORS: Record<RestoreStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  VALIDATING: 'bg-blue-100 text-blue-600',
  PRE_BACKUP: 'bg-yellow-100 text-yellow-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-600',
  VERIFYING: 'bg-purple-100 text-purple-600',
  COMPLETED: 'bg-green-100 text-green-600',
  FAILED: 'bg-red-100 text-red-600',
  ROLLED_BACK: 'bg-orange-100 text-orange-600',
};

export function RestoreManagement() {
  const [records, setRecords] = useState<RestoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RestoreRecord | null>(null);

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 10000); // 每 10 秒更新
    return () => clearInterval(interval);
  }, []);

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/admin/restore?limit=50');
      const data = await response.json();
      setRecords(data.records);
    } catch (error) {
      console.error('Failed to fetch restore records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRestore = async (recordId: string) => {
    if (!confirm('確定要取消此恢復操作嗎？')) return;

    try {
      const response = await fetch(`/api/admin/restore/${recordId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchRecords();
      } else {
        const data = await response.json();
        alert(`取消失敗: ${data.error}`);
      }
    } catch (error) {
      alert('取消失敗');
    }
  };

  const handleRollback = async (recordId: string) => {
    if (!confirm('確定要回滾此恢復操作嗎？這將使用恢復前的備份還原系統。')) return;

    try {
      const response = await fetch(`/api/admin/restore/${recordId}/rollback`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('回滾操作已開始');
        fetchRecords();
      } else {
        const data = await response.json();
        alert(`回滾失敗: ${data.error}`);
      }
    } catch (error) {
      alert('回滾失敗');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">載入中...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">數據恢復</h1>
        <button
          onClick={() => setShowRestoreModal(true)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          🔄 開始恢復
        </button>
      </div>

      {/* 警告提示 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <span className="text-xl mr-2">⚠️</span>
          <div>
            <p className="font-medium text-yellow-800">恢復操作注意事項</p>
            <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
              <li>完整恢復會替換現有數據，請確認已有最新備份</li>
              <li>恢復操作執行中請勿關閉頁面或進行其他系統操作</li>
              <li>建議在系統低峰期執行恢復操作</li>
              <li>可使用「恢復演練」功能測試備份可用性</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 恢復記錄列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">備份來源</th>
              <th className="px-4 py-3 text-left text-sm font-medium">恢復類型</th>
              <th className="px-4 py-3 text-left text-sm font-medium">範圍</th>
              <th className="px-4 py-3 text-left text-sm font-medium">狀態</th>
              <th className="px-4 py-3 text-left text-sm font-medium">操作者</th>
              <th className="px-4 py-3 text-left text-sm font-medium">時間</th>
              <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {records.map((record) => (
              <tr key={record.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{record.backup.name}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(record.backup.completedAt).toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {record.type === 'FULL' && '完整恢復'}
                  {record.type === 'PARTIAL' && '部分恢復'}
                  {record.type === 'DRILL' && '恢復演練'}
                  {record.type === 'POINT_IN_TIME' && '時間點恢復'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {record.scope.join(', ')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-sm ${STATUS_COLORS[record.status]}`}>
                      {STATUS_LABELS[record.status]}
                    </span>
                    {['IN_PROGRESS', 'VALIDATING', 'PRE_BACKUP', 'VERIFYING'].includes(record.status) && (
                      <span className="text-sm text-gray-500">
                        {record.progress}%
                      </span>
                    )}
                  </div>
                  {record.currentStep && record.status !== 'COMPLETED' && (
                    <div className="text-xs text-gray-500 mt-1">{record.currentStep}</div>
                  )}
                  {record.errorMessage && (
                    <div className="text-xs text-red-500 mt-1">{record.errorMessage}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{record.createdByUser.displayName}</td>
                <td className="px-4 py-3 text-sm">
                  {record.completedAt
                    ? new Date(record.completedAt).toLocaleString()
                    : new Date(record.createdAt).toLocaleString()
                  }
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      className="px-2 py-1 text-sm bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                    >
                      詳情
                    </button>
                    {['PENDING', 'VALIDATING'].includes(record.status) && (
                      <button
                        onClick={() => handleCancelRestore(record.id)}
                        className="px-2 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200"
                      >
                        取消
                      </button>
                    )}
                    {record.status === 'COMPLETED' && record.type !== 'DRILL' && (
                      <button
                        onClick={() => handleRollback(record.id)}
                        className="px-2 py-1 text-sm bg-orange-100 text-orange-600 rounded hover:bg-orange-200"
                      >
                        回滾
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 恢復對話框 */}
      {showRestoreModal && (
        <RestoreModal
          onClose={() => setShowRestoreModal(false)}
          onStarted={fetchRecords}
        />
      )}

      {/* 詳情對話框 */}
      {selectedRecord && (
        <RestoreDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}

interface RestoreModalProps {
  onClose: () => void;
  onStarted: () => void;
}

function RestoreModal({ onClose, onStarted }: RestoreModalProps) {
  const [step, setStep] = useState(1);
  const [backups, setBackups] = useState<any[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<string>('');
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restoreType, setRestoreType] = useState<RestoreType>('FULL');
  const [scope, setScope] = useState<RestoreScope[]>(['ALL']);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [confirmationText, setConfirmationText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      const response = await fetch('/api/admin/backup?status=COMPLETED&limit=50');
      const data = await response.json();
      setBackups(data.backups);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    }
  };

  const fetchPreview = async (backupId: string) => {
    try {
      const response = await fetch(`/api/admin/backup/${backupId}/preview`);
      const data = await response.json();
      setPreview(data);
    } catch (error) {
      console.error('Failed to fetch preview:', error);
    }
  };

  const handleBackupSelect = (backupId: string) => {
    setSelectedBackup(backupId);
    fetchPreview(backupId);
  };

  const handleStartRestore = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupId: selectedBackup,
          type: restoreType,
          scope,
          selectedTables: restoreType === 'PARTIAL' ? selectedTables : undefined,
          confirmationText,
        }),
      });

      if (response.ok) {
        alert('恢復操作已開始');
        onStarted();
        onClose();
      } else {
        const data = await response.json();
        alert(`恢復失敗: ${data.error}`);
      }
    } catch (error) {
      alert('恢復失敗');
    } finally {
      setLoading(false);
    }
  };

  const expectedConfirmation = restoreType === 'DRILL' ? 'RESTORE-DRILL' : 'RESTORE-CONFIRM';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-bold mb-4">數據恢復</h2>

        {/* 步驟指示器 */}
        <div className="flex items-center mb-6">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= s ? 'bg-blue-500 text-white' : 'bg-gray-200'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-blue-500' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* 步驟 1: 選擇備份 */}
        {step === 1 && (
          <div>
            <h3 className="font-medium mb-4">選擇要恢復的備份</h3>
            <div className="space-y-2 max-h-60 overflow-auto">
              {backups.map((backup) => (
                <label
                  key={backup.id}
                  className={`flex items-center p-3 border rounded cursor-pointer ${
                    selectedBackup === backup.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="backup"
                    value={backup.id}
                    checked={selectedBackup === backup.id}
                    onChange={() => handleBackupSelect(backup.id)}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">{backup.name}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(backup.completedAt).toLocaleString()}
                      {' • '}
                      {(parseInt(backup.sizeBytes) / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {preview && (
              <div className="mt-4 p-3 bg-gray-50 rounded">
                <h4 className="font-medium mb-2">備份內容預覽</h4>
                <div className="text-sm space-y-1">
                  <div>📊 數據庫: {preview.summary.databaseRecords.toLocaleString()} 筆記錄</div>
                  <div>📁 文件: {preview.summary.fileCount} 個</div>
                  <div>⚙️ 配置: {preview.summary.configCount} 個</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 步驟 2: 選擇恢復選項 */}
        {step === 2 && (
          <div>
            <h3 className="font-medium mb-4">選擇恢復選項</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">恢復類型</label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="FULL"
                    checked={restoreType === 'FULL'}
                    onChange={() => setRestoreType('FULL')}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">完整恢復</div>
                    <div className="text-sm text-gray-500">替換所有現有數據</div>
                  </div>
                </label>
                <label className="flex items-center p-3 border rounded cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="PARTIAL"
                    checked={restoreType === 'PARTIAL'}
                    onChange={() => setRestoreType('PARTIAL')}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">部分恢復</div>
                    <div className="text-sm text-gray-500">選擇特定資料表或文件</div>
                  </div>
                </label>
                <label className="flex items-center p-3 border rounded cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="DRILL"
                    checked={restoreType === 'DRILL'}
                    onChange={() => setRestoreType('DRILL')}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">恢復演練</div>
                    <div className="text-sm text-gray-500">恢復至隔離環境，不影響生產數據</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">恢復範圍</label>
              <div className="space-x-4">
                {['ALL', 'DATABASE', 'FILES', 'CONFIG'].map((s) => (
                  <label key={s} className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={scope.includes(s as RestoreScope)}
                      onChange={(e) => {
                        if (s === 'ALL') {
                          setScope(e.target.checked ? ['ALL'] : []);
                        } else {
                          const newScope = scope.filter((x) => x !== 'ALL');
                          if (e.target.checked) {
                            setScope([...newScope, s as RestoreScope]);
                          } else {
                            setScope(newScope.filter((x) => x !== s));
                          }
                        }
                      }}
                      className="mr-2"
                    />
                    {s === 'ALL' ? '全部' : s === 'DATABASE' ? '數據庫' : s === 'FILES' ? '文件' : '配置'}
                  </label>
                ))}
              </div>
            </div>

            {restoreType === 'PARTIAL' && preview && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">選擇要恢復的資料表</label>
                <div className="max-h-40 overflow-auto border rounded p-2">
                  {preview.tables.map((table) => (
                    <label key={table} className="flex items-center py-1">
                      <input
                        type="checkbox"
                        checked={selectedTables.includes(table)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTables([...selectedTables, table]);
                          } else {
                            setSelectedTables(selectedTables.filter((t) => t !== table));
                          }
                        }}
                        className="mr-2"
                      />
                      {table}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 步驟 3: 確認 */}
        {step === 3 && (
          <div>
            <h3 className="font-medium mb-4">確認恢復操作</h3>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <span className="text-xl mr-2">⚠️</span>
                <div>
                  <p className="font-medium text-red-800">警告</p>
                  <p className="text-sm text-red-700">
                    {restoreType === 'DRILL'
                      ? '這將在隔離環境中執行恢復測試。'
                      : '這將永久替換現有數據。請確認您已了解此操作的影響。'
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-medium mb-2">恢復摘要</h4>
              <ul className="text-sm space-y-1">
                <li>備份: {backups.find((b) => b.id === selectedBackup)?.name}</li>
                <li>類型: {restoreType === 'FULL' ? '完整恢復' : restoreType === 'PARTIAL' ? '部分恢復' : '恢復演練'}</li>
                <li>範圍: {scope.join(', ')}</li>
                {selectedTables.length > 0 && <li>選擇的表: {selectedTables.join(', ')}</li>}
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                請輸入 <code className="bg-gray-100 px-1 rounded">{expectedConfirmation}</code> 以確認
              </label>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder={expectedConfirmation}
              />
            </div>
          </div>
        )}

        {/* 導航按鈕 */}
        <div className="flex justify-between mt-6">
          <button
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
          >
            {step === 1 ? '取消' : '上一步'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !selectedBackup}
              className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded disabled:opacity-50"
            >
              下一步
            </button>
          ) : (
            <button
              onClick={handleStartRestore}
              disabled={confirmationText !== expectedConfirmation || loading}
              className="px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded disabled:opacity-50"
            >
              {loading ? '處理中...' : '開始恢復'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface RestoreDetailModalProps {
  record: RestoreRecord;
  onClose: () => void;
}

function RestoreDetailModal({ record, onClose }: RestoreDetailModalProps) {
  const [logs, setLogs] = useState<Array<{
    timestamp: string;
    level: string;
    step: string;
    message: string;
  }>>([]);

  useEffect(() => {
    fetchLogs();
  }, [record.id]);

  const fetchLogs = async () => {
    try {
      const response = await fetch(`/api/admin/restore/${record.id}/logs`);
      const data = await response.json();
      setLogs(data.logs);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">恢復詳情</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {/* 基本資訊 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <span className="text-gray-500">備份來源:</span>
            <div className="font-medium">{record.backup.name}</div>
          </div>
          <div>
            <span className="text-gray-500">狀態:</span>
            <div>
              <span className={`px-2 py-1 rounded text-sm ${STATUS_COLORS[record.status]}`}>
                {STATUS_LABELS[record.status]}
              </span>
            </div>
          </div>
          <div>
            <span className="text-gray-500">恢復類型:</span>
            <div className="font-medium">
              {record.type === 'FULL' ? '完整恢復' : record.type === 'PARTIAL' ? '部分恢復' : '恢復演練'}
            </div>
          </div>
          <div>
            <span className="text-gray-500">範圍:</span>
            <div className="font-medium">{record.scope.join(', ')}</div>
          </div>
        </div>

        {/* 進度 */}
        {['IN_PROGRESS', 'VALIDATING', 'PRE_BACKUP', 'VERIFYING'].includes(record.status) && (
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span>{record.currentStep}</span>
              <span>{record.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${record.progress}%` }}
              />
            </div>
            {record.estimatedTimeRemaining && (
              <div className="text-sm text-gray-500 mt-1">
                預估剩餘時間: {Math.ceil(record.estimatedTimeRemaining / 60)} 分鐘
              </div>
            )}
          </div>
        )}

        {/* 結果統計 */}
        {record.status === 'COMPLETED' && (
          <div className="mb-6 bg-green-50 rounded-lg p-4">
            <h3 className="font-medium mb-2">恢復結果</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {record.restoredRecords && (
                <div>
                  <div className="text-gray-500">數據庫記錄</div>
                  <div className="font-medium">
                    {Object.values(record.restoredRecords).reduce((a, b) => a + b, 0).toLocaleString()}
                  </div>
                </div>
              )}
              {record.restoredFiles !== undefined && (
                <div>
                  <div className="text-gray-500">文件</div>
                  <div className="font-medium">{record.restoredFiles.toLocaleString()}</div>
                </div>
              )}
              {record.restoredConfigs !== undefined && (
                <div>
                  <div className="text-gray-500">配置</div>
                  <div className="font-medium">{record.restoredConfigs}</div>
                </div>
              )}
            </div>
            <div className="mt-2">
              <span className={`text-sm ${record.validationPassed ? 'text-green-600' : 'text-red-600'}`}>
                {record.validationPassed ? '✓ 驗證通過' : '✗ 驗證失敗'}
              </span>
            </div>
          </div>
        )}

        {/* 日誌 */}
        <div>
          <h3 className="font-medium mb-2">操作日誌</h3>
          <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-auto font-mono text-sm">
            {logs.map((log, idx) => (
              <div key={idx} className="flex gap-2 py-1">
                <span className="text-gray-400">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={
                  log.level === 'error' ? 'text-red-600' :
                  log.level === 'warn' ? 'text-yellow-600' : 'text-gray-600'
                }>
                  [{log.step}] {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}

export default RestoreManagement;
```

### 5. Unit Tests

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
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    service = new RestoreService();
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
    });

    it('should reject if backup not completed', async () => {
      const mockBackup = {
        id: 'backup-1',
        status: 'IN_PROGRESS',
      };

      (mockPrisma.backup.findUnique as jest.Mock).mockResolvedValue(mockBackup);

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
      const mockBackup = {
        id: 'backup-1',
        status: 'COMPLETED',
      };

      (mockPrisma.backup.findUnique as jest.Mock).mockResolvedValue(mockBackup);

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
  });

  describe('cancelRestore', () => {
    it('should cancel pending restore', async () => {
      const mockRecord = {
        id: 'restore-1',
        status: 'PENDING',
      };

      (mockPrisma.restoreRecord.findUnique as jest.Mock).mockResolvedValue(mockRecord);
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
      const mockRecord = {
        id: 'restore-1',
        status: 'IN_PROGRESS',
      };

      (mockPrisma.restoreRecord.findUnique as jest.Mock).mockResolvedValue(mockRecord);

      await expect(
        service.cancelRestore('restore-1', 'user-1')
      ).rejects.toThrow('只能取消等待中或驗證中的恢復操作');
    });
  });
});
```

## Dependencies

### 前置 Stories
- **Story 12-5**: 數據備份管理

### 外部服務
- Azure Blob Storage
- PostgreSQL (pg_restore)

## Verification Checklist

### 功能驗證
- [ ] 完整恢復功能正常運作
- [ ] 部分恢復可選擇特定表
- [ ] 恢復演練不影響生產數據
- [ ] 恢復前自動備份功能正常
- [ ] 恢復進度即時更新
- [ ] 恢復完成後驗證通過
- [ ] 回滾功能正常運作

### 安全驗證
- [ ] 二次確認機制正確運作
- [ ] 所有恢復操作記錄審計日誌
- [ ] 僅管理員可執行恢復操作

### 效能驗證
- [ ] 大型備份恢復正常完成
- [ ] 恢復過程不導致系統崩潰
- [ ] 演練環境正確清理

---

## Implementation Notes

### 完成日期
2025-12-21

### 實作摘要

#### 資料庫模型
- 擴展現有 `RestoreRecord` 模型，新增恢復類型、範圍、進度追蹤欄位
- 新增 `RestoreDrill` 模型用於恢復演練記錄
- 新增 `RestoreLog` 模型用於恢復操作日誌
- 新增 `RestoreType` 枚舉 (FULL, PARTIAL, DRILL, POINT_IN_TIME)
- 新增 `RestoreStatus` 枚舉 (PENDING, VALIDATING, PRE_BACKUP, IN_PROGRESS, VERIFYING, COMPLETED, FAILED, CANCELLED, ROLLED_BACK)
- 新增 `RestoreScope` 枚舉 (DATABASE, FILES, CONFIG, ALL)

#### 服務層
- `RestoreService` (`src/services/restore.service.ts`)
  - `startRestore()` - 啟動恢復操作（包含模擬執行邏輯）
  - `getRestoreRecord()` - 取得恢復記錄詳情
  - `listRestoreRecords()` - 列表查詢（支援分頁、過濾、排序）
  - `cancelRestore()` - 取消進行中的恢復
  - `rollbackRestore()` - 回滾已完成的恢復
  - `getRestoreLogs()` - 取得恢復日誌
  - `getBackupPreview()` - 取得備份內容預覽
  - `cleanupDrillEnvironment()` - 清理演練環境
  - `getRestoreStats()` - 取得恢復統計

#### API Routes
- `GET /api/admin/restore` - 列表查詢
- `POST /api/admin/restore` - 啟動恢復
- `GET /api/admin/restore/[id]` - 取得詳情
- `DELETE /api/admin/restore/[id]` - 取消恢復
- `POST /api/admin/restore/[id]/rollback` - 回滾恢復
- `GET /api/admin/restore/[id]/logs` - 取得日誌
- `GET /api/admin/restore/preview/[backupId]` - 備份預覽
- `GET /api/admin/restore/stats` - 統計數據

#### React Hooks
- `useRestoreRecords()` - 恢復記錄列表
- `useRestoreRecord()` - 單一恢復記錄
- `useRestoreLogs()` - 恢復日誌
- `useBackupPreview()` - 備份預覽
- `useRestoreStats()` - 恢復統計
- `useStartRestore()` - 啟動恢復
- `useCancelRestore()` - 取消恢復
- `useRollbackRestore()` - 回滾恢復
- `useCleanupDrill()` - 清理演練

#### UI 元件
- `RestoreManagement` - 恢復管理頁面主組件
- `RestoreList` - 恢復記錄列表
- `RestoreDialog` - 啟動恢復對話框（多步驟嚮導）
- `RestoreDetailDialog` - 恢復詳情對話框（日誌、進度、回滾）

#### 類型定義
- `src/types/restore.ts` - 完整的恢復類型定義
  - 恢復選項、進度、驗證詳情
  - 備份預覽（表格、文件列表）
  - 恢復記錄（基本與含關聯）
  - 輔助函數（狀態圖標、標籤）

### 技術決策
1. **模擬恢復執行**: 由於實際的 PostgreSQL pg_restore 和文件系統操作需要實際環境配置，目前採用模擬執行模式。實際部署時需替換為真實的恢復邏輯。
2. **進度追蹤**: 使用 React Query 輪詢機制（3秒間隔）即時更新恢復進度。
3. **恢復前備份**: 支援自動在恢復前建立當前狀態的備份，以便回滾。
4. **演練模式**: 恢復演練會建立隔離環境，驗證恢復流程而不影響生產數據。

### 測試要點
- 恢復對話框的多步驟表單驗證
- 取消和回滾操作的狀態轉換
- 日誌記錄的完整性
- 進度更新的即時性
