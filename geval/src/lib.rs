//! Geval - Decision orchestration engine for AI systems.
//!
//! Consumes signals (JSON), evaluates policy rules (YAML), and produces
//! deterministic decisions: PASS, REQUIRE_APPROVAL, or BLOCK.

pub mod approval;
pub mod artifact;
pub mod cli;
pub mod evaluator;
pub mod explanation;
pub mod hashing;
pub mod policy;
pub mod reconciliation;
pub mod signal_graph;
pub mod signals;

pub use approval::{ApprovalArtifact, ApprovalOutcome, read_approval, write_approval};
pub use artifact::write_decision_artifact;
pub use evaluator::{evaluate, Decision, DecisionOutcome};
pub use explanation::explain_decision;
pub use hashing::{hash_policy, hash_signals};
pub use policy::{parse_policy, parse_policy_str, Policy, Rule};
pub use signal_graph::SignalGraph;
pub use signals::{load_signals, Signal, SignalSet};
