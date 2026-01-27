import { describe, it, expect } from "vitest";
import {
  parseContract,
  parseContractFromYaml,
  validateContract,
  diffContracts,
  EvalContractSchema,
} from "../index.js";

describe("Contract Parsing", () => {
  const validContractData = {
    version: 1,
    name: "test-contract",
    requiredEvals: [
      {
        name: "quality-metrics",
        rules: [
          {
            metric: "accuracy",
            operator: ">=",
            baseline: "fixed",
            threshold: 0.8,
          },
        ],
      },
    ],
    onViolation: {
      action: "block",
    },
  };

  describe("parseContract", () => {
    it("parses valid contract data", () => {
      const contract = parseContract(validContractData);
      expect(contract.name).toBe("test-contract");
      expect(contract.version).toBe(1);
      expect(contract.requiredEvals).toHaveLength(1);
    });

    it("throws on invalid contract data", () => {
      expect(() => parseContract({})).toThrow();
      expect(() => parseContract({ version: 2 })).toThrow();
    });

    it("applies default environment", () => {
      const contract = parseContract(validContractData);
      expect(contract.environment).toBe("production");
    });

    it("parses contract with custom environment", () => {
      const contract = parseContract({
        ...validContractData,
        environment: "staging",
      });
      expect(contract.environment).toBe("staging");
    });

    it("parses contract with sources config", () => {
      const contractWithSources = {
        ...validContractData,
        sources: {
          csv: {
            metrics: [{ column: "accuracy", aggregate: "avg" }],
            evalName: { fixed: "test-eval" },
          },
        },
      };
      const contract = parseContract(contractWithSources);
      expect(contract.sources?.csv).toBeDefined();
      expect(contract.sources?.csv?.metrics).toHaveLength(1);
    });
  });

  describe("parseContractFromYaml", () => {
    it("parses valid YAML contract", () => {
      const yaml = `
version: 1
name: yaml-contract
requiredEvals:
  - name: quality
    rules:
      - metric: accuracy
        operator: ">="
        baseline: fixed
        threshold: 0.85
onViolation:
  action: block
`;
      const contract = parseContractFromYaml(yaml);
      expect(contract.name).toBe("yaml-contract");
      expect(contract.requiredEvals[0].rules[0].threshold).toBe(0.85);
    });

    it("parses YAML with sources config", () => {
      const yaml = `
version: 1
name: yaml-with-sources
sources:
  csv:
    metrics:
      - column: score
        aggregate: avg
      - column: latency
        aggregate: p95
    evalName:
      fixed: csv-eval
requiredEvals:
  - name: csv-eval
    rules:
      - metric: score
        operator: ">="
        baseline: fixed
        threshold: 0.7
onViolation:
  action: warn
`;
      const contract = parseContractFromYaml(yaml);
      expect(contract.sources?.csv?.metrics).toHaveLength(2);
      expect(contract.onViolation.action).toBe("warn");
    });

    it("throws on invalid YAML", () => {
      expect(() => parseContractFromYaml("invalid: yaml: content:")).toThrow();
    });
  });

  describe("validateContract", () => {
    it("returns valid for correct contract", () => {
      const contract = parseContract(validContractData);
      const result = validateContract(contract);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns errors for contract with duplicate eval names", () => {
      const contract = parseContract({
        ...validContractData,
        requiredEvals: [
          { name: "duplicate", rules: [{ metric: "a", operator: ">=", baseline: "fixed", threshold: 0 }] },
          { name: "duplicate", rules: [{ metric: "b", operator: ">=", baseline: "fixed", threshold: 0 }] },
        ],
      });
      const result = validateContract(contract);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("diffContracts", () => {
    it("detects name changes", () => {
      const prev = parseContract(validContractData);
      const curr = parseContract({ ...validContractData, name: "new-name" });
      const diff = diffContracts(prev, curr);
      expect(diff.diffs.some((d) => d.field === "name")).toBe(true);
      expect(diff.identical).toBe(false);
    });

    it("returns identical for same contracts", () => {
      const contract = parseContract(validContractData);
      const diff = diffContracts(contract, contract);
      expect(diff.identical).toBe(true);
      expect(diff.diffs).toHaveLength(0);
    });
  });
});

describe("EvalContractSchema", () => {
  it("validates all comparison operators", () => {
    const operators = ["==", "!=", "<", "<=", ">", ">="];
    for (const op of operators) {
      const data = {
        version: 1,
        name: "test",
        requiredEvals: [
          {
            name: "eval",
            rules: [{ metric: "m", operator: op, baseline: "fixed", threshold: 1 }],
          },
        ],
        onViolation: { action: "block" },
      };
      expect(() => EvalContractSchema.parse(data)).not.toThrow();
    }
  });

  it("validates all baseline types", () => {
    const baselines = ["previous", "main", "fixed"];
    for (const baseline of baselines) {
      const data = {
        version: 1,
        name: "test",
        requiredEvals: [
          {
            name: "eval",
            rules: [{ metric: "m", operator: ">=", baseline, threshold: 1 }],
          },
        ],
        onViolation: { action: "block" },
      };
      expect(() => EvalContractSchema.parse(data)).not.toThrow();
    }
  });

  it("validates all violation actions", () => {
    const actions = ["block", "require_approval", "warn"];
    for (const action of actions) {
      const data = {
        version: 1,
        name: "test",
        requiredEvals: [
          {
            name: "eval",
            rules: [{ metric: "m", operator: ">=", baseline: "fixed", threshold: 1 }],
          },
        ],
        onViolation: { action },
      };
      expect(() => EvalContractSchema.parse(data)).not.toThrow();
    }
  });
});
