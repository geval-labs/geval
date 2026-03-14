//! Signal graph: logical view system → agent → component → step → signal.
//! The engine operates on generic fields; this provides structured access.

use crate::signals::Signal;
use std::collections::HashMap;

/// Graph view over signals for rule matching.
/// Keys are optional; we index by system, agent, component, step, and metric
/// so rules can match on any combination.
#[derive(Debug, Default)]
pub struct SignalGraph {
    /// All signals in order (for iteration and reporting).
    pub signals: Vec<Signal>,
    /// Signals that have a numeric value for the given metric (metric -> list of (signal_idx, value)).
    metric_values: HashMap<String, Vec<(usize, f64)>>,
    /// Signals that have a string value for the given metric (metric -> list of (signal_idx, value)).
    metric_strings: HashMap<String, Vec<(usize, String)>>,
    /// Presence: metric name -> signal indices that have this metric.
    metric_presence: HashMap<String, Vec<usize>>,
}

impl SignalGraph {
    pub fn build(signals: &[Signal]) -> Self {
        let mut metric_values: HashMap<String, Vec<(usize, f64)>> = HashMap::new();
        let mut metric_strings: HashMap<String, Vec<(usize, String)>> = HashMap::new();
        let mut metric_presence: HashMap<String, Vec<usize>> = HashMap::new();

        for (idx, s) in signals.iter().enumerate() {
            let metric = match &s.metric {
                Some(m) => m.clone(),
                None => continue,
            };
            metric_presence
                .entry(metric.clone())
                .or_default()
                .push(idx);

            if let Some(v) = &s.value {
                if let Some(n) = v.as_f64() {
                    metric_values
                        .entry(metric.clone())
                        .or_default()
                        .push((idx, n));
                } else if let Some(st) = v.as_str() {
                    metric_strings
                        .entry(metric)
                        .or_default()
                        .push((idx, st.to_string()));
                }
            }
        }

        SignalGraph {
            signals: signals.to_vec(),
            metric_values,
            metric_strings,
            metric_presence,
        }
    }

    /// Get numeric values for a metric, optionally filtered by component.
    pub fn get_metric_values(&self, metric: &str, component: Option<&str>) -> Vec<f64> {
        let mut out = Vec::new();
        if let Some(pairs) = self.metric_values.get(metric) {
            for &(idx, v) in pairs {
                let s = &self.signals[idx];
                if component.map(|c| s.component.as_deref() == Some(c)).unwrap_or(true) {
                    out.push(v);
                }
            }
        }
        out
    }

    /// Check if any signal has this metric (and optionally component).
    pub fn has_metric(&self, metric: &str, component: Option<&str>) -> bool {
        let indices = match self.metric_presence.get(metric) {
            Some(ix) => ix,
            None => return false,
        };
        if let Some(c) = component {
            indices
                .iter()
                .any(|&idx| self.signals[idx].component.as_deref() == Some(c))
        } else {
            !indices.is_empty()
        }
    }

    /// Get the first numeric value for (metric, component) for threshold comparison.
    pub fn get_first_value(&self, metric: &str, component: Option<&str>) -> Option<f64> {
        self.get_metric_values(metric, component).into_iter().next()
    }

    pub fn len(&self) -> usize {
        self.signals.len()
    }

    pub fn is_empty(&self) -> bool {
        self.signals.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::signals::Signal;

    fn sig(component: Option<&str>, metric: &str, value: f64) -> Signal {
        Signal {
            system: None,
            agent: None,
            component: component.map(String::from),
            step: None,
            metric: Some(metric.to_string()),
            value: Some(serde_json::json!(value)),
            r#type: None,
        }
    }

    #[test]
    fn test_graph_get_value() {
        let signals = vec![
            sig(Some("retrieval"), "context_relevance", 0.84),
            sig(Some("generator"), "hallucination_rate", 0.06),
        ];
        let g = SignalGraph::build(&signals);
        assert_eq!(g.get_first_value("context_relevance", Some("retrieval")), Some(0.84));
        assert_eq!(g.get_first_value("hallucination_rate", Some("generator")), Some(0.06));
        assert!(g.get_first_value("context_relevance", Some("generator")).is_none());
    }
}
