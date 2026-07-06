import { cleanupExpiredSessions } from "./handlers/cleanup-sessions";

export const JOBS = [
  {
    name: "cleanup-sessions",
    cron: "0 * * * *",
    enabled: true,
    handler: cleanupExpiredSessions,
    description: "Remove expired user sessions from master database",
  },
  {
    name: "auto-backup",
    cron: "0 2 * * *",
    enabled: false,
    handler: null,
    description: "Scheduled database backup (Phase 10.8)",
  },
  {
    name: "expiry-alerts",
    cron: "0 8 * * *",
    enabled: false,
    handler: null,
    description: "Pharma expiry batch alerts (Phase 10.8)",
  },
  {
    name: "low-stock-alerts",
    cron: "0 9 * * *",
    enabled: false,
    handler: null,
    description: "Low stock notifications (Phase 10.8)",
  },
  {
    name: "daily-snapshot",
    cron: "0 23 * * *",
    enabled: false,
    handler: null,
    description: "Daily system snapshot (Phase 10.5)",
  },
];

export function getEnabledJobs() {
  return JOBS.filter((job) => job.enabled && typeof job.handler === "function");
}

export function getJobByName(name) {
  return JOBS.find((job) => job.name === name) ?? null;
}
