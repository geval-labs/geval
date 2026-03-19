//! Geval - Decision orchestration engine for AI systems.
//!
//! Consumes signals (JSON), evaluates policy rules (YAML), and produces
//! deterministic decisions: PASS, REQUIRE_APPROVAL, or BLOCK.

/// Binary version at compile time (for decision artifacts and audit).
pub const GEVAL_VERSION: &str = env!("CARGO_PKG_VERSION");

pub mod approval;
pub mod artifact;
pub mod cli;
pub mod contract;
pub mod evaluator;
pub mod explanation;
pub mod hashing;
pub mod policy;
pub mod reconciliation;
pub mod signal_graph;
pub mod signals;

pub use approval::{ApprovalArtifact, ApprovalOutcome, read_approval, write_approval};
pub use artifact::{write_multi_contract_artifact, DECISION_ARTIFACT_VERSION};
pub use contract::{
    load_contract, load_contract_and_policies, load_run_contracts, run_contract, CombineRule,
    ContractDef, ContractResult, ContractRunEntry, MultiContractRun, PolicyRef, PolicyResult,
};
pub use evaluator::{evaluate, Decision, DecisionOutcome};
pub use explanation::explain_decision;
pub use hashing::{hash_contract_bundle, hash_contract_content, hash_policy, hash_signals};
pub use policy::{parse_policy, parse_policy_str, Policy, Rule};
pub use signal_graph::SignalGraph;
pub use signals::{load_signals, Signal, SignalSet};
