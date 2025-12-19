/**
 * @fileoverview 規則版本同步 Hook
 * @description
 *   使用 React Query 定期輪詢規則快取版本，包含：
 *   - 自動偵測版本變更
 *   - 自動失效相關查詢快取
 *   - 提供手動刷新功能
 *   - 支援版本過期通知
 *
 *   ## 運作原理
 *
 *   ```
 *   Client                    Server
 *     │                          │
 *     │ ─── GET /api/rules/version ──→ │
 *     │                          │
 *     │ ←─── { mappingRules: 5 } ───── │
 *     │                          │
 *     │ (localVersion < serverVersion) │
 *     │                          │
 *     │ invalidateQueries(['rules']) │
 *     └──────────────────────────────┘
 *   ```
 *
 * @module src/hooks/useRuleVersion
 * @since Epic 6 - Story 6.5 (Global Rule Sharing)
 * @lastModified 2025-12-19
 *
 * @dependencies
 *   - @tanstack/react-query - React Query
 *
 * @related
 *   - src/app/api/rules/version/route.ts - 版本 API
 *   - src/services/rule-resolver.ts - 規則解析服務
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ============================================================
// Types
// ============================================================

/**
 * 規則版本資訊
 */
interface RuleVersions {
  /** 映射規則版本 */
  mappingRules: number;
  /** Forwarders 版本 */
  forwarders: number;
}

/**
 * API 響應格式
 */
interface VersionApiResponse {
  success: boolean;
  data: RuleVersions & {
    timestamp: string;
  };
}

/**
 * Hook 返回值
 */
interface UseRuleVersionReturn {
  /** 本地版本 */
  versions: RuleVersions;
  /** 伺服器版本 */
  serverVersions: RuleVersions | undefined;
  /** 是否有更新 */
  isOutdated: boolean;
  /** 是否正在載入 */
  isLoading: boolean;
  /** 錯誤 */
  error: Error | null;
  /** 手動刷新 */
  refreshRules: () => Promise<void>;
  /** 最後同步時間 */
  lastSyncedAt: Date | null;
}

/**
 * Hook 選項
 */
interface UseRuleVersionOptions {
  /** 輪詢間隔（毫秒），預設 30 秒 */
  pollingInterval?: number;
  /** 是否啟用，預設 true */
  enabled?: boolean;
  /** 版本更新回調 */
  onVersionUpdate?: (type: 'mappingRules' | 'forwarders') => void;
}

// ============================================================
// Constants
// ============================================================

/** 預設輪詢間隔（30 秒） */
const DEFAULT_POLLING_INTERVAL = 30 * 1000;

/** 版本 API 端點 */
const VERSION_API_ENDPOINT = '/api/rules/version';

/** 查詢快取鍵 */
const QUERY_KEYS = {
  RULE_VERSIONS: ['rule-versions'],
  RULES: ['rules'],
  FORWARDER_RULES: ['forwarder-rules'],
  FORWARDERS: ['forwarders'],
} as const;

// ============================================================
// useRuleVersion Hook
// ============================================================

/**
 * 規則版本同步 Hook
 *
 * @description
 *   定期輪詢伺服器規則版本，自動偵測版本變更並失效相關快取。
 *   確保客戶端始終使用最新的規則配置。
 *
 * @param options - Hook 選項
 * @returns Hook 返回值
 *
 * @example
 *   // 基本用法
 *   const { isOutdated, refreshRules } = useRuleVersion();
 *
 * @example
 *   // 自定義輪詢間隔
 *   const { versions, serverVersions } = useRuleVersion({
 *     pollingInterval: 60000, // 每分鐘檢查一次
 *   });
 *
 * @example
 *   // 監聽版本更新
 *   useRuleVersion({
 *     onVersionUpdate: (type) => {
 *       toast.info(`${type} has been updated`);
 *     },
 *   });
 */
export function useRuleVersion(options: UseRuleVersionOptions = {}): UseRuleVersionReturn {
  const {
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    enabled = true,
    onVersionUpdate,
  } = options;

  const queryClient = useQueryClient();

  // 本地版本狀態
  const [localVersions, setLocalVersions] = useState<RuleVersions>({
    mappingRules: 0,
    forwarders: 0,
  });

  // 最後同步時間
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // 定期輪詢伺服器版本
  const {
    data: serverResponse,
    isLoading,
    error,
  } = useQuery<VersionApiResponse, Error>({
    queryKey: QUERY_KEYS.RULE_VERSIONS,
    queryFn: async () => {
      const response = await fetch(VERSION_API_ENDPOINT);

      if (!response.ok) {
        throw new Error('Failed to fetch rule versions');
      }

      return response.json();
    },
    refetchInterval: pollingInterval,
    staleTime: pollingInterval / 2,
    enabled,
    retry: 2,
  });

  const serverVersions = serverResponse?.data;

  // 檢測版本變更並失效快取
  useEffect(() => {
    if (!serverVersions) return;

    const hasRulesUpdate = serverVersions.mappingRules > localVersions.mappingRules;
    const hasForwardersUpdate = serverVersions.forwarders > localVersions.forwarders;

    if (hasRulesUpdate) {
      console.log('[useRuleVersion] Rules updated, invalidating queries');

      // 失效規則相關查詢
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RULES });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FORWARDER_RULES });

      // 通知回調
      onVersionUpdate?.('mappingRules');
    }

    if (hasForwardersUpdate) {
      console.log('[useRuleVersion] Forwarders updated, invalidating queries');

      // 失效 Forwarder 相關查詢
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FORWARDERS });

      // 通知回調
      onVersionUpdate?.('forwarders');
    }

    // 更新本地版本
    if (hasRulesUpdate || hasForwardersUpdate) {
      setLocalVersions({
        mappingRules: serverVersions.mappingRules,
        forwarders: serverVersions.forwarders,
      });
      setLastSyncedAt(new Date());
    }
  }, [serverVersions, localVersions, queryClient, onVersionUpdate]);

  // 首次載入時初始化本地版本
  useEffect(() => {
    if (serverVersions && localVersions.mappingRules === 0 && localVersions.forwarders === 0) {
      setLocalVersions({
        mappingRules: serverVersions.mappingRules,
        forwarders: serverVersions.forwarders,
      });
      setLastSyncedAt(new Date());
    }
  }, [serverVersions, localVersions]);

  // 手動刷新函數
  const refreshRules = useCallback(async () => {
    console.log('[useRuleVersion] Manual refresh triggered');

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RULES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FORWARDERS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FORWARDER_RULES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RULE_VERSIONS }),
    ]);

    setLastSyncedAt(new Date());
  }, [queryClient]);

  // 計算是否過期
  const isOutdated = Boolean(
    serverVersions &&
      (serverVersions.mappingRules > localVersions.mappingRules ||
        serverVersions.forwarders > localVersions.forwarders)
  );

  return {
    versions: localVersions,
    serverVersions: serverVersions
      ? {
          mappingRules: serverVersions.mappingRules,
          forwarders: serverVersions.forwarders,
        }
      : undefined,
    isOutdated,
    isLoading,
    error: error ?? null,
    refreshRules,
    lastSyncedAt,
  };
}

// ============================================================
// Additional Exports
// ============================================================

/**
 * 規則版本查詢鍵
 * 可用於手動操作查詢快取
 */
export { QUERY_KEYS as RULE_VERSION_QUERY_KEYS };
