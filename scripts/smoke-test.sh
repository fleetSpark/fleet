#!/usr/bin/env bash
set -euo pipefail

# Fleet v0.2 Smoke Test
# Runs a real end-to-end test with Claude Code adapter.
# Prerequisites: gh CLI authenticated, ANTHROPIC_API_KEY set, fleetspark built
#
# Usage: npm run test:smoke

REPO_NAME="fleet-smoke-test-$(date +%s)"
CLEANUP_NEEDED=false

cleanup() {
  if [ "$CLEANUP_NEEDED" = true ]; then
    echo "Cleaning up..."
    gh repo delete "$REPO_NAME" --yes 2>/dev/null || true
    rm -rf "/tmp/$REPO_NAME" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "=== Fleet Smoke Test ==="
echo ""

# Check prerequisites
command -v gh >/dev/null 2>&1 || { echo "ERROR: gh CLI not installed"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: node not installed"; exit 1; }
[ -n "${ANTHROPIC_API_KEY:-}" ] || { echo "ERROR: ANTHROPIC_API_KEY not set"; exit 1; }

# Create test repo
echo "1. Creating test repo: $REPO_NAME"
gh repo create "$REPO_NAME" --private --clone --add-readme
CLEANUP_NEEDED=true
cd "$REPO_NAME"

# Create a simple task for the agent
cat > task.md << 'TASK'
Create a file called hello.ts that exports a function greet(name: string): string
which returns Hello, ${name}!. Include a test file hello.test.ts that verifies
the function works correctly.
TASK

git add task.md
git commit -m "add task description"
git push

# Init fleet
echo "2. Initializing fleet..."
npx fleetspark init

# Create plan file
cat > plan.yml << 'PLAN'
missions:
  - id: M1
    branch: feature/hello
    brief: "Create hello.ts with greet function and hello.test.ts with tests. Read task.md for details."
    agent: claude-code
PLAN

# Start commander
echo "3. Starting commander with plan..."
npx fleetspark command --plan-file plan.yml &
COMMANDER_PID=$!

# Wait for FLEET.md to be created
sleep 5

# Start ship
echo "4. Starting ship..."
REPO_URL=$(gh repo view --json url -q .url)
npx fleetspark ship --join "$REPO_URL" &
SHIP_PID=$!

# Wait for completion (timeout: 5 minutes)
echo "5. Waiting for completion (timeout: 5m)..."
TIMEOUT=300
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  sleep 10
  ELAPSED=$((ELAPSED + 10))
  STATUS=$(git show origin/fleet/state:FLEET.md 2>/dev/null | grep "M1" | grep -o "completed\|merged" || true)
  if [ -n "$STATUS" ]; then
    echo "   Mission M1: $STATUS (${ELAPSED}s)"
    break
  fi
  echo "   Still running... (${ELAPSED}s)"
done

# Kill background processes
kill $COMMANDER_PID 2>/dev/null || true
kill $SHIP_PID 2>/dev/null || true

# Validate
echo ""
echo "6. Validation:"
if [ -n "$STATUS" ]; then
  echo "   PASS: Mission completed successfully"
  if git show origin/feature/hello:hello.ts >/dev/null 2>&1; then
    echo "   PASS: hello.ts created on feature branch"
  else
    echo "   FAIL: hello.ts not found on feature branch"
  fi
else
  echo "   FAIL: Mission did not complete within timeout"
  exit 1
fi

echo ""
echo "=== Smoke test passed ==="
