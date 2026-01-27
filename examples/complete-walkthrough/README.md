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
│   └── quality-contract.yaml    # Eval contract defining quality requirements
├── eval-results/
│   ├── passing-run.json         # Eval results that PASS
│   ├── failing-run.json         # Eval results that BLOCK
│   └── langsmith-export.csv     # Example CSV from LangSmith
├── source-configs/
│   └── langsmith-csv.yaml       # Config for parsing LangSmith CSV
├── scripts/
│   ├── check-json.sh            # CLI example with JSON
│   ├── check-csv.ts             # Programmatic example with CSV
│   └── ci-integration.ts        # Full CI integration example
└── README.md
```

## Step 1: Understand the Contract

Look at `contracts/quality-contract.yaml`:

```yaml
version: 1
name: ai-quality-gate
description: Quality requirements for AI deployment

required_evals:
  - name: quality-metrics
    rules:
      - metric: accuracy
        operator: ">="
        baseline: fixed
        threshold: 0.85
      - metric: latency_p95
        operator: "<="
        baseline: fixed
        threshold: 500
      - metric: hallucination_rate
        operator: "<="
        baseline: fixed
        threshold: 0.05

on_violation:
  action: block
```

## Step 2: Run with Passing Eval Results

```bash
# Validate the contract
npx geval validate contracts/quality-contract.yaml

# Check passing results
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

## Step 3: Run with Failing Eval Results

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

## Step 4: Work with CSV (LangSmith, etc.)

```bash
npx ts-node scripts/check-csv.ts
```

This demonstrates:
1. Parsing a CSV file with custom column mapping
2. Aggregating metrics (avg, p95, pass_rate)
3. Running evaluation against a contract

## Step 5: Compare Runs

```bash
npx geval diff \
  --previous eval-results/passing-run.json \
  --current eval-results/failing-run.json
```

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
