//! `geval init` — create a .geval template with a contract and multiple policies.
//! Safe for existing codebases: only creates files inside the chosen directory (default .geval).

use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

const SIGNALS_TEMPLATE: &str = r#"{
  "name": "my-signals",
  "version": "1.0.0",
  "signals": [
    {
      "system": "my_app",
      "component": "retrieval",
      "metric": "context_relevance",
      "value": 0.85
    },
    {
      "system": "my_app",
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

const CONTRACT_TEMPLATE: &str = r#"# Geval contract: multiple policies evaluated together.
# name + version identify this contract; bump version when you add/remove policies or change combine.
# combine: worst_case merges outcomes by severity — BLOCK > REQUIRE_APPROVAL > PASS.

name: release-gate
version: "1.0.0"
combine: worst_case
policies:
  - path: policies/security.yaml
  - path: policies/quality.yaml
"#;

const POLICY_SECURITY_TEMPLATE: &str = r#"# Security policy — block on safety violations.
name: security
version: "1.0.0"
policy:
  environment: prod
  rules:
    - priority: 1
      name: block_high_hallucination
      when:
        component: generator
        metric: hallucination_rate
        operator: ">"
        threshold: 0.05
      then:
        action: block
        reason: "Hallucination rate too high"

    - priority: 2
      name: block_low_retrieval_quality
      when:
        component: retrieval
        metric: context_relevance
        operator: "<"
        threshold: 0.7
      then:
        action: block
        reason: "Retrieval quality below minimum"
"#;

const POLICY_QUALITY_TEMPLATE: &str = r#"# Quality policy — business and quality gates.
name: quality
version: "1.0.0"
policy:
  environment: prod
  rules:
    - priority: 1
      name: block_engagement_drop
      when:
        metric: engagement_drop
        operator: ">"
        threshold: 0
      then:
        action: block
        reason: "Business engagement dropped"

    - priority: 2
      name: require_approval_low_retrieval
      when:
        component: retrieval
        metric: context_relevance
        operator: "<"
        threshold: 0.85
      then:
        action: require_approval
        reason: "Retrieval quality below threshold"
"#;

fn readme_content(dir: &Path) -> String {
    let dir_str = dir.display().to_string();
    format!(
        r#"# Geval workspace

Created by `geval init`. Edit the files in this folder and run Geval from your project root.

## Files

- **contract.yaml** — Contract: name, version, combine rule, and list of policy paths. Bump version when you change policies or combine rule.
- **policies/** — Policy files (e.g. security.yaml, quality.yaml). Each has name, version, and rules. Paths in contract are relative to the contract file.
- **signals.json** — Your data (metrics, scores). Set name and version; bump version when the pipeline or schema changes.

## Combine rule (`combine`)

- **worst_case** — Merge by severity: any **BLOCK** wins; else any **REQUIRE_APPROVAL**; else **PASS**.

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

Add these files to version control to share the contract with your team.
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
    let security_path = policies_dir.join("security.yaml");
    let quality_path = policies_dir.join("quality.yaml");

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
    fs::write(&security_path, POLICY_SECURITY_TEMPLATE)
        .with_context(|| format!("write {}", security_path.display()))?;
    fs::write(&quality_path, POLICY_QUALITY_TEMPLATE)
        .with_context(|| format!("write {}", quality_path.display()))?;
    fs::write(&readme_path, readme_content(dir))
        .with_context(|| format!("write {}", readme_path.display()))?;

    Ok(())
}
