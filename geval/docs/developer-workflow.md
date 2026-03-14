# Daily Developer Workflow

Typical flow when using Geval to gate AI system changes.

## 1. Developer changes the AI system

You change prompts, model config, retrieval, or any component that affects evals or signals.

## 2. Open a PR

CI runs your eval pipeline and then Geval.

## 3. CI runs Geval

- Signals are produced (e.g. by `scripts/generate_signals.py` or your eval tooling).
- Geval evaluates: `geval check --signals signals.json --policy policy.yaml --env prod`.

## 4. Outcomes

| Outcome            | Meaning                  | What to do                    |
|--------------------|--------------------------|-------------------------------|
| **PASS**           | No rule blocked          | Merge allowed                 |
| **REQUIRE_APPROVAL** | A rule required approval | Get human approval, then re-run |
| **BLOCK**          | A rule blocked           | Fix the cause, then re-run    |

## 5. If REQUIRE_APPROVAL

A human reviews and either:

- **Approve**  
  ```bash
  geval approve --reason "Edge case acceptable"
  ```  
  CI can then treat the run as pass (e.g. re-run check after approval artifact is present).

- **Reject**  
  ```bash
  geval reject --reason "Regression not acceptable"
  ```  
  Developer must fix and push again.

## 6. Accountability

- Policies are version-controlled.
- Approvals/rejections are explicit commands with reasons.
- Decision artifacts under `.geval/decisions/<timestamp>.json` are immutable and include policy/signal hashes.

Geval does not run evals, call external APIs, or store data remotely; it only consumes signals and policy and produces a local decision and artifacts.
