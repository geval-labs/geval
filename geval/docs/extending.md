# Extending Geval: Process and Conventions

This document describes how to change or extend Geval in a consistent, testable way. Use it when adding a new combination rule, policy feature, or CLI command.

## Principles

1. **Contract-first** – The contract (multiple policies + combine rule) is the core. New behavior should integrate with contracts and artifacts.
2. **Versioned** – New inputs or artifact fields should be versioned (name/version or artifact_version).
3. **Tested** – Add unit tests for new logic and, when relevant, an integration-style test (e.g. `run_contract` with the new behavior).
4. **Documented** – Update [architecture.md](architecture.md), [versioning.md](versioning.md), or [signals-and-rules.md](signals-and-rules.md) as needed.

## Process for a typical change

### 1. Design

- Decide where the change lives: contract, policy, signals, combination rule, artifact, or CLI.
- If it’s a new combination rule or contract option, describe the semantics (e.g. “overall BLOCK if more than N policies block”).
- If it’s a new artifact field, decide whether it’s required or optional and what happens for old artifacts (if we ever read them).

### 2. Implement

- **Contract** – `contract/model.rs`, `contract/loader.rs`, `contract/runner.rs`, `contract/combine.rs`.
- **Policy** – `policy/model.rs`, `policy/parser.rs`; then `evaluator/engine.rs` if rule semantics change.
- **Signals** – `signals/loader.rs`, `signal_graph/` if lookup behavior changes.
- **Artifact** – `artifact/writer.rs`; bump `DECISION_ARTIFACT_VERSION` if the JSON shape changes.
- **CLI** – `cli/commands.rs`; add or update subcommands/args.

Keep functions small and pure where possible; use `anyhow::Result` and `Context` for errors.

### 3. Test

- **Unit tests** – In the same module under `#[cfg(test)] mod tests`: parsers, combine rules, evaluator, hashing.
- **Contract runner tests** – In `contract/runner.rs`: `run_contract` with 1 or 2 policies, different combine rules and outcomes.
- **CLI** – Manual or optional integration test: run `geval check` with a fixture contract/signals and assert exit code and artifact content.

Run: `cargo test --manifest-path geval/Cargo.toml`.

### 4. Document

- **User-facing** – README, [installation.md](installation.md), [signals-and-rules.md](signals-and-rules.md), [versioning.md](versioning.md), [auditing.md](auditing.md). Update examples (e.g. `geval/examples/`) if the contract or CLI changes.
- **Contributor-facing** – [architecture.md](architecture.md) and this file. If you add a new extension point (e.g. new combine rule), add a short “How to add X” subsection here or in architecture.

### 5. Changelog / release

- Bump version in `geval/Cargo.toml` and, if needed, `DECISION_ARTIFACT_VERSION` or `APPROVAL_ARTIFACT_VERSION`.
- Note breaking changes (e.g. CLI now requires `--contract` instead of `--policy`) in release notes.

## Adding a new combination rule

1. **contract/combine.rs**
   - Add a variant to `CombineRule` with `#[serde(rename = "snake_case")]` (or explicit rename).
   - Implement `Default` if it should be the default when omitted in YAML.
   - In `apply_combine_rule`, add a `match` branch that implements the new semantics.
   - Implement `Display` and `FromStr` for CLI/artifact string.
2. **Tests** – Add tests in `contract/combine::tests` for the new rule (e.g. N outcomes → expected combined outcome).
3. **Docs** – Update [signals-and-rules.md](signals-and-rules.md) or [versioning.md](versioning.md) to describe the new rule.

## Adding a new policy or contract field

1. **Model** – Add the field to `ContractDef` or `Policy` in the appropriate `model.rs`; use `Option<T>` and `#[serde(default)]` for backward compatibility if we still support old files.
2. **Parser** – If the field comes from YAML, ensure the parser (contract loader or policy parser) reads it and fills the model.
3. **Artifact** – If the field should be audited, add it to `DecisionArtifact` (and to the code that builds the artifact from `ContractResult` and versions).
4. **Tests** – Parse a sample YAML with the new field and assert it’s present; if the field affects evaluation, add an evaluator or runner test.

## Adding a new CLI command

1. **Subcommand** – In `cli/commands.rs`, add a variant to `Sub` and a corresponding `*Opts` struct.
2. **Handler** – Implement `run_*` and call it from `Commands::run`.
3. **Help** – Use `#[command(about = "...")]` and `#[arg(...)]` so `geval --help` and `geval <sub> --help` are clear.
4. **Docs** – Update README and [installation.md](installation.md) or [github-actions.md](github-actions.md) if the command is part of the main workflow.

## Reference: where things live

| Change | Primary files |
|--------|----------------|
| New combine rule | `contract/combine.rs` |
| Contract file format | `contract/model.rs`, `contract/loader.rs` |
| Policy file format | `policy/model.rs`, `policy/parser.rs` |
| Rule matching logic | `evaluator/engine.rs`, `signal_graph/` |
| Signals format | `signals/loader.rs` |
| Decision artifact shape | `artifact/writer.rs` |
| CLI commands | `cli/commands.rs` |
| Init templates | `cli/init.rs` |
| Human-readable report | `explanation/explain.rs` |

Use this as the single place to look when you want to change behavior and need to know which module to touch first.
