# Geval Examples

This directory contains complete, working examples demonstrating how to use `@geval-labs/core` for eval-driven release enforcement.

## Examples

### Example 1: Performance Monitoring

**Location:** `example-1-performance/`

Demonstrates performance monitoring for API endpoints:

- Latency requirements (P95, P99)
- Throughput requirements
- Error rate monitoring
- Regression detection

**Run it:**

```bash
cd example-1-performance
npm install
npm run run
```

### Example 2: Safety and Compliance

**Location:** `example-2-safety/`

Demonstrates safety and compliance enforcement:

- Toxicity and bias detection
- PII leakage prevention (zero tolerance)
- Harmful content detection
- Safety regression detection

**Run it:**

```bash
cd example-2-safety
npm install
npm run run
```

### Example 3: Multi-Eval Comparison

**Location:** `example-3-multi-eval/`

Demonstrates comprehensive evaluation across multiple suites:

- Multiple eval suites (accuracy, performance, cost, UX)
- Baseline comparison for each suite
- Cross-suite evaluation

**Run it:**

```bash
cd example-3-multi-eval
npm install
npm run run
```

## Running All Examples

To test all examples end-to-end:

```bash
# From the examples directory
npm install
npx ts-node --esm run-all-examples.ts
```

Or from the root directory:

```bash
cd examples
npx ts-node --esm run-all-examples.ts
```

## What Each Example Includes

Each example contains:

- ✅ **Contract YAML** - Defines requirements and source parsing config
- ✅ **Eval Results** - Sample JSON and CSV files with eval data
- ✅ **TypeScript Script** - Complete programmatic usage example
- ✅ **README** - Detailed documentation

## Key Features Demonstrated

- **Contract Parsing** - Loading and validating contracts from YAML
- **Source Parsing** - Parsing JSON and CSV eval results
- **CSV Aggregation** - Aggregating raw CSV data into metrics
- **Evaluation** - Running evaluations against contracts
- **Baseline Comparison** - Comparing runs with previous baselines
- **Violation Detection** - Identifying and reporting violations
- **Decision Making** - PASS/BLOCK/REQUIRES_APPROVAL decisions

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- TypeScript (installed as dev dependency in each example)

## Integration with CI/CD

These examples can be adapted for CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Geval Check
  run: |
    npm install
    npx ts-node --esm run-example.ts
```

## Next Steps

1. Review each example's README for detailed documentation
2. Modify contracts to match your requirements
3. Adapt eval result formats to your eval tooling
4. Integrate into your CI/CD pipeline
