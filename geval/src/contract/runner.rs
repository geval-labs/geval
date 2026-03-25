//! Run a contract: evaluate each policy against signals, then combine outcomes.
//!
//! Multiple contracts share one signal graph; outcomes are merged with `contracts_combine`.

use anyhow::Result;
use std::path::PathBuf;

use crate::contract::{apply_combine_rule, load_contract_and_policies, ContractDef, CombineRule};
use crate::evaluator::{evaluate, Decision, DecisionOutcome};
use crate::hashing::{hash_contract_content, hash_policy};
use crate::policy::Policy;
use crate::signal_graph::SignalGraph;

/// Result of evaluating one policy (for artifact and reporting).
#[derive(Debug, Clone)]
pub struct PolicyResult {
    /// Policy file path (as in contract).
    pub policy_path: String,
    /// Policy name from the policy YAML (if set).
    pub policy_name: Option<String>,
    /// Policy version from the policy YAML (if set).
    pub policy_version: Option<String>,
    /// Outcome for this policy.
    pub outcome: DecisionOutcome,
    /// Winning rule name (if any): best priority among rules whose `when` matched.
    pub matched_rule: Option<String>,
    /// All rule names whose `when` matched, in priority order (1 first).
    pub matching_rules: Vec<String>,
    /// Reason from the winning rule (if any).
    pub reason: Option<String>,
}

/// Result of running a full contract: per-policy results and combined decision.
#[derive(Debug, Clone)]
pub struct ContractResult {
    pub contract_name: String,
    pub contract_version: String,
    pub policy_results: Vec<PolicyResult>,
    pub combined_decision: Decision,
    pub combine_rule: CombineRule,
}

/// One evaluated contract file plus hashes for audit.
#[derive(Debug, Clone)]
pub struct ContractRunEntry {
    pub contract_path: PathBuf,
    pub result: ContractResult,
    pub contract_hash: String,
    pub policy_hashes: Vec<String>,
}

/// Multiple contracts evaluated against the same signals; overall decision from `contracts_combine`.
#[derive(Debug, Clone)]
pub struct MultiContractRun {
    pub entries: Vec<ContractRunEntry>,
    pub contracts_combine: CombineRule,
    pub overall: Decision,
}

/// Evaluate the contract: run each policy against the graph, then combine.
/// `policies` must be in the same order as `contract.policies`.
pub fn run_contract(
    contract: &ContractDef,
    policies: &[Policy],
    graph: &SignalGraph,
) -> Result<ContractResult> {
    assert_eq!(
        contract.policies.len(),
        policies.len(),
        "policies list must match contract"
    );
    let mut policy_results = Vec::with_capacity(policies.len());
    let mut outcomes = Vec::with_capacity(policies.len());

    for (pref, policy) in contract.policies.iter().zip(policies.iter()) {
        let decision = evaluate(policy, graph);
        outcomes.push(decision.outcome);
        policy_results.push(PolicyResult {
            policy_path: pref.path.clone(),
            policy_name: policy.name.clone(),
            policy_version: policy.version.clone(),
            outcome: decision.outcome,
            matched_rule: decision.matched_rule.clone(),
            matching_rules: decision.matching_rules.clone(),
            reason: decision.reason.clone(),
        });
    }

    let combined_outcome = apply_combine_rule(contract.combine, &outcomes);
    let combined_decision = combined_decision_from_results(&policy_results, combined_outcome);

    Ok(ContractResult {
        contract_name: contract.name.clone(),
        contract_version: contract.version.clone(),
        policy_results,
        combined_decision,
        combine_rule: contract.combine,
    })
}

/// Load each contract path, run it against `graph`, then combine contract-level outcomes with `contracts_combine`.
pub fn load_run_contracts(
    paths: &[PathBuf],
    graph: &SignalGraph,
    contracts_combine: CombineRule,
) -> Result<MultiContractRun> {
    if paths.is_empty() {
        anyhow::bail!("at least one contract path is required");
    }
    let mut entries = Vec::with_capacity(paths.len());
    for path in paths {
        let (contract, policies) = load_contract_and_policies(path)?;
        let contract_hash = hash_contract_content(&contract);
        let policy_hashes: Vec<String> = policies.iter().map(hash_policy).collect();
        let result = run_contract(&contract, &policies, graph)?;
        entries.push(ContractRunEntry {
            contract_path: path.clone(),
            result,
            contract_hash,
            policy_hashes,
        });
    }
    let outcomes: Vec<DecisionOutcome> = entries
        .iter()
        .map(|e| e.result.combined_decision.outcome)
        .collect();
    let overall_outcome = apply_combine_rule(contracts_combine, &outcomes);
    let overall = overall_decision_from_contracts(&entries, overall_outcome);
    Ok(MultiContractRun {
        entries,
        contracts_combine,
        overall,
    })
}

/// Build the combined Decision (outcome + a representative matched_rule/reason from the first non-PASS policy).
fn combined_decision_from_results(
    results: &[PolicyResult],
    outcome: DecisionOutcome,
) -> Decision {
    if outcome == DecisionOutcome::Pass {
        return Decision {
            outcome: DecisionOutcome::Pass,
            matched_rule: None,
            reason: None,
            matching_rules: Vec::new(),
        };
    }
    let first_non_pass = results.iter().find(|r| r.outcome != DecisionOutcome::Pass);
    match first_non_pass {
        Some(r) => Decision {
            outcome,
            matched_rule: r.matched_rule.clone().map(|rule| format!("{}:{}", r.policy_path, rule)),
            reason: r.reason.clone(),
            matching_rules: Vec::new(),
        },
        None => Decision {
            outcome,
            matched_rule: None,
            reason: None,
            matching_rules: Vec::new(),
        },
    }
}

/// Overall PR-level decision from contract-level outcomes (first failing contract supplies rule/reason).
fn overall_decision_from_contracts(
    entries: &[ContractRunEntry],
    outcome: DecisionOutcome,
) -> Decision {
    if outcome == DecisionOutcome::Pass {
        return Decision {
            outcome: DecisionOutcome::Pass,
            matched_rule: None,
            reason: None,
            matching_rules: Vec::new(),
        };
    }
    let first_non_pass = entries
        .iter()
        .find(|e| e.result.combined_decision.outcome != DecisionOutcome::Pass);
    match first_non_pass {
        Some(e) => {
            let d = &e.result.combined_decision;
            let matched_rule = d.matched_rule.as_ref().map(|m| {
                format!("{}:{}", e.contract_path.display(), m)
            });
            Decision {
                outcome,
                matched_rule,
                reason: d.reason.clone(),
                matching_rules: Vec::new(),
            }
        }
        None => Decision {
            outcome,
            matched_rule: None,
            reason: None,
            matching_rules: Vec::new(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contract::{CombineRule, PolicyRef};
    use crate::policy::parse_policy_str;
    use crate::signals::{Signal, SignalSet};
    use crate::signal_graph::SignalGraph;

    fn sig(component: Option<&str>, metric: &str, value: f64) -> Signal {
        Signal {
            system: None,
            agent: None,
            component: component.map(String::from),
            step: None,
            metric: Some(metric.to_string()),
            value: Some(serde_json::json!(value)),
            r#type: None,
        }
    }

    #[test]
    fn run_contract_single_policy_pass() {
        let contract = ContractDef {
            name: "test".to_string(),
            version: "1.0".to_string(),
            combine: CombineRule::WorstCase,
            policies: vec![PolicyRef {
                path: "p.yaml".to_string(),
            }],
        };
        let policy = parse_policy_str(
            r#"
rules:
  - priority: 1
    name: block_high
    when:
      metric: x
      operator: ">"
      threshold: 100
    then:
      action: block
"#,
        )
        .unwrap();
        let signals = SignalSet::new(vec![sig(None, "x", 1.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let result = run_contract(&contract, &[policy], &graph).unwrap();
        assert_eq!(result.policy_results.len(), 1);
        assert_eq!(result.policy_results[0].outcome, DecisionOutcome::Pass);
        assert!(result.policy_results[0].matching_rules.is_empty());
        assert_eq!(result.combined_decision.outcome, DecisionOutcome::Pass);
    }

    #[test]
    fn run_contract_two_policies_worst_case_combined_block() {
        let contract = ContractDef {
            name: "test".to_string(),
            version: "1.0".to_string(),
            combine: CombineRule::WorstCase,
            policies: vec![
                PolicyRef {
                    path: "a.yaml".to_string(),
                },
                PolicyRef {
                    path: "b.yaml".to_string(),
                },
            ],
        };
        let policy_a = parse_policy_str(
            r#"
rules:
  - priority: 1
    name: pass
    when:
      metric: x
      operator: ">="
      threshold: 0
    then:
      action: pass
"#,
        )
        .unwrap();
        let policy_b = parse_policy_str(
            r#"
rules:
  - priority: 1
    name: block_low
    when:
      metric: y
      operator: "<"
      threshold: 0.5
    then:
      action: block
"#,
        )
        .unwrap();
        let signals = SignalSet::new(vec![sig(None, "x", 1.0), sig(None, "y", 0.3)]);
        let graph = SignalGraph::build(&signals.signals);
        let result = run_contract(&contract, &[policy_a, policy_b], &graph).unwrap();
        assert_eq!(result.policy_results[0].outcome, DecisionOutcome::Pass);
        assert_eq!(result.policy_results[0].matching_rules, vec!["pass"]);
        assert_eq!(result.policy_results[1].outcome, DecisionOutcome::Block);
        assert_eq!(result.policy_results[1].matching_rules, vec!["block_low"]);
        assert_eq!(result.combined_decision.outcome, DecisionOutcome::Block);
    }

    #[test]
    fn run_contract_worst_case_one_policy_block_merges() {
        let contract = ContractDef {
            name: "test".to_string(),
            version: "1.0".to_string(),
            combine: CombineRule::WorstCase,
            policies: vec![
                PolicyRef {
                    path: "a.yaml".to_string(),
                },
                PolicyRef {
                    path: "b.yaml".to_string(),
                },
            ],
        };
        let policy_a = parse_policy_str(
            r#"rules: [{ priority: 1, name: p, when: { metric: x, operator: ">", threshold: 10 }, then: { action: block } }]"#,
        )
        .unwrap();
        let policy_b = parse_policy_str(
            r#"rules: [{ priority: 1, name: q, when: { metric: y, operator: ">", threshold: 10 }, then: { action: pass } }]"#,
        )
        .unwrap();
        let signals = SignalSet::new(vec![sig(None, "x", 1.0), sig(None, "y", 1.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let result = run_contract(&contract, &[policy_a.clone(), policy_b.clone()], &graph).unwrap();
        assert_eq!(result.policy_results[0].outcome, DecisionOutcome::Pass);
        assert_eq!(result.policy_results[1].outcome, DecisionOutcome::Pass);
        assert_eq!(result.combined_decision.outcome, DecisionOutcome::Pass);

        let signals_block = SignalSet::new(vec![sig(None, "x", 20.0), sig(None, "y", 1.0)]);
        let graph_block = SignalGraph::build(&signals_block.signals);
        let result_block = run_contract(&contract, &[policy_a, policy_b], &graph_block).unwrap();
        assert_eq!(result_block.policy_results[0].outcome, DecisionOutcome::Block);
        assert_eq!(result_block.combined_decision.outcome, DecisionOutcome::Block);
    }

    #[test]
    fn load_run_contracts_two_contracts_overall_pass() {
        let dir = tempfile::tempdir().unwrap();
        let p1 = dir.path().join("p1.yaml");
        let p2 = dir.path().join("p2.yaml");
        std::fs::write(
            &p1,
            r#"rules:
  - priority: 1
    name: ok
    when:
      metric: x
      operator: ">="
      threshold: 0
    then:
      action: pass
"#,
        )
        .unwrap();
        std::fs::write(
            &p2,
            r#"rules:
  - priority: 1
    name: ok2
    when:
      metric: y
      operator: ">="
      threshold: 0
    then:
      action: pass
"#,
        )
        .unwrap();
        let c1 = dir.path().join("contract1.yaml");
        let c2 = dir.path().join("contract2.yaml");
        std::fs::write(
            &c1,
            r#"
name: c1
version: "1.0.0"
combine: worst_case
policies:
  - path: p1.yaml
"#,
        )
        .unwrap();
        std::fs::write(
            &c2,
            r#"
name: c2
version: "1.0.0"
combine: worst_case
policies:
  - path: p2.yaml
"#,
        )
        .unwrap();

        let signals = SignalSet::new(vec![sig(None, "x", 1.0), sig(None, "y", 1.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let run = load_run_contracts(
            &[c1, c2],
            &graph,
            CombineRule::WorstCase,
        )
        .unwrap();
        assert_eq!(run.entries.len(), 2);
        assert_eq!(run.overall.outcome, DecisionOutcome::Pass);
    }

    #[test]
    fn load_run_contracts_one_block_overall_block() {
        let dir = tempfile::tempdir().unwrap();
        let p1 = dir.path().join("p1.yaml");
        let p2 = dir.path().join("p2.yaml");
        std::fs::write(
            &p1,
            r#"rules:
  - priority: 1
    name: block_x
    when:
      metric: x
      operator: ">"
      threshold: 100
    then:
      action: block
"#,
        )
        .unwrap();
        std::fs::write(
            &p2,
            r#"rules:
  - priority: 1
    name: ok
    when:
      metric: y
      operator: ">="
      threshold: 0
    then:
      action: pass
"#,
        )
        .unwrap();
        let c1 = dir.path().join("contract1.yaml");
        let c2 = dir.path().join("contract2.yaml");
        std::fs::write(
            &c1,
            r#"
name: c1
version: "1.0.0"
combine: worst_case
policies:
  - path: p1.yaml
"#,
        )
        .unwrap();
        std::fs::write(
            &c2,
            r#"
name: c2
version: "1.0.0"
combine: worst_case
policies:
  - path: p2.yaml
"#,
        )
        .unwrap();

        let signals = SignalSet::new(vec![sig(None, "x", 150.0), sig(None, "y", 1.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let run = load_run_contracts(
            &[c1.clone(), c2],
            &graph,
            CombineRule::WorstCase,
        )
        .unwrap();
        assert_eq!(run.overall.outcome, DecisionOutcome::Block);
        assert!(run.overall.matched_rule.unwrap().contains(c1.to_str().unwrap()));
    }

    #[test]
    fn load_run_contracts_worst_case_across_two_contracts() {
        let dir = tempfile::tempdir().unwrap();
        let p1 = dir.path().join("p1.yaml");
        let p2 = dir.path().join("p2.yaml");
        std::fs::write(
            &p1,
            r#"rules: [{ priority: 1, name: b, when: { metric: x, operator: ">", threshold: 10 }, then: { action: block } }]"#,
        )
        .unwrap();
        std::fs::write(
            &p2,
            r#"rules: [{ priority: 1, name: p, when: { metric: y, operator: ">", threshold: 10 }, then: { action: pass } }]"#,
        )
        .unwrap();
        let c1 = dir.path().join("contract1.yaml");
        let c2 = dir.path().join("contract2.yaml");
        std::fs::write(
            &c1,
            r#"
name: c1
version: "1.0.0"
combine: worst_case
policies:
  - path: p1.yaml
"#,
        )
        .unwrap();
        std::fs::write(
            &c2,
            r#"
name: c2
version: "1.0.0"
combine: worst_case
policies:
  - path: p2.yaml
"#,
        )
        .unwrap();

        let signals = SignalSet::new(vec![sig(None, "x", 1.0), sig(None, "y", 1.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let run = load_run_contracts(&[c1, c2], &graph, CombineRule::WorstCase).unwrap();
        assert_eq!(run.overall.outcome, DecisionOutcome::Pass);

        let signals_block = SignalSet::new(vec![sig(None, "x", 20.0), sig(None, "y", 1.0)]);
        let graph_b = SignalGraph::build(&signals_block.signals);
        let c1b = dir.path().join("contract1.yaml");
        let c2b = dir.path().join("contract2.yaml");
        let run_b =
            load_run_contracts(&[c1b, c2b], &graph_b, CombineRule::WorstCase).unwrap();
        assert_eq!(run_b.overall.outcome, DecisionOutcome::Block);
    }

    #[test]
    fn load_run_contracts_empty_paths_errors() {
        let signals = SignalSet::new(vec![sig(None, "x", 1.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let err = load_run_contracts(&[], &graph, CombineRule::WorstCase).unwrap_err();
        assert!(err.to_string().contains("at least one contract"));
    }

    /// worst_case across contracts: PASS + REQUIRE_APPROVAL → overall REQUIRE_APPROVAL (no BLOCK).
    #[test]
    fn load_run_contracts_pass_and_require_approval_overall_require_approval() {
        let dir = tempfile::tempdir().unwrap();
        let p_ok = dir.path().join("ok.yaml");
        let p_appr = dir.path().join("appr.yaml");
        std::fs::write(
            &p_ok,
            r#"rules:
  - priority: 1
    name: always_pass
    when:
      metric: x
      operator: ">="
      threshold: 0
    then:
      action: pass
"#,
        )
        .unwrap();
        std::fs::write(
            &p_appr,
            r#"rules:
  - priority: 1
    name: need_signoff
    when:
      metric: z
      operator: ">"
      threshold: 0
    then:
      action: require_approval
"#,
        )
        .unwrap();
        let c1 = dir.path().join("c_pass.yaml");
        let c2 = dir.path().join("c_appr.yaml");
        std::fs::write(
            &c1,
            r#"name: gate-a
version: "1.0.0"
combine: worst_case
policies:
  - path: ok.yaml
"#,
        )
        .unwrap();
        std::fs::write(
            &c2,
            r#"name: gate-b
version: "1.0.0"
combine: worst_case
policies:
  - path: appr.yaml
"#,
        )
        .unwrap();

        let signals = SignalSet::new(vec![sig(None, "x", 1.0), sig(None, "z", 0.5)]);
        let graph = SignalGraph::build(&signals.signals);
        let c2p = c2.clone();
        let run = load_run_contracts(&[c1, c2], &graph, CombineRule::WorstCase).unwrap();
        assert_eq!(run.entries[0].result.combined_decision.outcome, DecisionOutcome::Pass);
        assert_eq!(
            run.entries[1].result.combined_decision.outcome,
            DecisionOutcome::RequireApproval
        );
        assert_eq!(run.overall.outcome, DecisionOutcome::RequireApproval);
        assert!(
            run
                .overall
                .matched_rule
                .unwrap()
                .contains(c2p.to_str().unwrap()),
            "first non-PASS contract should be second"
        );
    }

    /// Second contract in CLI order blocks; overall BLOCK attributes to that contract path.
    #[test]
    fn load_run_contracts_second_contract_blocks_first_passes() {
        let dir = tempfile::tempdir().unwrap();
        let p_ok = dir.path().join("ok.yaml");
        let p_block = dir.path().join("blk.yaml");
        std::fs::write(
            &p_ok,
            r#"rules: [{ priority: 1, name: p, when: { metric: x, operator: ">=", threshold: 0 }, then: { action: pass } }]"#,
        )
        .unwrap();
        std::fs::write(
            &p_block,
            r#"rules: [{ priority: 1, name: b, when: { metric: w, operator: ">", threshold: 0.5 }, then: { action: block } }]"#,
        )
        .unwrap();
        let c1 = dir.path().join("first.yaml");
        let c2 = dir.path().join("second.yaml");
        std::fs::write(
            &c1,
            r#"name: first
version: "1.0.0"
combine: worst_case
policies:
  - path: ok.yaml
"#,
        )
        .unwrap();
        std::fs::write(
            &c2,
            r#"name: second
version: "1.0.0"
combine: worst_case
policies:
  - path: blk.yaml
"#,
        )
        .unwrap();

        let signals = SignalSet::new(vec![sig(None, "x", 1.0), sig(None, "w", 1.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let run = load_run_contracts(&[c1, c2.clone()], &graph, CombineRule::WorstCase).unwrap();
        assert_eq!(run.overall.outcome, DecisionOutcome::Block);
        assert!(run.overall.matched_rule.unwrap().contains(c2.to_str().unwrap()));
    }

    /// BLOCK in first contract wins over REQUIRE_APPROVAL in second (worst_case merge).
    #[test]
    fn load_run_contracts_block_wins_over_require_approval_across_contracts() {
        let dir = tempfile::tempdir().unwrap();
        let p_block = dir.path().join("blk.yaml");
        let p_appr = dir.path().join("appr.yaml");
        std::fs::write(
            &p_block,
            r#"rules: [{ priority: 1, name: b, when: { metric: x, operator: ">", threshold: 10 }, then: { action: block } }]"#,
        )
        .unwrap();
        std::fs::write(
            &p_appr,
            r#"rules: [{ priority: 1, name: a, when: { metric: z, operator: ">", threshold: 0 }, then: { action: require_approval } }]"#,
        )
        .unwrap();
        let c1 = dir.path().join("blocks.yaml");
        let c2 = dir.path().join("needs_appr.yaml");
        std::fs::write(
            &c1,
            r#"name: blocks-first
version: "1.0.0"
combine: worst_case
policies:
  - path: blk.yaml
"#,
        )
        .unwrap();
        std::fs::write(
            &c2,
            r#"name: appr-second
version: "1.0.0"
combine: worst_case
policies:
  - path: appr.yaml
"#,
        )
        .unwrap();

        let signals = SignalSet::new(vec![sig(None, "x", 20.0), sig(None, "z", 0.1)]);
        let graph = SignalGraph::build(&signals.signals);
        let run = load_run_contracts(&[c1.clone(), c2], &graph, CombineRule::WorstCase).unwrap();
        assert_eq!(run.overall.outcome, DecisionOutcome::Block);
        assert!(run.overall.matched_rule.unwrap().contains(c1.to_str().unwrap()));
    }

    /// No BLOCK anywhere → PASS + REQUIRE_APPROVAL → overall REQUIRE_APPROVAL.
    #[test]
    fn load_run_contracts_pass_and_require_approval_overall_when_no_block() {
        let dir = tempfile::tempdir().unwrap();
        let p_ok = dir.path().join("ok.yaml");
        let p_appr = dir.path().join("appr.yaml");
        std::fs::write(
            &p_ok,
            r#"rules: [{ priority: 1, name: p, when: { metric: x, operator: ">=", threshold: 0 }, then: { action: pass } }]"#,
        )
        .unwrap();
        std::fs::write(
            &p_appr,
            r#"rules: [{ priority: 1, name: a, when: { metric: z, operator: ">", threshold: 0 }, then: { action: require_approval } }]"#,
        )
        .unwrap();
        let c1 = dir.path().join("c1.yaml");
        let c2 = dir.path().join("c2.yaml");
        std::fs::write(
            &c1,
            r#"name: a
version: "1.0.0"
combine: worst_case
policies:
  - path: ok.yaml
"#,
        )
        .unwrap();
        std::fs::write(
            &c2,
            r#"name: b
version: "1.0.0"
combine: worst_case
policies:
  - path: appr.yaml
"#,
        )
        .unwrap();

        let signals = SignalSet::new(vec![sig(None, "x", 1.0), sig(None, "z", 0.1)]);
        let graph = SignalGraph::build(&signals.signals);
        let run = load_run_contracts(&[c1, c2], &graph, CombineRule::WorstCase).unwrap();
        assert_eq!(run.overall.outcome, DecisionOutcome::RequireApproval);
    }

    #[test]
    fn load_run_contracts_three_contracts_overall_pass() {
        let dir = tempfile::tempdir().unwrap();
        for i in 1..=3 {
            let p = dir.path().join(format!("p{}.yaml", i));
            std::fs::write(
                &p,
                format!(
                    r#"rules:
  - priority: 1
    name: ok{}
    when:
      metric: m{}
      operator: ">="
      threshold: 0
    then:
      action: pass
"#,
                    i, i
                ),
            )
            .unwrap();
        }
        let mut paths = Vec::new();
        for i in 1..=3 {
            let c = dir.path().join(format!("c{}.yaml", i));
            std::fs::write(
                &c,
                format!(
                    r#"name: c{}
version: "1.0.0"
combine: worst_case
policies:
  - path: p{}.yaml
"#,
                    i, i
                ),
            )
            .unwrap();
            paths.push(c);
        }
        let signals = SignalSet::new(vec![
            sig(None, "m1", 1.0),
            sig(None, "m2", 1.0),
            sig(None, "m3", 1.0),
        ]);
        let graph = SignalGraph::build(&signals.signals);
        let run = load_run_contracts(&paths, &graph, CombineRule::WorstCase).unwrap();
        assert_eq!(run.entries.len(), 3);
        assert_eq!(run.overall.outcome, DecisionOutcome::Pass);
    }

    /// One contract with two policies (internal worst_case); partner contract passes — overall pass.
    #[test]
    fn load_run_contracts_partner_passes_when_first_has_two_policies_internal_combine() {
        let dir = tempfile::tempdir().unwrap();
        let p_a = dir.path().join("pa.yaml");
        let p_b = dir.path().join("pb.yaml");
        let p_partner = dir.path().join("partner.yaml");
        std::fs::write(
            &p_a,
            r#"rules: [{ priority: 1, name: p, when: { metric: x, operator: ">=", threshold: 0 }, then: { action: pass } }]"#,
        )
        .unwrap();
        std::fs::write(
            &p_b,
            r#"rules: [{ priority: 1, name: q, when: { metric: y, operator: ">=", threshold: 0 }, then: { action: pass } }]"#,
        )
        .unwrap();
        std::fs::write(
            &p_partner,
            r#"rules: [{ priority: 1, name: r, when: { metric: z, operator: ">=", threshold: 0 }, then: { action: pass } }]"#,
        )
        .unwrap();
        let c_multi = dir.path().join("multi_policy_contract.yaml");
        let c_single = dir.path().join("partner_contract.yaml");
        std::fs::write(
            &c_multi,
            r#"name: dual-policy-gate
version: "1.0.0"
combine: worst_case
policies:
  - path: pa.yaml
  - path: pb.yaml
"#,
        )
        .unwrap();
        std::fs::write(
            &c_single,
            r#"name: partner
version: "1.0.0"
combine: worst_case
policies:
  - path: partner.yaml
"#,
        )
        .unwrap();

        let signals = SignalSet::new(vec![
            sig(None, "x", 1.0),
            sig(None, "y", 1.0),
            sig(None, "z", 1.0),
        ]);
        let graph = SignalGraph::build(&signals.signals);
        let run = load_run_contracts(&[c_multi, c_single], &graph, CombineRule::WorstCase).unwrap();
        assert_eq!(run.entries[0].result.policy_results.len(), 2);
        assert_eq!(run.overall.outcome, DecisionOutcome::Pass);
    }

    /// Both contracts BLOCK on the same signal; overall `matched_rule` prefixes the **first** failing contract path (CLI order).
    #[test]
    fn load_run_contracts_order_first_block_wins_for_matched_rule_prefix() {
        let dir = tempfile::tempdir().unwrap();
        let p_blk = dir.path().join("blk.yaml");
        std::fs::write(
            &p_blk,
            r#"rules: [{ priority: 1, name: stop, when: { metric: x, operator: ">", threshold: 0 }, then: { action: block } }]"#,
        )
        .unwrap();
        let c_first = dir.path().join("contract_alpha.yaml");
        let c_second = dir.path().join("contract_beta.yaml");
        std::fs::write(
            &c_first,
            r#"name: alpha
version: "1.0.0"
combine: worst_case
policies:
  - path: blk.yaml
"#,
        )
        .unwrap();
        std::fs::write(
            &c_second,
            r#"name: beta
version: "1.0.0"
combine: worst_case
policies:
  - path: blk.yaml
"#,
        )
        .unwrap();

        let signals = SignalSet::new(vec![sig(None, "x", 1.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let run_a_then_b = load_run_contracts(
            &[c_first.clone(), c_second.clone()],
            &graph,
            CombineRule::WorstCase,
        )
        .unwrap();
        let rule_ab = run_a_then_b.overall.matched_rule.unwrap();
        assert!(
            rule_ab.contains("contract_alpha"),
            "expected alpha path first: {}",
            rule_ab
        );

        let run_b_then_a = load_run_contracts(&[c_second, c_first], &graph, CombineRule::WorstCase).unwrap();
        let rule_ba = run_b_then_a.overall.matched_rule.unwrap();
        assert!(
            rule_ba.contains("contract_beta"),
            "expected beta path first: {}",
            rule_ba
        );
    }
}
