<p align="center">
  <img src="https://geval.io/white_bg_greenlogo.svg" alt="Geval" width="180" />
</p>

# Geval

<p align="center">
  <strong>Decision orchestration and reconciliation for AI changes.</strong>
</p>

<p align="center">
  You bring <em>all kinds of signals</em> and <em>your rules</em>. Geval orchestrates and reconciles them into one outcome. No brain — just your rules applied, every time.
</p>

<p align="center">
  <a href="https://github.com/geval-labs/geval/releases"><img src="https://img.shields.io/github/v/release/geval-labs/geval?label=release" alt="Release"></a>
  <a href="https://github.com/geval-labs/geval/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://github.com/geval-labs/geval/actions"><img src="https://github.com/geval-labs/geval/workflows/CI/badge.svg" alt="CI"></a>
</p>

---

## Try it in under a minute

**1. Download** (pick your OS):

```bash
# Linux
curl -sSL https://github.com/geval-labs/geval/releases/latest/download/geval-linux-x86_64 -o geval && chmod +x geval

# macOS (Apple Silicon)
curl -sSL https://github.com/geval-labs/geval/releases/latest/download/geval-macos-aarch64 -o geval && chmod +x geval

# Windows (PowerShell) — see note below
Invoke-WebRequest -Uri https://github.com/geval-labs/geval/releases/latest/download/geval-windows-x86_64.exe -OutFile geval.exe
```

> **Windows:** Open **PowerShell as Administrator** (right‑click → *Run as administrator*). Then run the download command and `.\geval.exe demo`.

**2. Run the demo** (no files needed):

```bash
./geval demo          # Linux / macOS
.\geval.exe demo      # Windows (same folder as geval.exe)
```

You get a report and one outcome: **PASS**, **REQUIRE_APPROVAL**, or **BLOCK** — produced by applying the demo rules to the demo signals. [Use in CI →](geval/docs/github-actions.md)

**No binary for your OS?** [Build from source](geval/docs/installation.md#build-from-source).

### Start from a template (like create-react-app)

Inside your project (your codebase is not changed except for one new folder):

```bash
geval init
```

This creates a **.geval** folder with:

- **contract.yaml** — Contract: name, version, combine rule, and list of policy paths.
- **policies/** — Policy files (e.g. security.yaml, quality.yaml). Edit and add rules.
- **signals.json** — Sample signals. Edit and add yours.
- **README.md** — How to run from here.

Then run:

```bash
geval check --contract .geval/contract.yaml --signals .geval/signals.json
```

Use a different folder: `geval init my-rules`. Overwrite existing files: `geval init --force`.

### Updating

Use the same download commands. Replace your old file with the new one. Check version: `geval --version`.

---

## Use Geval with your own signals and contract

You need a **contract** (one YAML that references one or more **policy** files) and a **signals** file. Geval evaluates each policy against the same signals, then combines outcomes (e.g. all must pass, or any block blocks). Use `geval init` for a template with a contract and two policies, or create the files yourself below.

**All kinds of signals:** Not every signal needs a score. You can mix: entries with a numeric `value`, and entries with no value (presence-only). Use a rule with `operator: presence` to match “this metric exists.” [Details →](geval/docs/signals-and-rules.md)

### Step 1: Your signals (data file)

A list of evidence: what you measured, observed, or flagged. Each item has a **metric** (name). **Value** is optional — use it for scores; omit it for “this happened” (presence-only).

Example — save as `mydata.json`:

```json
{
  "signals": [
    { "metric": "accuracy", "value": 0.94 },
    { "metric": "engagement_drop", "value": 0.02 }
  ]
}
```

You can add labels like `component` or `system` if you need them. [Full example →](geval/examples/signals.json)

### Step 2: Your contract and policies

A **contract** is a YAML file that lists one or more **policy** files and a **combination rule** (how to merge their outcomes). Each **policy** file contains ordered rules: **When** [condition on signals], **then** [pass / block / require_approval].

Example contract — save as `contract.yaml`:

```yaml
name: my-gate
version: "1.0.0"
combine: all_pass
policies:
  - path: policy.yaml
```

Example policy — save as `policy.yaml` (path relative to the contract file):

```yaml
name: quality
version: "1.0.0"
policy:
  rules:
    - priority: 1
      name: block_bad_engagement
      when:
        metric: engagement_drop
        operator: ">"
        threshold: 0
      then:
        action: block
    - priority: 2
      name: allow_good_accuracy
      when:
        metric: accuracy
        operator: ">="
        threshold: 0.9
      then:
        action: pass
```

**Combine rules:** `all_pass` = PASS only if every policy passes; `any_block_blocks` = any policy BLOCK → overall BLOCK. **Operators:** `>`, `<`, `>=`, `<=`, `==`, `presence`. **Actions:** `pass`, `block`, `require_approval`.

[Full example →](geval/examples/contract.yaml) and [policy →](geval/examples/policy.yaml)

### Step 3: Run Geval

```bash
./geval check --contract contract.yaml --signals mydata.json
```

(Windows: `.\geval.exe check --contract contract.yaml --signals mydata.json`)

### Step 4: Read the outcome

- **PASS** — Every policy passed (or combined rule says go).
- **REQUIRE_APPROVAL** — At least one policy requires approval.
- **BLOCK** — At least one policy blocks.

To see **per-policy results** and the combined decision:

```bash
./geval explain --contract contract.yaml --signals mydata.json
```

To validate the contract and all referenced policies:

```bash
./geval validate-contract contract.yaml
```

---

<p align="center">
  <a href="#the-problem">The problem</a> •
  <a href="#what-geval-is">What Geval is</a> •
  <a href="#cli">Commands</a> •
  <a href="#documentation">Docs</a>
</p>

---

## The problem

You have many signals: scores, A/B results, human reviews, flags. You change a model or a prompt. Then what?

- One signal says “better.”
- Another says “worse.”
- Someone asks: “Do we ship?”

Today that call happens in chat or a meeting. Hard to repeat. Hard to audit. You don't need a system that "decides" for you — you need **orchestration and reconciliation**: one place to define rules, one place to feed all your signals (not just numbers), and one deterministic outcome every time.

---

## What Geval is

**Geval is a decision orchestration and reconciliation engine.** It does not make decisions. It has no brain. You provide:

1. **Your signals** (one file) — any kind: scores, presence-only, flags, labels. Non-uniform is fine.
2. **Your rules** (one file) — e.g. “If engagement drops, block. If accuracy is below X, need approval.”

Geval **orchestrates** the run and **reconciles** your signals against your rules in order. Same inputs + same rules = same outcome. It returns:

| Outcome | Meaning |
|--------|--------|
| **PASS** | No rule matched a block or require-approval. Good to go. |
| **REQUIRE_APPROVAL** | A rule matched; it says a person must approve first. |
| **BLOCK** | A rule matched; it says don’t ship. Fix first. |

Each run is recorded: which rules, which signals, when. So you can always answer: “Why did we ship?” and “Who approved?” — without any black box.

---

## Commands

| Command | What it does |
|--------|----------------|
| `geval init` | Create a template folder (.geval) with sample data and rules. Edit and run. |
| `geval demo` | Run the built-in example. Try this first. |
| `geval check` | Orchestrate: run your signals + rules → one outcome (PASS / REQUIRE_APPROVAL / BLOCK) |
| `geval explain` | Show which rule produced the outcome and which signals were used |
| `geval approve` / `geval reject` | Record a person’s approval or rejection |
| `geval validate-contract` | Validate contract and all referenced policies |

---

## Documentation

| Guide | Description |
|-------|-------------|
| [**Architecture**](geval/docs/architecture.md) | Contract = multiple policies + combine rule; module layout |
| [**Signals and rules**](geval/docs/signals-and-rules.md) | Non-uniform signals (scores, presence-only, mix); how rules use them |
| [**Signal assumptions**](geval/docs/signal-assumptions.md) | What we assume; what input forms we accept (number, string, trace, object) |
| [**Versioning**](geval/docs/versioning.md) | Contract, policy, and signals versioning; nothing unversioned |
| [**Extending**](geval/docs/extending.md) | How to add a combination rule or change behavior; process and conventions |
| [**GitHub Actions**](geval/docs/github-actions.md) | Use Geval in CI |
| [**Examples**](geval/examples/README.md) | Sample data and rules files |
| [**Installation**](geval/docs/installation.md) | Install, PATH, build from source |
| [**Developer workflow**](geval/docs/developer-workflow.md) | PRs, check, approve/reject |
| [**Auditing**](geval/docs/auditing.md) | How decisions are recorded |

---

## Contributing

Contributions welcome. [CONTRIBUTING.md](CONTRIBUTING.md). Build from source: [Installation](geval/docs/installation.md#build-from-source).

---

## License

MIT © [Geval Contributors](https://github.com/geval-labs/geval/graphs/contributors)

---

<p align="center">
  <a href="https://geval.io">Website</a> •
  <a href="https://github.com/geval-labs/geval/releases">Releases</a> •
  <a href="https://github.com/geval-labs/geval">GitHub</a>
</p>
