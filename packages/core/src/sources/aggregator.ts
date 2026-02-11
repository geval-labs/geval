import type { AggregationMethod, SourceRow } from "./types.js";

/**
 * Aggregate values using the specified method
 */
export function aggregate(
  values: (string | number | boolean | null | undefined)[],
  method: AggregationMethod
): number {
  // Filter to numeric values for most aggregations
  const numericValues = values
    .map(toNumber)
    .filter((v): v is number => v !== null && !isNaN(v));

  switch (method) {
    case "avg":
      return numericValues.length > 0
        ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length
        : 0;

    case "sum":
      return numericValues.reduce((a, b) => a + b, 0);

    case "min":
      return numericValues.length > 0 ? Math.min(...numericValues) : 0;

    case "max":
      return numericValues.length > 0 ? Math.max(...numericValues) : 0;

    case "count":
      return values.filter((v) => v !== null && v !== undefined).length;

    case "p50":
      return percentile(numericValues, 50);

    case "p90":
      return percentile(numericValues, 90);

    case "p95":
      return percentile(numericValues, 95);

    case "p99":
      return percentile(numericValues, 99);

    case "pass_rate":
      return passRate(values);

    case "fail_rate":
      return 1 - passRate(values);

    case "first":
      return numericValues[0] ?? 0;

    case "last":
      return numericValues[numericValues.length - 1] ?? 0;

    default:
      return 0;
  }
}

/**
 * Calculate percentile
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

/**
 * Calculate pass rate
 * - Numeric: > 0 is pass
 * - Boolean: true is pass
 * - String: "success", "pass", "passed", "true", "1" are pass
 */
function passRate(values: (string | number | boolean | null | undefined)[]): number {
  const validValues = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (validValues.length === 0) return 0;

  const passCount = validValues.filter(isPass).length;
  return passCount / validValues.length;
}

/**
 * Check if a value represents "pass"
 */
function isPass(value: string | number | boolean | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    return ["success", "pass", "passed", "true", "1", "yes", "ok"].includes(lower);
  }
  return false;
}

/**
 * Convert value to number
 */
function toNumber(value: string | number | boolean | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Extract column values from rows with optional filtering
 */
export function extractColumnValues(
  rows: SourceRow[],
  column: string,
  filter?: {
    column: string;
    equals?: string | number | boolean;
    notEquals?: string | number | boolean;
  }
): (string | number | boolean | null | undefined)[] {
  let filteredRows = rows;

  if (filter) {
    filteredRows = rows.filter((row) => {
      const filterValue = row[filter.column];
      if (filter.equals !== undefined) {
        return filterValue === filter.equals;
      }
      if (filter.notEquals !== undefined) {
        return filterValue !== filter.notEquals;
      }
      return true;
    });
  }

  return filteredRows.map((row) => row[column]);
}
