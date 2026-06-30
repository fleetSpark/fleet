import { describe, it, expect } from 'vitest';
import { buildProvisionSpec, renderProvisionSpec } from '@fleetspark/core';

describe('buildProvisionSpec', () => {
  it('builds an AWS spec with cloud-init that joins the fleet', () => {
    const spec = buildProvisionSpec({ provider: 'aws', repo: 'https://github.com/acme/repo.git' });
    expect(spec.provider).toBe('aws');
    expect(spec.launchCommand[0]).toBe('aws');
    expect(spec.cloudInit).toContain('npm install -g fleetspark');
    expect(spec.cloudInit).toContain("fleet ship --join 'https://github.com/acme/repo.git'");
  });

  it('builds a Fly spec', () => {
    const spec = buildProvisionSpec({ provider: 'fly', repo: 'r', region: 'lhr' });
    expect(spec.launchCommand[0]).toBe('fly');
    expect(spec.launchCommand).toContain('lhr');
  });

  it('builds a GCP spec', () => {
    const spec = buildProvisionSpec({ provider: 'gcp', repo: 'r', size: 'e2-medium' });
    expect(spec.launchCommand[0]).toBe('gcloud');
    expect(spec.launchCommand).toContain('e2-medium');
  });

  it('embeds the chosen agent in cloud-init', () => {
    const spec = buildProvisionSpec({ provider: 'aws', repo: 'r', agent: 'codex' });
    expect(spec.cloudInit).toContain("FLEET_AGENT='codex'");
  });

  it('throws without a repo', () => {
    expect(() => buildProvisionSpec({ provider: 'aws', repo: '' })).toThrow('repo');
  });

  it('renders a markdown artifact with both sections', () => {
    const md = renderProvisionSpec(buildProvisionSpec({ provider: 'fly', repo: 'r' }));
    expect(md).toContain('cloud-init');
    expect(md).toContain('launch command');
  });
});
