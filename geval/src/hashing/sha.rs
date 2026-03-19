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

/// Deterministic digest of an ordered list of contract paths and their content hashes (audit bundle).
pub fn hash_contract_bundle(entries: &[(std::path::PathBuf, &str)]) -> String {
    let mut buf = String::new();
    for (path, contract_hash) in entries {
        use std::fmt::Write;
        let _ = writeln!(buf, "{}\t{}", path.display(), contract_hash);
    }
    let mut hasher = Sha256::new();
    hasher.update(buf.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn bundle_hash_stable_and_order_dependent() {
        let a = PathBuf::from("/a/c1.yaml");
        let b = PathBuf::from("/b/c2.yaml");
        let h1 = hash_contract_bundle(&[(a.clone(), "aaa"), (b.clone(), "bbb")]);
        let h2 = hash_contract_bundle(&[(a.clone(), "aaa"), (b.clone(), "bbb")]);
        assert_eq!(h1, h2);
        let h3 = hash_contract_bundle(&[(b, "bbb"), (a, "aaa")]);
        assert_ne!(h1, h3);
    }
}
