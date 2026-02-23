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
                  operator: ">=" as const,
                  baseline: "fixed" as const,
                  threshold: 0.9,
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
        baselines: {},
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
                  operator: "<" as const,
                  baseline: "fixed" as const,
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
        baselines: {},
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
        baselines: {},
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
        baselines: {},
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
        baselines: {},
      });
      expect(devDecision.status).toBe("PASS");

      // Production should block (accuracy 0.92 < 0.95)
      const prodDecision = evaluatePolicy({
        contract,
        evalResults: mockEvalResults,
        signals: [],
        environment: "production",
        baselines: {},
      });
      expect(prodDecision.status).toBe("BLOCK");
    });
  });

  describe("baseline comparison support", () => {
    it("evaluates previous baseline comparison when within acceptable range", () => {
      const evalResults: NormalizedEvalResult[] = [
        {
          evalName: "quality-metrics",
          runId: "run-2",
          metrics: {
            accuracy: 0.88,
          },
        },
      ];

      const baselines = {
        "quality-metrics": {
          type: "previous" as const,
          metrics: {
            accuracy: 0.92,
          },
        },
      };

      const contract = {
        name: "test-contract",
        policy: {
          rules: [
            {
              when: {
                eval: {
                  metric: "accuracy",
                  operator: ">=",
                  baseline: "previous",
                  maxDelta: 0.05,
                },
              },
              then: {
                action: "pass" as const,
                reason: "Accuracy within acceptable range",
              },
            },
          ],
        },
      };

      const decision = evaluatePolicy({
        contract,
        evalResults,
        signals: [],
        environment: "production",
        baselines,
      });

      // Delta is 0.04 (4%), which is <= 0.05 max allowed
      expect(decision.status).toBe("PASS");
    });

    it("blocks when maxDelta exceeded", () => {
      const evalResults: NormalizedEvalResult[] = [
        {
          evalName: "quality-metrics",
          runId: "run-2",
          metrics: {
            accuracy: 0.85,
          },
        },
      ];

      const baselines = {
        "quality-metrics": {
          type: "previous" as const,
          metrics: {
            accuracy: 0.92,
          },
        },
      };

      const contract = {
        name: "test-contract",
        policy: {
          rules: [
            {
              when: {
                eval: {
                  metric: "accuracy",
                  operator: "<",
                  baseline: "previous",
                  maxDelta: 0.05,
                },
              },
              then: {
                action: "block" as const,
                reason: "Accuracy regressed too much",
              },
            },
          ],
        },
      };

      const decision = evaluatePolicy({
        contract,
        evalResults,
        signals: [],
        environment: "production",
        baselines,
      });

      // Delta is 0.07 (7%), which exceeds 0.05 max allowed
      expect(decision.status).toBe("BLOCK");
    });

    it("passes when no baseline exists for first run", () => {
      const evalResults: NormalizedEvalResult[] = [
        {
          evalName: "quality-metrics",
          runId: "run-1",
          metrics: {
            accuracy: 0.8,
          },
        },
      ];

      const contract = {
        name: "test-contract",
        policy: {
          rules: [
            {
              when: {
                eval: {
                  metric: "accuracy",
                  operator: ">=",
                  baseline: "previous",
                },
              },
              then: {
                action: "pass" as const,
                reason: "First run - no baseline to compare",
              },
            },
          ],
        },
      };

      const decision = evaluatePolicy({
        contract,
        evalResults,
        signals: [],
        environment: "production",
        baselines: {},
      });

      // Should pass because no baseline exists
      expect(decision.status).toBe("PASS");
    });

    it("passes when metric missing from baseline", () => {
      const evalResults: NormalizedEvalResult[] = [
        {
          evalName: "quality-metrics",
          runId: "run-2",
          metrics: {
            new_metric: 0.95,
          },
        },
      ];

      const baselines = {
        "quality-metrics": {
          type: "previous" as const,
          metrics: {
            accuracy: 0.92,
          },
        },
      };

      const contract = {
        name: "test-contract",
        policy: {
          rules: [
            {
              when: {
                eval: {
                  metric: "new_metric",
                  operator: ">=",
                  baseline: "previous",
                },
              },
              then: {
                action: "pass" as const,
                reason: "New metric - no baseline",
              },
            },
          ],
        },
      };

      const decision = evaluatePolicy({
        contract,
        evalResults,
        signals: [],
        environment: "production",
        baselines,
      });

      // Should pass because metric doesn't exist in baseline
      expect(decision.status).toBe("PASS");
    });

    it("evaluates main baseline comparison correctly", () => {
      const evalResults: NormalizedEvalResult[] = [
        {
          evalName: "performance-metrics",
          runId: "feature-run-1",
          metrics: {
            latency_ms: 180,
          },
        },
      ];

      const baselines = {
        "performance-metrics": {
          type: "main" as const,
          metrics: {
            latency_ms: 150,
          },
        },
      };

      const contract = {
        name: "test-contract",
        policy: {
          rules: [
            {
              when: {
                eval: {
                  metric: "latency_ms",
                  operator: "<=",
                  baseline: "main",
                },
              },
              then: {
                action: "pass" as const,
                reason: "Latency not worse than main",
              },
            },
          ],
        },
      };

      const decision = evaluatePolicy({
        contract,
        evalResults,
        signals: [],
        environment: "production",
        baselines,
      });

      // 180 > 150, so condition (<=) is NOT met
      expect(decision.status).toBe("PASS");
    });

    it("handles non-numeric metrics in baseline comparison", () => {
      const evalResults: NormalizedEvalResult[] = [
        {
          evalName: "status-check",
          runId: "run-1",
          metrics: {
            status: "healthy",
          },
        },
      ];

      const baselines = {
        "status-check": {
          type: "previous" as const,
          metrics: {
            status: "healthy",
          },
        },
      };

      const contract = {
        name: "test-contract",
        policy: {
          rules: [
            {
              when: {
                eval: {
                  metric: "status",
                  operator: "==",
                  baseline: "previous",
                },
              },
              then: {
                action: "pass" as const,
                reason: "Status unchanged",
              },
            },
          ],
        },
      };

      const decision = evaluatePolicy({
        contract,
        evalResults,
        signals: [],
        environment: "production",
        baselines,
      });

      expect(decision.status).toBe("PASS");
    });

    it("blocks when baseline comparison fails with operator", () => {
      const evalResults: NormalizedEvalResult[] = [
        {
          evalName: "quality-metrics",
          runId: "run-2",
          metrics: {
            accuracy: 0.82,
          },
        },
      ];

      const baselines = {
        "quality-metrics": {
          type: "previous" as const,
          metrics: {
            accuracy: 0.9,
          },
        },
      };

      const contract = {
        name: "test-contract",
        policy: {
          rules: [
            {
              when: {
                eval: {
                  metric: "accuracy",
                  operator: "<",
                  baseline: "previous",
                },
              },
              then: {
                action: "block" as const,
                reason: "Accuracy decreased from previous",
              },
            },
          ],
        },
      };

      const decision = evaluatePolicy({
        contract,
        evalResults,
        signals: [],
        environment: "production",
        baselines,
      });

      // 0.82 < 0.90, so condition matches and blocks
      expect(decision.status).toBe("BLOCK");
    });
  });
});
