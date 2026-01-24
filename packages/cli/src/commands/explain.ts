import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import {
  parseContract,
  parseContractFromYaml,
  evaluate,
  parseEvalResult,
  formatDecision,
  formatViolation,
  type NormalizedEvalResult,
  type BaselineData,
} from "@geval/core";

interface ExplainOptions {
  contract: string;
  eval: string[];
  baseline?: string;
  verbose?: boolean;
  color?: boolean;
}

/**
 * Explain command implementation
 */
export async function explainCommand(options: ExplainOptions): Promise<void> {
  const useColor = options.color !== false;

  try {
    // Load and parse contract
    const contract = loadContract(options.contract);

    // Load and parse eval results
    const evalResults = loadEvalResults(options.eval);

    // Load baselines if provided
    const baselines = options.baseline
      ? loadBaselines(options.baseline)
      : {};

    // Run evaluation
    const decision = evaluate({
      contract,
      evalResults,
      baselines,
    });

    // Print detailed explanation
    printExplanation(decision, contract, evalResults, baselines, {
      verbose: options.verbose ?? false,
      useColor,
    });

    // Exit code based on decision
    process.exit(decision.status === "PASS" ? 0 : 1);
  } catch (error) {
    handleError(error, useColor);
  }
}

/**
 * Load and parse a contract file
 */
function loadContract(contractPath: string) {
  const resolvedPath = path.resolve(contractPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Contract file not found: ${contractPath}`);
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");
  const ext = path.extname(resolvedPath).toLowerCase();

  if (ext === ".yaml" || ext === ".yml") {
    return parseContractFromYaml(content);
  } else {
    const data = JSON.parse(content);
    return parseContract(data);
  }
}

/**
 * Load and parse eval result files
 */
function loadEvalResults(evalPaths: string[]): NormalizedEvalResult[] {
  const results: NormalizedEvalResult[] = [];

  for (const evalPath of evalPaths) {
    const resolvedPath = path.resolve(evalPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Eval file not found: ${evalPath}`);
    }

    const content = fs.readFileSync(resolvedPath, "utf-8");
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      for (const item of data) {
        results.push(parseEvalResult(item));
      }
    } else {
      results.push(parseEvalResult(data));
    }
  }

  return results;
}

/**
 * Load baseline data
 */
function loadBaselines(baselinePath: string): Record<string, BaselineData> {
  const resolvedPath = path.resolve(baselinePath);

  if (!fs.existsSync(resolvedPath)) {
    return {};
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");
  const data = JSON.parse(content);
  const baselines: Record<string, BaselineData> = {};

  const baselineResults: NormalizedEvalResult[] = Array.isArray(data)
    ? data.map(parseEvalResult)
    : [parseEvalResult(data)];

  for (const result of baselineResults) {
    baselines[result.evalName] = {
      type: "previous",
      metrics: result.metrics,
      source: {
        runId: result.runId,
        timestamp: result.timestamp,
      },
    };
  }

  return baselines;
}

/**
 * Print detailed explanation
 */
function printExplanation(
  decision: ReturnType<typeof evaluate>,
  contract: ReturnType<typeof parseContract>,
  evalResults: NormalizedEvalResult[],
  baselines: Record<string, BaselineData>,
  options: { verbose: boolean; useColor: boolean }
): void {
  const { verbose, useColor } = options;

  // Header
  console.log(
    useColor ? pc.bold("\n📋 Contract Evaluation Explanation\n") : "\nContract Evaluation Explanation\n"
  );

  // Contract summary
  console.log(useColor ? pc.bold("Contract:") : "Contract:");
  console.log(`  Name: ${contract.name}`);
  console.log(`  Environment: ${contract.environment}`);
  console.log(`  Required Evals: ${contract.requiredEvals.length}`);
  console.log("");

  // Eval results summary
  console.log(useColor ? pc.bold("Eval Results:") : "Eval Results:");
  for (const result of evalResults) {
    console.log(`  ${result.evalName}:`);
    const metricCount = Object.keys(result.metrics).length;
    console.log(`    Metrics: ${metricCount}`);
    if (verbose) {
      for (const [metric, value] of Object.entries(result.metrics)) {
        console.log(`    - ${metric}: ${value}`);
      }
    }
  }
  console.log("");

  // Baseline summary
  if (Object.keys(baselines).length > 0) {
    console.log(useColor ? pc.bold("Baselines:") : "Baselines:");
    for (const [name, baseline] of Object.entries(baselines)) {
      console.log(`  ${name}: ${baseline.type}`);
      if (baseline.source?.commit) {
        console.log(`    Commit: ${baseline.source.commit}`);
      }
    }
    console.log("");
  }

  // Decision
  console.log(useColor ? pc.bold("Decision:") : "Decision:");
  const formatted = formatDecision(decision, {
    colors: useColor,
    verbose: true,
    timestamps: true,
  });
  console.log(formatted);

  // Rule-by-rule explanation
  if (verbose) {
    console.log("");
    console.log(
      useColor ? pc.bold("Rule-by-Rule Analysis:") : "Rule-by-Rule Analysis:"
    );
    console.log("");

    for (const reqEval of contract.requiredEvals) {
      console.log(`  ${useColor ? pc.bold(reqEval.name) : reqEval.name}:`);

      const evalResult = evalResults.find((r) => r.evalName === reqEval.name);
      const baseline = baselines[reqEval.name];

      for (const rule of reqEval.rules) {
        const actualValue = evalResult?.metrics[rule.metric];
        const baselineValue = baseline?.metrics[rule.metric];

        // Check if this rule was violated
        const violation =
          decision.status !== "PASS" && "violations" in decision
            ? decision.violations.find(
                (v) =>
                  v.evalName === reqEval.name && v.rule.metric === rule.metric
              )
            : undefined;

        const status = violation
          ? useColor
            ? pc.red("✗ FAIL")
            : "✗ FAIL"
          : useColor
            ? pc.green("✓ PASS")
            : "✓ PASS";

        console.log(`    ${status} ${rule.metric}`);
        console.log(`      Operator: ${rule.operator}`);
        console.log(`      Baseline: ${rule.baseline}`);
        if (rule.maxDelta !== undefined) {
          console.log(`      Max Delta: ${rule.maxDelta}`);
        }
        if (rule.threshold !== undefined) {
          console.log(`      Threshold: ${rule.threshold}`);
        }
        console.log(`      Actual: ${actualValue ?? "N/A"}`);
        if (baselineValue !== undefined) {
          console.log(`      Baseline Value: ${baselineValue}`);
        }
        if (violation) {
          console.log(
            `      ${useColor ? pc.yellow("Reason:") : "Reason:"} ${violation.explanation}`
          );
        }
        console.log("");
      }
    }
  }
}

/**
 * Handle errors consistently
 */
function handleError(error: unknown, useColor: boolean): never {
  const message =
    error instanceof Error ? error.message : "An unknown error occurred";

  console.error(
    useColor ? pc.red(`Error: ${message}`) : `Error: ${message}`
  );

  process.exit(3);
}
