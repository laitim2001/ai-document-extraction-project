/**
 * @fileoverview 全域 Forwarder 識別服務 - Forwarder 快取與全域共享
 * @description
 *   提供 Forwarder 的全域共享機制：
 *   - 全域 Forwarder 列表快取
 *   - 識別模式快取
 *   - 快取失效管理
 *
 *   ## 架構概覽
 *
 *   ```
 *   所有城市共用相同 Forwarder 配置
 *            ↓
 *   ┌──────────────────────┐
 *   │  ForwarderIdentifier │
 *   │     (Singleton)      │
 *   └───────────┬──────────┘
 *               │
 *   ┌───────────┴───────────┐
 *   │                       │
 *   ▼                       ▼
 *   Memory Cache        PostgreSQL
 *   (10 min TTL)     (Forwarder, Patterns)
 *   ```
 *
 * @module src/services/forwarder-identifier
 * @author Development Team
 * @since Epic 6 - Story 6.5 (Global Rule Sharing)
 * @lastModified 2025-12-19
 *
 * @features
 *   - 全域 Forwarder 快取
 *   - 識別模式快取
 *   - 快取失效機制
 *   - 版本追蹤
 *
 * @dependencies
 *   - prisma - 資料庫操作
 *   - rule-resolver - 版本追蹤
 *
 * @related
 *   - src/services/rule-resolver.ts - 規則解析服務
 *   - src/services/identification/identification.service.ts - 識別服務
 */

import { prisma } from '@/lib/prisma';
import { ruleResolver, ENTITY_TYPES, type CacheInvalidationEvent } from './rule-resolver';

// ============================================================
// Constants
// ============================================================

/** 快取 TTL（毫秒）- 10 分鐘 */
const CACHE_TTL_MS = 10 * 60 * 1000;

// ============================================================
// Types
// ============================================================

/**
 * Forwarder 基本資訊
 */
export interface ForwarderInfo {
  /** Forwarder ID */
  id: string;
  /** 名稱 */
  name: string;
  /** 代碼（如 DHL, FDX） */
  code: string;
  /** 顯示名稱 */
  displayName: string;
  /** 預設信心度 */
  defaultConfidence: number;
  /** 狀態 */
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
}

/**
 * 識別模式
 */
export interface IdentificationPattern {
  /** 公司名稱變體 */
  names: string[];
  /** 唯一關鍵字 */
  keywords: string[];
  /** 文件格式模式（正則） */
  formats: string[];
  /** Logo 附近文字 */
  logoText: string[];
}

/**
 * 快取項目
 */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ============================================================
// ForwarderIdentifier Service
// ============================================================

/**
 * 全域 Forwarder 識別器
 *
 * @description
 *   提供 Forwarder 的全域快取和識別模式管理。
 *   Forwarder 是全域共享的，所有城市使用相同的配置。
 */
export class ForwarderIdentifier {
  private static instance: ForwarderIdentifier | null = null;

  /** Forwarder 列表快取 */
  private forwardersCache: CacheEntry<ForwarderInfo[]> | null = null;

  /** 識別模式快取 (forwarderId -> patterns) */
  private patternsCache: Map<string, CacheEntry<IdentificationPattern>> = new Map();

  /**
   * 私有建構函數（單例模式）
   */
  private constructor() {
    // 定期清理過期快取
    setInterval(() => this.cleanExpiredCache(), 60000);
  }

  /**
   * 取得 ForwarderIdentifier 單例
   */
  static getInstance(): ForwarderIdentifier {
    if (!ForwarderIdentifier.instance) {
      ForwarderIdentifier.instance = new ForwarderIdentifier();
    }
    return ForwarderIdentifier.instance;
  }

  /**
   * 重置單例（僅用於測試）
   */
  static resetInstance(): void {
    ForwarderIdentifier.instance = null;
  }

  // ============================================================
  // Forwarder Fetching
  // ============================================================

  /**
   * 取得所有啟用的 Forwarder
   *
   * @description
   *   Forwarder 是全域共享的，無城市過濾。
   *
   * @returns 啟用的 Forwarder 列表
   */
  async getAllActiveForwarders(): Promise<ForwarderInfo[]> {
    const now = Date.now();

    // 檢查快取
    if (this.forwardersCache && this.forwardersCache.expiresAt > now) {
      return this.forwardersCache.data;
    }

    // REFACTOR-001: forwarder → company
    // 從資料庫取得
    const forwarders = await prisma.company.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        displayName: true,
        defaultConfidence: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });

    // REFACTOR-001: forwarder → company (添加類型標註 + 處理 null code)
    const forwarderInfos: ForwarderInfo[] = forwarders.map((f) => ({
      id: f.id,
      name: f.name,
      code: f.code ?? '', // code 可能為 null，提供空字串預設值
      displayName: f.displayName,
      defaultConfidence: f.defaultConfidence,
      status: f.status as 'ACTIVE' | 'INACTIVE' | 'PENDING', // REFACTOR-001: CompanyStatus → ForwarderInfo status
    }));

    // 更新快取
    this.forwardersCache = {
      data: forwarderInfos,
      expiresAt: now + CACHE_TTL_MS,
    };

    return forwarderInfos;
  }

  /**
   * 取得所有 Forwarder（包含非啟用狀態）
   *
   * @returns 所有 Forwarder 列表
   */
  // REFACTOR-001: forwarder → company
  async getAllForwarders(): Promise<ForwarderInfo[]> {
    const forwarders = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        displayName: true,
        defaultConfidence: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });

    return forwarders.map((f) => ({
      id: f.id,
      name: f.name,
      code: f.code ?? '', // REFACTOR-001: 處理 null code
      displayName: f.displayName,
      defaultConfidence: f.defaultConfidence,
      status: f.status as 'ACTIVE' | 'INACTIVE' | 'PENDING', // REFACTOR-001: CompanyStatus → ForwarderInfo status
    }));
  }

  /**
   * 根據 ID 取得 Forwarder
   *
   * @param id - Forwarder ID
   * @returns Forwarder 資訊或 null
   */
  async getForwarderById(id: string): Promise<ForwarderInfo | null> {
    const forwarders = await this.getAllActiveForwarders();
    return forwarders.find((f) => f.id === id) || null;
  }

  /**
   * 根據代碼取得 Forwarder
   *
   * @param code - Forwarder 代碼
   * @returns Forwarder 資訊或 null
   */
  async getForwarderByCode(code: string): Promise<ForwarderInfo | null> {
    const forwarders = await this.getAllActiveForwarders();
    return forwarders.find((f) => f.code === code) || null;
  }

  // ============================================================
  // Pattern Fetching
  // ============================================================

  /**
   * 取得 Forwarder 的識別模式
   *
   * @param forwarderId - Forwarder ID
   * @returns 識別模式
   */
  async getForwarderPatterns(forwarderId: string): Promise<IdentificationPattern> {
    const now = Date.now();

    // 檢查快取
    const cached = this.patternsCache.get(forwarderId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    // REFACTOR-001: forwarder → company
    // 從資料庫取得
    const forwarder = await prisma.company.findUnique({
      where: { id: forwarderId },
      select: { identificationPatterns: true },
    });

    const patterns = (forwarder?.identificationPatterns as unknown as IdentificationPattern) || {
      names: [],
      keywords: [],
      formats: [],
      logoText: [],
    };

    // 更新快取
    this.patternsCache.set(forwarderId, {
      data: patterns,
      expiresAt: now + CACHE_TTL_MS,
    });

    return patterns;
  }

  // ============================================================
  // Cache Invalidation
  // ============================================================

  /**
   * 失效所有 Forwarder 快取
   */
  async invalidateCache(): Promise<void> {
    // 清除快取
    this.forwardersCache = null;
    this.patternsCache.clear();

    // 遞增版本
    await prisma.ruleCacheVersion.upsert({
      where: { entityType: ENTITY_TYPES.FORWARDERS },
      create: { entityType: ENTITY_TYPES.FORWARDERS, version: 1 },
      update: { version: { increment: 1 } },
    });

    // 通知 RuleResolver
    const event: CacheInvalidationEvent = {
      type: ENTITY_TYPES.FORWARDERS,
      timestamp: new Date().toISOString(),
    };

    // 透過 RuleResolver 的回調系統通知
    this.notifyInvalidation(event);
  }

  /**
   * 失效特定 Forwarder 的模式快取
   *
   * @param forwarderId - Forwarder ID
   */
  invalidatePatternCache(forwarderId: string): void {
    this.patternsCache.delete(forwarderId);
  }

  /**
   * 通知快取失效
   */
  private notifyInvalidation(_event: CacheInvalidationEvent): void {
    // 使用 RuleResolver 的事件系統
    const unsubscribe = ruleResolver.onCacheInvalidation(() => {
      // 這裡可以添加額外的失效處理邏輯
    });
    unsubscribe(); // 立即取消訂閱，因為我們只是發送事件
  }

  // ============================================================
  // Cache Management
  // ============================================================

  /**
   * 清理過期快取
   */
  private cleanExpiredCache(): void {
    const now = Date.now();

    // 清理 Forwarder 列表快取
    if (this.forwardersCache && this.forwardersCache.expiresAt <= now) {
      this.forwardersCache = null;
    }

    // 清理模式快取
    for (const [key, entry] of this.patternsCache.entries()) {
      if (entry.expiresAt <= now) {
        this.patternsCache.delete(key);
      }
    }
  }

  /**
   * 取得快取統計
   *
   * @returns 快取統計資訊
   */
  getCacheStats(): {
    forwardersCached: boolean;
    patternsCount: number;
  } {
    return {
      forwardersCached: this.forwardersCache !== null,
      patternsCount: this.patternsCache.size,
    };
  }

  /**
   * 強制清除所有快取（不發布事件）
   */
  clearCache(): void {
    this.forwardersCache = null;
    this.patternsCache.clear();
  }

  // ============================================================
  // Version Tracking
  // ============================================================

  /**
   * 取得 Forwarder 快取版本
   *
   * @returns 當前版本號
   */
  async getVersion(): Promise<number> {
    return ruleResolver.getGlobalVersion(ENTITY_TYPES.FORWARDERS);
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * ForwarderIdentifier 單例實例
 */
export const forwarderIdentifier = ForwarderIdentifier.getInstance();
