# GitHub Actions integration

Run Geval in CI for deterministic **PASS** / **REQUIRE_APPROVAL** / **BLOCK** decisions on pull requests. For installing the binary or building from source, see [Installation](installation.md).

Geval is a **CLI**: after `actions/checkout`, the runner sees your repo. You run `geval check` with a **contract** and a **signals** JSON file, then interpret **exit codes**. There is no npm package for this engine—use a [release binary](https://github.com/geval-labs/geval/releases) or build from this repo.

## What you must provide

| Input | Where it comes from |
|-------|---------------------|
| **Contract + policies** | Usually committed (e.g. `.geval/contract.yaml`, `.geval/policies/*.yaml`). |
| **`signals.json`** | Either **committed** in the repo **or** **written in CI** by a script (LangSmith, Braintrust, your API, etc.). |

**GitHub Actions can read committed files.** You only regenerate `signals.json` in the workflow if you want **fresh** metrics every run.

- **Committed signals** — Commit e.g. `.geval/signals.json`, then:
  `./geval check --contract .geval/contract.yaml --signals .geval/signals.json`
- **Generated signals** — Add a step such as `python scripts/generate_signals.py > signals.json`. Only that step is vendor-specific; `geval check` stays the same.

Signal shape is documented in [Signals and rules](signals-and-rules.md).

---

## Option A: Build from source (this repo)

Use when Geval lives in your monorepo (e.g. `geval/` Rust crate):

```yaml
name: Geval quality gate

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

      # Pick ONE: committed signals OR generate in CI
      # - name: Generate signals
      #   run: python scripts/generate_signals.py > signals.json

      - name: Run Geval
        run: |
          ./geval/target/release/geval check \
            --contract .geval/contract.yaml \
            --signals .geval/signals.json \
            --env prod
```

Repeat `--contract` for each contract YAML. Optional: `--combine-contracts worst_case` (default).

---

## Option B: Download released binary

Use an official release on `ubuntu-latest`:

```yaml
      - name: Install Geval
        run: |
          curl -fsSL https://github.com/geval-labs/geval/releases/latest/download/geval-linux-x86_64 -o geval
          chmod +x geval

      - name: Generate signals
        run: python .github/scripts/generate_signals.py > signals.json

      - name: Run Geval
        run: |
          ./geval check \
            --contract .geval/contract.yaml \
            --signals signals.json
```

---

## Recommended: simple PR gate (fail on BLOCK and REQUIRE_APPROVAL)

If both **exit `1`** (REQUIRE_APPROVAL) and **exit `2`** (BLOCK) should **fail** the check, run `geval check` with no wrapper—the shell exits non-zero for both:

```yaml
      - name: Validate contract
        run: ./geval validate-contract .geval/contract.yaml

      - name: Run Geval
        run: ./geval check --contract .geval/contract.yaml --signals signals.json
```

Exit codes:

| Code | Outcome |
|------|---------|
| `0` | PASS |
| `1` | REQUIRE_APPROVAL |
| `2` | BLOCK |

---

## Capturing exit codes: do not use `$?` after a failing command

The default `bash` for `run` uses **errexit** (`-e`). If `./geval check` exits `1` or `2`, the script **stops** before `echo "exitcode=$?" >> $GITHUB_OUTPUT` runs, so the output is often **empty**.

**Do not** rely on:

```yaml
      - run: |
          ./geval check ...
          echo "exitcode=$?" >> $GITHUB_OUTPUT   # often never runs
```

**Correct pattern** when you need the numeric code:

```yaml
      - name: Run Geval
        id: geval
        run: |
          set +e
          ./geval check --contract .geval/contract.yaml --signals signals.json
          code=$?
          set -e
          echo "exitcode=$code" >> "$GITHUB_OUTPUT"
          exit 0
```

Also **do not** combine `continue-on-error: true` with the naive `$?` pattern without `set +e`.

---

## Handling REQUIRE_APPROVAL: extra logic

Exit **`1`** means the merged outcome is **REQUIRE_APPROVAL**. GitHub has no built-in status for that—you choose: fail the job, pass the job but label the PR, notify Slack, use [Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) with required reviewers, or record **`geval approve`** / **`geval reject`** for audit (`geval approve --help`).

| Exit | Meaning | Typical automation |
|------|---------|-------------------|
| `0` | PASS | No extra action |
| `1` | REQUIRE_APPROVAL | Label PR, comment, notify, or human gate |
| `2` | BLOCK | Fail job; fix policies or signals |

### Fail only on BLOCK; pass on REQUIRE_APPROVAL

Classify the code, then `exit 1` only for BLOCK:

```yaml
permissions:
  contents: read
  pull-requests: write

jobs:
  geval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Geval
        run: |
          curl -fsSL https://github.com/geval-labs/geval/releases/latest/download/geval-linux-x86_64 -o geval
          chmod +x geval

      - name: Generate signals
        run: python .github/scripts/generate_signals.py > signals.json

      - name: Run Geval and classify
        id: geval
        run: |
          set +e
          ./geval check --contract .geval/contract.yaml --signals signals.json
          code=$?
          set -e
          echo "exitcode=$code" >> "$GITHUB_OUTPUT"
          case "$code" in
            0) echo "decision=pass" >> "$GITHUB_OUTPUT" ;;
            1) echo "decision=require_approval" >> "$GITHUB_OUTPUT" ;;
            2) echo "decision=block" >> "$GITHUB_OUTPUT" ;;
            *) echo "decision=error" >> "$GITHUB_OUTPUT" ;;
          esac
          if [ "$code" -eq 2 ]; then
            echo "BLOCK — failing job"
            exit 1
          fi
          if [ "$code" -ne 0 ] && [ "$code" -ne 1 ]; then
            echo "Unexpected exit $code"
            exit 1
          fi
          exit 0

      - name: Explain for comment
        if: github.event_name == 'pull_request' && steps.geval.outputs.decision != 'pass'
        run: |
          ./geval explain --contract .geval/contract.yaml --signals signals.json > geval-report.txt

      - name: Label PR — needs Geval review
        if: github.event_name == 'pull_request' && steps.geval.outputs.decision == 'require_approval'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh pr edit "${{ github.event.pull_request.number }}" --add-label "geval:needs-approval"
          gh pr comment "${{ github.event.pull_request.number }}" --body-file geval-report.txt
```

Create the label once in the repo (or `gh label create`).

### Follow-up job with `needs` (e.g. Slack)

Expose a **job output**:

```yaml
jobs:
  geval:
    runs-on: ubuntu-latest
    outputs:
      decision: ${{ steps.geval.outputs.decision }}
    steps:
      - uses: actions/checkout@v4
      - name: Install Geval
        run: |
          curl -fsSL https://github.com/geval-labs/geval/releases/latest/download/geval-linux-x86_64 -o geval
          chmod +x geval
      - name: Signals + check
        id: geval
        run: |
          python .github/scripts/generate_signals.py > signals.json
          set +e
          ./geval check --contract .geval/contract.yaml --signals signals.json
          code=$?
          set -e
          case "$code" in
            0) echo "decision=pass" >> "$GITHUB_OUTPUT" ;;
            1) echo "decision=require_approval" >> "$GITHUB_OUTPUT" ;;
            2) echo "decision=block" >> "$GITHUB_OUTPUT" ;;
            *) echo "decision=error" >> "$GITHUB_OUTPUT"; exit 1 ;;
          esac
          if [ "$code" -eq 2 ]; then exit 1; fi
          exit 0

  notify-approval:
    needs: geval
    if: needs.geval.outputs.decision == 'require_approval'
    runs-on: ubuntu-latest
    steps:
      - name: Notify reviewers
        run: echo "Add Slack/Teams/webhook step here"
```

### Recording human approval

After review, someone can run:

```bash
geval approve --reason "Reviewed" --output .geval/approval.json
```

or **`geval reject`**. Commit or upload the JSON if your process requires an audit trail. See CLI help: `geval approve --help`.

---

## Post result to PR (`geval explain`)

Prefer **`explain`** for readable PR comments (not raw **`check`** stdout):

```yaml
permissions:
  pull-requests: write

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          ./geval explain --contract .geval/contract.yaml --signals signals.json > geval-report.txt
          gh pr comment "${{ github.event.pull_request.number }}" --body-file geval-report.txt
```

---

## Decision artifacts

`geval check` writes JSON under **`.geval/decisions/`**. Upload that directory as a workflow artifact if you want CI-stored audit history.

---

## Public docs

Extended narrative and Mintlify-hosted docs: **[docs.geval.io](https://docs.geval.io)** (GitHub Actions and exit codes).
