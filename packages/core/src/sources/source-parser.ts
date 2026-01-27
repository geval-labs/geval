import type {
  EvalSourceConfig,
  MetricColumn,
  SourceRow,
  AggregatedMetrics,
  SourceType,
} from "./types.js";
import { EvalSourceConfigSchema } from "./types.js";
import { parseCsv, isCsv } from "./csv-parser.js";
import { aggregate, extractColumnValues } from "./aggregator.js";
import type { NormalizedEvalResult } from "../types/index.js";

/**
 * Parse eval results from a source file using user-defined configuration
 * 
 * @example
 * ```typescript
 * const config = {
 *   metrics: [
 *     { column: "accuracy", aggregate: "avg" },
 *     { column: "latency", aggregate: "p95" },
 *     { column: "status", aggregate: "pass_rate" }
 *   ],
 *   evalName: { fixed: "my-eval" }
 * };
 * 
 * const result = parseEvalSource(csvContent, config);
 * // { evalName: "my-eval", runId: "...", metrics: { accuracy: 0.95, latency: 120, status: 0.98 } }
 * ```
 */
export function parseEvalSource(
  content: string,
  config: EvalSourceConfig
): NormalizedEvalResult {
  // Validate config
  const validatedConfig = EvalSourceConfigSchema.parse(config);

  // Detect source type
  const sourceType = validatedConfig.type ?? detectSourceType(content);

  // Parse content to rows
  const rows = parseToRows(content, sourceType, validatedConfig);

  // Aggregate metrics
  const aggregated = aggregateMetrics(rows, validatedConfig);

  // Convert to NormalizedEvalResult
  return {
    evalName: aggregated.evalName,
    runId: aggregated.runId,
    timestamp: aggregated.timestamp,
    metrics: aggregated.metrics,
    metadata: aggregated.metadata,
  };
}

/**
 * Detect source file type from content
 */
function detectSourceType(content: string): SourceType {
  const trimmed = content.trim();
  
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }
  
  if (isCsv(content)) {
    return "csv";
  }
  
  // Check for JSONL (multiple JSON objects, one per line)
  const firstLine = trimmed.split("\n")[0]?.trim() ?? "";
  if (firstLine.startsWith("{") && firstLine.endsWith("}")) {
    return "jsonl";
  }
  
  // Default to CSV
  return "csv";
}

/**
 * Parse content to rows based on source type
 */
function parseToRows(
  content: string,
  sourceType: SourceType,
  config: EvalSourceConfig
): SourceRow[] {
  switch (sourceType) {
    case "csv":
      return parseCsv(content, {
        delimiter: config.csv?.delimiter,
        quote: config.csv?.quote,
        hasHeader: config.csv?.hasHeader,
      }).rows;

    case "json":
      return parseJsonToRows(content, config.json?.resultsPath);

    case "jsonl":
      return parseJsonlToRows(content);

    default:
      throw new Error(`Unsupported source type: ${sourceType}`);
  }
}

/**
 * Parse JSON content to rows
 */
function parseJsonToRows(content: string, resultsPath?: string): SourceRow[] {
  const data = JSON.parse(content);

  // If resultsPath is specified, extract that path
  let results = data;
  if (resultsPath) {
    const paths = resultsPath.split(".");
    for (const path of paths) {
      results = results?.[path];
    }
  }

  // If it's an array, use it directly
  if (Array.isArray(results)) {
    return results.map((result) => flattenObject(result));
  }

  // If it's an object with array values, flatten them
  if (typeof results === "object" && results !== null) {
    // Look for common array keys
    const arrayKeys = ["results", "data", "items", "rows", "examples"];
    for (const key of arrayKeys) {
      if (Array.isArray(results[key])) {
        return results[key].map((item: Record<string, unknown>) => flattenObject(item));
      }
    }
    // Single object - wrap in array
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
 * Flatten nested object to single-level with dot notation keys
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
      // Recursively flatten nested objects
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else if (Array.isArray(value)) {
      // Store arrays as JSON string for now
      result[newKey] = JSON.stringify(value);
    } else {
      result[newKey] = value as string | number | boolean;
    }
  }

  return result;
}

/**
 * Aggregate metrics from rows based on config
 */
function aggregateMetrics(
  rows: SourceRow[],
  config: EvalSourceConfig
): AggregatedMetrics {
  const metrics: Record<string, number> = {};
  let validRows = 0;
  let skippedRows = 0;

  // Process each metric definition
  for (const metricDef of config.metrics) {
    const metricConfig = normalizeMetricConfig(metricDef);
    
    const values = extractColumnValues(
      rows,
      metricConfig.column,
      metricConfig.filter
    );

    const validValues = values.filter(
      (v) => v !== null && v !== undefined && v !== ""
    );
    
    if (validValues.length > 0) {
      const aggregatedValue = aggregate(values, metricConfig.aggregate);
      const metricName = metricConfig.as ?? metricConfig.column;
      metrics[metricName] = aggregatedValue;
      validRows = Math.max(validRows, validValues.length);
    } else {
      skippedRows++;
    }
  }

  // Extract eval name
  const evalName = extractStringValue(rows, config.evalName, "eval");

  // Extract run ID
  const runId = extractStringValue(rows, config.runId, `run-${Date.now()}`);

  // Extract timestamp
  const timestamp = config.timestamp
    ? (rows[0]?.[config.timestamp] as string) ?? undefined
    : undefined;

  // Extract metadata
  const metadata: Record<string, string | undefined> = {};
  if (config.metadata) {
    for (const [key, column] of Object.entries(config.metadata)) {
      const value = rows[0]?.[column];
      metadata[key] = value !== null && value !== undefined 
        ? String(value) 
        : undefined;
    }
  }

  return {
    evalName,
    runId,
    timestamp,
    metrics,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    stats: {
      totalRows: rows.length,
      validRows,
      skippedRows,
    },
  };
}

/**
 * Normalize metric config (string -> full config)
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
 * Extract a string value from rows based on config
 */
function extractStringValue(
  rows: SourceRow[],
  config: string | { fixed: string } | undefined,
  fallback: string
): string {
  if (!config) return fallback;
  
  if (typeof config === "object" && "fixed" in config) {
    return config.fixed;
  }
  
  // It's a column name
  const value = rows[0]?.[config];
  return value !== null && value !== undefined ? String(value) : fallback;
}

/**
 * Validate that required columns exist in the source
 */
export function validateSourceColumns(
  headers: string[],
  config: EvalSourceConfig
): { valid: boolean; missingColumns: string[] } {
  const requiredColumns: string[] = [];

  for (const metric of config.metrics) {
    const col = typeof metric === "string" ? metric : metric.column;
    requiredColumns.push(col);
    
    if (typeof metric === "object" && metric.filter) {
      requiredColumns.push(metric.filter.column);
    }
  }

  if (typeof config.evalName === "string") {
    requiredColumns.push(config.evalName);
  }
  if (typeof config.runId === "string") {
    requiredColumns.push(config.runId);
  }
  if (config.timestamp) {
    requiredColumns.push(config.timestamp);
  }
  if (config.metadata) {
    requiredColumns.push(...Object.values(config.metadata));
  }

  const missingColumns = requiredColumns.filter(
    (col) => !headers.includes(col)
  );

  return {
    valid: missingColumns.length === 0,
    missingColumns,
  };
}
