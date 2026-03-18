//! Combination rules: how multiple policy outcomes are merged into one contract decision.
//!
//! Extensible: add a new variant to `CombineRule` and implement the logic in `apply`.

use crate::evaluator::DecisionOutcome;
use serde::{Deserialize, Serialize};

/// How to combine outcomes from multiple policies into a single contract decision.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CombineRule {
    #[default]
    /// PASS only if every policy returns PASS. Otherwise: any BLOCK → BLOCK; else REQUIRE_APPROVAL.
    AllPass,

    /// If any policy returns BLOCK → BLOCK; else if any REQUIRE_APPROVAL → REQUIRE_APPROVAL; else PASS.
    AnyBlockBlocks,
}

impl std::fmt::Display for CombineRule {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CombineRule::AllPass => write!(f, "all_pass"),
            CombineRule::AnyBlockBlocks => write!(f, "any_block_blocks"),
        }
    }
}

impl std::str::FromStr for CombineRule {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_lowercase().as_str() {
            "all_pass" => Ok(CombineRule::AllPass),
            "any_block_blocks" => Ok(CombineRule::AnyBlockBlocks),
            _ => Err(format!("unknown combine rule: {}", s)),
        }
    }
}

/// Apply the combination rule to a slice of policy outcomes (order preserved).
/// Returns the single contract-level outcome.
pub fn apply_combine_rule(rule: CombineRule, outcomes: &[DecisionOutcome]) -> DecisionOutcome {
    if outcomes.is_empty() {
        return DecisionOutcome::Pass;
    }
    match rule {
        CombineRule::AllPass => {
            let any_block = outcomes.iter().any(|o| *o == DecisionOutcome::Block);
            let any_approval = outcomes.iter().any(|o| *o == DecisionOutcome::RequireApproval);
            if any_block {
                DecisionOutcome::Block
            } else if any_approval {
                DecisionOutcome::RequireApproval
            } else {
                DecisionOutcome::Pass
            }
        }
        CombineRule::AnyBlockBlocks => {
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
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_pass_all_pass() {
        let outcomes = [
            DecisionOutcome::Pass,
            DecisionOutcome::Pass,
            DecisionOutcome::Pass,
        ];
        assert_eq!(apply_combine_rule(CombineRule::AllPass, &outcomes), DecisionOutcome::Pass);
    }

    #[test]
    fn all_pass_any_block() {
        let outcomes = [
            DecisionOutcome::Pass,
            DecisionOutcome::Block,
            DecisionOutcome::Pass,
        ];
        assert_eq!(apply_combine_rule(CombineRule::AllPass, &outcomes), DecisionOutcome::Block);
    }

    #[test]
    fn all_pass_any_approval_no_block() {
        let outcomes = [
            DecisionOutcome::Pass,
            DecisionOutcome::RequireApproval,
            DecisionOutcome::Pass,
        ];
        assert_eq!(
            apply_combine_rule(CombineRule::AllPass, &outcomes),
            DecisionOutcome::RequireApproval
        );
    }

    #[test]
    fn any_block_blocks_none() {
        let outcomes = [DecisionOutcome::Pass, DecisionOutcome::Pass];
        assert_eq!(
            apply_combine_rule(CombineRule::AnyBlockBlocks, &outcomes),
            DecisionOutcome::Pass
        );
    }

    #[test]
    fn any_block_blocks_one_block() {
        let outcomes = [
            DecisionOutcome::Pass,
            DecisionOutcome::Block,
            DecisionOutcome::RequireApproval,
        ];
        assert_eq!(
            apply_combine_rule(CombineRule::AnyBlockBlocks, &outcomes),
            DecisionOutcome::Block
        );
    }

    #[test]
    fn any_block_blocks_approval_only() {
        let outcomes = [
            DecisionOutcome::Pass,
            DecisionOutcome::RequireApproval,
            DecisionOutcome::Pass,
        ];
        assert_eq!(
            apply_combine_rule(CombineRule::AnyBlockBlocks, &outcomes),
            DecisionOutcome::RequireApproval
        );
    }

    #[test]
    fn empty_outcomes_pass() {
        assert_eq!(
            apply_combine_rule(CombineRule::AllPass, &[]),
            DecisionOutcome::Pass
        );
        assert_eq!(
            apply_combine_rule(CombineRule::AnyBlockBlocks, &[]),
            DecisionOutcome::Pass
        );
    }
}
