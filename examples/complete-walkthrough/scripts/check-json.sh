#!/bin/bash

# Geval CLI Example
# Demonstrates basic CLI usage with JSON eval results

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "🧪 Geval CLI Examples"
echo "========================================"
echo

# Step 1: Validate the contract
echo "📄 Step 1: Validating contract..."
echo "Command: geval validate contracts/quality-contract.yaml"
echo
npx geval validate "$EXAMPLE_DIR/contracts/quality-contract.yaml"
echo
echo "✅ Contract is valid!"
echo

# Step 2: Check with passing eval results
echo "========================================"
echo "📊 Step 2: Checking PASSING eval results..."
echo "Command: geval check --contract ... --eval passing-run.json"
echo
npx geval check \
  --contract "$EXAMPLE_DIR/contracts/quality-contract.yaml" \
  --eval "$EXAMPLE_DIR/eval-results/passing-run.json" || true
echo

# Step 3: Check with failing eval results
echo "========================================"
echo "📊 Step 3: Checking FAILING eval results..."
echo "Command: geval check --contract ... --eval failing-run.json"
echo
npx geval check \
  --contract "$EXAMPLE_DIR/contracts/quality-contract.yaml" \
  --eval "$EXAMPLE_DIR/eval-results/failing-run.json" || true
echo

# Step 4: Diff between runs
echo "========================================"
echo "📈 Step 4: Comparing eval runs (diff)..."
echo "Command: geval diff --previous failing-run.json --current passing-run.json"
echo
npx geval diff \
  --previous "$EXAMPLE_DIR/eval-results/failing-run.json" \
  --current "$EXAMPLE_DIR/eval-results/passing-run.json" || true
echo

# Step 5: JSON output (for CI)
echo "========================================"
echo "🤖 Step 5: JSON output for CI integration..."
echo "Command: geval check ... --json"
echo
npx geval check \
  --contract "$EXAMPLE_DIR/contracts/quality-contract.yaml" \
  --eval "$EXAMPLE_DIR/eval-results/passing-run.json" \
  --json || true
echo

echo "========================================"
echo "✨ Examples complete!"
echo "========================================"
