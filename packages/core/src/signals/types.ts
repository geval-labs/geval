import { z } from "zod";

/**
 * Signal types supported by Geval
 */
export const SignalTypeSchema = z.enum([
  "eval", // References eval result artifacts
  "human_review", // Human approval/rejection
  "risk_flag", // Risk level indicator
  "external_reference", // External URLs/references
]);
export type SignalType = z.infer<typeof SignalTypeSchema>;

/**
 * Human review status
 */
export const HumanReviewStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type HumanReviewStatus = z.infer<typeof HumanReviewStatusSchema>;

/**
 * Risk flag level
 */
export const RiskFlagLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskFlagLevel = z.infer<typeof RiskFlagLevelSchema>;

/**
 * Signal value - opaque value that can be any JSON-serializable type
 */
export type SignalValue = unknown;

/**
 * Signal metadata - string key-value pairs
 */
export const SignalMetadataSchema = z.record(z.string());
export type SignalMetadata = z.infer<typeof SignalMetadataSchema>;

/**
 * Signal - a generic input to the decision engine
 */
export const SignalSchema = z.object({
  /** Unique identifier for this signal */
  id: z.string().min(1),
  /** Type of signal */
  type: SignalTypeSchema,
  /** Name/identifier of the signal */
  name: z.string().min(1),
  /** Opaque value (any JSON-serializable type) */
  value: z.unknown(),
  /** String key-value metadata */
  metadata: SignalMetadataSchema.optional(),
});
export type Signal = z.infer<typeof SignalSchema>;

/**
 * Signal collection - normalized list of signals
 */
export interface SignalCollection {
  signals: Signal[];
}
