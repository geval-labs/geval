import { describe, it, expect } from "vitest";
import {
  parseContractFromYaml,
  parseEvalFile,
  parseSignals,
  evaluate,
  createDecisionRecord,
  formatDecisionRecord,
} from "../index.js";

describe("E2E: Full Decision Flow", () => {
  describe("Policy-based contract with signals", () => {
    const contractYaml = `
version: 1
name: e2e-test-contract
environment: production

policy:
  environments:
    production:
      rules:
        - when:
            eval:
              metric: accuracy
              operator: ">="
              baseline: fixed
              threshold: 0.90
          then:
            action: pass
            reason: "Accuracy meets threshold"
        
        - when:
            signal:
              type: risk_flag
              field: level
              operator: "=="
              value: "high"
          then:
            action: block
            reason: "High risk detected"
      
      default: require_approval

sources:
  csv:
    metrics:
      - column: accuracy
        aggregate: avg
    evalName:
      fixed: quality-metrics
`;

    it("evaluates policy with eval results and signals", () => {
      // Parse contract
      const contract = parseContractFromYaml(contractYaml);

      // Parse eval results
      const csvContent = `accuracy
0.92
0.94
0.93`;

      const evalResult = parseEvalFile(csvContent, "results.csv", contract);

      // Parse signals
      const signalsData = {
        signals: [
          {
            id: "risk-1",
            type: "risk_flag",
            name: "security-risk",
            value: { level: "low" },
          },
        ],
      };

      const signalCollection = parseSignals(signalsData);
      const signals = signalCollection.signals;

      // Evaluate
      const decision = evaluate({
        contract,
        evalResults: [evalResult],
        baselines: {},
        signals,
        environment: "production",
      });

      // Should pass because accuracy meets threshold and risk is low
      expect(decision.status).toBe("PASS");
    });

    it("blocks when high risk signal present", () => {
      const contract = parseContractFromYaml(contractYaml);

      // Use lower accuracy so first rule doesn't match
      const csvContent = `accuracy
0.85
0.86
0.84`;

      const evalResult = parseEvalFile(csvContent, "results.csv", contract);

      const signalsData = {
        signals: [
          {
            id: "risk-1",
            type: "risk_flag",
            name: "security-risk",
            value: { level: "high" },
          },
        ],
      };

      const signalCollection = parseSignals(signalsData);
      const signals = signalCollection.signals;

      const decision = evaluate({
        contract,
        evalResults: [evalResult],
        baselines: {},
        signals,
        environment: "production",
      });

      // Should block because high risk signal (rule matches before default)
      expect(decision.status).toBe("BLOCK");
    });

    it("requires approval when no rules match", () => {
      const contract = parseContractFromYaml(contractYaml);

      const csvContent = `accuracy
0.85
0.86
0.84`;

      const evalResult = parseEvalFile(csvContent, "results.csv", contract);

      const signalsData = {
        signals: [
          {
            id: "risk-1",
            type: "risk_flag",
            name: "security-risk",
            value: { level: "low" },
          },
        ],
      };

      const signalCollection = parseSignals(signalsData);
      const signals = signalCollection.signals;

      const decision = evaluate({
        contract,
        evalResults: [evalResult],
        baselines: {},
        signals,
        environment: "production",
      });

      // Should require approval because accuracy doesn't meet threshold
      // but no blocking rule matched, so default applies
      expect(decision.status).toBe("REQUIRES_APPROVAL");
    });

    it("creates decision record with hashes", () => {
      const contract = parseContractFromYaml(contractYaml);

      const csvContent = `accuracy
0.92
0.94
0.93`;

      const evalResult = parseEvalFile(csvContent, "results.csv", contract);

      const signalsData = {
        signals: [
          {
            id: "risk-1",
            type: "risk_flag",
            name: "security-risk",
            value: { level: "low" },
          },
        ],
      };

      const signalCollection = parseSignals(signalsData);
      const signals = signalCollection.signals;

      const decision = evaluate({
        contract,
        evalResults: [evalResult],
        baselines: {},
        signals,
        environment: "production",
      });

      const record = createDecisionRecord({
        decision,
        environment: "production",
        contract,
        evalResults: [evalResult],
        signals,
        evidence: ["results.csv", "signals.json"],
      });

      expect(record.environment).toBe("production");
      expect(record.decision).toBe("PASS");
      expect(record.inputs?.eval_hash).toBeDefined();
      expect(record.inputs?.signals_hash).toBeDefined();
      expect(record.inputs?.policy_hash).toBeDefined();
      expect(record.evidence).toEqual(["results.csv", "signals.json"]);

      // Format should be valid JSON
      const formatted = formatDecisionRecord(record);
      expect(() => JSON.parse(formatted)).not.toThrow();
    });
  });

  describe("Legacy eval-based contract (backward compatibility)", () => {
    const contractYaml = `
version: 1
name: legacy-contract
environment: production

sources:
  csv:
    metrics:
      - column: accuracy
        aggregate: avg
    evalName:
      fixed: quality-metrics

required_evals:
  - name: quality-metrics
    rules:
      - metric: accuracy
        operator: ">="
        baseline: fixed
        threshold: 0.90

on_violation:
  action: block
`;

    it("works with legacy contract format", () => {
      const contract = parseContractFromYaml(contractYaml);

      const csvContent = `accuracy
0.92
0.94
0.93`;

      const evalResult = parseEvalFile(csvContent, "results.csv", contract);

      const decision = evaluate({
        contract,
        evalResults: [evalResult],
        baselines: {},
      });

      expect(decision.status).toBe("PASS");
    });
  });
});
