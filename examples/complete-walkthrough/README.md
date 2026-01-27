# Geval Complete Walkthrough

This example demonstrates the full Geval workflow from start to finish.

## Prerequisites

```bash
npm install @geval-labs/core @geval-labs/cli
```

## Files in This Example

```
complete-walkthrough/
├── contracts/
│   └── quality-contract.yaml    # Contract with inline source config
├── eval-results/
│   ├── passing-run.json         # JSON eval results that PASS
│   ├── failing-run.json         # JSON eval results that BLOCK
│   └── langsmith-export.csv     # CSV from LangSmith (or any eval tool)
├── scripts/
│   ├── check-json.sh            # CLI example with JSON
│   ├── check-csv.ts             # Programmatic example with CSV
│   └── ci-integration.ts        # Full CI integration example
└── README.md
```

## The Key Feature: Inline Source Config

The contract now includes a `sources` section that tells Geval how to parse CSV files directly:

```yaml
version: 1
name: ai-quality-gate

# ═══════════════════════════════════════════════════
# SOURCES: How to parse CSV/JSON files
# ═══════════════════════════════════════════════════
sources:
  csv:
    metrics:
      - column: accuracy
        aggregate: avg
      - column: latency
        aggregate: p95
        as: latency_p95
      - column: hallucination_rate
        aggregate: avg
    evalName:
      fixed: quality-metrics

# ═══════════════════════════════════════════════════
# RULES: What must pass
# ═══════════════════════════════════════════════════
required_evals:
  - name: quality-metrics
    rules:
      - metric: accuracy
        operator: ">="
        baseline: fixed
        threshold: 0.85
      # ... more rules

on_violation:
  action: block
```

## Step 1: Run with JSON Results

```bash
# Validate the contract
npx geval validate contracts/quality-contract.yaml

# Check passing JSON results
npx geval check \
  --contract contracts/quality-contract.yaml \
  --eval eval-results/passing-run.json
```

Expected output:
```
✓ PASS

Contract:    ai-quality-gate
Version:     1

All 1 eval(s) passed contract requirements
```

## Step 2: Run with CSV Results (Zero Extra Config!)

**This is the magic - CSV just works!**

```bash
npx geval check \
  --contract contracts/quality-contract.yaml \
  --eval eval-results/langsmith-export.csv
```

Geval automatically:
1. Detects the `.csv` extension
2. Uses the `sources.csv` config from the contract
3. Aggregates metrics using the specified methods
4. Evaluates against the rules

## Step 3: See Failing Results

```bash
npx geval check \
  --contract contracts/quality-contract.yaml \
  --eval eval-results/failing-run.json
```

Expected output:
```
✗ BLOCK

Contract:    ai-quality-gate
Version:     1

Blocked: 2 violation(s) in 1 eval

Violations

  1. quality-metrics → accuracy
     accuracy = 0.78, expected >= 0.85

  2. quality-metrics → hallucination_rate
     hallucination_rate = 0.08, expected <= 0.05
```

## Step 4: Compare Runs

```bash
npx geval diff \
  --previous eval-results/passing-run.json \
  --current eval-results/failing-run.json
```

## CI/CD Integration

The simplest CI workflow:

```yaml
# .github/workflows/eval-check.yml
name: AI Quality Gate

on: [pull_request]

jobs:
  eval-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run your evals
        run: npm run evals  # Outputs CSV or JSON
      
      - name: Enforce quality gate
        run: |
          npm install -g @geval-labs/cli
          geval check \
            --contract contracts/quality-contract.yaml \
            --eval eval-results.csv
```

**That's it!** The contract has everything Geval needs - no extra config files.

## Running All Examples

```bash
# Install dependencies
npm install

# Run CLI examples
./scripts/check-json.sh

# Run programmatic examples
npx ts-node scripts/check-csv.ts
npx ts-node scripts/ci-integration.ts
```

## Aggregation Methods Available

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
| `pass_rate` | % of "success"/"pass"/true/1 values |
| `fail_rate` | % of "error"/"fail"/false/0 values |
| `first` | First value |
| `last` | Last value |
