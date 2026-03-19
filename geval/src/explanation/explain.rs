//! Human-readable explanation of the decision (GEVAL DECISION REPORT).

use crate::contract::{ContractResult, MultiContractRun};
use crate::evaluator::{Decision, DecisionOutcome};
use crate::policy::Policy;
use crate::signal_graph::SignalGraph;
use std::fmt::Write;

/// Produce a contract-level report: contract name/version, signals, per-policy results, combined decision.
pub fn explain_contract_result(
    result: &ContractResult,
    graph: &SignalGraph,
    _environment: Option<&str>,
) -> String {
    let mut out = String::new();
    out.push_str("GEVAL DECISION REPORT (CONTRACT)\n");
    out.push_str("--------------------------------\n");
    let _ = writeln!(out, "Contract: {} @ {}", result.contract_name, result.contract_version);
    let _ = writeln!(out, "Combine rule: {}", result.combine_rule);
    out.push_str("\nSignals:\n");
    for s in &graph.signals {
        let label = signal_label(s);
        let value_str = value_str(s);
        let _ = writeln!(out, "  {} = {}", label, value_str);
    }
    out.push_str("\nPer-policy results:\n");
    for r in &result.policy_results {
        let match_info = r
            .matched_rule
            .as_ref()
            .map(|m| format!(" (matched: {})", m))
            .unwrap_or_default();
        let _ = writeln!(
            out,
            "  {}: {}{}",
            r.policy_path,
            outcome_str(r.outcome),
            match_info
        );
    }
    out.push_str("\nCombined decision:\n");
    let _ = writeln!(out, "{}", outcome_str(result.combined_decision.outcome));
    if let Some(ref rule) = result.combined_decision.matched_rule {
        let _ = writeln!(out, "First non-PASS: {}", rule);
    }
    if let Some(ref reason) = result.combined_decision.reason {
        out.push_str("\nReason:\n");
        let _ = writeln!(out, "{}", reason);
    }
    out.push_str("--------------------------------\n");
    out
}

/// Multi-contract report: signals once, then each contract, then overall PR-level decision.
pub fn explain_multi_contract_result(
    run: &MultiContractRun,
    graph: &SignalGraph,
    _environment: Option<&str>,
) -> String {
    let mut out = String::new();
    out.push_str("GEVAL DECISION REPORT (MULTI-CONTRACT)\n");
    out.push_str("========================================\n");
    let _ = writeln!(
        out,
        "Combine contracts rule: {}",
        run.contracts_combine
    );
    out.push_str("\nSignals:\n");
    for s in &graph.signals {
        let label = signal_label(s);
        let value_str = value_str(s);
        let _ = writeln!(out, "  {} = {}", label, value_str);
    }
    for entry in &run.entries {
        out.push_str("\n---\n");
        let _ = writeln!(
            out,
            "Contract file: {}",
            entry.contract_path.display()
        );
        let result = &entry.result;
        let _ = writeln!(out, "Contract: {} @ {}", result.contract_name, result.contract_version);
        let _ = writeln!(out, "Combine rule (policies): {}", result.combine_rule);
        out.push_str("Per-policy results:\n");
        for r in &result.policy_results {
            let match_info = r
                .matched_rule
                .as_ref()
                .map(|m| format!(" (matched: {})", m))
                .unwrap_or_default();
            let _ = writeln!(
                out,
                "  {}: {}{}",
                r.policy_path,
                outcome_str(r.outcome),
                match_info
            );
        }
        out.push_str("Combined decision (this contract):\n");
        let _ = writeln!(out, "{}", outcome_str(result.combined_decision.outcome));
        if let Some(ref rule) = result.combined_decision.matched_rule {
            let _ = writeln!(out, "First non-PASS: {}", rule);
        }
        if let Some(ref reason) = result.combined_decision.reason {
            out.push_str("Reason:\n");
            let _ = writeln!(out, "{}", reason);
        }
    }
    out.push_str("\n======== OVERALL (PR) ========\n");
    let _ = writeln!(out, "{}", outcome_str(run.overall.outcome));
    if let Some(ref rule) = run.overall.matched_rule {
        let _ = writeln!(out, "{}", rule);
    }
    if let Some(ref reason) = run.overall.reason {
        out.push_str("Reason:\n");
        let _ = writeln!(out, "{}", reason);
    }
    out.push_str("========================================\n");
    out
}

/// Produce a text report suitable for CLI output (single policy).
pub fn explain_decision(
    _policy: &Policy,
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

#[cfg(test)]
mod tests {
    use super::explain_multi_contract_result;
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

    #[test]
    fn explain_multi_contract_contains_sections() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("p.yaml");
        std::fs::write(
            &p,
            r#"rules: [{ priority: 1, name: ok, when: { metric: x, operator: ">=", threshold: 0 }, then: { action: pass } }]"#,
        )
        .unwrap();
        let c1 = dir.path().join("c1.yaml");
        let c2 = dir.path().join("c2.yaml");
        for (name, path) in [("one", &c1), ("two", &c2)] {
            std::fs::write(
                path,
                format!(
                    r#"name: {}
version: "1.0.0"
combine: all_pass
policies:
  - path: p.yaml
"#,
                    name
                ),
            )
            .unwrap();
        }
        let signals = SignalSet::new(vec![sig("x", 1.0)]);
        let graph = SignalGraph::build(&signals.signals);
        let run = load_run_contracts(&[c1, c2], &graph, CombineRule::AllPass).unwrap();
        let text = explain_multi_contract_result(&run, &graph, None);
        assert!(text.contains("MULTI-CONTRACT"));
        assert!(text.contains("Combine contracts rule"));
        assert!(text.contains("OVERALL (PR)"));
        assert!(text.contains("PASS"));
        assert!(text.contains("Contract file:"));
    }
}
