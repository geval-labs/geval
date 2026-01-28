/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 3: Multi-Eval Comparison
 * 
 * This example demonstrates:
 * 1. Loading a contract with multiple required evals
 * 2. Parsing multiple eval results from JSON files
 * 3. Parsing multiple evals from a single CSV file
 * 4. Evaluating all evals together
 * 5. Comparing with baselines for each eval suite
 */

import {
  parseContractFromYaml,
  parseEvalFile,
  evaluate,
  formatDecision,
  diffEvalResults,
  type NormalizedEvalResult,
  type BaselineData,
  type MetricValue,
} from "@geval-labs/core";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const exampleDir = __dirname;

async function main() {
  console.log("🔀 Example 3: Multi-Eval Comparison\n");
  console.log("=" .repeat(60) + "\n");

  // Step 1: Load the contract
  console.log("📄 Step 1: Loading multi-eval contract...");
  const contractYaml = readFileSync(
    join(exampleDir, "contract.yaml"),
    "utf-8"
  );
  const contract = parseContractFromYaml(contractYaml);
  console.log(`   Contract: ${contract.name}`);
  console.log(`   Environment: ${contract.environment}`);
  console.log(`   Required evals: ${contract.requiredEvals.length}`);
  for (const evalReq of contract.requiredEvals) {
    console.log(`     - ${evalReq.name}: ${evalReq.rules.length} rule(s)`);
  }
  console.log();

  // Step 2: Load all current eval results from JSON files
  console.log("📊 Step 2: Loading current eval results from JSON files...");
  const evalResults: NormalizedEvalResult[] = [];
  const evalFiles = [
    "accuracy-suite.json",
    "performance-suite.json",
    "cost-suite.json",
    "user-experience-suite.json",
  ];

  for (const filename of evalFiles) {
    const filePath = join(exampleDir, "eval-results", filename);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf-8");
      const result = parseEvalFile(content, filePath, contract);
      evalResults.push(result);
      console.log(`   ✓ Loaded ${result.evalName}: ${Object.keys(result.metrics).length} metric(s)`);
    }
  }
  console.log();

  // Step 3: Evaluate all evals together
  console.log("⚙️ Step 3: Evaluating all evals together...");
  const decision = evaluate({
    contract,
    evalResults,
    baselines: {},
  });

  console.log("   Result:");
  console.log(formatDecision(decision, { colors: true, verbose: true }));
  console.log();

  // Step 4: Load baselines and compare
  console.log("📈 Step 4: Loading baselines and comparing...");
  const baselineResults: NormalizedEvalResult[] = [];
  const baselineFiles = [
    "baseline-accuracy-suite.json",
    "baseline-performance-suite.json",
    "baseline-cost-suite.json",
    "baseline-user-experience-suite.json",
  ];

  for (const filename of baselineFiles) {
    const filePath = join(exampleDir, "eval-results", filename);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf-8");
      const result = parseEvalFile(content, filePath, contract);
      baselineResults.push(result);
    }
  }

  if (baselineResults.length > 0) {
    const diff = diffEvalResults(baselineResults, evalResults);
    console.log("   Changes from baseline:");
    console.log(`     Improved: ${diff.stats.improved}`);
    console.log(`     Regressed: ${diff.stats.regressed}`);
    console.log(`     Unchanged: ${diff.stats.unchanged}`);
    console.log(`     New: ${diff.stats.new}`);
    console.log();

    // Build baselines map
    const baselines: Record<string, BaselineData> = {};
    for (const baseline of baselineResults) {
      baselines[baseline.evalName] = {
        type: "previous",
        metrics: baseline.metrics,
        source: { runId: baseline.runId },
      };
    }

    // Evaluate with baselines
    const decisionWithBaseline = evaluate({
      contract,
      evalResults,
      baselines,
    });

    console.log("   Result with baseline comparison:");
    console.log(formatDecision(decisionWithBaseline, { colors: true, verbose: true }));
    console.log();
  }

  // Step 5: Test with CSV containing multiple evals
  console.log("📊 Step 5: Testing with CSV containing multiple evals...");
  const csvContent = readFileSync(
    join(exampleDir, "eval-results/multi-eval-data.csv"),
    "utf-8"
  );

  // Note: When a CSV contains multiple eval suites (different eval_suite values),
  // you need to split the CSV by eval_suite and parse each group separately.
  // The current parseEvalFile aggregates all rows into a single eval result.
  
  console.log("   Note: CSV with multiple eval suites requires splitting by eval_suite");
  console.log("   For this example, we'll demonstrate parsing a single eval suite from CSV");
  console.log();

  // Example: Parse only accuracy-suite rows from CSV
  // In practice, you'd filter the CSV rows by eval_suite before parsing
  const csvLines = csvContent.split("\n");
  const accuracySuiteRows = csvLines.filter((line, index) => 
    index === 0 || line.startsWith("accuracy-suite")
  );
  const accuracyCsvContent = accuracySuiteRows.join("\n");

  try {
    const csvResult = parseEvalFile(
      accuracyCsvContent,
      "eval-results/accuracy-suite.csv",
      contract
    );
    console.log(`   Parsed CSV eval: ${csvResult.evalName}`);
    console.log(`   Metrics: ${Object.keys(csvResult.metrics).join(", ")}`);
    const accuracyValue = csvResult.metrics.accuracy;
    if (typeof accuracyValue === "number") {
      console.log(`   Accuracy: ${accuracyValue.toFixed(4)}`);
    } else {
      console.log(`   Accuracy: ${accuracyValue}`);
    }
    console.log();
  } catch (error) {
    console.log(`   Note: ${(error as Error).message}`);
    console.log();
  }

  console.log("   Tip: For multiple eval suites in CSV, split by eval_suite column");
  console.log("   and parse each group separately, or use separate CSV files per suite.");
  console.log();

  // Step 6: Summary
  console.log("=" .repeat(60));
  console.log("📋 Summary:");
  console.log(`   - Contract: ${contract.name}`);
  console.log(`   - Required evals: ${contract.requiredEvals.length}`);
  console.log(`   - Current evals loaded: ${evalResults.length}`);
  console.log(`   - Baselines loaded: ${baselineResults.length}`);
  console.log(`   - Final decision: ${decision.status}`);
  console.log();
  console.log("✅ Example 3 completed successfully!");
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  console.error(error.stack);
  process.exit(1);
});
