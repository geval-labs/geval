/* eslint-disable @typescript-eslint/no-unused-vars */
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
  formatDecision,
  type Decision,
  type NormalizedEvalResult,
  type BaselineData,
  type EvalContract,
  parseWithAdapter,
} from "@geval-labs/core";

interface CheckOptions {
  contract: string;
  eval: string[];
  baseline?: string;
  adapter?: string;
  json?: boolean;
  color?: boolean;
  verbose?: boolean;
}

/**
 * Exit codes for CI integration
 */
const EXIT_CODES = {
  PASS: 0,
  BLOCK: 1,
  REQUIRES_APPROVAL: 2,
  ERROR: 3,
};

/**
 * Main check command implementation
 */
export async function checkCommand(options: CheckOptions): Promise<void> {
  const useColor = options.color !== false;

  try {
    // Load and parse contract
    const contract = loadContract(options.contract);

    // Load and parse eval results
    const evalResults = loadEvalResults(options.eval, contract, options.adapter);

    // Load baselines if provided
    const baselines = options.baseline
      ? loadBaselines(options.baseline, evalResults, contract)
      : {};

    // Run evaluation
    const decision = evaluate({
      contract,
      evalResults,
      baselines,
    });

    // Output results
    if (options.json) {
      console.log(JSON.stringify(decision, null, 2));
    } else {
      const formatted = formatDecision(decision, {
        colors: useColor,
        verbose: options.verbose,
        timestamps: options.verbose,
      });
      console.log(formatted);
    }

    // Exit with appropriate code
    process.exit(getExitCode(decision));
  } catch (error) {
    handleError(error, options.json, useColor);
  }
}

/**
 * Load and parse a contract file
 */
function loadContract(contractPath: string): EvalContract {
  const resolvedPath = path.resolve(contractPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Contract file not found: ${contractPath}`);
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");
  const ext = path.extname(resolvedPath).toLowerCase();

  if (ext === ".yaml" || ext === ".yml") {
    return parseContractFromYaml(content);
  } else {
    try {
      const data = JSON.parse(content);
      return parseContract(data);
    } catch (e) {
      throw new Error(
        `Failed to parse contract file: ${e instanceof Error ? e.message : "Unknown error"}`
      );
    }
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
          `CSV/JSONL files require a source config in the contract.\n` +
          `Add a "sources.${fileType}" section to your contract to define how to parse metrics.\n\n` +
          `Example:\n` +
          `  sources:\n` +
          `    ${fileType}:\n` +
          `      metrics:\n` +
          `        - column: accuracy\n` +
          `          aggregate: avg\n` +
          `        - column: latency\n` +
          `          aggregate: p95\n` +
          `      evalName:\n` +
          `        fixed: "my-eval"`
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
    // Baseline is optional - if not found, return empty
    console.error(
      pc.yellow(`Warning: Baseline file not found: ${baselinePath}`)
    );
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
 * Get exit code based on decision
 */
function getExitCode(decision: Decision): number {
  switch (decision.status) {
    case "PASS":
      return EXIT_CODES.PASS;
    case "BLOCK":
      return EXIT_CODES.BLOCK;
    case "REQUIRES_APPROVAL":
      return EXIT_CODES.REQUIRES_APPROVAL;
    default:
      return EXIT_CODES.ERROR;
  }
}

/**
 * Handle errors consistently
 */
function handleError(
  error: unknown,
  json: boolean | undefined,
  useColor: boolean
): never {
  const message =
    error instanceof Error ? error.message : "An unknown error occurred";

  if (json) {
    console.error(
      JSON.stringify({
        error: true,
        message,
      })
    );
  } else {
    console.error(
      useColor ? pc.red(`Error: ${message}`) : `Error: ${message}`
    );
  }

  process.exit(EXIT_CODES.ERROR);
}
