import { z } from "zod";
import type { EvalAdapter, NormalizedEvalResult, MetricValue } from "../types/index.js";

/**
 * Schema for generic eval format.
 * This is Geval's native format that other adapters normalize to.
 */
const GenericEvalSchema = z.object({
  evalName: z.string().min(1),
  runId: z.string().min(1),
  timestamp: z.string().datetime().optional(),
  metrics: z.record(z.union([z.number(), z.boolean(), z.string()])),
  metadata: z
    .object({
      model: z.string().optional(),
      commit: z.string().optional(),
      branch: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

/**
 * Generic adapter for Geval's native format.
 * This is the simplest adapter - it expects data already in the normalized format.
 */
export class GenericAdapter implements EvalAdapter {
  readonly name = "generic";

  /**
   * Check if the data looks like generic Geval format
   */
  supports(data: unknown): boolean {
    if (!isObject(data)) return false;

    // Must have evalName and metrics
    return (
      "evalName" in data &&
      typeof data.evalName === "string" &&
      "metrics" in data &&
      isObject(data.metrics)
    );
  }

  /**
   * Parse generic format (essentially validation + pass-through)
   */
  parse(data: unknown): NormalizedEvalResult {
    const result = GenericEvalSchema.safeParse(data);

    if (!result.success) {
      throw new Error(
        `Invalid generic eval format: ${result.error.issues.map((i) => i.message).join(", ")}`
      );
    }

    return {
      evalName: result.data.evalName,
      runId: result.data.runId,
      timestamp: result.data.timestamp,
      metrics: result.data.metrics as Record<string, MetricValue>,
      metadata: result.data.metadata,
    };
  }
}

/**
 * Type guard for objects
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
