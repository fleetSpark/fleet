/**
 * Action-item ingestion — an opt-in, planner-side scanner that reads reviews,
 * chat, and commit messages and *proposes* backlog items. It never dispatches:
 * the output is a list of suggestions for a human (or a planner with an explicit
 * approval step) to triage.
 */

export type ActionItemSourceKind = 'commit' | 'review' | 'chat';

export interface ActionItemSource {
  kind: ActionItemSourceKind;
  text: string;
  /** Optional reference for provenance (commit sha, PR url, message id). */
  ref?: string;
  /** Optional author for provenance. */
  author?: string;
}

export type ProposalConfidence = 'high' | 'medium' | 'low';

export interface ProposedBacklogItem {
  title: string;
  rationale: string;
  /** Human-readable provenance, e.g. "review @abc123" or "commit a1b2c3d". */
  source: string;
  confidence: ProposalConfidence;
  tags: string[];
}

/**
 * An adapter that collects raw action-item sources (from a git log, a review
 * API, a chat export, …). Kept separate from scanning so the pure
 * `ingestActionItems` logic stays testable.
 */
export interface ActionItemAdapter {
  name: string;
  collect(): Promise<ActionItemSource[]>;
}

interface Pattern {
  re: RegExp;
  confidence: ProposalConfidence;
  tags: string[];
}

// Ordered by specificity; the first match wins for a given line.
const PATTERNS: Pattern[] = [
  { re: /\b(FIXME|BUG)\b[:\s-]*(.+)/i, confidence: 'high', tags: ['bug'] },
  { re: /\b(TODO|HACK|XXX)\b[:\s-]*(.+)/i, confidence: 'medium', tags: ['todo'] },
  { re: /\b(follow[- ]?up|followup)\b[:\s-]*(.+)/i, confidence: 'medium', tags: ['follow-up'] },
  { re: /^\s*nit[:\s-]+(.+)/i, confidence: 'low', tags: ['nit', 'review'] },
  { re: /\b(consider|suggest(?:ion)?|recommend)\b\s+(.+)/i, confidence: 'low', tags: ['suggestion', 'review'] },
  { re: /\b(we|you|this)\s+(?:should|needs? to|must|ought to)\s+(.+)/i, confidence: 'medium', tags: ['action'] },
  { re: /\b(please)\s+(.+)/i, confidence: 'low', tags: ['request', 'review'] },
];

function truncate(s: string, max = 100): string {
  const clean = s.trim().replace(/\s+/g, ' ').replace(/[.;,\s]+$/, '');
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
}

function provenance(src: ActionItemSource): string {
  const parts: string[] = [src.kind];
  if (src.ref) parts.push(src.ref);
  if (src.author) parts.push(`by ${src.author}`);
  return parts.join(' ');
}

function normalizeKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface IngestOptions {
  /** Drop proposals below this confidence. Defaults to keeping all. */
  minConfidence?: ProposalConfidence;
  /** Cap the number of proposals returned (most confident first). */
  limit?: number;
}

const CONFIDENCE_RANK: Record<ProposalConfidence, number> = { high: 0, medium: 1, low: 2 };

/**
 * Scan a set of sources and return proposed backlog items. Pure and
 * deterministic — no side effects, no dispatch.
 */
export function ingestActionItems(
  sources: ActionItemSource[],
  opts: IngestOptions = {}
): ProposedBacklogItem[] {
  const proposals: ProposedBacklogItem[] = [];
  const seen = new Map<string, ProposedBacklogItem>();

  for (const src of sources) {
    if (!src.text) continue;
    const lines = src.text.split(/\r?\n/);
    for (const line of lines) {
      for (const pattern of PATTERNS) {
        const m = line.match(pattern.re);
        if (!m) continue;
        const captured = m[m.length - 1];
        if (!captured || captured.trim().length < 3) break;

        const title = truncate(captured);
        const key = normalizeKey(title);
        if (!key || seen.has(key)) {
          // Merge provenance into the existing proposal rather than duplicating.
          const existing = seen.get(key);
          if (existing && !existing.source.includes(provenance(src))) {
            existing.rationale += `; also ${provenance(src)}`;
          }
          break;
        }

        // Commit/review/chat context refines confidence: review comments are
        // intentional asks; chat is noisier.
        let confidence = pattern.confidence;
        if (src.kind === 'chat' && confidence === 'medium') confidence = 'low';

        const proposal: ProposedBacklogItem = {
          title,
          rationale: `Detected in ${provenance(src)}: "${truncate(line, 140)}"`,
          source: provenance(src),
          confidence,
          tags: [...new Set([src.kind, ...pattern.tags])],
        };
        seen.set(key, proposal);
        proposals.push(proposal);
        break; // one proposal per line
      }
    }
  }

  let result = proposals;
  if (opts.minConfidence) {
    const threshold = CONFIDENCE_RANK[opts.minConfidence];
    result = result.filter((p) => CONFIDENCE_RANK[p.confidence] <= threshold);
  }
  result.sort((a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]);
  if (opts.limit && opts.limit > 0) {
    result = result.slice(0, opts.limit);
  }
  return result;
}

/** Collect from one or more adapters and ingest in a single pass. */
export async function ingestFromAdapters(
  adapters: ActionItemAdapter[],
  opts: IngestOptions = {}
): Promise<ProposedBacklogItem[]> {
  const all: ActionItemSource[] = [];
  for (const adapter of adapters) {
    try {
      all.push(...(await adapter.collect()));
    } catch {
      // A failing adapter must not abort the whole ingestion.
    }
  }
  return ingestActionItems(all, opts);
}
