// Types
export type {
  AggregationMethod,
  MetricColumn,
  SourceType,
  EvalSourceConfig,
  SourceRow,
  AggregatedMetrics,
} from "./types.js";

export {
  AggregationMethodSchema,
  MetricColumnSchema,
  SourceTypeSchema,
  EvalSourceConfigSchema,
} from "./types.js";

// CSV Parser
export { parseCsv, isCsv, type CsvParserOptions } from "./csv-parser.js";

// Aggregator
export { aggregate, extractColumnValues } from "./aggregator.js";

// Main source parser (standalone usage)
export { parseEvalSource, validateSourceColumns } from "./source-parser.js";

// File parser (uses contract source config)
export { parseEvalFile, detectFileType } from "./file-parser.js";
