//! Human approval/rejection artifacts for REQUIRE_APPROVAL flow.
//! Every approval artifact is versioned for audit.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Schema version of the approval artifact format. Bump when the shape changes.
pub const APPROVAL_ARTIFACT_VERSION: &str = "1";

/// Outcome of an approval/rejection action.
#[derive(Debug, Clone, Copy)]
pub enum ApprovalOutcome {
    Approved,
    Rejected,
}

/// Artifact written by `geval approve` or `geval reject`.
#[derive(Debug, Serialize, Deserialize)]
pub struct ApprovalArtifact {
    /// Artifact format version. Defaults to "1" when reading old artifacts.
    #[serde(default = "default_approval_version")]
    pub version: String,
    pub approved_by: String,
    pub reason: String,
    pub timestamp: String,
    /// true = approval, false = rejection
    pub approved: bool,
}

fn default_approval_version() -> String {
    "1".to_string()
}

/// Write approval artifact to a path (e.g. .geval/approval.json or user-specified).
pub fn write_approval(
    path: &Path,
    approved_by: String,
    reason: String,
    approved: bool,
) -> Result<()> {
    let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let artifact = ApprovalArtifact {
        version: APPROVAL_ARTIFACT_VERSION.to_string(),
        approved_by,
        reason,
        timestamp,
        approved,
    };
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).with_context(|| format!("create {}", parent.display()))?;
    }
    let json = serde_json::to_string_pretty(&artifact).context("serialize approval")?;
    std::fs::write(path, json).with_context(|| format!("write {}", path.display()))?;
    Ok(())
}

/// Read approval artifact from path.
pub fn read_approval(path: &Path) -> Result<ApprovalArtifact> {
    let s = std::fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
    serde_json::from_str(&s).context("parse approval JSON")
}
