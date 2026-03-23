import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { GitOps } from '../git/git-ops.js';
import { parseFleetManifest } from '../protocol/fleet-manifest.js';
import type { Mission } from '../protocol/types.js';

export class BriefGenerator {
  constructor(private gitOps: GitOps) {}

  async generate(repoRoot: string, options: { llm?: boolean } = {}): Promise<string> {
    const sections: string[] = [];
    sections.push(`# Fleet Context`);
    sections.push(`Generated: ${new Date().toISOString()}`);
    sections.push('');

    const overview = await this.buildOverview(repoRoot);
    if (options.llm) {
      const llmNarrative = await this.getLLMNarrative(overview);
      sections.push('## Architecture overview');
      sections.push(llmNarrative);
    } else {
      sections.push('## Architecture overview');
      sections.push(overview);
    }
    sections.push('');

    const dirs = await this.getKeyDirectories(repoRoot);
    sections.push('## Key directories');
    for (const d of dirs) {
      sections.push(`- \`${d.name}/\` — ${d.description}`);
    }
    sections.push('');

    const deps = await this.getPackageDeps(repoRoot);
    if (deps) {
      sections.push('## Dependencies');
      sections.push(deps);
      sections.push('');
    }

    const conventions = await this.detectConventions(repoRoot);
    sections.push('## Coding conventions');
    sections.push(conventions);
    sections.push('');

    const counts = await this.getFileCounts(repoRoot);
    sections.push('## File counts by type');
    for (const [ext, count] of Object.entries(counts)) {
      sections.push(`- ${ext}: ${count}`);
    }
    sections.push('');

    const activeBranches = await this.getActiveBranches();
    if (activeBranches.length > 0) {
      sections.push('## Active branches');
      for (const b of activeBranches) {
        sections.push(`- \`${b.branch}\` — ${b.id} (${b.status})`);
      }
      sections.push('');
    }

    const inProgress = activeBranches.filter((b) => b.status === 'in-progress');
    if (inProgress.length > 0) {
      sections.push('## Do-not-touch');
      sections.push('These branches have active missions — do not modify files on them:');
      for (const b of inProgress) {
        sections.push(`- \`${b.branch}\` (${b.id}, ship: ${b.ship ?? 'unassigned'})`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  private async buildOverview(repoRoot: string): Promise<string> {
    const parts: string[] = [];
    try {
      const readme = await readFile(join(repoRoot, 'README.md'), 'utf-8');
      const lines = readme.split('\n').slice(0, 20);
      parts.push(lines.join('\n'));
    } catch {
      parts.push('No README.md found.');
    }
    return parts.join('\n');
  }

  private async getKeyDirectories(repoRoot: string): Promise<Array<{ name: string; description: string }>> {
    const dirs: Array<{ name: string; description: string }> = [];
    try {
      const entries = await readdir(repoRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        dirs.push({ name: entry.name, description: this.guessDirectoryPurpose(entry.name) });
      }
    } catch { /* ignore */ }
    return dirs;
  }

  private guessDirectoryPurpose(name: string): string {
    const purposes: Record<string, string> = {
      src: 'application source', lib: 'library source', test: 'test suite', tests: 'test suite',
      docs: 'documentation', scripts: 'build/utility scripts', packages: 'monorepo packages',
      website: 'documentation website', dist: 'build output', build: 'build output', config: 'configuration',
    };
    return purposes[name] ?? 'project directory';
  }

  private async getPackageDeps(repoRoot: string): Promise<string | null> {
    try {
      const raw = await readFile(join(repoRoot, 'package.json'), 'utf-8');
      const pkg = JSON.parse(raw);
      const parts: string[] = [];
      if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
        parts.push('**Runtime:** ' + Object.keys(pkg.dependencies).join(', '));
      }
      if (pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0) {
        parts.push('**Dev:** ' + Object.keys(pkg.devDependencies).join(', '));
      }
      return parts.length > 0 ? parts.join('\n') : null;
    } catch { return null; }
  }

  private async detectConventions(repoRoot: string): Promise<string> {
    const conventions: string[] = [];
    const configFiles: Record<string, string> = {
      'tsconfig.json': 'TypeScript', '.eslintrc.json': 'ESLint', '.eslintrc.js': 'ESLint',
      'eslint.config.js': 'ESLint (flat config)', '.prettierrc': 'Prettier',
      'prettier.config.js': 'Prettier', 'vitest.config.ts': 'Vitest',
      'jest.config.js': 'Jest', 'jest.config.ts': 'Jest',
    };
    for (const [file, tool] of Object.entries(configFiles)) {
      try { await stat(join(repoRoot, file)); conventions.push(`- ${tool} detected (\`${file}\`)`); } catch { /* not found */ }
    }
    return conventions.length > 0 ? conventions.join('\n') : 'No standard config files detected.';
  }

  private async getFileCounts(repoRoot: string, depth = 3): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    await this.walkDir(repoRoot, depth, (filePath) => {
      const ext = extname(filePath) || '(no ext)';
      counts[ext] = (counts[ext] || 0) + 1;
    });
    return counts;
  }

  private async walkDir(dir: string, depth: number, cb: (path: string) => void): Promise<void> {
    if (depth <= 0) return;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
        const fullPath = join(dir, entry.name);
        if (entry.isFile()) cb(fullPath);
        else if (entry.isDirectory()) await this.walkDir(fullPath, depth - 1, cb);
      }
    } catch { /* ignore */ }
  }

  private async getActiveBranches(): Promise<Array<{ id: string; branch: string; status: string; ship: string | null }>> {
    try {
      const hasState = await this.gitOps.branchExists('fleet/state', true);
      if (!hasState) return [];
      const content = await this.gitOps.readFile('fleet/state', 'FLEET.md');
      const manifest = parseFleetManifest(content);
      return manifest.missions
        .filter((m) => !['merged', 'failed'].includes(m.status))
        .map((m) => ({ id: m.id, branch: m.branch, status: m.status, ship: m.ship }));
    } catch { return []; }
  }

  private async getLLMNarrative(staticOverview: string): Promise<string> {
    let Anthropic: any;
    try {
      const mod = await import('@anthropic-ai/sdk' as string);
      Anthropic = mod.default ?? mod.Anthropic;
    } catch {
      return staticOverview + '\n\n*(LLM enhancement unavailable — @anthropic-ai/sdk not installed)*';
    }
    try {
      const client = new Anthropic();
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 2048,
        system: 'You are a technical writer. Given a codebase summary, write a clear 2-3 paragraph architecture overview for a developer about to start a coding task. Be specific and practical.',
        messages: [{ role: 'user', content: `Summarize this codebase:\n\n${staticOverview}` }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return text || staticOverview;
    } catch {
      return staticOverview + '\n\n*(LLM enhancement failed — using static analysis)*';
    }
  }
}
