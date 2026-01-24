import type { EvalAdapter, NormalizedEvalResult } from "../types/index.js";
import { GenericAdapter } from "./generic.js";
import { PromptfooAdapter } from "./promptfoo.js";
import { LangSmithAdapter } from "./langsmith.js";
import { OpenEvalsAdapter } from "./openevals.js";

/**
 * All available adapters in priority order.
 * More specific adapters should come before generic ones.
 */
const ADAPTERS: EvalAdapter[] = [
  new PromptfooAdapter(),
  new LangSmithAdapter(),
  new OpenEvalsAdapter(),
  new GenericAdapter(), // Generic should be last (catch-all)
];

/**
 * Detect which adapter can handle the given data.
 *
 * @param data - Raw eval data
 * @returns The first adapter that supports the data, or undefined
 */
export function detectAdapter(data: unknown): EvalAdapter | undefined {
  for (const adapter of ADAPTERS) {
    if (adapter.supports(data)) {
      return adapter;
    }
  }
  return undefined;
}

/**
 * Parse eval result using auto-detection.
 * Tries each adapter in order and returns the first successful parse.
 *
 * @param data - Raw eval data
 * @returns Normalized eval result
 * @throws Error if no adapter can handle the data
 */
export function parseEvalResult(data: unknown): NormalizedEvalResult {
  const adapter = detectAdapter(data);

  if (!adapter) {
    throw new Error(
      "Unable to detect eval format. Supported formats: promptfoo, langsmith, openevals, generic"
    );
  }

  return adapter.parse(data);
}

/**
 * Parse eval result with a specific adapter.
 *
 * @param data - Raw eval data
 * @param adapterName - Name of the adapter to use
 * @returns Normalized eval result
 * @throws Error if adapter not found or parsing fails
 */
export function parseWithAdapter(
  data: unknown,
  adapterName: string
): NormalizedEvalResult {
  const adapter = ADAPTERS.find((a) => a.name === adapterName);

  if (!adapter) {
    const available = ADAPTERS.map((a) => a.name).join(", ");
    throw new Error(
      `Unknown adapter: "${adapterName}". Available adapters: ${available}`
    );
  }

  return adapter.parse(data);
}

/**
 * Get list of available adapter names
 */
export function getAvailableAdapters(): string[] {
  return ADAPTERS.map((a) => a.name);
}
