# @geval/core

Core library for Geval - eval-driven release enforcement for AI.

## Installation

```bash
npm install @geval/core
```

## Usage

```typescript
import { 
  evaluate, 
  parseContract, 
  parseEvalResult 
} from "@geval/core";

// Parse your contract
const contract = parseContract({
  version: 1,
  name: "my-contract",
  requiredEvals: [
    {
      name: "safety",
      rules: [
        { metric: "hallucination_rate", operator: "<=", baseline: "fixed", threshold: 0.05 }
      ]
    }
  ],
  onViolation: { action: "block" }
});

// Parse eval results
const evalResults = [parseEvalResult(evalData)];

// Evaluate
const decision = evaluate({
  contract,
  evalResults,
  baselines: {}
});

console.log(decision.status); // "PASS" or "BLOCK"
```

## API

### `parseContract(data)`

Parse and validate a contract from a JavaScript object.

### `parseContractFromYaml(yamlString)`

Parse a contract from a YAML string.

### `evaluate(input)`

Evaluate a contract against eval results. Returns a `Decision` object.

### `parseEvalResult(data)`

Parse eval results with auto-detection of format.

## License

MIT
