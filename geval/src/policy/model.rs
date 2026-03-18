//! Policy model: rules with priority, when (condition), then (consequence).

use serde::{Deserialize, Serialize};

/// Decision action produced by a rule.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    #[serde(alias = "pass")]
    Pass,
    #[serde(alias = "block")]
    Block,
    #[serde(alias = "require_approval")]
    RequireApproval,
}

/// Comparison operator for threshold rules.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Operator {
    #[serde(rename = ">")]
    GreaterThan,
    #[serde(rename = "<")]
    LessThan,
    #[serde(rename = ">=")]
    GreaterOrEqual,
    #[serde(rename = "<=")]
    LessOrEqual,
    #[serde(rename = "==")]
    Equal,
    Presence,
}

impl<'de> serde::Deserialize<'de> for Operator {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        let s = s.trim();
        match s {
            ">" => Ok(Operator::GreaterThan),
            "<" => Ok(Operator::LessThan),
            ">=" => Ok(Operator::GreaterOrEqual),
            "<=" => Ok(Operator::LessOrEqual),
            "==" => Ok(Operator::Equal),
            "presence" => Ok(Operator::Presence),
            _ => Err(serde::de::Error::custom(format!("unknown operator: {}", s))),
        }
    }
}

/// Condition for when a rule applies. All fields optional for flexibility;
/// at least metric (and usually operator + threshold) are set for threshold rules.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RuleCondition {
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
    pub operator: Option<Operator>,
    #[serde(default)]
    pub threshold: Option<f64>,
}

/// Consequence when a rule matches.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RuleConsequence {
    pub action: Action,
    #[serde(default)]
    pub reason: Option<String>,
}

/// A single policy rule: priority (lower = evaluated first), name, when, then.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Rule {
    pub priority: u32,
    pub name: String,
    pub when: RuleCondition,
    pub then: RuleConsequence,
}

/// Top-level policy (contract): optional identity for audit; environment and ordered rules.
/// Name + version identify the "contract" so every decision is tied to a versioned policy.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Policy {
    /// Contract/policy name (e.g. "release-gate"). For audit; no semantic effect.
    #[serde(default)]
    pub name: Option<String>,
    /// Contract/policy version (e.g. "1.0.0"). Bump when you change rules; every decision records this.
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub environment: Option<String>,
    pub rules: Vec<Rule>,
}

impl Policy {
    /// Rules sorted by priority (ascending); first match wins.
    pub fn sorted_rules(&self) -> Vec<&Rule> {
        let mut r: Vec<&Rule> = self.rules.iter().collect();
        r.sort_by_key(|x| x.priority);
        r
    }
}
