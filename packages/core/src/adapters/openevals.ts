import { z } from "zod";
import type { EvalAdapter, NormalizedEvalResult } from "../types/index.js";

/**
 * Schema for OpenEvals output format.
 */
const OpenEvalsResultSchema = z.object({
  eval_name: z.string().optional(),
  eval_id: z.string().optional(),
  timestamp: z.string().optional(),
  model: z.string().optional(),
  dataset: z.string().optional(),
  metrics: z.record(z.number()).optional(),
  results: z.array(
    z.object({
      input: z.unknown().optional(),
      output: z.unknown().optional(),
      expected: z.unknown().optional(),
      scores: z.record(z.number()).optional(),
      passed: z.boolean().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
  ).optional(),
  summary: z.object({
    total: z.number().optional(),
    passed: z.number().optional(),
    failed: z.number().optional(),
    accuracy: z.number().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type OpenEvalsResult = z.infer<typeof OpenEvalsResultSchema>;

/**
 * Adapter for OpenEvals outputs.
 */
export class OpenEvalsAdapter implements EvalAdapter {
  readonly name = "openevals";

  supports(data: unknown): boolean {
    if (!isObject(data)) return false;

    // If it has evalName (camelCase), it's Generic format, not OpenEvals
    if ("evalName" in data && typeof data.evalName === "string") {
      return false;
    }

    const hasResults =
      "results" in data &&
      Array.isArray(data.results) &&
      data.results.length > 0 &&
      isObject(data.results[0]) &&
      ("scores" in data.results[0] || "passed" in data.results[0]);

    const hasSummary =
      "summary" in data &&
      isObject(data.summary) &&
      ("passed" in data.summary || "accuracy" in data.summary);

    // Only match metrics if it also has OpenEvals-specific fields
    const hasMetrics =
      "metrics" in data &&
      isObject(data.metrics) &&
      ("eval_name" in data || "eval_id" in data || "dataset" in data);

    return hasResults || hasSummary || hasMetrics;
  }

  parse(data: unknown): NormalizedEvalResult {
    const result = OpenEvalsResultSchema.safeParse(data);
    if (!result.success) {
      throw new Error(
        `Invalid OpenEvals format: ${result.error.issues.map((i) => i.message).join(", ")}`
      );
    }
    return this.normalize(result.data);
  }

  private normalize(data: OpenEvalsResult): NormalizedEvalResult {
    const metrics: Record<string, number> = {};

    if (data.metrics) {
      for (const [key, value] of Object.entries(data.metrics)) {
        metrics[key] = value;
      }
    }

    if (data.summary) {
      if (data.summary.accuracy !== undefined) metrics["accuracy"] = data.summary.accuracy;
      if (data.summary.total !== undefined) metrics["total_examples"] = data.summary.total;
      if (data.summary.passed !== undefined) metrics["passed_examples"] = data.summary.passed;
      if (data.summary.failed !== undefined) metrics["failed_examples"] = data.summary.failed;
      if (data.summary.total && data.summary.passed && data.summary.total > 0) {
        metrics["pass_rate"] = data.summary.passed / data.summary.total;
        metrics["fail_rate"] = 1 - metrics["pass_rate"];
      }
    }

    if (data.results && data.results.length > 0) {
      const scoreAggs: Record<string, number[]> = {};
      let passed = 0, failed = 0;

      for (const result of data.results) {
        if (result.passed === true) passed++;
        else if (result.passed === false) failed++;
        if (result.scores) {
          for (const [key, value] of Object.entries(result.scores)) {
            if (!scoreAggs[key]) scoreAggs[key] = [];
            scoreAggs[key]!.push(value);
          }
        }
      }

      for (const [key, values] of Object.entries(scoreAggs)) {
        if (!metrics[key] && !metrics[`avg_${key}`]) {
          metrics[`avg_${key}`] = values.reduce((a, b) => a + b, 0) / values.length;
          metrics[`min_${key}`] = Math.min(...values);
          metrics[`max_${key}`] = Math.max(...values);
        }
      }

      if (metrics["pass_rate"] === undefined && (passed > 0 || failed > 0)) {
        const total = passed + failed;
        metrics["pass_rate"] = passed / total;
        metrics["fail_rate"] = failed / total;
        metrics["total_examples"] = total;
        metrics["passed_examples"] = passed;
        metrics["failed_examples"] = failed;
      }
    }

    return {
      evalName: data.eval_name ?? data.dataset ?? "openevals",
      runId: data.eval_id ?? `openevals-${Date.now()}`,
      timestamp: data.timestamp,
      metrics,
      metadata: { model: data.model },
    };
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
