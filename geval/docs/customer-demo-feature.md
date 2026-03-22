# Customer demo: one feature, end-to-end

Use this as a **single story** you can walk through with a buyer: a real-ish **feature release** (“Support Copilot answer upgrade”), **why each signal exists**, **why policies are split**, **what rules actually look like**, and **how PASS / BLOCK / REQUIRE_APPROVAL** fall out.

---

## 1. The feature (one sentence)

> **You’re about to ship an upgrade to the answer-generation path** (new model + retrieval tweak). Before merge/deploy, you want **product quality**, **safety**, and **business impact** checked **the same way every time**—not re-argued in Slack.

Everything below supports explaining **that** gate.

---

## 2. Signals to include — and what to tell the customer

These are **inputs** (your pipeline or eval harness writes one `signals.json` per run). Mix **numbers** and **presence** so you can say: *“Geval handles non-uniform evidence in one file.”*

| Signal (metric) | Typical `value` | Why it resonates |
|-----------------|-------------------|------------------|
| **`context_relevance`** (component: `retrieval`) | e.g. `0.88` | “Are we pulling the **right** docs before we answer?” Everyone gets **bad answers from bad retrieval**. |
| **`hallucination_rate`** (component: `generator`) | e.g. `0.04` | “Is the model **making things up**?” Safety and trust; legal/comms care. |
| **`answer_correctness_score`** | e.g. `0.82` | “On our **gold** Q&A set, are answers **factually** right?” Classic product/ML quality bar. |
| **`engagement_drop`** | e.g. `0.01` or `0.03` | “Did A/B or holdout show **users engaging less**?” Ties ML to **revenue / product**—execs notice. |
| **`human_review_sampled`** | *presence only* (no value OK) | “Did we at least **run** a human spot-check this release?” Governance: **process** signal, not a score. |
| **`incident_severity_max`** | e.g. `0` | “Any **sev-1/2** linked to this build in the window?” Ops/incident language people already use. |

**Customer line:**  
*“These aren’t Geval-specific—they’re the same facts you’d put in a deck or a meeting; Geval just reads one JSON so the **bar is explicit**.”*

---

## 3. Policies — meaningful split (and what to say)

Use **separate policy files** so **ownership** is clear (security vs product vs business). The **contract** lists them and sets **`combine: all_pass`** so: *every policy must pass; any BLOCK wins; REQUIRE_APPROVAL without BLOCK means “needs a human”.*

| Policy file | Owner (story) | Why separate |
|-------------|---------------|--------------|
| **`policies/safety.yaml`** | Safety / platform | “**Hard lines**—if we hurt trust or ship after a bad incident, we stop.” Easy to audit. |
| **`policies/product_quality.yaml`** | Product / ML | “**Quality** on retrieval, generator, and factual correctness.” Changes often; different reviewers than safety. |
| **`policies/business_risk.yaml`** | Product lead / GM | “**Business** and **process**—engagement, human review present.” Connects model metrics to outcomes. |

**Customer line:**  
*“You don’t cram everything into one file. Each team owns a policy; the **contract** says how results combine—like having three reviewers, but **encoded**.”*

---

## 4. Rules customers actually write (examples + why)

Rules are **ordered**; **first match wins**. Priorities below are **intentional** (stop fast on catastrophes, then quality, then business).

### 4.1 `policies/safety.yaml`

| Priority | Name | Plain English | Why customers write it |
|----------|------|---------------|-------------------------|
| 1 | `block_after_severe_incident` | If `incident_severity_max` ≥ 1 → **BLOCK** | “No shipping on top of a **live fire**.” |
| 2 | `block_high_hallucination` | If `hallucination_rate` > 0.05 → **BLOCK** | Industry talks about **hallucination caps**; easy to justify. |

### 4.2 `policies/product_quality.yaml`

| Priority | Name | Plain English | Why customers write it |
|----------|------|---------------|-------------------------|
| 1 | `block_poor_retrieval` | If retrieval `context_relevance` < 0.80 → **BLOCK** | Below this, answers are **untrustworthy** even if the model is fancy. |
| 2 | `require_approval_marginal_retrieval` | If relevance between 0.80 and 0.85 → **REQUIRE_APPROVAL** | **Yellow zone**: ship only if someone **signs off**. |
| 3 | `block_low_correctness` | If `answer_correctness_score` < 0.78 → **BLOCK** | Tied to **labeled eval**—defensible with product. |

### 4.3 `policies/business_risk.yaml`

| Priority | Name | Plain English | Why customers write it |
|----------|------|---------------|-------------------------|
| 1 | `block_engagement_regression` | If `engagement_drop` > 0 → **BLOCK** | Same idea as your demo: **business guardrail**. |
| 2 | `require_approval_if_no_human_review` | If `human_review_sampled` **not present** → **REQUIRE_APPROVAL** | “We said we’d **spot-check**; prove it or get approval.” |

---

## 5. Contract (how it ties together)

```yaml
name: support-copilot-release-gate
version: "1.0.0"
combine: all_pass
policies:
  - path: policies/safety.yaml
  - path: policies/product_quality.yaml
  - path: policies/business_risk.yaml
```

**Customer line:**  
*`all_pass`* means: every policy must end in PASS for an overall PASS; any policy BLOCK → overall BLOCK; if no BLOCK but something needs approval → overall REQUIRE_APPROVAL.

---

## 6. End-to-end: what happens (no implementation jargon)

1. **CI (or a human) runs** your evals and **writes `signals.json`** with the metrics above (and optional `name` / `version` on the file for audit).
2. **Geval loads** the contract → loads the three policies → builds a small **lookup** from signals.
3. **Per policy**, rules run in **priority order**; the **first** rule whose `when` matches decides that policy’s outcome.
4. **Per policy outcomes** are merged with the contract’s **`combine`** rule → **one** outcome for the run.
5. **Geval exits** with 0 / 1 / 2 and can write a **decision artifact** (who/what/when + hashes).

**Customer line:**  
*“Same inputs + same rules → same answer. The meeting isn’t where the bar is defined—the **repo** is.”*

---

## 7. Three demo scenarios (flip one signal, tell a story)

### Scenario A — **PASS** (green path)

- Relevance **0.88**, hallucination **0.04**, correctness **0.85**, engagement_drop **0**, incidents **0**, **`human_review_sampled`** present.
- **Story:** “We’re inside guardrails; spot-check done; no business regression.”

### Scenario B — **BLOCK** (hard stop)

- Set **`engagement_drop`** to **0.04** (or hallucination **0.08**, or relevance **0.75**—pick **one** for the demo).
- **Story:** “The bar fired **before** merge—this is exactly the Slack argument, **encoded**.”

### Scenario C — **REQUIRE_APPROVAL** (yellow path)

- Relevance **0.82** (between 0.80 and 0.85), everything else OK, human review present.
- **Story:** “Not automatically bad, not automatically good—**someone with authority** must say OK.”

---

## 8. One-liner recap for the customer

| Layer | One line |
|-------|-----------|
| **Signals** | “The facts from **this** run, in **one** place.” |
| **Policies** | “**Who owns** which bar (safety / quality / business).” |
| **Rules** | “**If** the data looks like **this**, **then** we pass, block, or ask a human.” |
| **Contract** | “**How** those team bars combine into **one** release decision.” |
| **Geval** | “Runs that logic **every time**, **deterministically**, with a **record**.” |

---

## 9. Optional: link to tooling

- Generate YAML from forms: **[config.geval.io](https://config.geval.io)**  
- Deeper signal semantics: [signals-and-rules.md](signals-and-rules.md)  
- Architecture / stakeholder diagrams: [architecture.md](architecture.md) (customer-facing section)
