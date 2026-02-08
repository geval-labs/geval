import type { EvalContract, ContractDiff } from "../types/index.js";

/**
 * Result of comparing two contracts
 */
export interface ContractDiffResult {
  /** Whether the contracts are identical */
  identical: boolean;
  /** List of differences */
  diffs: ContractDiff[];
  /** Human-readable summary */
  summary: string;
}

/**
 * Compare two eval contracts and return the differences.
 * Useful for reviewing contract changes in PRs.
 *
 * @param previous - The previous/baseline contract
 * @param current - The current/new contract
 * @returns Diff result
 */
export function diffContracts(
  previous: EvalContract,
  current: EvalContract
): ContractDiffResult {
  const diffs: ContractDiff[] = [];

  // Compare top-level fields
  if (previous.name !== current.name) {
    diffs.push({
      field: "name",
      previous: previous.name,
      current: current.name,
    });
  }

  if (previous.environment !== current.environment) {
    diffs.push({
      field: "environment",
      previous: previous.environment,
      current: current.environment,
    });
  }

  if (previous.description !== current.description) {
    diffs.push({
      field: "description",
      previous: previous.description,
      current: current.description,
    });
  }

  // Compare violation handler
  if (previous.onViolation?.action !== current.onViolation?.action) {
    diffs.push({
      field: "onViolation.action",
      previous: previous.onViolation?.action,
      current: current.onViolation?.action,
    });
  }

  // Compare required evals
  const prevEvalNames = new Set(previous.requiredEvals?.map((e) => e.name) ?? []);
  const currEvalNames = new Set(current.requiredEvals?.map((e) => e.name) ?? []);

  // Find added evals
  for (const name of currEvalNames) {
    if (!prevEvalNames.has(name)) {
      diffs.push({
        field: `requiredEvals.${name}`,
        previous: undefined,
        current: "added",
      });
    }
  }

  // Find removed evals
  for (const name of prevEvalNames) {
    if (!currEvalNames.has(name)) {
      diffs.push({
        field: `requiredEvals.${name}`,
        previous: "present",
        current: undefined,
      });
    }
  }

  // Compare common evals
  for (const currEval of current.requiredEvals ?? []) {
    const prevEval = previous.requiredEvals?.find((e) => e.name === currEval.name);
    if (!prevEval) continue;

    // Compare rules
    const prevRuleKeys = new Set(prevEval.rules.map((r) => r.metric));
    const currRuleKeys = new Set(currEval.rules.map((r) => r.metric));

    for (const metric of currRuleKeys) {
      if (!prevRuleKeys.has(metric)) {
        diffs.push({
          field: `requiredEvals.${currEval.name}.rules.${metric}`,
          previous: undefined,
          current: "added",
        });
      }
    }

    for (const metric of prevRuleKeys) {
      if (!currRuleKeys.has(metric)) {
        diffs.push({
          field: `requiredEvals.${currEval.name}.rules.${metric}`,
          previous: "present",
          current: undefined,
        });
      }
    }

    // Compare common rules
    for (const currRule of currEval.rules) {
      const prevRule = prevEval.rules.find((r) => r.metric === currRule.metric);
      if (!prevRule) continue;

      if (prevRule.operator !== currRule.operator) {
        diffs.push({
          field: `requiredEvals.${currEval.name}.rules.${currRule.metric}.operator`,
          previous: prevRule.operator,
          current: currRule.operator,
        });
      }

      if (prevRule.maxDelta !== currRule.maxDelta) {
        diffs.push({
          field: `requiredEvals.${currEval.name}.rules.${currRule.metric}.maxDelta`,
          previous: prevRule.maxDelta,
          current: currRule.maxDelta,
        });
      }

      if (prevRule.threshold !== currRule.threshold) {
        diffs.push({
          field: `requiredEvals.${currEval.name}.rules.${currRule.metric}.threshold`,
          previous: prevRule.threshold,
          current: currRule.threshold,
        });
      }

      if (prevRule.baseline !== currRule.baseline) {
        diffs.push({
          field: `requiredEvals.${currEval.name}.rules.${currRule.metric}.baseline`,
          previous: prevRule.baseline,
          current: currRule.baseline,
        });
      }
    }
  }

  // Generate summary
  const summary = generateDiffSummary(diffs);

  return {
    identical: diffs.length === 0,
    diffs,
    summary,
  };
}

/**
 * Generate a human-readable summary of the differences
 */
function generateDiffSummary(diffs: ContractDiff[]): string {
  if (diffs.length === 0) {
    return "No changes detected";
  }

  const lines: string[] = [`${diffs.length} change(s) detected:`];

  for (const diff of diffs) {
    if (diff.previous === undefined) {
      lines.push(`  + Added: ${diff.field}`);
    } else if (diff.current === undefined) {
      lines.push(`  - Removed: ${diff.field}`);
    } else {
      lines.push(`  ~ Changed: ${diff.field} (${diff.previous} → ${diff.current})`);
    }
  }

  return lines.join("\n");
}
