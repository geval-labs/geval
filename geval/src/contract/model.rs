//! Contract model: a named, versioned set of policies and a combination rule.
//!
//! A contract is the unit of evaluation: load contract → load all policies → evaluate each → combine.

use serde::{Deserialize, Serialize};

use crate::contract::CombineRule;

/// Reference to a policy file (path relative to the contract file's directory).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyRef {
    /// Path to the policy YAML file (relative to contract file dir or absolute).
    pub path: String,
}

/// Contract definition: name, version, list of policy paths, and how to combine their outcomes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractDef {
    /// Contract name (e.g. "release-gate"). Required for audit.
    pub name: String,

    /// Contract version (e.g. "1.0.0"). Bump when you add/remove policies or change combine rule.
    pub version: String,

    /// How to combine outcomes from the policies.
    #[serde(default)]
    pub combine: CombineRule,

    /// List of policy file paths (e.g. `policies/safety-and-blocking.yaml` from `geval init`).
    /// Paths are resolved relative to the directory containing the contract file.
    pub policies: Vec<PolicyRef>,
}

impl ContractDef {
    /// Validates that the contract has at least one policy.
    pub fn validate(&self) -> Result<(), String> {
        if self.policies.is_empty() {
            return Err("contract must have at least one policy".to_string());
        }
        Ok(())
    }
}
