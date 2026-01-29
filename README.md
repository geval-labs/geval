<p align="center">
  <img src="https://geval.io/white_bg_greenlogo.svg" alt="Geval" width="180" />
</p>

<h1 align="center">Geval</h1>

<p align="center">
  <strong>Eval-driven release gates for AI applications</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@geval-labs/cli"><img src="https://img.shields.io/npm/v/@geval-labs/cli.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@geval-labs/core"><img src="https://img.shields.io/npm/v/@geval-labs/core.svg" alt="npm version"></a>
  <a href="https://github.com/geval-labs/geval/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://github.com/geval-labs/geval/actions"><img src="https://github.com/geval-labs/geval/workflows/CI/badge.svg" alt="CI Status"></a>
  <a href="https://github.com/geval-labs/geval"><img src="https://img.shields.io/github/stars/geval-labs/geval?style=social" alt="GitHub Stars"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#examples">Examples</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## What is Geval?

Geval turns evaluation results into **automated pass/fail decisions** in CI/CD pipelines. It's a lightweight, framework-agnostic tool that enforces quality contracts on your AI applications.

**Geval is:**
- ✅ **Format-agnostic** - Works with CSV, JSON, JSONL from any eval tool
- ✅ **Contract-based** - Define quality requirements as code
- ✅ **CI-native** - Exit codes and JSON output for automation
- ✅ **Framework-agnostic** - Works with Promptfoo, LangSmith, OpenEvals, or custom tools

**Geval is not:**
- ❌ An eval runner (it consumes eval outputs)
- ❌ A monitoring tool (it's for release gates)
- ❌ A testing framework (it validates existing results)

```text
Your Evals → Geval Contract → CI Pass/Block Decision
```

---

## Quick Start

### Installation

```bash
# Install CLI globally
npm install -g @geval-labs/cli

# Or install as a dev dependency
npm install --save-dev @geval-labs/cli
```

### 1. Create a Contract

Create a `contract.yaml` file:

```yaml
version: 1
name: quality-gate
description: Quality requirements for production deployment
environment: production

# Define how to parse CSV files
sources:
  csv:
    metrics:
      - column: accuracy
        aggregate: avg
      - column: latency_ms
        aggregate: p95
        as: latency_p95
      - column: error_rate
        aggregate: avg
    evalName:
      fixed: quality-metrics

# Define quality requirements
required_evals:
  - name: quality-metrics
    rules:
      - metric: accuracy
        operator: ">="
        baseline: fixed
        threshold: 0.85
        description: Accuracy must be at least 85%
      
      - metric: latency_p95
        operator: "<="
        baseline: fixed
        threshold: 200
        description: P95 latency must be under 200ms
      
      - metric: error_rate
        operator: "<="
        baseline: fixed
        threshold: 0.01
        description: Error rate must be under 1%

on_violation:
  action: block
  message: "Quality metrics did not meet production requirements"
```

### 2. Run Geval

```bash
# Check eval results against contract
geval check --contract contract.yaml --eval results.csv

# With baseline comparison
geval check --contract contract.yaml --eval results.csv --baseline baseline.json

# JSON output for CI/CD
geval check --contract contract.yaml --eval results.csv --json
```

### 3. Output

**Pass:**
```
✓ PASS

Contract:    quality-gate
Version:     1

All 1 eval(s) passed contract requirements
```

**Block:**
```
✗ BLOCK

Contract:    quality-gate
Version:     1

Blocked: 2 violation(s) in 1 eval

Violations

  1. quality-metrics → accuracy
     accuracy = 0.72, expected >= 0.85
     Actual: 0.72 | Baseline: 0.85

  2. quality-metrics → latency_p95
     latency_p95 = 250, expected <= 200
     Actual: 250 | Baseline: 200
```

---

## Features

### 🎯 Multi-Format Support

Geval supports multiple eval result formats:

- **CSV** - Raw data exports from any tool
- **JSON** - Normalized eval results or tool-specific formats
- **JSONL** - Line-delimited JSON files

### 📊 Inline Source Configuration

Define CSV parsing directly in your contract - no separate config files needed:

```yaml
sources:
  csv:
    metrics:
      - column: accuracy
        aggregate: avg
      - column: latency
        aggregate: p95
        as: latency_p95
    evalName:
      fixed: my-eval
```

### 📈 Baseline Comparisons

Compare against:
- **Fixed thresholds** - Absolute quality gates
- **Previous runs** - Detect regressions
- **Main branch** - Compare against production baseline

### 🔌 Adapter Support

Built-in adapters for popular eval tools:
- **Promptfoo** - Automatic format detection
- **LangSmith** - CSV export support
- **OpenEvals** - JSON format support
- **Generic** - Custom JSON formats

### 🚀 CI/CD Integration

- **Exit codes**: `0` PASS · `1` BLOCK · `2` REQUIRES_APPROVAL · `3` ERROR
- **JSON output**: `--json` flag for programmatic use
- **Multiple files**: Support for multiple eval result files

---

## CLI Commands

### `geval check`

Evaluate contracts against eval results and enforce decisions.

```bash
geval check --contract <path> --eval <paths...> [options]
```

**Options:**
- `-c, --contract <path>` - Path to eval contract (YAML/JSON) *(required)*
- `-e, --eval <paths...>` - Path(s) to eval result files (CSV/JSON/JSONL) *(required)*
- `-b, --baseline <path>` - Path to baseline eval results for comparison
- `--adapter <name>` - Force specific adapter (promptfoo, langsmith, openevals, generic)
- `--json` - Output results as JSON
- `--no-color` - Disable colored output
- `--verbose` - Show detailed output

**Examples:**
```bash
# Basic check
geval check -c contract.yaml -e results.csv

# Multiple eval files
geval check -c contract.yaml -e results1.json results2.json

# With baseline comparison
geval check -c contract.yaml -e results.csv -b baseline.json

# JSON output for CI
geval check -c contract.yaml -e results.csv --json
```

### `geval diff`

Compare eval results between two runs.

```bash
geval diff --previous <path> --current <path> [options]
```

**Options:**
- `-p, --previous <path>` - Path to previous eval results *(required)*
- `-c, --current <path>` - Path to current eval results *(required)*
- `--json` - Output results as JSON
- `--no-color` - Disable colored output

**Example:**
```bash
geval diff --previous baseline.json --current new.json
```

### `geval explain`

Explain why a contract passed or failed with detailed analysis.

```bash
geval explain --contract <path> --eval <paths...> [options]
```

**Options:**
- `-c, --contract <path>` - Path to eval contract (YAML/JSON) *(required)*
- `-e, --eval <paths...>` - Path(s) to eval result files *(required)*
- `-b, --baseline <path>` - Path to baseline eval results
- `--verbose` - Show detailed explanations
- `--no-color` - Disable colored output

**Example:**
```bash
geval explain -c contract.yaml -e results.json --verbose
```

### `geval validate`

Validate a contract file for syntax and semantic correctness.

```bash
geval validate <path> [options]
```

**Options:**
- `<path>` - Path to eval contract (YAML/JSON) *(required)*
- `--strict` - Enable strict validation (warnings become errors)
- `--json` - Output results as JSON

**Example:**
```bash
geval validate contract.yaml --strict
```

---

## Contract Reference

### Basic Structure

```yaml
version: 1                    # Contract schema version (required)
name: string                  # Contract name (required)
description: string           # Optional description
environment: production       # Optional: production | staging | development

sources:                     # Optional: inline CSV/JSON parsing config
  csv:
    metrics:
      - column: accuracy
        aggregate: avg
    evalName:
      fixed: my-eval

required_evals:              # Required: list of eval suites to check
  - name: eval-name
    description: string      # Optional
    rules:                   # Required: list of rules
      - metric: accuracy
        operator: ">="
        baseline: fixed
        threshold: 0.85

on_violation:                # Required: violation handler
  action: block              # block | require_approval | warn
  message: string            # Optional custom message

metadata:                    # Optional: contract metadata
  key: value                 # All values must be strings
```

### Aggregation Methods

When parsing CSV files, you can aggregate metrics using:

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
| `pass_rate` | Percentage of "success"/"pass"/true/1 values |
| `fail_rate` | Percentage of "error"/"fail"/false/0 values |
| `first` | First value |
| `last` | Last value |

### Comparison Operators

| Operator | Description |
|----------|-------------|
| `==` | Equal to |
| `!=` | Not equal to |
| `<` | Less than |
| `<=` | Less than or equal to |
| `>` | Greater than |
| `>=` | Greater than or equal to |

### Baseline Types

| Type | Description | Required Fields |
|------|-------------|----------------|
| `fixed` | Compare against a fixed threshold | `threshold` |
| `previous` | Compare against previous run | `maxDelta` (optional) |
| `main` | Compare against main branch baseline | `maxDelta` (optional) |

### Source Configuration

**CSV Source Config:**
```yaml
sources:
  csv:
    metrics:
      - column: accuracy          # Column name
        aggregate: avg            # Aggregation method
        as: accuracy_score        # Optional: rename metric
    evalName:
      fixed: my-eval             # Fixed eval name
      # OR
      # column: eval_name        # Extract from column
    runId:
      fixed: run-123             # Fixed run ID
      # OR
      # column: run_id           # Extract from column
```

**JSON Source Config:**
```yaml
sources:
  json:
    metrics:
      - column: accuracy
        aggregate: first
    evalName:
      fixed: my-eval
```

Note: JSON files in normalized format (with `evalName`, `runId`, `metrics` at top level) are auto-detected and don't require source config.

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Eval Check

on: [pull_request]

jobs:
  eval-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Run evals
        run: npm run evals  # Your eval command
      
      - name: Install Geval
        run: npm install -g @geval-labs/cli
      
      - name: Check eval results
        run: |
          geval check \
            --contract contract.yaml \
            --eval eval-results.csv
```

### GitLab CI

```yaml
eval-check:
  image: node:18
  script:
    - npm install -g @geval-labs/cli
    - npm run evals
    - geval check --contract contract.yaml --eval eval-results.csv
```

### Exit Codes

| Code | Status | Description |
|------|--------|-------------|
| `0` | PASS | All evals passed contract requirements |
| `1` | BLOCK | Contract violated, release blocked |
| `2` | REQUIRES_APPROVAL | Approval needed to proceed |
| `3` | ERROR | Execution error |

---

## Programmatic Usage

### Installation

```bash
npm install @geval-labs/core
```

### Basic Usage

```typescript
import {
  parseContractFromYaml,
  parseEvalFile,
  evaluate,
  formatDecision,
  type Decision,
} from "@geval-labs/core";
import { readFileSync } from "fs";

// Load contract
const contractYaml = readFileSync("contract.yaml", "utf-8");
const contract = parseContractFromYaml(contractYaml);

// Parse eval results
const csvContent = readFileSync("results.csv", "utf-8");
const evalResult = parseEvalFile(csvContent, "results.csv", contract);

// Evaluate
const decision = evaluate({
  contract,
  evalResults: [evalResult],
  baselines: {},
});

// Check result
console.log(decision.status); // "PASS" | "BLOCK" | "REQUIRES_APPROVAL"

// Format output
console.log(formatDecision(decision, { colors: true, verbose: true }));
```

### With Baseline Comparison

```typescript
import { evaluate, type BaselineData } from "@geval-labs/core";

const decision = evaluate({
  contract,
  evalResults: [currentResult],
  baselines: {
    "my-eval": {
      type: "previous",
      metrics: baselineResult.metrics,
      source: { runId: baselineResult.runId },
    },
  },
});
```

### Available Exports

**Core Functions:**
- `parseContract(data)` - Parse contract from object
- `parseContractFromYaml(yaml)` - Parse contract from YAML string
- `validateContract(contract)` - Validate contract semantics
- `evaluate(input)` - Evaluate contract against results
- `parseEvalFile(content, filePath, contract)` - Parse eval file (CSV/JSON/JSONL)
- `parseEvalResult(data)` - Parse normalized eval result
- `diffEvalResults(previous, current)` - Compare eval results
- `diffContracts(previous, current)` - Compare contracts
- `formatDecision(decision, options)` - Format decision output

**Adapters:**
- `GenericAdapter` - Generic JSON adapter
- `PromptfooAdapter` - Promptfoo format adapter
- `LangSmithAdapter` - LangSmith format adapter
- `OpenEvalsAdapter` - OpenEvals format adapter
- `detectAdapter(data)` - Auto-detect adapter
- `parseWithAdapter(data, adapterName)` - Parse with specific adapter

**Types:**
- `EvalContract` - Contract type
- `Decision` - Evaluation decision
- `Violation` - Rule violation
- `NormalizedEvalResult` - Normalized eval result
- `BaselineData` - Baseline data structure

---

## Examples & Tutorials

We provide comprehensive examples in the [`examples/`](./examples/) directory:

- **[Example 1: Performance Monitoring](./examples/example-1-performance/)** - API performance metrics (latency, throughput, error rates)
- **[Example 2: Safety & Compliance](./examples/example-2-safety/)** - AI safety metrics (toxicity, bias, PII leakage)
- **[Example 3: Multi-Eval Comparison](./examples/example-3-multi-eval/)** - Comprehensive evaluation across multiple test suites
- **[Complete Walkthrough](./examples/complete-walkthrough/)** - Full workflow demonstration

Run all examples:
```bash
cd examples
npm install
npx tsx run-all-examples.ts
```

---

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@geval-labs/cli`](https://www.npmjs.com/package/@geval-labs/cli) | Command-line interface | [![npm](https://img.shields.io/npm/v/@geval-labs/cli.svg)](https://www.npmjs.com/package/@geval-labs/cli) |
| [`@geval-labs/core`](https://www.npmjs.com/package/@geval-labs/core) | Core library for programmatic use | [![npm](https://img.shields.io/npm/v/@geval-labs/core.svg)](https://www.npmjs.com/package/@geval-labs/core) |

---

## Development

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Setup

```bash
# Clone repository
git clone https://github.com/geval-labs/geval.git
cd geval

# Install dependencies
npm install

# Build packages
npm run build

# Run tests
npm test

# Run linting
npm run lint
```

### Project Structure

```text
packages/
├── core/          # Core library: contract parsing, evaluation engine, adapters
└── cli/           # Command-line interface

examples/          # Complete working examples
├── example-1-performance/
├── example-2-safety/
├── example-3-multi-eval/
└── complete-walkthrough/
```

### Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT © [Geval Contributors](https://github.com/geval-labs/geval/graphs/contributors)

---

<p align="center">
  <a href="https://geval.io">Website</a> •
  <a href="https://github.com/geval-labs/geval">GitHub</a> •
  <a href="https://www.npmjs.com/package/@geval-labs/cli">npm</a> •
  <a href="https://geval.io/docs">Documentation</a>
</p>
