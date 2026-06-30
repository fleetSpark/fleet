import type { FleetManifest } from '../protocol/types.js';

/**
 * Usage metering — the pricing foundation for Fleet Cloud's usage-based model.
 * Derives billable units from a fleet manifest. (Hosting, auth, multi-tenancy,
 * and billing integration are operated outside this repo; this module is the
 * deterministic, testable core that a hosted control plane meters against.)
 */
export interface UsageRecord {
  /** Total missions observed. */
  missions: number;
  /** Missions that reached `merged`. */
  mergedMissions: number;
  /** Missions that failed or stalled (still billable compute). */
  failedMissions: number;
  /** Distinct ships that did work. */
  ships: number;
  /** Optional ship-minutes if a runtime supplies them. */
  shipMinutes: number;
}

export interface PricingModel {
  currency: string;
  perMission: number;
  perMergedMission: number;
  perShipMinute: number;
}

export const DEFAULT_PRICING: PricingModel = {
  currency: 'USD',
  perMission: 0.0,
  perMergedMission: 0.5,
  perShipMinute: 0.01,
};

export interface MeterOptions {
  /** Ship-minutes keyed by ship id, when the runtime tracks them. */
  shipMinutes?: Record<string, number>;
}

export function meterUsage(manifest: FleetManifest, opts: MeterOptions = {}): UsageRecord {
  const missions = manifest.missions;
  const mergedMissions = missions.filter((m) => m.status === 'merged').length;
  const failedMissions = missions.filter((m) => m.status === 'failed' || m.status === 'stalled').length;
  const ships = new Set(missions.map((m) => m.ship).filter((s): s is string => !!s));
  const shipMinutes = opts.shipMinutes
    ? Object.values(opts.shipMinutes).reduce((a, b) => a + b, 0)
    : 0;

  return {
    missions: missions.length,
    mergedMissions,
    failedMissions,
    ships: ships.size,
    shipMinutes,
  };
}

export interface PriceLineItem {
  label: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface PricedUsage {
  currency: string;
  lineItems: PriceLineItem[];
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function priceUsage(usage: UsageRecord, pricing: PricingModel = DEFAULT_PRICING): PricedUsage {
  const lineItems: PriceLineItem[] = [
    { label: 'Missions dispatched', quantity: usage.missions, unitPrice: pricing.perMission, amount: round2(usage.missions * pricing.perMission) },
    { label: 'Merged missions', quantity: usage.mergedMissions, unitPrice: pricing.perMergedMission, amount: round2(usage.mergedMissions * pricing.perMergedMission) },
    { label: 'Ship-minutes', quantity: usage.shipMinutes, unitPrice: pricing.perShipMinute, amount: round2(usage.shipMinutes * pricing.perShipMinute) },
  ];
  const total = round2(lineItems.reduce((sum, li) => sum + li.amount, 0));
  return { currency: pricing.currency, lineItems, total };
}
