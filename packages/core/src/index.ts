// @fleetspark/core — public API
export * from './protocol/types.js';
export { parseFleetManifest, writeFleetManifest } from './protocol/fleet-manifest.js';
export { parseMissionLog, writeMissionLog } from './protocol/mission-log.js';
export { transition, type StateEvent } from './state/mission-state.js';
export { getReadyMissions, validateDAG } from './scheduler/dag.js';
export { parseConfig, DEFAULT_CONFIG, type FleetConfig } from './config/schema.js';
export { loadConfig } from './config/loader.js';
export { type GitOps, RealGitOps, type PRStatus } from './git/git-ops.js';
export {
  detectProvider,
  resolveProvider,
  GitHubProvider,
  GitLabProvider,
  BitbucketProvider,
  rollupToCiStatus,
  gitlabPipelineToCiStatus,
  type GitProvider,
  type GitProviderName,
} from './git/providers.js';
export { ShipHeartbeat } from './heartbeat/ship-heartbeat.js';
export { CommanderMonitor, type MonitorConfig, type ShipHealth } from './heartbeat/commander-monitor.js';
export { MergeCommander, type MergeConfig, type MergeResult } from './merge/merge-commander.js';
export { ConflictDetector, type ConflictReport } from './merge/conflict-detector.js';
export { BriefGenerator } from './brief/brief-generator.js';
export { resolveAdapter } from './adapters/registry.js';
export { Notifier, type FleetEvent, type NotificationConfig, type WebhookConfig, type WebhookFormat } from './notifications/notifier.js';
export { ResourceManager, type ResourceConfig } from './resources/resource-manager.js';
export { TelemetryCollector, type TelemetrySnapshot } from './telemetry/telemetry.js';
export { CommanderElection, type ClaimResult } from './election/commander-election.js';
export { listTemplates, getTemplate, type MissionTemplate } from './templates/index.js';
export { generateReport, generateReportJson } from './report/report-generator.js';
export { PluginLoader } from './plugins/plugin-loader.js';
export type { FleetPlugin, FleetContext, HookResult, PluginConfig } from './plugins/types.js';
export {
  classifyOutcomes,
  summarizeOutcomes,
  generateOutcomesJson,
  renderOutcomes,
  type MissionOutcome,
  type OutcomeKind,
  type OutcomeBatchSummary,
} from './outcomes/outcome-stream.js';
export {
  LivenessPublisher,
  parsePresence,
  serializePresence,
  presencePath,
  sanitizeHost,
  isPresenceAlive,
  type Presence,
  type MachineMode,
  type LivenessOptions,
} from './heartbeat/liveness.js';
export {
  validateBatchBlock,
  loadBatchBlock,
  resolvePlanSource,
  registerPlanSource,
  type BatchBlock,
  type PlanSource,
  type PlanMissionSpec,
  type ValidationResult,
} from './planner/plan-source.js';
export {
  ingestActionItems,
  ingestFromAdapters,
  type ActionItemSource,
  type ActionItemAdapter,
  type ProposedBacklogItem,
  type ProposalConfidence,
  type IngestOptions,
} from './planner/action-item-ingestion.js';
export {
  analyzeRisk,
  renderRiskPanel,
  type RiskReport,
  type RiskItem,
  type RiskSignals,
  type RiskSeverity,
  type RiskKind,
  type RiskOptions,
} from './report/risk-analyzer.js';
export {
  computeBenchmarks,
  renderBenchmarks,
  type AgentBenchmark,
  type BenchmarkReport,
  type BenchmarkOptions,
} from './benchmarks/agent-benchmarks.js';
export {
  ShadowExecutor,
  type ShadowAssignment,
  type ShadowResolution,
  type ShadowWinner,
} from './execution/shadow-executor.js';
export { applyReplay, type ReplayOutcome } from './replay/replay.js';
export {
  loadMarketplaceIndex,
  searchMarketplace,
  getEntry,
  entryToPlan,
  builtinEntries,
  type MarketplaceEntry,
  type MarketplaceIndex,
} from './marketplace/marketplace.js';
export {
  buildProvisionSpec,
  renderProvisionSpec,
  type CloudProvider,
  type ProvisionOptions,
  type ProvisionSpec,
} from './provision/ship-provisioner.js';
export {
  parseTeamConfig,
  routeReviewers,
  evaluateApproval,
  matchesPattern,
  globToRegExp,
  type TeamConfig,
  type TeamMember,
  type OwnershipRule,
  type ApprovalPolicy,
  type Role,
  type ReviewRouting,
  type ApprovalResult,
} from './team/team.js';
export {
  meterUsage,
  priceUsage,
  DEFAULT_PRICING,
  type UsageRecord,
  type PricingModel,
  type PricedUsage,
  type PriceLineItem,
  type MeterOptions,
} from './cloud/usage-meter.js';
