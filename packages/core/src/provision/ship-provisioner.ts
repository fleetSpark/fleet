/**
 * Cloud ship provisioning. Produces the artifacts needed to boot a VM that
 * auto-joins a fleet as a ship: a cloud-init script and a provider launch
 * command. Generation is pure and testable; actually creating the VM requires
 * provider credentials and is performed by the CLI when `--apply` is passed.
 */

export type CloudProvider = 'aws' | 'fly' | 'gcp';

export interface ProvisionOptions {
  provider: CloudProvider;
  /** Repo URL the ship will join. */
  repo: string;
  /** Logical ship name. */
  name?: string;
  /** Coding agent adapter the ship should run. */
  agent?: string;
  /** Provider machine size (instance type / VM size). */
  size?: string;
  /** Region/zone. */
  region?: string;
}

export interface ProvisionSpec {
  provider: CloudProvider;
  name: string;
  /** cloud-init / startup script that installs Node + fleetspark and joins. */
  cloudInit: string;
  /** The provider CLI command (argv) that would create the VM. */
  launchCommand: string[];
  /** Human-readable notes about prerequisites. */
  notes: string;
}

const DEFAULT_SIZE: Record<CloudProvider, string> = {
  aws: 't3.large',
  fly: 'shared-cpu-2x',
  gcp: 'e2-standard-2',
};

const DEFAULT_REGION: Record<CloudProvider, string> = {
  aws: 'us-east-1',
  fly: 'iad',
  gcp: 'us-central1-a',
};

function buildCloudInit(repo: string, agent: string): string {
  // POSIX shell startup script; works as AWS user-data, GCP startup-script,
  // and the body of a fly machine init.
  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '# Fleet ship bootstrap',
    'curl -fsSL https://deb.nodesource.com/setup_20.x | bash -',
    'apt-get install -y nodejs git',
    'npm install -g fleetspark',
    `export FLEET_AGENT=${shellQuote(agent)}`,
    `fleet ship --join ${shellQuote(repo)}`,
  ].join('\n');
}

export function buildProvisionSpec(opts: ProvisionOptions): ProvisionSpec {
  if (!opts.repo) throw new Error('Provisioning requires a repo URL');
  const provider = opts.provider;
  const name = opts.name ?? `fleet-ship-${provider}`;
  const agent = opts.agent ?? 'claude-code';
  const size = opts.size ?? DEFAULT_SIZE[provider];
  const region = opts.region ?? DEFAULT_REGION[provider];
  const cloudInit = buildCloudInit(opts.repo, agent);

  let launchCommand: string[];
  let notes: string;
  switch (provider) {
    case 'aws':
      launchCommand = [
        'aws', 'ec2', 'run-instances',
        '--instance-type', size,
        '--region', region,
        '--tag-specifications', `ResourceType=instance,Tags=[{Key=Name,Value=${name}}]`,
        '--user-data', 'file://fleet-ship-cloud-init.sh',
        '--image-id', 'resolve:ssm:/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id',
      ];
      notes = 'Requires AWS CLI configured with EC2 run-instances permissions and a key pair.';
      break;
    case 'fly':
      launchCommand = [
        'fly', 'machine', 'run',
        'ubuntu:22.04',
        '--name', name,
        '--region', region,
        '--vm-size', size,
        '--file-local', 'fleet-init.sh=/fleet-init.sh',
      ];
      notes = 'Requires flyctl authenticated (fly auth login) and an existing fly app.';
      break;
    case 'gcp':
      launchCommand = [
        'gcloud', 'compute', 'instances', 'create', name,
        '--zone', region,
        '--machine-type', size,
        '--image-family', 'ubuntu-2204-lts',
        '--image-project', 'ubuntu-os-cloud',
        '--metadata-from-file', 'startup-script=fleet-ship-cloud-init.sh',
      ];
      notes = 'Requires gcloud authenticated with Compute Engine permissions.';
      break;
    default:
      throw new Error(`Unsupported cloud provider: ${provider}`);
  }

  return { provider, name, cloudInit, launchCommand, notes };
}

export function renderProvisionSpec(spec: ProvisionSpec): string {
  return [
    `# Cloud ship provisioning — ${spec.provider} (${spec.name})`,
    '',
    '## cloud-init / startup script',
    '```bash',
    spec.cloudInit,
    '```',
    '',
    '## launch command',
    '```',
    spec.launchCommand.join(' '),
    '```',
    '',
    `> ${spec.notes}`,
  ].join('\n');
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
