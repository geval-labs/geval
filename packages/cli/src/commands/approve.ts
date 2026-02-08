import * as fs from "node:fs";
import pc from "picocolors";
import { HumanDecisionSchema, type HumanDecision } from "@geval-labs/core";

interface ApproveOptions {
  reason: string;
  output?: string;
  by?: string;
}

/**
 * Approve command - create a human approval decision artifact
 */
export async function approveCommand(options: ApproveOptions): Promise<void> {
  const reason = options.reason || "Approved via CLI";
  const by = options.by || process.env.USER || process.env.USERNAME || "unknown";
  const outputPath = options.output || "geval-approval.json";

  const decision: HumanDecision = {
    decision: "approved",
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

  console.log(pc.green("✓ Approval recorded"));
  console.log(`  By: ${by}`);
  console.log(`  Reason: ${reason}`);
  console.log(`  Output: ${outputPath}`);

  process.exit(0);
}
