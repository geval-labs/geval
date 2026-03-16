//! CLI commands: check, approve, reject, explain, validate-policy.

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;

use crate::approval::write_approval;
use crate::artifact::write_decision_artifact;
use crate::evaluator::{evaluate, DecisionOutcome};
use crate::explanation::explain_decision;
use crate::hashing::{hash_policy, hash_signals};
use crate::policy::parse_policy;
use crate::signal_graph::SignalGraph;
use crate::signals::load_signals;

/// Geval - decision orchestration engine for AI systems.
#[derive(Parser)]
#[command(name = "geval")]
#[command(about = "Deterministic decision engine for AI system changes", long_about = None)]
pub struct Commands {
    #[command(subcommand)]
    pub sub: Sub,
}

#[derive(Subcommand)]
pub enum Sub {
    /// Evaluate signals against policy; exit 0=PASS, 1=REQUIRE_APPROVAL, 2=BLOCK.
    Check(CheckOpts),
    /// Record human approval (for REQUIRE_APPROVAL flow).
    Approve(ApproveOpts),
    /// Record human rejection.
    Reject(RejectOpts),
    /// Print human-readable decision report.
    Explain(ExplainOpts),
    /// Validate policy file syntax.
    ValidatePolicy(ValidatePolicyOpts),
}

#[derive(clap::Args)]
pub struct CheckOpts {
    #[arg(long, short = 's')]
    pub signals: PathBuf,
    #[arg(long, short = 'p')]
    pub policy: PathBuf,
    #[arg(long, short = 'e', env = "GEVAL_ENV")]
    pub env: Option<String>,
    #[arg(long)]
    pub json: bool,
}

#[derive(clap::Args)]
pub struct ApproveOpts {
    #[arg(long, short = 'r')]
    pub reason: String,
    #[arg(long, short = 'o', default_value = ".geval/approval.json")]
    pub output: PathBuf,
    #[arg(long, env = "USER")]
    pub by: Option<String>,
}

#[derive(clap::Args)]
pub struct RejectOpts {
    #[arg(long, short = 'r')]
    pub reason: String,
    #[arg(long, short = 'o', default_value = ".geval/rejection.json")]
    pub output: PathBuf,
    #[arg(long, env = "USER")]
    pub by: Option<String>,
}

#[derive(clap::Args)]
pub struct ExplainOpts {
    #[arg(long, short = 's')]
    pub signals: PathBuf,
    #[arg(long, short = 'p')]
    pub policy: PathBuf,
    #[arg(long, short = 'e', env = "GEVAL_ENV")]
    pub env: Option<String>,
}

#[derive(clap::Args)]
pub struct ValidatePolicyOpts {
    pub policy: PathBuf,
    #[arg(long)]
    pub json: bool,
}

impl Commands {
    pub fn run(self) -> Result<()> {
        match self.sub {
            Sub::Check(opts) => run_check(&opts),
            Sub::Approve(opts) => run_approve(&opts),
            Sub::Reject(opts) => run_reject(&opts),
            Sub::Explain(opts) => run_explain(&opts),
            Sub::ValidatePolicy(opts) => run_validate_policy(&opts),
        }
    }
}

fn run_check(opts: &CheckOpts) -> Result<()> {
    let policy = parse_policy(&opts.policy).context("load policy")?;
    let signals = load_signals(&opts.signals).context("load signals")?;
    let graph = SignalGraph::build(&signals.signals);
    let decision = evaluate(&policy, &graph);

    let policy_hash = hash_policy(&policy);
    let signals_hash = hash_signals(&signals);
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let _ = write_decision_artifact(
        &cwd,
        &policy_hash,
        &signals_hash,
        &decision,
        None,
    );

    if opts.json {
        let out = serde_json::json!({
            "decision": outcome_str(decision.outcome),
            "matched_rule": decision.matched_rule,
            "reason": decision.reason,
        });
        println!("{}", serde_json::to_string_pretty(&out)?);
    } else {
        let env = opts.env.as_deref().or(policy.environment.as_deref());
        println!("{}", explain_decision(&policy, &graph, &decision, env));
    }

    let code = match decision.outcome {
        DecisionOutcome::Pass => 0,
        DecisionOutcome::RequireApproval => 1,
        DecisionOutcome::Block => 2,
    };
    std::process::exit(code);
}

fn run_approve(opts: &ApproveOpts) -> Result<()> {
    let by = opts
        .by
        .clone()
        .or_else(|| std::env::var("USER").ok())
        .unwrap_or_else(|| "user".to_string());
    write_approval(&opts.output, by, opts.reason.clone(), true)?;
    println!("Approval recorded to {}", opts.output.display());
    Ok(())
}

fn run_reject(opts: &RejectOpts) -> Result<()> {
    let by = opts
        .by
        .clone()
        .or_else(|| std::env::var("USER").ok())
        .unwrap_or_else(|| "user".to_string());
    write_approval(&opts.output, by, opts.reason.clone(), false)?;
    println!("Rejection recorded to {}", opts.output.display());
    Ok(())
}

fn run_explain(opts: &ExplainOpts) -> Result<()> {
    let policy = parse_policy(&opts.policy).context("load policy")?;
    let signals = load_signals(&opts.signals).context("load signals")?;
    let graph = SignalGraph::build(&signals.signals);
    let decision = evaluate(&policy, &graph);
    let env = opts.env.as_deref().or(policy.environment.as_deref());
    println!("{}", explain_decision(&policy, &graph, &decision, env));
    Ok(())
}

fn run_validate_policy(opts: &ValidatePolicyOpts) -> Result<()> {
    let policy = parse_policy(&opts.policy).context("validate policy")?;
    if opts.json {
        println!("{}", serde_json::to_string_pretty(&policy)?);
    } else {
        println!("Policy valid: {} rule(s)", policy.rules.len());
        if let Some(env) = &policy.environment {
            println!("Environment: {}", env);
        }
    }
    Ok(())
}

fn outcome_str(o: DecisionOutcome) -> &'static str {
    match o {
        DecisionOutcome::Pass => "PASS",
        DecisionOutcome::RequireApproval => "REQUIRE_APPROVAL",
        DecisionOutcome::Block => "BLOCK",
    }
}
