import type { Decision } from "../types/index.js";
import type { DecisionRecord } from "./types.js";
import { hashDecisionInputs } from "./hashing.js";
import type { NormalizedEvalResult } from "../types/index.js";
import type { Signal } from "../signals/types.js";
import type { EvalContract } from "../types/index.js";

/**
 * Create a decision record from evaluation results
 */
export function createDecisionRecord(input: {
  decision: Decision;
  environment: string;
  commit?: string;
  evalResults?: NormalizedEvalResult[];
  signals?: Signal[];
  contract: EvalContract;
  evidence?: string[];
}): DecisionRecord {
  const inputs = hashDecisionInputs({
    evalResults: input.evalResults,
    signals: input.signals,
    contract: input.contract,
  });

  // Extract reason from decision summary or violations
  let reason: string | undefined;
  if (input.decision.status !== "PASS") {
    reason = input.decision.summary;
  }

  return {
    commit: input.commit,
    environment: input.environment,
    decision: input.decision.status,
    reason,
    inputs,
    evidence: input.evidence,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format decision record as JSON string
 */
export function formatDecisionRecord(record: DecisionRecord): string {
  return JSON.stringify(record, null, 2);
}
