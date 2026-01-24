import YAML from "yaml";
import { EvalContractSchema, type EvalContract } from "../types/index.js";
import { ContractValidationError } from "./validator.js";

/**
 * Parse an eval contract from a JavaScript object.
 * Validates the structure and returns a typed contract.
 *
 * @param data - Raw contract data (typically from JSON)
 * @returns Parsed and validated EvalContract
 * @throws ContractValidationError if validation fails
 */
export function parseContract(data: unknown): EvalContract {
  const result = EvalContractSchema.safeParse(data);

  if (!result.success) {
    throw new ContractValidationError(
      "Invalid contract format",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }))
    );
  }

  return result.data;
}

/**
 * Parse an eval contract from a YAML string.
 *
 * @param yamlContent - YAML string content
 * @returns Parsed and validated EvalContract
 * @throws ContractValidationError if validation fails
 */
export function parseContractFromYaml(yamlContent: string): EvalContract {
  let parsed: unknown;

  try {
    parsed = YAML.parse(yamlContent);
  } catch (error) {
    throw new ContractValidationError("Invalid YAML syntax", [
      {
        path: "",
        message: error instanceof Error ? error.message : "Unknown YAML error",
        code: "invalid_yaml",
      },
    ]);
  }

  // Handle YAML naming convention (snake_case) to JS (camelCase) conversion
  const normalized = normalizeYamlKeys(parsed);

  return parseContract(normalized);
}

/**
 * Normalize YAML keys from snake_case to camelCase.
 * This allows contracts to be written in YAML-friendly snake_case
 * while using camelCase internally.
 */
function normalizeYamlKeys(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(normalizeYamlKeys);
  }

  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const normalizedKey = snakeToCamel(key);
      result[normalizedKey] = normalizeYamlKeys(value);
    }
    return result;
  }

  return data;
}

/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
