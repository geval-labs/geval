//! Evaluation engine: for each rule in priority order, if rule matches signal graph then return that decision; else PASS.

use crate::policy::{Action, Operator, Policy, Rule};
use crate::signal_graph::SignalGraph;
use serde::Serialize;

/// Final decision outcome (for exit codes and reporting).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DecisionOutcome {
    Pass,
    RequireApproval,
    Block,
}

/// Full decision with matched rule and reason.
#[derive(Debug, Clone, Serialize)]
pub struct Decision {
    pub outcome: DecisionOutcome,
    pub matched_rule: Option<String>,
    pub reason: Option<String>,
}

impl Decision {
    pub fn pass() -> Self {
        Self {
            outcome: DecisionOutcome::Pass,
            matched_rule: None,
            reason: None,
        }
    }
}

/// Evaluate policy against signal graph. Rules are evaluated in priority order;
/// first matching rule determines the decision. If no rule matches, return PASS.
pub fn evaluate(policy: &Policy, graph: &SignalGraph) -> Decision {
    for rule in policy.sorted_rules() {
        if rule_matches(rule, graph) {
            let outcome = match rule.then.action {
                Action::Pass => DecisionOutcome::Pass,
                Action::Block => DecisionOutcome::Block,
                Action::RequireApproval => DecisionOutcome::RequireApproval,
            };
            return Decision {
                outcome,
                matched_rule: Some(rule.name.clone()),
                reason: rule.then.reason.clone(),
            };
        }
    }
    Decision::pass()
}

fn rule_matches(rule: &Rule, graph: &SignalGraph) -> bool {
    let w = &rule.when;

    let metric = match &w.metric {
        Some(m) => m.as_str(),
        None => return false,
    };

    let component = w.component.as_deref();

    // Optional filters: if rule specifies system/agent/step, we could filter signals;
    // spec focuses on metric + component + operator + threshold, so we keep it simple.
    let value = graph.get_first_value(metric, component);

    let op = w.operator.unwrap_or(Operator::Presence);

    match op {
        Operator::Presence => graph.has_metric(metric, component),
        Operator::Equal => {
            let thresh = match w.threshold {
                Some(t) => t,
                None => return false,
            };
            value.map(|v| (v - thresh).abs() < 1e-9).unwrap_or(false)
        }
        Operator::GreaterThan => {
            let thresh = w.threshold.unwrap_or(0.0);
            value.map(|v| v > thresh).unwrap_or(false)
        }
        Operator::LessThan => {
            let thresh = w.threshold.unwrap_or(0.0);
            value.map(|v| v < thresh).unwrap_or(false)
        }
        Operator::GreaterOrEqual => {
            let thresh = w.threshold.unwrap_or(0.0);
            value.map(|v| v >= thresh).unwrap_or(false)
        }
        Operator::LessOrEqual => {
            let thresh = w.threshold.unwrap_or(0.0);
            value.map(|v| v <= thresh).unwrap_or(false)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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
    fn test_no_match_returns_pass() {
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
        let d = evaluate(&policy, &graph);
        assert_eq!(d.outcome, DecisionOutcome::Pass);
        assert!(d.matched_rule.is_none());
    }

    #[test]
    fn test_first_matching_rule_wins() {
        let policy = parse_policy_str(
            r#"
rules:
  - priority: 2
    name: retrieval
    when:
      component: retrieval
      metric: context_relevance
      operator: "<"
      threshold: 0.85
    then:
      action: require_approval
  - priority: 1
    name: hallucination
    when:
      component: generator
      metric: hallucination_rate
      operator: ">"
      threshold: 0.05
    then:
      action: block
"#,
        )
        .unwrap();
        let signals = SignalSet::new(vec![
            sig(Some("retrieval"), "context_relevance", 0.84),
            sig(Some("generator"), "hallucination_rate", 0.06),
        ]);
        let graph = SignalGraph::build(&signals.signals);
        let d = evaluate(&policy, &graph);
        // Priority 1 matches first: hallucination_guard
        assert_eq!(d.outcome, DecisionOutcome::Block);
        assert_eq!(d.matched_rule.as_deref(), Some("hallucination"));
    }
}
