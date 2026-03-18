# Signals and rules: non-uniform inputs, one framework

Geval is a **decision orchestration and reconciliation** engine. It takes **all kinds of signals** (scores, flags, presence-only, categories) and **your rules**, and reconciles them into one outcome. It doesn't decide — it applies your rules. You don’t have to force every signal into a number.

**Assumptions and accepted input:** We accept **any JSON value** in each signal's `value` (number, string, decimal, percentage as number, trace, complex object). For **rule matching**, only **numeric** values are used in threshold rules (`>`, `<`, etc.); everything else (including no value) is used for **presence** and display. See [Signal assumptions and accepted input](signal-assumptions.md) for details.

## What counts as a signal

Each signal is one row of evidence. All of these are valid in the same file:

- **Numeric:** `{"metric": "accuracy", "value": 0.94}` — has a score.
- **Presence-only:** `{"metric": "human_reviewed"}` or `{"metric": "human_reviewed", "value": null}` — no score; the fact that the metric exists is what matters.
- **With context:** `{"component": "retrieval", "metric": "context_relevance", "value": 0.85}` — same metric can appear per component.
- **Categorical (string):** `{"metric": "review", "value": "approved"}` — stored; rule support for “equals string” can be added.

You can mix these in one `signals.json`. Geval does not require every signal to have a `value`, or to be numeric.

**Versioning (audit):** At the top of the signals file you can set `name` and `version` (e.g. `"name": "ci-signals"`, `"version": "1.0.0"`). Bump `version` when your pipeline or schema changes so every decision records which signals version was used.

## How rules use them

Rules only need a **metric** (and optionally **component**) in the `when` block. Then:

| Rule operator   | What it uses                    | Signal without value? |
|-----------------|---------------------------------|------------------------|
| **presence**    | “Is there any signal for this metric?” | Yes — matches.         |
| **>**, **<**, **>=**, **<=**, **==** | First **numeric** value for that metric (and component). | No — that metric is ignored for this rule (no match). |

So:

- **Signals without scores** are still useful: use a rule with `operator: presence`. Example: “If `human_reviewed` is present → require_approval.”
- **Signals with scores** use the usual comparison operators. Example: “If `accuracy` &lt; 0.9 → block.”
- You can combine both in one policy: some rules key off presence, others off numeric thresholds.

## Example: mixed signals

**signals.json:**

```json
{
  "name": "my-signals",
  "version": "1.0.0",
  "signals": [
    { "metric": "accuracy", "value": 0.92 },
    { "metric": "human_reviewed" },
    { "component": "generator", "metric": "hallucination_rate", "value": 0.03 }
  ]
}
```

**policy.yaml (contract):** Use top-level `name` and `version` to identify the contract; bump version when you change rules.

```yaml
name: release-gate
version: "1.0.0"
policy:
  rules:
    - priority: 1
      name: need_review
      when:
        metric: human_reviewed
        operator: presence
      then:
        action: require_approval
    - priority: 2
      name: block_low_accuracy
      when:
        metric: accuracy
        operator: "<"
        threshold: 0.9
      then:
        action: block
```

Here, `human_reviewed` has no value; the first rule only checks that it exists. The second rule uses the numeric `accuracy` value. One framework, non-uniform signals, one decision.
