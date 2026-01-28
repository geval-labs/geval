# Example 1: Performance Monitoring

This example demonstrates how to use Geval to enforce performance requirements for API endpoints.

## What This Example Shows

- ✅ Defining performance contracts (latency, throughput, error rates)
- ✅ Parsing eval results from JSON files
- ✅ Parsing eval results from CSV files (with aggregation)
- ✅ Evaluating metrics against fixed thresholds
- ✅ Comparing runs with baseline (previous run) to detect regressions

## Files

```
example-1-performance/
├── contract.yaml              # Performance contract definition
├── eval-results/
│   ├── passing.json           # Passing performance metrics
│   ├── failing.json           # Failing performance metrics
│   └── performance-data.csv   # Raw performance data (CSV)
├── run-example.ts             # Example script using @geval-labs/core
└── README.md
```

## Running the Example

```bash
# From the example directory
cd examples/example-1-performance

# Install dependencies (if not already installed)
npm install

# Run the example
npx ts-node --esm run-example.ts
```

## Expected Output

The script will:
1. Load the performance contract
2. Test with passing JSON results (should PASS)
3. Test with failing JSON results (should BLOCK)
4. Test with CSV results (should PASS)
5. Compare runs with baseline to detect regressions

## Contract Rules

This contract enforces:
- **P95 latency** ≤ 200ms
- **P99 latency** ≤ 500ms
- **Throughput** ≥ 1000 req/s
- **Error rate** ≤ 0.1%
- **Success rate** ≥ 99.9%
- **Latency regression** ≤ 10ms from previous run

## CSV Aggregation

The CSV file contains raw request data. Geval automatically:
- Aggregates `latency_ms` using P95 and P99 percentiles
- Calculates average `requests_per_second` as throughput
- Computes average `error_rate`
- Calculates `pass_rate` from `status` column as success_rate
