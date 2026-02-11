import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("CLI Integration Tests", () => {
  let testDir: string;
  let cliPath: string;

  beforeAll(() => {
    // Create temp directory for test files
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "geval-cli-test-"));
    cliPath = path.resolve(__dirname, "../../dist/cli.js");

    // Create test contract
    const contract = `
version: 1
name: test-contract
requiredEvals:
  - name: quality-metrics
    rules:
      - metric: accuracy
        operator: ">="
        baseline: fixed
        threshold: 0.8
      - metric: latency
        operator: "<="
        baseline: fixed
        threshold: 200
onViolation:
  action: block
`;
    fs.writeFileSync(path.join(testDir, "contract.yaml"), contract);

    // Create contract with CSV source config
    const contractWithCsv = `
version: 1
name: csv-contract
sources:
  csv:
    metrics:
      - column: accuracy
        aggregate: avg
      - column: latency
        aggregate: p95
    evalName:
      fixed: quality-metrics
requiredEvals:
  - name: quality-metrics
    rules:
      - metric: accuracy
        operator: ">="
        baseline: fixed
        threshold: 0.8
onViolation:
  action: block
`;
    fs.writeFileSync(path.join(testDir, "contract-csv.yaml"), contractWithCsv);

    // Create passing eval result
    const passingEval = {
      evalName: "quality-metrics",
      runId: "run-pass-1",
      metrics: { accuracy: 0.92, latency: 150 },
    };
    fs.writeFileSync(
      path.join(testDir, "passing.json"),
      JSON.stringify(passingEval, null, 2)
    );

    // Create failing eval result
    const failingEval = {
      evalName: "quality-metrics",
      runId: "run-fail-1",
      metrics: { accuracy: 0.65, latency: 300 },
    };
    fs.writeFileSync(
      path.join(testDir, "failing.json"),
      JSON.stringify(failingEval, null, 2)
    );

    // Create CSV eval result
    const csvEval = `id,accuracy,latency,status
1,0.90,100,pass
2,0.88,150,pass
3,0.85,120,pass`;
    fs.writeFileSync(path.join(testDir, "eval.csv"), csvEval);

    // Create baseline
    const baseline = {
      evalName: "quality-metrics",
      runId: "baseline-1",
      metrics: { accuracy: 0.85, latency: 180 },
    };
    fs.writeFileSync(
      path.join(testDir, "baseline.json"),
      JSON.stringify(baseline, null, 2)
    );
  });

  afterAll(() => {
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  const runCli = (args: string): { stdout: string; stderr: string; exitCode: number } => {
    try {
      const stdout = execSync(`node ${cliPath} ${args}`, {
        cwd: testDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: err.stdout || "",
        stderr: err.stderr || "",
        exitCode: err.status || 1,
      };
    }
  };

  describe("check command", () => {
    it("passes for good eval results", () => {
      const result = runCli("check --contract contract.yaml --eval passing.json");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("PASS");
    });

    it("fails for bad eval results", () => {
      const result = runCli("check --contract contract.yaml --eval failing.json");
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("BLOCK");
    });

    it("parses CSV with source config", () => {
      const result = runCli("check --contract contract-csv.yaml --eval eval.csv");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("PASS");
    });

    it("outputs JSON when --json flag is set", () => {
      const result = runCli("check --contract contract.yaml --eval passing.json --json");
      expect(result.exitCode).toBe(0);
      const json = JSON.parse(result.stdout);
      expect(json.status).toBe("PASS");
      expect(json.contractName).toBe("test-contract");
    });

    it("includes violations in JSON output", () => {
      const result = runCli("check --contract contract.yaml --eval failing.json --json");
      expect(result.exitCode).toBe(1);
      const json = JSON.parse(result.stdout);
      expect(json.status).toBe("BLOCK");
      expect(json.violations).toHaveLength(2);
    });

    it("handles multiple eval files", () => {
      const result = runCli(
        "check --contract contract.yaml --eval passing.json --eval passing.json"
      );
      expect(result.exitCode).toBe(0);
    });

    it("fails when contract file not found", () => {
      const result = runCli("check --contract nonexistent.yaml --eval passing.json");
      expect(result.exitCode).toBe(3);
      expect(result.stderr || result.stdout).toContain("not found");
    });

    it("fails when eval file not found", () => {
      const result = runCli("check --contract contract.yaml --eval nonexistent.json");
      expect(result.exitCode).toBe(3);
      expect(result.stderr || result.stdout).toContain("not found");
    });

    it("fails for CSV without source config", () => {
      const result = runCli("check --contract contract.yaml --eval eval.csv");
      expect(result.exitCode).toBe(3);
      expect(result.stderr || result.stdout).toContain("source config");
    });

    it("supports --adapter flag", () => {
      const result = runCli(
        "check --contract contract.yaml --eval passing.json --adapter generic"
      );
      expect(result.exitCode).toBe(0);
    });

    it("supports baseline comparison", () => {
      const result = runCli(
        "check --contract contract.yaml --eval passing.json --baseline baseline.json"
      );
      expect(result.exitCode).toBe(0);
    });
  });

  describe("validate command", () => {
    it("validates correct contract", () => {
      const result = runCli("validate contract.yaml");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("valid");
    });

    it("fails on invalid contract", () => {
      // Create invalid contract
      fs.writeFileSync(path.join(testDir, "invalid.yaml"), "version: 99\nname: test");
      const result = runCli("validate invalid.yaml");
      expect(result.exitCode).not.toBe(0);
    });

    it("outputs JSON when --json flag is set", () => {
      const result = runCli("validate contract.yaml --json");
      expect(result.exitCode).toBe(0);
      const json = JSON.parse(result.stdout);
      expect(json.valid).toBe(true);
    });
  });

  describe("explain command", () => {
    it("explains a passing eval", () => {
      const result = runCli("explain --contract contract.yaml --eval passing.json");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("PASS");
    });

    it("explains a failing eval", () => {
      const result = runCli("explain --contract contract.yaml --eval failing.json");
      // explain exits with decision's exit code (1 for BLOCK)
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("BLOCK");
      expect(result.stdout).toContain("accuracy");
    });
  });

  describe("diff command", () => {
    it("shows differences between eval results", () => {
      const result = runCli("diff --previous baseline.json --current passing.json");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("accuracy");
    });

    it("shows differences in JSON format", () => {
      const result = runCli(
        "diff --previous baseline.json --current passing.json --json"
      );
      expect(result.exitCode).toBe(0);
      const json = JSON.parse(result.stdout);
      // Diff returns object with diffs array
      expect(json.diffs).toBeDefined();
    });
  });

  describe("help and version", () => {
    it("shows help", () => {
      const result = runCli("--help");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("geval");
      expect(result.stdout).toContain("check");
    });

    it("shows version", () => {
      const result = runCli("--version");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });
});
