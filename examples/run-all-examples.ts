/**
 * Test Runner for All Examples
 *
 * This script runs all examples to verify they work end-to-end.
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = __dirname;
const examples = [
  {
    name: "Example 1: Performance Monitoring",
    dir: "example-1-performance",
    script: "run-example.ts",
  },
  {
    name: "Example 2: Safety and Compliance",
    dir: "example-2-safety",
    script: "run-example.ts",
  },
  {
    name: "Example 3: Multi-Eval Comparison",
    dir: "example-3-multi-eval",
    script: "run-example.ts",
  },
];

async function main() {
  console.log("🧪 Running All Geval Examples\n");
  console.log("=".repeat(60) + "\n");

  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  for (const example of examples) {
    const examplePath = join(examplesDir, example.dir);
    const scriptPath = join(examplePath, example.script);

    console.log(`\n📦 ${example.name}`);
    console.log("-".repeat(60));

    if (!existsSync(examplePath)) {
      console.log(`❌ Example directory not found: ${examplePath}`);
      results.push({ name: example.name, success: false, error: "Directory not found" });
      continue;
    }

    if (!existsSync(scriptPath)) {
      console.log(`❌ Script not found: ${scriptPath}`);
      results.push({ name: example.name, success: false, error: "Script not found" });
      continue;
    }

    try {
      // Check if node_modules exists, if not, install dependencies
      const packageJsonPath = join(examplePath, "package.json");
      if (existsSync(packageJsonPath)) {
        const nodeModulesPath = join(examplePath, "node_modules");
        if (!existsSync(nodeModulesPath)) {
          console.log("   Installing dependencies...");
          execSync("npm install", {
            cwd: examplePath,
            stdio: "inherit",
          });
        }
      }

      // Run the example
      console.log(`   Running ${example.script}...`);
      execSync(`npx tsx ${example.script}`, {
        cwd: examplePath,
        stdio: "inherit",
      });

      console.log(`✅ ${example.name} - PASSED`);
      results.push({ name: example.name, success: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`❌ ${example.name} - FAILED`);
      console.log(`   Error: ${errorMessage}`);
      results.push({ name: example.name, success: false, error: errorMessage });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary\n");

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  for (const result of results) {
    const status = result.success ? "✅ PASS" : "❌ FAIL";
    console.log(`   ${status} - ${result.name}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  }

  console.log(`\n   Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.log("\n❌ Some examples failed. Please check the errors above.");
    process.exit(1);
  } else {
    console.log("\n✅ All examples passed successfully!");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error.message);
  console.error(error.stack);
  process.exit(1);
});
