import { startJobRun, finishJobRun, JOB_STATUS } from "../services/job-run-service";

export async function runJob(job) {
  if (!job?.handler) {
    throw new Error(`Job handler missing: ${job?.name}`);
  }

  const log = await startJobRun(job.name);

  try {
    const recordsProcessed = await job.handler();
    await finishJobRun(log.id, {
      status: JOB_STATUS.SUCCESS,
      recordsProcessed: Number(recordsProcessed) || 0,
    });
    return { success: true, jobName: job.name, recordsProcessed };
  } catch (error) {
    await finishJobRun(log.id, {
      status: JOB_STATUS.FAILED,
      error: error.message || String(error),
      recordsProcessed: 0,
    });
    console.error(`[job:${job.name}]`, error);
    return { success: false, jobName: job.name, error: error.message };
  }
}
