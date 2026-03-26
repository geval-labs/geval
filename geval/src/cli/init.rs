//! `geval init` — create a .geval template with a contract and multiple policies.
//! Safe for existing codebases: only creates files inside the chosen directory (default .geval).

use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

/// Policy filenames are descriptive so new users know what each file is for.
const POLICY_SAFETY_BLOCKING: &str = "safety-and-blocking.yaml";
const POLICY_QUALITY_APPROVAL: &str = "quality-and-approval.yaml";

const SIGNALS_TEMPLATE: &str = r#"{
  "name": "example-pipeline-evaluation",
  "version": "1.0.0",
  "signals": [
    {
      "system": "your_product",
      "component": "retrieval",
      "metric": "context_relevance",
      "value": 0.85
    },
    {
      "system": "your_product",
      "component": "generator",
      "metric": "hallucination_rate",
      "value": 0.04
    },
    {
      "metric": "engagement_drop",
      "value": 0.01
    },
    {
      "component": "pipeline",
      "step": "validation",
      "metric": "latency_ms",
      "value": 120
    },
    {
      "metric": "human_reviewed"
    }
  ]
}
"#;

const CONTRACT_TEMPLATE: &str = r#"# Geval contract — lists which policy files to run for one evaluation.
#
# What to do next:
#   1. Rename `name` if you want a different label for this gate (e.g. your team + release stage).
#   2. Bump `version` whenever you add/remove policy files or change how you expect them to behave.
#   3. Keep `policies` in sync with the YAML files under policies/ (paths are relative to this file).
#   4. Fill signals.json with your real metrics; rule conditions below reference those metric names.
#
# How results combine: Geval merges every policy’s outcome by severity — any BLOCK wins; else any
# REQUIRE_APPROVAL; else PASS. (You may omit `combine:` in YAML; the engine uses this behavior.)

name: ai-release-quality-gate
version: "1.0.0"
policies:
  - path: policies/safety-and-blocking.yaml
  - path: policies/quality-and-approval.yaml
"#;

const POLICY_SAFETY_BLOCKING_TEMPLATE: &str = r#"# Policy: hard blocks (safety / must-not-ship issues)
#
# Edit the rules to match your metrics in signals.json. Lower `priority` numbers run first when
# multiple rules match; unique priorities are required within this file.
#
# This template blocks a release if hallucination is too high or retrieval quality is too low.

name: safety_and_blocking
version: "1.0.0"
policy:
  environment: prod
  rules:
    - priority: 1
      name: block_if_hallucination_rate_too_high
      when:
        component: generator
        metric: hallucination_rate
        operator: ">"
        threshold: 0.05
      then:
        action: block
        reason: "Hallucination rate above allowed maximum — do not ship."

    - priority: 2
      name: block_if_retrieval_context_relevance_too_low
      when:
        component: retrieval
        metric: context_relevance
        operator: "<"
        threshold: 0.7
      then:
        action: block
        reason: "Retrieval context relevance below minimum — fix data or retrieval before release."
"#;

const POLICY_QUALITY_APPROVAL_TEMPLATE: &str = r#"# Policy: quality gates and human review
#
# Use for thresholds that should flag a human instead of blocking outright, or for business metrics.
# Pair metric names with entries in signals.json.

name: quality_and_approval
version: "1.0.0"
policy:
  environment: prod
  rules:
    - priority: 1
      name: block_if_engagement_dropped
      when:
        metric: engagement_drop
        operator: ">"
        threshold: 0
      then:
        action: block
        reason: "Engagement drop detected — investigate before release."

    - priority: 2
      name: require_approval_if_retrieval_below_goal
      when:
        component: retrieval
        metric: context_relevance
        operator: "<"
        threshold: 0.85
      then:
        action: require_approval
        reason: "Retrieval quality below stretch goal — get a reviewer’s approval to proceed."
"#;

fn readme_content(dir: &Path) -> String {
    let dir_str = dir.display().to_string();
    format!(
        r#"# Geval workspace

Created by `geval init`. This folder is a **starting template** — rename fields and rules to match your product, then run Geval from your **project root**.

## What each file is for

| File | Purpose |
|------|---------|
| **contract.yaml** | Names this release gate, versions it, and lists which policy files to evaluate. Bump `version` when you change the list of policies or materially change expectations. |
| **policies/safety-and-blocking.yaml** | Example **hard blocks** (e.g. safety / quality floors). Adjust metrics and thresholds to match `signals.json`. |
| **policies/quality-and-approval.yaml** | Example **review / approval** rules. Use `require_approval` when a human should sign off. |
| **signals.json** | Sample **evidence** (scores and presence flags). Replace `your_product` and metrics with what your pipeline actually emits. Bump `version` when the shape of your data changes. |

## How outcomes combine

All listed policies are evaluated; results are merged by **severity**: any **BLOCK** wins; else any **REQUIRE_APPROVAL**; else **PASS**. (Optional `combine:` in YAML defaults to this behavior.)

## Run

From the **project root**:

```bash
geval check --contract {}/contract.yaml --signals {}/signals.json
```

Multiple contracts (one PR, same signals):

```bash
geval check -c {}/contract.yaml -c path/to/other-contract.yaml --signals {}/signals.json
```

Explain:

```bash
geval explain --contract {}/contract.yaml --signals {}/signals.json
```

Validate contract and all policies:

```bash
geval validate-contract {}/contract.yaml
geval validate-contract {}/contract.yaml path/to/other-contract.yaml
```

## Approve / reject

If the result is REQUIRE_APPROVAL:

```bash
geval approve --reason "Reviewed and approved" --output {}/approval.json
geval reject --reason "Needs more testing" --output {}/rejection.json
```

Commit this folder so your team shares the same contract and policies.
"#,
        dir_str, dir_str, dir_str, dir_str, dir_str, dir_str, dir_str, dir_str, dir_str, dir_str
    )
}

/// Run `geval init`: create directory, contract, policies/, signals, README.
pub fn run_init(dir: &Path, force: bool) -> Result<()> {
    let contract_path = dir.join("contract.yaml");
    let signals_path = dir.join("signals.json");
    let readme_path = dir.join("README.md");
    let policies_dir = dir.join("policies");
    let safety_path = policies_dir.join(POLICY_SAFETY_BLOCKING);
    let quality_path = policies_dir.join(POLICY_QUALITY_APPROVAL);

    if dir.exists() {
        let has_contract = contract_path.exists();
        let has_signals = signals_path.exists();
        if (has_contract || has_signals) && !force {
            anyhow::bail!(
                "Directory {} already has template files. Use --force to overwrite.",
                dir.display()
            );
        }
    } else {
        fs::create_dir_all(dir).with_context(|| format!("create directory {}", dir.display()))?;
    }

    fs::create_dir_all(&policies_dir)
        .with_context(|| format!("create {}", policies_dir.display()))?;

    fs::write(&contract_path, CONTRACT_TEMPLATE)
        .with_context(|| format!("write {}", contract_path.display()))?;
    fs::write(&signals_path, SIGNALS_TEMPLATE)
        .with_context(|| format!("write {}", signals_path.display()))?;
    fs::write(&safety_path, POLICY_SAFETY_BLOCKING_TEMPLATE)
        .with_context(|| format!("write {}", safety_path.display()))?;
    fs::write(&quality_path, POLICY_QUALITY_APPROVAL_TEMPLATE)
        .with_context(|| format!("write {}", quality_path.display()))?;
    fs::write(&readme_path, readme_content(dir))
        .with_context(|| format!("write {}", readme_path.display()))?;

    Ok(())
}
