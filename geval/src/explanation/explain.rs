//! Human-readable explanation of the decision (GEVAL DECISION REPORT).

use crate::evaluator::{Decision, DecisionOutcome};
use crate::policy::Policy;
use crate::signal_graph::SignalGraph;
use std::fmt::Write;

/// Produce a text report suitable for CLI output.
pub fn explain_decision(
    policy: &Policy,
    graph: &SignalGraph,
    decision: &Decision,
    environment: Option<&str>,
) -> String {
    let mut out = String::new();
    out.push_str("GEVAL DECISION REPORT\n");
    out.push_str("--------------------------------\n");
    if let Some(env) = environment {
        let _ = writeln!(out, "Environment: {}", env);
    }
    out.push_str("\nSignals:\n");

    for s in &graph.signals {
        let label = signal_label(s);
        let value_str = value_str(s);
        // We don't know here which rules passed/failed; we show all signals. Optional: ✓/✗ per signal vs matched rule.
        let _ = writeln!(out, "  {} = {}", label, value_str);
    }

    out.push_str("\nMatched Rule:\n");
    if let Some(ref name) = decision.matched_rule {
        let _ = writeln!(out, "{}", name);
    } else {
        out.push_str("(none — default PASS)\n");
    }

    out.push_str("\nDecision:\n");
    let _ = writeln!(out, "{}", outcome_str(decision.outcome));

    if let Some(ref reason) = decision.reason {
        out.push_str("\nReason:\n");
        let _ = writeln!(out, "{}", reason);
    }

    out.push_str("--------------------------------\n");
    out
}

fn signal_label(s: &crate::signals::Signal) -> String {
    let parts: Vec<&str> = [s.component.as_deref(), s.metric.as_deref()]
        .into_iter()
        .flatten()
        .collect();
    if parts.is_empty() {
        s.metric.as_deref().unwrap_or("?").to_string()
    } else {
        parts.join(".")
    }
}

fn value_str(s: &crate::signals::Signal) -> String {
    match &s.value {
        Some(v) => {
            if let Some(n) = v.as_f64() {
                format!("{}", n)
            } else if let Some(st) = v.as_str() {
                st.to_string()
            } else {
                v.to_string()
            }
        }
        None => "—".to_string(),
    }
}

fn outcome_str(o: DecisionOutcome) -> &'static str {
    match o {
        DecisionOutcome::Pass => "PASS",
        DecisionOutcome::RequireApproval => "REQUIRE_APPROVAL",
        DecisionOutcome::Block => "BLOCK",
    }
}
