/**
 * Example: Full CI Integration
 * 
 * This demonstrates a complete CI workflow:
 * 1. Load contract
 * 2. Parse eval results (JSON or CSV)
 * 3. Compare with baseline (if available)
 * 4. Make decision
 * 5. Output for CI consumption
 */

import {
  parseContractFromYaml,
  GenericAdapter,
  evaluate,
  formatDecision,
  diffEvalResults,
  type Decision,
  type NormalizedEvalResult,
} from "@geval-labs/core";
import { readFileSync, existsSync, appendFileSync } from "fs";
import { join } from "path";

const exampleDir = join(__dirname, "..");

// Configuration (in real CI, these would be environment variables or arguments)
const config = {
  contractPath: join(exampleDir, "contracts/quality-contract.yaml"),
  currentEvalPath: join(exampleDir, "eval-results/passing-run.json"),
  baselineEvalPath: join(exampleDir, "eval-results/failing-run.json"), // Previous run
  outputFormat: "text" as "text" | "json",
};

async function main() {
  console.log("🚀 Geval CI Integration\n");
  console.log("=" .repeat(60) + "\n");

  // Step 1: Load contract
  console.log("📄 Step 1: Loading contract...");
  const contract = parseContractFromYaml(
    readFileSync(config.contractPath, "utf-8")
  );
  console.log(`   Contract: ${contract.name}`);
  console.log(`   Version: ${contract.version}`);
  console.log(`   Environment: ${contract.environment}\n`);

  // Step 2: Parse current eval results
  console.log("📊 Step 2: Parsing current eval results...");
  const adapter = new GenericAdapter();
  const currentEval = adapter.parse(
    JSON.parse(readFileSync(config.currentEvalPath, "utf-8"))
  );
  console.log(`   Eval: ${currentEval.evalName}`);
  console.log(`   Run ID: ${currentEval.runId}`);
  console.log(`   Metrics: ${Object.keys(currentEval.metrics).length} metrics\n`);

  // Step 3: Load baseline (if exists)
  let baselineEval: NormalizedEvalResult | undefined;
  if (existsSync(config.baselineEvalPath)) {
    console.log("📈 Step 3: Loading baseline for comparison...");
    baselineEval = adapter.parse(
      JSON.parse(readFileSync(config.baselineEvalPath, "utf-8"))
    );
    console.log(`   Baseline Run ID: ${baselineEval.runId}\n`);

    // Show diff
    const diff = diffEvalResults([baselineEval], [currentEval]);
    console.log("   Changes from baseline:");
    console.log(`     Improved: ${diff.stats.improved}`);
    console.log(`     Regressed: ${diff.stats.regressed}`);
    console.log(`     Unchanged: ${diff.stats.unchanged}`);
    console.log(`     New: ${diff.stats.new}\n`);
  } else {
    console.log("📈 Step 3: No baseline available (first run)\n");
  }

  // Step 4: Evaluate
  console.log("⚙️ Step 4: Running evaluation...");
  const decision = evaluate({
    contract,
    evalResults: [currentEval],
    baselines: baselineEval
      ? {
          [baselineEval.evalName]: {
            type: "previous",
            metrics: baselineEval.metrics,
            source: { runId: baselineEval.runId },
          },
        }
      : {},
  });

  // Step 5: Output result
  console.log("\n" + "=" .repeat(60));
  console.log("📋 DECISION\n");

  if (config.outputFormat === "json") {
    console.log(JSON.stringify(decision, null, 2));
  } else {
    console.log(formatDecision(decision, { colors: true, verbose: true }));
  }

  console.log("=" .repeat(60) + "\n");

  // Step 6: Generate CI-friendly output
  outputCIResults(decision);

  // Exit with appropriate code
  const exitCode = getExitCode(decision);
  console.log(`\n🏁 Exit code: ${exitCode}`);
  process.exit(exitCode);
}

function outputCIResults(decision: Decision) {
  // GitHub Actions output
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `status=${decision.status}\n`
    );
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `summary=${decision.summary}\n`
    );
  }

  // GitLab CI output
  if (process.env.CI_JOB_NAME) {
    console.log(`\n[GitLab] Decision: ${decision.status}`);
    console.log(`[GitLab] Summary: ${decision.summary}`);
  }

  // Generic CI output
  console.log("\n📤 CI Output Variables:");
  console.log(`   GEVAL_STATUS=${decision.status}`);
  console.log(`   GEVAL_SUMMARY="${decision.summary}"`);
  console.log(`   GEVAL_CONTRACT=${decision.contractName}`);
}

function getExitCode(decision: Decision): number {
  switch (decision.status) {
    case "PASS":
      return 0;
    case "BLOCK":
      return 1;
    case "REQUIRES_APPROVAL":
      return 2;
    default:
      return 3;
  }
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(3);
});
