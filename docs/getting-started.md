# Getting Started with Geval

Geval is an eval-driven release enforcement system that turns your evaluation results into deterministic go/no-go decisions inside CI/CD.

**Geval does NOT:**
- Run evals
- Define correctness
- Optimize prompts

**Geval DOES:**
- Consume eval outputs from any tool
- Apply explicit contracts
- Enforce decisions in PRs and CI/CD
- Block unverified AI changes before production

---

## Installation

```bash
# Install the CLI globally
npm install -g @geval-labs/cli

# Or use npx
npx @geval-labs/cli --help

# For programmatic use, install the core library
npm install @geval-labs/core
```

---

## Quick Start (5 minutes)

### Step 1: Create an Eval Contract

An eval contract defines what "acceptable" means for your AI system.

Create `eval-contract.yaml`:

```yaml
version: 1
name: my-ai-quality-gate
description: Quality requirements for production AI deployment
environment: production

required_evals:
  - name: quality-check
    description: Core quality metrics
    rules:
      # Accuracy must be at least 85%
      - metric: accuracy
        operator: ">="
        baseline: fixed
        threshold: 0.85
        description: Accuracy must meet threshold

      # Latency p95 must be under 500ms
      - metric: latency_p95
        operator: "<="
        baseline: fixed
        threshold: 500
        description: Response time must be acceptable

      # Hallucination rate must be under 5%
      - metric: hallucination_rate
        operator: "<="
        baseline: fixed
        threshold: 0.05
        description: Hallucination rate must be low

on_violation:
  action: block
  message: "Quality metrics did not meet requirements"
```

### Step 2: Prepare Your Eval Results

Your eval results should be in JSON format with metrics. Create `eval-results.json`:

```json
{
  "evalName": "quality-check",
  "runId": "run-2026-01-27",
  "timestamp": "2026-01-27T10:00:00Z",
  "metrics": {
    "accuracy": 0.92,
    "latency_p95": 450,
    "hallucination_rate": 0.02
  },
  "metadata": {
    "model": "gpt-4",
    "commit": "abc123"
  }
}
```

### Step 3: Run Geval Check

```bash
# Validate your contract first
geval validate eval-contract.yaml

# Check your eval results against the contract
geval check --contract eval-contract.yaml --eval eval-results.json
```

**Output (PASS):**
```
✓ PASS

Contract:    my-ai-quality-gate
Version:     1

All 1 eval(s) passed contract requirements
```

**Output (BLOCK):**
```
✗ BLOCK

Contract:    my-ai-quality-gate
Version:     1

Blocked: 2 violation(s) in 1 eval

Violations

  1. quality-check → accuracy
     accuracy = 0.78, expected >= 0.85

  2. quality-check → hallucination_rate
     hallucination_rate = 0.08, expected <= 0.05
```

---

## Working with CSV Files (LangSmith, Braintrust, etc.)

Many eval tools export CSV files. Geval can parse any CSV with a source configuration.

### Example: LangSmith CSV Export

Your CSV file (`langsmith-export.csv`):
```csv
id,inputs,outputs,status,latency,accuracy,quality_score
1,"{...}","{...}",success,0.12,0.95,0.88
2,"{...}","{...}",success,0.15,0.91,0.92
3,"{...}","{...}",error,0.08,0.78,0.65
```

Create a source config (`source-config.yaml`):
```yaml
# Define how to extract metrics from your CSV
type: csv
metrics:
  - column: accuracy
    aggregate: avg
  - column: quality_score
    aggregate: avg
  - column: latency
    aggregate: p95
  - column: status
    aggregate: pass_rate  # Counts "success" as pass
evalName:
  fixed: langsmith-eval
```

Use it programmatically:

```typescript
import { parseEvalSource } from "@geval-labs/core";
import { readFileSync } from "fs";

const csvContent = readFileSync("langsmith-export.csv", "utf-8");
const sourceConfig = {
  type: "csv",
  metrics: [
    { column: "accuracy", aggregate: "avg" },
    { column: "quality_score", aggregate: "avg" },
    { column: "latency", aggregate: "p95" },
    { column: "status", aggregate: "pass_rate" }
  ],
  evalName: { fixed: "langsmith-eval" }
};

const evalResult = parseEvalSource(csvContent, sourceConfig);
console.log(evalResult);
// {
//   evalName: "langsmith-eval",
//   runId: "run-1706358000000",
//   metrics: {
//     accuracy: 0.88,
//     quality_score: 0.817,
//     latency: 0.15,
//     status: 0.667
//   }
// }
```

---

## CLI Commands Reference

### `geval validate`

Validate a contract file:

```bash
geval validate eval-contract.yaml
```

### `geval check`

Check eval results against a contract:

```bash
# Basic usage
geval check --contract eval-contract.yaml --eval results.json

# Multiple eval files
geval check --contract contract.yaml --eval run1.json --eval run2.json

# With baseline comparison
geval check --contract contract.yaml --eval current.json --baseline previous.json

# JSON output for CI
geval check --contract contract.yaml --eval results.json --json

# Verbose output
geval check --contract contract.yaml --eval results.json --verbose
```

**Exit Codes:**
- `0` - PASS (safe to merge/deploy)
- `1` - BLOCK (do not merge/deploy)
- `2` - REQUIRES_APPROVAL (needs human review)
- `3` - ERROR (something went wrong)

### `geval diff`

Compare eval results between runs:

```bash
geval diff --previous baseline.json --current current.json

# JSON output
geval diff --previous baseline.json --current current.json --json
```

### `geval explain`

Get detailed explanation of a decision:

```bash
geval explain --contract contract.yaml --eval results.json --verbose
```

---

## Programmatic Usage (Node.js/TypeScript)

### Basic Example

```typescript
import {
  parseContractFromYaml,
  evaluate,
  formatDecision,
  GenericAdapter
} from "@geval-labs/core";
import { readFileSync } from "fs";

// 1. Load and parse the contract
const contractYaml = readFileSync("eval-contract.yaml", "utf-8");
const contract = parseContractFromYaml(contractYaml);

// 2. Load and parse eval results
const evalData = JSON.parse(readFileSync("eval-results.json", "utf-8"));
const adapter = new GenericAdapter();
const evalResult = adapter.parse(evalData);

// 3. Evaluate
const decision = evaluate({
  contract,
  evalResults: [evalResult],
  baselines: {}
});

// 4. Display result
console.log(formatDecision(decision));

// 5. Use in CI
if (decision.status === "PASS") {
  console.log("✅ Safe to deploy!");
  process.exit(0);
} else {
  console.log("❌ Deployment blocked");
  process.exit(1);
}
```

### Working with Different Eval Tools

```typescript
import {
  parseEvalResult,    // Auto-detect format
  GenericAdapter,     // Generic JSON format
  PromptfooAdapter,   // Promptfoo outputs
  LangSmithAdapter,   // LangSmith exports
  OpenEvalsAdapter,   // OpenEvals format
  parseEvalSource     // CSV/JSON with custom config
} from "@geval-labs/core";

// Auto-detect format
const result1 = parseEvalResult(anyEvalData);

// Or use specific adapter
const promptfooAdapter = new PromptfooAdapter();
const result2 = promptfooAdapter.parse(promptfooOutput);

// Or parse CSV with custom column mapping
const result3 = parseEvalSource(csvContent, {
  type: "csv",
  metrics: [
    { column: "score", aggregate: "avg" },
    { column: "passed", aggregate: "pass_rate" }
  ],
  evalName: { fixed: "my-eval" }
});
```

### Comparing Eval Runs

```typescript
import { diffEvalResults } from "@geval-labs/core";

const previousResults = [/* ... */];
const currentResults = [/* ... */];

const diff = diffEvalResults(previousResults, currentResults);

console.log(`Improved: ${diff.stats.improved}`);
console.log(`Regressed: ${diff.stats.regressed}`);
console.log(`Unchanged: ${diff.stats.unchanged}`);

for (const evalDiff of diff.diffs) {
  console.log(`\n${evalDiff.evalName}:`);
  for (const metric of evalDiff.metrics) {
    console.log(`  ${metric.metric}: ${metric.previous} → ${metric.current} (${metric.direction})`);
  }
}
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/eval-check.yml
name: Eval Check

on:
  pull_request:
    paths:
      - 'prompts/**'
      - 'agents/**'

jobs:
  eval-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Geval
        run: npm install -g @geval-labs/cli

      - name: Run Evals
        run: |
          # Your eval command here (promptfoo, langsmith, etc.)
          npm run evals -- --output eval-results.json

      - name: Validate Contract
        run: geval validate eval-contract.yaml

      - name: Check Eval Results
        run: |
          geval check \
            --contract eval-contract.yaml \
            --eval eval-results.json \
            --json > decision.json

      - name: Comment on PR
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const decision = JSON.parse(fs.readFileSync('decision.json', 'utf8'));
            
            const icon = decision.status === 'PASS' ? '✅' : '❌';
            const body = `## ${icon} Geval: ${decision.status}\n\n${decision.summary}`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

### GitLab CI

```yaml
# .gitlab-ci.yml
eval-check:
  stage: test
  image: node:20
  script:
    - npm install -g @geval-labs/cli
    - npm run evals -- --output eval-results.json
    - geval validate eval-contract.yaml
    - geval check --contract eval-contract.yaml --eval eval-results.json
  rules:
    - if: $CI_MERGE_REQUEST_ID
      changes:
        - prompts/**
        - agents/**
```

---

## Contract Schema Reference

```yaml
# Required: Schema version (always 1)
version: 1

# Required: Contract name
name: my-contract

# Optional: Description
description: Quality requirements for my AI system

# Optional: Environment (development, staging, production)
environment: production

# Required: At least one eval suite
required_evals:
  - name: eval-suite-name  # Must match evalName in results
    description: Optional description
    rules:
      - metric: metric_name        # Metric to check
        operator: ">="             # ==, !=, <, <=, >, >=
        baseline: fixed            # fixed, previous, or main
        threshold: 0.85            # For fixed baseline
        max_delta: 0.05            # Max allowed change (for previous/main)
        description: Rule explanation

# Required: What to do on violation
on_violation:
  action: block           # block, require_approval, or warn
  message: "Custom message"
```

---

## Aggregation Methods

When parsing CSV/JSON with custom column mapping, you can use these aggregation methods:

| Method | Description |
|--------|-------------|
| `avg` | Average of all values (default) |
| `sum` | Sum of all values |
| `min` | Minimum value |
| `max` | Maximum value |
| `count` | Count of non-null values |
| `p50` | 50th percentile (median) |
| `p90` | 90th percentile |
| `p95` | 95th percentile |
| `p99` | 99th percentile |
| `pass_rate` | % of values that are truthy/"success"/"pass" |
| `fail_rate` | % of values that are falsy/"error"/"fail" |
| `first` | First value |
| `last` | Last value |

---

## Best Practices

### 1. Start Simple
Begin with fixed thresholds. Add relative baselines later.

```yaml
rules:
  - metric: accuracy
    operator: ">="
    baseline: fixed
    threshold: 0.85
```

### 2. Version Your Contracts
Store contracts in git alongside your code. Review contract changes like code changes.

### 3. Use Descriptive Names
```yaml
name: customer-support-bot-quality-gate
required_evals:
  - name: response-quality-metrics
    rules:
      - metric: helpfulness_score
        description: Responses must be helpful to customers
```

### 4. Set Appropriate Thresholds
Don't set thresholds too tight initially. Adjust based on real data.

### 5. Block on Critical Metrics Only
Use `warn` for non-critical metrics, `block` for critical ones.

---

## Troubleshooting

### "Required eval not found"
The `evalName` in your results must match the `name` in `required_evals`.

### "Metric not found"
Check that your eval results include all metrics referenced in rules.

### CSV not parsing correctly
Use the source config to specify exact column names:
```yaml
type: csv
metrics:
  - column: exact_column_name
    aggregate: avg
```

---

## Next Steps

- [Contract Schema Reference](./contract-schema.md)
- [CLI Reference](./cli-reference.md)
- [API Reference](./api-reference.md)
- [CI/CD Examples](./ci-cd-examples.md)
