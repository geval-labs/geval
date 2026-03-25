//! Load contract from YAML and resolve policy paths.

use anyhow::{Context, Result};
use std::path::{Path, PathBuf};

use crate::contract::{ContractDef, PolicyRef};
use crate::policy::{parse_policy, Policy};

/// Policy ref in YAML: either a string path or { path: "..." }.
#[derive(serde::Deserialize)]
#[serde(untagged)]
enum PolicyRefInput {
    Path(String),
    Obj { path: String },
}

/// Raw contract file shape (YAML).
#[derive(serde::Deserialize)]
struct ContractFile {
    name: String,
    version: String,
    #[serde(default)]
    combine: super::CombineRule,
    policies: Vec<PolicyRefInput>,
}

/// Load contract definition from a file path.
pub fn load_contract(path: &Path) -> Result<ContractDef> {
    let s = std::fs::read_to_string(path).with_context(|| format!("read contract file: {}", path.display()))?;
    parse_contract_str(&s).with_context(|| format!("parse contract: {}", path.display()))
}

/// Parse contract from a string (e.g. tests or inline).
pub fn parse_contract_str(s: &str) -> Result<ContractDef> {
    let _: serde_yaml::Value = serde_yaml::from_str(s).context("parse contract YAML")?;
    let f: ContractFile = serde_yaml::from_str(s).context("invalid contract structure")?;
    let policies: Vec<PolicyRef> = f
        .policies
        .into_iter()
        .map(|p| match p {
            PolicyRefInput::Path(s) => PolicyRef { path: s },
            PolicyRefInput::Obj { path } => PolicyRef { path },
        })
        .collect();
    let def = ContractDef {
        name: f.name,
        version: f.version,
        combine: f.combine,
        policies,
    };
    def.validate().map_err(|e| anyhow::anyhow!("{}", e))?;
    Ok(def)
}

/// Resolve a policy path relative to the contract file's directory.
pub fn resolve_policy_path(contract_path: &Path, policy_ref: &PolicyRef) -> PathBuf {
    let contract_dir = contract_path
        .parent()
        .unwrap_or_else(|| Path::new("."));
    contract_dir.join(&policy_ref.path)
}

/// Load the contract and all its policies. Policy paths are resolved relative to the contract file.
pub fn load_contract_and_policies(contract_path: &Path) -> Result<(ContractDef, Vec<Policy>)> {
    let contract = load_contract(contract_path)?;
    let mut policies = Vec::with_capacity(contract.policies.len());
    for pref in &contract.policies {
        let resolved = resolve_policy_path(contract_path, pref);
        let policy = parse_policy(&resolved)
            .with_context(|| format!("load policy: {}", resolved.display()))?;
        policies.push(policy);
    }
    Ok((contract, policies))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_contract_minimal() {
        let yaml = r#"
name: release-gate
version: "1.0.0"
combine: worst_case
policies:
  - path: security.yaml
  - path: quality.yaml
"#;
        let c = parse_contract_str(yaml).unwrap();
        assert_eq!(c.name, "release-gate");
        assert_eq!(c.version, "1.0.0");
        assert_eq!(c.combine, crate::contract::CombineRule::WorstCase);
        assert_eq!(c.policies.len(), 2);
        assert_eq!(c.policies[0].path, "security.yaml");
        assert_eq!(c.policies[1].path, "quality.yaml");
    }

    #[test]
    fn parse_contract_all_pass_spelling_deserializes_as_worst_case() {
        let yaml = r#"
name: alt-spelling
version: "1.0.0"
combine: all_pass
policies:
  - path: p.yaml
"#;
        let c = parse_contract_str(yaml).unwrap();
        assert_eq!(c.combine, crate::contract::CombineRule::WorstCase);
    }

    #[test]
    fn parse_contract_empty_policies_invalid() {
        let yaml = r#"
name: empty
version: "1.0.0"
combine: any_block_blocks
policies: []
"#;
        assert!(parse_contract_str(yaml).is_err());
    }

    #[test]
    fn parse_contract_default_combine() {
        let yaml = r#"
name: one
version: "1.0.0"
policies:
  - path: single.yaml
"#;
        let c = parse_contract_str(yaml).unwrap();
        assert_eq!(c.combine, crate::contract::CombineRule::WorstCase);
    }
}
