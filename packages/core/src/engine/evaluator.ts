import type {
  Decision,
  NormalizedEvalResult,
  BaselineData,
  Violation,
  ContractRule,
  MetricValue,
  EngineInput,
} from "../types/index.js";
import { evaluatePolicy } from "./policy-evaluator.js";

/**
 * Evaluate an eval contract against eval results and baselines.
 *
 * This is the core decision function of Geval. It is:
 * - Pure: Same inputs always produce same outputs
 * - Deterministic: No randomness, no network calls, no side effects
 * - Exhaustive: All rules are evaluated, all violations are reported
 *
 * @param input - Engine input containing contract, eval results, and baselines
 * @returns A Decision object (PASS, BLOCK, or REQUIRES_APPROVAL)
 */
export function evaluate(input: EngineInput): Decision {
  const { contract, evalResults, baselines, signals, environment } = input;
  
  // If contract has policy, use policy evaluator
  if (contract.policy) {
    return evaluatePolicy({
      contract,
      evalResults,
      signals: signals || [],
      environment: environment || contract.environment || "production",
    });
  }
  
  // Legacy eval-based contract
  if (!contract.requiredEvals || contract.requiredEvals.length === 0) {
    throw new Error("Contract must have either 'requiredEvals' or 'policy'");
  }
  
  const violations: Violation[] = [];
  const timestamp = new Date().toISOString();

  // Build a map of eval results by name for O(1) lookup
  const evalResultMap = new Map<string, NormalizedEvalResult>();
  for (const result of evalResults) {
    evalResultMap.set(result.evalName, result);
  }

  // Evaluate each required eval
  for (const requiredEval of contract.requiredEvals) {
    const evalResult = evalResultMap.get(requiredEval.name);

    // Missing required eval is a violation
    if (!evalResult) {
      violations.push({
        evalName: requiredEval.name,
        rule: {
          metric: "*",
          operator: "==",
          baseline: "fixed",
          description: "Required eval must be present",
        },
        actualValue: "missing",
        explanation: `Required eval "${requiredEval.name}" was not found in results`,
      });
      continue;
    }

    // Get baseline data for this eval (if available)
    const baseline = baselines[requiredEval.name];

    // Evaluate each rule
    for (const rule of requiredEval.rules) {
      const violation = evaluateRule(
        rule,
        requiredEval.name,
        evalResult,
        baseline
      );
      if (violation) {
        violations.push(violation);
      }
    }
  }

  // Determine final decision based on violations and contract settings
  if (violations.length === 0) {
    return {
      status: "PASS",
      evaluatedAt: timestamp,
      contractName: contract.name,
      contractVersion: contract.version,
      summary: `All ${contract.requiredEvals.length} eval(s) passed contract requirements`,
    };
  }

  // Map violation action to decision status
  const status = mapViolationAction(contract.onViolation?.action ?? "warn");

  return {
    status,
    evaluatedAt: timestamp,
    contractName: contract.name,
    contractVersion: contract.version,
    violations,
    summary: buildViolationSummary(violations, contract.onViolation?.action ?? "warn"),
  };
}

/**
 * Evaluate a single rule against eval results and baseline.
 * Returns a Violation if the rule is violated, undefined otherwise.
 */
function evaluateRule(
  rule: ContractRule,
  evalName: string,
  evalResult: NormalizedEvalResult,
  baseline: BaselineData | undefined
): Violation | undefined {
  const actualValue = evalResult.metrics[rule.metric];

  // Missing metric is a violation
  if (actualValue === undefined) {
    return {
      evalName,
      rule,
      actualValue: "missing",
      explanation: `Metric "${rule.metric}" was not found in eval results`,
    };
  }

  // Get baseline value
  const baselineValue = getBaselineValue(rule, baseline);

  // For fixed baseline, compare directly against threshold
  if (rule.baseline === "fixed") {
    if (rule.threshold === undefined) {
      return {
        evalName,
        rule,
        actualValue,
        explanation: `Rule has "fixed" baseline but no threshold specified`,
      };
    }

    if (!compareValues(actualValue, rule.operator, rule.threshold)) {
      return {
        evalName,
        rule,
        actualValue,
        baselineValue: rule.threshold,
        explanation: `${rule.metric} = ${actualValue}, expected ${rule.operator} ${rule.threshold}`,
      };
    }

    return undefined; // Rule passed
  }

  // For relative baselines (previous, main), compare with delta
  if (baselineValue === undefined) {
    // No baseline available - this might be first run
    // Depending on strictness, this could be a pass or warning
    // For now, we pass if no baseline exists (first run scenario)
    return undefined;
  }

  // Compute delta
  const delta = computeDelta(actualValue, baselineValue);

  if (delta === undefined) {
    // Non-numeric values - do direct comparison
    if (!compareValues(actualValue, rule.operator, baselineValue)) {
      return {
        evalName,
        rule,
        actualValue,
        baselineValue,
        explanation: `${rule.metric} = ${actualValue}, baseline was ${baselineValue}`,
      };
    }
    return undefined;
  }

  // Check if delta exceeds maxDelta
  if (rule.maxDelta !== undefined) {
    // For metrics where lower is better (like error rates)
    // A positive delta means regression
    if (delta > rule.maxDelta) {
      return {
        evalName,
        rule,
        actualValue,
        baselineValue,
        delta,
        explanation: `${rule.metric} regressed by ${formatDelta(delta)} (max allowed: ${rule.maxDelta})`,
      };
    }
  }

  // Apply the comparison operator
  if (!compareValues(actualValue, rule.operator, baselineValue)) {
    return {
      evalName,
      rule,
      actualValue,
      baselineValue,
      delta,
      explanation: `${rule.metric} = ${actualValue}, expected ${rule.operator} ${baselineValue}`,
    };
  }

  return undefined; // Rule passed
}

/**
 * Get baseline value for a rule
 */
function getBaselineValue(
  rule: ContractRule,
  baseline: BaselineData | undefined
): MetricValue | undefined {
  if (rule.baseline === "fixed") {
    return rule.threshold;
  }

  if (!baseline) {
    return undefined;
  }

  return baseline.metrics[rule.metric];
}

/**
 * Compare two values using the given operator
 */
export function compareValues(
  actual: MetricValue,
  operator: string,
  expected: MetricValue
): boolean {
  // Handle numeric comparisons
  if (typeof actual === "number" && typeof expected === "number") {
    switch (operator) {
      case "==":
        return actual === expected;
      case "!=":
        return actual !== expected;
      case "<":
        return actual < expected;
      case "<=":
        return actual <= expected;
      case ">":
        return actual > expected;
      case ">=":
        return actual >= expected;
      default:
        return false;
    }
  }

  // Handle boolean/string comparisons
  switch (operator) {
    case "==":
      return actual === expected;
    case "!=":
      return actual !== expected;
    default:
      // Relational operators don't make sense for non-numeric values
      return false;
  }
}

/**
 * Compute the delta between two values
 */
function computeDelta(
  actual: MetricValue,
  baseline: MetricValue
): number | undefined {
  if (typeof actual === "number" && typeof baseline === "number") {
    return actual - baseline;
  }
  return undefined;
}

/**
 * Format delta for display
 */
function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(4)}`;
}

/**
 * Map violation action to decision status
 */
function mapViolationAction(
  action: "block" | "require_approval" | "warn"
): "BLOCK" | "REQUIRES_APPROVAL" {
  switch (action) {
    case "block":
      return "BLOCK";
    case "require_approval":
    case "warn":
      return "REQUIRES_APPROVAL";
  }
}

/**
 * Build a human-readable violation summary
 */
function buildViolationSummary(
  violations: Violation[],
  action: "block" | "require_approval" | "warn"
): string {
  const actionText =
    action === "block"
      ? "Blocked"
      : action === "require_approval"
        ? "Requires approval"
        : "Warning";

  const uniqueEvals = new Set(violations.map((v) => v.evalName));
  const evalText =
    uniqueEvals.size === 1
      ? `1 eval`
      : `${uniqueEvals.size} evals`;

  return `${actionText}: ${violations.length} violation(s) in ${evalText}`;
}
