import type { EvalContract, ContractRule } from "../types/index.js";

/**
 * Validation issue details
 */
export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

/**
 * Error thrown when contract validation fails
 */
export class ContractValidationError extends Error {
  public readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = "ContractValidationError";
    this.issues = issues;
  }

  /**
   * Format the error for display
   */
  format(): string {
    const lines = [this.message, ""];
    for (const issue of this.issues) {
      const path = issue.path ? `at "${issue.path}"` : "";
      lines.push(`  • ${issue.message} ${path}`.trim());
    }
    return lines.join("\n");
  }
}

/**
 * Semantic validation result
 */
export interface ValidationResult {
  valid: boolean;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
}

/**
 * Validate an eval contract for semantic correctness.
 * This goes beyond schema validation to check business rules.
 *
 * @param contract - The contract to validate
 * @returns Validation result with warnings and errors
 */
export function validateContract(contract: EvalContract): ValidationResult {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];

  // Check for duplicate eval names
  const evalNames = new Set<string>();
  for (const reqEval of contract.requiredEvals) {
    if (evalNames.has(reqEval.name)) {
      errors.push({
        path: `requiredEvals.${reqEval.name}`,
        message: `Duplicate eval name: "${reqEval.name}"`,
        code: "duplicate_eval_name",
      });
    }
    evalNames.add(reqEval.name);

    // Validate rules within each eval
    for (let i = 0; i < reqEval.rules.length; i++) {
      const rule = reqEval.rules[i]!;
      const rulePath = `requiredEvals.${reqEval.name}.rules[${i}]`;

      // Validate rule consistency
      const ruleIssues = validateRule(rule, rulePath);
      errors.push(...ruleIssues.errors);
      warnings.push(...ruleIssues.warnings);
    }
  }

  // Check for missing metadata in production
  if (contract.environment === "production" && !contract.description) {
    warnings.push({
      path: "description",
      message: "Production contracts should have a description",
      code: "missing_description",
    });
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Validate a single rule for consistency
 */
function validateRule(
  rule: ContractRule,
  path: string
): { warnings: ValidationIssue[]; errors: ValidationIssue[] } {
  const warnings: ValidationIssue[] = [];
  const errors: ValidationIssue[] = [];

  // If baseline is 'fixed', threshold must be provided
  if (rule.baseline === "fixed" && rule.threshold === undefined) {
    errors.push({
      path: `${path}.threshold`,
      message: 'Rules with baseline "fixed" must specify a threshold',
      code: "missing_threshold",
    });
  }

  // If baseline is 'previous' or 'main', maxDelta should be provided for meaningful comparison
  if (
    (rule.baseline === "previous" || rule.baseline === "main") &&
    rule.maxDelta === undefined &&
    !["==", "!="].includes(rule.operator)
  ) {
    warnings.push({
      path: `${path}.maxDelta`,
      message: `Consider specifying maxDelta for "${rule.baseline}" baseline comparisons`,
      code: "missing_max_delta",
    });
  }

  // Warn about very strict thresholds
  if (rule.maxDelta !== undefined && rule.maxDelta === 0) {
    warnings.push({
      path: `${path}.maxDelta`,
      message: "maxDelta of 0 allows no regression - this is very strict",
      code: "zero_tolerance",
    });
  }

  return { warnings, errors };
}
