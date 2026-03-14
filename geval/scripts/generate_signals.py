#!/usr/bin/env python3
"""
Example script to generate signals.json for Geval.
Replace this with your own pipeline (eval results, A/B metrics, etc.).
Output: JSON with a "signals" array to stdout.
"""
import json
import sys

# Example: static signals for CI demo. In production, load from your eval/A/B/safety outputs.
SIGNALS = {
    "signals": [
        {"system": "support_agent", "component": "retrieval", "metric": "context_relevance", "value": 0.84},
        {"system": "support_agent", "component": "generator", "metric": "hallucination_rate", "value": 0.06},
        {"type": "ab_test", "metric": "engagement_drop", "value": 0.0},
    ]
}

if __name__ == "__main__":
    json.dump(SIGNALS, sys.stdout, indent=2)
    sys.stdout.write("\n")
