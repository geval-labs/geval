<p align="center">
  <img src="https://geval.io/white_bg_greenlogo.svg" alt="Geval" width="180" />
</p>

<h1 align="center">Geval</h1>

<p align="center">
  <strong>Eval-driven release gates for AI applications</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@geval-labs/cli"><img src="https://img.shields.io/npm/v/@geval-labs/cli.svg" alt="npm"></a>
  <a href="https://github.com/geval-labs/geval/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT"></a>
  <a href="https://github.com/geval-labs/geval/actions"><img src="https://github.com/geval-labs/geval/workflows/CI/badge.svg" alt="CI"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="https://geval.io/docs">Docs</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## What is Geval?

Geval turns eval results into **automated pass/fail decisions** in CI/CD.

- ❌ Not an eval runner
- ✅ Consumes eval outputs from any tool (Promptfoo, LangSmith, CSV, JSON)
- ✅ Enforces quality contracts
- ✅ Blocks PRs when evals fail thresholds

```
Your Evals → Geval Contract → CI Pass/Block
```

---

## Quick Start

### Install

```bash
npm install -g @geval-labs/cli
```

### 1. Create a contract

```yaml
# contract.yaml
version: 1
name: quality-gate

sources:
  csv:
    metrics:
      - column: accuracy
        aggregate: avg
      - column: latency
        aggregate: p95
    evalName:
      fixed: my-eval

requiredEvals:
  - name: my-eval
    rules:
      - metric: accuracy
        operator: ">="
        baseline: fixed
        threshold: 0.85

onViolation:
  action: block
```

### 2. Run

```bash
geval check --contract contract.yaml --eval results.csv
```

### 3. Output

```
✓ PASS — All evals passed contract requirements

# or

✗ BLOCK — accuracy: 0.72 < 0.85 (threshold)
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-format support** | CSV, JSON, JSONL from any eval tool |
| **Inline source config** | Define CSV parsing in the contract itself |
| **Baseline comparisons** | Compare against previous runs or fixed thresholds |
| **CI-native exit codes** | 0=pass, 1=block, 2=approval needed |
| **JSON output** | `--json` for programmatic use |

---

## CLI Commands

```bash
geval check     # Enforce contract against eval results
geval diff      # Compare two eval runs
geval validate  # Validate a contract file
geval explain   # Detailed pass/fail explanation
```

### Examples

```bash
# Basic check
geval check -c contract.yaml -e results.json

# With baseline comparison
geval check -c contract.yaml -e results.json -b baseline.json

# JSON output for CI
geval check -c contract.yaml -e results.csv --json

# Compare runs
geval diff --previous baseline.json --current new.json
```

---

## Contract Reference

```yaml
version: 1
name: string              # Required
description: string       # Optional
environment: production   # Optional: production | staging | development

sources:                  # Optional: inline CSV/JSON parsing config
  csv:
    metrics:
      - column: accuracy
        aggregate: avg    # avg | sum | min | max | p50 | p90 | p95 | p99 | pass_rate | fail_rate
      - column: latency
        aggregate: p95
        as: latency_p95   # Optional: rename the metric
    evalName:
      fixed: my-eval      # or use a column name

requiredEvals:
  - name: eval-name
    rules:
      - metric: accuracy
        operator: ">="    # == | != | < | <= | > | >=
        baseline: fixed   # fixed | previous | main
        threshold: 0.85   # Required for baseline: fixed
        maxDelta: 0.05    # Required for baseline: previous/main

onViolation:
  action: block           # block | require_approval | warn
```

---

## CI/CD Integration

```yaml
# .github/workflows/eval.yml
- name: Check Evals
  run: |
    npm install -g @geval-labs/cli
    geval check --contract contract.yaml --eval results.csv
```

Exit codes: `0` PASS · `1` BLOCK · `2` REQUIRES_APPROVAL · `3` ERROR

---

## Packages

| Package | Description |
|---------|-------------|
| [`@geval-labs/cli`](https://www.npmjs.com/package/@geval-labs/cli) | Command-line interface |
| [`@geval-labs/core`](https://www.npmjs.com/package/@geval-labs/core) | Core library for programmatic use |

### Programmatic Usage

```typescript
import { parseContract, evaluate, parseEvalFile } from "@geval-labs/core";

const contract = parseContractFromYaml(fs.readFileSync("contract.yaml", "utf-8"));
const result = parseEvalFile(csvContent, "results.csv", contract);
const decision = evaluate({ contract, evalResults: [result], baselines: {} });

console.log(decision.status); // "PASS" | "BLOCK" | "REQUIRES_APPROVAL"
```

---

## Development

```bash
git clone https://github.com/geval-labs/geval.git
cd geval
npm install
npm run build
npm test
```

**Structure:**
```
packages/
├── core/    # Contract parsing, evaluation engine, adapters
└── cli/     # Command-line interface
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome!

---

## License

MIT © [Geval Contributors](https://github.com/geval-labs/geval/graphs/contributors)

<p align="center">
  <a href="https://geval.io">geval.io</a> · 
  <a href="https://github.com/geval-labs/geval">GitHub</a> · 
  <a href="https://www.npmjs.com/package/@geval-labs/cli">npm</a>
</p>
