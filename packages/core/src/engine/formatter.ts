import type { Decision, Violation } from "../types/index.js";

/**
 * Format options
 */
export interface FormatOptions {
  /** Use colors in output (for terminal) */
  colors?: boolean;
  /** Include timestamps */
  timestamps?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * ANSI color codes
 */
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

/**
 * Format a decision for human-readable output.
 *
 * @param decision - The decision to format
 * @param options - Formatting options
 * @returns Formatted string
 */
export function formatDecision(decision: Decision, options: FormatOptions = {}): string {
  const { colors: useColors = true, timestamps = false, verbose = false } = options;
  const lines: string[] = [];

  // Status header
  const statusIcon = getStatusIcon(decision.status, useColors);
  const statusText = getStatusText(decision.status, useColors);
  lines.push(`${statusIcon} ${statusText}`);
  lines.push("");

  // Contract info
  lines.push(formatLabel("Contract", useColors) + decision.contractName);
  lines.push(formatLabel("Version", useColors) + decision.contractVersion.toString());

  if (timestamps) {
    lines.push(formatLabel("Evaluated", useColors) + decision.evaluatedAt);
  }

  lines.push("");
  lines.push(decision.summary);

  // Violations (if any)
  if (decision.status !== "PASS" && "violations" in decision) {
    lines.push("");
    lines.push(formatSectionHeader("Violations", useColors));
    lines.push("");

    for (let i = 0; i < decision.violations.length; i++) {
      const violation = decision.violations[i]!;
      const formattedViolation = formatViolation(violation, {
        ...options,
        index: i + 1,
      });
      lines.push(formattedViolation);
      lines.push("");
    }

    if (verbose) {
      lines.push(formatSectionHeader("Next Steps", useColors));
      lines.push("");
      if (decision.status === "BLOCK") {
        lines.push("  1. Review the violations above");
        lines.push("  2. Fix the issues in your code");
        lines.push("  3. Re-run evaluations");
        lines.push("  4. Commit and push changes");
      } else {
        lines.push("  1. Review the violations above");
        lines.push("  2. Request approval if the changes are intentional");
        lines.push("  3. Or fix the issues and re-run evaluations");
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format a single violation for display.
 *
 * @param violation - The violation to format
 * @param options - Formatting options with optional index
 * @returns Formatted string
 */
export function formatViolation(
  violation: Violation,
  options: FormatOptions & { index?: number } = {}
): string {
  const { colors: useColors = true, index } = options;
  const lines: string[] = [];

  const prefix = index !== undefined ? `  ${index}. ` : "  ";
  const indent = " ".repeat(prefix.length);

  // Eval and metric
  const evalName = useColors
    ? `${colors.bold}${violation.evalName}${colors.reset}`
    : violation.evalName;
  const metric = useColors
    ? `${colors.blue}${violation.rule.metric}${colors.reset}`
    : violation.rule.metric;

  lines.push(`${prefix}${evalName} → ${metric}`);

  // Explanation
  const explanation = useColors
    ? `${colors.yellow}${violation.explanation}${colors.reset}`
    : violation.explanation;
  lines.push(`${indent}${explanation}`);

  // Values
  if (violation.baselineValue !== undefined) {
    lines.push(
      `${indent}Actual: ${violation.actualValue} | Baseline: ${violation.baselineValue}`
    );
  }

  if (violation.delta !== undefined) {
    const deltaStr =
      violation.delta > 0 ? `+${violation.delta}` : violation.delta.toString();
    lines.push(`${indent}Delta: ${deltaStr}`);
  }

  return lines.join("\n");
}

/**
 * Get status icon
 */
function getStatusIcon(status: string, useColors: boolean): string {
  switch (status) {
    case "PASS":
      return useColors ? `${colors.green}✓${colors.reset}` : "✓";
    case "BLOCK":
      return useColors ? `${colors.red}✗${colors.reset}` : "✗";
    case "REQUIRES_APPROVAL":
      return useColors ? `${colors.yellow}⚠${colors.reset}` : "⚠";
    default:
      return "?";
  }
}

/**
 * Get status text with color
 */
function getStatusText(status: string, useColors: boolean): string {
  switch (status) {
    case "PASS":
      return useColors ? `${colors.green}${colors.bold}PASS${colors.reset}` : "PASS";
    case "BLOCK":
      return useColors ? `${colors.red}${colors.bold}BLOCK${colors.reset}` : "BLOCK";
    case "REQUIRES_APPROVAL":
      return useColors
        ? `${colors.yellow}${colors.bold}REQUIRES APPROVAL${colors.reset}`
        : "REQUIRES APPROVAL";
    default:
      return status;
  }
}

/**
 * Format a label
 */
function formatLabel(label: string, useColors: boolean): string {
  const formatted = useColors ? `${colors.gray}${label}:${colors.reset} ` : `${label}: `;
  return formatted.padEnd(useColors ? 22 : 12);
}

/**
 * Format a section header
 */
function formatSectionHeader(title: string, useColors: boolean): string {
  return useColors ? `${colors.bold}${title}${colors.reset}` : `--- ${title} ---`;
}
