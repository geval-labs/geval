import type {
  NormalizedEvalResult,
  MetricValue,
  EvalDiff,
  MetricDiff,
} from "../types/index.js";

/**
 * Result of comparing eval results
 */
export interface EvalDiffResult {
  /** Whether the results are identical */
  identical: boolean;
  /** Diffs by eval name */
  diffs: EvalDiff[];
  /** Overall summary */
  summary: string;
  /** Stats */
  stats: {
    improved: number;
    regressed: number;
    unchanged: number;
    new: number;
  };
}

/**
 * Compare eval results between two runs.
 * Useful for understanding what changed between commits.
 *
 * @param previous - Previous eval results (baseline)
 * @param current - Current eval results
 * @returns Diff result
 */
export function diffEvalResults(
  previous: NormalizedEvalResult[],
  current: NormalizedEvalResult[]
): EvalDiffResult {
  const diffs: EvalDiff[] = [];
  const stats = {
    improved: 0,
    regressed: 0,
    unchanged: 0,
    new: 0,
  };

  // Build maps for O(1) lookup
  const prevMap = new Map<string, NormalizedEvalResult>();
  for (const result of previous) {
    prevMap.set(result.evalName, result);
  }

  const currMap = new Map<string, NormalizedEvalResult>();
  for (const result of current) {
    currMap.set(result.evalName, result);
  }

  // Process all current evals
  for (const [evalName, currResult] of currMap) {
    const prevResult = prevMap.get(evalName);
    const metricDiffs = diffMetrics(
      prevResult?.metrics ?? {},
      currResult.metrics
    );

    if (metricDiffs.length > 0) {
      diffs.push({
        evalName,
        metrics: metricDiffs,
      });

      // Update stats
      for (const diff of metricDiffs) {
        stats[diff.direction]++;
      }
    }
  }

  // Check for removed evals
  for (const [evalName] of prevMap) {
    if (!currMap.has(evalName)) {
      // Eval was removed - could be a problem
      diffs.push({
        evalName,
        metrics: [
          {
            metric: "*",
            previous: "present",
            current: undefined as unknown as MetricValue,
            delta: undefined,
            direction: "regressed",
          },
        ],
      });
      stats.regressed++;
    }
  }

  const identical =
    stats.improved === 0 &&
    stats.regressed === 0 &&
    stats.new === 0;

  return {
    identical,
    diffs,
    summary: buildDiffSummary(stats),
    stats,
  };
}

/**
 * Compare metrics between two results
 */
function diffMetrics(
  previous: Record<string, MetricValue>,
  current: Record<string, MetricValue>
): MetricDiff[] {
  const diffs: MetricDiff[] = [];
  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

  for (const metric of allKeys) {
    const prevValue = previous[metric];
    const currValue = current[metric];

    // Skip if both are undefined (shouldn't happen, but be safe)
    if (prevValue === undefined && currValue === undefined) {
      continue;
    }

    // New metric
    if (prevValue === undefined && currValue !== undefined) {
      diffs.push({
        metric,
        previous: undefined,
        current: currValue,
        delta: undefined,
        direction: "new",
      });
      continue;
    }

    // Removed metric (current should always have the metric if it's required)
    if (prevValue !== undefined && currValue === undefined) {
      diffs.push({
        metric,
        previous: prevValue,
        current: undefined as unknown as MetricValue,
        delta: undefined,
        direction: "regressed",
      });
      continue;
    }

    // Both exist - compare
    if (prevValue === currValue) {
      // Unchanged - we only add to diffs if we want to show all metrics
      // For now, skip unchanged
      continue;
    }

    // Calculate delta and direction for numeric values
    let delta: number | undefined;
    let direction: "improved" | "regressed" | "unchanged";

    if (typeof prevValue === "number" && typeof currValue === "number") {
      delta = currValue - prevValue;

      // Determine direction based on metric semantics
      // Convention: lower is better for error/rate metrics, higher is better for accuracy
      // For simplicity, we assume higher is better unless the metric name suggests otherwise
      const lowerIsBetter = isLowerBetterMetric(metric);

      if (delta === 0) {
        direction = "unchanged";
      } else if (lowerIsBetter) {
        direction = delta < 0 ? "improved" : "regressed";
      } else {
        direction = delta > 0 ? "improved" : "regressed";
      }
    } else {
      // Non-numeric comparison
      direction = prevValue === currValue ? "unchanged" : "regressed";
    }

    diffs.push({
      metric,
      previous: prevValue,
      current: currValue!,
      delta,
      direction,
    });
  }

  return diffs;
}

/**
 * Heuristic to determine if a metric is "lower is better"
 * Based on common naming conventions
 */
function isLowerBetterMetric(metric: string): boolean {
  const lowerIsBetterPatterns = [
    "error",
    "rate",
    "latency",
    "time",
    "cost",
    "loss",
    "miss",
    "fail",
    "hallucination",
    "toxicity",
    "bias",
  ];

  const lowerMetric = metric.toLowerCase();
  return lowerIsBetterPatterns.some(
    (pattern) =>
      lowerMetric.includes(pattern) || lowerMetric.endsWith("_" + pattern)
  );
}

/**
 * Build a human-readable summary
 */
function buildDiffSummary(stats: {
  improved: number;
  regressed: number;
  unchanged: number;
  new: number;
}): string {
  const parts: string[] = [];

  if (stats.regressed > 0) {
    parts.push(`${stats.regressed} regressed`);
  }
  if (stats.improved > 0) {
    parts.push(`${stats.improved} improved`);
  }
  if (stats.new > 0) {
    parts.push(`${stats.new} new`);
  }
  if (stats.unchanged > 0) {
    parts.push(`${stats.unchanged} unchanged`);
  }

  if (parts.length === 0) {
    return "No changes detected";
  }

  return parts.join(", ");
}

/**
 * Format diff result for display
 */
export function formatDiffResult(
  result: EvalDiffResult,
  useColors: boolean = true
): string {
  const lines: string[] = [];

  const colors = {
    reset: useColors ? "\x1b[0m" : "",
    red: useColors ? "\x1b[31m" : "",
    green: useColors ? "\x1b[32m" : "",
    yellow: useColors ? "\x1b[33m" : "",
    gray: useColors ? "\x1b[90m" : "",
    bold: useColors ? "\x1b[1m" : "",
  };

  lines.push(`${colors.bold}Eval Results Diff${colors.reset}`);
  lines.push("");
  lines.push(result.summary);
  lines.push("");

  for (const evalDiff of result.diffs) {
    lines.push(`${colors.bold}${evalDiff.evalName}${colors.reset}`);

    for (const metricDiff of evalDiff.metrics) {
      const icon = getDirectionIcon(metricDiff.direction, colors);
      const prev =
        metricDiff.previous !== undefined
          ? String(metricDiff.previous)
          : "N/A";
      const curr = String(metricDiff.current);
      const deltaStr =
        metricDiff.delta !== undefined
          ? ` (${metricDiff.delta > 0 ? "+" : ""}${metricDiff.delta.toFixed(4)})`
          : "";

      lines.push(
        `  ${icon} ${metricDiff.metric}: ${prev} → ${curr}${deltaStr}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Get direction icon
 */
function getDirectionIcon(
  direction: string,
  colors: Record<string, string>
): string {
  switch (direction) {
    case "improved":
      return `${colors.green}↑${colors.reset}`;
    case "regressed":
      return `${colors.red}↓${colors.reset}`;
    case "new":
      return `${colors.yellow}+${colors.reset}`;
    default:
      return `${colors.gray}=${colors.reset}`;
  }
}
