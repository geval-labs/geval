import * as fs from "node:fs";
import pc from "picocolors";
import { HumanDecisionSchema, type HumanDecision } from "@geval-labs/core";

interface RejectOptions {
  reason: string;
  output?: string;
  by?: string;
}

/**
 * Reject command - create a human rejection decision artifact
 */
export async function rejectCommand(options: RejectOptions): Promise<void> {
  const reason = options.reason || "Rejected via CLI";
  const by = options.by || process.env.USER || process.env.USERNAME || "unknown";
  const outputPath = options.output || "geval-rejection.json";

  const decision: HumanDecision = {
    decision: "rejected",
    by,
    reason,
    timestamp: new Date().toISOString(),
  };

  // Validate
  const result = HumanDecisionSchema.safeParse(decision);
  if (!result.success) {
    console.error(
      pc.red("❌ Invalid decision format:"),
      result.error.issues.map((i) => i.message).join(", ")
    );
    process.exit(1);
  }

  // Write to file
  const output = JSON.stringify(result.data, null, 2);
  fs.writeFileSync(outputPath, output, "utf-8");

  console.log(pc.red("✗ Rejection recorded"));
  console.log(`  By: ${by}`);
  console.log(`  Reason: ${reason}`);
  console.log(`  Output: ${outputPath}`);

  process.exit(0);
}
