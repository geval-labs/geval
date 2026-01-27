import { describe, it, expect } from "vitest";
import {
  GenericAdapter,
  PromptfooAdapter,
  LangSmithAdapter,
  OpenEvalsAdapter,
  detectAdapter,
  parseEvalResult,
  parseWithAdapter,
} from "../index.js";

describe("GenericAdapter", () => {
  const adapter = new GenericAdapter();

  it("has correct name", () => {
    expect(adapter.name).toBe("generic");
  });

  it("supports valid generic format", () => {
    const data = {
      evalName: "test-eval",
      runId: "run-1",
      metrics: { accuracy: 0.9 },
    };
    expect(adapter.supports(data)).toBe(true);
  });

  it("does not support data without evalName", () => {
    expect(adapter.supports({ metrics: { a: 1 } })).toBe(false);
    expect(adapter.supports({ runId: "x", metrics: { a: 1 } })).toBe(false);
  });

  it("parses valid generic data", () => {
    const data = {
      evalName: "my-eval",
      runId: "run-123",
      metrics: { accuracy: 0.95, latency: 150 },
      metadata: { model: "gpt-4" },
    };
    const result = adapter.parse(data);
    expect(result.evalName).toBe("my-eval");
    expect(result.runId).toBe("run-123");
    expect(result.metrics.accuracy).toBe(0.95);
    expect(result.metadata?.model).toBe("gpt-4");
  });

  it("handles boolean and string metrics", () => {
    const data = {
      evalName: "test",
      runId: "run-1",
      metrics: { passed: true, status: "success", score: 0.8 },
    };
    const result = adapter.parse(data);
    expect(result.metrics.passed).toBe(true);
    expect(result.metrics.status).toBe("success");
  });
});

describe("OpenEvalsAdapter", () => {
  const adapter = new OpenEvalsAdapter();

  it("has correct name", () => {
    expect(adapter.name).toBe("openevals");
  });

  it("does NOT support data with evalName (Generic format)", () => {
    const genericData = {
      evalName: "test",
      runId: "run-1",
      metrics: { accuracy: 0.9 },
    };
    expect(adapter.supports(genericData)).toBe(false);
  });

  it("supports data with results array and scores", () => {
    const data = {
      results: [{ scores: { quality: 0.8 }, passed: true }],
    };
    expect(adapter.supports(data)).toBe(true);
  });

  it("supports data with summary", () => {
    const data = {
      summary: { passed: 8, total: 10, accuracy: 0.8 },
    };
    expect(adapter.supports(data)).toBe(true);
  });

  it("supports data with metrics AND OpenEvals fields", () => {
    const data = {
      eval_name: "my-openeval",
      metrics: { accuracy: 0.85 },
    };
    expect(adapter.supports(data)).toBe(true);
  });

  it("does NOT support data with only metrics (no OpenEvals fields)", () => {
    const data = {
      metrics: { accuracy: 0.85 },
    };
    expect(adapter.supports(data)).toBe(false);
  });

  it("parses OpenEvals format with summary", () => {
    const data = {
      eval_name: "quality-eval",
      eval_id: "eval-123",
      summary: { passed: 9, total: 10, accuracy: 0.9 },
    };
    const result = adapter.parse(data);
    expect(result.evalName).toBe("quality-eval");
    expect(result.runId).toBe("eval-123");
    expect(result.metrics.accuracy).toBe(0.9);
    expect(result.metrics.pass_rate).toBeCloseTo(0.9);
  });

  it("parses OpenEvals format with results", () => {
    const data = {
      dataset: "test-dataset",
      results: [
        { passed: true, scores: { quality: 0.9 } },
        { passed: true, scores: { quality: 0.8 } },
        { passed: false, scores: { quality: 0.5 } },
      ],
    };
    const result = adapter.parse(data);
    expect(result.evalName).toBe("test-dataset");
    expect(result.metrics.avg_quality).toBeCloseTo(0.733, 2);
    expect(result.metrics.pass_rate).toBeCloseTo(0.667, 2);
  });
});

describe("PromptfooAdapter", () => {
  const adapter = new PromptfooAdapter();

  it("has correct name", () => {
    expect(adapter.name).toBe("promptfoo");
  });

  it("supports Promptfoo format", () => {
    const data = {
      results: [{ success: true }],
    };
    expect(adapter.supports(data)).toBe(true);
  });

  it("does not support non-Promptfoo data", () => {
    expect(adapter.supports({ results: [{ passed: true }] })).toBe(false);
    expect(adapter.supports({ data: [] })).toBe(false);
  });
});

describe("LangSmithAdapter", () => {
  const adapter = new LangSmithAdapter();

  it("has correct name", () => {
    expect(adapter.name).toBe("langsmith");
  });

  it("supports LangSmith format with examples", () => {
    const data = {
      examples: [{ input: "test", output: "result" }],
    };
    expect(adapter.supports(data)).toBe(true);
  });

  it("supports LangSmith format with results and feedback", () => {
    const data = {
      results: [{ run_id: "123", feedback: { score: 0.9 } }],
    };
    expect(adapter.supports(data)).toBe(true);
  });
});

describe("detectAdapter", () => {
  it("detects Generic format", () => {
    const data = { evalName: "test", runId: "r1", metrics: { a: 1 } };
    const adapter = detectAdapter(data);
    expect(adapter?.name).toBe("generic");
  });

  it("detects OpenEvals format", () => {
    const data = { eval_name: "test", metrics: { a: 1 } };
    const adapter = detectAdapter(data);
    expect(adapter?.name).toBe("openevals");
  });

  it("detects Promptfoo format", () => {
    const data = { results: [{ success: true }] };
    const adapter = detectAdapter(data);
    expect(adapter?.name).toBe("promptfoo");
  });

  it("returns undefined for unknown format", () => {
    const adapter = detectAdapter({ unknown: "format" });
    expect(adapter).toBeUndefined();
  });
});

describe("parseEvalResult", () => {
  it("auto-detects and parses Generic format", () => {
    const data = {
      evalName: "auto-detected",
      runId: "run-1",
      metrics: { score: 0.88 },
    };
    const result = parseEvalResult(data);
    expect(result.evalName).toBe("auto-detected");
    expect(result.metrics.score).toBe(0.88);
  });

  it("throws for unknown format", () => {
    expect(() => parseEvalResult({ unknown: true })).toThrow();
  });
});

describe("parseWithAdapter", () => {
  it("parses with specified adapter", () => {
    const data = {
      evalName: "test",
      runId: "run-1",
      metrics: { accuracy: 0.9 },
    };
    const result = parseWithAdapter(data, "generic");
    expect(result.evalName).toBe("test");
  });

  it("throws for unknown adapter", () => {
    expect(() => parseWithAdapter({}, "nonexistent")).toThrow(/Unknown adapter/);
  });
});
