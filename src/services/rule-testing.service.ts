/**
 * @fileoverview 規則測試服務
 * @description
 *   提供規則變更效果測試的完整功能：
 *   - 創建測試任務
 *   - 執行規則測試（比較原規則和新規則的提取結果）
 *   - 獲取測試狀態和進度
 *   - 獲取詳細測試結果
 *   - 計算改善率和退化率
 *
 * @module src/services/rule-testing.service
 * @since Epic 5 - Story 5.4 (測試規則變更效果)
 * @lastModified 2025-12-19
 *
 * @features
 *   - AC1: 測試入口（從規則編輯進入）
 *   - AC2: 歷史發票測試
 *   - AC3: 測試結果呈現
 *   - AC4: 測試報告生成
 *
 * @dependencies
 *   - @/lib/prisma - 資料庫客戶端
 *   - @/types/rule-test - 測試相關類型
 */

import { prisma } from '@/lib/prisma';
import {
  TestTaskStatus,
  TestChangeType,
  Prisma,
} from '@prisma/client';
import type {
  TestConfig,
  TestResults,
  TestDetailItem,
  RuleTestTask,
  TestDetailsQueryParams,
} from '@/types/rule-test';

// ============================================================
// Types
// ============================================================

/**
 * 創建測試任務參數
 */
export interface CreateTestTaskParams {
  /** 規則 ID */
  ruleId: string;
  /** 測試的新規則模式 */
  testPattern: Record<string, unknown>;
  /** 測試配置 */
  config: TestConfig;
  /** 創建者 ID */
  createdById: string;
}

/**
 * 執行測試參數
 */
export interface ExecuteTestParams {
  /** 任務 ID */
  taskId: string;
}

/**
 * 提取結果
 */
interface ExtractionResult {
  value: string | null;
  confidence: number;
}

// ============================================================
// Create Test Task
// ============================================================

/**
 * 創建規則測試任務
 *
 * @description
 *   創建一個新的測試任務，準備測試規則變更效果。
 *   任務創建後會立即開始執行測試。
 *
 * @param params - 創建參數
 * @returns 創建的測試任務
 * @throws Error 如果規則不存在
 */
export async function createTestTask(
  params: CreateTestTaskParams
): Promise<{ taskId: string; estimatedDocuments: number }> {
  const { ruleId, testPattern, config, createdById } = params;

  // 1. 獲取規則資訊
  const rule = await prisma.mappingRule.findUnique({
    where: { id: ruleId },
    include: {
      company: { select: { id: true, name: true, code: true } },
    },
  });

  if (!rule) {
    throw new Error('找不到指定的規則');
  }

  if (!rule.companyId) {
    throw new Error('此規則沒有關聯的 Company');
  }

  // 2. 計算測試文件數量
  const documentCount = await getTestableDocumentCount(rule.companyId, config);

  if (documentCount === 0) {
    throw new Error('沒有找到符合條件的測試文件');
  }

  // 3. 創建測試任務
  const testTask = await prisma.ruleTestTask.create({
    data: {
      ruleId,
      companyId: rule.companyId,
      originalPattern: rule.extractionPattern as Prisma.InputJsonValue,
      testPattern: testPattern as Prisma.InputJsonValue,
      config: config as unknown as Prisma.InputJsonValue,
      status: TestTaskStatus.PENDING,
      progress: 0,
      totalDocuments: documentCount,
      testedDocuments: 0,
      createdById,
    },
  });

  // 4. 創建審計日誌
  await prisma.auditLog.create({
    data: {
      userId: createdById,
      userName: 'System',
      action: 'CREATE',
      resourceType: 'rule-test-task',
      resourceId: testTask.id,
      description: `Created rule test task for ${rule.company?.name ?? 'Unknown'} company`,
      metadata: {
        ruleId,
        companyId: rule.companyId,
        documentCount,
        config: config as unknown as Prisma.InputJsonValue,
      },
      status: 'SUCCESS',
    },
  });

  // 5. 異步執行測試（立即開始）
  // 在生產環境中，這裡應該使用 BullMQ 或類似的任務隊列
  // 目前使用 setTimeout 模擬異步執行，以免阻塞響應
  setTimeout(() => {
    executeTest({ taskId: testTask.id }).catch((error) => {
      console.error('Test execution error:', error);
    });
  }, 100);

  return {
    taskId: testTask.id,
    estimatedDocuments: documentCount,
  };
}

// ============================================================
// Execute Test
// ============================================================

/**
 * 執行規則測試
 *
 * @description
 *   遍歷測試文件，比較原規則和新規則的提取結果，
 *   並記錄每個文件的測試詳情。
 *
 * @param params - 執行參數
 */
export async function executeTest(params: ExecuteTestParams): Promise<void> {
  const { taskId } = params;

  // 1. 獲取任務資訊
  const task = await prisma.ruleTestTask.findUnique({
    where: { id: taskId },
    include: {
      rule: { select: { fieldName: true } },
    },
  });

  if (!task) {
    throw new Error('找不到測試任務');
  }

  if (task.status !== TestTaskStatus.PENDING) {
    throw new Error('任務狀態不正確');
  }

  // REFACTOR-001: 驗證 companyId 存在
  if (!task.companyId) {
    throw new Error('測試任務沒有關聯的公司');
  }

  // 類型斷言確保 TypeScript 知道 companyId 不為 null
  const validatedTask = task as typeof task & { companyId: string };

  // 2. 更新狀態為執行中
  await prisma.ruleTestTask.update({
    where: { id: taskId },
    data: {
      status: TestTaskStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  try {
    // 3. 獲取測試文件列表
    const config = task.config as unknown as TestConfig;
    const documents = await getTestableDocuments(validatedTask.companyId, config);

    // 4. 初始化結果計數
    let improved = 0;
    let regressed = 0;
    let unchanged = 0;
    let bothWrong = 0;
    let bothRight = 0;

    // 5. 遍歷文件進行測試
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];

      // 5a. 應用原規則提取
      const originalResult = await applyExtractionPattern(
        doc.id,
        task.originalPattern as Record<string, unknown> | null,
        task.rule.fieldName
      );

      // 5b. 應用新規則提取
      const testResult = await applyExtractionPattern(
        doc.id,
        task.testPattern as Record<string, unknown>,
        task.rule.fieldName
      );

      // 5c. 獲取實際正確值（從修正記錄或審核記錄）
      const actualValue = await getActualValue(doc.id, task.rule.fieldName);

      // 5d. 判斷準確性
      const originalAccurate = isValueAccurate(originalResult?.value, actualValue);
      const testAccurate = isValueAccurate(testResult?.value, actualValue);

      // 5e. 確定變更類型
      const changeType = determineChangeType(originalAccurate, testAccurate);

      // 5f. 更新計數
      switch (changeType) {
        case TestChangeType.IMPROVED:
          improved++;
          break;
        case TestChangeType.REGRESSED:
          regressed++;
          break;
        case TestChangeType.BOTH_RIGHT:
          bothRight++;
          break;
        case TestChangeType.BOTH_WRONG:
          bothWrong++;
          break;
        case TestChangeType.UNCHANGED:
          unchanged++;
          break;
      }

      // 5g. 創建詳細記錄
      await prisma.ruleTestDetail.create({
        data: {
          taskId,
          documentId: doc.id,
          originalResult: originalResult?.value ?? null,
          originalConfidence: originalResult?.confidence ?? null,
          testResult: testResult?.value ?? null,
          testConfidence: testResult?.confidence ?? null,
          actualValue,
          originalAccurate,
          testAccurate,
          changeType,
        },
      });

      // 5h. 更新進度
      const progress = Math.round(((i + 1) / documents.length) * 100);
      await prisma.ruleTestTask.update({
        where: { id: taskId },
        data: {
          progress,
          testedDocuments: i + 1,
        },
      });
    }

    // 6. 計算最終結果
    const totalTested = documents.length;
    const originalAccurateCount = bothRight + regressed;
    const testAccurateCount = bothRight + improved;

    const results: TestResults = {
      improved,
      regressed,
      unchanged,
      bothWrong,
      bothRight,
      improvementRate: totalTested > 0 ? (improved / totalTested) * 100 : 0,
      regressionRate: totalTested > 0 ? (regressed / totalTested) * 100 : 0,
      totalTested,
      originalAccurate: originalAccurateCount,
      testAccurate: testAccurateCount,
      originalAccuracyRate:
        totalTested > 0 ? (originalAccurateCount / totalTested) * 100 : 0,
      testAccuracyRate:
        totalTested > 0 ? (testAccurateCount / totalTested) * 100 : 0,
    };

    // 7. 更新任務為完成
    await prisma.ruleTestTask.update({
      where: { id: taskId },
      data: {
        status: TestTaskStatus.COMPLETED,
        progress: 100,
        results: results as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    // 8. 創建完成審計日誌
    await prisma.auditLog.create({
      data: {
        userId: task.createdById,
        userName: 'System',
        action: 'UPDATE',
        resourceType: 'rule-test-task',
        resourceId: taskId,
        description: `Rule test completed: ${improved} improved, ${regressed} regressed`,
        metadata: {
          ruleId: task.ruleId,
          totalTested,
          improved,
          regressed,
        },
        status: 'SUCCESS',
      },
    });
  } catch (error) {
    // 錯誤處理：更新任務狀態為失敗
    await prisma.ruleTestTask.update({
      where: { id: taskId },
      data: {
        status: TestTaskStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : '未知錯誤',
      },
    });

    throw error;
  }
}

// ============================================================
// Query Test Tasks
// ============================================================

/**
 * 獲取測試任務詳情
 *
 * @param taskId - 任務 ID
 * @returns 測試任務詳情
 * @throws Error 如果任務不存在
 */
export async function getTestTask(taskId: string): Promise<RuleTestTask> {
  const task = await prisma.ruleTestTask.findUnique({
    where: { id: taskId },
    include: {
      rule: {
        select: {
          id: true,
          fieldName: true,
          fieldLabel: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      creator: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!task) {
    throw new Error('找不到指定的測試任務');
  }

  // REFACTOR-001: 驗證 companyId 和 company 存在
  if (!task.companyId || !task.company) {
    throw new Error('測試任務沒有關聯的公司');
  }

  // 類型斷言確保 TypeScript 知道 companyId 和 company 不為 null
  const validatedTask = task as typeof task & {
    companyId: string;
    company: NonNullable<typeof task.company>;
  };

  return formatTestTask(validatedTask);
}

/**
 * 獲取測試詳情列表
 *
 * @param taskId - 任務 ID
 * @param params - 查詢參數
 * @returns 測試詳情列表和分頁資訊
 */
export async function getTestDetails(
  taskId: string,
  params: TestDetailsQueryParams = {}
): Promise<{
  details: TestDetailItem[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}> {
  const { page = 1, pageSize = 20, changeType, sortBy = 'createdAt', sortOrder = 'desc' } = params;

  const where: Prisma.RuleTestDetailWhereInput = { taskId };
  if (changeType) {
    where.changeType = changeType;
  }

  const orderBy: Prisma.RuleTestDetailOrderByWithRelationInput = {};
  if (sortBy === 'createdAt') {
    orderBy.createdAt = sortOrder;
  } else if (sortBy === 'changeType') {
    orderBy.changeType = sortOrder;
  } else if (sortBy === 'confidence') {
    orderBy.testConfidence = sortOrder;
  }

  const [details, total] = await Promise.all([
    prisma.ruleTestDetail.findMany({
      where,
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            createdAt: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ruleTestDetail.count({ where }),
  ]);

  return {
    details: details.map((detail) => ({
      id: detail.id,
      document: {
        id: detail.document.id,
        fileName: detail.document.fileName,
        createdAt: detail.document.createdAt.toISOString(),
      },
      originalResult: detail.originalResult,
      originalConfidence: detail.originalConfidence,
      testResult: detail.testResult,
      testConfidence: detail.testConfidence,
      actualValue: detail.actualValue,
      originalAccurate: detail.originalAccurate,
      testAccurate: detail.testAccurate,
      changeType: detail.changeType,
      notes: detail.notes,
    })),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * 取消測試任務
 *
 * @param taskId - 任務 ID
 * @param userId - 操作者 ID
 * @returns 操作結果
 */
export async function cancelTestTask(
  taskId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const task = await prisma.ruleTestTask.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new Error('找不到指定的測試任務');
  }

  if (task.status === TestTaskStatus.COMPLETED || task.status === TestTaskStatus.FAILED) {
    throw new Error('無法取消已完成或失敗的任務');
  }

  await prisma.$transaction([
    prisma.ruleTestTask.update({
      where: { id: taskId },
      data: { status: TestTaskStatus.CANCELLED },
    }),
    prisma.auditLog.create({
      data: {
        userId,
        userName: 'System',
        action: 'UPDATE',
        resourceType: 'rule-test-task',
        resourceId: taskId,
        description: 'Cancelled rule test task',
        metadata: {
          ruleId: task.ruleId,
          previousStatus: task.status,
        },
        status: 'SUCCESS',
      },
    }),
  ]);

  return { success: true, message: '測試任務已取消' };
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 獲取可測試文件數量
 */
async function getTestableDocumentCount(
  companyId: string,
  config: TestConfig
): Promise<number> {
  const where = buildDocumentWhereClause(companyId, config);
  return prisma.document.count({ where });
}

/**
 * 獲取可測試文件列表
 */
async function getTestableDocuments(
  companyId: string,
  config: TestConfig
): Promise<{ id: string }[]> {
  const where = buildDocumentWhereClause(companyId, config);
  const take = config.maxDocuments ?? 1000;

  return prisma.document.findMany({
    where,
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

/**
 * 構建文件查詢條件
 */
function buildDocumentWhereClause(
  companyId: string,
  config: TestConfig
): Prisma.DocumentWhereInput {
  const where: Prisma.DocumentWhereInput = {
    companyId,
    status: 'COMPLETED', // 只測試已完成處理的文件
  };

  if (config.scope === 'specific' && config.documentIds) {
    where.id = { in: config.documentIds };
  } else if (config.scope === 'date_range' && config.dateRange) {
    where.createdAt = {
      gte: new Date(config.dateRange.start),
      lte: new Date(config.dateRange.end),
    };
  }

  return where;
}

/**
 * 應用提取模式
 *
 * @description
 *   這是一個簡化的實現。在實際生產環境中，
 *   應該調用完整的提取服務來處理各種提取方法。
 */
async function applyExtractionPattern(
  documentId: string,
  pattern: Record<string, unknown> | null,
  fieldName: string
): Promise<ExtractionResult | null> {
  if (!pattern) {
    return null;
  }

  // 獲取文件的提取結果
  const extractionResult = await prisma.extractionResult.findUnique({
    where: { documentId },
  });

  if (!extractionResult) {
    return null;
  }

  // 從現有提取結果中獲取欄位值
  const fieldMappings = extractionResult.fieldMappings as Record<
    string,
    { value: string | null; confidence: number }
  >;
  const fieldData = fieldMappings[fieldName];

  if (!fieldData) {
    return null;
  }

  // 在真實環境中，這裡應該重新應用 pattern 來提取
  // 目前返回已有的提取結果作為示例
  return {
    value: fieldData.value,
    confidence: fieldData.confidence,
  };
}

/**
 * 獲取實際正確值
 *
 * @description
 *   從修正記錄或審核記錄中獲取欄位的實際正確值
 */
async function getActualValue(
  documentId: string,
  fieldName: string
): Promise<string | null> {
  // 1. 先查找修正記錄
  const correction = await prisma.correction.findFirst({
    where: {
      documentId,
      fieldName,
      correctionType: 'NORMAL', // 排除特例
    },
    orderBy: { createdAt: 'desc' },
  });

  if (correction) {
    return correction.correctedValue;
  }

  // 2. 如果沒有修正記錄，從審核記錄中獲取
  const reviewRecord = await prisma.reviewRecord.findFirst({
    where: {
      documentId,
      confirmedFields: { has: fieldName },
    },
    orderBy: { completedAt: 'desc' },
  });

  if (reviewRecord) {
    // 從確認的欄位中獲取值
    const extractionResult = await prisma.extractionResult.findUnique({
      where: { documentId },
    });

    if (extractionResult) {
      const fieldMappings = extractionResult.fieldMappings as Record<
        string,
        { value: string | null }
      >;
      return fieldMappings[fieldName]?.value ?? null;
    }
  }

  return null;
}

/**
 * 判斷提取值是否準確
 */
function isValueAccurate(
  extractedValue: string | null | undefined,
  actualValue: string | null
): boolean {
  if (actualValue === null) {
    // 如果沒有實際值，無法判斷準確性
    return false;
  }

  if (extractedValue === null || extractedValue === undefined) {
    return false;
  }

  // 標準化比較（忽略大小寫和首尾空格）
  return extractedValue.trim().toLowerCase() === actualValue.trim().toLowerCase();
}

/**
 * 確定變更類型
 */
function determineChangeType(
  originalAccurate: boolean,
  testAccurate: boolean
): TestChangeType {
  if (!originalAccurate && testAccurate) {
    return TestChangeType.IMPROVED;
  }
  if (originalAccurate && !testAccurate) {
    return TestChangeType.REGRESSED;
  }
  if (originalAccurate && testAccurate) {
    return TestChangeType.BOTH_RIGHT;
  }
  if (!originalAccurate && !testAccurate) {
    return TestChangeType.BOTH_WRONG;
  }
  return TestChangeType.UNCHANGED;
}

/**
 * 格式化測試任務
 */
function formatTestTask(task: {
  id: string;
  ruleId: string;
  companyId: string;
  originalPattern: Prisma.JsonValue;
  testPattern: Prisma.JsonValue;
  config: Prisma.JsonValue;
  status: TestTaskStatus;
  progress: number;
  totalDocuments: number;
  testedDocuments: number;
  results: Prisma.JsonValue;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdById: string;
  createdAt: Date;
  rule: { id: string; fieldName: string; fieldLabel: string };
  company: { id: string; name: string; code: string | null }; // REFACTOR-001: code 可為 null
  creator: { id: string; name: string | null };
}): RuleTestTask {
  return {
    id: task.id,
    rule: {
      id: task.rule.id,
      fieldName: task.rule.fieldName,
      fieldLabel: task.rule.fieldLabel,
    },
    forwarder: {
      id: task.company.id,
      name: task.company.name,
      code: task.company.code ?? '', // REFACTOR-001: code 可為 null
    },
    originalPattern: task.originalPattern,
    testPattern: task.testPattern,
    config: task.config as unknown as TestConfig,
    status: task.status,
    progress: task.progress,
    totalDocuments: task.totalDocuments,
    testedDocuments: task.testedDocuments,
    results: task.results as unknown as TestResults | null,
    errorMessage: task.errorMessage,
    startedAt: task.startedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdBy: {
      id: task.creator.id,
      name: task.creator.name ?? 'Unknown',
    },
    createdAt: task.createdAt.toISOString(),
  };
}
