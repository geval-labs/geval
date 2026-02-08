import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import {
  parseContract,
  parseContractFromYaml,
  evaluate,
  parseEvalResult,
  parseEvalFile,
  detectFileType,
  parseSignals,
  formatDecision,
  type NormalizedEvalResult,
  type BaselineData,
  type EvalContract,
  type Signal,
  parseWithAdapter,
} from "@geval-labs/core";

interface ExplainOptions {
  contract: string;
  eval: string[];
  baseline?: string;
  signals?: string;
  adapter?: string;
  env?: string;
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

    // Load and parse eval results (reuse check command's loader)
    const evalResults = loadEvalResults(options.eval, contract, options.adapter);

    // Load baselines if provided
    const baselines = options.baseline
      ? loadBaselines(options.baseline, evalResults, contract)
      : {};

    // Load signals if provided
    let signals: Signal[] = [];
    if (options.signals) {
      const signalsContent = fs.readFileSync(options.signals, "utf-8");
      const signalsData = JSON.parse(signalsContent);
      const signalCollection = parseSignals(signalsData);
      signals = signalCollection.signals;
    }

    // Determine environment
    const environment = options.env || contract.environment || "production";

    // Run evaluation
    const decision = evaluate({
      contract,
      evalResults,
      baselines,
      signals,
      environment,
    });

    // Print detailed explanation
    printExplanation(decision, contract, evalResults, baselines, signals, {
      verbose: options.verbose ?? false,
      useColor,
      environment,
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
 * Supports JSON, CSV (with contract source config), and JSONL
 */
function loadEvalResults(
  evalPaths: string[],
  contract: EvalContract,
  adapterName?: string
): NormalizedEvalResult[] {
  const results: NormalizedEvalResult[] = [];

  for (const evalPath of evalPaths) {
    const resolvedPath = path.resolve(evalPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Eval file not found: ${evalPath}`);
    }

    const content = fs.readFileSync(resolvedPath, "utf-8");
    const fileType = detectFileType(resolvedPath, content);

    // Check if we need source config for this file
    if (fileType === "csv" || fileType === "jsonl") {
      // Use contract source config for CSV/JSONL files
      const sourceConfig = contract.sources?.[fileType];
      
      if (!sourceConfig) {
        throw new Error(
          `CSV/JSONL files require a source config in the contract. ` +
          `Add a "sources.${fileType}" section to define how to parse metrics.`
        );
      }

      const result = parseEvalFile(content, resolvedPath, contract);
      results.push(result);
    } else {
      // JSON file - try standard adapters first
      try {
        const data = JSON.parse(content);

        // Check if contract has JSON source config
        if (contract.sources?.json) {
          const result = parseEvalFile(content, resolvedPath, contract);
          results.push(result);
        } else {
          // Use standard adapter-based parsing
          const parseResult = adapterName
            ? (item: unknown) => parseWithAdapter(item, adapterName)
            : parseEvalResult;
          
          if (Array.isArray(data)) {
            for (const item of data) {
              results.push(parseResult(item));
            }
          } else {
            results.push(parseResult(data));
          }
        }
      } catch (e) {
        throw new Error(
          `Failed to parse eval file ${evalPath}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }
  }

  return results;
}

/**
 * Load baseline data
 */
function loadBaselines(
  baselinePath: string,
  currentResults: NormalizedEvalResult[],
  contract: EvalContract
): Record<string, BaselineData> {
  const resolvedPath = path.resolve(baselinePath);

  if (!fs.existsSync(resolvedPath)) {
    return {};
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");
  const fileType = detectFileType(resolvedPath, content);

  try {
    let baselineResults: NormalizedEvalResult[];

    // Check if baseline needs source config parsing
    if (fileType === "csv" || fileType === "jsonl" || contract.sources?.[fileType]) {
      const result = parseEvalFile(content, resolvedPath, contract);
      baselineResults = [result];
    } else {
      // Standard JSON parsing
      const data = JSON.parse(content);
      baselineResults = Array.isArray(data)
        ? data.map((d) => parseEvalResult(d))
        : [parseEvalResult(data)];
    }

    // Convert to baseline format keyed by eval name
    const baselines: Record<string, BaselineData> = {};
    for (const result of baselineResults) {
      baselines[result.evalName] = {
        type: "previous",
        metrics: result.metrics,
        source: {
          runId: result.runId,
          commit: result.metadata?.commit,
          timestamp: result.timestamp,
        },
      };
    }

    return baselines;
  } catch (e) {
    throw new Error(
      `Failed to parse baseline file: ${e instanceof Error ? e.message : "Unknown error"}`
    );
  }
}

/**
 * Print detailed explanation
 */
function printExplanation(
  decision: ReturnType<typeof evaluate>,
  contract: ReturnType<typeof parseContract>,
  evalResults: NormalizedEvalResult[],
  baselines: Record<string, BaselineData>,
  signals: Signal[],
  options: { verbose: boolean; useColor: boolean; environment: string }
): void {
  const { verbose, useColor, environment } = options;

  // Header
  console.log(
    useColor ? pc.bold("\n📋 Contract Evaluation Explanation\n") : "\nContract Evaluation Explanation\n"
  );

  // Contract summary
  console.log(useColor ? pc.bold("Contract:") : "Contract:");
  console.log(`  Name: ${contract.name}`);
  console.log(`  Environment: ${environment}`);
  if (contract.policy) {
    console.log(`  Type: Policy-based`);
    const envPolicy = contract.policy.environments?.[environment];
    const globalRules = contract.policy.rules || [];
    const envRules = envPolicy?.rules || [];
    console.log(`  Rules: ${globalRules.length + envRules.length} (${globalRules.length} global, ${envRules.length} environment-specific)`);
  } else if (contract.requiredEvals) {
    console.log(`  Type: Eval-based (legacy)`);
    console.log(`  Required Evals: ${contract.requiredEvals.length}`);
  }
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

  // Signals summary
  if (signals.length > 0) {
    console.log(useColor ? pc.bold("Signals:") : "Signals:");
    for (const signal of signals) {
      console.log(`  ${signal.name} (${signal.type}):`);
      if (verbose) {
        console.log(`    Value: ${JSON.stringify(signal.value)}`);
        if (signal.metadata) {
          console.log(`    Metadata: ${JSON.stringify(signal.metadata)}`);
        }
      }
    }
    console.log("");
  }

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

    // Policy-based contracts
    if (contract.policy) {
      const envPolicy = contract.policy.environments?.[environment];
      const globalRules = contract.policy.rules || [];
      const envRules = envPolicy?.rules || [];
      const allRules = [...globalRules, ...envRules];

      if (allRules.length > 0) {
        console.log(`  Policy Rules (${allRules.length}):`);
        for (let i = 0; i < allRules.length; i++) {
          const rule = allRules[i]!;
          const isMatched = decision.status !== "PASS" || i === 0; // Simplified check
          
          const status = isMatched && decision.status !== "PASS"
            ? useColor ? pc.red("✗ MATCHED") : "✗ MATCHED"
            : useColor ? pc.gray("○ NOT MATCHED") : "○ NOT MATCHED";

          console.log(`    ${status} Rule ${i + 1}:`);
          
          if ("eval" in rule.when) {
            console.log(`      Condition: eval.${rule.when.eval.metric} ${rule.when.eval.operator} ${rule.when.eval.threshold ?? "N/A"}`);
            const evalResult = evalResults.find((r) => 
              r.metrics[rule.when.eval.metric] !== undefined
            );
            if (evalResult) {
              console.log(`      Actual: ${evalResult.metrics[rule.when.eval.metric]}`);
            }
          } else if ("signal" in rule.when) {
            console.log(`      Condition: signal${rule.when.signal.type ? `.type=${rule.when.signal.type}` : ""}${rule.when.signal.name ? `.name=${rule.when.signal.name}` : ""}`);
            const matchingSignal = signals.find((s) => 
              (!rule.when.signal.type || s.type === rule.when.signal.type) &&
              (!rule.when.signal.name || s.name === rule.when.signal.name)
            );
            if (matchingSignal) {
              console.log(`      Found: ${matchingSignal.name}`);
            }
          }
          
          console.log(`      Action: ${rule.then.action}`);
          if (rule.then.reason) {
            console.log(`      Reason: ${rule.then.reason}`);
          }
          console.log("");
        }
      }

      if (envPolicy?.default) {
        console.log(`  Default Action: ${envPolicy.default}`);
        console.log("");
      }
    }

    // Legacy eval-based contracts
    if (contract.requiredEvals && contract.requiredEvals.length > 0) {
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
