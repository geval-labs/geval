//! SHA256 hashing for contract, policies, and signals (audit reproducibility).

use sha2::{Digest, Sha256};

/// Compute SHA256 hex digest of contract definition (name, version, combine, policy paths).
pub fn hash_contract_content(contract: &crate::contract::ContractDef) -> String {
    let json = serde_json::to_string(contract).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(json.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Compute SHA256 hex digest of serialized policy.
pub fn hash_policy(policy: &crate::policy::Policy) -> String {
    let json = serde_json::to_string(policy).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(json.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Compute SHA256 hex digest of signals JSON.
pub fn hash_signals(signals: &crate::signals::SignalSet) -> String {
    let json = serde_json::to_value(&signals.signals).unwrap_or(serde_json::Value::Null);
    let bytes = json.to_string();
    let mut hasher = Sha256::new();
    hasher.update(bytes.as_bytes());
    format!("{:x}", hasher.finalize())
}
