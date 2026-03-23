---
title: FAQ
description: Frequently asked questions about Fleet.
---

## General

### What is Fleet?

Fleet orchestrates AI coding agents across multiple machines. You give it a goal, it breaks it into parallel tasks, dispatches them to your machines, and merges the results. Think of it as a Map-Reduce system for software development.

### How is this different from just running Claude Code on one machine?

One machine, one agent, one task at a time. With Fleet, you use every machine you own — laptop, desktop, home server, cloud VM — all working on different parts of the same project simultaneously. A 6-hour job becomes a 1-hour job across 6 machines.

### Do I need powerful machines?

No. Fleet itself is lightweight (Node.js). The coding agents (Claude Code, Codex, etc.) have their own requirements, but most run fine on any modern machine. The key insight is that idle machines are wasted machines.

### Is it free?

Fleet is free and open source (MIT license). You'll need API keys for the coding agents you use (Claude, OpenAI, etc.), which have their own pricing.

---

## How it works

### How do the machines communicate?

**Git is the only message bus.** There's no SSH, no shared filesystem, no websockets, no central server. Every machine pushes and pulls from the same GitHub repo. If a machine can `git push`, it can join the fleet.

### What if a machine crashes or goes offline?

The commander monitors heartbeats — each ship pushes a status update every 60 seconds. If a ship stops responding:
- After **10 minutes**: marked as stale (warning)
- After **30 minutes**: marked as dead, mission transitions to stalled
- If **shadow dispatch** is enabled: the mission is automatically re-assigned to another ship

### What about merge conflicts?

Fleet has built-in conflict detection. Before creating a PR, it checks file overlap between active branches. If conflicts exist, they're noted in the PR body. The merge commander can attempt auto-rebase, or flag it for human review.

### Can two ships accidentally work on the same task?

This is a known edge case with git-based coordination. In practice it's rare because the commander assigns missions atomically. If it does happen, you'll see two PRs for the same mission — just close the duplicate.

### Does Fleet merge code automatically?

Fleet creates PRs and can auto-merge them **only if CI passes and there are no conflicts**. You can configure `ci_required: true` (default) to ensure all automated checks pass before any merge happens. You're always in control.

---

## Setup & usage

### What do I need to get started?

1. **Node.js 18+** on every machine
2. **Git** with push access to a GitHub repository
3. A **coding agent** installed on each machine (Claude Code, Codex, Aider, OpenCode, Gemini CLI, Cursor, Amp, or any A2A-compatible agent)
4. API keys for your chosen agent(s)

### Which coding agents are supported?

Fleet ships with adapters for:
- **Claude Code** — Anthropic's coding agent
- **Codex** — OpenAI's coding agent
- **Aider** — open source AI pair programming
- **OpenCode** — open source coding agent
- **Gemini CLI** — Google's Gemini coding agent
- **Cursor** — Cursor's AI coding agent
- **Amp** — Sourcegraph's coding agent
- **A2A** — any agent supporting Google's Agent-to-Agent protocol

You can also [write your own adapter](/adapters/) — it's about 30 lines of TypeScript.

### Can I mix different agents in the same fleet?

Yes! Each ship can run a different agent. You might run Claude Code on your powerful desktop and Aider on your laptop. Configure per-ship in `.fleet/config.yml`:

```yaml
ships:
  - id: desktop
    adapter: claude-code
  - id: laptop
    adapter: aider
```

### How do I monitor progress?

Three options:
- **`fleet status --watch`** — simple terminal output, refreshes every 5 seconds
- **`fleet dashboard`** — interactive TUI with mission board, ship health, merge queue, and log viewer
- **`fleet status --json`** — machine-readable output for custom integrations

### Can I check progress from my phone?

Yes! Run `fleet web` to start the browser-based dashboard. It shows the mission board, ship health, merge queue, and mission logs in real time. The command prints both local and LAN URLs, so you can open it on any device — including your phone.

---

## Architecture

### Why Git as the message bus?

1. **Zero infrastructure** — no server to run, no ports to open, no VPN needed
2. **Works everywhere** — any machine with git access can participate
3. **Built-in history** — every state change is a git commit, fully auditable
4. **Resilient** — if the commander crashes, state is preserved in git. Any machine can resume.

### What's the fleet/state branch?

It's an orphan branch (never merged to main) that holds `FLEET.md` — the coordination manifest. The commander writes to it, ships read from it. Think of it as a shared bulletin board.

### What if the commander machine crashes?

Fleet has a commander election protocol. If the active commander stops sending heartbeats, any other machine running `fleet command --resume` can claim leadership. The full fleet state is in git, so the new commander picks up exactly where the old one left off.

### Is this safe for production code?

Fleet never pushes directly to `main`. Every mission works on its own branch. Changes only reach `main` through PRs that pass CI. You can review every PR before it merges, or configure auto-merge for trusted workflows.

---

## Contributing

### How can I contribute?

The easiest way is to **write an adapter** for a new coding agent. It's ~30 lines of TypeScript, self-contained, and high-impact. See the [contributing guide](https://github.com/fleetSpark/fleet/blob/main/CONTRIBUTING.md) and [adapter docs](/adapters/).

### I found a bug — what do I do?

Open an issue using the [bug report template](https://github.com/fleetSpark/fleet/issues/new?template=bug_report.md). Include your OS, Node version, Fleet version, and any error output.

### Can I use Fleet with GitLab or Bitbucket?

Not yet — PR creation and CI checking currently use the GitHub CLI (`gh`). Git provider abstraction is on the roadmap. The core protocol (FLEET.md, MISSION.md, git branches) works with any git host, but the merge automation is GitHub-specific for now.
