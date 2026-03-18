# Geval Examples

Example contract, policies, and signals for Geval (decision orchestration and reconciliation).

## Files

- **contract.yaml** – Contract: name, version, combine rule, and list of policy paths. This example references a single policy.
- **policy.yaml** – One policy with priority-ordered rules: business block, hallucination guard, retrieval quality.
- **signals.json** – Example signals (eval metrics, A/B metrics, component-level).

## Run (from repo root)

```bash
cargo build --release --manifest-path geval/Cargo.toml

# Check: evaluate signals against contract (exit 0=PASS, 1=REQUIRE_APPROVAL, 2=BLOCK)
./geval/target/release/geval check --contract geval/examples/contract.yaml --signals geval/examples/signals.json --env prod

# Explain: human-readable report (per-policy + combined)
./geval/target/release/geval explain --contract geval/examples/contract.yaml --signals geval/examples/signals.json --env prod

# Validate contract and all referenced policies
./geval/target/release/geval validate-contract geval/examples/contract.yaml
```

With the example data, the policy matches `business_block`: `engagement_drop` 0.03 > 0, so the decision is **BLOCK**.

## Contract format

- **name**, **version** – Identify the contract for audit; bump version when you change policies or combine rule.
- **combine** – How to merge outcomes from multiple policies:
  - **all_pass** – PASS only if every policy passes; any BLOCK → BLOCK; any REQUIRE_APPROVAL (no BLOCK) → REQUIRE_APPROVAL.
  - **any_block_blocks** – Any policy BLOCK → overall BLOCK; else any REQUIRE_APPROVAL → REQUIRE_APPROVAL; else PASS.
- **policies** – List of policy file paths (relative to the contract file): e.g. `policy.yaml` or `policies/security.yaml`.

## Policy format

Each policy file has optional **name** and **version**, and **policy** with:

- **environment** – optional.
- **rules** – priority, name, when (metric, component, operator, threshold), then (action, reason).

First matching rule wins; no match → PASS.

## Signals format

JSON with optional **name** and **version** at the top, and **signals**: array of objects with optional `system`, `agent`, `component`, `step`, `metric`, `value`, `type`.
