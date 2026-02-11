# Example 3: Multi-Eval Comparison

This example demonstrates how to use Geval to enforce requirements across multiple evaluation suites simultaneously.

## What This Example Shows

- ✅ Defining contracts with multiple required evals
- ✅ Loading and evaluating multiple eval results together
- ✅ Comparing each eval suite with its baseline
- ✅ Handling different metrics for different eval suites
- ✅ Comprehensive evaluation across accuracy, performance, cost, and UX

## Files

```
example-3-multi-eval/
├── contract.yaml                          # Multi-eval contract definition
├── eval-results/
│   ├── accuracy-suite.json               # Accuracy eval results
│   ├── performance-suite.json            # Performance eval results
│   ├── cost-suite.json                   # Cost eval results
│   ├── user-experience-suite.json        # UX eval results
│   ├── baseline-accuracy-suite.json     # Baseline for accuracy
│   ├── baseline-performance-suite.json    # Baseline for performance
│   ├── baseline-cost-suite.json          # Baseline for cost
│   ├── baseline-user-experience-suite.json # Baseline for UX
│   └── multi-eval-data.csv              # CSV with multiple eval suites
├── run-example.ts                         # Example script using @geval-labs/core
└── README.md
```

## Running the Example

```bash
# From the example directory
cd examples/example-3-multi-eval

# Install dependencies (if not already installed)
npm install

# Run the example
npx ts-node --esm run-example.ts
```

## Expected Output

The script will:

1. Load the multi-eval contract
2. Load all current eval results from JSON files
3. Evaluate all evals together
4. Load baselines and compare each eval suite
5. Show how CSV with multiple eval suites would be handled

## Contract Rules

This contract enforces requirements for 4 different eval suites:

### Accuracy Suite

- **Accuracy** ≥ 0.90 (fixed threshold)
- **Accuracy** ≥ previous - 0.02 (max regression)

### Performance Suite

- **Latency P95** ≤ 300ms (fixed threshold)
- **Latency P95** ≤ previous + 50ms (max regression)

### Cost Suite

- **Cost per request** ≤ $0.01 (fixed threshold)
- **Cost** ≤ previous + $0.001 (max increase)

### User Experience Suite

- **User satisfaction** ≥ 4.0/5.0 (fixed threshold)
- **User satisfaction** ≥ previous (no regression)

## Use Cases

This example is suitable for:

- Comprehensive release gates
- Multi-dimensional quality checks
- Cost-performance tradeoffs
- Full-stack evaluation pipelines
