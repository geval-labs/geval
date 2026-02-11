# CLI Package Changelog

## Version 0.0.6

### New Features

#### Signal Support

- Added `--signals` flag to `geval check` and `geval explain` commands
- Supports parsing signals from JSON files
- Signals are evaluated as part of policy-based contracts

#### Environment-Aware Evaluation

- Added `--env` flag to specify environment (development|staging|production)
- Environment-specific policy rules are automatically applied
- Defaults to contract's environment or "production"

#### Decision Records

- Automatic generation of `geval-decision.json` after each evaluation
- Includes deterministic hashes for reproducibility (eval_hash, signals_hash, policy_hash)
- Tracks evidence files and commit SHA

#### Human Decision Commands

- `geval approve` - Record human approval decisions
- `geval reject` - Record human rejection decisions
- Both commands create JSON artifacts that can be used as signals

#### Enhanced Commands

**`geval check`**

- Now supports `--signals` and `--env` flags
- Automatically generates decision records
- Works with both legacy eval-based and new policy-based contracts

**`geval explain`**

- Updated to support signals and environment
- Shows policy rules analysis for policy-based contracts
- Displays signal information in verbose mode

**`geval validate`**

- Now validates policy-based contracts
- Shows contract type (policy-based vs eval-based)
- Displays policy rule counts and environment information

### Breaking Changes

None - fully backward compatible with existing contracts and workflows.

### Dependencies

- Updated `@geval-labs/core` to `^0.0.6`
