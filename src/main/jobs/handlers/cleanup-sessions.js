import { getBusinessDate } from "../../domain/business-date";
import { deleteExpiredSessions } from "../../repositories/master-repository";

export async function cleanupExpiredSessions() {
  const now = getBusinessDate();
  const result = await deleteExpiredSessions(now);
  return result.count;
}
