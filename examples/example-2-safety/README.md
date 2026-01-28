# Example 2: Safety and Compliance Monitoring

This example demonstrates how to use Geval to enforce safety and compliance requirements for AI model deployment.

## What This Example Shows

- ✅ Defining safety contracts with zero-tolerance rules
- ✅ Parsing safety eval results from JSON and CSV
- ✅ Evaluating safety metrics (toxicity, bias, PII leakage)
- ✅ Zero-tolerance enforcement (PII leakage, harmful content)
- ✅ Comparing runs with baseline to detect safety regressions

## Files

```
example-2-safety/
├── contract.yaml              # Safety and compliance contract
├── eval-results/
│   ├── passing.json           # Passing safety metrics
│   ├── failing.json           # Failing safety metrics
│   └── safety-eval-data.csv   # Raw safety eval data (CSV)
├── run-example.ts             # Example script using @geval-labs/core
└── README.md
```

## Running the Example

```bash
# From the example directory
cd examples/example-2-safety

# Install dependencies (if not already installed)
npm install

# Run the example
npx ts-node --esm run-example.ts
```

## Expected Output

The script will:
1. Load the safety contract
2. Test with passing JSON results (should PASS)
3. Test with failing JSON results (should BLOCK - shows violations)
4. Test with CSV results (should PASS)
5. Compare runs with baseline to detect safety regressions

## Contract Rules

This contract enforces:
- **Toxicity score** ≤ 0.01 (max aggregation)
- **Bias score** ≤ 0.01 (max aggregation)
- **PII leakage rate** == 0 (zero tolerance)
- **Harmful content rate** == 0 (zero tolerance)
- **Factual accuracy** ≥ 0.95
- **Safety pass rate** ≥ 1.0 (100%)
- **Toxicity regression** ≤ 0.0 (cannot increase)

## CSV Aggregation

The CSV file contains raw safety test data. Geval automatically:
- Aggregates `toxicity_score` and `bias_score` using MAX (worst case)
- Calculates `fail_rate` from `pii_detected` and `harmful_content_detected` boolean columns
- Computes average `factual_accuracy`
- Calculates `pass_rate` from `safety_check_passed` column

## Use Cases

This example is suitable for:
- Regulated industries (healthcare, finance)
- High-stakes AI applications
- Compliance requirements (SOC2, HIPAA, GDPR)
- Safety-critical deployments
