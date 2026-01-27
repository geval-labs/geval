<p align="center">
  <img src="https://geval.io/white_bg_greenlogo.svg" alt="Geval" width="200" />
</p>

<h1 align="center">Geval</h1>

<p align="center">
  <strong>Eval-driven release enforcement for AI</strong>
</p>

<p align="center">
  Turn evaluation results into deterministic, auditable go/no-go decisions in CI/CD.
</p>

<p align="center">
  <a href="https://geval.io">Website</a> •
  <a href="https://geval.io/docs">Documentation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#why-geval">Why Geval</a>
</p>

<p align="center">
  <a href="https://github.com/geval-labs/geval/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  </a>
  <a href="https://www.npmjs.com/package/@geval-labs/cli">
    <img src="https://img.shields.io/npm/v/@geval-labs/cli.svg" alt="npm version" />
  </a>
  <a href="https://github.com/geval-labs/geval/actions">
    <img src="https://github.com/geval-labs/geval/workflows/CI/badge.svg" alt="CI" />
  </a>
</p>

---

## The Problem

Teams can run LLM evals, but they cannot reliably turn eval results into **enforced release decisions**.

- ✅ Evals exist
- ❌ Shipping decisions are still manual
- ❌ Results are reviewed via dashboards, Slack, or "vibe checks"
- ❌ CI/CD pipelines don't understand AI behavior
- ❌ Regressions ship because no one blocked the PR

**Existing tools stop at measurement. The missing piece is enforcement.**

## The Solution

Geval is an open-core release enforcement engine that turns eval results into **deterministic go/no-go decisions** inside CI/CD.

```
Evals are not reports. They are release contracts.
```

Geval:
- ❌ Does NOT run evals
- ❌ Does NOT define correctness
- ❌ Does NOT optimize prompts

Geval:
- ✅ Consumes eval outputs
- ✅ Applies explicit contracts
- ✅ Enforces decisions in PRs and CI/CD
- ✅ Blocks unverified AI changes before production

## Quick Start

### Installation

```bash
npm install -g @geval-labs/cli
```

### 1. Define your contract

Create an `eval_contract.yaml`:

```yaml
version: 1
name: safety-checks
environment: production

required_evals:
  - name: safety_v3
    rules:
      - metric: hallucination_rate
        operator: "<="
        baseline: previous
        max_delta: 0.0
      - metric: toxicity_score
        operator: "<="
        baseline: fixed
        threshold: 0.05

on_violation:
  action: block
```

### 2. Run your evals (with any tool)

Use Promptfoo, LangSmith, OpenEvals, or any tool that outputs JSON.

### 3. Enforce with Geval

```bash
geval check \
  --contract eval_contract.yaml \
  --eval results.json
```

Output:

```
✓ PASS

Contract:    safety-checks
Version:     1

All 1 eval(s) passed contract requirements
```

Or when there's a violation:

```
✗ BLOCK

Contract:    safety-checks
Version:     1

Blocked: 1 violation(s) in 1 eval

Violations

  1. safety_v3 → hallucination_rate
     hallucination_rate regressed by +0.0310 (max allowed: 0)
     Actual: 0.031 | Baseline: 0
     Delta: +0.031
```

### 4. Add to CI/CD

```yaml
# .github/workflows/eval.yml
name: Eval Enforcement

on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run evals
        run: npm run eval # Your eval command

      - name: Install Geval
        run: npm install -g @geval-labs/cli

      - name: Enforce contracts
        run: |
          geval check \
            --contract eval_contract.yaml \
            --eval eval-results.json
```

## CLI Commands

### `geval check`

Evaluate contracts against eval results and enforce decisions.

```bash
geval check --contract <path> --eval <paths...> [options]

Options:
  -c, --contract <path>    Path to eval contract (YAML/JSON)
  -e, --eval <paths...>    Path(s) to eval result files (JSON)
  -b, --baseline <path>    Path to baseline eval results (JSON)
  --adapter <name>         Force specific adapter
  --json                   Output results as JSON
  --verbose                Show detailed output
```

Exit codes:
- `0` - PASS
- `1` - BLOCK
- `2` - REQUIRES_APPROVAL
- `3` - ERROR

### `geval diff`

Compare eval results between two runs.

```bash
geval diff --previous <path> --current <path> [options]
```

### `geval explain`

Get detailed explanations for why a contract passed or failed.

```bash
geval explain --contract <path> --eval <paths...> [options]
```

### `geval validate`

Validate a contract file.

```bash
geval validate <path> [options]

Options:
  --strict    Treat warnings as errors
  --json      Output as JSON
```

## Contract Specification

### Basic Structure

```yaml
version: 1                    # Schema version (required)
name: my-contract             # Contract name (required)
description: Optional desc    # Description (optional)
environment: production       # Environment scope (optional)

required_evals:               # List of required evals
  - name: eval_name
    rules:
      - metric: metric_name
        operator: "<="
        baseline: previous
        max_delta: 0.0

on_violation:                 # What to do on failure
  action: block               # block | require_approval | warn
```

### Rule Operators

| Operator | Description |
|----------|-------------|
| `==`     | Equal to |
| `!=`     | Not equal to |
| `<`      | Less than |
| `<=`     | Less than or equal |
| `>`      | Greater than |
| `>=`     | Greater than or equal |

### Baseline Types

| Baseline | Description |
|----------|-------------|
| `previous` | Compare against last successful run |
| `main`     | Compare against main branch artifact |
| `fixed`    | Compare against a fixed threshold |

## Supported Eval Formats

Geval automatically detects and parses results from:

- **Promptfoo** - JSON output from promptfoo
- **LangSmith** - Exported evaluation results (JSON & CSV)
- **OpenEvals** - OpenAI evals format
- **Generic** - Geval's native JSON format
- **CSV** - Any CSV with configurable column mapping

### Generic JSON Format

```json
{
  "evalName": "safety_v3",
  "runId": "abc123",
  "metrics": {
    "hallucination_rate": 0.031,
    "toxicity_score": 0.02
  },
  "metadata": {
    "model": "gpt-4",
    "commit": "a1b2c3d"
  }
}
```

### CSV Support (Any Tool!)

**New: Inline source config in contracts!** Define how to parse CSV directly in your contract:

```yaml
version: 1
name: my-quality-gate

# Tell Geval how to parse CSV files
sources:
  csv:
    metrics:
      - column: accuracy
        aggregate: avg
      - column: latency
        aggregate: p95
      - column: status
        aggregate: pass_rate
    evalName:
      fixed: my-eval

required_evals:
  - name: my-eval
    rules:
      - metric: accuracy
        operator: ">="
        baseline: fixed
        threshold: 0.85

on_violation:
  action: block
```

Then just run:
```bash
geval check --contract contract.yaml --eval results.csv
```

Geval automatically detects CSV and uses your inline config - **no extra files needed!**

Supported aggregations: `avg`, `sum`, `min`, `max`, `p50`, `p90`, `p95`, `p99`, `pass_rate`, `fail_rate`, `count`

#### Programmatic Usage

```typescript
import { parseEvalSource } from "@geval-labs/core";

const csvContent = fs.readFileSync("langsmith-export.csv", "utf-8");

const result = parseEvalSource(csvContent, {
  type: "csv",
  metrics: [
    { column: "accuracy", aggregate: "avg" },
    { column: "latency", aggregate: "p95" },
    { column: "status", aggregate: "pass_rate" }
  ],
  evalName: { fixed: "my-eval" }
});
```

## Why Geval

### Not Another Eval Tool

Geval is **not** an eval platform. It's a decision authority.

| Tool | Category | What it does |
|------|----------|--------------|
| Promptfoo | Eval Execution | Run evals, produce results |
| LangSmith | Observability | Trace and debug LLM calls |
| Helicone | Observability | Log and monitor production |
| Confident AI | Eval Platform | Orchestrate evals, track regressions |
| **Geval** | **Enforcement** | **Block releases based on evals** |

### Key Differentiators

1. **Evals → Decisions → Enforcement**
   - Eval results directly block or allow PRs
   - No manual "interpretation layer"

2. **Contracts, not scores**
   - Teams define what "acceptable" means
   - Geval enforces those rules consistently

3. **CI/CD-native authority**
   - Required checks
   - Non-bypassable without approval

4. **OSS-first trust model**
   - Core logic is inspectable and forkable
   - No vendor-defined correctness

5. **Auditability by default**
   - Every decision has a reason
   - Every override has an owner

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Your CI/CD                           │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Run Evals   │ -> │   Geval     │ -> │  PR Gate    │     │
│  │ (Any Tool)  │    │   Check     │    │  Pass/Block │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                  │                                │
│         v                  v                                │
│  eval_results.json   eval_contract.yaml                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Development

### Prerequisites

- Node.js >= 18
- npm >= 10

### Setup

```bash
# Clone the repository
git clone https://github.com/geval-labs/geval.git
cd geval

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

### Project Structure

```
geval/
├── packages/
│   ├── core/           # Core library (contracts, engine, adapters)
│   └── cli/            # Command-line interface
├── examples/           # Example contracts and workflows
├── docs/               # Documentation
└── scripts/            # Build and release scripts
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- **Website**: [geval.io](https://geval.io)
- **Documentation**: [geval.io/docs](https://geval.io/docs)
- **GitHub**: [github.com/geval-labs/geval](https://github.com/geval-labs/geval)
- **npm**: [@geval-labs/cli](https://www.npmjs.com/package/@geval-labs/cli) | [@geval-labs/core](https://www.npmjs.com/package/@geval-labs/core)

---

<p align="center">
  Built with ❤️ by the Geval team
</p>
