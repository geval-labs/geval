/**
 * Example: Parsing CSV eval results and running Geval check
 *
 * This demonstrates:
 * 1. Loading a CSV file (e.g., from LangSmith)
 * 2. Defining how to extract metrics
 * 3. Running evaluation against a contract
 */

import {
  parseContractFromYaml,
  parseEvalSource,
  evaluate,
  formatDecision,
  type EvalSourceConfig,
} from "@geval-labs/core";
import { readFileSync } from "fs";
import { join } from "path";

const exampleDir = join(__dirname, "..");

// Step 1: Load the contract
console.log("📄 Loading contract...\n");
const contractYaml = readFileSync(
  join(exampleDir, "contracts/quality-contract.yaml"),
  "utf-8"
);
const contract = parseContractFromYaml(contractYaml);
console.log(`Contract: ${contract.name}`);
console.log(`Environment: ${contract.environment}`);
console.log(`Required evals: ${contract.requiredEvals.map((e) => e.name).join(", ")}\n`);

// Step 2: Load and parse the CSV
console.log("📊 Parsing CSV eval results...\n");
const csvContent = readFileSync(
  join(exampleDir, "eval-results/langsmith-export.csv"),
  "utf-8"
);

// Define how to extract metrics from the CSV
const sourceConfig: EvalSourceConfig = {
  type: "csv",
  metrics: [
    { column: "accuracy", aggregate: "avg" },
    { column: "quality_score", aggregate: "avg" },
    { column: "latency", aggregate: "p95", as: "latency_p95" },
    { column: "status", aggregate: "pass_rate" },
    // For hallucination_rate, we need to invert pass_rate
    // (true = hallucination = bad, so we use fail_rate conceptually)
    // But since the column has true/false, pass_rate will count "true" as pass
    // So hallucination_rate = pass_rate of hallucination_detected column
    {
      column: "hallucination_detected",
      aggregate: "pass_rate",
      as: "hallucination_rate",
    },
  ],
  evalName: { fixed: "quality-metrics" },
};

const evalResult = parseEvalSource(csvContent, sourceConfig);

console.log("Parsed eval result:");
console.log(`  Eval Name: ${evalResult.evalName}`);
console.log(`  Run ID: ${evalResult.runId}`);
console.log("  Metrics:");
for (const [key, value] of Object.entries(evalResult.metrics)) {
  console.log(`    ${key}: ${typeof value === "number" ? value.toFixed(4) : value}`);
}
console.log();

// Step 3: Evaluate against the contract
console.log("⚙️ Evaluating against contract...\n");
const decision = evaluate({
  contract,
  evalResults: [evalResult],
  baselines: {},
});

// Step 4: Display the result
console.log("=".repeat(60));
console.log(formatDecision(decision, { colors: true, verbose: true }));
console.log("=".repeat(60));

// Step 5: Exit with appropriate code
console.log(`\nExit code: ${decision.status === "PASS" ? 0 : 1}`);
process.exit(decision.status === "PASS" ? 0 : 1);
