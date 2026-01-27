/**
 * @geval/core
 *
 * Core library for Geval - eval-driven release enforcement.
 */

// Re-export types from main types module
export type {
  ComparisonOperator,
  BaselineType,
  DecisionStatus,
  ViolationAction,
  Environment,
  EvalContract,
  RequiredEval,
  ContractRule,
  ViolationHandler,
  Decision,
  Violation,
  NormalizedEvalResult,
  BaselineData,
  MetricValue,
  EngineInput,
  EvalDiff,
  MetricDiff,
  ContractDiff,
  EvalAdapter,
} from "./types/index.js";

// Re-export Zod schemas from main types module
export {
  ComparisonOperatorSchema,
  BaselineTypeSchema,
  DecisionStatusSchema,
  ViolationActionSchema,
  EnvironmentSchema,
  EvalContractSchema,
  ContractRuleSchema,
  RequiredEvalSchema,
  NormalizedEvalResultSchema,
  BaselineDataSchema,
  DecisionSchema,
  ViolationSchema,
  MetricValueSchema,
  ViolationHandlerSchema,
} from "./types/index.js";

// Contract functions
export {
  parseContract,
  parseContractFromYaml,
  validateContract,
  ContractValidationError,
  diffContracts,
} from "./contracts/index.js";

// Engine functions
export {
  evaluate,
  formatDecision,
  formatViolation,
  diffEvalResults,
} from "./engine/index.js";

// Adapter functions
export {
  GenericAdapter,
  PromptfooAdapter,
  LangSmithAdapter,
  OpenEvalsAdapter,
  detectAdapter,
  parseEvalResult,
  parseWithAdapter,
} from "./adapters/index.js";

// Source parsing types (from sources module)
export type {
  AggregationMethod,
  MetricColumn,
  SourceType,
  EvalSourceConfig,
  SourceRow,
  AggregatedMetrics,
} from "./sources/types.js";

// Source parsing schemas (from sources module)
export {
  AggregationMethodSchema,
  MetricColumnSchema,
  SourceTypeSchema,
  EvalSourceConfigSchema,
} from "./sources/types.js";

// Source parsing functions
export { parseCsv, isCsv } from "./sources/csv-parser.js";
export { aggregate } from "./sources/aggregator.js";
export { parseEvalSource, validateSourceColumns } from "./sources/source-parser.js";

// File parser (uses contract source config)
export { parseEvalFile, detectFileType } from "./sources/file-parser.js";

// Version
export const VERSION = "0.0.1";
