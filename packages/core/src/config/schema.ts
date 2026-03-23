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
        shadow_dispatch: z.boolean().default(false),
        shadow_delay_min: z.number().positive().default(15),
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
    brief: z
      .object({
        mode: z.enum(['static', 'llm']).default('static'),
      })
      .default({}),
    resources: z
      .object({
        max_missions_per_ship: z.number().positive().default(1),
        mission_timeout_min: z.number().positive().default(120),
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
    notifications: z
      .object({
        webhooks: z
          .array(
            z.object({
              url: z.string(),
              events: z.array(z.string()).optional(),
              format: z.enum(['json', 'slack']).default('json'),
            })
          )
          .default([]),
      })
      .default({}),
  })
  .default({});

export type FleetConfig = z.infer<typeof fleetConfigSchema>;

export const DEFAULT_CONFIG: FleetConfig = fleetConfigSchema.parse({});

export function parseConfig(raw: unknown): FleetConfig {
  return fleetConfigSchema.parse(raw);
}
