import { BUILTIN_TEMPLATES, type MissionTemplate } from '../templates/templates.js';

/**
 * A community-contributed mission template, discoverable through the mission
 * marketplace. Extends the built-in `MissionTemplate` shape with provenance
 * metadata so entries can be ranked and attributed.
 */
export interface MarketplaceEntry extends MissionTemplate {
  author?: string;
  tags?: string[];
  /** Where the entry came from: 'builtin' or the index source string. */
  origin?: string;
}

export interface MarketplaceIndex {
  entries: MarketplaceEntry[];
}

/** Built-in templates surfaced in the marketplace under the `builtin` origin. */
export function builtinEntries(): MarketplaceEntry[] {
  return BUILTIN_TEMPLATES.map((t) => ({ ...t, origin: 'builtin', tags: ['builtin'] }));
}

function coerceIndex(raw: unknown, origin: string): MarketplaceIndex {
  const obj = (raw ?? {}) as { entries?: unknown };
  const entries = Array.isArray(obj.entries) ? obj.entries : [];
  const valid: MarketplaceEntry[] = [];
  for (const e of entries as MarketplaceEntry[]) {
    if (e && typeof e.name === 'string' && Array.isArray(e.missions)) {
      valid.push({ ...e, origin });
    }
  }
  return { entries: valid };
}

/**
 * Load a marketplace index. Built-in templates are always included; an optional
 * `source` (a local `.json` file path or an `https://` URL) layers community
 * entries on top. Network/file access is injected for testability.
 */
export async function loadMarketplaceIndex(
  source?: string,
  deps?: {
    readFile?: (p: string) => Promise<string>;
    fetchJson?: (url: string) => Promise<unknown>;
  }
): Promise<MarketplaceIndex> {
  const entries = builtinEntries();

  if (source) {
    let raw: unknown;
    if (/^https?:\/\//i.test(source)) {
      const fetchJson =
        deps?.fetchJson ??
        (async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Marketplace fetch failed: ${res.status}`);
          return res.json();
        });
      raw = await fetchJson(source);
    } else {
      const readFile =
        deps?.readFile ?? ((p: string) => import('node:fs/promises').then((m) => m.readFile(p, 'utf-8')));
      raw = JSON.parse(await readFile(source));
    }
    entries.push(...coerceIndex(raw, source).entries);
  }

  // De-duplicate by name, with later (community) entries overriding builtins.
  const byName = new Map<string, MarketplaceEntry>();
  for (const e of entries) byName.set(e.name, e);
  return { entries: [...byName.values()] };
}

/** Case-insensitive search across name, description, and tags. */
export function searchMarketplace(index: MarketplaceIndex, query: string): MarketplaceEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...index.entries];
  return index.entries.filter((e) => {
    const haystack = [e.name, e.description, ...(e.tags ?? [])].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

export function getEntry(index: MarketplaceIndex, name: string): MarketplaceEntry | null {
  return index.entries.find((e) => e.name === name) ?? null;
}

/** Convert a marketplace entry into a runnable plan object (`{ missions }`). */
export function entryToPlan(entry: MarketplaceEntry): { missions: MissionTemplate['missions'] } {
  return { missions: entry.missions };
}
