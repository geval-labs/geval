import { createHash } from "crypto";
import type { NormalizedEvalResult } from "../types/index.js";
import type { Signal } from "../signals/types.js";
import type { EvalContract } from "../types/index.js";

/**
 * Compute SHA256 hash of a string
 */
export function hashString(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Compute hash of eval results
 */
export function hashEvalResults(
  results: NormalizedEvalResult[]
): string {
  const content = JSON.stringify(results, null, 0);
  return hashString(content);
}

/**
 * Compute hash of signals
 */
export function hashSignals(signals: Signal[]): string {
  const content = JSON.stringify(signals, null, 0);
  return hashString(content);
}

/**
 * Compute hash of contract/policy
 */
export function hashContract(contract: EvalContract): string {
  const content = JSON.stringify(contract, null, 0);
  return hashString(content);
}

/**
 * Compute deterministic hash for decision inputs
 */
export function hashDecisionInputs(inputs: {
  evalResults?: NormalizedEvalResult[];
  signals?: Signal[];
  contract: EvalContract;
}): {
  eval_hash?: string;
  signals_hash?: string;
  policy_hash: string;
} {
  return {
    eval_hash: inputs.evalResults
      ? hashEvalResults(inputs.evalResults)
      : undefined,
    signals_hash: inputs.signals ? hashSignals(inputs.signals) : undefined,
    policy_hash: hashContract(inputs.contract),
  };
}
