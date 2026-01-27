/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import {
  parseEvalResult,
  diffEvalResults,
  type NormalizedEvalResult,
} from "@geval-labs/core";

interface DiffOptions {
  previous: string;
  current: string;
  json?: boolean;
  color?: boolean;
}

/**
 * Diff command implementation
 */
export async function diffCommand(options: DiffOptions): Promise<void> {
  const useColor = options.color !== false;

  try {
    // Load previous results
    const previousResults = loadEvalResults(options.previous);

    // Load current results
    const currentResults = loadEvalResults(options.current);

    // Compute diff
    const diffResult = diffEvalResults(previousResults, currentResults);

    // Output results
    if (options.json) {
      console.log(JSON.stringify(diffResult, null, 2));
    } else {
      formatAndPrintDiff(diffResult, useColor);
    }

    // Exit with 1 if there are regressions
    process.exit(diffResult.stats.regressed > 0 ? 1 : 0);
  } catch (error) {
    handleError(error, options.json, useColor);
  }
}

/**
 * Load eval results from a file
 */
function loadEvalResults(filePath: string): NormalizedEvalResult[] {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");

  try {
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      return data.map(parseEvalResult);
    } else {
      return [parseEvalResult(data)];
    }
  } catch (e) {
    throw new Error(
      `Failed to parse eval file ${filePath}: ${e instanceof Error ? e.message : "Unknown error"}`
    );
  }
}

/**
 * Format and print diff result
 */
function formatAndPrintDiff(
  diffResult: ReturnType<typeof diffEvalResults>,
  useColor: boolean
): void {
  const { stats, diffs, summary } = diffResult;

  // Header
  console.log(useColor ? pc.bold("Eval Results Diff") : "Eval Results Diff");
  console.log("");

  // Summary with colors
  const parts: string[] = [];
  if (stats.regressed > 0) {
    parts.push(
      useColor
        ? pc.red(`${stats.regressed} regressed`)
        : `${stats.regressed} regressed`
    );
  }
  if (stats.improved > 0) {
    parts.push(
      useColor
        ? pc.green(`${stats.improved} improved`)
        : `${stats.improved} improved`
    );
  }
  if (stats.new > 0) {
    parts.push(
      useColor
        ? pc.yellow(`${stats.new} new`)
        : `${stats.new} new`
    );
  }
  if (stats.unchanged > 0) {
    parts.push(
      useColor
        ? pc.gray(`${stats.unchanged} unchanged`)
        : `${stats.unchanged} unchanged`
    );
  }

  console.log(parts.length > 0 ? parts.join(", ") : "No changes detected");
  console.log("");

  // Detailed diffs
  for (const evalDiff of diffs) {
    console.log(useColor ? pc.bold(evalDiff.evalName) : evalDiff.evalName);

    for (const metricDiff of evalDiff.metrics) {
      const icon = getDirectionIcon(metricDiff.direction, useColor);
      const prev =
        metricDiff.previous !== undefined
          ? String(metricDiff.previous)
          : "N/A";
      const curr = String(metricDiff.current);
      const deltaStr =
        metricDiff.delta !== undefined
          ? ` (${metricDiff.delta > 0 ? "+" : ""}${metricDiff.delta.toFixed(4)})`
          : "";

      console.log(
        `  ${icon} ${metricDiff.metric}: ${prev} → ${curr}${deltaStr}`
      );
    }
    console.log("");
  }
}

/**
 * Get direction icon with optional color
 */
function getDirectionIcon(direction: string, useColor: boolean): string {
  switch (direction) {
    case "improved":
      return useColor ? pc.green("↑") : "↑";
    case "regressed":
      return useColor ? pc.red("↓") : "↓";
    case "new":
      return useColor ? pc.yellow("+") : "+";
    default:
      return useColor ? pc.gray("=") : "=";
  }
}

/**
 * Handle errors consistently
 */
function handleError(
  error: unknown,
  json: boolean | undefined,
  useColor: boolean
): never {
  const message =
    error instanceof Error ? error.message : "An unknown error occurred";

  if (json) {
    console.error(
      JSON.stringify({
        error: true,
        message,
      })
    );
  } else {
    console.error(
      useColor ? pc.red(`Error: ${message}`) : `Error: ${message}`
    );
  }

  process.exit(3);
}
