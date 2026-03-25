//! Write decision artifacts to .geval/decisions/<timestamp>.json
//!
//! Multi-contract: artifact v4 adds `matching_rules` per policy; `contracts_combine_rule` records
//! the merge mode (typically `worst_case`).

use crate::contract::MultiContractRun;
use crate::evaluator::DecisionOutcome;
use anyhow::{Context, Result};
use chrono::Utc;
use serde::Serialize;
use std::path::Path;

use crate::hashing::hash_contract_bundle;

/// Schema version of the decision artifact format. Bump when the artifact shape changes.
pub const DECISION_ARTIFACT_VERSION: &str = "4";

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
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub matching_rules: Vec<String>,
}

/// One contract’s slice of the artifact (mirrors former v2 single-contract payload, nested).
#[derive(Debug, Serialize)]
pub struct ContractDecisionBlock {
    pub contract_path: String,
    pub contract_name: String,
    pub contract_version: String,
    pub contract_hash: String,
    pub combine_rule: String,
    pub policy_results: Vec<PolicyResultRecord>,
    pub combined_decision: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub combined_matched_rule: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub combined_reason: Option<String>,
}

/// Multi-contract decision artifact (v4).
#[derive(Debug, Serialize)]
pub struct DecisionArtifactV3 {
    pub artifact_version: String,
    pub geval_version: String,
    pub bundle_hash: String,
    pub contracts_combine_rule: String,
    pub contracts: Vec<ContractDecisionBlock>,
    pub overall_combined_decision: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overall_matched_rule: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overall_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signals_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signals_version: Option<String>,
    pub signals_hash: String,
    pub timestamp: String,
    pub approval: Option<ApprovalPayload>,
}

#[derive(Debug, Serialize)]
pub struct ApprovalPayload {
    pub approved_by: String,
    pub reason: String,
    pub timestamp: String,
}

fn policy_records_for_contract(
    entry: &crate::contract::ContractRunEntry,
) -> Vec<PolicyResultRecord> {
    entry
        .result
        .policy_results
        .iter()
        .zip(entry.policy_hashes.iter())
        .map(|(r, hash)| PolicyResultRecord {
            policy_path: r.policy_path.clone(),
            policy_name: r.policy_name.clone(),
            policy_version: r.policy_version.clone(),
            policy_hash: hash.clone(),
            outcome: outcome_str(r.outcome).to_string(),
            matched_rule: r.matched_rule.clone(),
            matching_rules: r.matching_rules.clone(),
        })
        .collect()
}

fn contract_block(entry: &crate::contract::ContractRunEntry) -> ContractDecisionBlock {
    let result = &entry.result;
    let combined_decision_str = outcome_str(result.combined_decision.outcome).to_string();
    ContractDecisionBlock {
        contract_path: entry.contract_path.display().to_string(),
        contract_name: result.contract_name.clone(),
        contract_version: result.contract_version.clone(),
        contract_hash: entry.contract_hash.clone(),
        combine_rule: result.combine_rule.to_string(),
        policy_results: policy_records_for_contract(entry),
        combined_decision: combined_decision_str,
        combined_matched_rule: result.combined_decision.matched_rule.clone(),
        combined_reason: result.combined_decision.reason.clone(),
    }
}

/// Write multi-contract artifact to `.geval/decisions/<timestamp>.json`.
pub fn write_multi_contract_artifact(
    dir: &Path,
    run: &MultiContractRun,
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
    let ts_filename = now.format("%Y-%m-%dT%H-%M-%SZ");
    let filename = format!("{}.json", ts_filename);
    let path = decisions_dir.join(&filename);

    let bundle_pairs: Vec<(std::path::PathBuf, &str)> = run
        .entries
        .iter()
        .map(|e| (e.contract_path.clone(), e.contract_hash.as_str()))
        .collect();
    let bundle_hash = hash_contract_bundle(&bundle_pairs);

    let contracts: Vec<ContractDecisionBlock> = run.entries.iter().map(contract_block).collect();

    let overall_combined_decision = outcome_str(run.overall.outcome).to_string();

    let artifact = DecisionArtifactV3 {
        artifact_version: DECISION_ARTIFACT_VERSION.to_string(),
        geval_version: crate::GEVAL_VERSION.to_string(),
        bundle_hash,
        contracts_combine_rule: run.contracts_combine.to_string(),
        contracts,
        overall_combined_decision,
        overall_matched_rule: run.overall.matched_rule.clone(),
        overall_reason: run.overall.reason.clone(),
        signals_name: signals_name.map(String::from),
        signals_version: signals_version.map(String::from),
        signals_hash: signals_hash.to_string(),
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contract::load_run_contracts;
    use crate::contract::CombineRule;
    use crate::signal_graph::SignalGraph;
    use crate::signals::{Signal, SignalSet};

    fn sig(metric: &str, value: f64) -> Signal {
        Signal {
            system: None,
            agent: None,
            component: None,
            step: None,
            metric: Some(metric.to_string()),
            value: Some(serde_json::json!(value)),
            r#type: None,
        }
    }

    fn minimal_pass_contract(dir: &std::path::Path, name: &str, contract_file: &str, policy_file: &str) {
        let p = dir.join(policy_file);
        std::fs::write(
            &p,
            r#"rules: [{ priority: 1, name: ok, when: { metric: x, operator: ">=", threshold: 0 }, then: { action: pass } }]"#,
        )
        .unwrap();
        let c = dir.join(contract_file);
        std::fs::write(
            &c,
            format!(
                r#"name: {}
version: "1.0.0"
combine: worst_case
policies:
  - path: {}
"#,
                name, policy_file
            ),
        )
        .unwrap();
    }

    #[test]
    fn write_multi_contract_artifact_is_valid_v4_json() {
        let dir = tempfile::tempdir().unwrap();
        minimal_pass_contract(dir.path(), "a", "ca.yaml", "pa.yaml");
        minimal_pass_contract(dir.path(), "b", "cb.yaml", "pb.yaml");
        let c1 = dir.path().join("ca.yaml");
        let c2 = dir.path().join("cb.yaml");

        let signals = SignalSet::new(vec![sig("x", 1.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let run = load_run_contracts(&[c1, c2], &graph, CombineRule::WorstCase).unwrap();

        let out_dir = tempfile::tempdir().unwrap();
        let path = write_multi_contract_artifact(
            out_dir.path(),
            &run,
            "deadbeefsignals",
            Some("ci-signals"),
            Some("1.0.0"),
            None,
        )
        .unwrap();

        let json = std::fs::read_to_string(&path).unwrap();
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(v["artifact_version"], "4");
        assert_eq!(v["contracts_combine_rule"], "worst_case");
        assert_eq!(v["overall_combined_decision"], "PASS");
        assert!(v["bundle_hash"].as_str().unwrap().len() == 64);
        assert_eq!(v["contracts"].as_array().unwrap().len(), 2);
        assert_eq!(v["signals_hash"], "deadbeefsignals");
        assert_eq!(v["signals_name"], "ci-signals");
        assert!(v["timestamp"].as_str().unwrap().contains('T'));
    }

    #[test]
    fn write_multi_contract_artifact_nested_policy_results() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("policy.yaml");
        std::fs::write(
            &p,
            r#"rules:
  - priority: 1
    name: block_x
    when:
      metric: x
      operator: ">"
      threshold: 10
    then:
      action: block
"#,
        )
        .unwrap();
        let c = dir.path().join("contract.yaml");
        std::fs::write(
            &c,
            r#"name: solo
version: "1.0.0"
combine: worst_case
policies:
  - path: policy.yaml
"#,
        )
        .unwrap();

        let signals = SignalSet::new(vec![sig("x", 99.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let run = load_run_contracts(&[c], &graph, CombineRule::WorstCase).unwrap();
        assert_eq!(run.entries.len(), 1);

        let out_dir = tempfile::tempdir().unwrap();
        let path = write_multi_contract_artifact(out_dir.path(), &run, "hash", None, None, None).unwrap();
        let json = std::fs::read_to_string(&path).unwrap();
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        let contracts = v["contracts"].as_array().unwrap();
        assert_eq!(contracts.len(), 1);
        let pr = contracts[0]["policy_results"].as_array().unwrap();
        assert_eq!(pr.len(), 1);
        assert_eq!(pr[0]["outcome"], "BLOCK");
        assert_eq!(
            pr[0]["matching_rules"].as_array().unwrap()[0].as_str().unwrap(),
            "block_x"
        );
        assert_eq!(v["overall_combined_decision"], "BLOCK");
    }

    #[test]
    fn approval_payload_round_trips_in_json() {
        let dir = tempfile::tempdir().unwrap();
        minimal_pass_contract(dir.path(), "x", "c.yaml", "p.yaml");
        let c = dir.path().join("c.yaml");
        let signals = SignalSet::new(vec![sig("x", 1.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let run = load_run_contracts(&[c], &graph, CombineRule::WorstCase).unwrap();
        let out_dir = tempfile::tempdir().unwrap();
        let approval = ApprovalPayload {
            approved_by: "alice".to_string(),
            reason: "lgtm".to_string(),
            timestamp: "2020-01-01T00:00:00Z".to_string(),
        };
        let path = write_multi_contract_artifact(
            out_dir.path(),
            &run,
            "h",
            None,
            None,
            Some(approval),
        )
        .unwrap();
        let json = std::fs::read_to_string(&path).unwrap();
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(v["approval"]["approved_by"], "alice");
        assert_eq!(v["approval"]["reason"], "lgtm");
    }
}
