# Geval (Rust)

**Decision orchestration engine for AI systems.**

Geval consumes **signals** (JSON) and **policy** (YAML), evaluates rules in priority order, and produces a deterministic decision: **PASS**, **REQUIRE_APPROVAL**, or **BLOCK**. It does not run evals, call APIs, or compute metrics—it only reconciles conflicting signals using explicit rules.

## How engineers use it

Geval is **not** an npm or pip package. It is a **single static binary** you run locally or in CI.

- **Install:** Download a [release binary](https://github.com/geval/geval/releases) for your OS, or build from source with `cargo build --release`.
- **Integrate:** Run `geval check --signals signals.json --policy policy.yaml` in your repo; use exit codes (0/1/2) in CI or scripts. Your pipeline produces `signals.json` (e.g. via Node or Python); Geval only reads files and writes artifacts.

See **[Installation](docs/installation.md)** for download links, build-from-source steps, and local/CI integration.

## Principles

- **Local, deterministic** – single binary, no external services
- **Rule-based** – priority-ordered rules; first match wins; no scoring or ML
- **Auditable** – policy and signal hashes (SHA256), immutable decision artifacts

## Quick start

**If you have Rust:** build and run from the `geval` directory:

```bash
cargo build --release
./target/release/geval check --signals examples/signals.json --policy examples/policy.yaml --env prod
```

**If you have a release binary:** ensure `geval` is on your PATH, then:

```bash
geval check --signals signals.json --policy policy.yaml --env prod
```

Exit codes: `0` = PASS, `1` = REQUIRE_APPROVAL, `2` = BLOCK.

## Commands

| Command | Description |
|--------|-------------|
| `geval check` | Evaluate signals against policy; exit 0/1/2 |
| `geval approve` | Record human approval (e.g. for REQUIRE_APPROVAL) |
| `geval reject` | Record human rejection |
| `geval explain` | Print human-readable decision report |
| `geval validate-policy` | Validate policy file syntax |

## Artifacts

- **Decisions:** `.geval/decisions/<timestamp>.json` (policy_hash, signals_hash, decision, matched_rule)
- **Approval:** e.g. `.geval/approval.json` (approved_by, reason, timestamp)

## Docs

- [Installation](docs/installation.md) – **how to install and integrate** (binary vs build from source; no npm/pip)
- [Examples](examples/README.md) – signals and policy format
- [GitHub Actions](docs/github-actions.md) – CI integration
- [Developer workflow](docs/developer-workflow.md) – daily flow (PR → check → approve/reject)
- [Auditing](docs/auditing.md) – accountability and reproducibility

## Requirements

- To **run**: a pre-built binary for your OS (no Rust/Node/Python required).
- To **build from source**: Rust 1.70+.
- No external services; single static binary.

## License

MIT
