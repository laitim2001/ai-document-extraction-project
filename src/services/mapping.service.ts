/**
 * @fileoverview 欄位映射服務
 * @description
 *   提供欄位映射核心功能：
 *   - 呼叫 Python Mapping 服務執行欄位提取
 *   - 管理映射規則（CRUD）
 *   - 儲存和查詢提取結果
 *   - 計算信心度和路由決策
 *
 * @module src/services/mapping.service
 * @since Epic 2 - Story 2.4 (Field Mapping & Extraction)
 * @lastModified 2025-12-18
 *
 * @features
 *   - 三層映射架構支援（Tier 1/2/3）
 *   - 多種提取方法（regex, keyword, position, azure_field）
 *   - 信心度路由（AUTO_APPROVE, QUICK_REVIEW, FULL_REVIEW）
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *   - Python Mapping Service - 欄位提取邏輯
 *
 * @related
 *   - src/types/field-mapping.ts - 類型定義
 *   - src/types/invoice-fields.ts - 欄位定義
 *   - python-services/mapping - Python 服務
 */

import { prisma } from '@/lib/prisma';
import { DocumentStatus, ExtractionStatus, type Prisma } from '@prisma/client';
import type {
  ExtractionResultDTO,
  FieldMappings,
  UnmappedFieldDetails,
  MappingRuleDTO,
  CreateMappingRuleRequest,
  UpdateMappingRuleRequest,
  PythonMapFieldsRequest,
  PythonMapFieldsResponse,
  PythonMappingRule,
  ExtractionPattern,
} from '@/types/field-mapping';

// ============================================================
// Constants
// ============================================================

const PYTHON_MAPPING_SERVICE_URL =
  process.env.PYTHON_MAPPING_SERVICE_URL || 'http://localhost:8001';

// ============================================================
// Type Helpers
// ============================================================

/**
 * 根據信心度取得審核類型
 * @description 預留供未來使用
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _calculateReviewType(
  confidence: number
): 'AUTO_APPROVE' | 'QUICK_REVIEW' | 'FULL_REVIEW' {
  if (confidence >= 90) return 'AUTO_APPROVE';
  if (confidence >= 70) return 'QUICK_REVIEW';
  return 'FULL_REVIEW';
}

// ============================================================
// Mapping Rule Operations
// ============================================================

/**
 * 取得映射規則
 *
 * @param options 查詢選項
 * @returns 映射規則列表
 */
export async function getMappingRules(options?: {
  companyId?: string | null; // REFACTOR-001: 原 forwarderId
  category?: string;
  fieldName?: string;
  isActive?: boolean;
}): Promise<MappingRuleDTO[]> {
  const where: Prisma.MappingRuleWhereInput = {};

  // REFACTOR-001: forwarderId → companyId
  if (options?.companyId !== undefined) {
    where.companyId = options.companyId;
  }
  if (options?.category) {
    where.category = options.category;
  }
  if (options?.fieldName) {
    where.fieldName = options.fieldName;
  }
  if (options?.isActive !== undefined) {
    where.isActive = options.isActive;
  }

  const rules = await prisma.mappingRule.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { fieldName: 'asc' }],
  });

  return rules.map((rule) => ({
    id: rule.id,
    companyId: rule.companyId, // REFACTOR-001: forwarderId → companyId
    fieldName: rule.fieldName,
    fieldLabel: rule.fieldLabel,
    extractionPattern: rule.extractionPattern as unknown as ExtractionPattern,
    priority: rule.priority,
    isRequired: rule.isRequired,
    isActive: rule.isActive,
    validationPattern: rule.validationPattern,
    defaultValue: rule.defaultValue,
    category: rule.category,
    description: rule.description,
  }));
}

/**
 * 取得文件的適用映射規則
 *
 * 優先順序：Company 特定規則 > 通用規則
 * REFACTOR-001: Forwarder → Company
 *
 * @param companyId Company ID (原 forwarderId)
 * @returns 合併後的規則列表
 */
export async function getApplicableRules(companyId?: string): Promise<MappingRuleDTO[]> {
  // 取得通用規則（companyId = null）
  const universalRules = await getMappingRules({
    companyId: null,
    isActive: true,
  });

  // 如果有 companyId，取得特定規則
  let companyRules: MappingRuleDTO[] = [];
  if (companyId) {
    companyRules = await getMappingRules({
      companyId,
      isActive: true,
    });
  }

  // 合併規則：Company 特定規則優先
  const rulesByField = new Map<string, MappingRuleDTO>();

  // 先加入通用規則
  for (const rule of universalRules) {
    rulesByField.set(rule.fieldName, rule);
  }

  // 再加入 Company 特定規則（覆蓋通用規則）
  for (const rule of companyRules) {
    rulesByField.set(rule.fieldName, rule);
  }

  return Array.from(rulesByField.values());
}

/**
 * 建立映射規則
 *
 * @param data 規則資料
 * @returns 建立的規則
 */
export async function createMappingRule(
  data: CreateMappingRuleRequest
): Promise<MappingRuleDTO> {
  const rule = await prisma.mappingRule.create({
    data: {
      companyId: data.companyId || null, // REFACTOR-001: forwarderId → companyId
      fieldName: data.fieldName,
      fieldLabel: data.fieldLabel,
      extractionPattern: data.extractionPattern as unknown as Prisma.InputJsonValue,
      priority: data.priority ?? 0,
      isRequired: data.isRequired ?? false,
      validationPattern: data.validationPattern,
      defaultValue: data.defaultValue,
      category: data.category,
      description: data.description,
    },
  });

  return {
    id: rule.id,
    companyId: rule.companyId, // REFACTOR-001: forwarderId → companyId
    fieldName: rule.fieldName,
    fieldLabel: rule.fieldLabel,
    extractionPattern: rule.extractionPattern as unknown as ExtractionPattern,
    priority: rule.priority,
    isRequired: rule.isRequired,
    isActive: rule.isActive,
    validationPattern: rule.validationPattern,
    defaultValue: rule.defaultValue,
    category: rule.category,
    description: rule.description,
  };
}

/**
 * 更新映射規則
 *
 * @param id 規則 ID
 * @param data 更新資料
 * @returns 更新後的規則
 */
export async function updateMappingRule(
  id: string,
  data: UpdateMappingRuleRequest
): Promise<MappingRuleDTO> {
  const updateData: Prisma.MappingRuleUpdateInput = {};

  if (data.fieldLabel !== undefined) updateData.fieldLabel = data.fieldLabel;
  if (data.extractionPattern !== undefined) {
    updateData.extractionPattern = data.extractionPattern as unknown as Prisma.InputJsonValue;
  }
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.validationPattern !== undefined)
    updateData.validationPattern = data.validationPattern;
  if (data.defaultValue !== undefined) updateData.defaultValue = data.defaultValue;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.description !== undefined) updateData.description = data.description;

  const rule = await prisma.mappingRule.update({
    where: { id },
    data: updateData,
  });

  return {
    id: rule.id,
    companyId: rule.companyId, // REFACTOR-001: forwarderId → companyId
    fieldName: rule.fieldName,
    fieldLabel: rule.fieldLabel,
    extractionPattern: rule.extractionPattern as unknown as ExtractionPattern,
    priority: rule.priority,
    isRequired: rule.isRequired,
    isActive: rule.isActive,
    validationPattern: rule.validationPattern,
    defaultValue: rule.defaultValue,
    category: rule.category,
    description: rule.description,
  };
}

/**
 * 刪除映射規則
 *
 * @param id 規則 ID
 */
export async function deleteMappingRule(id: string): Promise<void> {
  await prisma.mappingRule.delete({
    where: { id },
  });
}

// ============================================================
// Field Mapping Operations
// ============================================================

/**
 * 執行文件欄位映射
 *
 * @param documentId 文件 ID
 * @param options 選項
 * @returns 提取結果
 */
export async function mapDocumentFields(
  documentId: string,
  options?: {
    companyId?: string; // REFACTOR-001: 原 forwarderId
    force?: boolean;
  }
): Promise<ExtractionResultDTO> {
  // 1. 檢查是否已有結果
  if (!options?.force) {
    const existingResult = await getExtractionResult(documentId);
    if (existingResult && existingResult.status === 'COMPLETED') {
      return existingResult;
    }
  }

  // 2. 取得文件和 OCR 結果
  // REFACTOR-001: forwarder → company
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      ocrResult: true,
      company: true,
    },
  });

  if (!document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const ocrResult = document.ocrResult;
  if (!ocrResult) {
    throw new Error(`OCR result not found for document: ${documentId}`);
  }

  // 3. 更新文件狀態
  await prisma.document.update({
    where: { id: documentId },
    data: { status: DocumentStatus.MAPPING_PROCESSING },
  });

  // 4. 取得適用的映射規則
  // REFACTOR-001: forwarderId → companyId
  const companyId = options?.companyId || document.companyId || undefined;
  const rules = await getApplicableRules(companyId);

  // 5. 準備 Python 服務請求
  const pythonRules: PythonMappingRule[] = rules.map((rule) => ({
    id: rule.id,
    field_name: rule.fieldName,
    field_label: rule.fieldLabel,
    extraction_pattern: convertPatternToPython(rule.extractionPattern),
    priority: rule.priority,
    is_required: rule.isRequired,
    validation_pattern: rule.validationPattern || undefined,
    default_value: rule.defaultValue || undefined,
    category: rule.category || undefined,
  }));

  // REFACTOR-001: forwarder_id → company_id (Python service field name kept for compatibility)
  const pythonRequest: PythonMapFieldsRequest = {
    document_id: documentId,
    forwarder_id: companyId, // Python service still expects forwarder_id
    ocr_text: ocrResult.extractedText,
    azure_invoice_data: ocrResult.invoiceData as Record<string, unknown> | undefined,
    mapping_rules: pythonRules,
  };

  // 6. 呼叫 Python 服務
  let pythonResponse: PythonMapFieldsResponse;
  try {
    const response = await fetch(`${PYTHON_MAPPING_SERVICE_URL}/map-fields`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pythonRequest),
    });

    if (!response.ok) {
      throw new Error(`Python service error: ${response.status} ${response.statusText}`);
    }

    pythonResponse = await response.json();
  } catch (error) {
    // 更新文件狀態為失敗
    await prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.FAILED },
    });

    throw new Error(
      `Failed to call Python mapping service: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // 7. 轉換並儲存結果
  const fieldMappings = convertPythonMappings(pythonResponse.field_mappings);
  const unmappedDetails = pythonResponse.unmapped_field_details
    ? convertPythonUnmapped(pythonResponse.unmapped_field_details)
    : null;

  // REFACTOR-001: forwarderId → companyId
  const extractionResult = await saveExtractionResult({
    documentId,
    companyId: companyId || null,
    fieldMappings,
    statistics: {
      totalFields: pythonResponse.statistics.total_fields,
      mappedFields: pythonResponse.statistics.mapped_fields,
      unmappedFields: pythonResponse.statistics.unmapped_fields,
      averageConfidence: pythonResponse.statistics.average_confidence,
      processingTime: pythonResponse.statistics.processing_time_ms,
      rulesApplied: pythonResponse.statistics.rules_applied,
    },
    unmappedDetails,
    status: pythonResponse.success ? ExtractionStatus.COMPLETED : ExtractionStatus.FAILED,
    errorMessage: pythonResponse.error_message || null,
  });

  // 8. 更新文件狀態
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: pythonResponse.success
        ? DocumentStatus.MAPPING_COMPLETED
        : DocumentStatus.FAILED,
    },
  });

  return extractionResult;
}

/**
 * 取得提取結果
 *
 * @param documentId 文件 ID
 * @returns 提取結果或 null
 */
export async function getExtractionResult(documentId: string): Promise<ExtractionResultDTO | null> {
  const result = await prisma.extractionResult.findUnique({
    where: { documentId },
    include: {
      company: true, // REFACTOR-001: forwarder → company
    },
  });

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    documentId: result.documentId,
    companyId: result.companyId, // REFACTOR-001: forwarderId → companyId
    fieldMappings: result.fieldMappings as unknown as FieldMappings,
    statistics: {
      totalFields: result.totalFields,
      mappedFields: result.mappedFields,
      unmappedFields: result.unmappedFields,
      averageConfidence: result.averageConfidence,
      processingTime: result.processingTime,
      rulesApplied: result.rulesApplied,
    },
    status: result.status,
    errorMessage: result.errorMessage,
    unmappedFieldDetails: result.unmappedFieldDetails as unknown as UnmappedFieldDetails | null,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * 儲存提取結果
 * REFACTOR-001: forwarderId → companyId
 */
async function saveExtractionResult(data: {
  documentId: string;
  companyId: string | null;
  fieldMappings: FieldMappings;
  statistics: {
    totalFields: number;
    mappedFields: number;
    unmappedFields: number;
    averageConfidence: number;
    processingTime: number | null;
    rulesApplied: number;
  };
  unmappedDetails: UnmappedFieldDetails | null;
  status: ExtractionStatus;
  errorMessage: string | null;
}): Promise<ExtractionResultDTO> {
  const result = await prisma.extractionResult.upsert({
    where: { documentId: data.documentId },
    create: {
      documentId: data.documentId,
      companyId: data.companyId, // REFACTOR-001: forwarderId → companyId
      fieldMappings: data.fieldMappings as unknown as Prisma.InputJsonValue,
      totalFields: data.statistics.totalFields,
      mappedFields: data.statistics.mappedFields,
      unmappedFields: data.statistics.unmappedFields,
      averageConfidence: data.statistics.averageConfidence,
      processingTime: data.statistics.processingTime,
      rulesApplied: data.statistics.rulesApplied,
      status: data.status,
      errorMessage: data.errorMessage,
      unmappedFieldDetails: data.unmappedDetails as unknown as Prisma.InputJsonValue,
    },
    update: {
      companyId: data.companyId, // REFACTOR-001: forwarderId → companyId
      fieldMappings: data.fieldMappings as unknown as Prisma.InputJsonValue,
      totalFields: data.statistics.totalFields,
      mappedFields: data.statistics.mappedFields,
      unmappedFields: data.statistics.unmappedFields,
      averageConfidence: data.statistics.averageConfidence,
      processingTime: data.statistics.processingTime,
      rulesApplied: data.statistics.rulesApplied,
      status: data.status,
      errorMessage: data.errorMessage,
      unmappedFieldDetails: data.unmappedDetails as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    id: result.id,
    documentId: result.documentId,
    companyId: result.companyId, // REFACTOR-001: forwarderId → companyId
    fieldMappings: result.fieldMappings as unknown as FieldMappings,
    statistics: {
      totalFields: result.totalFields,
      mappedFields: result.mappedFields,
      unmappedFields: result.unmappedFields,
      averageConfidence: result.averageConfidence,
      processingTime: result.processingTime,
      rulesApplied: result.rulesApplied,
    },
    status: result.status,
    errorMessage: result.errorMessage,
    unmappedFieldDetails: result.unmappedFieldDetails as unknown as UnmappedFieldDetails | null,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}

/**
 * 轉換提取模式為 Python 格式
 */
function convertPatternToPython(pattern: ExtractionPattern): PythonMappingRule['extraction_pattern'] {
  const base: PythonMappingRule['extraction_pattern'] = {
    method: pattern.method,
    confidence_boost: 'confidenceBoost' in pattern ? pattern.confidenceBoost : undefined,
  };

  if (pattern.method === 'regex') {
    return {
      ...base,
      pattern: pattern.pattern,
    };
  }

  if (pattern.method === 'keyword') {
    return {
      ...base,
      keywords: pattern.keywords,
    };
  }

  if (pattern.method === 'position') {
    return {
      ...base,
      position: {
        page: pattern.page,
        region: pattern.region,
      },
    };
  }

  if (pattern.method === 'azure_field') {
    return {
      ...base,
      azure_field_name: pattern.azureFieldName,
    };
  }

  return base;
}

/**
 * 轉換 Python 映射結果
 */
function convertPythonMappings(
  pythonMappings: PythonMapFieldsResponse['field_mappings']
): FieldMappings {
  const result: FieldMappings = {};

  for (const [fieldName, mapping] of Object.entries(pythonMappings)) {
    result[fieldName] = {
      value: mapping.value,
      rawValue: mapping.raw_value,
      confidence: mapping.confidence,
      source: mapping.source as 'tier1' | 'tier2' | 'tier3' | 'azure',
      ruleId: mapping.rule_id,
      extractionMethod: mapping.extraction_method as 'regex' | 'keyword' | 'position' | 'azure_field' | 'llm',
      position: mapping.position
        ? {
            page: mapping.position.page,
            boundingBox: mapping.position.bounding_box,
          }
        : undefined,
    };
  }

  return result;
}

/**
 * 轉換 Python 未映射欄位詳情
 */
function convertPythonUnmapped(
  pythonUnmapped: NonNullable<PythonMapFieldsResponse['unmapped_field_details']>
): UnmappedFieldDetails {
  const result: UnmappedFieldDetails = {};

  for (const [fieldName, detail] of Object.entries(pythonUnmapped)) {
    result[fieldName] = {
      reason: detail.reason,
      attempts: detail.attempts,
    };
  }

  return result;
}
