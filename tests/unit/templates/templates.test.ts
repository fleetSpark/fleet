import { describe, it, expect } from 'vitest';
import { listTemplates, getTemplate, type MissionTemplate } from '@fleetspark/core';

describe('listTemplates', () => {
  it('returns 5 templates', () => {
    const templates = listTemplates();
    expect(templates).toHaveLength(5);
  });

  it('each template has name, description, and missions', () => {
    const templates = listTemplates();
    for (const t of templates) {
      expect(t.name).toEqual(expect.any(String));
      expect(t.description).toEqual(expect.any(String));
      expect(t.missions).toEqual(expect.any(Array));
      expect(t.missions.length).toBeGreaterThan(0);
    }
  });
});

describe('getTemplate', () => {
  it('returns correct template for test-coverage', () => {
    const t = getTemplate('test-coverage');
    expect(t).toBeDefined();
    expect(t!.name).toBe('test-coverage');
    expect(t!.missions).toHaveLength(4);
  });

  it('returns undefined for nonexistent template', () => {
    const t = getTemplate('nonexistent');
    expect(t).toBeUndefined();
  });
});

describe('mission structure', () => {
  it('each mission has valid structure', () => {
    const templates = listTemplates();
    for (const t of templates) {
      for (const m of t.missions) {
        expect(m.id).toMatch(/^M\d+$/);
        expect(m.branch).toMatch(/^feature\//);
        expect(m.brief).toEqual(expect.any(String));
        expect(m.agent).toBe('claude-code');
        expect(m.depends).toEqual(expect.any(Array));
      }
    }
  });

  it('dependencies reference valid mission IDs within the same template', () => {
    const templates = listTemplates();
    for (const t of templates) {
      const ids = new Set(t.missions.map((m) => m.id));
      for (const m of t.missions) {
        for (const dep of m.depends) {
          expect(ids.has(dep)).toBe(true);
        }
      }
    }
  });
});
