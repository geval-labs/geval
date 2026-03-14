//! Write decision artifacts to .geval/decisions/<timestamp>.json

use crate::evaluator::{Decision, DecisionOutcome};
use anyhow::{Context, Result};
use chrono::Utc;
use serde::Serialize;
use std::path::Path;

/// Artifact written per run.
#[derive(Debug, Serialize)]
pub struct DecisionArtifact {
    pub policy_hash: String,
    pub signals_hash: String,
    pub decision: String,
    pub matched_rule: Option<String>,
    pub timestamp: String,
    pub approval: Option<ApprovalPayload>,
}

#[derive(Debug, Serialize)]
pub struct ApprovalPayload {
    pub approved_by: String,
    pub reason: String,
    pub timestamp: String,
}

/// Write artifact to .geval/decisions/<timestamp>.json
pub fn write_decision_artifact(
    dir: &Path,
    policy_hash: &str,
    signals_hash: &str,
    decision: &Decision,
    approval: Option<ApprovalPayload>,
) -> Result<std::path::PathBuf> {
    let decisions_dir = dir.join(".geval").join("decisions");
    std::fs::create_dir_all(&decisions_dir).with_context(|| format!("create {}", decisions_dir.display()))?;
    let ts = Utc::now().format("%Y-%m-%dT%H:%M:%SZ");
    let filename = format!("{}.json", ts);
    let path = decisions_dir.join(&filename);

    let decision_str = match decision.outcome {
        DecisionOutcome::Pass => "PASS",
        DecisionOutcome::RequireApproval => "REQUIRE_APPROVAL",
        DecisionOutcome::Block => "BLOCK",
    };

    let artifact = DecisionArtifact {
        policy_hash: policy_hash.to_string(),
        signals_hash: signals_hash.to_string(),
        decision: decision_str.to_string(),
        matched_rule: decision.matched_rule.clone(),
        timestamp: ts.to_string(),
        approval,
    };

    let json = serde_json::to_string_pretty(&artifact).context("serialize artifact")?;
    std::fs::write(&path, json).with_context(|| format!("write {}", path.display()))?;
    Ok(path)
}
