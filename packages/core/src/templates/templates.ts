export interface MissionTemplate {
  name: string;
  description: string;
  missions: Array<{
    id: string;
    branch: string;
    brief: string;
    agent: string;
    depends: string[];
  }>;
}

export const BUILTIN_TEMPLATES: MissionTemplate[] = [
  {
    name: 'test-coverage',
    description: 'Improve test coverage across the project',
    missions: [
      {
        id: 'M1',
        branch: 'feature/test-utils',
        brief: 'Add unit tests for utility modules',
        agent: 'claude-code',
        depends: [],
      },
      {
        id: 'M2',
        branch: 'feature/test-core',
        brief: 'Add unit tests for core business logic',
        agent: 'claude-code',
        depends: [],
      },
      {
        id: 'M3',
        branch: 'feature/test-api',
        brief: 'Add integration tests for API endpoints',
        agent: 'claude-code',
        depends: ['M1', 'M2'],
      },
      {
        id: 'M4',
        branch: 'feature/test-ci',
        brief: 'Configure CI pipeline for test execution and reporting',
        agent: 'claude-code',
        depends: ['M3'],
      },
    ],
  },
  {
    name: 'security-audit',
    description: 'Run a comprehensive security audit of the codebase',
    missions: [
      {
        id: 'M1',
        branch: 'feature/deps-audit',
        brief: 'Audit dependencies for known vulnerabilities',
        agent: 'claude-code',
        depends: [],
      },
      {
        id: 'M2',
        branch: 'feature/secret-scanning',
        brief: 'Scan repository for leaked secrets and credentials',
        agent: 'claude-code',
        depends: [],
      },
      {
        id: 'M3',
        branch: 'feature/owasp-review',
        brief: 'Review code against OWASP Top 10 vulnerabilities',
        agent: 'claude-code',
        depends: ['M1', 'M2'],
      },
    ],
  },
  {
    name: 'api-docs',
    description: 'Generate comprehensive API documentation',
    missions: [
      {
        id: 'M1',
        branch: 'feature/openapi-spec',
        brief: 'Generate OpenAPI specification from source code',
        agent: 'claude-code',
        depends: [],
      },
      {
        id: 'M2',
        branch: 'feature/endpoint-docs',
        brief: 'Write detailed documentation for each API endpoint',
        agent: 'claude-code',
        depends: ['M1'],
      },
      {
        id: 'M3',
        branch: 'feature/usage-examples',
        brief: 'Create usage examples and code snippets for the API',
        agent: 'claude-code',
        depends: ['M2'],
      },
    ],
  },
  {
    name: 'dependency-update',
    description: 'Update project dependencies to latest versions',
    missions: [
      {
        id: 'M1',
        branch: 'feature/major-deps',
        brief: 'Update major dependency versions with migration changes',
        agent: 'claude-code',
        depends: [],
      },
      {
        id: 'M2',
        branch: 'feature/minor-deps',
        brief: 'Update minor and patch dependency versions',
        agent: 'claude-code',
        depends: [],
      },
      {
        id: 'M3',
        branch: 'feature/lockfile',
        brief: 'Regenerate lockfile and verify dependency resolution',
        agent: 'claude-code',
        depends: ['M1', 'M2'],
      },
    ],
  },
  {
    name: 'refactor',
    description: 'Refactor codebase for improved maintainability',
    missions: [
      {
        id: 'M1',
        branch: 'feature/extract-shared',
        brief: 'Extract shared code into reusable modules',
        agent: 'claude-code',
        depends: [],
      },
      {
        id: 'M2',
        branch: 'feature/simplify',
        brief: 'Simplify complex functions and reduce cyclomatic complexity',
        agent: 'claude-code',
        depends: ['M1'],
      },
      {
        id: 'M3',
        branch: 'feature/dead-code',
        brief: 'Identify and remove dead code paths',
        agent: 'claude-code',
        depends: ['M1'],
      },
      {
        id: 'M4',
        branch: 'feature/types',
        brief: 'Strengthen TypeScript types and remove any casts',
        agent: 'claude-code',
        depends: ['M2', 'M3'],
      },
    ],
  },
  {
    name: 'drsti-dev-flow',
    description: 'Governed development workflow: spec, implementation, and peer-review phases. Each mission maps to one drsti-dev-flow phase. Rename each branch to match the specific feature before starting (e.g. feature/my-feature-spec).',
    missions: [
      {
        id: 'M1',
        branch: 'feature/governed-spec',
        brief: 'Rename this branch to feature/<your-feature>-spec. Read the project adapter (.drsti/adapter.yml) and FLEET_CONTEXT.md. Run the pre-proposal coordination check against workstreams.json. Write a spec for the assigned feature covering scope, shared contracts, acceptance criteria, and risks. Self-review and record findings. Branch is ready when the spec is committed and the self-review is documented.',
        agent: 'claude-code',
        depends: [],
      },
      {
        id: 'M2',
        branch: 'feature/governed-impl',
        brief: 'Rename this branch to feature/<your-feature>-impl. Read the spec committed on the M1 branch. Implement within the declared scope only — do not expand scope without updating workstream state. Write or update tests. Self-review the implementation against the spec and record verification results and unresolved risks before marking the branch ready.',
        agent: 'claude-code',
        depends: ['M1'],
      },
      {
        id: 'M3',
        branch: 'feature/governed-review',
        brief: 'Rename this branch to feature/<your-feature>-review. Peer-review the M2 implementation against the M1 spec. Check spec compliance, test coverage, and scope drift. Record all findings. Approve the merge gate only when all blockers are resolved or explicitly deferred with recorded rationale.',
        agent: 'claude-code',
        depends: ['M2'],
      },
    ],
  },
];
