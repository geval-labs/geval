# Geval Examples

This directory contains example signals and policy for the Geval decision engine.

## Files

- **signals.json** – Example signals (eval metrics, A/B metrics, component-level metrics).
- **policy.yaml** – Example policy with priority-ordered rules: business block, hallucination guard, retrieval quality.

## Run (from repo root)

```bash
# Build the CLI
cargo build --release

# Check: evaluate signals against policy (exit 0=PASS, 1=REQUIRE_APPROVAL, 2=BLOCK)
./target/release/geval check --signals examples/signals.json --policy examples/policy.yaml --env prod

# Explain: human-readable decision report
./target/release/geval explain --signals examples/signals.json --policy examples/policy.yaml --env prod

# Validate policy syntax
./target/release/geval validate-policy examples/policy.yaml
```

With the example data, the first matching rule is `business_block` (priority 1): `engagement_drop` 0.03 > 0, so the decision is **BLOCK**.

## Signal format

Signals are JSON with optional context fields:

- `system`, `agent`, `component`, `step`, `metric`, `value`
- Optional `type` (e.g. `ab_test`)

The engine builds a signal graph (system → agent → component → step → signal) and matches policy rules by metric (and optional component) with operators: `>`, `<`, `>=`, `<=`, `==`, `presence`.

## Policy format

- `policy.environment`: optional environment name.
- `policy.rules`: list of rules, each with:
  - `priority`: lower number evaluated first.
  - `name`: rule identifier.
  - `when`: condition (metric, optional component, operator, threshold).
  - `then`: action (`pass` | `block` | `require_approval`) and optional `reason`.

First matching rule wins; if none match, decision is **PASS**.
