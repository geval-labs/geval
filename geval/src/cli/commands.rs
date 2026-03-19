//! CLI commands: check (contract), init, demo, approve, reject, explain, validate-contract.

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;

use crate::approval::write_approval;
use crate::artifact::write_multi_contract_artifact;
use crate::cli::{demo_ui::print_demo_report, init::run_init as do_init};
use crate::contract::{
    load_contract_and_policies, load_run_contracts, run_contract, CombineRule, ContractDef,
    PolicyRef,
};
use crate::evaluator::{evaluate_with_trace, DecisionOutcome};
use crate::explanation::explain_multi_contract_result;
use crate::hashing::{hash_contract_bundle, hash_signals};
use crate::policy::parse_policy_str;
use crate::signal_graph::SignalGraph;
use crate::signals::load_signals_from_reader;

/// Geval - decision orchestration engine for AI systems.
/// Contract = multiple policies evaluated together with a combination rule.
#[derive(Parser)]
#[command(name = "geval")]
#[command(version)]
#[command(about = "Decision orchestration and reconciliation for AI system changes", long_about = None)]
pub struct Commands {
    #[command(subcommand)]
    pub sub: Sub,
}

#[derive(Subcommand)]
pub enum Sub {
    /// Evaluate signals against one or more contracts; exit 0=PASS, 1=REQUIRE_APPROVAL, 2=BLOCK.
    Check(CheckOpts),
    /// Create a template folder with contract and policies. Edit and run.
    Init(InitOpts),
    /// Run a built-in example (no files needed).
    Demo(DemoOpts),
    /// Record human approval (for REQUIRE_APPROVAL flow).
    Approve(ApproveOpts),
    /// Record human rejection.
    Reject(RejectOpts),
    /// Print human-readable decision report (multi-contract + overall).
    Explain(ExplainOpts),
    /// Validate one or more contract files and all referenced policies.
    ValidateContract(ValidateContractOpts),
}

const DEMO_SIGNALS_JSON: &str = r#"{
  "name": "demo-signals",
  "version": "1.0.0",
  "signals": [
    {
      "system": "support_agent",
      "component": "retrieval",
      "metric": "context_relevance",
      "value": 0.84
    },
    {
      "system": "support_agent",
      "component": "generator",
      "metric": "hallucination_rate",
      "value": 0.06
    },
    {
      "type": "ab_test",
      "metric": "engagement_drop",
      "value": 0.03
    }
  ]
}"#;

const DEMO_POLICY_YAML: &str = r#"name: demo-policy
version: "1.0.0"
policy:
  environment: prod
  rules:
    - priority: 1
      name: business_block
      when:
        metric: engagement_drop
        operator: ">"
        threshold: 0
      then:
        action: block
        reason: "Business engagement dropped"

    - priority: 2
      name: hallucination_guard
      when:
        component: generator
        metric: hallucination_rate
        operator: ">"
        threshold: 0.05
      then:
        action: block

    - priority: 3
      name: retrieval_quality
      when:
        component: retrieval
        metric: context_relevance
        operator: "<"
        threshold: 0.85
      then:
        action: require_approval
"#;

fn parse_combine_rule(s: &str) -> Result<CombineRule, String> {
    s.parse()
}

#[derive(clap::Args)]
pub struct CheckOpts {
    #[arg(long, short = 's')]
    pub signals: PathBuf,
    /// Contract YAML file(s); repeat for multiple contracts on one PR.
    #[arg(long, short = 'c', action = clap::ArgAction::Append, required = true)]
    pub contract: Vec<PathBuf>,
    /// How to merge each contract’s combined outcome (default: all must pass).
    #[arg(
        long = "combine-contracts",
        default_value = "all_pass",
        value_parser = parse_combine_rule
    )]
    pub combine_contracts: CombineRule,
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
    #[arg(long, short = 'c', action = clap::ArgAction::Append, required = true)]
    pub contract: Vec<PathBuf>,
    #[arg(
        long = "combine-contracts",
        default_value = "all_pass",
        value_parser = parse_combine_rule
    )]
    pub combine_contracts: CombineRule,
    #[arg(long, short = 'e', env = "GEVAL_ENV")]
    pub env: Option<String>,
}

#[derive(clap::Args)]
pub struct ValidateContractOpts {
    /// One or more contract YAML files to validate.
    #[arg(required = true)]
    pub contract: Vec<PathBuf>,
    #[arg(long)]
    pub json: bool,
}

#[derive(clap::Args)]
pub struct InitOpts {
    #[arg(default_value = ".geval")]
    pub directory: PathBuf,
    #[arg(long)]
    pub force: bool,
}

#[derive(clap::Args)]
pub struct DemoOpts {
    #[arg(long)]
    pub json: bool,
}

impl Commands {
    pub fn run(self) -> Result<()> {
        match self.sub {
            Sub::Check(opts) => run_check(&opts),
            Sub::Init(opts) => run_init(&opts),
            Sub::Demo(opts) => run_demo(&opts),
            Sub::Approve(opts) => run_approve(&opts),
            Sub::Reject(opts) => run_reject(&opts),
            Sub::Explain(opts) => run_explain(&opts),
            Sub::ValidateContract(opts) => run_validate_contract(&opts),
        }
    }
}

fn run_init(opts: &InitOpts) -> Result<()> {
    do_init(&opts.directory, opts.force).context("init")?;
    println!(
        "Created {} with contract.yaml, policies/, signals.json, and README.md.",
        opts.directory.display()
    );
    println!(
        "Edit the files, then run: geval check --contract {}/contract.yaml --signals {}/signals.json",
        opts.directory.display(),
        opts.directory.display()
    );
    println!(
        "Multiple contracts: geval check -c path/a.yaml -c path/b.yaml --signals {}/signals.json",
        opts.directory.display()
    );
    Ok(())
}

fn run_demo(opts: &DemoOpts) -> Result<()> {
    let policy = parse_policy_str(DEMO_POLICY_YAML).context("parse built-in policy")?;
    let signals =
        load_signals_from_reader(DEMO_SIGNALS_JSON.as_bytes()).context("parse built-in signals")?;
    let graph = SignalGraph::build(&signals.signals);
    let contract = ContractDef {
        name: "demo".to_string(),
        version: "1.0.0".to_string(),
        combine: CombineRule::AllPass,
        policies: vec![PolicyRef {
            path: "demo.yaml".to_string(),
        }],
    };
    let result = run_contract(&contract, &[policy.clone()], &graph).context("run demo contract")?;
    let (_, trace) = evaluate_with_trace(&policy, &graph);

    if opts.json {
        let out = serde_json::json!({
            "contract": result.contract_name,
            "combined_decision": outcome_str(result.combined_decision.outcome),
            "policy_results": result.policy_results.iter().map(|r| serde_json::json!({
                "policy_path": r.policy_path,
                "outcome": outcome_str(r.outcome),
                "matched_rule": r.matched_rule,
            })).collect::<Vec<_>>(),
        });
        println!("{}", serde_json::to_string_pretty(&out)?);
    } else {
        print_demo_report(&policy, &graph, &result.combined_decision, &trace, Some("prod"));
    }

    let code = match result.combined_decision.outcome {
        DecisionOutcome::Pass => 0,
        DecisionOutcome::RequireApproval => 1,
        DecisionOutcome::Block => 2,
    };
    std::process::exit(code);
}

fn run_check(opts: &CheckOpts) -> Result<()> {
    let signals = crate::signals::load_signals(&opts.signals).context("load signals")?;
    let graph = SignalGraph::build(&signals.signals);

    let run = load_run_contracts(&opts.contract, &graph, opts.combine_contracts)
        .context("run contracts")?;

    let signals_hash = hash_signals(&signals);
    let bundle_pairs: Vec<(PathBuf, &str)> = run
        .entries
        .iter()
        .map(|e| (e.contract_path.clone(), e.contract_hash.as_str()))
        .collect();
    let bundle_hash = hash_contract_bundle(&bundle_pairs);

    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let _ = write_multi_contract_artifact(
        &cwd,
        &run,
        &signals_hash,
        signals.name.as_deref(),
        signals.version.as_deref(),
        None,
    )
    .context("write decision artifact")?;

    if opts.json {
        let out = serde_json::json!({
            "contracts_combine_rule": run.contracts_combine.to_string(),
            "bundle_hash": bundle_hash,
            "contracts": run.entries.iter().map(|e| serde_json::json!({
                "contract_path": e.contract_path,
                "contract_name": e.result.contract_name,
                "contract_version": e.result.contract_version,
                "contract_hash": e.contract_hash,
                "combine_rule": e.result.combine_rule.to_string(),
                "policy_results": e.result.policy_results.iter().map(|r| serde_json::json!({
                    "policy_path": r.policy_path,
                    "outcome": outcome_str(r.outcome),
                    "matched_rule": r.matched_rule,
                })).collect::<Vec<_>>(),
                "combined_decision": outcome_str(e.result.combined_decision.outcome),
            })).collect::<Vec<_>>(),
            "overall_combined_decision": outcome_str(run.overall.outcome),
            "overall_matched_rule": run.overall.matched_rule,
            "overall_reason": run.overall.reason,
        });
        println!("{}", serde_json::to_string_pretty(&out)?);
    } else {
        println!(
            "{}",
            explain_multi_contract_result(&run, &graph, opts.env.as_deref())
        );
    }

    let code = match run.overall.outcome {
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
    let signals = crate::signals::load_signals(&opts.signals).context("load signals")?;
    let graph = SignalGraph::build(&signals.signals);
    let run = load_run_contracts(&opts.contract, &graph, opts.combine_contracts)
        .context("run contracts")?;
    println!(
        "{}",
        explain_multi_contract_result(&run, &graph, opts.env.as_deref())
    );
    Ok(())
}

fn run_validate_contract(opts: &ValidateContractOpts) -> Result<()> {
    let mut summaries = Vec::new();
    for path in &opts.contract {
        let (contract, policies) =
            load_contract_and_policies(path).with_context(|| format!("{}", path.display()))?;
        summaries.push((path.clone(), contract, policies));
    }
    if opts.json {
        let out: Vec<serde_json::Value> = summaries
            .iter()
            .map(|(path, contract, policies)| {
                serde_json::json!({
                    "contract_path": path,
                    "name": contract.name,
                    "version": contract.version,
                    "combine": contract.combine.to_string(),
                    "policies": contract.policies.iter().map(|p| &p.path).collect::<Vec<_>>(),
                    "policy_count": policies.len(),
                })
            })
            .collect();
        println!("{}", serde_json::to_string_pretty(&out)?);
    } else {
        for (path, contract, policies) in &summaries {
            println!(
                "Contract valid: {} — {} (version {}), {} policy/policies, combine={}",
                path.display(),
                contract.name,
                contract.version,
                policies.len(),
                contract.combine
            );
            for (i, (pref, policy)) in contract.policies.iter().zip(policies.iter()).enumerate() {
                println!(
                    "  {}: {} ({} rule(s))",
                    i + 1,
                    pref.path,
                    policy.rules.len()
                );
            }
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
