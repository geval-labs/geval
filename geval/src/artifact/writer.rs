//! Write decision artifacts to .geval/decisions/<timestamp>.json
//!
//! Contract-centric: every artifact records the contract (name, version, combine rule),
//! per-policy results, and the combined decision. Nothing is unversioned.

use crate::contract::ContractResult;
use crate::evaluator::DecisionOutcome;
use anyhow::{Context, Result};
use chrono::Utc;
use serde::Serialize;
use std::path::Path;

/// Schema version of the decision artifact format. Bump when the artifact shape changes.
pub const DECISION_ARTIFACT_VERSION: &str = "2";

/// Per-policy result as stored in the artifact.
#[derive(Debug, Serialize)]
pub struct PolicyResultRecord {
    pub policy_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub policy_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub policy_version: Option<String>,
    pub policy_hash: String,
    pub outcome: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matched_rule: Option<String>,
}

/// Artifact written per run. Contract-centric; all versioned.
#[derive(Debug, Serialize)]
pub struct DecisionArtifact {
    pub artifact_version: String,
    pub geval_version: String,
    pub contract_name: String,
    pub contract_version: String,
    pub contract_hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signals_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signals_version: Option<String>,
    pub signals_hash: String,
    pub combine_rule: String,
    pub policy_results: Vec<PolicyResultRecord>,
    pub combined_decision: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub combined_matched_rule: Option<String>,
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
    result: &ContractResult,
    contract_hash: &str,
    policy_hashes: &[String],
    signals_hash: &str,
    signals_name: Option<&str>,
    signals_version: Option<&str>,
    approval: Option<ApprovalPayload>,
) -> Result<std::path::PathBuf> {
    let decisions_dir = dir.join(".geval").join("decisions");
    std::fs::create_dir_all(&decisions_dir)
        .with_context(|| format!("create {}", decisions_dir.display()))?;
    let now = Utc::now();
    let ts_iso = now.format("%Y-%m-%dT%H:%M:%SZ").to_string();
    // Windows does not allow ':' in filenames; use dashes in time part for the filename only.
    let ts_filename = now.format("%Y-%m-%dT%H-%M-%SZ");
    let filename = format!("{}.json", ts_filename);
    let path = decisions_dir.join(&filename);

    let policy_results: Vec<PolicyResultRecord> = result
        .policy_results
        .iter()
        .zip(policy_hashes.iter())
        .map(|(r, hash)| PolicyResultRecord {
            policy_path: r.policy_path.clone(),
            policy_name: r.policy_name.clone(),
            policy_version: r.policy_version.clone(),
            policy_hash: hash.clone(),
            outcome: outcome_str(r.outcome).to_string(),
            matched_rule: r.matched_rule.clone(),
        })
        .collect();

    let combined_decision_str = match result.combined_decision.outcome {
        DecisionOutcome::Pass => "PASS",
        DecisionOutcome::RequireApproval => "REQUIRE_APPROVAL",
        DecisionOutcome::Block => "BLOCK",
    };

    let artifact = DecisionArtifact {
        artifact_version: DECISION_ARTIFACT_VERSION.to_string(),
        geval_version: crate::GEVAL_VERSION.to_string(),
        contract_name: result.contract_name.clone(),
        contract_version: result.contract_version.clone(),
        contract_hash: contract_hash.to_string(),
        signals_name: signals_name.map(String::from),
        signals_version: signals_version.map(String::from),
        signals_hash: signals_hash.to_string(),
        combine_rule: result.combine_rule.to_string(),
        policy_results,
        combined_decision: combined_decision_str.to_string(),
        combined_matched_rule: result.combined_decision.matched_rule.clone(),
        timestamp: ts_iso,
        approval,
    };

    let json = serde_json::to_string_pretty(&artifact).context("serialize artifact")?;
    std::fs::write(&path, json).with_context(|| format!("write {}", path.display()))?;
    Ok(path)
}

fn outcome_str(o: DecisionOutcome) -> &'static str {
    match o {
        DecisionOutcome::Pass => "PASS",
        DecisionOutcome::RequireApproval => "REQUIRE_APPROVAL",
        DecisionOutcome::Block => "BLOCK",
    }
}
