<p align="center">
  <img src="https://geval.io/white_bg_greenlogo.svg" alt="Geval" width="180" />
</p>

<h1 align="center">Geval</h1>

<p align="center">
  <strong>One clear decision for every AI change.</strong>
</p>

<p align="center">
  Turn evals, A/B tests, and human review into a single <strong>ship / get approval / block</strong> outcome — with rules you control and a full audit trail.
</p>

<p align="center">
  <a href="https://github.com/geval-labs/geval/releases"><img src="https://img.shields.io/github/v/release/geval-labs/geval?label=release" alt="Release"></a>
  <a href="https://github.com/geval-labs/geval/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://github.com/geval-labs/geval/actions"><img src="https://github.com/geval-labs/geval/workflows/CI/badge.svg" alt="CI"></a>
</p>

<p align="center">
  <a href="#install">Install</a> •
  <a href="#quick-start">Quick start</a> •
  <a href="#the-problem">The problem</a> •
  <a href="#what-is-geval">What Geval does</a> •
  <a href="#documentation">Docs</a>
</p>

---

## The problem

Your team runs **evals** (evaluations that measure AI quality — accuracy, relevance, safety, hallucinations, latency). You also have A/B tests, human review, and business metrics. When you change a model or a prompt, you get a flood of signals:

- **Evals** say: “Accuracy improved.”
- **A/B** says: “Engagement dropped a bit.”
- **Review** says: “Edge case flagged.”

So: **do you ship or not?** Today that call often happens in Slack or a meeting — inconsistent, hard to audit, and easy to forget. Geval gives you **one place to write the rules** and **one clear answer** every time: **ship**, **get approval first**, or **block**.

---

## What Geval does

**Geval is a decision engine for AI releases.** You feed it the outcomes of your evals and other signals (as simple data files). You define your policy in a single file: *“If engagement drops, block. If hallucination rate is above X, block. If retrieval quality is below Y, require human approval.”* Geval applies those rules in a fixed order and returns:

| Outcome | Meaning |
|--------|--------|
| **PASS** | Good to ship. No rule blocked it. |
| **REQUIRE_APPROVAL** | A rule says a human must approve before shipping. |
| **BLOCK** | A rule says do not ship until the issue is fixed. |

Every run is recorded (which policy and signals were used, which rule fired, when). So product managers, engineers, and auditors can always answer: *“Why did we ship this?”* and *“Who approved it?”*

**In short:** evals and other tools answer *“What happened?”* Geval answers *“Given what happened, are we allowed to ship?”*

---

## Evals and signals

**Evals** (evaluations) are how teams measure AI behavior. They’re usually automated checks that produce numbers or pass/fail results — for example:

- **Accuracy** – Did the model answer correctly?
- **Relevance** – Did the answer match the question and context?
- **Safety** – Toxicity, bias, PII leakage.
- **Hallucination rate** – How often the model made things up.
- **Latency / cost** – Speed and resource use.

Teams run evals with their own scripts or tools (e.g. Promptfoo, LangSmith, custom pipelines). Geval **does not run evals**. It only **consumes the results** of evals (and other signals) as input.

**Signals** are any evidence you use to decide: eval metrics, A/B results, human review flags, safety scans, business KPIs. Geval takes those signals as a single JSON file and a policy file (YAML) that says things like: *“If metric X is above threshold Y, block.”* Rules are evaluated in **priority order** — the first rule that matches gives you the decision. So you can encode: *“Business metrics override evals; safety overrides everything.”*

---

## Who it’s for

- **Product managers** – Define what “good enough to ship” means (evals + business + review) and get a clear go / get-approval / no-go instead of ad-hoc calls.
- **Engineers** – Enforce the same rules in CI and locally; one binary, no dashboards or APIs to run.
- **Compliance & audit** – Every decision is tied to a policy version and input hashes; you can prove what rule fired and, when relevant, who approved.

Geval is **not** an eval runner, a monitoring product, or a dashboard. It’s the **decision layer**: evals (and other signals) in, one decision out.

---

## What you get

- **One decision** – PASS, REQUIRE_APPROVAL, or BLOCK, with the exact rule and reason.
- **Rules you own** – Policy is version-controlled YAML; no black box.
- **Audit trail** – Each run writes which policy and signals were used, the decision, and optional approval/rejection with reason and timestamp.
- **Fits your pipeline** – Single binary; use in CI (e.g. GitHub Actions) or locally. Your existing evals and scripts produce the signal files; Geval only reads them and applies your policy.

---

## Install

Geval is a single binary — no npm, no pip, no runtime. Pick one option below.

### Option A: Download a release (recommended)

**[→ Latest release](https://github.com/geval-labs/geval/releases)** — download the binary for your OS, then:

```bash
# Linux (x86_64)
curl -sSL https://github.com/geval-labs/geval/releases/latest/download/geval-linux-x86_64 -o geval
chmod +x geval

# macOS (Apple Silicon)
curl -sSL https://github.com/geval-labs/geval/releases/latest/download/geval-macos-aarch64 -o geval
chmod +x geval

# macOS (Intel)
curl -sSL https://github.com/geval-labs/geval/releases/latest/download/geval-macos-x86_64 -o geval
chmod +x geval
```

Move `geval` to a folder on your PATH (e.g. `~/bin` or `/usr/local/bin`). Then run:

```bash
geval --help
```

### Option B: Build from source

You need [Rust](https://rustup.rs/) installed. From the repo root:

```bash
git clone https://github.com/geval-labs/geval.git
cd geval
cargo build --release --manifest-path geval/Cargo.toml
```

The binary is at `geval/target/release/geval`. Optionally copy it to your PATH:

```bash
cp geval/target/release/geval /usr/local/bin/   # or ~/bin/
```

---

## Quick start

1. **Install** Geval (see above).
2. **Get a policy and signals** — use the examples in this repo or create your own (see [Examples](geval/examples/README.md)).

**Try it with the included examples:**

```bash
# If you built from source (run from repo root):
./geval/target/release/geval check \
  --signals geval/examples/signals.json \
  --policy geval/examples/policy.yaml \
  --env prod

# If you installed the binary (run from repo root, or use full paths to the example files):
geval check --signals geval/examples/signals.json --policy geval/examples/policy.yaml --env prod
```

You’ll get **PASS** (exit 0), **REQUIRE_APPROVAL** (exit 1), or **BLOCK** (exit 2). Use these exit codes in CI to gate merges or deployments.

**Next:** Add a `policy.yaml` to your repo and point Geval at your own `signals.json` (from your evals pipeline). See [Documentation](#documentation) for guides.

---

## CLI at a glance

| Command | What it does |
|--------|----------------|
| `geval check` | Run signals + policy → get PASS / REQUIRE_APPROVAL / BLOCK and exit code |
| `geval explain` | Show why you got that decision (which rule, which signals) |
| `geval approve` / `geval reject` | Record a human approval or rejection (e.g. after REQUIRE_APPROVAL) |
| `geval validate-policy` | Check that your policy file is valid |

Decisions are written under `.geval/decisions/`; approvals/rejections to a file you choose (e.g. `.geval/approval.json`).

---

## Documentation

| Guide | Description |
|-------|-------------|
| [**Installation**](geval/docs/installation.md) | Download, PATH, CI setup, build from source |
| [**Examples**](geval/examples/README.md) | Sample `signals.json` and `policy.yaml` + how to run them |
| [**GitHub Actions**](geval/docs/github-actions.md) | Run Geval in CI (workflow YAML and exit codes) |
| [**Developer workflow**](geval/docs/developer-workflow.md) | PR → check → approve/reject flow |
| [**Auditing**](geval/docs/auditing.md) | Decision artifacts, hashes, who approved what |

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. The main implementation is the Rust binary in the `geval/` directory.

---

## License

MIT © [Geval Contributors](https://github.com/geval-labs/geval/graphs/contributors)

---

<p align="center">
  <a href="https://geval.io">Website</a> •
  <a href="https://github.com/geval-labs/geval">GitHub</a> •
  <a href="https://github.com/geval-labs/geval/releases">Releases</a> •
  <a href="geval/docs/installation.md">Installation</a>
</p>
