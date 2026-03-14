//! Reconciliation via priority rules only. No scoring or weights.
//! The evaluator already evaluates rules in priority order; this module
//! is a placeholder for any explicit reconciliation documentation or
//! future extension (e.g. named reconciliation strategies).
//! Actual behaviour: first matching rule wins; no match => PASS.

use crate::evaluator::Decision;

/// Reconciliation is implemented in the evaluator (priority-ordered rules).
/// This function is for clarity and future extension; it does not change the decision.
pub fn apply_reconciliation(decision: Decision) -> Decision {
    decision
}
