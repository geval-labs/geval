# Accountability and Auditing

Geval is designed so **nothing is unversioned**: every decision and every action is auditable. Auditors can answer:

- **Why was this deployed?** – Decision report and matched rule (and optional approval reason).
- **Who approved it?** – `geval approve` writes an artifact with `approved_by`, `reason`, and artifact `version`.
- **What policy (contract) was used?** – Artifact stores each contract’s identity, `contract_hash`, per-policy hashes, and (v3) `bundle_hash` for the ordered set of contracts.
- **What signals were used?** – Artifact stores `signals_name`, `signals_version`, and `signals_hash` (SHA256).
- **Which Geval binary?** – Artifact stores `geval_version`.

**Rule of thumb:** When you change policy or signals, bump their `version` so every decision is tied to a specific version. No update without a version update.

## Artifacts

### Decision artifact

Each `geval check` run writes:

- **Path:** `.geval/decisions/<timestamp>.json`
- **Contents (artifact_version 3, multi-contract):**
  - `artifact_version` – schema version (`"3"`)
  - `geval_version` – binary version that produced the decision
  - `bundle_hash` – SHA256 over the ordered list of `(contract_path, contract_hash)` (audit the exact contract set)
  - `contracts_combine_rule` – how each contract’s **combined** outcome was merged (e.g. `all_pass`, `any_block_blocks`)
  - `contracts` – array of blocks, each with:
    - `contract_path`, `contract_name`, `contract_version`, `contract_hash`
    - `combine_rule` (policies within that contract)
    - `policy_results` – `{ policy_path, policy_name?, policy_version?, policy_hash, outcome, matched_rule? }[]`
    - `combined_decision`, `combined_matched_rule`, `combined_reason` (outcome for that contract)
  - `overall_combined_decision`, `overall_matched_rule`, `overall_reason` – PR-level outcome after `contracts_combine_rule`
  - `signals_name`, `signals_version`, `signals_hash` – signals identity and content hash
  - `timestamp` – ISO8601
  - `approval` – optional; set when an approval is recorded for this decision

Older tooling may still reference **artifact_version 2** (single flat contract); Geval now writes v3 only.

### Approval artifact

`geval approve` / `geval reject` write:

- **Path:** configurable (e.g. `.geval/approval.json`)
- **Contents:** `version` (artifact format), `approved_by`, `reason`, `timestamp`, `approved` (true/false)

## Reproducibility

- **Deterministic:** Same signals + same policy → same decision.
- **Versions + hashes:** Decision artifact records policy/signals name and version (human identity) and content hashes (integrity). You can verify exactly which contract and signals version was used.
- **No remote services:** All inputs and outputs are local files; no telemetry or external calls.

## What Geval does not do

- No governance API, auth, or dashboards
- No databases or remote storage
- No telemetry collection

Auditing is done via version control (policy, approval scripts), artifact retention (e.g. CI artifacts for `.geval/decisions/`), and your own logging of who ran `geval approve` and when.
