# @geval/cli

Command-line interface for Geval - eval-driven release enforcement for AI.

## Installation

```bash
npm install -g @geval/cli
```

## Usage

### Check (Enforce contracts)

```bash
geval check --contract eval_contract.yaml --eval results.json
```

### Diff (Compare eval runs)

```bash
geval diff --previous baseline.json --current current.json
```

### Explain (Detailed analysis)

```bash
geval explain --contract eval_contract.yaml --eval results.json --verbose
```

### Validate (Check contract syntax)

```bash
geval validate eval_contract.yaml
```

## Exit Codes

- `0` - PASS (all checks passed)
- `1` - BLOCK (contract violated, release blocked)
- `2` - REQUIRES_APPROVAL (approval needed to proceed)
- `3` - ERROR (execution error)

## License

MIT
