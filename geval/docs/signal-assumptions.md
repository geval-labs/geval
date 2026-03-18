# Signal assumptions and accepted input

This document states what Geval **assumes** about `signals.json` and what **input forms** it accepts. Use it to decide how to shape your pipeline output and what to expect from rule matching.

## Assumptions when considering signals

1. **Signals are facts, not computed by Geval.**  
   Geval does not validate, aggregate, or derive signals. It only **loads** them and **matches rules** against them. Your pipeline (eval framework, CI, script) is responsible for producing correct values.

2. **Same metric can appear multiple times** (e.g. per component).  
   Rules can scope by optional `component` (and in the model, `system`, `agent`, `step`). For threshold rules we use the **first** matching numeric value for (metric, component). Duplicates for the same (metric, component) are not aggregated—first wins.

3. **No semantic interpretation of units.**  
   Numbers are just numbers. We do not treat `0.85` as “85%” or “percentage” differently from `85`. If your metric is “percentage”, produce a number (e.g. 0–1 or 0–100) and write rules against that scale consistently.

4. **Order of signals in the file is preserved** for reporting and for “first value” lookup. We do not guarantee a specific order when multiple signals share the same metric/component; we take the first one we indexed.

5. **Policy defines the meaning.**  
   Rules define which metrics and operators matter. Signals that are not referenced by any rule are still loaded and appear in reports but do not affect the decision (except that they are part of the content hash for audit).

---

## Are we accepting all kinds of inputs?

**Yes, for loading.** The `value` field of each signal is **optional** and can be **any valid JSON value**:

- **Number** (integer or decimal): `0`, `1`, `0.94`, `120`, `0.5`
- **String**: `"approved"`, `"v1.2"`
- **Boolean**: `true`, `false`
- **Null**: `null` (or omit `value`)
- **Array**: `[1, 2, 3]`, `["a", "b"]`
- **Object**: `{"latency_ms": 10, "p99": 50}`, trace objects, nested structures

So **any form** — trace, string, number, decimal, percentage (as a number), or complex object — is **accepted** and stored. The file must still be valid JSON and the top-level structure must be either `{ "signals": [ ... ] }` (with optional `name`, `version`) or a raw array of signal objects.

---

## How each input form is used today

| Form | Loaded? | Presence? | Threshold rules (`>`, `<`, `>=`, `<=`, `==`)? | Display / report? |
|------|---------|-----------|-------------------------------------------------|--------------------|
| **Missing / null** | Yes | Yes | No (rule sees “no value”) | Yes (shown as —) |
| **Number** (int or decimal) | Yes | Yes | **Yes** — used for comparison | Yes |
| **String** | Yes | Yes | **No** (not yet) | Yes |
| **Boolean** | Yes | Yes | No | Yes (as JSON) |
| **Array** | Yes | Yes | No | Yes (as JSON) |
| **Object** (incl. trace) | Yes | Yes | No | Yes (as JSON) |

- **Presence:** For **any** of these, if the signal has a `metric` (and optional `component`), a rule with `operator: presence` will match when that metric (and component) exists.
- **Threshold rules:** Only **numeric** `value` (JSON number → f64) is used. String, boolean, array, and object are **not** used for `>`, `<`, `>=`, `<=`, `==`. So:
  - **Decimal:** Treated as a number; fully supported.
  - **Percentage:** If you pass it as a number (e.g. 0.85 or 85), it works like any other number; we don’t interpret “%” in the value.
  - **Trace / complex object:** Accepted and stored; they contribute to **presence** and appear in the report, but no threshold rule uses them today. To use them in rules you’d need to either flatten to a numeric signal in your pipeline or extend Geval (e.g. custom operators or extractors).

---

## Summary

- **Assumptions:** Signals are pre-produced facts; first value per (metric, component) for numeric rules; no unit semantics; policy defines what matters.
- **Accept:** All JSON value types in `value` (number, string, boolean, null, array, object). So yes — **any kind of input in any form** is accepted at load time.
- **Use in rules:**  
  - **Numeric** → threshold comparisons.  
  - **Anything else (including no value)** → presence only (and display).  
  - **String equality** and **complex object** in rules are not supported yet; they are accepted as input and can be added later (see [extending.md](extending.md)).

If you need to drive decisions from traces or complex objects today, produce **derived numeric or presence-only signals** in your pipeline and feed those into Geval (e.g. `metric: "trace_has_error"`, `value: 1` or presence-only).
