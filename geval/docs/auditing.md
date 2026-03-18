# Accountability and Auditing

Geval is designed so **nothing is unversioned**: every decision and every action is auditable. Auditors can answer:

- **Why was this deployed?** – Decision report and matched rule (and optional approval reason).
- **Who approved it?** – `geval approve` writes an artifact with `approved_by`, `reason`, and artifact `version`.
- **What policy (contract) was used?** – Artifact stores `policy_name`, `policy_version`, and `policy_hash` (SHA256).
- **What signals were used?** – Artifact stores `signals_name`, `signals_version`, and `signals_hash` (SHA256).
- **Which Geval binary?** – Artifact stores `geval_version`.

**Rule of thumb:** When you change policy or signals, bump their `version` so every decision is tied to a specific version. No update without a version update.

## Artifacts

### Decision artifact

Each `geval check` run writes:

- **Path:** `.geval/decisions/<timestamp>.json`
- **Contents (artifact_version 2, contract-centric):**
  - `artifact_version` – schema version (e.g. `"2"`)
  - `geval_version` – binary version that produced the decision
  - `contract_name`, `contract_version`, `contract_hash` – contract identity and content hash
  - `signals_name`, `signals_version`, `signals_hash` – signals identity and content hash
  - `combine_rule` – how policy outcomes were merged (e.g. `all_pass`, `any_block_blocks`)
  - `policy_results` – array of `{ policy_path, policy_name?, policy_version?, policy_hash, outcome, matched_rule? }` for each policy
  - `combined_decision` – final outcome (PASS | REQUIRE_APPROVAL | BLOCK)
  - `combined_matched_rule` – first non-PASS policy and rule (if any)
  - `timestamp` – ISO8601
  - `approval` – optional; set when an approval is recorded for this decision

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
