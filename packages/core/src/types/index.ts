import { z } from "zod";

// =============================================================================
// OPERATORS
// =============================================================================

export const ComparisonOperator = z.enum([
  "==",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
]);
export type ComparisonOperator = z.infer<typeof ComparisonOperator>;

// =============================================================================
// BASELINE TYPES
// =============================================================================

export const BaselineType = z.enum([
  "previous", // Last successful run
  "main", // Main branch artifact
  "fixed", // Fixed value
]);
export type BaselineType = z.infer<typeof BaselineType>;

// =============================================================================
// DECISION STATUS
// =============================================================================

export const DecisionStatus = z.enum([
  "PASS",
  "BLOCK",
  "REQUIRES_APPROVAL",
]);
export type DecisionStatus = z.infer<typeof DecisionStatus>;

// =============================================================================
// VIOLATION ACTION
// =============================================================================

export const ViolationAction = z.enum([
  "block",
  "require_approval",
  "warn",
]);
export type ViolationAction = z.infer<typeof ViolationAction>;

// =============================================================================
// ENVIRONMENT
// =============================================================================

export const Environment = z.enum([
  "development",
  "staging",
  "production",
]);
export type Environment = z.infer<typeof Environment>;

// =============================================================================
// CONTRACT RULE SCHEMA
// =============================================================================

export const ContractRuleSchema = z.object({
  /** Name of the metric to evaluate */
  metric: z.string().min(1),
  /** Comparison operator */
  operator: ComparisonOperator,
  /** Type of baseline to compare against */
  baseline: BaselineType,
  /** Maximum allowed delta from baseline (for relative comparisons) */
  maxDelta: z.number().optional(),
  /** Fixed threshold value (when baseline is 'fixed') */
  threshold: z.number().optional(),
  /** Human-readable description of the rule */
  description: z.string().optional(),
});
export type ContractRule = z.infer<typeof ContractRuleSchema>;

// =============================================================================
// REQUIRED EVAL SCHEMA
// =============================================================================

export const RequiredEvalSchema = z.object({
  /** Unique name of the eval suite */
  name: z.string().min(1),
  /** List of rules to enforce */
  rules: z.array(ContractRuleSchema).min(1),
  /** Optional description */
  description: z.string().optional(),
});
export type RequiredEval = z.infer<typeof RequiredEvalSchema>;

// =============================================================================
// VIOLATION HANDLER SCHEMA
// =============================================================================

export const ViolationHandlerSchema = z.object({
  /** Action to take on violation */
  action: ViolationAction,
  /** Optional message template */
  message: z.string().optional(),
});
export type ViolationHandler = z.infer<typeof ViolationHandlerSchema>;

// =============================================================================
// EVAL CONTRACT SCHEMA
// =============================================================================

export const EvalContractSchema = z.object({
  /** Schema version for forward compatibility */
  version: z.literal(1),
  /** Name of the contract */
  name: z.string().min(1),
  /** Optional description */
  description: z.string().optional(),
  /** Environment this contract applies to */
  environment: Environment.optional().default("production"),
  /** Required eval suites */
  requiredEvals: z.array(RequiredEvalSchema).min(1),
  /** What to do on violation */
  onViolation: ViolationHandlerSchema,
  /** Contract metadata */
  metadata: z.record(z.string()).optional(),
});
export type EvalContract = z.infer<typeof EvalContractSchema>;

// =============================================================================
// NORMALIZED EVAL RESULT
// =============================================================================

export const MetricValueSchema = z.union([z.number(), z.boolean(), z.string()]);
export type MetricValue = z.infer<typeof MetricValueSchema>;

export const NormalizedEvalResultSchema = z.object({
  /** Name of the eval suite */
  evalName: z.string().min(1),
  /** Unique run identifier */
  runId: z.string().min(1),
  /** Timestamp of the eval run */
  timestamp: z.string().datetime().optional(),
  /** Metric name -> value map */
  metrics: z.record(MetricValueSchema),
  /** Optional metadata */
  metadata: z
    .object({
      model: z.string().optional(),
      commit: z.string().optional(),
      branch: z.string().optional(),
    })
    .passthrough()
    .optional(),
});
export type NormalizedEvalResult = z.infer<typeof NormalizedEvalResultSchema>;

// =============================================================================
// BASELINE DATA
// =============================================================================

export const BaselineDataSchema = z.object({
  /** Type of baseline */
  type: BaselineType,
  /** Metric values from baseline */
  metrics: z.record(MetricValueSchema),
  /** Source information */
  source: z
    .object({
      runId: z.string().optional(),
      commit: z.string().optional(),
      timestamp: z.string().optional(),
    })
    .optional(),
});
export type BaselineData = z.infer<typeof BaselineDataSchema>;

// =============================================================================
// VIOLATION
// =============================================================================

export const ViolationSchema = z.object({
  /** Which eval suite */
  evalName: z.string(),
  /** Which rule was violated */
  rule: ContractRuleSchema,
  /** Current metric value */
  actualValue: MetricValueSchema,
  /** Expected/baseline value */
  baselineValue: MetricValueSchema.optional(),
  /** Computed delta (if applicable) */
  delta: z.number().optional(),
  /** Human-readable explanation */
  explanation: z.string(),
});
export type Violation = z.infer<typeof ViolationSchema>;

// =============================================================================
// DECISION
// =============================================================================

export const DecisionSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("PASS"),
    evaluatedAt: z.string().datetime(),
    contractName: z.string(),
    contractVersion: z.number(),
    summary: z.string(),
  }),
  z.object({
    status: z.literal("BLOCK"),
    evaluatedAt: z.string().datetime(),
    contractName: z.string(),
    contractVersion: z.number(),
    violations: z.array(ViolationSchema).min(1),
    summary: z.string(),
  }),
  z.object({
    status: z.literal("REQUIRES_APPROVAL"),
    evaluatedAt: z.string().datetime(),
    contractName: z.string(),
    contractVersion: z.number(),
    violations: z.array(ViolationSchema).min(1),
    summary: z.string(),
  }),
]);
export type Decision = z.infer<typeof DecisionSchema>;

// =============================================================================
// ENGINE INPUT
// =============================================================================

export interface EngineInput {
  /** The contract to evaluate against */
  contract: EvalContract;
  /** Normalized eval results */
  evalResults: NormalizedEvalResult[];
  /** Baseline data (keyed by eval name) */
  baselines: Record<string, BaselineData>;
}

// =============================================================================
// ADAPTER INTERFACE
// =============================================================================

export interface EvalAdapter {
  /** Unique name of the adapter */
  name: string;
  /** Check if this adapter can handle the given data */
  supports(data: unknown): boolean;
  /** Parse and normalize the eval data */
  parse(data: unknown): NormalizedEvalResult;
}

// =============================================================================
// DIFF TYPES
// =============================================================================

export interface MetricDiff {
  metric: string;
  previous: MetricValue | undefined;
  current: MetricValue;
  delta: number | undefined;
  direction: "improved" | "regressed" | "unchanged" | "new";
}

export interface EvalDiff {
  evalName: string;
  metrics: MetricDiff[];
}

export interface ContractDiff {
  field: string;
  previous: unknown;
  current: unknown;
}
