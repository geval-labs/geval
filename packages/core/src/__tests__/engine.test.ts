import { describe, it, expect } from "vitest";
import {
  evaluate,
  formatDecision,
  diffEvalResults,
  parseContract,
  type NormalizedEvalResult,
  type BaselineData,
  Violation,
} from "../index.js";

describe("evaluate", () => {
  const createContract = (rules: Array<{ metric: string; operator: string; baseline: string; threshold?: number; maxDelta?: number }>) =>
    parseContract({
      version: 1,
      name: "test-contract",
      requiredEvals: [{ name: "test-eval", rules }],
      onViolation: { action: "block" },
    });

  const createEvalResult = (metrics: Record<string, number>): NormalizedEvalResult => ({
    evalName: "test-eval",
    runId: "run-1",
    metrics,
  });

  describe("fixed baseline comparisons", () => {
    it("PASS when >= threshold is met", () => {
      const contract = createContract([
        { metric: "accuracy", operator: ">=", baseline: "fixed", threshold: 0.8 },
      ]);
      const result = createEvalResult({ accuracy: 0.85 });
      const decision = evaluate({ contract, evalResults: [result], baselines: {} });
      expect(decision.status).toBe("PASS");
    });

    it("BLOCK when >= threshold is not met", () => {
      const contract = createContract([
        { metric: "accuracy", operator: ">=", baseline: "fixed", threshold: 0.8 },
      ]);
      const result = createEvalResult({ accuracy: 0.75 });
      const decision = evaluate({ contract, evalResults: [result], baselines: {} });
      expect(decision.status).toBe("BLOCK");
      expect((decision as { violations: Violation[] }).violations).toHaveLength(1);
    });

    it("PASS when <= threshold is met", () => {
      const contract = createContract([
        { metric: "latency", operator: "<=", baseline: "fixed", threshold: 200 },
      ]);
      const result = createEvalResult({ latency: 150 });
      const decision = evaluate({ contract, evalResults: [result], baselines: {} });
      expect(decision.status).toBe("PASS");
    });

    it("BLOCK when <= threshold is not met", () => {
      const contract = createContract([
        { metric: "latency", operator: "<=", baseline: "fixed", threshold: 200 },
      ]);
      const result = createEvalResult({ latency: 250 });
      const decision = evaluate({ contract, evalResults: [result], baselines: {} });
      expect(decision.status).toBe("BLOCK");
    });

    it("PASS when == threshold is met", () => {
      const contract = createContract([
        { metric: "version", operator: "==", baseline: "fixed", threshold: 1 },
      ]);
      const result = createEvalResult({ version: 1 });
      const decision = evaluate({ contract, evalResults: [result], baselines: {} });
      expect(decision.status).toBe("PASS");
    });

    it("PASS when != threshold is met", () => {
      const contract = createContract([
        { metric: "errors", operator: "!=", baseline: "fixed", threshold: 0 },
      ]);
      const result = createEvalResult({ errors: 5 });
      const decision = evaluate({ contract, evalResults: [result], baselines: {} });
      expect(decision.status).toBe("PASS");
    });
  });

  describe("previous baseline comparisons", () => {
    it("PASS when metric improves with maxDelta", () => {
      const contract = createContract([
        { metric: "accuracy", operator: ">=", baseline: "previous", maxDelta: 0.05 },
      ]);
      const result = createEvalResult({ accuracy: 0.88 });
      const baselines: Record<string, BaselineData> = {
        "test-eval": { type: "previous", metrics: { accuracy: 0.85 } },
      };
      const decision = evaluate({ contract, evalResults: [result], baselines });
      expect(decision.status).toBe("PASS");
    });

    it("BLOCK when metric regresses beyond maxDelta", () => {
      const contract = createContract([
        { metric: "accuracy", operator: ">=", baseline: "previous", maxDelta: 0.05 },
      ]);
      const result = createEvalResult({ accuracy: 0.75 });
      const baselines: Record<string, BaselineData> = {
        "test-eval": { type: "previous", metrics: { accuracy: 0.85 } },
      };
      const decision = evaluate({ contract, evalResults: [result], baselines });
      expect(decision.status).toBe("BLOCK");
    });
  });

  describe("multiple rules", () => {
    it("PASS when all rules pass", () => {
      const contract = createContract([
        { metric: "accuracy", operator: ">=", baseline: "fixed", threshold: 0.8 },
        { metric: "latency", operator: "<=", baseline: "fixed", threshold: 200 },
      ]);
      const result = createEvalResult({ accuracy: 0.9, latency: 100 });
      const decision = evaluate({ contract, evalResults: [result], baselines: {} });
      expect(decision.status).toBe("PASS");
    });

    it("BLOCK with multiple violations", () => {
      const contract = createContract([
        { metric: "accuracy", operator: ">=", baseline: "fixed", threshold: 0.8 },
        { metric: "latency", operator: "<=", baseline: "fixed", threshold: 200 },
      ]);
      const result = createEvalResult({ accuracy: 0.5, latency: 500 });
      const decision = evaluate({ contract, evalResults: [result], baselines: {} });
      expect(decision.status).toBe("BLOCK");
      expect((decision as { violations: Violation[] }).violations).toHaveLength(2);
    });
  });

  describe("missing eval", () => {
    it("BLOCK when required eval is missing", () => {
      const contract = createContract([
        { metric: "accuracy", operator: ">=", baseline: "fixed", threshold: 0.8 },
      ]);
      const result: NormalizedEvalResult = {
        evalName: "different-eval",
        runId: "run-1",
        metrics: { accuracy: 0.9 },
      };
      const decision = evaluate({ contract, evalResults: [result], baselines: {} });
      expect(decision.status).toBe("BLOCK");
    });
  });

  describe("violation actions", () => {
    it("REQUIRES_APPROVAL when action is require_approval", () => {
      const contract = parseContract({
        version: 1,
        name: "test",
        requiredEvals: [
          {
            name: "test-eval",
            rules: [{ metric: "accuracy", operator: ">=", baseline: "fixed", threshold: 0.9 }],
          },
        ],
        onViolation: { action: "require_approval" },
      });
      const result = createEvalResult({ accuracy: 0.8 });
      const decision = evaluate({ contract, evalResults: [result], baselines: {} });
      expect(decision.status).toBe("REQUIRES_APPROVAL");
    });
  });
});

describe("formatDecision", () => {
  it("formats PASS decision", () => {
    const contract = parseContract({
      version: 1,
      name: "test",
      requiredEvals: [
        { name: "eval", rules: [{ metric: "a", operator: ">=", baseline: "fixed", threshold: 0 }] },
      ],
      onViolation: { action: "block" },
    });
    const decision = evaluate({
      contract,
      evalResults: [{ evalName: "eval", runId: "r1", metrics: { a: 1 } }],
      baselines: {},
    });
    const formatted = formatDecision(decision);
    expect(formatted).toContain("PASS");
  });

  it("formats BLOCK decision with violations", () => {
    const contract = parseContract({
      version: 1,
      name: "test",
      requiredEvals: [
        { name: "eval", rules: [{ metric: "a", operator: ">=", baseline: "fixed", threshold: 10 }] },
      ],
      onViolation: { action: "block" },
    });
    const decision = evaluate({
      contract,
      evalResults: [{ evalName: "eval", runId: "r1", metrics: { a: 1 } }],
      baselines: {},
    });
    const formatted = formatDecision(decision);
    expect(formatted).toContain("BLOCK");
    expect(formatted).toContain("violation");
  });
});

describe("diffEvalResults", () => {
  it("detects improved metrics", () => {
    const prev: NormalizedEvalResult[] = [{
      evalName: "test",
      runId: "r1",
      metrics: { accuracy: 0.8 },
    }];
    const curr: NormalizedEvalResult[] = [{
      evalName: "test",
      runId: "r2",
      metrics: { accuracy: 0.9 },
    }];
    const diff = diffEvalResults(prev, curr);
    expect(diff.diffs[0].metrics[0].direction).toBe("improved");
    expect(diff.diffs[0].metrics[0].delta).toBeCloseTo(0.1);
  });

  it("detects regressed metrics", () => {
    const prev: NormalizedEvalResult[] = [{
      evalName: "test",
      runId: "r1",
      metrics: { accuracy: 0.9 },
    }];
    const curr: NormalizedEvalResult[] = [{
      evalName: "test",
      runId: "r2",
      metrics: { accuracy: 0.8 },
    }];
    const diff = diffEvalResults(prev, curr);
    expect(diff.diffs[0].metrics[0].direction).toBe("regressed");
  });

  it("detects new metrics", () => {
    const prev: NormalizedEvalResult[] = [{
      evalName: "test",
      runId: "r1",
      metrics: {},
    }];
    const curr: NormalizedEvalResult[] = [{
      evalName: "test",
      runId: "r2",
      metrics: { newMetric: 0.5 },
    }];
    const diff = diffEvalResults(prev, curr);
    expect(diff.diffs[0].metrics[0].direction).toBe("new");
  });
});
