/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Example 2: Safety and Compliance Monitoring
 *
 * This example demonstrates:
 * 1. Loading a safety/compliance contract
 * 2. Parsing safety eval results from JSON and CSV
 * 3. Evaluating safety metrics with zero-tolerance rules
 * 4. Comparing with baseline to detect safety regressions
 */

import {
  parseContractFromYaml,
  parseEvalFile,
  evaluate,
  formatDecision,
  diffEvalResults,
  type NormalizedEvalResult,
} from "@geval-labs/core";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const exampleDir = __dirname;

async function main() {
  console.log("🛡️  Example 2: Safety and Compliance Monitoring\n");
  console.log("=".repeat(60) + "\n");

  // Step 1: Load the contract
  console.log("📄 Step 1: Loading safety contract...");
  const contractYaml = readFileSync(join(exampleDir, "contract.yaml"), "utf-8");
  const contract = parseContractFromYaml(contractYaml);
  console.log(`   Contract: ${contract.name}`);
  console.log(`   Environment: ${contract.environment}`);
  console.log(`   Compliance: ${contract.metadata?.compliance_standard || "N/A"}`);
  console.log(
    `   Required evals: ${contract.requiredEvals.map((e) => e.name).join(", ")}\n`
  );

  // Step 2: Test with passing JSON results
  console.log("📊 Step 2: Testing with passing safety results...");
  const passingJson = readFileSync(
    join(exampleDir, "eval-results/passing.json"),
    "utf-8"
  );
  const passingResult = parseEvalFile(passingJson, "eval-results/passing.json", contract);

  console.log(`   Eval: ${passingResult.evalName}`);
  console.log(`   Run ID: ${passingResult.runId}`);
  console.log("   Metrics:");
  for (const [key, value] of Object.entries(passingResult.metrics)) {
    if (typeof value === "number") {
      console.log(`     ${key}: ${value < 0.01 ? value.toFixed(6) : value.toFixed(4)}`);
    } else {
      console.log(`     ${key}: ${value}`);
    }
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
  console.log("📊 Step 3: Testing with failing safety results...");
  const failingJson = readFileSync(
    join(exampleDir, "eval-results/failing.json"),
    "utf-8"
  );
  const failingResult = parseEvalFile(failingJson, "eval-results/failing.json", contract);

  console.log(`   Eval: ${failingResult.evalName}`);
  console.log(`   Run ID: ${failingResult.runId}`);
  console.log("   Metrics:");
  for (const [key, value] of Object.entries(failingResult.metrics)) {
    if (typeof value === "number") {
      console.log(`     ${key}: ${value < 0.01 ? value.toFixed(6) : value.toFixed(4)}`);
    } else {
      console.log(`     ${key}: ${value}`);
    }
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
  console.log("📊 Step 4: Testing with CSV safety eval data...");
  const csvContent = readFileSync(
    join(exampleDir, "eval-results/safety-eval-data.csv"),
    "utf-8"
  );
  const csvResult = parseEvalFile(
    csvContent,
    "eval-results/safety-eval-data.csv",
    contract
  );

  console.log(`   Eval: ${csvResult.evalName}`);
  console.log(`   Run ID: ${csvResult.runId}`);
  console.log("   Metrics (aggregated from CSV):");
  for (const [key, value] of Object.entries(csvResult.metrics)) {
    if (typeof value === "number") {
      console.log(`     ${key}: ${value < 0.01 ? value.toFixed(6) : value.toFixed(4)}`);
    } else {
      console.log(`     ${key}: ${value}`);
    }
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

  // Step 5: Compare runs with baseline to detect safety regressions
  console.log("📈 Step 5: Comparing runs with baseline (safety regression detection)...");
  const diff = diffEvalResults([passingResult], [failingResult]);
  console.log("   Changes from baseline:");
  console.log(`     Improved: ${diff.stats.improved}`);
  console.log(`     Regressed: ${diff.stats.regressed}`);
  console.log(`     Unchanged: ${diff.stats.unchanged}`);
  console.log(`     New: ${diff.stats.new}`);
  console.log();

  // Show specific metric changes
  const firstDiff = diff.diffs[0];
  if (firstDiff && firstDiff.metrics.length > 0) {
    console.log("   Key metric changes:");
    for (const metricDiff of firstDiff.metrics.slice(0, 5)) {
      // Use delta if available, otherwise calculate it
      const change =
        metricDiff.delta !== undefined
          ? metricDiff.delta
          : metricDiff.current !== undefined && metricDiff.previous !== undefined
            ? (metricDiff.current as number) - (metricDiff.previous as number)
            : null;
      const changeStr =
        change !== null ? ` (${change > 0 ? "+" : ""}${change.toFixed(4)})` : "";
      console.log(
        `     ${metricDiff.metric}: ${metricDiff.previous ?? "N/A"} → ${metricDiff.current ?? "N/A"}${changeStr}`
      );
    }
    console.log();
  }

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

  console.log("=".repeat(60));
  console.log("✅ Example 2 completed successfully!");
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  console.error(error.stack);
  process.exit(1);
});
