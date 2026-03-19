# Geval Architecture

Geval is **contract-centric**: a **contract** is a named, versioned set of **policies** evaluated together with a **combination rule**. Every decision is fully versioned and auditable.

## Core concepts

| Concept | Description |
|--------|-------------|
| **Contract** | YAML file: `name`, `version`, `combine` (rule), and list of policy paths. The unit of evaluation. |
| **Policy** | YAML file: optional `name`/`version`, `environment`, and ordered `rules`. Each rule has `when` (conditions) and `then` (action: pass / block / require_approval). |
| **Signals** | JSON: optional `name`/`version`, and array of signal objects (metric, value, component, etc.). Facts fed into the engine. |
| **Combination rule** | How to merge outcomes from multiple policies: `all_pass` or `any_block_blocks`. |

## Data flow

1. **Load contract** – Parse contract YAML; resolve policy paths relative to the contract file; load each policy.
2. **Load signals** – Parse signals JSON; build an in-memory signal graph (metric → value lookup).
3. **Evaluate each policy** – For each policy, evaluate rules in priority order; first matching rule gives that policy’s outcome (PASS / REQUIRE_APPROVAL / BLOCK).
4. **Combine (policies)** – Apply the contract’s combination rule to the list of policy outcomes → one combined decision **per contract**.
5. **Combine (contracts)** – If multiple contract files are passed (`geval check -c a.yaml -c b.yaml`), apply **`--combine-contracts`** to each contract’s combined outcome → one **overall** PR-level decision (same rule vocabulary: `all_pass`, `any_block_blocks`).
6. **Artifact** – Write `.geval/decisions/<timestamp>.json` (v3) with `bundle_hash`, each contract block, `contracts_combine_rule`, and overall outcome + hashes.

## Module layout

```
geval/src/
  contract/       # Contract = multiple policies + combine rule
    model.rs      # ContractDef, PolicyRef
    combine.rs    # CombineRule (all_pass, any_block_blocks), apply_combine_rule
    loader.rs     # load_contract, load_contract_and_policies, parse_contract_str
    runner.rs     # run_contract, load_run_contracts → ContractResult / MultiContractRun
  policy/         # Single policy model and parser
    model.rs      # Policy, Rule, RuleCondition, RuleConsequence, Action, Operator
    parser.rs     # parse_policy, parse_policy_str
  evaluator/      # Single-policy evaluation
    engine.rs     # evaluate(policy, graph) → Decision; evaluate_with_trace
  signal_graph/   # Build lookup from signals for rule matching
  signals/        # Load signals JSON (name, version, signals array)
  hashing/        # SHA256 for contract, policy, signals, contract bundle (audit)
  artifact/       # write_multi_contract_artifact (v3: multi-contract + overall)
  explanation/    # explain_contract_result, explain_multi_contract_result, explain_decision
  approval/       # Approval/rejection artifact (versioned)
  cli/            # Commands: check, init, demo, explain, validate-contract, approve, reject
```

## Invariants

- **Nothing unversioned** – Contract, policies, and signals have name/version; artifact records them and hashes.
- **Deterministic** – Same contract set (order) + same signals → same overall decision.
- **No remote calls** – All inputs and outputs are local files.

## Adding a new combination rule

1. Add a variant to `CombineRule` in `contract/combine.rs`.
2. Implement the logic in `apply_combine_rule` (match on the new variant).
3. Add `Serialize`/`Deserialize` (and `FromStr`/`Display` if you want CLI/artifact string).
4. Add tests in `contract/combine::tests`.
5. Document in [signals-and-rules.md](signals-and-rules.md) or [versioning.md](versioning.md).

See [extending.md](extending.md) for the full change process.
