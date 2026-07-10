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
      .collect();
    let messages = sentMessages;
    if (recipient !== userId) {
      const receivedMessages = await ctx.db.query("messages")
        .withIndex("sender", q=>q.eq("userId", recipient).eq("recipient", userId))
        .order("desc")
        .collect();
      messages = [...sentMessages, ...receivedMessages];
    }
    messages.sort((a, b) => a._creationTime - b._creationTime);
    return Promise.all(
      messages
        // Add the author's name to each message.
        .map(async (message) => {
          const { name, email } = (await ctx.db.get(message.userId))!;
          const attachmentUrl = message.attachment
            ? await ctx.storage.getUrl(message.attachment.storageId)
            : null;
          return { ...message, author: name ?? email!, attachmentUrl };
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
  },
  handler: async (ctx, { body, recipient, attachment }) => {
    const userId = await auth.getUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    // Send a new message.
    await ctx.db.insert("messages", { body, userId, recipient, attachment });
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
