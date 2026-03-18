//! Load signals from JSON. Signals are declared facts; Geval does not validate or compute them.
//!
//! **Non-uniform signals:** Geval accepts a mix of shapes in one file. Each signal can have:
//! - **Optional context:** system, agent, component, step, metric, type.
//! - **Optional value:** missing, a number, or a string.
//!
//! How rules use them:
//! - **No value (presence-only):** A rule with operator `presence` matches if any signal has that
//!   metric (and optional component). So "human_reviewed" with no score still counts for rules
//!   like "when human_reviewed is present → require_approval".
//! - **Numeric value:** Rules with `>`, `<`, `>=`, `<=`, `==` use the first numeric value for that
//!   metric (and optional component). Other signals for the same metric are ignored for that rule.
//! - **String value:** Stored and available for display; rule support for "metric equals string"
//!   can be added so categorical signals (e.g. "review": "approved") drive decisions.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

/// A single signal — one piece of evidence. All fields optional so you can mix scores, presence-only, and labels.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Signal {
    #[serde(default)]
    pub system: Option<String>,
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default)]
    pub component: Option<String>,
    #[serde(default)]
    pub step: Option<String>,
    #[serde(default)]
    pub metric: Option<String>,
    #[serde(default)]
    pub value: Option<serde_json::Value>,
    /// Optional type for categorisation (e.g. "ab_test")
    #[serde(default)]
    pub r#type: Option<String>,
}

/// Top-level container: either { "name"?, "version"?, "signals": [...] } or raw array.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum SignalsInput {
    Wrapped {
        #[serde(default)]
        name: Option<String>,
        #[serde(default)]
        version: Option<String>,
        signals: Vec<Signal>,
    },
    Array(Vec<Signal>),
}

/// Set of signals loaded from a file or reader.
/// Name and version identify the signals set for audit; bump version when the pipeline or schema changes.
#[derive(Debug, Clone)]
pub struct SignalSet {
    pub name: Option<String>,
    pub version: Option<String>,
    pub signals: Vec<Signal>,
}

impl SignalSet {
    pub fn new(signals: Vec<Signal>) -> Self {
        Self {
            name: None,
            version: None,
            signals,
        }
    }

    pub fn with_identity(name: Option<String>, version: Option<String>, signals: Vec<Signal>) -> Self {
        Self { name, version, signals }
    }

    pub fn is_empty(&self) -> bool {
        self.signals.is_empty()
    }

    pub fn len(&self) -> usize {
        self.signals.len()
    }
}

/// Load signals from a JSON file path.
pub fn load_signals(path: &Path) -> Result<SignalSet> {
    let f = File::open(path).with_context(|| format!("open signals file: {}", path.display()))?;
    load_signals_from_reader(BufReader::new(f))
}

/// Load signals from any readable JSON (e.g. stdin or string).
pub fn load_signals_from_reader<R: std::io::Read>(rd: R) -> Result<SignalSet> {
    let value: serde_json::Value =
        serde_json::from_reader(rd).context("parse signals JSON")?;
    parse_signals_value(&value)
}

fn parse_signals_value(v: &serde_json::Value) -> Result<SignalSet> {
    let input: SignalsInput = serde_json::from_value(v.clone()).context("invalid signals structure")?;
    match input {
        SignalsInput::Wrapped { name, version, signals } => {
            Ok(SignalSet::with_identity(name, version, signals))
        }
        SignalsInput::Array(signals) => Ok(SignalSet::new(signals)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_wrapped_signals() {
        let json = r#"{"signals":[{"metric":"x","value":0.5}]}"#;
        let set = load_signals_from_reader(json.as_bytes()).unwrap();
        assert_eq!(set.len(), 1);
        assert_eq!(set.signals[0].metric.as_deref(), Some("x"));
    }

    #[test]
    fn test_load_array_signals() {
        let json = r#"[{"metric":"a","value":1},{"component":"retrieval","metric":"rel","value":0.84}]"#;
        let set = load_signals_from_reader(json.as_bytes()).unwrap();
        assert_eq!(set.len(), 2);
        assert_eq!(set.signals[1].component.as_deref(), Some("retrieval"));
    }

    #[test]
    fn test_load_signals_with_version() {
        let json = r#"{"version":"1.0","name":"ci-signals","signals":[{"metric":"x","value":0.5}]}"#;
        let set = load_signals_from_reader(json.as_bytes()).unwrap();
        assert_eq!(set.version.as_deref(), Some("1.0"));
        assert_eq!(set.name.as_deref(), Some("ci-signals"));
        assert_eq!(set.len(), 1);
    }
}
