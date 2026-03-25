//! Elegant, step-by-step CLI output for `geval demo`.
//! Output appears progressively (loading phases, then content streamed line-by-line).
//! Set GEVAL_DEMO_FAST=1 to skip delays (e.g. in CI or when piping).
//! On Windows we use ASCII-only glyphs and no ANSI colors so the console displays correctly.

use crate::evaluator::{Decision, DecisionOutcome, RuleTrace};
use crate::policy::{Action, Operator};
use crate::signal_graph::SignalGraph;
use crate::signals::Signal;
use std::io::{IsTerminal, Write};
use std::time::Duration;

/// Glyphs for box drawing, arrows, bullets. On Windows we use ASCII-only so the console doesn't mangle Unicode.
struct DemoGlyphs {
    box_tl: &'static str,
    box_tr: &'static str,
    box_bl: &'static str,
    box_br: &'static str,
    box_h: &'static str,
    box_v: &'static str,
    step: &'static str,
    bullet: &'static str,
    matched: &'static str,
    no_match: &'static str,
    no_match_extra: &'static str,
    arrow_then: &'static str,
    arrow_act: &'static str,
    mid_dot: &'static str,
    dash: &'static str,
    not_evaluated: &'static str,
}

fn demo_glyphs() -> DemoGlyphs {
    if cfg!(target_os = "windows") {
        DemoGlyphs {
            box_tl: "+",
            box_tr: "+",
            box_bl: "+",
            box_br: "+",
            box_h: "-",
            box_v: "|",
            step: ">",
            bullet: "-",
            matched: "[MATCH]",
            no_match: "(no match)",
            no_match_extra: "(no match (missing value or threshold))",
            arrow_then: "=>",
            arrow_act: "->",
            mid_dot: " ",
            dash: "-",
            not_evaluated: "(not evaluated - decision already made)",
        }
    } else {
        DemoGlyphs {
            box_tl: "\u{256d}",
            box_tr: "\u{256e}",
            box_bl: "\u{2570}",
            box_br: "\u{256f}",
            box_h: "\u{2500}",
            box_v: "\u{2502}",
            step: "\u{25b6}",
            bullet: "\u{00b7}",
            matched: "\u{2713} MATCHED",
            no_match: "\u{25cb} No match",
            no_match_extra: "\u{25cb} No match (missing value or threshold)",
            arrow_then: "\u{21d2}",
            arrow_act: "\u{2192}",
            mid_dot: "\u{00b7}",
            dash: "\u{2014}",
            not_evaluated: "(not evaluated \u{2014} decision already made)",
        }
    }
}

/// Delay in ms; no-op if GEVAL_DEMO_FAST=1 or not a TTY (piped/CI).
fn delay_ms(ms: u64) {
    if std::env::var("GEVAL_DEMO_FAST").is_ok() {
        return;
    }
    if !std::io::stdout().is_terminal() {
        return;
    }
    std::thread::sleep(Duration::from_millis(ms));
}

/// Print line, flush, then optional delay (for progressive "streaming" feel).
fn line<W: Write>(out: &mut W, ms_after: u64, s: &str) {
    let _ = writeln!(out, "{}", s);
    let _ = out.flush();
    delay_ms(ms_after);
}

/// Print "Loading..." then replace with final line after delay (cooking feel).
/// When not a TTY (e.g. piping), just print the done line so output stays clean.
fn loading_then<W: Write>(out: &mut W, loading: &str, done_line: &str, ms: u64) {
    if !std::io::stdout().is_terminal() {
        let _ = writeln!(out, "{}", done_line);
        let _ = out.flush();
        return;
    }
    let _ = write!(out, "{}", loading);
    let _ = out.flush();
    delay_ms(ms);
    let _ = write!(out, "\r{:52}\r{}\n", "", done_line);
    let _ = out.flush();
}

const BOLD: &str = "\x1b[1m";
const DIM: &str = "\x1b[2m";
const RESET: &str = "\x1b[0m";
const GREEN: &str = "\x1b[32m";
const YELLOW: &str = "\x1b[33m";
const RED: &str = "\x1b[31m";
const CYAN: &str = "\x1b[36m";
const MAGENTA: &str = "\x1b[35m";

fn dim(s: &str) -> String {
    format!("{}{}{}", DIM, s, RESET)
}

fn bold(s: &str) -> String {
    format!("{}{}{}", BOLD, s, RESET)
}

fn color_outcome(outcome: DecisionOutcome) -> &'static str {
    match outcome {
        DecisionOutcome::Pass => GREEN,
        DecisionOutcome::RequireApproval => YELLOW,
        DecisionOutcome::Block => RED,
    }
}

fn outcome_str(o: DecisionOutcome) -> &'static str {
    match o {
        DecisionOutcome::Pass => "PASS",
        DecisionOutcome::RequireApproval => "REQUIRE_APPROVAL",
        DecisionOutcome::Block => "BLOCK",
    }
}

fn action_str(a: Action) -> &'static str {
    match a {
        Action::Pass => "PASS",
        Action::Block => "BLOCK",
        Action::RequireApproval => "REQUIRE_APPROVAL",
    }
}

fn signal_label(s: &Signal) -> String {
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

fn signal_value_str(s: &Signal, missing: &str) -> String {
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
        None => missing.to_string(),
    }
}

fn op_symbol(t: &RuleTrace) -> &'static str {
    match t.operator {
        Operator::GreaterThan => ">",
        Operator::LessThan => "<",
        Operator::GreaterOrEqual => ">=",
        Operator::LessOrEqual => "<=",
        Operator::Equal => "==",
        Operator::Presence => "present?",
    }
}

const DELAY_LOAD: u64 = 380;
const DELAY_LINE: u64 = 68;
const DELAY_BLOCK: u64 = 130;
const DELAY_SECTION: u64 = 280;

/// Print the full demo report: policy, signals, rule-by-rule evaluation, and decision.
/// Output appears progressively (loading phases, then content streamed line-by-line).
/// On Windows uses ASCII glyphs and no colors so the console displays correctly.
pub fn print_demo_report(
    policy: &crate::policy::Policy,
    graph: &SignalGraph,
    decision: &Decision,
    trace: &[RuleTrace],
    environment: Option<&str>,
) {
    let g = demo_glyphs();
    // Disable ANSI colors on Windows; many consoles don't support them and show raw codes
    let use_color = std::io::stdout().is_terminal() && !cfg!(target_os = "windows");
    let mut out = std::io::stdout().lock();

    let d = |s: &str| if use_color { dim(s) } else { s.to_string() };
    let b = |s: &str| if use_color { bold(s) } else { s.to_string() };
    let green_s = |s: &str| if use_color { format!("{}{}{}", GREEN, s, RESET) } else { s.to_string() };
    let cyan_s = |s: &str| if use_color { format!("{}{}{}", CYAN, s, RESET) } else { s.to_string() };
    let magenta_s = |s: &str| if use_color { format!("{}{}{}", MAGENTA, s, RESET) } else { s.to_string() };
    let yellow_s = |s: &str| if use_color { format!("{}{}{}", YELLOW, s, RESET) } else { s.to_string() };
    let outcome_colored = |o: DecisionOutcome| {
        if use_color {
            format!("{}{}{}", color_outcome(o), outcome_str(o), RESET)
        } else {
            outcome_str(o).to_string()
        }
    };

    let box_top_wide = format!("{}{}{}", g.box_tl, g.box_h.repeat(61), g.box_tr);
    let box_bot_wide = format!("{}{}{}", g.box_bl, g.box_h.repeat(61), g.box_br);
    let box_top_narrow = format!("{}{}{}", g.box_tl, g.box_h.repeat(21), g.box_tr);
    let box_bot_narrow = format!("{}{}{}", g.box_bl, g.box_h.repeat(21), g.box_br);

    let _ = writeln!(out);
    let _ = out.flush();
    line(&mut out, 0, &format!("  {}  {}", cyan_s(&box_top_wide), ""));
    line(&mut out, DELAY_LINE, &format!("  {}  {}", cyan_s(g.box_v), b(&format!("  GEVAL  {}  Demo", g.mid_dot))));
    line(&mut out, DELAY_LINE, &format!("  {}  {}", cyan_s(g.box_v), d("  One clear decision for every AI change")));
    line(&mut out, DELAY_LINE, &format!("  {}  {}", cyan_s(&box_bot_wide), ""));
    line(&mut out, DELAY_SECTION, "");

    // Step 1: Contract (demo uses 1 policy)
    let loading1 = format!("  {}  {}", green_s(g.step), d("Loading contract..."));
    let done1 = format!("  {}  {}", green_s(g.step), b("Step 1: Contract loaded (1 policy)"));
    loading_then(&mut out, &loading1, &done1, DELAY_LOAD);
    line(&mut out, DELAY_LINE, &format!("  {}    {}", d(g.box_v), d("Environment:")));
    line(&mut out, DELAY_LINE, &format!("  {}    {}  {}", d(g.box_v), d("  "), environment.unwrap_or("(not set)")));
    line(&mut out, DELAY_LINE, &format!("  {}    {}", d(g.box_v), d("Rules (priority 1 = highest; each priority unique):")));
    for (i, rule) in policy.sorted_rules().iter().enumerate() {
        line(&mut out, DELAY_LINE, &format!("  {}    {}  {}. {}  {}  {}", d(g.box_v), d("  "), i + 1, magenta_s(&rule.name), d(g.arrow_act), d(action_str(rule.then.action))));
    }
    line(&mut out, DELAY_LINE, &format!("  {}    {}  {}", d(g.box_v), d("  "), d(&format!("{} rule(s) total", policy.rules.len()))));
    line(&mut out, DELAY_SECTION, "");

    // Step 2: Signals
    let loading2 = format!("  {}  {}", green_s(g.step), d("Loading signals..."));
    let done2 = format!("  {}  {}", green_s(g.step), b("Step 2: Signals loaded"));
    loading_then(&mut out, &loading2, &done2, DELAY_LOAD);
    for s in &graph.signals {
        line(&mut out, DELAY_LINE, &format!("  {}    {}  {}  {}  {}", d(g.box_v), cyan_s(g.bullet), signal_label(s), d("="), signal_value_str(s, g.dash)));
    }
    line(&mut out, DELAY_LINE, &format!("  {}    {}  {}", d(g.box_v), d("  "), d(&format!("{} signal(s)", graph.signals.len()))));
    line(&mut out, DELAY_SECTION, "");

    // Step 3: Rules
    let loading3 = format!("  {}  {}", green_s(g.step), d("Evaluating rules..."));
    let done3 = format!("  {}  {}", green_s(g.step), b("Step 3: All rules checked; best priority wins"));
    loading_then(&mut out, &loading3, &done3, DELAY_LOAD);
    let traced_names: std::collections::HashSet<_> = trace.iter().map(|t| t.rule_name.as_str()).collect();
    let sorted = policy.sorted_rules();
    let mut step = 0;
    for t in trace.iter() {
        step += 1;
        line(&mut out, DELAY_BLOCK, &format!("  {}  {}", d(g.box_v), d("")));
        line(&mut out, DELAY_LINE, &format!("  {}  {}  {}  {}  {}", d(g.box_v), yellow_s(&format!("[{}]", step)), magenta_s(&t.rule_name), d("(priority"), format!("{})", t.priority)));
        line(&mut out, DELAY_LINE, &format!("  {}      {}  {}", d(g.box_v), d("Condition:"), t.condition));
        match (t.signal_value, t.threshold) {
            (Some(v), Some(th)) => {
                line(&mut out, DELAY_LINE, &format!("  {}      {}  {}  {}  {}", d(g.box_v), d("Signal value:"), v, d("  |  Threshold:"), th));
                let op = op_symbol(t);
                if t.matched {
                    line(&mut out, DELAY_LINE, &format!("  {}      {}  {}  {}  {}  {}  {}", d(g.box_v), d(""), format!("{} {} {}", v, op, th), green_s(g.arrow_then), green_s(g.matched), green_s(&format!("  {}  ", g.arrow_act)), green_s(action_str(t.action))));
                } else {
                    line(&mut out, DELAY_LINE, &format!("  {}      {}  {}  {}", d(g.box_v), d(""), format!("{} {} {}  {}  false", v, op, th, g.arrow_act), d(g.no_match)));
                }
            }
            (Some(v), None) if matches!(t.operator, Operator::Presence) => {
                line(&mut out, DELAY_LINE, &format!("  {}      {}  {}", d(g.box_v), d("Present:"), v));
                line(&mut out, DELAY_LINE, &format!("  {}      {}", d(g.box_v), if t.matched { green_s(g.matched) } else { d(g.no_match) }));
            }
            _ => {
                line(&mut out, DELAY_LINE, &format!("  {}      {}", d(g.box_v), if t.matched { green_s(g.matched) } else { d(g.no_match_extra) }));
            }
        }
    }
    for rule in sorted.iter() {
        if !traced_names.contains(rule.name.as_str()) {
            step += 1;
            line(&mut out, DELAY_BLOCK, &format!("  {}  {}", d(g.box_v), d("")));
            line(&mut out, DELAY_LINE, &format!("  {}  {}  {}  {}", d(g.box_v), yellow_s(&format!("[{}]", step)), magenta_s(&rule.name), d(g.not_evaluated)));
        }
    }
    line(&mut out, DELAY_SECTION, "");

    // Step 4: Decision
    let loading4 = format!("  {}  {}", green_s(g.step), d("Computing decision..."));
    let done4 = format!("  {}  {}", green_s(g.step), b("Step 4: Decision"));
    loading_then(&mut out, &loading4, &done4, DELAY_LOAD);
    line(&mut out, DELAY_LINE, &format!("  {}  {}", d(g.box_v), d("")));
    let oc = outcome_colored(decision.outcome);
    line(&mut out, DELAY_LINE, &format!("  {}    {}", d(g.box_v), cyan_s(&box_top_narrow)));
    line(&mut out, DELAY_LINE, &format!("  {}    {}  {}  {}", d(g.box_v), cyan_s(g.box_v), format!("  {}  ", oc), cyan_s(g.box_v)));
    line(&mut out, DELAY_LINE, &format!("  {}    {}", d(g.box_v), cyan_s(&box_bot_narrow)));
    if let Some(ref reason) = decision.reason {
        line(&mut out, DELAY_LINE, &format!("  {}    {}", d(g.box_v), d("")));
        line(&mut out, DELAY_LINE, &format!("  {}    {}  {}", d(g.box_v), d("Reason:"), reason));
    }
    if !decision.matching_rules.is_empty() {
        line(
            &mut out,
            DELAY_LINE,
            &format!(
                "  {}    {}  {}",
                d(g.box_v),
                d("Rules that matched:"),
                decision.matching_rules.join(", ")
            ),
        );
    }
    if let Some(ref name) = decision.matched_rule {
        line(
            &mut out,
            DELAY_LINE,
            &format!("  {}    {}  {}", d(g.box_v), d("Winning rule (best priority):"), name),
        );
    }
    line(&mut out, 0, "");
    let _ = out.flush();
}
