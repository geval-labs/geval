//! Run a contract: evaluate each policy against signals, then combine outcomes.

use anyhow::Result;

use crate::contract::{apply_combine_rule, ContractDef};
use crate::evaluator::{evaluate, Decision, DecisionOutcome};
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
    /// Matched rule name (if any).
    pub matched_rule: Option<String>,
    /// Reason from the matched rule (if any).
    pub reason: Option<String>,
}

/// Result of running a full contract: per-policy results and combined decision.
#[derive(Debug, Clone)]
pub struct ContractResult {
    pub contract_name: String,
    pub contract_version: String,
    pub policy_results: Vec<PolicyResult>,
    pub combined_decision: Decision,
    pub combine_rule: crate::contract::CombineRule,
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
        };
    }
    let first_non_pass = results.iter().find(|r| r.outcome != DecisionOutcome::Pass);
    match first_non_pass {
        Some(r) => Decision {
            outcome,
            matched_rule: r.matched_rule.clone().map(|rule| format!("{}:{}", r.policy_path, rule)),
            reason: r.reason.clone(),
        },
        None => Decision {
            outcome,
            matched_rule: None,
            reason: None,
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
            combine: CombineRule::AllPass,
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
        assert_eq!(result.combined_decision.outcome, DecisionOutcome::Pass);
    }

    #[test]
    fn run_contract_two_policies_all_pass_combined_block() {
        let contract = ContractDef {
            name: "test".to_string(),
            version: "1.0".to_string(),
            combine: CombineRule::AllPass,
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
        assert_eq!(result.policy_results[1].outcome, DecisionOutcome::Block);
        assert_eq!(result.combined_decision.outcome, DecisionOutcome::Block);
    }

    #[test]
    fn run_contract_any_block_blocks() {
        let contract = ContractDef {
            name: "test".to_string(),
            version: "1.0".to_string(),
            combine: CombineRule::AnyBlockBlocks,
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
}
