/**
 * @fileoverview Feature Flags Configuration for Dynamic Prompt System
 * @description
 *   Provides feature flag management for toggling between dynamic and static prompts.
 *   Uses environment variables to control feature enablement with sensible defaults.
 *
 *   Feature Flag Hierarchy:
 *   - FEATURE_DYNAMIC_PROMPT: Master toggle for all dynamic prompts
 *   - Individual toggles: Control specific prompt types when master is enabled
 *
 * @module src/config/feature-flags
 * @since Epic 14 - Story 14-4 (GPT Vision 服務整合)
 * @lastModified 2026-01-03
 *
 * @dependencies
 *   - Environment variables (process.env)
 *
 * @related
 *   - src/services/hybrid-prompt-provider.service.ts - Uses feature flags
 *   - src/services/gpt-vision.service.ts - Consumes prompt provider
 */

import { PromptType } from '@/types/prompt-config';

/**
 * Feature flags interface for dynamic prompt system
 */
export interface FeatureFlags {
  /** Master toggle for all dynamic prompts */
  dynamicPromptEnabled: boolean;
  /** Enable dynamic prompts for document issuer identification */
  dynamicIssuerPromptEnabled: boolean;
  /** Enable dynamic prompts for term classification */
  dynamicTermPromptEnabled: boolean;
  /** Enable dynamic prompts for field extraction */
  dynamicFieldPromptEnabled: boolean;
  /** Enable dynamic prompts for validation */
  dynamicValidationPromptEnabled: boolean;
}

/**
 * Prompt type to feature flag key mapping
 */
const PROMPT_TYPE_TO_FLAG_KEY: Record<PromptType, keyof Omit<FeatureFlags, 'dynamicPromptEnabled'>> = {
  [PromptType.ISSUER_IDENTIFICATION]: 'dynamicIssuerPromptEnabled',
  [PromptType.TERM_CLASSIFICATION]: 'dynamicTermPromptEnabled',
  [PromptType.FIELD_EXTRACTION]: 'dynamicFieldPromptEnabled',
  [PromptType.VALIDATION]: 'dynamicValidationPromptEnabled',
};

/**
 * Get current feature flags from environment variables
 *
 * @description
 *   Reads feature flags from environment variables with the following defaults:
 *   - dynamicPromptEnabled: false (opt-in for safety)
 *   - Individual toggles: true when master is enabled (opt-out model)
 *
 * @returns {FeatureFlags} Current feature flag values
 *
 * @example
 * ```typescript
 * const flags = getFeatureFlags();
 * if (flags.dynamicPromptEnabled && flags.dynamicIssuerPromptEnabled) {
 *   // Use dynamic issuer prompts
 * }
 * ```
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    // Master toggle - must be explicitly enabled
    dynamicPromptEnabled: process.env.FEATURE_DYNAMIC_PROMPT === 'true',
    // Individual toggles - enabled by default when master is on (opt-out model)
    dynamicIssuerPromptEnabled: process.env.FEATURE_DYNAMIC_ISSUER_PROMPT !== 'false',
    dynamicTermPromptEnabled: process.env.FEATURE_DYNAMIC_TERM_PROMPT !== 'false',
    dynamicFieldPromptEnabled: process.env.FEATURE_DYNAMIC_FIELD_PROMPT !== 'false',
    dynamicValidationPromptEnabled: process.env.FEATURE_DYNAMIC_VALIDATION_PROMPT !== 'false',
  };
}

/**
 * Check if dynamic prompts should be used for a specific prompt type
 *
 * @description
 *   Determines whether to use dynamic prompts based on:
 *   1. Master toggle must be enabled
 *   2. Specific prompt type toggle must be enabled
 *
 * @param {PromptType} promptType - The type of prompt to check
 * @returns {boolean} True if dynamic prompts should be used
 *
 * @example
 * ```typescript
 * if (shouldUseDynamicPrompt(PromptType.ISSUER_IDENTIFICATION)) {
 *   const prompt = await dynamicResolver.resolvePrompt(...);
 * } else {
 *   const prompt = getStaticIssuerPrompt();
 * }
 * ```
 */
export function shouldUseDynamicPrompt(promptType: PromptType): boolean {
  const flags = getFeatureFlags();

  // Master toggle must be enabled
  if (!flags.dynamicPromptEnabled) {
    return false;
  }

  // Check specific prompt type toggle
  const flagKey = PROMPT_TYPE_TO_FLAG_KEY[promptType];
  return flags[flagKey] ?? false;
}

/**
 * Simplified helper for common prompt type checks using string literals
 *
 * @param {'issuer' | 'term' | 'field' | 'validation'} type - Prompt type as string
 * @returns {boolean} True if dynamic prompts should be used
 *
 * @example
 * ```typescript
 * if (shouldUseDynamicPromptByType('issuer')) {
 *   // Use dynamic issuer prompts
 * }
 * ```
 */
export function shouldUseDynamicPromptByType(
  type: 'issuer' | 'term' | 'field' | 'validation'
): boolean {
  const typeMapping: Record<typeof type, PromptType> = {
    issuer: PromptType.ISSUER_IDENTIFICATION,
    term: PromptType.TERM_CLASSIFICATION,
    field: PromptType.FIELD_EXTRACTION,
    validation: PromptType.VALIDATION,
  };

  return shouldUseDynamicPrompt(typeMapping[type]);
}

/**
 * Get a human-readable status of all feature flags
 *
 * @description
 *   Useful for logging and debugging feature flag states
 *
 * @returns {string} Formatted string showing all flag states
 *
 * @example
 * ```typescript
 * console.log(getFeatureFlagStatus());
 * // Output: "Dynamic Prompts: ON | Issuer: ON | Term: ON | Field: OFF | Validation: ON"
 * ```
 */
export function getFeatureFlagStatus(): string {
  const flags = getFeatureFlags();

  const status = [
    `Dynamic Prompts: ${flags.dynamicPromptEnabled ? 'ON' : 'OFF'}`,
    `Issuer: ${flags.dynamicIssuerPromptEnabled ? 'ON' : 'OFF'}`,
    `Term: ${flags.dynamicTermPromptEnabled ? 'ON' : 'OFF'}`,
    `Field: ${flags.dynamicFieldPromptEnabled ? 'ON' : 'OFF'}`,
    `Validation: ${flags.dynamicValidationPromptEnabled ? 'ON' : 'OFF'}`,
  ];

  return status.join(' | ');
}
