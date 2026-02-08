import { describe, it, expect } from "vitest";
import { evaluatePolicy } from "../engine/policy-evaluator.js";
import type { NormalizedEvalResult } from "../types/index.js";
import type { Signal } from "../signals/types.js";

describe("Policy Evaluator", () => {
  const mockEvalResults: NormalizedEvalResult[] = [
    {
      evalName: "quality-metrics",
      runId: "run-1",
      metrics: {
        accuracy: 0.92,
        latency: 200,
      },
    },
  ];

  const mockSignals: Signal[] = [
    {
      id: "sig-1",
      type: "risk_flag",
      name: "security-risk",
      value: { level: "low" },
    },
  ];

  describe("eval-based conditions", () => {
    it("evaluates fixed threshold condition", () => {
      const contract = {
        name: "test-contract",
        policy: {
          rules: [
            {
              when: {
                eval: {
                  metric: "accuracy",
                  operator: ">=",
                  baseline: "fixed",
                  threshold: 0.90,
                },
              },
              then: {
                action: "pass" as const,
                reason: "Accuracy meets threshold",
              },
            },
          ],
        },
      };

      const decision = evaluatePolicy({
        contract,
        evalResults: mockEvalResults,
        signals: [],
        environment: "production",
      });

      expect(decision.status).toBe("PASS");
    });

    it("blocks when threshold not met", () => {
      const contract = {
        name: "test-contract",
        policy: {
          rules: [
            {
              when: {
                eval: {
                  metric: "accuracy",
                  operator: "<",
                  baseline: "fixed",
                  threshold: 0.95,
                },
              },
              then: {
                action: "block" as const,
                reason: "Accuracy too low",
              },
            },
          ],
        },
      };

      const decision = evaluatePolicy({
        contract,
        evalResults: mockEvalResults,
        signals: [],
        environment: "production",
      });

      // Accuracy is 0.92, which is < 0.95, so condition matches and blocks
      expect(decision.status).toBe("BLOCK");
    });
  });

  describe("signal-based conditions", () => {
    it("evaluates signal presence", () => {
      const contract = {
        name: "test-contract",
        policy: {
          rules: [
            {
              when: {
                signal: {
                  type: "risk_flag",
                },
              },
              then: {
                action: "require_approval" as const,
                reason: "Risk flag present",
              },
            },
          ],
        },
      };

      const decision = evaluatePolicy({
        contract,
        evalResults: [],
        signals: mockSignals,
        environment: "production",
      });

      expect(decision.status).toBe("REQUIRES_APPROVAL");
    });

    it("evaluates signal value condition", () => {
      const highRiskSignals: Signal[] = [
        {
          id: "sig-1",
          type: "risk_flag",
          name: "security-risk",
          value: { level: "high" },
        },
      ];

      const contract = {
        name: "test-contract",
        policy: {
          rules: [
            {
              when: {
                signal: {
                  type: "risk_flag",
                  field: "level",
                  operator: "==",
                  value: "high",
                },
              },
              then: {
                action: "block" as const,
                reason: "High risk detected",
              },
            },
          ],
        },
      };

      const decision = evaluatePolicy({
        contract,
        evalResults: [],
        signals: highRiskSignals,
        environment: "production",
      });

      expect(decision.status).toBe("BLOCK");
    });
  });

  describe("environment-specific policies", () => {
    it("uses environment-specific rules", () => {
      const contract = {
        name: "test-contract",
        policy: {
          environments: {
            development: {
              default: "pass",
            },
            production: {
              rules: [
                {
                  when: {
                    eval: {
                      metric: "accuracy",
                      operator: "<",
                      baseline: "fixed",
                      threshold: 0.95,
                    },
                  },
                  then: {
                    action: "block" as const,
                    reason: "Production requires higher accuracy",
                  },
                },
              ],
            },
          },
        },
      };

      // Development should pass (uses default)
      const devDecision = evaluatePolicy({
        contract,
        evalResults: mockEvalResults,
        signals: [],
        environment: "development",
      });
      expect(devDecision.status).toBe("PASS");

      // Production should block (accuracy 0.92 < 0.95)
      const prodDecision = evaluatePolicy({
        contract,
        evalResults: mockEvalResults,
        signals: [],
        environment: "production",
      });
      expect(prodDecision.status).toBe("BLOCK");
    });
  });
});
