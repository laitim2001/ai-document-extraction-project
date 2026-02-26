/**
 * @fileoverview Extraction V3.1 三階段服務導出
 * @description
 *   統一導出三階段分離架構的所有服務：
 *   - Stage 1: 公司識別服務
 *   - Stage 2: 格式識別服務
 *   - Stage 3: 欄位提取服務
 *   - StageOrchestrator: 階段協調器
 *
 * @module src/services/extraction-v3/stages
 * @since CHANGE-024 - Three-Stage Extraction Architecture
 * @lastModified 2026-02-01
 *
 * @features
 *   - Stage1CompanyService: GPT-5-nano 公司識別
 *   - Stage2FormatService: GPT-5-nano 格式識別
 *   - Stage3ExtractionService: GPT-5.2 欄位提取
 *   - StageOrchestratorService: 三階段協調
 *
 * @related
 *   - src/types/extraction-v3.types.ts - 類型定義
 *   - src/services/extraction-v3/ - V3 提取服務
 */

// ============================================================================
// Stage 1: 公司識別服務
// ============================================================================
export {
  Stage1CompanyService,
  type Stage1Input,
  type Stage1Options,
} from './stage-1-company.service';

// ============================================================================
// Stage 2: 格式識別服務
// ============================================================================
export {
  Stage2FormatService,
  type Stage2Input,
  type Stage2Options,
} from './stage-2-format.service';

// ============================================================================
// Stage 3: 欄位提取服務
// ============================================================================
export {
  Stage3ExtractionService,
  type Stage3Input,
  type Stage3Options,
} from './stage-3-extraction.service';

// ============================================================================
// 階段協調器服務
// ============================================================================
export {
  StageOrchestratorService,
  type OrchestratorInput,
  type OrchestratorOptions,
} from './stage-orchestrator.service';

// ============================================================================
// GPT Caller 服務（共用）
// ============================================================================
export {
  GptCallerService,
  type GptModelType,
  type ImageDetailMode,
  type GptCallerConfig,
  type GptCallInput,
  type GptCallResult,
} from './gpt-caller.service';
