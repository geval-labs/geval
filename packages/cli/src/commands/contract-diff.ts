import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import {
  parseContract,
  parseContractFromYaml,
  diffContracts,
} from "@geval-labs/core";

interface ContractDiffOptions {
  previous: string;
  current: string;
  json?: boolean;
  color?: boolean;
}

/**
 * Contract diff command implementation
 */
export async function contractDiffCommand(
  options: ContractDiffOptions
): Promise<void> {
  const useColor = options.color !== false;

  try {
    // Load previous contract
    const previousContract = loadContract(options.previous);

    // Load current contract
    const currentContract = loadContract(options.current);

    // Compute diff
    const diffResult = diffContracts(previousContract, currentContract);

    // Output results
    if (options.json) {
      console.log(JSON.stringify(diffResult, null, 2));
    } else {
      formatAndPrintContractDiff(diffResult, useColor);
    }

    // Exit with 1 if contracts differ
    process.exit(diffResult.identical ? 0 : 1);
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
 * Format and print contract diff result
 */
function formatAndPrintContractDiff(
  diffResult: ReturnType<typeof diffContracts>,
  useColor: boolean
): void {
  const { identical, diffs, summary } = diffResult;

  // Header
  console.log(
    useColor ? pc.bold("Contract Diff") : "Contract Diff"
  );
  console.log("");

  // Summary
  if (identical) {
    console.log(
      useColor
        ? pc.green("✓ Contracts are identical")
        : "✓ Contracts are identical"
    );
  } else {
    console.log(
      useColor
        ? pc.yellow(`⚠ Contracts differ (${diffs.length} change(s))`)
        : `⚠ Contracts differ (${diffs.length} change(s))`
    );
    console.log(`  ${summary}`);
    console.log("");

    // Detailed diffs
    console.log(useColor ? pc.bold("Changes:") : "Changes:");
    for (const diff of diffs) {
      const prevStr =
        diff.previous !== undefined
          ? JSON.stringify(diff.previous)
          : "N/A";
      const currStr =
        diff.current !== undefined ? JSON.stringify(diff.current) : "N/A";

      console.log(`  ${useColor ? pc.bold(diff.field) : diff.field}:`);
      console.log(
        useColor
          ? `    ${pc.red("-")} ${prevStr}`
          : `    - ${prevStr}`
      );
      console.log(
        useColor
          ? `    ${pc.green("+")} ${currStr}`
          : `    + ${currStr}`
      );
      console.log("");
    }
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

  process.exit(3);
}
