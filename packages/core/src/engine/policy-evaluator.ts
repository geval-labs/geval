import type {
  Decision,
  DecisionStatus,
  NormalizedEvalResult,
  BaselineData,
  MetricValue,
} from "../types/index.js";
import type { Signal } from "../signals/types.js";
import type {
  PolicyRule,
  PolicyCondition,
  PolicyAction,
  EnvironmentPolicy,
} from "../contracts/policy.js";
import { compareValues } from "./evaluator.js";

/**
 * Evaluate a policy-based contract
 */
export function evaluatePolicy(input: {
  contract: {
    name?: string;
    policy?: {
      environments?: Record<string, EnvironmentPolicy>;
      rules?: PolicyRule[];
    };
    environment?: string;
  };
  evalResults: NormalizedEvalResult[];
  signals: Signal[];
  environment: string;
  baselines: Record<string, BaselineData>;
}): Decision {
  const { contract, evalResults, signals, environment, baselines } = input;
  const timestamp = new Date().toISOString();

  // Get environment-specific policy or use global
  const envPolicy = contract.policy?.environments?.[environment];
  const globalRules = contract.policy?.rules || [];
  const envRules = envPolicy?.rules || [];
  const allRules = [...globalRules, ...envRules];

  // Evaluate all rules
  let finalAction: PolicyAction | null = null;
  let finalReason: string | undefined;

  for (const rule of allRules) {
    if (evaluateCondition(rule.when, evalResults, signals, baselines)) {
      finalAction = rule.then.action;
      finalReason = rule.then.reason;
      break; // First matching rule wins
    }
  }

  // If no rule matched, use default
  if (!finalAction) {
    // Check if there's an environment-specific default
    if (envPolicy?.default) {
      finalAction = envPolicy.default;
    } else {
      // No default specified, default to pass
      finalAction = "pass";
    }
  }

  // Convert policy action to decision status
  const status = mapPolicyActionToDecisionStatus(finalAction);

  return {
    status,
    violations: [],
    evaluatedAt: timestamp,
    contractName: contract.name || "unknown",
    contractVersion: 1,
    summary: finalReason || `Policy evaluation: ${finalAction}`,
  };
}

/**
 * Evaluate a policy condition
 */
function evaluateCondition(
  condition: PolicyCondition,
  evalResults: NormalizedEvalResult[],
  signals: Signal[],
  baselines: Record<string, BaselineData>
): boolean {
  if ("eval" in condition) {
    return evaluateEvalCondition(condition.eval, evalResults, baselines);
  }

  if ("signal" in condition) {
    return evaluateSignalCondition(condition.signal, signals);
  }

  return false;
}

/**
 * Evaluate an eval-based condition
 */
function evaluateEvalCondition(
  condition: {
    metric: string;
    operator: string;
    baseline: string;
    threshold?: number;
    maxDelta?: number;
  },
  evalResults: NormalizedEvalResult[],
  baselines: Record<string, BaselineData>
): boolean {
  // Find the metric in eval results
  for (const result of evalResults) {
    const metricValue = result.metrics[condition.metric];
    if (metricValue === undefined) {
      continue;
    }

    // here handle fixed baseline absolute threshold
    if (condition.baseline === "fixed") {
      if (condition.threshold === undefined) {
        return false;
      }
      // Return true if condition is met (metric passes the check)
      return compareValues(metricValue, condition.operator, condition.threshold);
    }

    // handle relative baselines previous/main
    const baseline = baselines[result.evalName];

    if (!baseline) {
      return true;
    }

    const baselineValue = baseline.metrics[condition.metric];

    if (baselineValue === undefined) {
      return true;
    }

    // compute delta if numeric
    const delta = computeDelta(metricValue, baselineValue);

    if (condition.maxDelta !== undefined && delta !== undefined) {
      if (Math.abs(delta) <= condition.maxDelta) {
        return true;
      }

      return compareValues(metricValue, condition.operator, baselineValue);
    }

    return compareValues(metricValue, condition.operator, baselineValue);
  }

  // Metric not found in any eval result
  return false;
}

// compute the delta 
function computeDelta(actual: MetricValue, baseline: MetricValue): number | undefined {
  if (typeof actual === "number" && typeof baseline === "number") {
    return actual - baseline;
  }
  return undefined;
}

// evaluate a signal-based condition
function evaluateSignalCondition(
  condition: {
    type?: string;
    name?: string;
    field?: string;
    operator?: string;
    value?: unknown;
  },
  signals: Signal[]
): boolean {
  // Filter signals by type if specified
  let filtered = signals;
  if (condition.type) {
    filtered = filtered.filter((s) => s.type === condition.type);
  }

  // Filter by name if specified
  if (condition.name) {
    filtered = filtered.filter((s) => s.name === condition.name);
  }

  if (filtered.length === 0) {
    return false;
  }

  // If no operator/value specified, just check presence
  if (!condition.operator || condition.value === undefined) {
    return filtered.length > 0;
  }

  // Evaluate operator-based condition
  for (const signal of filtered) {
    let signalValue: unknown = signal.value;

    // If field is specified, try to extract from value or metadata
    if (condition.field) {
      if (
        typeof signal.value === "object" &&
        signal.value !== null &&
        condition.field in signal.value
      ) {
        signalValue = (signal.value as Record<string, unknown>)[condition.field];
      } else if (signal.metadata?.[condition.field]) {
        signalValue = signal.metadata[condition.field];
      } else {
        continue; // Field not found in this signal, try next
      }
    }

    // If operator and value are specified, compare
    if (condition.operator && condition.value !== undefined) {
      // Convert both to comparable types if needed
      let actualValue: string | number | boolean = signalValue as
        | string
        | number
        | boolean;
      let expectedValue: string | number | boolean = condition.value as
        | string
        | number
        | boolean;

      // If both are strings, compare as strings
      // If one is string and other is not, try to convert
      if (typeof signalValue === "string" && typeof condition.value === "string") {
        actualValue = signalValue;
        expectedValue = condition.value;
      } else if (typeof signalValue === "string") {
        // Try to convert expected to string
        expectedValue = String(condition.value);
      } else if (typeof condition.value === "string") {
        // Try to convert actual to string
        actualValue = String(signalValue);
      }

      if (compareValues(actualValue, condition.operator, expectedValue)) {
        return true;
      }
    } else {
      // No operator/value specified, just check presence
      return true;
    }
  }

  return false;
}

/**
 * Map policy action to decision status
 */
function mapPolicyActionToDecisionStatus(action: PolicyAction): DecisionStatus {
  switch (action) {
    case "pass":
      return "PASS";
    case "block":
      return "BLOCK";
    case "require_approval":
      return "REQUIRES_APPROVAL";
  }
}
