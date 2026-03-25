//! Combination rules: how multiple policy outcomes are merged into one contract decision.
//!
//! Geval uses a **single** merge semantics everywhere: **worst outcome wins** —
//! `BLOCK` beats `REQUIRE_APPROVAL` beats `PASS`. Contract YAML uses `combine: worst_case`.

use crate::evaluator::DecisionOutcome;
use serde::{Deserialize, Serialize};

/// How to combine outcomes from multiple policies into a single contract decision.
///
/// Only one rule exists today: merge by severity (worst wins). Additional accepted spellings
/// are handled via `#[serde(alias = ...)]` for compatibility with existing files.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CombineRule {
    /// Any `BLOCK` wins; else any `REQUIRE_APPROVAL`; else `PASS`.
    #[default]
    #[serde(alias = "all_pass", alias = "any_block_blocks")]
    WorstCase,
}

impl std::fmt::Display for CombineRule {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CombineRule::WorstCase => write!(f, "worst_case"),
        }
    }
}

impl std::str::FromStr for CombineRule {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_lowercase().as_str() {
            "worst_case" | "all_pass" | "any_block_blocks" => Ok(CombineRule::WorstCase),
            _ => Err(format!("unknown combine rule: {} (expected worst_case)", s)),
        }
    }
}

/// Merge policy or contract outcomes: **BLOCK** > **REQUIRE_APPROVAL** > **PASS**.
/// The `rule` argument is kept for API stability; behavior does not depend on it.
pub fn apply_combine_rule(_rule: CombineRule, outcomes: &[DecisionOutcome]) -> DecisionOutcome {
    if outcomes.is_empty() {
        return DecisionOutcome::Pass;
    }
    if outcomes.iter().any(|o| *o == DecisionOutcome::Block) {
        DecisionOutcome::Block
    } else if outcomes
        .iter()
        .any(|o| *o == DecisionOutcome::RequireApproval)
    {
        DecisionOutcome::RequireApproval
    } else {
        DecisionOutcome::Pass
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn worst_case_all_pass_outcomes() {
        let outcomes = [
            DecisionOutcome::Pass,
            DecisionOutcome::Pass,
            DecisionOutcome::Pass,
        ];
        assert_eq!(
            apply_combine_rule(CombineRule::WorstCase, &outcomes),
            DecisionOutcome::Pass
        );
    }

    #[test]
    fn worst_case_block_beats_pass() {
        let outcomes = [
            DecisionOutcome::Pass,
            DecisionOutcome::Block,
            DecisionOutcome::Pass,
        ];
        assert_eq!(
            apply_combine_rule(CombineRule::WorstCase, &outcomes),
            DecisionOutcome::Block
        );
    }

    #[test]
    fn worst_case_require_approval_when_no_block() {
        let outcomes = [
            DecisionOutcome::Pass,
            DecisionOutcome::RequireApproval,
            DecisionOutcome::Pass,
        ];
        assert_eq!(
            apply_combine_rule(CombineRule::WorstCase, &outcomes),
            DecisionOutcome::RequireApproval
        );
    }

    #[test]
    fn worst_case_two_passes() {
        let outcomes = [DecisionOutcome::Pass, DecisionOutcome::Pass];
        assert_eq!(
            apply_combine_rule(CombineRule::WorstCase, &outcomes),
            DecisionOutcome::Pass
        );
    }

    #[test]
    fn worst_case_block_beats_require_approval() {
        let outcomes = [
            DecisionOutcome::Pass,
            DecisionOutcome::Block,
            DecisionOutcome::RequireApproval,
        ];
        assert_eq!(
            apply_combine_rule(CombineRule::WorstCase, &outcomes),
            DecisionOutcome::Block
        );
    }

    #[test]
    fn worst_case_require_approval_beats_pass() {
        let outcomes = [
            DecisionOutcome::Pass,
            DecisionOutcome::RequireApproval,
            DecisionOutcome::Pass,
        ];
        assert_eq!(
            apply_combine_rule(CombineRule::WorstCase, &outcomes),
            DecisionOutcome::RequireApproval
        );
    }

    #[test]
    fn empty_outcomes_pass() {
        assert_eq!(
            apply_combine_rule(CombineRule::WorstCase, &[]),
            DecisionOutcome::Pass
        );
    }

    #[test]
    fn from_str_accepts_worst_case_and_equivalent_spellings() {
        assert_eq!(
            "worst_case".parse::<CombineRule>().unwrap(),
            CombineRule::WorstCase
        );
        assert_eq!(
            "all_pass".parse::<CombineRule>().unwrap(),
            CombineRule::WorstCase
        );
        assert_eq!(
            "any_block_blocks".parse::<CombineRule>().unwrap(),
            CombineRule::WorstCase
        );
        assert!("nope".parse::<CombineRule>().is_err());
    }

    #[test]
    fn display_is_worst_case() {
        assert_eq!(CombineRule::WorstCase.to_string(), "worst_case");
    }
}
