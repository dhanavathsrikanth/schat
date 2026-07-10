import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

export const list = query({
  args: { recipient: v.id("users") },
  handler: async (ctx, { recipient }) => {
    const userId = (await auth.getUserId(ctx))!;

    // Grab the most recent messages.
    const sentMessages = await ctx.db.query("messages")
      .withIndex("sender", q=>q.eq("userId", userId).eq("recipient", recipient))
      .order("desc")
      .take(100);
    let messages = sentMessages;
    if (recipient !== userId) {
      const receivedMessages = await ctx.db.query("messages")
        .withIndex("sender", q=>q.eq("userId", recipient).eq("recipient", userId))
        .order("desc")
        .take(100);
      messages = [...sentMessages, ...receivedMessages];
    }
    messages.sort((a, b) => a._creationTime - b._creationTime);
    return Promise.all(
      messages
        .filter((message) => !message.expiresAt || message.expiresAt > Date.now())
        // Add the author's name to each message.
        .map(async (message) => {
          const { name, email } = (await ctx.db.get(message.userId))!;
          const attachmentUrl = message.attachment
            ? await ctx.storage.getUrl(message.attachment.storageId)
            : null;
          const reply = message.replyTo ? await ctx.db.get(message.replyTo) : null;
          return { ...message, author: name ?? email!, attachmentUrl, replyPreview: reply?.deletedAt ? "This message was deleted" : reply?.body ?? null };
        }),
    );
  },
});

export const send = mutation({
  args: {
    body: v.string(),
    recipient: v.id("users"),
    attachment: v.optional(v.object({
      storageId: v.id("_storage"),
      name: v.string(),
      contentType: v.string(),
      size: v.number(),
    })),
    replyTo: v.optional(v.id("messages")),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { body, recipient, attachment, replyTo, expiresAt }) => {
    const userId = await auth.getUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const recentMessages = await ctx.db.query("messages")
      .withIndex("by_sender", (q) => q.eq("userId", userId))
      .order("desc")
      .take(31);
    if (recentMessages.filter((message) => message._creationTime > Date.now() - 60_000).length >= 30) {
      throw new Error("Message limit reached. Please wait a minute before sending more messages.");
    }
    const blocked = await ctx.db.query("blocks").withIndex("by_user", (q) => q.eq("userId", recipient).eq("blockedUserId", userId)).unique();
    if (blocked) throw new Error("This user is not accepting messages from you");
    const maxAttachmentSize = attachment?.contentType.startsWith("video/") ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
    if (attachment && (attachment.size > maxAttachmentSize || !attachment.contentType.startsWith("image/") && !attachment.contentType.startsWith("video/") && attachment.contentType !== "application/pdf")) {
      throw new Error("Videos are limited to 10 MB. Images and PDFs are limited to 25 MB.");
    }
    await ctx.db.insert("messages", { body, userId, recipient, attachment, replyTo, expiresAt });
  },
});

export const edit = mutation({
  args: { messageId: v.id("messages"), body: v.string() },
  handler: async (ctx, { messageId, body }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const message = await ctx.db.get(messageId);
    if (!message || message.userId !== userId || message.deletedAt) throw new Error("Cannot edit this message");
    await ctx.db.patch(messageId, { body, editedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const message = await ctx.db.get(messageId);
    if (!message || message.userId !== userId) throw new Error("Cannot delete this message");
    if (message.attachment) await ctx.storage.delete(message.attachment.storageId);
    await ctx.db.patch(messageId, { deletedAt: Date.now(), body: "", attachment: undefined });
  },
});

export const toggleReaction = mutation({
  args: { messageId: v.id("messages"), emoji: v.string() },
  handler: async (ctx, { messageId, emoji }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const message = await ctx.db.get(messageId);
    if (!message || (message.userId !== userId && message.recipient !== userId)) throw new Error("Message not found");
    const reactions = message.reactions ?? [];
    const index = reactions.findIndex((reaction) => reaction.userId === userId && reaction.emoji === emoji);
    if (index >= 0) reactions.splice(index, 1); else reactions.push({ userId, emoji });
    await ctx.db.patch(messageId, { reactions });
  },
});

export const markRead = mutation({
  args: { sender: v.id("users") },
  handler: async (ctx, { sender }) => {
    const userId = await auth.getUserId(ctx);
    if (userId === null || userId === sender) return;

    const messages = await ctx.db.query("messages")
      .withIndex("sender", (q) => q.eq("userId", sender).eq("recipient", userId))
      .collect();
    const now = Date.now();
    await Promise.all(messages.filter((message) => !message.readAt).map((message) =>
      ctx.db.patch(message._id, { deliveredAt: message.deliveredAt ?? now, readAt: now }),
    ));
  },
});
