//! Evaluation engine: every rule is checked against the signal graph; **all** matches are recorded,
//! and the **winning** rule is the one with the **best** priority (**1** = highest; larger numbers are lower).
//! If no rule matches, the policy outcome is PASS.

use crate::policy::{Action, Operator, Policy, Rule};
use crate::signal_graph::SignalGraph;
use serde::Serialize;

/// One step in the evaluation trace: one rule checked, with the value used and whether it matched.
#[derive(Debug, Clone)]
pub struct RuleTrace {
    pub rule_name: String,
    pub priority: u32,
    /// Human-readable condition, e.g. "engagement_drop > 0"
    pub condition: String,
    pub metric: String,
    pub component: Option<String>,
    pub operator: Operator,
    pub threshold: Option<f64>,
    /// Value from signals (if any) used for comparison
    pub signal_value: Option<f64>,
    pub matched: bool,
    pub action: Action,
    pub reason: Option<String>,
}

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
    /// Winning rule name (best priority among those whose `when` matched).
    pub matched_rule: Option<String>,
    pub reason: Option<String>,
    /// Names of all rules whose `when` matched, in **priority order** (ascending; 1 first).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub matching_rules: Vec<String>,
}

impl Decision {
    pub fn pass() -> Self {
        Self {
            outcome: DecisionOutcome::Pass,
            matched_rule: None,
            reason: None,
            matching_rules: Vec::new(),
        }
    }
}

/// Evaluate policy against the signal graph. Every rule is tested; the outcome comes from the
/// matching rule with the **smallest** `priority` number (**1** = highest precedence).
pub fn evaluate(policy: &Policy, graph: &SignalGraph) -> Decision {
    let (decision, _) = evaluate_with_trace(policy, graph);
    decision
}

/// Like evaluate, but also returns a trace of each rule evaluation for display.
pub fn evaluate_with_trace(policy: &Policy, graph: &SignalGraph) -> (Decision, Vec<RuleTrace>) {
    let mut trace = Vec::new();
    let mut matching_rules = Vec::new();
    for rule in policy.sorted_rules() {
        let (matched, condition, signal_value, _threshold) = rule_match_detail(rule, graph);
        trace.push(RuleTrace {
            rule_name: rule.name.clone(),
            priority: rule.priority,
            condition: condition.clone(),
            metric: rule.when.metric.clone().unwrap_or_else(|| "?".into()),
            component: rule.when.component.clone(),
            operator: rule.when.operator.unwrap_or(Operator::Presence),
            threshold: rule.when.threshold,
            signal_value,
            matched,
            action: rule.then.action,
            reason: rule.then.reason.clone(),
        });
        if matched {
            matching_rules.push(rule.name.clone());
        }
    }
    let winner = trace
        .iter()
        .filter(|t| t.matched)
        .min_by_key(|t| t.priority);
    let decision = if let Some(t) = winner {
        let outcome = match t.action {
            Action::Pass => DecisionOutcome::Pass,
            Action::Block => DecisionOutcome::Block,
            Action::RequireApproval => DecisionOutcome::RequireApproval,
        };
        Decision {
            outcome,
            matched_rule: Some(t.rule_name.clone()),
            reason: t.reason.clone(),
            matching_rules,
        }
    } else {
        Decision::pass()
    };
    (decision, trace)
}

/// Returns (matched, condition_string, signal_value, threshold).
fn rule_match_detail(
    rule: &Rule,
    graph: &SignalGraph,
) -> (bool, String, Option<f64>, Option<f64>) {
    let w = &rule.when;
    let metric = match &w.metric {
        Some(m) => m.as_str(),
        None => return (false, "no metric".into(), None, None),
    };
    let component = w.component.as_deref();
    let value = graph.get_first_value(metric, component);
    let op = w.operator.unwrap_or(Operator::Presence);
    let thresh = w.threshold;

    let condition = format_condition(metric, component, op, thresh);

    let matched = match op {
        Operator::Presence => graph.has_metric(metric, component),
        Operator::Equal => {
            let t = match thresh {
                Some(t) => t,
                None => return (false, condition, value, thresh),
            };
            value.map(|v| (v - t).abs() < 1e-9).unwrap_or(false)
        }
        Operator::GreaterThan => {
            let t = thresh.unwrap_or(0.0);
            value.map(|v| v > t).unwrap_or(false)
        }
        Operator::LessThan => {
            let t = thresh.unwrap_or(0.0);
            value.map(|v| v < t).unwrap_or(false)
        }
        Operator::GreaterOrEqual => {
            let t = thresh.unwrap_or(0.0);
            value.map(|v| v >= t).unwrap_or(false)
        }
        Operator::LessOrEqual => {
            let t = thresh.unwrap_or(0.0);
            value.map(|v| v <= t).unwrap_or(false)
        }
    };

    (matched, condition, value, thresh)
}

fn format_condition(
    metric: &str,
    component: Option<&str>,
    op: Operator,
    threshold: Option<f64>,
) -> String {
    let left = match component {
        Some(c) => format!("{}.{}", c, metric),
        None => metric.to_string(),
    };
    let op_str = match op {
        Operator::GreaterThan => ">",
        Operator::LessThan => "<",
        Operator::GreaterOrEqual => ">=",
        Operator::LessOrEqual => "<=",
        Operator::Equal => "==",
        Operator::Presence => "present?",
    };
    match (op_str, threshold) {
        ("present?", _) => format!("{} {}", left, op_str),
        (_, Some(t)) => format!("{} {} {}", left, op_str, t),
        (_, None) => format!("{} {}", left, op_str),
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

    /// Presence-only signal: metric but no numeric value. Used for "this thing happened" without a score.
    fn sig_presence_only(metric: &str, component: Option<&str>) -> Signal {
        Signal {
            system: None,
            agent: None,
            component: component.map(String::from),
            step: None,
            metric: Some(metric.to_string()),
            value: None,
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
        assert!(d.matching_rules.is_empty());
    }

    #[test]
    fn test_best_priority_wins_when_multiple_rules_match() {
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
        // Priority 1 beats 2: both can match, hallucination wins
        assert_eq!(d.outcome, DecisionOutcome::Block);
        assert_eq!(d.matched_rule.as_deref(), Some("hallucination"));
        assert_eq!(d.matching_rules, vec!["hallucination", "retrieval"]);
    }

    #[test]
    fn test_presence_only_signal_matches_presence_rule() {
        let policy = parse_policy_str(
            r#"
rules:
  - priority: 1
    name: require_human_review
    when:
      metric: human_reviewed
      operator: presence
    then:
      action: require_approval
      reason: "Human must review"
  - priority: 2
    name: block_low_score
    when:
      metric: quality_score
      operator: "<"
      threshold: 0.5
    then:
      action: block
"#,
        )
        .unwrap();
        // Mix: one presence-only (no value), one numeric.
        let signals = SignalSet::new(vec![
            sig_presence_only("human_reviewed", None),
            sig(None, "quality_score", 0.8),
        ]);
        let graph = SignalGraph::build(&signals.signals);
        let d = evaluate(&policy, &graph);
        // Priority 1 matches: human_reviewed is present (even without a score).
        assert_eq!(d.outcome, DecisionOutcome::RequireApproval);
        assert_eq!(d.matched_rule.as_deref(), Some("require_human_review"));
        assert_eq!(d.matching_rules, vec!["require_human_review"]);
    }

    #[test]
    fn test_all_matches_recorded_best_priority_wins() {
        let policy = parse_policy_str(
            r#"
rules:
  - priority: 5
    name: would_block
    when:
      metric: x
      operator: ">"
      threshold: 0
    then:
      action: block
  - priority: 2
    name: wins_pass
    when:
      metric: x
      operator: ">"
      threshold: 0
    then:
      action: pass
"#,
        )
        .unwrap();
        let signals = SignalSet::new(vec![sig(None, "x", 1.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let (d, trace) = evaluate_with_trace(&policy, &graph);
        assert_eq!(d.outcome, DecisionOutcome::Pass);
        assert_eq!(d.matched_rule.as_deref(), Some("wins_pass"));
        assert_eq!(d.matching_rules, vec!["wins_pass", "would_block"]);
        let matched_names: Vec<_> = trace.iter().filter(|t| t.matched).map(|t| t.rule_name.as_str()).collect();
        assert_eq!(matched_names, vec!["wins_pass", "would_block"]);
    }
}
