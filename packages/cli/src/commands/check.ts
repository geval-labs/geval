/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import {
  parseContract,
  parseContractFromYaml,
  evaluate,
  parseEvalResult,
  formatDecision,
  type Decision,
  type NormalizedEvalResult,
  type BaselineData,
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
    const evalResults = loadEvalResults(options.eval, options.adapter);

    // Load baselines if provided
    const baselines = options.baseline
      ? loadBaselines(options.baseline, evalResults)
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
 */
function loadEvalResults(
  evalPaths: string[],
  adapterName?: string
): NormalizedEvalResult[] {
  const results: NormalizedEvalResult[] = [];

  for (const evalPath of evalPaths) {
    const resolvedPath = path.resolve(evalPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Eval file not found: ${evalPath}`);
    }

    const content = fs.readFileSync(resolvedPath, "utf-8");

    try {
      const data = JSON.parse(content);

      // If data is an array, parse each item
      if (Array.isArray(data)) {
        for (const item of data) {
          results.push(parseEvalResult(item));
        }
      } else {
        results.push(parseEvalResult(data));
      }
    } catch (e) {
      throw new Error(
        `Failed to parse eval file ${evalPath}: ${e instanceof Error ? e.message : "Unknown error"}`
      );
    }
  }

  return results;
}

/**
 * Load baseline data
 */
function loadBaselines(
  baselinePath: string,
  currentResults: NormalizedEvalResult[]
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

  try {
    const data = JSON.parse(content);
    const baselines: Record<string, BaselineData> = {};

    // Parse baseline data
    const baselineResults: NormalizedEvalResult[] = Array.isArray(data)
      ? data.map(parseEvalResult)
      : [parseEvalResult(data)];

    // Convert to baseline format keyed by eval name
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
