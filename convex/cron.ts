import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const cleanupExpiredMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredMessages = await ctx.db.query("messages")
      .filter((q) => q.and(
        q.neq(q.field("expiresAt"), undefined),
        q.lt(q.field("expiresAt"), now)
      ))
      .collect();
    let deletedCount = 0;
    for (const message of expiredMessages) {
      if (message.attachment) {
        try { await ctx.storage.delete(message.attachment.storageId); } catch {}
      }
      await ctx.db.delete(message._id);
      deletedCount++;
    }
    const expiredGroupMessages = await ctx.db.query("groupMessages")
      .filter((q) => q.and(
        q.neq(q.field("expiresAt"), undefined),
        q.lt(q.field("expiresAt"), now)
      ))
      .collect();
    for (const message of expiredGroupMessages) {
      if (message.attachment) {
        try { await ctx.storage.delete(message.attachment.storageId); } catch {}
      }
      await ctx.db.delete(message._id);
      deletedCount++;
    }
    return { deletedCount };
  },
});

export const cleanupOrphanedAttachments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const storageIds = new Set<string>();
    const messages = await ctx.db.query("messages").collect();
    for (const m of messages) {
      if (m.attachment) storageIds.add(m.attachment.storageId);
    }
    const groupMessages = await ctx.db.query("groupMessages").collect();
    for (const m of groupMessages) {
      if (m.attachment) storageIds.add(m.attachment.storageId);
    }
    const groups = await ctx.db.query("groups").collect();
    for (const g of groups) {
      if (g.avatarStorageId) storageIds.add(g.avatarStorageId);
    }
    return { checked: true, trackedStorageIds: storageIds.size };
  },
});
