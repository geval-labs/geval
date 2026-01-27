import { describe, it, expect } from "vitest";
import {
  parseCsv,
  isCsv,
  aggregate,
  parseEvalFile,
  detectFileType,
  EvalSourceConfigSchema,
  AggregationMethodSchema,
} from "../index.js";

describe("CSV Parser", () => {
  describe("parseCsv", () => {
    it("parses simple CSV", () => {
      const csv = `name,value,status
test1,0.85,pass
test2,0.90,pass
test3,0.75,fail`;

      const { headers, rows } = parseCsv(csv);

      expect(headers).toEqual(["name", "value", "status"]);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual({ name: "test1", value: 0.85, status: "pass" });
    });

    it("handles quoted values with commas", () => {
      const csv = `name,description
test1,"A, B, and C"
test2,simple`;

      const { rows } = parseCsv(csv);
      expect(rows[0]).toEqual({ name: "test1", description: "A, B, and C" });
    });

    it("handles quoted values with newlines", () => {
      const csv = `name,description
test1,"Line 1
Line 2"
test2,simple`;

      const { rows } = parseCsv(csv);
      expect(rows[0]?.description).toContain("Line 1");
    });

    it("handles escaped quotes", () => {
      const csv = `name,quote
test1,"He said ""hello"""`;

      const { rows } = parseCsv(csv);
      expect(rows[0]?.quote).toBe('He said "hello"');
    });

    it("auto-converts types", () => {
      const csv = `num,bool,str,nil
42,true,hello,null
3.14,false,world,`;

      const { rows } = parseCsv(csv);

      expect(rows[0]).toEqual({ num: 42, bool: true, str: "hello", nil: null });
      expect(rows[1]).toEqual({ num: 3.14, bool: false, str: "world", nil: null });
    });

    it("handles custom delimiter", () => {
      const csv = `name;value
test1;100
test2;200`;

      const { rows } = parseCsv(csv, { delimiter: ";" });
      expect(rows[0]).toEqual({ name: "test1", value: 100 });
    });

    it("handles no header mode", () => {
      const csv = `test1,100
test2,200`;

      const { headers, rows } = parseCsv(csv, { hasHeader: false });
      expect(headers).toEqual(["col_0", "col_1"]);
      expect(rows[0]).toEqual({ col_0: "test1", col_1: 100 });
    });

    it("handles empty CSV", () => {
      const { headers, rows } = parseCsv("");
      expect(headers).toEqual([]);
      expect(rows).toEqual([]);
    });
  });

  describe("isCsv", () => {
    it("detects CSV content", () => {
      expect(isCsv("a,b,c\n1,2,3")).toBe(true);
    });

    it("rejects JSON content", () => {
      expect(isCsv('{"key": "value"}')).toBe(false);
      expect(isCsv("[1,2,3]")).toBe(false);
    });
  });
});

describe("Aggregator", () => {
  describe("numeric aggregations", () => {
    it("calculates average", () => {
      expect(aggregate([1, 2, 3, 4, 5], "avg")).toBe(3);
      expect(aggregate([10, 20], "avg")).toBe(15);
    });

    it("calculates sum", () => {
      expect(aggregate([1, 2, 3, 4, 5], "sum")).toBe(15);
    });

    it("calculates min", () => {
      expect(aggregate([5, 1, 3, 2, 4], "min")).toBe(1);
    });

    it("calculates max", () => {
      expect(aggregate([5, 1, 3, 2, 4], "max")).toBe(5);
    });

    it("calculates count", () => {
      expect(aggregate([1, 2, null, 4, 5], "count")).toBe(4);
    });

    it("calculates first", () => {
      expect(aggregate([10, 20, 30], "first")).toBe(10);
    });

    it("calculates last", () => {
      expect(aggregate([10, 20, 30], "last")).toBe(30);
    });
  });

  describe("percentiles", () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    it("calculates p50 (median)", () => {
      expect(aggregate(values, "p50")).toBe(50);
    });

    it("calculates p90", () => {
      expect(aggregate(values, "p90")).toBe(90);
    });

    it("calculates p95", () => {
      expect(aggregate(values, "p95")).toBe(100);
    });

    it("calculates p99", () => {
      expect(aggregate(values, "p99")).toBe(100);
    });
  });

  describe("pass/fail rates", () => {
    it("calculates pass_rate with strings", () => {
      const values = ["pass", "pass", "fail", "pass", "fail"];
      expect(aggregate(values, "pass_rate")).toBe(0.6);
    });

    it("calculates pass_rate with booleans", () => {
      const values = [true, true, false, true, false];
      expect(aggregate(values, "pass_rate")).toBe(0.6);
    });

    it("calculates pass_rate with numbers", () => {
      const values = [1, 1, 0, 1, 0];
      expect(aggregate(values, "pass_rate")).toBe(0.6);
    });

    it("calculates fail_rate", () => {
      const values = ["pass", "pass", "fail", "pass", "fail"];
      expect(aggregate(values, "fail_rate")).toBe(0.4);
    });

    it("recognizes success/ok/yes as pass", () => {
      const values = ["success", "ok", "yes", "fail", "no"];
      expect(aggregate(values, "pass_rate")).toBe(0.6);
    });
  });

  describe("edge cases", () => {
    it("handles empty arrays", () => {
      expect(aggregate([], "avg")).toBe(0);
      expect(aggregate([], "sum")).toBe(0);
      expect(aggregate([], "count")).toBe(0);
    });

    it("handles mixed types", () => {
      const values = [1, "2", 3, null, undefined];
      expect(aggregate(values, "sum")).toBe(6);
    });
  });
});

describe("Source Config Schema", () => {
  describe("AggregationMethodSchema", () => {
    it("validates all aggregation methods", () => {
      const methods = [
        "avg", "sum", "min", "max", "count",
        "p50", "p90", "p95", "p99",
        "pass_rate", "fail_rate", "first", "last",
      ];
      for (const method of methods) {
        expect(() => AggregationMethodSchema.parse(method)).not.toThrow();
      }
    });

    it("rejects invalid methods", () => {
      expect(() => AggregationMethodSchema.parse("invalid")).toThrow();
    });
  });

  describe("EvalSourceConfigSchema", () => {
    it("validates simple metric config", () => {
      const config = {
        metrics: ["accuracy", "latency"],
        evalName: { fixed: "my-eval" },
      };
      const result = EvalSourceConfigSchema.parse(config);
      expect(result.metrics).toEqual(["accuracy", "latency"]);
      expect(result.evalName).toEqual({ fixed: "my-eval" });
    });

    it("validates full metric config", () => {
      const config = {
        metrics: [
          { column: "accuracy", aggregate: "avg" },
          { column: "latency", aggregate: "p95", as: "latency_p95" },
          { column: "status", aggregate: "pass_rate", filter: { column: "type", equals: "test" } },
        ],
        evalName: { fixed: "my-eval" },
        runId: "session_id",
        timestamp: "created_at",
        metadata: { model: "model_name" },
      };
      const result = EvalSourceConfigSchema.parse(config);
      expect(result.metrics).toHaveLength(3);
    });

    it("validates CSV options", () => {
      const config = {
        metrics: ["score"],
        csv: { delimiter: ";", hasHeader: true },
      };
      const result = EvalSourceConfigSchema.parse(config);
      expect(result.csv?.delimiter).toBe(";");
    });

    it("validates JSON options", () => {
      const config = {
        metrics: ["score"],
        json: { resultsPath: "data.items" },
      };
      const result = EvalSourceConfigSchema.parse(config);
      expect(result.json?.resultsPath).toBe("data.items");
    });

    it("requires at least one metric", () => {
      expect(() => EvalSourceConfigSchema.parse({ metrics: [] })).toThrow();
    });
  });
});

describe("File Type Detection", () => {
  describe("detectFileType", () => {
    it("detects CSV from extension", () => {
      expect(detectFileType("results.csv", "a,b,c")).toBe("csv");
      expect(detectFileType("data.CSV", "a,b,c")).toBe("csv");
    });

    it("detects JSON from extension", () => {
      expect(detectFileType("results.json", '{"key": "value"}')).toBe("json");
    });

    it("detects JSONL from extension", () => {
      expect(detectFileType("results.jsonl", '{"a":1}\n{"a":2}')).toBe("jsonl");
      expect(detectFileType("results.ndjson", '{"a":1}\n{"a":2}')).toBe("jsonl");
    });

    it("detects CSV from content", () => {
      expect(detectFileType("data.txt", "a,b,c\n1,2,3")).toBe("csv");
    });

    it("detects JSON from content", () => {
      expect(detectFileType("data.txt", '{"key": "value"}')).toBe("json");
      expect(detectFileType("data.txt", "[1, 2, 3]")).toBe("json");
    });

    it("detects JSONL from content", () => {
      expect(detectFileType("data.txt", '{"a":1}\n{"b":2}')).toBe("jsonl");
    });
  });
});

describe("parseEvalFile with contract source config", () => {
  const csvContent = `id,accuracy,latency,status
1,0.85,120,pass
2,0.90,150,pass
3,0.75,200,fail
4,0.88,130,pass`;

  const contractWithCsvConfig = {
    sources: {
      csv: {
        metrics: [
          { column: "accuracy", aggregate: "avg" as const },
          { column: "latency", aggregate: "p95" as const, as: "latency_p95" },
          { column: "status", aggregate: "pass_rate" as const },
        ],
        evalName: { fixed: "quality-check" },
      },
    },
  };

  it("parses CSV with source config", () => {
    const result = parseEvalFile(csvContent, "results.csv", contractWithCsvConfig);

    expect(result.evalName).toBe("quality-check");
    expect(result.metrics.accuracy).toBeCloseTo(0.845, 2);
    expect(result.metrics.latency_p95).toBe(200);
    expect(result.metrics.status).toBe(0.75);
  });

  it("uses runId from config (fixed)", () => {
    const contractWithRunId = {
      sources: {
        csv: {
          metrics: [{ column: "accuracy", aggregate: "avg" as const }],
          evalName: { fixed: "test" },
          runId: { fixed: "test-run-123" },
        },
      },
    };

    const result = parseEvalFile(csvContent, "results.csv", contractWithRunId);
    expect(result.runId).toBe("test-run-123");
  });

  it("uses runId from column", () => {
    const csv = `id,accuracy,session
1,0.9,session-abc`;

    const contract = {
      sources: {
        csv: {
          metrics: [{ column: "accuracy", aggregate: "avg" as const }],
          evalName: { fixed: "test" },
          runId: "session",
        },
      },
    };

    const result = parseEvalFile(csv, "data.csv", contract);
    expect(result.runId).toBe("session-abc");
  });
});

describe("parseEvalFile with JSON", () => {
  it("parses JSON in normalized format without source config", () => {
    const jsonContent = JSON.stringify({
      evalName: "json-eval",
      runId: "json-run-1",
      metrics: { accuracy: 0.92, latency: 150 },
    });

    const result = parseEvalFile(jsonContent, "results.json", {});

    expect(result.evalName).toBe("json-eval");
    expect(result.metrics.accuracy).toBe(0.92);
  });

  it("throws for CSV without source config", () => {
    const csvContent = "a,b\n1,2";
    expect(() => parseEvalFile(csvContent, "data.csv", {})).toThrow(/source config/);
  });
});
