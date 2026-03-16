<p align="center">
  <img src="https://geval.io/white_bg_greenlogo.svg" alt="Geval" width="180" />
</p>

<h1 align="center">Geval</h1>

<p align="center">
  <strong>One clear decision for every AI change.</strong>
</p>

<p align="center">
  <a href="https://github.com/geval-labs/geval/releases"><img src="https://img.shields.io/github/v/release/geval-labs/geval?label=release" alt="Release"></a>
  <a href="https://github.com/geval-labs/geval/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://github.com/geval-labs/geval/actions"><img src="https://github.com/geval-labs/geval/workflows/CI/badge.svg" alt="CI"></a>
</p>

---

## Install & try (under a minute)

**1. Clone the repo and download the binary** (pick your OS for the `curl` line):

```bash
git clone https://github.com/geval-labs/geval.git && cd geval

# Linux
curl -sSL https://github.com/geval-labs/geval/releases/latest/download/geval-linux-x86_64 -o geval && chmod +x geval

# macOS (Apple Silicon)
curl -sSL https://github.com/geval-labs/geval/releases/latest/download/geval-macos-aarch64 -o geval && chmod +x geval
```

**2. Run it** with the included example:

```bash
./geval check --signals geval/examples/signals.json --policy geval/examples/policy.yaml --env prod
```

You’ll get **PASS**, **REQUIRE_APPROVAL**, or **BLOCK**. Same binary works in GitHub Actions or any CI — no npm or pip. [→ Use in CI](geval/docs/github-actions.md)

**If the download gives an error** (e.g. `Not: command not found` when you run `./geval`), the release may not have binaries attached yet. **Build from source** instead (requires [Rust](https://rustup.rs/)):

```bash
git clone https://github.com/geval-labs/geval.git && cd geval
cargo build --release --manifest-path geval/Cargo.toml
./geval/target/release/geval check --signals geval/examples/signals.json --policy geval/examples/policy.yaml --env prod
```

---

<p align="center">
  <a href="#the-problem">The problem</a> •
  <a href="#what-geval-does">What Geval does</a> •
  <a href="#cli">CLI</a> •
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

## CLI

| Command | What it does |
|--------|----------------|
| `geval check` | Run signals + policy → PASS / REQUIRE_APPROVAL / BLOCK (exit 0 / 1 / 2) |
| `geval explain` | Show why (which rule, which signals) |
| `geval approve` / `geval reject` | Record human approval or rejection |
| `geval validate-policy` | Validate policy file |

---

## Documentation

| Guide | Description |
|-------|-------------|
| [**GitHub Actions**](geval/docs/github-actions.md) | Run Geval in CI (workflow YAML, exit codes) |
| [**Examples**](geval/examples/README.md) | Sample `signals.json` and `policy.yaml` |
| [**Installation**](geval/docs/installation.md) | PATH, CI, and build-from-source (for contributors) |
| [**Developer workflow**](geval/docs/developer-workflow.md) | PR → check → approve/reject |
| [**Auditing**](geval/docs/auditing.md) | Decision artifacts, hashes |

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md). **Building from source** (e.g. to contribute): see [Installation → Build from source](geval/docs/installation.md#build-from-source).

---

## License

MIT © [Geval Contributors](https://github.com/geval-labs/geval/graphs/contributors)

---

<p align="center">
  <a href="https://geval.io">Website</a> •
  <a href="https://github.com/geval-labs/geval/releases">Releases</a> •
  <a href="https://github.com/geval-labs/geval">GitHub</a>
</p>
