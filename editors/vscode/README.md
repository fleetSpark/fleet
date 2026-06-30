# FleetSpark for VS Code

Sidebar mission board, ship health, and command palette integration for
[FleetSpark](https://fleetspark.dev) multi-agent orchestration.

## Features

- **Missions view** — live mission board (id, branch, status, ship) with
  status icons and rich tooltips, refreshed from `fleet status --json`.
- **Ship Health view** — missions grouped by ship with active/idle indicators.
- **Command palette** —
  - `FleetSpark: Show Status`
  - `FleetSpark: Plan Missions…` (prompts for a goal → `fleet command --plan`)
  - `FleetSpark: Generate Report` (`fleet report`)
  - `FleetSpark: Show Outcomes` (`fleet outcomes`)
  - `FleetSpark: Replay Mission…` (quick-pick → `fleet replay <id>`)
  - `FleetSpark: Refresh`

## Requirements

The `fleet` CLI must be installed and on your `PATH` (or set
`fleetspark.cliPath`). The extension shells out to the CLI in the open
workspace folder — no separate API or daemon.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `fleetspark.cliPath` | `fleet` | Path to the fleet CLI executable. |
| `fleetspark.refreshIntervalSeconds` | `30` | Mission board auto-refresh interval. |

## Development

```bash
cd editors/vscode
npm install
npm run build      # tsc → dist/
# Press F5 in VS Code to launch an Extension Development Host.
```
