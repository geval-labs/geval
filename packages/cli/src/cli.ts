import { Command } from "commander";
import { VERSION } from "@geval-labs/core";
import { checkCommand } from "./commands/check.js";
import { diffCommand } from "./commands/diff.js";
import { explainCommand } from "./commands/explain.js";
import { validateCommand } from "./commands/validate.js";

const program = new Command();

program
  .name("geval")
  .description(
    "Eval-driven release enforcement for AI.\n\n" +
      "Geval turns evaluation results into deterministic go/no-go decisions in CI/CD."
  )
  .version(VERSION, "-v, --version", "Display version number");

// geval check - main enforcement command
program
  .command("check")
  .description("Evaluate contracts against eval results and enforce decisions")
  .requiredOption("-c, --contract <path>", "Path to eval contract (YAML/JSON)")
  .requiredOption("-e, --eval <paths...>", "Path(s) to eval result files (JSON)")
  .option("-b, --baseline <path>", "Path to baseline eval results (JSON)")
  .option("--adapter <name>", "Force specific adapter (promptfoo, langsmith, openevals, generic)")
  .option("--json", "Output results as JSON")
  .option("--no-color", "Disable colored output")
  .option("--verbose", "Show detailed output")
  .action(checkCommand);

// geval diff - compare eval results
program
  .command("diff")
  .description("Compare eval results between two runs")
  .requiredOption("-p, --previous <path>", "Path to previous eval results (JSON)")
  .requiredOption("-c, --current <path>", "Path to current eval results (JSON)")
  .option("--json", "Output results as JSON")
  .option("--no-color", "Disable colored output")
  .action(diffCommand);

// geval explain - explain a decision
program
  .command("explain")
  .description("Explain why a contract passed or failed")
  .requiredOption("-c, --contract <path>", "Path to eval contract (YAML/JSON)")
  .requiredOption("-e, --eval <paths...>", "Path(s) to eval result files (JSON)")
  .option("-b, --baseline <path>", "Path to baseline eval results (JSON)")
  .option("--verbose", "Show detailed explanations")
  .option("--no-color", "Disable colored output")
  .action(explainCommand);

// geval validate - validate contract syntax
program
  .command("validate")
  .description("Validate an eval contract file")
  .argument("<path>", "Path to eval contract (YAML/JSON)")
  .option("--strict", "Enable strict validation (warnings become errors)")
  .option("--json", "Output results as JSON")
  .action(validateCommand);

// Parse arguments
program.parse();
