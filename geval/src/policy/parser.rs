//! Parse policy from YAML.

use anyhow::{Context, Result};
use std::path::Path;

use crate::policy::Policy;

/// Policy file can have top-level "policy" wrapper or be the policy object directly.
#[derive(serde::Deserialize)]
struct PolicyFile {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    policy: Option<PolicyInner>,
    #[serde(default)]
    environment: Option<String>,
    #[serde(default)]
    rules: Option<Vec<crate::policy::Rule>>,
}

#[derive(serde::Deserialize)]
struct PolicyInner {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    environment: Option<String>,
    #[serde(default)]
    rules: Option<Vec<crate::policy::Rule>>,
}

fn parse_policy_yaml(s: &str) -> Result<Policy> {
    let _: serde_yaml::Value = serde_yaml::from_str(s).context("parse policy YAML")?;
    let wrapped: Option<PolicyFile> = serde_yaml::from_str(s).ok();

    if let Some(f) = wrapped {
        if let Some(inner) = f.policy {
            return Ok(Policy {
                name: inner.name.or(f.name),
                version: inner.version.or(f.version),
                environment: inner.environment.or(f.environment),
                rules: inner.rules.unwrap_or_else(Vec::new),
            });
        }
        return Ok(Policy {
            name: f.name,
            version: f.version,
            environment: f.environment,
            rules: f.rules.unwrap_or_else(Vec::new),
        });
    }

    // Direct policy shape
    let p: Policy = serde_yaml::from_str(s).context("invalid policy structure")?;
    Ok(p)
}

/// Parse policy from a string (e.g. for tests or inline).
pub fn parse_policy_str(s: &str) -> Result<Policy> {
    parse_policy_yaml(s)
}

/// Load and parse policy from a file path.
pub fn parse_policy(path: &Path) -> Result<Policy> {
    let s = std::fs::read_to_string(path).with_context(|| format!("read policy file: {}", path.display()))?;
    parse_policy_yaml(&s)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::policy::{Action, Operator};

    #[test]
    fn test_parse_policy_with_wrapper() {
        let yaml = r#"
policy:
  environment: prod
  rules:
    - priority: 1
      name: business_block
      when:
        metric: engagement_drop
        operator: ">"
        threshold: 0
      then:
        action: block
        reason: "Business engagement dropped"
"#;
        let p = parse_policy_str(yaml).unwrap();
        assert_eq!(p.environment.as_deref(), Some("prod"));
        assert_eq!(p.rules.len(), 1);
        assert_eq!(p.rules[0].name, "business_block");
        assert_eq!(p.rules[0].then.action, Action::Block);
        assert_eq!(p.rules[0].when.operator, Some(Operator::GreaterThan));
    }

    #[test]
    fn test_parse_policy_with_name_and_version() {
        let yaml = r#"
name: release-gate
version: "2.1.0"
policy:
  environment: prod
  rules:
    - priority: 1
      name: block_bad
      when:
        metric: risk
        operator: ">"
        threshold: 0.5
      then:
        action: block
"#;
        let p = parse_policy_str(yaml).unwrap();
        assert_eq!(p.name.as_deref(), Some("release-gate"));
        assert_eq!(p.version.as_deref(), Some("2.1.0"));
        assert_eq!(p.rules.len(), 1);
    }
}
