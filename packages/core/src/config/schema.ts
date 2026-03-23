import { z } from 'zod';

export const fleetConfigSchema = z
  .object({
    commander: z
      .object({
        model: z.string().default('claude-opus-4-5'),
        poll_interval_minutes: z.number().positive().default(5),
        max_concurrent_ships: z.number().positive().default(8),
      })
      .default({}),
    execution: z
      .object({
        strategy: z.enum(['sequential', 'mapreduce']).default('mapreduce'),
        stall_threshold_min: z.number().positive().default(30),
        unresponsive_threshold_min: z.number().positive().default(10),
      })
      .default({}),
    heartbeat: z
      .object({
        interval_seconds: z.number().positive().default(60),
        squash_on_complete: z.boolean().default(true),
      })
      .default({}),
    merge: z
      .object({
        ci_required: z.boolean().default(true),
        auto_rebase: z.boolean().default(true),
      })
      .default({}),
    ships: z
      .array(
        z.object({
          id: z.string(),
          adapter: z.string().default('claude'),
        })
      )
      .default([]),
  })
  .default({});

export type FleetConfig = z.infer<typeof fleetConfigSchema>;

export const DEFAULT_CONFIG: FleetConfig = fleetConfigSchema.parse({});

export function parseConfig(raw: unknown): FleetConfig {
  return fleetConfigSchema.parse(raw);
}
