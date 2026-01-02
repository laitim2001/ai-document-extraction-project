# Tech Spec: Story 15.2 - 發行者識別整合

## 概述

將 Epic 0（Story 0-8）的發行者識別功能整合到統一處理流程中，讓日常上傳的文件也能自動識別發行公司。

## 目標

- 整合現有發行者識別服務到統一處理管道
- 支援自動創建新公司（待確認狀態）
- 處理識別失敗或低信心度情況
- 儲存識別結果供後續步驟使用

---

## 技術設計

### 1. 核心類型定義

```typescript
// src/types/issuer-identification.ts

/**
 * 發行者識別方法
 */
export enum IdentificationMethod {
  LOGO = 'LOGO',           // Logo 識別
  HEADER = 'HEADER',       // 頁首文字識別
  TEXT_MATCH = 'TEXT_MATCH', // 全文文字匹配
  AI_INFERENCE = 'AI_INFERENCE', // AI 推斷
}

/**
 * 公司狀態
 */
export enum CompanyStatus {
  VERIFIED = 'VERIFIED',           // 已驗證
  PENDING_VERIFICATION = 'PENDING_VERIFICATION', // 待驗證
  AUTO_CREATED = 'AUTO_CREATED',   // 自動創建（待確認）
  INACTIVE = 'INACTIVE',           // 停用
}

/**
 * 發行者識別請求
 */
export interface IssuerIdentificationRequest {
  fileBuffer: Buffer;
  mimeType: string;
  extractedData?: ExtractedDocumentData;
  options?: IssuerIdentificationOptions;
}

/**
 * 識別選項
 */
export interface IssuerIdentificationOptions {
  autoCreateCompany: boolean;
  minConfidenceThreshold: number;   // 預設 0.5
  preferredMethods: IdentificationMethod[];
  skipIfKnownCompany?: string;      // 跳過識別如果已知公司
}

/**
 * 發行者識別結果
 */
export interface IssuerIdentificationResult {
  success: boolean;
  companyId?: string;
  companyName?: string;
  confidence: number;
  method: IdentificationMethod;
  methodDetails: MethodDetails;
  isNewCompany: boolean;
  needsVerification: boolean;
  alternativeCandidates: CompanyCandidate[];
  rawIdentificationData: RawIdentificationData;
}

/**
 * 識別方法詳情
 */
export interface MethodDetails {
  method: IdentificationMethod;
  matchedText?: string;
  matchedPattern?: string;
  logoSimilarity?: number;
  boundingBox?: BoundingBox;
}

/**
 * 公司候選
 */
export interface CompanyCandidate {
  companyId: string;
  companyName: string;
  confidence: number;
  method: IdentificationMethod;
}

/**
 * 原始識別數據
 */
export interface RawIdentificationData {
  logoAnalysis?: LogoAnalysisResult;
  headerAnalysis?: HeaderAnalysisResult;
  textMatches?: TextMatchResult[];
  aiInference?: AiInferenceResult;
}

/**
 * Logo 分析結果
 */
export interface LogoAnalysisResult {
  detected: boolean;
  boundingBox?: BoundingBox;
  similarity: number;
  matchedCompanyId?: string;
  description?: string;
}

/**
 * 頁首分析結果
 */
export interface HeaderAnalysisResult {
  detected: boolean;
  text: string;
  companyNameCandidate?: string;
  confidence: number;
}

/**
 * 文字匹配結果
 */
export interface TextMatchResult {
  pattern: string;
  matchedText: string;
  companyId: string;
  confidence: number;
}

/**
 * AI 推斷結果
 */
export interface AiInferenceResult {
  companyName: string;
  reasoning: string;
  confidence: number;
}

/**
 * 待驗證公司記錄
 */
export interface PendingCompanyVerification {
  id: string;
  fileId: string;
  suggestedCompanyName: string;
  identificationMethod: IdentificationMethod;
  confidence: number;
  rawData: RawIdentificationData;
  createdAt: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
  verificationResult?: 'CONFIRMED' | 'REJECTED' | 'MERGED';
  mergedToCompanyId?: string;
}
```

### 2. Prisma Schema 擴展

```prisma
// prisma/schema.prisma

model Company {
  id                String        @id @default(cuid())
  name              String
  displayName       String?
  status            CompanyStatus @default(PENDING_VERIFICATION)

  // 識別特徵
  logoSignature     String?       // Logo 特徵簽名
  headerPatterns    String[]      // 頁首匹配模式
  textPatterns      String[]      // 文字匹配模式
  aliases           String[]      // 公司別名

  // 統計
  documentCount     Int           @default(0)
  lastDocumentAt    DateTime?

  // 審計
  createdAt         DateTime      @default(now())
  createdBy         String?
  updatedAt         DateTime      @updatedAt
  verifiedAt        DateTime?
  verifiedBy        String?

  // 關聯
  documentFormats   DocumentFormat[]
  documents         Document[]

  @@map("companies")
}

enum CompanyStatus {
  VERIFIED
  PENDING_VERIFICATION
  AUTO_CREATED
  INACTIVE
}

model PendingCompanyVerification {
  id                   String                @id @default(cuid())
  fileId               String
  suggestedCompanyName String
  identificationMethod IdentificationMethod
  confidence           Float
  rawData              Json

  createdAt            DateTime              @default(now())
  verifiedAt           DateTime?
  verifiedBy           String?
  verificationResult   VerificationResult?
  mergedToCompanyId    String?

  @@map("pending_company_verifications")
}

enum IdentificationMethod {
  LOGO
  HEADER
  TEXT_MATCH
  AI_INFERENCE
}

enum VerificationResult {
  CONFIRMED
  REJECTED
  MERGED
}
```

### 3. 發行者識別適配器

```typescript
// src/services/unified-processor/adapters/issuer-identifier-adapter.ts

/**
 * @fileoverview 發行者識別適配器
 * @description
 *   適配現有的發行者識別服務（Story 0-8）到統一處理管道。
 *   支援多種識別方法：Logo、Header、Text Match、AI Inference。
 *
 * @module src/services/unified-processor/adapters/issuer-identifier-adapter
 * @since Epic 15 - Story 15.2
 */

import { prisma } from '@/lib/prisma';
import {
  IIssuerIdentifier,
  IssuerIdentificationResult,
} from '../interfaces';
import {
  IssuerIdentificationRequest,
  IssuerIdentificationOptions,
  IdentificationMethod,
  CompanyStatus,
  CompanyCandidate,
  RawIdentificationData,
} from '@/types/issuer-identification';
import { documentIssuerService } from '@/services/document-issuer.service';
import { gptVisionService } from '@/services/gpt-vision.service';
import { ExtractedDocumentData } from '@/types';

const DEFAULT_OPTIONS: IssuerIdentificationOptions = {
  autoCreateCompany: true,
  minConfidenceThreshold: 0.5,
  preferredMethods: [
    IdentificationMethod.LOGO,
    IdentificationMethod.HEADER,
    IdentificationMethod.TEXT_MATCH,
    IdentificationMethod.AI_INFERENCE,
  ],
};

export class IssuerIdentifierAdapter implements IIssuerIdentifier {
  /**
   * 識別文件發行者
   */
  async identify(
    buffer: Buffer,
    extractedData?: ExtractedDocumentData,
    options?: Partial<IssuerIdentificationOptions>,
  ): Promise<IssuerIdentificationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // 如果已知公司，跳過識別
    if (opts.skipIfKnownCompany) {
      const company = await this.getCompanyById(opts.skipIfKnownCompany);
      if (company) {
        return this.createKnownCompanyResult(company);
      }
    }

    // 執行多方法識別
    const rawData = await this.performIdentification(buffer, extractedData, opts);

    // 選擇最佳結果
    const bestResult = this.selectBestResult(rawData, opts);

    // 處理識別結果
    return this.processIdentificationResult(bestResult, rawData, opts);
  }

  /**
   * 執行多方法識別
   */
  private async performIdentification(
    buffer: Buffer,
    extractedData?: ExtractedDocumentData,
    options?: IssuerIdentificationOptions,
  ): Promise<RawIdentificationData> {
    const rawData: RawIdentificationData = {};

    // 並行執行多種識別方法
    const [logoResult, headerResult, textMatches, aiResult] = await Promise.allSettled([
      this.performLogoAnalysis(buffer),
      this.performHeaderAnalysis(buffer, extractedData),
      this.performTextMatching(extractedData),
      this.performAiInference(buffer),
    ]);

    if (logoResult.status === 'fulfilled') {
      rawData.logoAnalysis = logoResult.value;
    }

    if (headerResult.status === 'fulfilled') {
      rawData.headerAnalysis = headerResult.value;
    }

    if (textMatches.status === 'fulfilled') {
      rawData.textMatches = textMatches.value;
    }

    if (aiResult.status === 'fulfilled') {
      rawData.aiInference = aiResult.value;
    }

    return rawData;
  }

  /**
   * Logo 分析
   */
  private async performLogoAnalysis(buffer: Buffer): Promise<LogoAnalysisResult> {
    try {
      const result = await documentIssuerService.analyzeLogoRegion(buffer);

      if (!result.detected) {
        return { detected: false, similarity: 0 };
      }

      // 與已知公司 Logo 比對
      const matchedCompany = await this.matchLogoToCompany(result.signature);

      return {
        detected: true,
        boundingBox: result.boundingBox,
        similarity: matchedCompany?.similarity || 0,
        matchedCompanyId: matchedCompany?.companyId,
        description: result.description,
      };
    } catch {
      return { detected: false, similarity: 0 };
    }
  }

  /**
   * 頁首分析
   */
  private async performHeaderAnalysis(
    buffer: Buffer,
    extractedData?: ExtractedDocumentData,
  ): Promise<HeaderAnalysisResult> {
    try {
      const result = await documentIssuerService.analyzeHeaderRegion(buffer);

      return {
        detected: !!result.text,
        text: result.text || '',
        companyNameCandidate: result.companyName,
        confidence: result.confidence || 0,
      };
    } catch {
      return { detected: false, text: '', confidence: 0 };
    }
  }

  /**
   * 文字匹配
   */
  private async performTextMatching(
    extractedData?: ExtractedDocumentData,
  ): Promise<TextMatchResult[]> {
    if (!extractedData) {
      return [];
    }

    // 獲取所有公司的匹配模式
    const companies = await prisma.company.findMany({
      where: {
        status: { in: ['VERIFIED', 'PENDING_VERIFICATION'] },
        textPatterns: { isEmpty: false },
      },
      select: {
        id: true,
        name: true,
        textPatterns: true,
      },
    });

    const results: TextMatchResult[] = [];
    const fullText = this.extractFullText(extractedData);

    for (const company of companies) {
      for (const pattern of company.textPatterns) {
        const regex = new RegExp(pattern, 'i');
        const match = fullText.match(regex);

        if (match) {
          results.push({
            pattern,
            matchedText: match[0],
            companyId: company.id,
            confidence: 0.8, // 文字匹配預設信心度
          });
        }
      }
    }

    return results;
  }

  /**
   * AI 推斷
   */
  private async performAiInference(buffer: Buffer): Promise<AiInferenceResult> {
    try {
      const result = await gptVisionService.identifyDocumentIssuer(buffer);

      return {
        companyName: result.companyName || '',
        reasoning: result.reasoning || '',
        confidence: result.confidence || 0,
      };
    } catch {
      return { companyName: '', reasoning: '', confidence: 0 };
    }
  }

  /**
   * 選擇最佳結果
   */
  private selectBestResult(
    rawData: RawIdentificationData,
    options: IssuerIdentificationOptions,
  ): { method: IdentificationMethod; confidence: number; companyId?: string; companyName?: string } {
    const candidates: Array<{
      method: IdentificationMethod;
      confidence: number;
      companyId?: string;
      companyName?: string;
    }> = [];

    // Logo 結果
    if (rawData.logoAnalysis?.detected && rawData.logoAnalysis.similarity > 0.7) {
      candidates.push({
        method: IdentificationMethod.LOGO,
        confidence: rawData.logoAnalysis.similarity,
        companyId: rawData.logoAnalysis.matchedCompanyId,
      });
    }

    // Header 結果
    if (rawData.headerAnalysis?.detected && rawData.headerAnalysis.confidence > 0.6) {
      candidates.push({
        method: IdentificationMethod.HEADER,
        confidence: rawData.headerAnalysis.confidence,
        companyName: rawData.headerAnalysis.companyNameCandidate,
      });
    }

    // Text Match 結果
    if (rawData.textMatches && rawData.textMatches.length > 0) {
      const bestMatch = rawData.textMatches.sort((a, b) => b.confidence - a.confidence)[0];
      candidates.push({
        method: IdentificationMethod.TEXT_MATCH,
        confidence: bestMatch.confidence,
        companyId: bestMatch.companyId,
      });
    }

    // AI 推斷結果
    if (rawData.aiInference && rawData.aiInference.confidence > 0.5) {
      candidates.push({
        method: IdentificationMethod.AI_INFERENCE,
        confidence: rawData.aiInference.confidence,
        companyName: rawData.aiInference.companyName,
      });
    }

    // 按信心度排序
    candidates.sort((a, b) => b.confidence - a.confidence);

    // 返回最佳結果
    return candidates[0] || {
      method: IdentificationMethod.AI_INFERENCE,
      confidence: 0,
    };
  }

  /**
   * 處理識別結果
   */
  private async processIdentificationResult(
    bestResult: { method: IdentificationMethod; confidence: number; companyId?: string; companyName?: string },
    rawData: RawIdentificationData,
    options: IssuerIdentificationOptions,
  ): Promise<IssuerIdentificationResult> {
    // 信心度低於閾值
    if (bestResult.confidence < options.minConfidenceThreshold) {
      return this.createLowConfidenceResult(bestResult, rawData, options);
    }

    // 已匹配到現有公司
    if (bestResult.companyId) {
      const company = await this.getCompanyById(bestResult.companyId);
      if (company) {
        return this.createMatchedResult(company, bestResult, rawData);
      }
    }

    // 需要創建新公司
    if (bestResult.companyName && options.autoCreateCompany) {
      return this.createNewCompanyResult(bestResult, rawData);
    }

    // 需要人工確認
    return this.createNeedsVerificationResult(bestResult, rawData);
  }

  /**
   * 創建低信心度結果
   */
  private createLowConfidenceResult(
    bestResult: { method: IdentificationMethod; confidence: number },
    rawData: RawIdentificationData,
    options: IssuerIdentificationOptions,
  ): IssuerIdentificationResult {
    return {
      success: false,
      confidence: bestResult.confidence,
      method: bestResult.method,
      methodDetails: { method: bestResult.method },
      isNewCompany: false,
      needsVerification: true,
      alternativeCandidates: this.extractAlternativeCandidates(rawData),
      rawIdentificationData: rawData,
    };
  }

  /**
   * 創建匹配結果
   */
  private createMatchedResult(
    company: { id: string; name: string },
    bestResult: { method: IdentificationMethod; confidence: number },
    rawData: RawIdentificationData,
  ): IssuerIdentificationResult {
    return {
      success: true,
      companyId: company.id,
      companyName: company.name,
      confidence: bestResult.confidence,
      method: bestResult.method,
      methodDetails: { method: bestResult.method },
      isNewCompany: false,
      needsVerification: false,
      alternativeCandidates: [],
      rawIdentificationData: rawData,
    };
  }

  /**
   * 創建新公司結果
   */
  private async createNewCompanyResult(
    bestResult: { method: IdentificationMethod; confidence: number; companyName?: string },
    rawData: RawIdentificationData,
  ): Promise<IssuerIdentificationResult> {
    // 自動創建公司（待確認狀態）
    const newCompany = await prisma.company.create({
      data: {
        name: bestResult.companyName!,
        displayName: bestResult.companyName,
        status: CompanyStatus.AUTO_CREATED,
        createdAt: new Date(),
      },
    });

    // 記錄待驗證
    await prisma.pendingCompanyVerification.create({
      data: {
        fileId: '', // 需要從上下文傳入
        suggestedCompanyName: bestResult.companyName!,
        identificationMethod: bestResult.method,
        confidence: bestResult.confidence,
        rawData: rawData as any,
      },
    });

    return {
      success: true,
      companyId: newCompany.id,
      companyName: newCompany.name,
      confidence: bestResult.confidence,
      method: bestResult.method,
      methodDetails: { method: bestResult.method },
      isNewCompany: true,
      needsVerification: true,
      alternativeCandidates: [],
      rawIdentificationData: rawData,
    };
  }

  /**
   * 創建需驗證結果
   */
  private createNeedsVerificationResult(
    bestResult: { method: IdentificationMethod; confidence: number },
    rawData: RawIdentificationData,
  ): IssuerIdentificationResult {
    return {
      success: false,
      confidence: bestResult.confidence,
      method: bestResult.method,
      methodDetails: { method: bestResult.method },
      isNewCompany: false,
      needsVerification: true,
      alternativeCandidates: this.extractAlternativeCandidates(rawData),
      rawIdentificationData: rawData,
    };
  }

  /**
   * 創建已知公司結果
   */
  private createKnownCompanyResult(
    company: { id: string; name: string },
  ): IssuerIdentificationResult {
    return {
      success: true,
      companyId: company.id,
      companyName: company.name,
      confidence: 1.0,
      method: IdentificationMethod.TEXT_MATCH,
      methodDetails: { method: IdentificationMethod.TEXT_MATCH },
      isNewCompany: false,
      needsVerification: false,
      alternativeCandidates: [],
      rawIdentificationData: {},
    };
  }

  // ========== 輔助方法 ==========

  private async getCompanyById(id: string) {
    return prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
  }

  private async matchLogoToCompany(signature: string): Promise<{ companyId: string; similarity: number } | null> {
    // 實際實現會比對 Logo 特徵簽名
    const companies = await prisma.company.findMany({
      where: {
        logoSignature: { not: null },
      },
      select: {
        id: true,
        logoSignature: true,
      },
    });

    // 簡化的相似度比對
    for (const company of companies) {
      const similarity = this.calculateSimilarity(signature, company.logoSignature!);
      if (similarity > 0.7) {
        return { companyId: company.id, similarity };
      }
    }

    return null;
  }

  private calculateSimilarity(sig1: string, sig2: string): number {
    // 簡化的相似度計算（實際應使用向量相似度）
    return sig1 === sig2 ? 1.0 : 0.0;
  }

  private extractFullText(extractedData: ExtractedDocumentData): string {
    const parts: string[] = [];

    if (extractedData.vendorName) parts.push(extractedData.vendorName);
    if (extractedData.vendorAddress) parts.push(extractedData.vendorAddress);
    if (extractedData.content) parts.push(extractedData.content);

    return parts.join(' ');
  }

  private extractAlternativeCandidates(rawData: RawIdentificationData): CompanyCandidate[] {
    const candidates: CompanyCandidate[] = [];

    if (rawData.textMatches) {
      for (const match of rawData.textMatches) {
        candidates.push({
          companyId: match.companyId,
          companyName: '', // 需要查詢
          confidence: match.confidence,
          method: IdentificationMethod.TEXT_MATCH,
        });
      }
    }

    return candidates;
  }
}
```

### 4. 發行者識別驗證服務

```typescript
// src/services/issuer-verification.service.ts

/**
 * @fileoverview 發行者驗證服務
 * @description
 *   管理待驗證的公司識別結果，支援人工確認、拒絕、合併操作。
 *
 * @module src/services/issuer-verification
 * @since Epic 15 - Story 15.2
 */

import { prisma } from '@/lib/prisma';
import {
  PendingCompanyVerification,
  CompanyStatus,
  VerificationResult,
} from '@/types/issuer-identification';

export class IssuerVerificationService {
  /**
   * 獲取待驗證列表
   */
  async getPendingVerifications(options?: {
    limit?: number;
    offset?: number;
    orderBy?: 'createdAt' | 'confidence';
  }): Promise<PendingCompanyVerification[]> {
    return prisma.pendingCompanyVerification.findMany({
      where: {
        verificationResult: null,
      },
      orderBy: {
        [options?.orderBy || 'createdAt']: 'desc',
      },
      take: options?.limit || 20,
      skip: options?.offset || 0,
    });
  }

  /**
   * 確認公司識別
   */
  async confirmVerification(
    verificationId: string,
    userId: string,
    confirmedCompanyName?: string,
  ): Promise<void> {
    const verification = await prisma.pendingCompanyVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new Error('Verification not found');
    }

    await prisma.$transaction(async (tx) => {
      // 更新驗證記錄
      await tx.pendingCompanyVerification.update({
        where: { id: verificationId },
        data: {
          verificationResult: 'CONFIRMED',
          verifiedAt: new Date(),
          verifiedBy: userId,
        },
      });

      // 更新公司狀態
      const companyName = confirmedCompanyName || verification.suggestedCompanyName;

      // 查找是否已有同名公司
      const existingCompany = await tx.company.findFirst({
        where: { name: companyName },
      });

      if (existingCompany) {
        // 更新現有公司狀態
        await tx.company.update({
          where: { id: existingCompany.id },
          data: {
            status: CompanyStatus.VERIFIED,
            verifiedAt: new Date(),
            verifiedBy: userId,
          },
        });
      }
    });
  }

  /**
   * 拒絕識別結果
   */
  async rejectVerification(
    verificationId: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    await prisma.pendingCompanyVerification.update({
      where: { id: verificationId },
      data: {
        verificationResult: 'REJECTED',
        verifiedAt: new Date(),
        verifiedBy: userId,
      },
    });
  }

  /**
   * 合併到現有公司
   */
  async mergeToExistingCompany(
    verificationId: string,
    targetCompanyId: string,
    userId: string,
  ): Promise<void> {
    const verification = await prisma.pendingCompanyVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new Error('Verification not found');
    }

    await prisma.$transaction(async (tx) => {
      // 更新驗證記錄
      await tx.pendingCompanyVerification.update({
        where: { id: verificationId },
        data: {
          verificationResult: 'MERGED',
          mergedToCompanyId: targetCompanyId,
          verifiedAt: new Date(),
          verifiedBy: userId,
        },
      });

      // 將建議名稱添加為目標公司別名
      const targetCompany = await tx.company.findUnique({
        where: { id: targetCompanyId },
      });

      if (targetCompany) {
        const aliases = targetCompany.aliases || [];
        if (!aliases.includes(verification.suggestedCompanyName)) {
          await tx.company.update({
            where: { id: targetCompanyId },
            data: {
              aliases: [...aliases, verification.suggestedCompanyName],
            },
          });
        }
      }
    });
  }

  /**
   * 批量確認
   */
  async bulkConfirm(
    verificationIds: string[],
    userId: string,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const id of verificationIds) {
      try {
        await this.confirmVerification(id, userId);
        success++;
      } catch {
        failed++;
      }
    }

    return { success, failed };
  }
}

export const issuerVerificationService = new IssuerVerificationService();
```

### 5. API 端點

```typescript
// src/app/api/v1/issuer-verifications/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { issuerVerificationService } from '@/services/issuer-verification.service';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().optional().default(20),
  offset: z.coerce.number().optional().default(0),
  orderBy: z.enum(['createdAt', 'confidence']).optional().default('createdAt'),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));

  const verifications = await issuerVerificationService.getPendingVerifications(query);

  return NextResponse.json({
    success: true,
    data: verifications,
  });
}

// src/app/api/v1/issuer-verifications/[id]/confirm/route.ts

const confirmSchema = z.object({
  confirmedCompanyName: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await request.json();
  const data = confirmSchema.parse(body);
  const userId = 'current-user-id'; // 從認證獲取

  await issuerVerificationService.confirmVerification(
    params.id,
    userId,
    data.confirmedCompanyName,
  );

  return NextResponse.json({ success: true });
}

// src/app/api/v1/issuer-verifications/[id]/reject/route.ts

const rejectSchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await request.json();
  const data = rejectSchema.parse(body);
  const userId = 'current-user-id';

  await issuerVerificationService.rejectVerification(params.id, userId, data.reason);

  return NextResponse.json({ success: true });
}

// src/app/api/v1/issuer-verifications/[id]/merge/route.ts

const mergeSchema = z.object({
  targetCompanyId: z.string(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await request.json();
  const data = mergeSchema.parse(body);
  const userId = 'current-user-id';

  await issuerVerificationService.mergeToExistingCompany(
    params.id,
    data.targetCompanyId,
    userId,
  );

  return NextResponse.json({ success: true });
}
```

---

## 目錄結構

```
src/
├── types/
│   └── issuer-identification.ts           # 發行者識別類型
├── services/
│   ├── unified-processor/
│   │   └── adapters/
│   │       └── issuer-identifier-adapter.ts  # 識別適配器
│   └── issuer-verification.service.ts     # 驗證服務
└── app/api/v1/
    └── issuer-verifications/
        ├── route.ts                        # GET 待驗證列表
        └── [id]/
            ├── confirm/route.ts            # POST 確認
            ├── reject/route.ts             # POST 拒絕
            └── merge/route.ts              # POST 合併
```

---

## 驗收標準對應

| AC | 實現 |
|----|------|
| 調用現有的發行者識別服務（Story 0-8） | ✅ IssuerIdentifierAdapter 調用 documentIssuerService |
| 獲取識別的公司 ID 和信心度 | ✅ IssuerIdentificationResult 包含 companyId 和 confidence |
| AUTO_CREATE_COMPANY = true 時自動建立 | ✅ createNewCompanyResult() 創建 AUTO_CREATED 狀態公司 |
| 識別失敗或信心度 < 50% 記錄為待人工確認 | ✅ createLowConfidenceResult() 和 needsVerification 標記 |
| 繼續處理（使用預設配置） | ✅ 返回 success: false 但處理管道繼續 |

---

## 測試要點

1. **Logo 識別**：上傳帶 Logo 的文件，驗證識別準確度
2. **Header 識別**：上傳頁首包含公司名的文件
3. **自動創建公司**：新公司應創建為 AUTO_CREATED 狀態
4. **低信心度處理**：信心度 < 50% 應標記為待驗證
5. **驗證流程**：確認、拒絕、合併操作
6. **別名匹配**：合併後別名應正確添加

---

*Tech Spec 建立日期: 2026-01-02*
*關聯 Story: Epic 15 - Story 15.2*
