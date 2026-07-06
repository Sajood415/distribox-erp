import { getBusinessDate } from "../domain/business-date";
import { createJobRunLog, updateJobRunLog } from "../repositories/master-repository";
import { getMasterPrisma } from "../db/init";

export const JOB_STATUS = {
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
};

/**
 * Every background job MUST create a JobRunLog entry.
 */
export async function startJobRun(jobName) {
  return createJobRunLog({
    jobName,
    startedAt: getBusinessDate(),
    status: JOB_STATUS.RUNNING,
    recordsProcessed: 0,
  });
}

export async function finishJobRun(logId, { status, error = null, recordsProcessed = 0 }) {
  const finishedAt = getBusinessDate();
  const prisma = getMasterPrisma();
  const row = await prisma.jobRunLog.findUnique({
    where: { id: logId },
    select: { startedAt: true },
  });
  const durationMs = row?.startedAt ? finishedAt.getTime() - row.startedAt.getTime() : null;

  return updateJobRunLog(logId, {
    finishedAt,
    status,
    error,
    recordsProcessed,
    durationMs,
  });
}
