import { z } from "zod";
import { DecisionStatusSchema } from "../types/index.js";

/**
 * Human decision types
 */
export const HumanDecisionTypeSchema = z.enum(["approved", "rejected"]);
export type HumanDecisionType = z.infer<typeof HumanDecisionTypeSchema>;

/**
 * Human decision artifact
 */
export const HumanDecisionSchema = z.object({
  /** Decision type */
  decision: HumanDecisionTypeSchema,
  /** Who made the decision */
  by: z.string().min(1),
  /** Reason for the decision */
  reason: z.string().min(1),
  /** Timestamp (ISO8601) */
  timestamp: z.string().datetime(),
});
export type HumanDecision = z.infer<typeof HumanDecisionSchema>;

/**
 * Decision record - emitted after every evaluation
 */
export const DecisionRecordSchema = z.object({
  /** Git commit SHA */
  commit: z.string().optional(),
  /** Environment */
  environment: z.string().min(1),
  /** Final decision */
  decision: DecisionStatusSchema,
  /** Reason for decision */
  reason: z.string().optional(),
  /** Input hashes for reproducibility */
  inputs: z
    .object({
      eval_hash: z.string().optional(),
      signals_hash: z.string().optional(),
      policy_hash: z.string().optional(),
    })
    .optional(),
  /** Evidence files referenced */
  evidence: z.array(z.string()).optional(),
  /** Timestamp */
  timestamp: z.string().datetime(),
});
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;
