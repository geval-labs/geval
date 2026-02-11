import type { SourceRow } from "./types.js";

/**
 * CSV Parser options
 */
export interface CsvParserOptions {
  delimiter?: string;
  quote?: string;
  hasHeader?: boolean;
}

/**
 * Parse CSV content into rows
 * Handles quoted fields, embedded quotes, and newlines within quotes
 */
export function parseCsv(
  content: string,
  options: CsvParserOptions = {}
): { headers: string[]; rows: SourceRow[] } {
  const { delimiter = ",", quote = '"', hasHeader = true } = options;

  const lines = splitCsvLines(content, quote);
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse header row
  const headerLine = hasHeader ? lines[0] : null;
  const headers = headerLine ? parseCsvLine(headerLine, delimiter, quote) : [];

  // Generate numeric headers if no header row
  if (!hasHeader && lines.length > 0) {
    const firstRow = parseCsvLine(lines[0]!, delimiter, quote);
    for (let i = 0; i < firstRow.length; i++) {
      headers.push(`col_${i}`);
    }
  }

  // Parse data rows
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: SourceRow[] = [];

  for (const line of dataLines) {
    if (line.trim() === "") continue;

    const values = parseCsvLine(line, delimiter, quote);
    const row: SourceRow = {};

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]!;
      const rawValue = values[i] ?? "";
      row[header] = parseValue(rawValue);
    }

    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Split CSV content into lines, respecting quoted fields
 */
function splitCsvLines(content: string, quote: string): string[] {
  const lines: string[] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i]!;
    const nextChar = content[i + 1];

    if (char === quote) {
      if (inQuotes && nextChar === quote) {
        // Escaped quote
        currentLine += char;
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
      currentLine += char;
    } else if ((char === "\n" || (char === "\r" && nextChar === "\n")) && !inQuotes) {
      lines.push(currentLine);
      currentLine = "";
      if (char === "\r") i++; // Skip \n in \r\n
    } else if (char === "\r" && !inQuotes) {
      lines.push(currentLine);
      currentLine = "";
    } else {
      currentLine += char;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Parse a single CSV line into values
 */
function parseCsvLine(line: string, delimiter: string, quote: string): string[] {
  const values: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    const nextChar = line[i + 1];

    if (char === quote) {
      if (!inQuotes) {
        inQuotes = true;
      } else if (nextChar === quote) {
        // Escaped quote
        currentValue += quote;
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(currentValue);
      currentValue = "";
    } else {
      currentValue += char;
    }
  }

  values.push(currentValue);
  return values;
}

/**
 * Parse a string value to appropriate type
 */
function parseValue(value: string): string | number | boolean | null {
  const trimmed = value.trim();

  // Empty or null
  if (trimmed === "" || trimmed.toLowerCase() === "null") {
    return null;
  }

  // Boolean
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;

  // Number
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== "") {
    return num;
  }

  // Try to parse as JSON (for embedded JSON in cells)
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not valid JSON, return as string
    }
  }

  return trimmed;
}

/**
 * Auto-detect if content is CSV
 */
export function isCsv(content: string): boolean {
  const firstLine = content.split(/\r?\n/)[0] ?? "";
  // CSV likely has commas and no JSON brackets
  return (
    firstLine.includes(",") &&
    !firstLine.trim().startsWith("{") &&
    !firstLine.trim().startsWith("[")
  );
}
