/**
 * @geval/core
 *
 * Core library for Geval - eval-driven release enforcement.
 *
 * Geval turns evaluation results into deterministic, auditable go/no-go
 * decisions inside CI/CD. This library provides the pure, deterministic
 * decision engine that powers the Geval CLI and integrations.
 *
 * @example
 * ```typescript
 * import { evaluate, parseContract, parseEvalResult } from "@geval/core";
 *
 * const contract = parseContract(contractData);
 * const evalResults = [parseEvalResult(evalData)];
 * const baselines = {}; // First run, no baselines
 *
 * const decision = evaluate({ contract, evalResults, baselines });
 *
 * if (decision.status === "PASS") {
 *   console.log("All checks passed!");
 * } else {
 *   console.log("Blocked:", decision.violations);
 * }
 * ```
 *
 * @packageDocumentation
 */

// Re-export types
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

// Re-export Zod schemas
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
} from "./adapters/index.js";

// Version
export const VERSION = "0.0.1";
