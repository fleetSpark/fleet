# fleetspark.dev — Website Design Spec

> Landing page + documentation site for the Fleet open source project.
> Hosted on GitHub Pages at fleetspark.dev.

---

## 1. Overview

Fleet is an open source multi-machine orchestration tool for AI coding agents. The website serves two purposes:

1. **Landing page** — explain what Fleet is, show the value proposition, drive visitors to the GitHub repo
2. **Documentation** — protocol spec, adapter guide, configuration reference, getting started guide

The site grows alongside the project. Pages are only added when the features they document exist.

### Relationship to drsti.ai

Fleet is independent open source. The only reference to drsti.ai is a subtle footer line: "Built by the team behind [drsti.ai](https://drsti.ai)".

---

## 2. Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Framework | Astro + Starlight | Purpose-built for docs, markdown-native, fast, free |
| Hosting | GitHub Pages | Free, deploys from the same repo, supports custom domains |
| CI/CD | GitHub Actions | Auto-build and deploy on push to main |
| Domain | fleetspark.dev | Already purchased, pointed at GitHub Pages via CNAME |
| Styling | Starlight dark theme + custom CSS overrides | Matches Fleet's dark + electric brand |

### Why Astro + Starlight

- Zero cost to host and maintain
- Docs are plain `.md` files — contributors update docs the same way they update code
- Auto-generated sidebar from file structure (no config updates when adding pages)
- Built-in search, dark mode, mobile responsiveness, i18n support
- Static output — fast, no server needed

---

## 3. Site Structure

```
fleetspark.dev/
├── /                          Landing page (custom Astro component)
├── /docs/getting-started      Quick start guide
├── /docs/protocol             Protocol spec (from protocol.md)
├── /docs/adapters             Adapter guide (from adapters.md)
├── /docs/configuration        Configuration reference
└── /docs/contributing         Contributing guide (from CONTRIBUTING.md)
```

### File structure in repo

```
website/                       # Astro project root (keeps site separate from Fleet source)
├── astro.config.mjs
├── package.json
├── src/
│   ├── assets/
│   │   └── logo.svg           # Fleet logo (from docs/images/)
│   ├── components/
│   │   └── Landing.astro      # Custom landing page component
│   ├── content/
│   │   └── docs/
│   │       ├── getting-started.md
│   │       ├── protocol.md
│   │       ├── adapters.md
│   │       ├── configuration.md
│   │       └── contributing.md
│   └── styles/
│       └── custom.css         # Brand overrides (colors, fonts, glow effects)
├── public/
│   └── CNAME                  # fleetspark.dev
└── .github/
    └── workflows/
        └── deploy.yml         # GitHub Actions: build + deploy to Pages
```

### Why a `website/` subdirectory

Fleet's root will eventually contain the CLI source code (`src/`, `package.json`, `bin/`, etc.). Keeping the website in its own directory avoids conflicts — the website has its own `package.json`, its own build, and its own deploy pipeline. The CLI and website are independent concerns.

---

## 4. Visual Identity

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0a0e17` | Page background, hero |
| Surface | `#111827` | Cards, code blocks |
| Border | `#1a2035` | Subtle borders |
| Accent primary | `#facc15` | ⚡ spark, CTAs, highlights |
| Accent secondary | `#38bdf8` | Links, hover states |
| Text primary | `#f1f5f9` | Body text |
| Text muted | `#64748b` | Secondary text |

### Typography

- **Headings:** System sans-serif stack (Inter if available)
- **Code / commands:** Monospace (JetBrains Mono or system monospace)
- **Body:** System sans-serif stack

### Effects

- Terminal-styled code blocks with subtle border glow (`#facc15` at low opacity)
- No heavy animations — fast load, no layout shift

---

## 5. Landing Page Design

### Section 1: Hero

```
┌──────────────────────────────────────────────────┐
│                                                  │
│              fleet ⚡                             │
│                                                  │
│        Steroids for AI coding.                   │
│                                                  │
│  Your laptop is running Claude Code.             │
│  Your desktop is idle.                           │
│  Three machines. One codebase. None coordinated. │
│  Fleet fixes that.                               │
│                                                  │
│  ┌──────────────────────────────────┐            │
│  │ $ npx fleet init                │            │
│  │ $ npx fleet command --plan ...  │            │
│  └──────────────────────────────────┘            │
│                                                  │
│  [⭐ Star on GitHub]   [Read the Docs →]         │
│                                                  │
└──────────────────────────────────────────────────┘
```

- GitHub star count badge (dynamic via shields.io or GitHub API)
- Two CTAs: GitHub repo link + docs link

### Section 2: How It Works

The Map/Reduce explanation with a visual diagram:

```
┌──────────────────────────────────────────────────┐
│  How it works                                    │
│                                                  │
│  Fleet is a Map-Reduce system for development.   │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Your laptop (commander)                    │ │
│  │      │                                      │ │
│  │      ├── FLEET.md on main                   │ │
│  │      │                                      │ │
│  │  GitHub (message bus)                       │ │
│  │      │                                      │ │
│  │      ├── Machine B → feature/auth           │ │
│  │      ├── Machine C → feature/ratelimiter    │ │
│  │      └── EC2       → feature/docs           │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  Map: Ships execute independently on branches.   │
│  Reduce: Commander validates and merges.         │
│  GitHub is the bus. No SSH. No shared filesystem.│
│                                                  │
└──────────────────────────────────────────────────┘
```

### Section 3: Spark Execution

Three cards for the three speed optimizations:

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ ⚡ Parallel   │ │ 👥 Shadow    │ │ 📋 Fleet     │
│ DAG Dispatch │ │ Dispatch     │ │ Brief        │
│              │ │              │ │              │
│ Independent  │ │ Stalled?     │ │ One analysis │
│ missions     │ │ Clone to a   │ │ pass. Every  │
│ start        │ │ spare. First │ │ ship skips   │
│ immediately. │ │ to finish    │ │ the 15-turn  │
│              │ │ wins.        │ │ exploration. │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Section 4: Comparison Table

The existing README comparison table (Fleet vs Claude Code vs Codex vs GitHub Agent HQ), styled as a feature matrix with checkmarks.

### Section 5: Quick Start

Terminal-styled code block:

```bash
# Install
npm install -g fleet

# Initialise any git repo
cd your-project
fleet init

# Plan your work
fleet command --plan "Add OAuth, fix rate limiter, update docs"

# On any other machine
fleet ship --join git@github.com:you/your-project.git
```

### Section 6: Footer

```
┌──────────────────────────────────────────────────┐
│  fleet ⚡  ·  MIT License                         │
│  GitHub  ·  Docs  ·  Contributing                │
│                                                  │
│  Built by the team behind drsti.ai               │
└──────────────────────────────────────────────────┘
```

---

## 6. Documentation Pages

### Content source

Docs content is authored directly in `website/src/content/docs/`. For the initial launch, content is adapted from the existing repo markdown files:

| Doc page | Source | Notes |
|----------|--------|-------|
| Getting Started | README.md quick start section | Expanded with prerequisites, verification steps |
| Protocol | protocol.md | Adapted to Starlight format with frontmatter |
| Adapters | adapters.md | Adapted to Starlight format with frontmatter |
| Configuration | README.md config section | Expanded into full reference |
| Contributing | CONTRIBUTING.md | Adapted to Starlight format |

### Sidebar structure

```yaml
sidebar:
  - label: Getting Started
    link: /docs/getting-started
  - label: Concepts
    items:
      - label: Protocol
        link: /docs/protocol
      - label: Adapters
        link: /docs/adapters
  - label: Reference
    items:
      - label: Configuration
        link: /docs/configuration
  - label: Contributing
    link: /docs/contributing
```

### Growth strategy

As Fleet develops, new doc pages are added by dropping `.md` files into `website/src/content/docs/`. Starlight auto-generates navigation. No config changes needed for simple additions; sidebar config is only updated when grouping/ordering matters.

| Project milestone | Docs additions |
|---|---|
| CLI v0.1 (init, status, ship) | Getting Started gets real install + verification |
| Adapters shipping | Per-adapter pages with real usage examples |
| Commander loop working | Commander guide, troubleshooting |
| v1.0 | Full CLI reference, changelog, FAQ |

---

## 7. Deployment Pipeline

### GitHub Actions workflow

Trigger: push to `main` branch, changes in `website/` directory.

Steps:
1. Checkout repo
2. Install Node.js 20
3. `cd website && npm ci`
4. `npm run build`
5. Deploy `website/dist/` to GitHub Pages

### Domain setup

1. In repo Settings → Pages → Custom domain: `fleetspark.dev`
2. DNS records at domain registrar:
   - `CNAME` record: `fleetspark.dev` → `fleetspark.github.io`
   - Or `A` records pointing to GitHub Pages IPs (for apex domain)
3. `public/CNAME` file containing `fleetspark.dev` (included in build output)
4. Enforce HTTPS (GitHub Pages setting)

---

## 8. What We Build Now vs Later

### Now (initial launch)

- Astro + Starlight project in `website/`
- Custom landing page with all 6 sections
- 5 doc pages adapted from existing markdown
- GitHub Actions deploy pipeline
- Custom dark theme with Fleet brand colors
- `CNAME` for fleetspark.dev

### Later (as project develops)

- Real CLI install instructions (when npm package exists)
- Per-adapter doc pages with usage examples
- Blog/changelog section
- Search (Starlight has built-in Pagefind — enable when docs grow)
- OpenGraph/social cards for link previews

---

## 9. Out of Scope

- No analytics (can add Plausible later if wanted)
- No CMS — markdown files in Git are the CMS
- No server-side functionality — purely static
- No drsti.ai integration beyond footer link
- No i18n — English only for now
- No custom domain email
