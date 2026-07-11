import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("cleanup expired messages", { minutes: 30 }, internal.cron.cleanupExpiredMessages);
crons.interval("cleanup orphaned attachments", { hours: 6 }, internal.cron.cleanupOrphanedAttachments);

export default crons;
