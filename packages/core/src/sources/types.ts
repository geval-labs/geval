import { z } from "zod";

/**
 * Supported aggregation methods for metrics
 */
export const AggregationMethodSchema = z.enum([
  "avg",       // Average of all values
  "sum",       // Sum of all values
  "min",       // Minimum value
  "max",       // Maximum value
  "count",     // Count of rows
  "p50",       // 50th percentile (median)
  "p90",       // 90th percentile
  "p95",       // 95th percentile
  "p99",       // 99th percentile
  "pass_rate", // Percentage where value is truthy or "success"/"pass"/true/1
  "fail_rate", // Percentage where value is falsy or "error"/"fail"/false/0
  "first",     // First value (for single-value extraction)
  "last",      // Last value
]);
export type AggregationMethod = z.infer<typeof AggregationMethodSchema>;

/**
 * Metric column definition
 */
export const MetricColumnSchema = z.object({
  /** Column name in the source file */
  column: z.string().min(1),
  /** How to aggregate values from this column */
  aggregate: AggregationMethodSchema.default("avg"),
  /** Optional: rename the metric in output */
  as: z.string().optional(),
  /** Optional: filter rows before aggregation */
  filter: z.object({
    column: z.string(),
    equals: z.union([z.string(), z.number(), z.boolean()]).optional(),
    notEquals: z.union([z.string(), z.number(), z.boolean()]).optional(),
  }).optional(),
});
export type MetricColumn = z.infer<typeof MetricColumnSchema>;

/**
 * Source file type
 */
export const SourceTypeSchema = z.enum(["csv", "json", "jsonl"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

/**
 * Eval source configuration
 * User defines how to extract metrics from their eval results
 */
export const EvalSourceConfigSchema = z.object({
  /** Source file type (auto-detected if not specified) */
  type: SourceTypeSchema.optional(),
  
  /** Metric columns to extract */
  metrics: z.array(
    z.union([
      z.string(), // Simple: just column name, defaults to avg
      MetricColumnSchema, // Full config
    ])
  ).min(1),
  
  /** Column or fixed value for eval name */
  evalName: z.union([
    z.string(), // Column name
    z.object({ fixed: z.string() }), // Fixed value
  ]).optional(),
  
  /** Column or fixed value for run ID */
  runId: z.union([
    z.string(), // Column name
    z.object({ fixed: z.string() }), // Fixed value
  ]).optional(),
  
  /** Column for timestamp */
  timestamp: z.string().optional(),
  
  /** Metadata columns to include */
  metadata: z.record(z.string()).optional(),
  
  /** CSV-specific options */
  csv: z.object({
    delimiter: z.string().default(","),
    quote: z.string().default('"'),
    hasHeader: z.boolean().default(true),
  }).optional(),
  
  /** JSON-specific options */
  json: z.object({
    /** Path to array of results (e.g., "results" or "data.items") */
    resultsPath: z.string().optional(),
  }).optional(),
});
export type EvalSourceConfig = z.infer<typeof EvalSourceConfigSchema>;

/**
 * Parsed row from source file
 */
export interface SourceRow {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Aggregated metrics result
 */
export interface AggregatedMetrics {
  evalName: string;
  runId: string;
  timestamp?: string;
  metrics: Record<string, number>;
  metadata?: Record<string, string | undefined>;
  /** Statistics about the source data */
  stats: {
    totalRows: number;
    validRows: number;
    skippedRows: number;
  };
}
