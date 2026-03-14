//! Load signals from JSON. Signals are declared facts; Geval does not validate or compute them.

use anyhow::{Context, Result};
use serde::Deserialize;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

/// A single signal - evidence used to evaluate an AI system change.
/// All context fields are optional to support simple and complex systems.
#[derive(Debug, Clone, Deserialize)]
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

/// Top-level container: either { "signals": [...] } or raw array.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum SignalsInput {
    Wrapped { signals: Vec<Signal> },
    Array(Vec<Signal>),
}

/// Set of signals loaded from a file or reader.
#[derive(Debug, Clone)]
pub struct SignalSet {
    pub signals: Vec<Signal>,
}

impl SignalSet {
    pub fn new(signals: Vec<Signal>) -> Self {
        Self { signals }
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
    let signals = parse_signals_value(&value)?;
    Ok(SignalSet::new(signals))
}

fn parse_signals_value(v: &serde_json::Value) -> Result<Vec<Signal>> {
    let input: SignalsInput = serde_json::from_value(v.clone()).context("invalid signals structure")?;
    let signals = match input {
        SignalsInput::Wrapped { signals } => signals,
        SignalsInput::Array(signals) => signals,
    };
    Ok(signals)
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
}
