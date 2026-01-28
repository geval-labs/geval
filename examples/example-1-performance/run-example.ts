/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 1: Performance Monitoring
 * 
 * This example demonstrates:
 * 1. Loading a performance contract
 * 2. Parsing eval results from JSON and CSV
 * 3. Evaluating performance metrics against the contract
 * 4. Comparing with baseline (previous run)
 */

import {
  parseContractFromYaml,
  parseEvalFile,
  evaluate,
  formatDecision,
  diffEvalResults,
  type NormalizedEvalResult,
} from "@geval-labs/core";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const exampleDir = __dirname;

async function main() {
  console.log("🚀 Example 1: Performance Monitoring\n");
  console.log("=" .repeat(60) + "\n");

  // Step 1: Load the contract
  console.log("📄 Step 1: Loading contract...");
  const contractYaml = readFileSync(
    join(exampleDir, "contract.yaml"),
    "utf-8"
  );
  const contract = parseContractFromYaml(contractYaml);
  console.log(`   Contract: ${contract.name}`);
  console.log(`   Environment: ${contract.environment}`);
  console.log(`   Required evals: ${contract.requiredEvals.map((e) => e.name).join(", ")}\n`);

  // Step 2: Test with passing JSON results
  console.log("📊 Step 2: Testing with passing JSON results...");
  const passingJson = readFileSync(
    join(exampleDir, "eval-results/passing.json"),
    "utf-8"
  );
  const passingResult = parseEvalFile(
    passingJson,
    "eval-results/passing.json",
    contract
  );
  
  console.log(`   Eval: ${passingResult.evalName}`);
  console.log(`   Run ID: ${passingResult.runId}`);
  console.log("   Metrics:");
  for (const [key, value] of Object.entries(passingResult.metrics)) {
    console.log(`     ${key}: ${typeof value === "number" ? value.toFixed(4) : value}`);
  }
  console.log();

  // Evaluate passing results
  const passingDecision = evaluate({
    contract,
    evalResults: [passingResult],
    baselines: {},
  });

  console.log("   Result:");
  console.log(formatDecision(passingDecision, { colors: true, verbose: false }));
  console.log();

  // Step 3: Test with failing JSON results
  console.log("📊 Step 3: Testing with failing JSON results...");
  const failingJson = readFileSync(
    join(exampleDir, "eval-results/failing.json"),
    "utf-8"
  );
  const failingResult = parseEvalFile(
    failingJson,
    "eval-results/failing.json",
    contract
  );

  console.log(`   Eval: ${failingResult.evalName}`);
  console.log(`   Run ID: ${failingResult.runId}`);
  console.log("   Metrics:");
  for (const [key, value] of Object.entries(failingResult.metrics)) {
    console.log(`     ${key}: ${typeof value === "number" ? value.toFixed(4) : value}`);
  }
  console.log();

  // Evaluate failing results
  const failingDecision = evaluate({
    contract,
    evalResults: [failingResult],
    baselines: {},
  });

  console.log("   Result:");
  console.log(formatDecision(failingDecision, { colors: true, verbose: true }));
  console.log();

  // Step 4: Test with CSV results
  console.log("📊 Step 4: Testing with CSV results...");
  const csvContent = readFileSync(
    join(exampleDir, "eval-results/performance-data.csv"),
    "utf-8"
  );
  const csvResult = parseEvalFile(
    csvContent,
    "eval-results/performance-data.csv",
    contract
  );

  console.log(`   Eval: ${csvResult.evalName}`);
  console.log(`   Run ID: ${csvResult.runId}`);
  console.log("   Metrics (aggregated from CSV):");
  for (const [key, value] of Object.entries(csvResult.metrics)) {
    console.log(`     ${key}: ${typeof value === "number" ? value.toFixed(4) : value}`);
  }
  console.log();

  // Evaluate CSV results
  const csvDecision = evaluate({
    contract,
    evalResults: [csvResult],
    baselines: {},
  });

  console.log("   Result:");
  console.log(formatDecision(csvDecision, { colors: true, verbose: false }));
  console.log();

  // Step 5: Compare runs with baseline
  console.log("📈 Step 5: Comparing runs with baseline...");
  const diff = diffEvalResults([passingResult], [failingResult]);
  console.log("   Changes from baseline:");
  console.log(`     Improved: ${diff.stats.improved}`);
  console.log(`     Regressed: ${diff.stats.regressed}`);
  console.log(`     Unchanged: ${diff.stats.unchanged}`);
  console.log(`     New: ${diff.stats.new}`);
  console.log();

  // Evaluate with baseline
  const decisionWithBaseline = evaluate({
    contract,
    evalResults: [failingResult],
    baselines: {
      [passingResult.evalName]: {
        type: "previous",
        metrics: passingResult.metrics,
        source: { runId: passingResult.runId },
      },
    },
  });

  console.log("   Result with baseline comparison:");
  console.log(formatDecision(decisionWithBaseline, { colors: true, verbose: true }));
  console.log();

  console.log("=" .repeat(60));
  console.log("✅ Example 1 completed successfully!");
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  console.error(error.stack);
  process.exit(1);
});
