import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";

export const list = query({
  args: {
    recipient: v.id("users"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { recipient, limit, cursor }) => {
    const userId = (await auth.getUserId(ctx))!;
    const messageLimit = Math.min(limit ?? 100, 100);
    const after = cursor ?? 0;

    const sentMessages = await ctx.db.query("messages")
      .withIndex("sender", (q) => q.eq("userId", userId).eq("recipient", recipient))
      .order("desc")
      .take(messageLimit);
    let messages = sentMessages;
    if (recipient !== userId) {
      const receivedMessages = await ctx.db.query("messages")
        .withIndex("sender", (q) => q.eq("userId", recipient).eq("recipient", userId))
        .order("desc")
        .take(messageLimit);
      messages = [...sentMessages, ...receivedMessages];
    }
    messages.sort((a, b) => a._creationTime - b._creationTime);
    const filtered = messages.filter(
      (m) => (after === 0 || m._creationTime > after) &&
        (!m.expiresAt || m.expiresAt > Date.now())
    );
    return Promise.all(
      filtered.map(async (message) => {
        const { name, email } = (await ctx.db.get(message.userId))!;
        const attachmentUrl = message.attachment
          ? await ctx.storage.getUrl(message.attachment.storageId)
          : null;
        const reply = message.replyTo ? await ctx.db.get(message.replyTo) : null;
        return {
          ...message,
          author: name ?? email!,
          attachmentUrl,
          replyPreview: reply?.deletedAt ? "This message was deleted" : reply?.body ?? null,
        };
      }),
    );
  },
});

export const search = query({
  args: { query: v.string(), recipient: v.optional(v.id("users")) },
  handler: async (ctx, { query: searchQuery, recipient }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId || !searchQuery.trim()) return [];
    const term = searchQuery.trim().toLowerCase();

    let allMessages: Array<{
      _id: any; _creationTime: number; userId: any; body: string;
      attachment?: any; deletedAt?: number; expiresAt?: number;
    }> = [];

    if (recipient) {
      const sent = await ctx.db.query("messages")
        .withIndex("sender", (q) => q.eq("userId", userId).eq("recipient", recipient))
        .order("desc")
        .take(100);
      const received = await ctx.db.query("messages")
        .withIndex("sender", (q) => q.eq("userId", recipient).eq("recipient", userId))
        .order("desc")
        .take(100);
      allMessages = [...sent, ...received];
    } else {
      const sent = await ctx.db.query("messages")
        .withIndex("by_sender", (q) => q.eq("userId", userId))
        .order("desc")
        .take(200);
      allMessages = sent;
    }

    const matched = allMessages.filter(
      (m) => !m.deletedAt && m.body.toLowerCase().includes(term)
    ).slice(0, 50);

    return Promise.all(
      matched.map(async (message) => {
        const user = (await ctx.db.get(message.userId)) as { name?: string; email?: string } | null;
        return {
          ...message,
          author: user?.name ?? user?.email ?? "Unknown",
        };
      })
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
    isVoiceNote: v.optional(v.boolean()),
  },
  handler: async (ctx, { body, recipient, attachment, replyTo, expiresAt, isVoiceNote }) => {
    const userId = await auth.getUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
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
    if (attachment && (attachment.size > maxAttachmentSize || !attachment.contentType.startsWith("image/") && !attachment.contentType.startsWith("video/") && !attachment.contentType.startsWith("audio/") && attachment.contentType !== "application/pdf")) {
      throw new Error("Videos are limited to 10 MB. Images, audio, and PDFs are limited to 25 MB.");
    }
    await ctx.db.insert("messages", { body, userId, recipient, attachment, replyTo, expiresAt, isVoiceNote });
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

export const conversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const userDocs = await ctx.db.query("users").collect();
    const conversations = [];
    for (const other of userDocs) {
      if (other._id === userId) continue;
      const sent = await ctx.db.query("messages")
        .withIndex("sender", (q) => q.eq("userId", userId).eq("recipient", other._id))
        .order("desc")
        .take(1);
      const received = await ctx.db.query("messages")
        .withIndex("sender", (q) => q.eq("userId", other._id).eq("recipient", userId))
        .order("desc")
        .take(1);
      const latest = sent[0] && received[0]
        ? (sent[0]._creationTime > received[0]._creationTime ? sent[0] : received[0])
        : sent[0] ?? received[0];
      if (!latest) continue;
      const unread = received.filter(
        (m) => !m.readAt && !m.deletedAt && (!m.expiresAt || m.expiresAt > Date.now())
      ).length;
      const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", other._id)).unique();
      const presence = await ctx.db.query("presence").withIndex("userId", (q) => q.eq("userId", other._id)).unique();
      conversations.push({
        userId: other._id,
        name: other.name ?? other.email ?? "Unknown",
        handle: profile?.handle ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        isOnline: presence?.isOnline && presence.lastSeen > Date.now() - 60_000,
        lastMessage: latest.deletedAt ? "" : latest.body,
        lastMessageTime: latest._creationTime,
        unreadCount: unread,
        isVoiceNote: latest.isVoiceNote ?? false,
      });
    }
    conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    return conversations;
  },
});

export const unreadCount = query({
  args: { sender: v.id("users") },
  handler: async (ctx, { sender }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId || userId === sender) return 0;
    const messages = await ctx.db.query("messages")
      .withIndex("sender", (q) => q.eq("userId", sender).eq("recipient", userId))
      .collect();
    return messages.filter(
      (m) => !m.readAt && !m.deletedAt && (!m.expiresAt || m.expiresAt > Date.now())
    ).length;
  },
});

export const forward = mutation({
  args: {
    messageId: v.id("messages"),
    recipient: v.id("users"),
  },
  handler: async (ctx, { messageId, recipient }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const original = await ctx.db.get(messageId);
    if (!original || original.deletedAt) throw new Error("Message not found");
    const blocked = await ctx.db.query("blocks").withIndex("by_user", (q) => q.eq("userId", recipient).eq("blockedUserId", userId)).unique();
    if (blocked) throw new Error("This user is not accepting messages from you");
    await ctx.db.insert("messages", {
      body: original.body,
      userId,
      recipient,
      attachment: original.attachment,
      isVoiceNote: original.isVoiceNote,
    });
  },
});
