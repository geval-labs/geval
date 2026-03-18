# Geval - AI Coding Instructions

## Project Overview

Geval is a **decision orchestration and reconciliation** tool for AI systems. It consumes **signals** (JSON) and **policy** (YAML), evaluates rules in priority order, and produces a deterministic decision: **PASS**, **REQUIRE_APPROVAL**, or **BLOCK**. It does not run evals, call APIs, or compute metrics—it only reconciles your rules against your signals.

**Core Philosophy**: Geval has no “brain.” You provide signals and rules; Geval applies the rules and returns one outcome. Same inputs + same policy = same outcome.

## Repository Structure

- **geval/** – Rust crate (the only product)
  - **src/** – CLI and engine (commands, evaluator, signals loader, policy parser)
  - **docs/** – User docs (installation, GitHub Actions, signals and rules, auditing)
  - **examples/** – Sample `signals.json` and `policy.yaml` for local/CI use
  - **scripts/** – e.g. `generate_signals.py` for CI demo
- **.github/workflows/** – CI (build + test Rust) and release (build binary on tag push)
- Root: README, CONTRIBUTING, LICENSE, CODE_OF_CONDUCT

There are **no npm packages**, no TypeScript, no Turborepo. The artifact is a single **Rust binary** distributed via [GitHub Releases](https://github.com/geval-labs/geval/releases).

## Build and Test

- **Build**: `cargo build --release --manifest-path geval/Cargo.toml`
- **Test**: `cargo test --manifest-path geval/Cargo.toml`
- **Binary**: `geval/target/release/geval` (or `geval.exe` on Windows)

Run from repo root: `./geval/target/release/geval demo` or `geval check --signals ... --policy ...` once the binary is on PATH.

## CLI and Exit Codes

- **Commands**: `geval demo`, `geval init`, `geval check`, `geval explain`, `geval approve` / `geval reject` (see `geval --help`).
- **Exit codes** (for CI):
  - `0` – PASS
  - `1` – REQUIRE_APPROVAL
  - `2` – BLOCK
  - Non-zero on error (e.g. missing file, invalid JSON/YAML).

Use these in scripts and GitHub Actions to gate merges or deployments.

## Data Flow

- **Inputs**: `signals.json` (scores, presence-only flags, or mix) and `policy.yaml` (ordered rules with `when`/`then`).
- **Output**: Decision (PASS / REQUIRE_APPROVAL / BLOCK), optional report via `geval explain`, and optional artifacts under `.geval/decisions/` (with policy/signals hashes for auditing).

Policy is YAML with rules keyed by environment; each rule has conditions (signals, thresholds) and an action. See **geval/docs/signals-and-rules.md** for signal shapes and rule syntax.

## Conventions

- **Rust**: Use `cargo fmt` and `cargo clippy`. Follow existing style in `geval/src/`.
- **Docs**: User-facing text lives in `geval/docs/`. Keep README and installation/CI docs in sync with CLI behavior.
- **CI**: `.github/workflows/geval.yml` builds and tests the crate and runs a sample check; `.github/workflows/release-geval.yml` builds the binary on tag push and publishes to GitHub Releases. No Node/npm in CI.

## When in Doubt

- Read **geval/docs/** for how users install, run, and integrate Geval (binary only; no npm/pip).
- Prefer clarity and determinism; avoid extra dependencies or runtime environments beyond the single binary.
