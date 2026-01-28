# Examples Summary

This document provides a quick overview of all available examples.

## Quick Start

```bash
# Run all examples
cd examples
npm install
npx ts-node --esm run-all-examples.ts

# Or run individual examples
cd example-1-performance
npm install && npm run run
```

## Example Overview

### Example 1: Performance Monitoring
**Focus:** API performance metrics (latency, throughput, error rates)

**Key Features:**
- P95/P99 latency thresholds
- Throughput requirements
- Error rate monitoring
- Regression detection (comparing with baseline)

**Files:**
- `contract.yaml` - Performance contract
- `eval-results/passing.json` - Passing metrics
- `eval-results/failing.json` - Failing metrics  
- `eval-results/performance-data.csv` - Raw CSV data
- `run-example.ts` - Complete example script

### Example 2: Safety and Compliance
**Focus:** AI safety metrics (toxicity, bias, PII leakage)

**Key Features:**
- Zero-tolerance rules (PII leakage, harmful content)
- Toxicity and bias detection
- Safety regression detection
- Compliance metadata

**Files:**
- `contract.yaml` - Safety contract
- `eval-results/passing.json` - Passing safety metrics
- `eval-results/failing.json` - Failing safety metrics
- `eval-results/safety-eval-data.csv` - Raw safety eval data
- `run-example.ts` - Complete example script

### Example 3: Multi-Eval Comparison
**Focus:** Comprehensive evaluation across multiple test suites

**Key Features:**
- Multiple eval suites (accuracy, performance, cost, UX)
- Baseline comparison for each suite
- Cross-suite evaluation
- Handling multiple eval results

**Files:**
- `contract.yaml` - Multi-eval contract
- `eval-results/*-suite.json` - Individual eval suite results
- `eval-results/baseline-*-suite.json` - Baseline results
- `eval-results/multi-eval-data.csv` - CSV with multiple suites
- `run-example.ts` - Complete example script

## Common Patterns

All examples demonstrate:

1. **Contract Loading**
   ```typescript
   const contract = parseContractFromYaml(contractYaml);
   ```

2. **Parsing Eval Results**
   ```typescript
   // From JSON
   const result = parseEvalFile(jsonContent, "results.json", contract);
   
   // From CSV
   const result = parseEvalFile(csvContent, "results.csv", contract);
   ```

3. **Evaluation**
   ```typescript
   const decision = evaluate({
     contract,
     evalResults: [result],
     baselines: {},
   });
   ```

4. **Baseline Comparison**
   ```typescript
   const decision = evaluate({
     contract,
     evalResults: [currentResult],
     baselines: {
       [baselineResult.evalName]: {
         type: "previous",
         metrics: baselineResult.metrics,
         source: { runId: baselineResult.runId },
       },
     },
   });
   ```

5. **Formatting Output**
   ```typescript
   console.log(formatDecision(decision, { colors: true, verbose: true }));
   ```

## Testing

To verify all examples work:

```bash
cd examples
npm install
npx ts-node --esm run-all-examples.ts
```

This will:
- Install dependencies for each example
- Run each example script
- Report success/failure for each
- Provide a summary

## Next Steps

1. Review the contract YAML files to understand contract structure
2. Examine the eval result files (JSON/CSV) to see data formats
3. Study the TypeScript scripts to see programmatic usage
4. Adapt contracts and scripts to your use case
5. Integrate into your CI/CD pipeline

## Integration Tips

- **CI/CD:** Use exit codes from `decision.status` (0=PASS, 1=BLOCK)
- **Monitoring:** Log decisions and violations for observability
- **Baselines:** Store previous run results for regression detection
- **Contracts:** Version control your contracts alongside code
- **Eval Results:** Use consistent naming conventions for eval suites
