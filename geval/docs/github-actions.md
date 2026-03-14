# GitHub Actions Integration

Run Geval in CI to get deterministic pass / require-approval / block decisions on pull requests. For how to install Geval (binary vs build from source), see [Installation](installation.md).

## Option A: Build from source (this repo)

Use when Geval is part of your repo (e.g. in a `geval/` Rust crate):

```yaml
name: Geval Decision Check

on:
  pull_request:
    branches: [main]

jobs:
  geval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-action@stable
        with:
          toolchain: stable

      - name: Build Geval
        run: cargo build --release --manifest-path geval/Cargo.toml

      - name: Generate signals
        run: |
          python scripts/generate_signals.py > signals.json

      - name: Run Geval
        run: |
          ./geval/target/release/geval check \
            --signals signals.json \
            --policy policy.yaml \
            --env prod
```

## Option B: Download released binary

Use when you rely on an official Geval release:

```yaml
      - name: Install Geval
        run: |
          curl -L https://github.com/geval/geval/releases/latest/download/geval-linux-x86_64 -o geval
          chmod +x geval

      - name: Generate signals
        run: |
          python scripts/generate_signals.py > signals.json

      - name: Run Geval
        run: |
          ./geval check \
            --signals signals.json \
            --policy policy.yaml
```

## Exit codes

- `0` → **PASS** – merge allowed
- `1` → **REQUIRE_APPROVAL** – human approval required
- `2` → **BLOCK** – fix required before merge

Use these in a later step to fail the job on BLOCK or REQUIRE_APPROVAL if desired:

```yaml
      - name: Run Geval
        id: geval
        run: |
          ./geval check --signals signals.json --policy policy.yaml --env prod
          echo "exitcode=$?" >> $GITHUB_OUTPUT
```

Then `if: steps.geval.outputs.exitcode == '0'` for merge gates.

## Post result to PR (GitHub CLI)

```bash
RESULT=$(./geval check --signals signals.json --policy policy.yaml)
gh pr comment $PR_NUMBER --body "$RESULT"
```

Or capture the explain output:

```bash
RESULT=$(./geval explain --signals signals.json --policy policy.yaml)
gh pr comment $PR_NUMBER --body "$RESULT"
```
