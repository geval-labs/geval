import { z } from "zod";
import { ComparisonOperatorSchema } from "../types/index.js";
import { SignalTypeSchema } from "../signals/types.js";

/**
 * Policy rule condition - can match eval metrics or signals
 */
export const PolicyConditionSchema = z.union([
  // Eval metric condition
  z.object({
    eval: z.object({
      metric: z.string().min(1),
      operator: ComparisonOperatorSchema,
      baseline: z.enum(["fixed", "previous", "main"]),
      threshold: z.number().optional(),
      maxDelta: z.number().optional(),
    }),
  }),
  // Signal condition
  z.object({
    signal: z.object({
      type: SignalTypeSchema.optional(),
      name: z.string().optional(),
      field: z.string().optional(), // e.g., "level" for risk_flag
      operator: ComparisonOperatorSchema.optional(),
      value: z.unknown().optional(),
    }),
  }),
]);
export type PolicyCondition = z.infer<typeof PolicyConditionSchema>;

/**
 * Policy rule action
 */
export const PolicyActionSchema = z.enum(["pass", "block", "require_approval"]);
export type PolicyAction = z.infer<typeof PolicyActionSchema>;

/**
 * Policy rule
 */
export const PolicyRuleSchema = z.object({
  /** Condition to match */
  when: PolicyConditionSchema,
  /** Action to take */
  then: z.object({
    action: PolicyActionSchema,
    reason: z.string().optional(),
  }),
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

/**
 * Environment-specific policy configuration
 */
export const EnvironmentPolicySchema = z.object({
  /** Default action when no rules match */
  default: z.enum(["pass", "block", "require_approval"]).optional(),
  /** Rules for this environment */
  rules: z.array(PolicyRuleSchema).optional(),
});
export type EnvironmentPolicy = z.infer<typeof EnvironmentPolicySchema>;

/**
 * Policy configuration with environment-specific rules
 */
export const PolicySchema = z.object({
  /** Environment-specific policies */
  environments: z.record(EnvironmentPolicySchema).optional(),
  /** Global rules (applied to all environments) */
  rules: z.array(PolicyRuleSchema).optional(),
});
export type Policy = z.infer<typeof PolicySchema>;
