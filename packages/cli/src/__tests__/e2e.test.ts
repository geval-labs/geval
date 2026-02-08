import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = path.resolve(__dirname, "../../dist/cli.js");

describe("CLI E2E Tests", () => {
  const testDir = path.join(__dirname, "../../../test-cli-e2e");
  const contractPath = path.join(testDir, "contract.yaml");
  const evalPath = path.join(testDir, "eval.json");
  const signalsPath = path.join(testDir, "signals.json");
  const approvalPath = path.join(testDir, "approval.json");

  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create test contract (policy-based)
    const contractYaml = `version: 1
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

    fs.writeFileSync(contractPath, contractYaml);

    // Create test eval result
    const evalResult = {
      evalName: "quality-metrics",
      runId: "test-run-1",
      metrics: {
        accuracy: 0.92,
      },
    };
    fs.writeFileSync(evalPath, JSON.stringify(evalResult, null, 2));

    // Create test signals
    const signals = {
      signals: [
        {
          id: "risk-1",
          type: "risk_flag",
          name: "security-risk",
          value: { level: "low" },
        },
      ],
    };
    fs.writeFileSync(signalsPath, JSON.stringify(signals, null, 2));
  });

  it("should validate a contract", () => {
    const output = execSync(`node ${cliPath} validate ${contractPath}`, {
      encoding: "utf-8",
      cwd: testDir,
    });

    expect(output).toContain("Contract is valid");
    expect(output).toContain("e2e-test-contract");
  });

  it("should check eval results with policy contract", () => {
    const output = execSync(
      `node ${cliPath} check --contract ${contractPath} --eval ${evalPath} --env production`,
      {
        encoding: "utf-8",
        cwd: testDir,
      }
    );

    expect(output).toContain("PASS");
  });

  it("should check eval results with signals", () => {
    const output = execSync(
      `node ${cliPath} check --contract ${contractPath} --eval ${evalPath} --signals ${signalsPath} --env production`,
      {
        encoding: "utf-8",
        cwd: testDir,
      }
    );

    expect(output).toContain("PASS");
    
    // Check that decision record was created
    const recordPath = path.join(testDir, "geval-decision.json");
    expect(fs.existsSync(recordPath)).toBe(true);
    
    const record = JSON.parse(fs.readFileSync(recordPath, "utf-8"));
    expect(record.decision).toBe("PASS");
    expect(record.environment).toBe("production");
    expect(record.inputs?.signals_hash).toBeDefined();
  });

  it("should create approval artifact", () => {
    const output = execSync(
      `node ${cliPath} approve --reason "E2E test approval" --output ${approvalPath}`,
      {
        encoding: "utf-8",
        cwd: testDir,
      }
    );

    expect(output).toContain("Approval recorded");
    expect(fs.existsSync(approvalPath)).toBe(true);

    const approval = JSON.parse(fs.readFileSync(approvalPath, "utf-8"));
    expect(approval.decision).toBe("approved");
    expect(approval.reason).toBe("E2E test approval");
  });

  it("should create rejection artifact", () => {
    const rejectionPath = path.join(testDir, "rejection.json");
    const output = execSync(
      `node ${cliPath} reject --reason "E2E test rejection" --output ${rejectionPath}`,
      {
        encoding: "utf-8",
        cwd: testDir,
      }
    );

    expect(output).toContain("Rejection recorded");
    expect(fs.existsSync(rejectionPath)).toBe(true);

    const rejection = JSON.parse(fs.readFileSync(rejectionPath, "utf-8"));
    expect(rejection.decision).toBe("rejected");
    expect(rejection.reason).toBe("E2E test rejection");
  });

  it("should explain a decision", () => {
    const output = execSync(
      `node ${cliPath} explain --contract ${contractPath} --eval ${evalPath} --signals ${signalsPath} --env production --verbose`,
      {
        encoding: "utf-8",
        cwd: testDir,
      }
    );

    expect(output).toContain("Contract Evaluation Explanation");
    expect(output).toContain("e2e-test-contract");
    expect(output).toContain("Signals:");
  });

  it("should output JSON format", () => {
    const output = execSync(
      `node ${cliPath} check --contract ${contractPath} --eval ${evalPath} --json`,
      {
        encoding: "utf-8",
        cwd: testDir,
      }
    );

    const decision = JSON.parse(output);
    expect(decision.status).toBeDefined();
    expect(["PASS", "BLOCK", "REQUIRES_APPROVAL"]).toContain(decision.status);
  });
});
