import * as fs from "node:fs";
import * as path from "node:path";
import pc from "picocolors";
import {
  parseContract,
  parseContractFromYaml,
  validateContract,
  ContractValidationError,
} from "@geval-labs/core";

interface ValidateOptions {
  strict?: boolean;
  json?: boolean;
}

/**
 * Validate command implementation
 */
export async function validateCommand(
  contractPath: string,
  options: ValidateOptions
): Promise<void> {
  const useColor = process.stdout.isTTY ?? true;

  try {
    const resolvedPath = path.resolve(contractPath);

    // Check file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Contract file not found: ${contractPath}`);
    }

    // Load and parse contract
    const content = fs.readFileSync(resolvedPath, "utf-8");
    const ext = path.extname(resolvedPath).toLowerCase();

    let contract;
    try {
      if (ext === ".yaml" || ext === ".yml") {
        contract = parseContractFromYaml(content);
      } else {
        const data = JSON.parse(content);
        contract = parseContract(data);
      }
    } catch (error) {
      if (error instanceof ContractValidationError) {
        outputValidationResult(
          {
            valid: false,
            file: contractPath,
            errors: error.issues,
            warnings: [],
          },
          options,
          useColor
        );
        process.exit(1);
      }
      throw error;
    }

    // Run semantic validation
    const validationResult = validateContract(contract);

    // In strict mode, warnings become errors
    if (options.strict && validationResult.warnings.length > 0) {
      validationResult.errors.push(...validationResult.warnings);
      validationResult.warnings = [];
      validationResult.valid = false;
    }

    // Build contract summary
    let contractSummary: {
      name: string;
      environment: string;
      type: string;
      requiredEvals?: number;
      totalRules?: number;
      policyRules?: number;
      environments?: string[];
    } | undefined;

    if (validationResult.valid) {
      contractSummary = {
        name: contract.name,
        environment: contract.environment || "production",
        type: contract.policy ? "policy-based" : "eval-based",
      };

      if (contract.policy) {
        const globalRules = contract.policy.rules || [];
        const envRules = Object.values(contract.policy.environments || {}).reduce(
          (sum: number, env: unknown) => {
            const envPolicy = env as { rules?: unknown[] };
            return sum + (envPolicy.rules?.length || 0);
          },
          0
        );
        contractSummary.policyRules = globalRules.length + envRules;
        contractSummary.environments = Object.keys(contract.policy.environments || {});
      } else if (contract.requiredEvals) {
        contractSummary.requiredEvals = contract.requiredEvals.length;
        contractSummary.totalRules = contract.requiredEvals.reduce(
          (sum, e) => sum + e.rules.length,
          0
        );
      }
    }

    // Output result
    outputValidationResult(
      {
        valid: validationResult.valid,
        file: contractPath,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        contract: contractSummary,
      },
      options,
      useColor
    );

    process.exit(validationResult.valid ? 0 : 1);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";

    if (options.json) {
      console.error(
        JSON.stringify({
          valid: false,
          file: contractPath,
          error: message,
        })
      );
    } else {
      console.error(
        useColor ? pc.red(`Error: ${message}`) : `Error: ${message}`
      );
    }

    process.exit(1);
  }
}

interface ValidationOutput {
  valid: boolean;
  file: string;
  errors: Array<{ path: string; message: string; code: string }>;
  warnings: Array<{ path: string; message: string; code: string }>;
  contract?: {
    name: string;
    environment: string;
    type: string;
    requiredEvals?: number;
    totalRules?: number;
    policyRules?: number;
    environments?: string[];
  };
}

/**
 * Output validation result
 */
function outputValidationResult(
  result: ValidationOutput,
  options: ValidateOptions,
  useColor: boolean
): void {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Text output
  if (result.valid) {
    console.log(
      useColor
        ? pc.green("✓ Contract is valid")
        : "✓ Contract is valid"
    );
    console.log("");

    if (result.contract) {
      console.log(`  Name: ${result.contract.name}`);
      console.log(`  Environment: ${result.contract.environment}`);
      console.log(`  Type: ${result.contract.type}`);
      
      if (result.contract.type === "policy-based") {
        console.log(`  Policy Rules: ${result.contract.policyRules || 0}`);
        if (result.contract.environments && result.contract.environments.length > 0) {
          console.log(`  Environments: ${result.contract.environments.join(", ")}`);
        }
      } else {
        console.log(`  Required Evals: ${result.contract.requiredEvals || 0}`);
        console.log(`  Total Rules: ${result.contract.totalRules || 0}`);
      }
    }
  } else {
    console.log(
      useColor
        ? pc.red("✗ Contract validation failed")
        : "✗ Contract validation failed"
    );
    console.log("");
  }

  // Print errors
  if (result.errors.length > 0) {
    console.log(useColor ? pc.red("Errors:") : "Errors:");
    for (const error of result.errors) {
      const pathStr = error.path ? ` at "${error.path}"` : "";
      console.log(
        useColor
          ? `  ${pc.red("•")} ${error.message}${pathStr}`
          : `  • ${error.message}${pathStr}`
      );
    }
    console.log("");
  }

  // Print warnings
  if (result.warnings.length > 0) {
    console.log(useColor ? pc.yellow("Warnings:") : "Warnings:");
    for (const warning of result.warnings) {
      const pathStr = warning.path ? ` at "${warning.path}"` : "";
      console.log(
        useColor
          ? `  ${pc.yellow("•")} ${warning.message}${pathStr}`
          : `  • ${warning.message}${pathStr}`
      );
    }
  }
}
