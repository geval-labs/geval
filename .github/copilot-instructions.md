# Geval - AI Coding Instructions

## Project Overview

Geval is an **eval-driven release decision framework** for AI systems. It consumes evaluation results (from Promptfoo, LangSmith, etc.) and produces deterministic release decisions: PASS / REQUIRE_APPROVAL / BLOCK.

**Core Philosophy**: Geval does NOT run evals or monitor production—it makes release decisions based on existing eval results and signals.

## Architecture

### Monorepo Structure (Turborepo)

```
packages/
  cli/          - Command-line interface (@geval-labs/cli)
  core/         - Core decision engine (@geval-labs/core)
  shared/       - Shared utilities
  test-cli-e2e/ - End-to-end CLI tests
examples/       - Standalone examples with contracts and eval results
```

**Build Commands**:

- `npm run build` - Build all packages via Turbo (respects dependency graph)
- `npm run dev` - Watch mode for all packages
- `npm run test` - Run tests across all packages
- Package builds depend on upstream packages: `cli` depends on `core`

### Core Data Flow

```
Eval Results (JSON/CSV) → Adapter → NormalizedEvalResult
Contract (YAML) → Parser → EvalContract
[evalResults, contract, baselines, signals] → evaluate() → Decision
Decision → DecisionRecord (with cryptographic hash)
```

## Key Patterns

### 1. TypeScript Configuration

- **Module System**: `NodeNext` (ESM-first, requires `.js` in imports)
- **Import Style**: `import { foo } from "./bar.js"` (even for `.ts` files)
- **Build Tool**: `tsup` for all packages
- **Type Safety**: Strict mode, `noUncheckedIndexedAccess` enabled

### 2. Exit Codes (CLI Integration)

The CLI uses **semantic exit codes** for CI/CD automation:

- `0` - PASS (deployment allowed)
- `1` - BLOCK (deployment blocked)
- `2` - REQUIRES_APPROVAL (manual approval needed)
- `3` - ERROR (system error)

### 3. Contract Structure

Contracts are YAML files with two main modes:

**Policy-based** (environment-aware, signal-driven):

```yaml
policy:
  environments:
    production:
      default: require_approval
      rules:
        - when:
            eval:
              metric: pass_rate
              operator: ">="
              threshold: 0.90
          then:
            action: pass
```

**Eval-based** (simpler, metric-only):

```yaml
required_evals:
  - name: quality-gate
    rules:
      - metric: accuracy
        operator: ">="
        baseline: fixed
        threshold: 0.85
```

### 4. Adapters (Eval Framework Integration)

Adapters parse framework-specific outputs into `NormalizedEvalResult`:

- `PromptfooAdapter` - Promptfoo JSON outputs
- `LangSmithAdapter` - LangSmith exports
- `GenericAdapter` - Generic JSON format
- CSV parsing via `sources/csv-parser.ts` with configurable aggregation

Auto-detection via `detectAdapter()` and `detectFileType()`.

### 5. Baseline Comparison

Supports regression detection:

```typescript
const decision = evaluate({
  contract,
  evalResults: [currentResult],
  baselines: {
    "eval-name": baselineResult, // Compare against previous run
  },
});
```

Baseline types: `fixed` (absolute threshold) or `previous` (relative comparison).

## Development Workflows

### Adding a New Adapter

1. Create `packages/core/src/adapters/my-adapter.ts`
2. Implement `EvalAdapter` interface with `parse()` and `detect()` methods
3. Export from `packages/core/src/adapters/index.ts`
4. Add to `detectAdapter()` array in `adapters/detect.ts`
5. Add tests in `packages/core/src/adapters/__tests__/`

### Adding a New CLI Command

1. Create `packages/cli/src/commands/my-command.ts`
2. Export command function: `export async function myCommand(options: MyOptions)`
3. Export from `packages/cli/src/index.ts`
4. Wire up in `packages/cli/src/cli.ts` (Commander.js setup)
5. Document exit codes if applicable

### Working with Examples

Examples in `examples/` are **standalone projects** (not part of monorepo workspace):

- Each has its own `package.json` and dependencies
- Run with `cd examples/example-X && npm install && npm run run`
- Use `npm run run-all` from `examples/` to run all

## Testing Strategy

- **Unit Tests**: Vitest in `packages/*/src/**/__tests__/`
- **E2E Tests**: `packages/test-cli-e2e/` for CLI integration tests
- **Coverage**: `npm run test:coverage` generates reports in `coverage/`

## Common Gotchas

### 1. ESM Import Extensions

Always include `.js` extension in imports, even for TypeScript files:

```typescript
// ✅ Correct
import { foo } from "./bar.js";

// ❌ Wrong
import { foo } from "./bar";
```

### 2. Decision Record Hash

`createDecisionRecord()` generates a SHA-256 hash of decision inputs—this is for auditability, not cryptographic security. Include eval results, contract, signals, and environment.

### 3. Signal Integration

Signals (human approvals, risk flags) are **optional inputs** to `evaluate()`. They work with policy-based contracts via signal conditions:

```yaml
- when:
    signal:
      type: human_approval
      status: approved
  then:
    action: pass
```

### 4. Turbo Cache

Turbo caches builds in `.turbo/`. If seeing stale builds, run `npm run clean` or delete `.turbo/`.

## File Naming Conventions

- Source: `kebab-case.ts` (e.g., `csv-parser.ts`)
- Tests: `__tests__/my-file.test.ts`
- Types: `types/index.ts` for exports, individual files in `types/` for definitions
- Barrel exports: `index.ts` in each major directory

## Dependencies

- **Validation**: Zod for schema validation (all public types have Zod schemas)
- **CLI**: Commander.js for command parsing, picocolors for terminal colors
- **Build**: tsup (esbuild wrapper) for fast TypeScript builds
- **Monorepo**: Turborepo for orchestration, npm workspaces for package management

## When to Use Core vs CLI

- **@geval-labs/core**: Library for programmatic integration (use in CI scripts, custom tools)
- **@geval-labs/cli**: Command-line interface for terminal/CI usage (use in GitHub Actions, shell scripts)

Examples show both patterns—see `examples/*/run-example.ts` for programmatic usage.
