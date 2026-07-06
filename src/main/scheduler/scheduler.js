import { getEnabledJobs, getJobByName } from "../jobs/job-registry";
import { runJob } from "../jobs/job-runner";

const HOUR_MS = 60 * 60 * 1000;

let intervalId = null;
let lastHourlyRun = 0;

export function startScheduler() {
  if (intervalId) return;

  intervalId = setInterval(() => {
    tickScheduler().catch((error) => {
      console.error("[scheduler]", error);
    });
  }, 60 * 1000);

  tickScheduler().catch((error) => {
    console.error("[scheduler:init]", error);
  });
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function tickScheduler() {
  const now = Date.now();
  const jobs = getEnabledJobs();

  for (const job of jobs) {
    if (job.cron === "0 * * * *") {
      if (now - lastHourlyRun >= HOUR_MS) {
        await runJob(job);
        lastHourlyRun = now;
      }
      continue;
    }

    // Daily jobs at fixed hour (simplified until full cron in 10.8)
    if (job.cron.startsWith("0 ") && shouldRunDailyJob(job.cron)) {
      await runJob(job);
    }
  }
}

function shouldRunDailyJob(cron) {
  const parts = cron.split(" ");
  const hour = Number(parts[1]);
  const currentHour = new Date().getHours();
  return currentHour === hour;
}

export async function runJobByName(name) {
  const job = getJobByName(name);
  if (!job?.handler) {
    throw new Error(`Job not found or disabled: ${name}`);
  }
  return runJob(job);
}
