import { describe, it, expect } from "vitest";
import {
  hashEvalResults,
  hashSignals,
  hashContract,
  hashDecisionInputs,
  createDecisionRecord,
} from "../decisions/index.js";
import type { NormalizedEvalResult, Decision } from "../types/index.js";
import type { Signal } from "../signals/types.js";
import type { EvalContract } from "../types/index.js";

describe("Decision Records", () => {
  describe("hashing", () => {
    it("produces deterministic hashes for eval results", () => {
      const results: NormalizedEvalResult[] = [
        {
          evalName: "test",
          runId: "run-1",
          metrics: { accuracy: 0.95 },
        },
      ];

      const hash1 = hashEvalResults(results);
      const hash2 = hashEvalResults(results);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it("produces different hashes for different inputs", () => {
      const results1: NormalizedEvalResult[] = [
        {
          evalName: "test",
          runId: "run-1",
          metrics: { accuracy: 0.95 },
        },
      ];

      const results2: NormalizedEvalResult[] = [
        {
          evalName: "test",
          runId: "run-1",
          metrics: { accuracy: 0.96 },
        },
      ];

      const hash1 = hashEvalResults(results1);
      const hash2 = hashEvalResults(results2);
      expect(hash1).not.toBe(hash2);
    });

    it("hashes signals", () => {
      const signals: Signal[] = [
        {
          id: "sig-1",
          type: "eval",
          name: "test",
          value: 1,
        },
      ];

      const hash = hashSignals(signals);
      expect(hash).toHaveLength(64);
    });

    it("hashes contracts", () => {
      const contract: EvalContract = {
        version: 1,
        name: "test-contract",
        requiredEvals: [
          {
            name: "test",
            rules: [
              {
                metric: "accuracy",
                operator: ">=",
                baseline: "fixed",
                threshold: 0.90,
              },
            ],
          },
        ],
        onViolation: {
          action: "block",
        },
      };

      const hash = hashContract(contract);
      expect(hash).toHaveLength(64);
    });

    it("hashes decision inputs", () => {
      const contract: EvalContract = {
        version: 1,
        name: "test",
        requiredEvals: [
          {
            name: "test",
            rules: [
              {
                metric: "accuracy",
                operator: ">=",
                baseline: "fixed",
                threshold: 0.90,
              },
            ],
          },
        ],
        onViolation: { action: "block" },
      };

      const inputs = hashDecisionInputs({
        contract,
        evalResults: [
          {
            evalName: "test",
            runId: "run-1",
            metrics: { accuracy: 0.95 },
          },
        ],
        signals: [
          {
            id: "sig-1",
            type: "eval",
            name: "test",
            value: 1,
          },
        ],
      });

      expect(inputs.policy_hash).toBeDefined();
      expect(inputs.eval_hash).toBeDefined();
      expect(inputs.signals_hash).toBeDefined();
    });
  });

  describe("createDecisionRecord", () => {
    it("creates a decision record", () => {
      const decision: Decision = {
        status: "PASS",
        evaluatedAt: new Date().toISOString(),
        contractName: "test-contract",
        contractVersion: 1,
        summary: "All checks passed",
      };

      const contract: EvalContract = {
        version: 1,
        name: "test-contract",
        requiredEvals: [
          {
            name: "test",
            rules: [
              {
                metric: "accuracy",
                operator: ">=",
                baseline: "fixed",
                threshold: 0.90,
              },
            ],
          },
        ],
        onViolation: { action: "block" },
      };

      const record = createDecisionRecord({
        decision,
        environment: "production",
        contract,
        evalResults: [
          {
            evalName: "test",
            runId: "run-1",
            metrics: { accuracy: 0.95 },
          },
        ],
      });

      expect(record.environment).toBe("production");
      expect(record.decision).toBe("PASS");
      expect(record.inputs?.policy_hash).toBeDefined();
      expect(record.timestamp).toBeDefined();
    });
  });
});
