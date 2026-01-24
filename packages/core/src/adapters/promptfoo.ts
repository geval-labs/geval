import { z } from "zod";
import type { EvalAdapter, NormalizedEvalResult } from "../types/index.js";

/**
 * Schema for Promptfoo eval output format.
 * Based on Promptfoo's JSON output structure.
 */
const PromptfooResultSchema = z.object({
  evalId: z.string().optional(),
  results: z.array(
    z.object({
      provider: z.string().optional(),
      prompt: z.object({
        raw: z.string().optional(),
        label: z.string().optional(),
      }).optional(),
      response: z.object({
        output: z.string().optional(),
      }).optional(),
      success: z.boolean(),
      score: z.number().optional(),
      namedScores: z.record(z.number()).optional(),
      latencyMs: z.number().optional(),
      cost: z.number().optional(),
    })
  ),
  stats: z.object({
    successes: z.number(),
    failures: z.number(),
    tokenUsage: z.object({
      total: z.number().optional(),
      prompt: z.number().optional(),
      completion: z.number().optional(),
    }).optional(),
  }).optional(),
  timestamp: z.string().optional(),
});

type PromptfooResult = z.infer<typeof PromptfooResultSchema>;

/**
 * Adapter for Promptfoo eval outputs.
 * Converts Promptfoo's format to Geval's normalized format.
 *
 * @see https://www.promptfoo.dev/docs/usage/command-line/
 */
export class PromptfooAdapter implements EvalAdapter {
  readonly name = "promptfoo";

  /**
   * Check if the data looks like Promptfoo output
   */
  supports(data: unknown): boolean {
    if (!isObject(data)) return false;

    // Promptfoo outputs have a 'results' array
    return (
      "results" in data &&
      Array.isArray(data.results) &&
      data.results.length > 0 &&
      isObject(data.results[0]) &&
      "success" in data.results[0]
    );
  }

  /**
   * Parse Promptfoo output and convert to normalized format
   */
  parse(data: unknown): NormalizedEvalResult {
    const result = PromptfooResultSchema.safeParse(data);

    if (!result.success) {
      throw new Error(
        `Invalid Promptfoo format: ${result.error.issues.map((i) => i.message).join(", ")}`
      );
    }

    return this.normalize(result.data);
  }

  /**
   * Convert Promptfoo result to normalized format
   */
  private normalize(data: PromptfooResult): NormalizedEvalResult {
    const metrics: Record<string, number> = {};

    // Calculate aggregate metrics
    const totalTests = data.results.length;
    const passedTests = data.results.filter((r) => r.success).length;
    const failedTests = totalTests - passedTests;

    metrics["pass_rate"] = totalTests > 0 ? passedTests / totalTests : 0;
    metrics["fail_rate"] = totalTests > 0 ? failedTests / totalTests : 0;
    metrics["total_tests"] = totalTests;
    metrics["passed_tests"] = passedTests;
    metrics["failed_tests"] = failedTests;

    // Aggregate scores
    const scores = data.results
      .map((r) => r.score)
      .filter((s): s is number => s !== undefined);
    if (scores.length > 0) {
      metrics["avg_score"] = scores.reduce((a, b) => a + b, 0) / scores.length;
      metrics["min_score"] = Math.min(...scores);
      metrics["max_score"] = Math.max(...scores);
    }

    // Aggregate named scores
    const namedScoreAggs: Record<string, number[]> = {};
    for (const result of data.results) {
      if (result.namedScores) {
        for (const [name, value] of Object.entries(result.namedScores)) {
          if (!namedScoreAggs[name]) {
            namedScoreAggs[name] = [];
          }
          namedScoreAggs[name]!.push(value);
        }
      }
    }
    for (const [name, values] of Object.entries(namedScoreAggs)) {
      metrics[`avg_${name}`] = values.reduce((a, b) => a + b, 0) / values.length;
    }

    // Latency metrics
    const latencies = data.results
      .map((r) => r.latencyMs)
      .filter((l): l is number => l !== undefined);
    if (latencies.length > 0) {
      metrics["avg_latency_ms"] = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      metrics["p50_latency_ms"] = percentile(latencies, 50);
      metrics["p95_latency_ms"] = percentile(latencies, 95);
      metrics["p99_latency_ms"] = percentile(latencies, 99);
    }

    // Cost metrics
    const costs = data.results
      .map((r) => r.cost)
      .filter((c): c is number => c !== undefined);
    if (costs.length > 0) {
      metrics["total_cost"] = costs.reduce((a, b) => a + b, 0);
      metrics["avg_cost"] = metrics["total_cost"] / costs.length;
    }

    // Token usage from stats
    if (data.stats?.tokenUsage) {
      if (data.stats.tokenUsage.total !== undefined) {
        metrics["total_tokens"] = data.stats.tokenUsage.total;
      }
      if (data.stats.tokenUsage.prompt !== undefined) {
        metrics["prompt_tokens"] = data.stats.tokenUsage.prompt;
      }
      if (data.stats.tokenUsage.completion !== undefined) {
        metrics["completion_tokens"] = data.stats.tokenUsage.completion;
      }
    }

    return {
      evalName: "promptfoo",
      runId: data.evalId ?? generateRunId(),
      timestamp: data.timestamp,
      metrics,
      metadata: {
        model: data.results[0]?.provider,
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
 * Calculate percentile
 */
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

/**
 * Generate a simple run ID
 */
function generateRunId(): string {
  return `promptfoo-${Date.now()}`;
}
