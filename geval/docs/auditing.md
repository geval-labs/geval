# Accountability and Auditing

Geval is designed so auditors can answer:

- **Why was this deployed?** – Decision report and matched rule (and optional approval reason).
- **Who approved it?** – `geval approve` writes an artifact with `approved_by` and `reason`.
- **What policy was used?** – Policy is version-controlled; artifact stores `policy_hash` (SHA256).
- **What signals existed?** – Artifact stores `signals_hash` (SHA256); signals themselves are produced by your pipeline and can be archived separately.

## Artifacts

### Decision artifact

Each `geval check` run writes:

- **Path:** `.geval/decisions/<timestamp>.json`
- **Contents:**
  - `policy_hash` – SHA256 of the policy used
  - `signals_hash` – SHA256 of the signals used
  - `decision` – PASS | REQUIRE_APPROVAL | BLOCK
  - `matched_rule` – name of the rule that fired (if any)
  - `timestamp` – ISO8601
  - `approval` – optional; set when an approval is recorded for this decision

### Approval artifact

`geval approve` / `geval reject` write:

- **Path:** configurable (e.g. `.geval/approval.json`)
- **Contents:** `approved_by`, `reason`, `timestamp`, `approved` (true/false)

## Reproducibility

- **Deterministic:** Same signals + same policy → same decision.
- **Hashes:** Stored in the decision artifact so you can verify which policy and which signals were used.
- **No remote services:** All inputs and outputs are local files; no telemetry or external calls.

## What Geval does not do

- No governance API, auth, or dashboards
- No databases or remote storage
- No telemetry collection

Auditing is done via version control (policy, approval scripts), artifact retention (e.g. CI artifacts for `.geval/decisions/`), and your own logging of who ran `geval approve` and when.
