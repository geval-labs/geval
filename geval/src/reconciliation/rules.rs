//! Reconciliation via priority rules only. No scoring or weights.
//! The evaluator tests every rule, records all matches, and picks the **best priority**
//! (**1** = highest); no match => PASS. This module is a placeholder for future extensions.

use crate::evaluator::Decision;

/// Reconciliation is implemented in the evaluator (priority-ordered rules).
/// This function is for clarity and future extension; it does not change the decision.
pub fn apply_reconciliation(decision: Decision) -> Decision {
    decision
}
