# Versioning: nothing unversioned

Every decision and every action in Geval is auditable. Nothing should be updated without a version update.

## Contract versioning

A **contract** is a YAML file that lists one or more policy paths (and optionally how to combine outcomes). It has:

- **name** – Identifies the contract (e.g. `ai-release-quality-gate`). Required.
- **version** – **Bump when you add/remove policies or change how you expect them to behave.**

Example:

```yaml
name: ai-release-quality-gate
version: "2.1.0"
policies:
  - path: policies/safety-and-blocking.yaml
  - path: policies/quality-and-approval.yaml
```

The decision artifact records `contract_name` and `contract_version` so you always know which contract produced a decision.

## Policy versioning

Each **policy** file (referenced by the contract) can have its own identity:

- **name** – Identifies the policy (e.g. `security`, `quality`). Optional.
- **version** – **Bump when you change rules in that policy.**

Set them at the top level of the policy YAML (or inside the `policy` block). The decision artifact records per-policy `policy_name`, `policy_version`, and `policy_hash` for each policy in the contract.

## Signals versioning

Your signals JSON can carry identity and version for audit.

- **name** – Identifies the signals set (e.g. `ci-signals`). Optional.
- **version** – **Bump when your pipeline or schema changes** so decisions are tied to a specific signals version.

Example:

```json
{
  "name": "ci-signals",
  "version": "1.2.0",
  "signals": [
    { "metric": "accuracy", "value": 0.94 },
    ...
  ]
}
```

The decision artifact records `signals_name` and `signals_version` when present.

## Decision artifact

Every `geval check` writes a versioned artifact to `.geval/decisions/<timestamp>.json`:

- **artifact_version** – Schema version (current: **3** — multi-contract).
- **geval_version** – Geval binary version that produced the decision.
- **contracts** – Each contract’s `contract_name`, `contract_version`, `contract_hash`, and per-policy `policy_name` / `policy_version` / `policy_hash` when present.
- **bundle_hash** – Hash of the ordered contract set (paths + content hashes).
- **signals_name**, **signals_version** – From the signals file.
- **signals_hash** – Content hash (SHA256) for integrity.

So every decision is fully traceable: which contract versions (one or many), which signals version, which binary.

## Approval artifact

`geval approve` and `geval reject` write an artifact with a **version** field (artifact format version). Old artifacts without `version` are still read (treated as version `"1"`).

## Summary

| Item            | Where to set              | When to bump                    |
|-----------------|---------------------------|---------------------------------|
| Policy (contract) | `name`, `version` in YAML | When you change rules           |
| Signals         | `name`, `version` in JSON | When pipeline or schema changes |
| Decision artifact | Written by Geval        | Format change → bump constant  |
| Approval artifact | Written by Geval        | Format change → bump constant  |

**Rule:** No update without a version update. Set name and version on policy and signals, and every decision will record them for audit.
