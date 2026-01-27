import type { NormalizedEvalResult } from "../types/index.js";
import { parseCsv, isCsv } from "./csv-parser.js";
import { aggregate, extractColumnValues } from "./aggregator.js";
import type { SourceRow, MetricColumn, AggregationMethod, EvalSourceConfig } from "./types.js";

/**
 * Contract with sources - local interface to avoid circular deps
 * This is a subset of EvalContract that includes the sources field
 */
interface ContractWithSources {
  sources?: {
    csv?: EvalSourceConfig;
    json?: EvalSourceConfig;
    jsonl?: EvalSourceConfig;
  };
  [key: string]: unknown;
}

/**
 * Detect file type from extension or content
 */
export function detectFileType(
  filePath: string,
  content: string
): "csv" | "json" | "jsonl" {
  const ext = filePath.toLowerCase().split(".").pop();

  if (ext === "csv") return "csv";
  if (ext === "json") return "json";
  if (ext === "jsonl" || ext === "ndjson") return "jsonl";

  // Auto-detect from content
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    // Check if it's JSONL (multiple JSON objects per line)
    const firstLine = trimmed.split("\n")[0]?.trim() ?? "";
    const secondLine = trimmed.split("\n")[1]?.trim() ?? "";
    if (
      firstLine.startsWith("{") &&
      firstLine.endsWith("}") &&
      secondLine.startsWith("{")
    ) {
      return "jsonl";
    }
    return "json";
  }

  if (isCsv(content)) return "csv";

  // Default to JSON
  return "json";
}

/**
 * Parse an eval file using the source config from a contract
 *
 * @param content - File content (CSV, JSON, or JSONL)
 * @param filePath - File path (used for type detection)
 * @param contract - Contract with optional source config
 * @returns Normalized eval result
 */
export function parseEvalFile(
  content: string,
  filePath: string,
  contract: ContractWithSources
): NormalizedEvalResult {
  const fileType = detectFileType(filePath, content);
  const sourceConfig = contract.sources?.[fileType];

  // If no source config for this file type, try auto-detection
  if (!sourceConfig) {
    return parseWithAutoDetect(content, fileType);
  }

  return parseWithSourceConfig(content, fileType, sourceConfig);
}

/**
 * Parse file with explicit source config
 */
function parseWithSourceConfig(
  content: string,
  fileType: "csv" | "json" | "jsonl",
  config: EvalSourceConfig
): NormalizedEvalResult {
  const rows = parseToRows(content, fileType, config);
  return aggregateToResult(rows, config);
}

/**
 * Parse file with auto-detection (for JSON files without source config)
 */
function parseWithAutoDetect(
  content: string,
  fileType: "csv" | "json" | "jsonl"
): NormalizedEvalResult {
  if (fileType === "csv") {
    throw new Error(
      "CSV files require a source config in the contract. " +
        'Add a "sources.csv" section to define how to parse metrics.'
    );
  }

  // For JSON, try to parse as normalized eval result
  const data = JSON.parse(content);

  // Check if it's already in normalized format
  if (data.evalName && data.metrics) {
    return {
      evalName: data.evalName,
      runId: data.runId ?? `run-${Date.now()}`,
      timestamp: data.timestamp,
      metrics: data.metrics,
      metadata: data.metadata,
    };
  }

  // Try to detect common formats
  throw new Error(
    "Could not auto-detect eval format. " +
      'Add a "sources.json" section to the contract to define how to parse metrics.'
  );
}

/**
 * Parse content to rows based on file type
 */
function parseToRows(
  content: string,
  fileType: "csv" | "json" | "jsonl",
  config: EvalSourceConfig
): SourceRow[] {
  switch (fileType) {
    case "csv":
      return parseCsv(content, {
        delimiter: config.csv?.delimiter,
        hasHeader: config.csv?.hasHeader,
      }).rows;

    case "json":
      return parseJsonToRows(content, config.json?.resultsPath);

    case "jsonl":
      return parseJsonlToRows(content);

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Parse JSON content to rows
 */
function parseJsonToRows(content: string, resultsPath?: string): SourceRow[] {
  const data = JSON.parse(content);

  let results = data;
  if (resultsPath) {
    const paths = resultsPath.split(".");
    for (const path of paths) {
      results = results?.[path];
    }
  }

  if (Array.isArray(results)) {
    return results.map((item) => flattenObject(item));
  }

  if (typeof results === "object" && results !== null) {
    const arrayKeys = ["results", "data", "items", "rows", "examples"];
    for (const key of arrayKeys) {
      if (Array.isArray(results[key])) {
        return results[key].map((item: Record<string, unknown>) =>
          flattenObject(item)
        );
      }
    }
    return [flattenObject(results)];
  }

  return [];
}

/**
 * Parse JSONL content to rows
 */
function parseJsonlToRows(content: string): SourceRow[] {
  const lines = content.split("\n").filter((line) => line.trim());
  return lines.map((line) => flattenObject(JSON.parse(line)));
}

/**
 * Flatten nested object
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ""
): SourceRow {
  const result: SourceRow = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      result[newKey] = null;
    } else if (typeof value === "object" && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenObject(value as Record<string, unknown>, newKey)
      );
    } else if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value);
    } else {
      result[newKey] = value as string | number | boolean;
    }
  }

  return result;
}

/**
 * Aggregate rows to normalized eval result
 */
function aggregateToResult(
  rows: SourceRow[],
  config: EvalSourceConfig
): NormalizedEvalResult {
  const metrics: Record<string, number> = {};

  for (const metricDef of config.metrics) {
    const metricConfig = normalizeMetricConfig(metricDef);
    const values = extractColumnValues(rows, metricConfig.column);
    const aggregatedValue = aggregate(values, metricConfig.aggregate as AggregationMethod);
    const metricName = metricConfig.as ?? metricConfig.column;
    metrics[metricName] = aggregatedValue;
  }

  const evalName = extractEvalName(rows, config);
  const runId = extractRunId(rows, config);

  return {
    evalName,
    runId,
    metrics,
    timestamp: config.timestamp
      ? (rows[0]?.[config.timestamp] as string) ?? undefined
      : undefined,
  };
}

/**
 * Normalize metric config
 */
function normalizeMetricConfig(
  config: string | MetricColumn
): MetricColumn {
  if (typeof config === "string") {
    return { column: config, aggregate: "avg" };
  }
  return { ...config, aggregate: config.aggregate ?? "avg" };
}

/**
 * Extract eval name from config
 */
function extractEvalName(rows: SourceRow[], config: EvalSourceConfig): string {
  if (!config.evalName) return "eval";

  if (typeof config.evalName === "string") {
    // It's a column name
    const value = rows[0]?.[config.evalName];
    return value !== null && value !== undefined ? String(value) : "eval";
  }

  if ("fixed" in config.evalName) {
    return config.evalName.fixed;
  }

  return "eval";
}

/**
 * Extract run ID from config
 */
function extractRunId(rows: SourceRow[], config: EvalSourceConfig): string {
  if (!config.runId) return `run-${Date.now()}`;

  if (typeof config.runId === "string") {
    const value = rows[0]?.[config.runId];
    return value !== null && value !== undefined
      ? String(value)
      : `run-${Date.now()}`;
  }

  if ("fixed" in config.runId) {
    return config.runId.fixed;
  }

  return `run-${Date.now()}`;
}
