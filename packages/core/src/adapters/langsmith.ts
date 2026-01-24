import { z } from "zod";
import type { EvalAdapter, NormalizedEvalResult } from "../types/index.js";

/**
 * Schema for LangSmith dataset export format.
 * Based on LangSmith's exported JSON structure.
 */
const LangSmithExportSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  created_at: z.string().optional(),
  modified_at: z.string().optional(),
  examples: z
    .array(
      z.object({
        id: z.string().optional(),
        inputs: z.record(z.unknown()).optional(),
        outputs: z.record(z.unknown()).optional(),
        reference_outputs: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
  // Eval run results format
  results: z
    .array(
      z.object({
        example_id: z.string().optional(),
        run_id: z.string().optional(),
        feedback: z
          .array(
            z.object({
              key: z.string(),
              score: z.number().optional(),
              value: z.union([z.string(), z.number(), z.boolean()]).optional(),
              comment: z.string().optional(),
            })
          )
          .optional(),
        execution_time: z.number().optional(),
      })
    )
    .optional(),
  // Aggregate scores
  aggregate_feedback: z.record(z.number()).optional(),
  run_metadata: z
    .object({
      project_name: z.string().optional(),
      run_name: z.string().optional(),
      model: z.string().optional(),
      commit: z.string().optional(),
    })
    .optional(),
});

type LangSmithExport = z.infer<typeof LangSmithExportSchema>;

/**
 * Adapter for LangSmith eval exports.
 * Converts LangSmith's export format to Geval's normalized format.
 *
 * @see https://docs.smith.langchain.com/
 */
export class LangSmithAdapter implements EvalAdapter {
  readonly name = "langsmith";

  /**
   * Check if the data looks like LangSmith export
   */
  supports(data: unknown): boolean {
    if (!isObject(data)) return false;

    // LangSmith exports typically have 'examples' or 'results' with 'feedback'
    const hasExamples = "examples" in data && Array.isArray(data.examples);
    const hasResults =
      "results" in data &&
      Array.isArray(data.results) &&
      data.results.length > 0 &&
      isObject(data.results[0]) &&
      ("feedback" in data.results[0] || "run_id" in data.results[0]);
    const hasAggFeedback = "aggregate_feedback" in data;

    return hasExamples || hasResults || hasAggFeedback;
  }

  /**
   * Parse LangSmith export and convert to normalized format
   */
  parse(data: unknown): NormalizedEvalResult {
    const result = LangSmithExportSchema.safeParse(data);

    if (!result.success) {
      throw new Error(
        `Invalid LangSmith format: ${result.error.issues.map((i) => i.message).join(", ")}`
      );
    }

    return this.normalize(result.data);
  }

  /**
   * Convert LangSmith export to normalized format
   */
  private normalize(data: LangSmithExport): NormalizedEvalResult {
    const metrics: Record<string, number> = {};

    // Use aggregate feedback if available (pre-computed)
    if (data.aggregate_feedback) {
      for (const [key, value] of Object.entries(data.aggregate_feedback)) {
        metrics[key] = value;
      }
    }

    // Process individual results if available
    if (data.results && data.results.length > 0) {
      const feedbackAggs: Record<string, number[]> = {};
      const executionTimes: number[] = [];

      for (const result of data.results) {
        // Aggregate feedback scores
        if (result.feedback) {
          for (const fb of result.feedback) {
            if (fb.score !== undefined) {
              if (!feedbackAggs[fb.key]) {
                feedbackAggs[fb.key] = [];
              }
              feedbackAggs[fb.key]!.push(fb.score);
            }
          }
        }

        // Execution times
        if (result.execution_time !== undefined) {
          executionTimes.push(result.execution_time);
        }
      }

      // Compute averages for feedback scores
      for (const [key, values] of Object.entries(feedbackAggs)) {
        if (!metrics[key]) {
          metrics[`avg_${key}`] = values.reduce((a, b) => a + b, 0) / values.length;
        }
      }

      // Execution time metrics
      if (executionTimes.length > 0) {
        metrics["avg_execution_time"] =
          executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
        metrics["total_examples"] = data.results.length;
      }
    }

    // Basic count metrics
    if (data.examples) {
      metrics["dataset_size"] = data.examples.length;
    }

    return {
      evalName: data.name ?? "langsmith",
      runId: data.run_metadata?.run_name ?? generateRunId(),
      timestamp: data.modified_at ?? data.created_at,
      metrics,
      metadata: {
        model: data.run_metadata?.model,
        commit: data.run_metadata?.commit,
      },
    };
  }
}

/**
 * Type guard for objects
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Generate a simple run ID
 */
function generateRunId(): string {
  return `langsmith-${Date.now()}`;
}
