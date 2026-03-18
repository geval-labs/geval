//! Contract: a named, versioned set of policies evaluated together with a combination rule.
//!
//! This is the core unit of evaluation in Geval. A contract references multiple policy files;
//! each policy is evaluated against the same signals; outcomes are combined (e.g. all_pass, any_block_blocks)
//! into a single decision.

mod combine;
mod loader;
mod model;
mod runner;

pub use combine::{apply_combine_rule, CombineRule};
pub use loader::{load_contract, load_contract_and_policies, parse_contract_str, resolve_policy_path};
pub use model::{ContractDef, PolicyRef};
pub use runner::{run_contract, ContractResult, PolicyResult};
