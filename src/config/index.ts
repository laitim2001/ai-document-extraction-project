/**
 * @fileoverview Configuration Module Exports
 * @description
 *   Centralized exports for all configuration modules.
 *
 * @module src/config
 * @since Epic 14 - Story 14-4
 * @lastModified 2026-01-03
 */

// Feature Flags
export {
  type FeatureFlags,
  getFeatureFlags,
  shouldUseDynamicPrompt,
  shouldUseDynamicPromptByType,
  getFeatureFlagStatus,
} from './feature-flags';
