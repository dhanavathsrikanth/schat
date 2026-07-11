import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

export const create = mutation({
  args: {
    name: v.string(),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, { name, memberIds }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    if (!name.trim()) throw new Error("Group name is required");
    const uniqueMembers = [...new Set([userId, ...memberIds])];
    if (uniqueMembers.length < 2) throw new Error("A group needs at least 2 members");
    const groupId = await ctx.db.insert("groups", {
      name: name.trim(),
      createdBy: userId,
      createdAt: Date.now(),
    });
    for (const memberId of uniqueMembers) {
      await ctx.db.insert("groupMembers", {
        groupId,
        userId: memberId,
        role: memberId === userId ? "admin" : "member",
        joinedAt: Date.now(),
      });
    }
    return groupId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db.query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return Promise.all(
      memberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId);
        if (!group) return null;
        const members = await ctx.db.query("groupMembers")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();
        const memberDetails = await Promise.all(
          members.map(async (m) => {
            const user = await ctx.db.get(m.userId);
            const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", m.userId)).unique();
            return {
              userId: m.userId,
              name: user?.name ?? null,
              email: user?.email ?? null,
              handle: profile?.handle ?? null,
              role: m.role,
            };
          })
        );
        return {
          _id: group._id,
          name: group.name,
          createdBy: group.createdBy,
          createdAt: group.createdAt,
          role: membership.role,
          members: memberDetails,
          memberCount: members.length,
        };
      })
    );
  },
});

export const getMembers = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const membership = await ctx.db.query("groupMembers")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
      .unique();
    if (!membership) return [];
    const members = await ctx.db.query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    return Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", m.userId)).unique();
        return {
          userId: m.userId,
          name: user?.name ?? null,
          email: user?.email ?? null,
          handle: profile?.handle ?? null,
          role: m.role,
        };
      })
    );
  },
});

export const addMember = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, { groupId, userId: newMemberId }) => {
    const callerId = await auth.getUserId(ctx);
    if (!callerId) throw new Error("Not signed in");
    const callerMembership = await ctx.db.query("groupMembers")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", callerId))
      .unique();
    if (!callerMembership || callerMembership.role !== "admin") throw new Error("Only admins can add members");
    const existing = await ctx.db.query("groupMembers")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", newMemberId))
      .unique();
    if (existing) throw new Error("User is already a member");
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: newMemberId,
      role: "member",
      joinedAt: Date.now(),
    });
  },
});

export const removeMember = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, { groupId, userId: removeUserId }) => {
    const callerId = await auth.getUserId(ctx);
    if (!callerId) throw new Error("Not signed in");
    const callerMembership = await ctx.db.query("groupMembers")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", callerId))
      .unique();
    if (!callerMembership) throw new Error("Not a member of this group");
    if (callerMembership.role !== "admin" && callerId !== removeUserId) throw new Error("Only admins can remove others");
    const target = await ctx.db.query("groupMembers")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", removeUserId))
      .unique();
    if (target) await ctx.db.delete(target._id);
  },
});

export const sendMessage = mutation({
  args: {
    groupId: v.id("groups"),
    body: v.string(),
    attachment: v.optional(v.object({
      storageId: v.id("_storage"),
      name: v.string(),
      contentType: v.string(),
      size: v.number(),
    })),
    replyTo: v.optional(v.id("groupMessages")),
    expiresAt: v.optional(v.number()),
    isVoiceNote: v.optional(v.boolean()),
  },
  handler: async (ctx, { groupId, body, attachment, replyTo, expiresAt, isVoiceNote }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const membership = await ctx.db.query("groupMembers")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
      .unique();
    if (!membership) throw new Error("Not a member of this group");
    if (body.length > 5000) throw new Error("Message too long");
    await ctx.db.insert("groupMessages", {
      groupId,
      userId,
      body,
      attachment,
      replyTo,
      expiresAt,
      isVoiceNote,
    });
  },
});

export const listMessages = query({
  args: { groupId: v.id("groups"), limit: v.optional(v.number()) },
  handler: async (ctx, { groupId, limit }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const membership = await ctx.db.query("groupMembers")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
      .unique();
    if (!membership) return [];
    const messageLimit = Math.min(limit ?? 100, 100);
    const messages = await ctx.db.query("groupMessages")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(messageLimit);
    messages.reverse();
    return Promise.all(
      messages
        .filter((m) => !m.expiresAt || m.expiresAt > Date.now())
        .map(async (message) => {
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
        })
    );
  },
});

export const toggleReaction = mutation({
  args: { messageId: v.id("groupMessages"), emoji: v.string() },
  handler: async (ctx, { messageId, emoji }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");
    const membership = await ctx.db.query("groupMembers")
      .withIndex("by_group_user", (q) => q.eq("groupId", message.groupId).eq("userId", userId))
      .unique();
    if (!membership) throw new Error("Not a member of this group");
    const reactions = message.reactions ?? [];
    const index = reactions.findIndex((r) => r.userId === userId && r.emoji === emoji);
    if (index >= 0) reactions.splice(index, 1);
    else reactions.push({ userId, emoji });
    await ctx.db.patch(messageId, { reactions });
  },
});

export const deleteMessage = mutation({
  args: { messageId: v.id("groupMessages") },
  handler: async (ctx, { messageId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const message = await ctx.db.get(messageId);
    if (!message || message.userId !== userId) throw new Error("Cannot delete this message");
    if (message.attachment) await ctx.storage.delete(message.attachment.storageId);
    await ctx.db.patch(messageId, { deletedAt: Date.now(), body: "", attachment: undefined });
  },
});

export const leaveGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const membership = await ctx.db.query("groupMembers")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
      .unique();
    if (!membership) throw new Error("Not a member");
    await ctx.db.delete(membership._id);
  },
});

export const deleteGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const group = await ctx.db.get(groupId);
    if (!group || group.createdBy !== userId) throw new Error("Only the creator can delete the group");
    const members = await ctx.db.query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);
    const messages = await ctx.db.query("groupMessages")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    for (const m of messages) {
      if (m.attachment) await ctx.storage.delete(m.attachment.storageId);
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(groupId);
  },
});

export const conversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db.query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const conversations = [];
    for (const membership of memberships) {
      const group = await ctx.db.get(membership.groupId);
      if (!group) continue;
      const lastRead = await ctx.db.query("groupReads")
        .withIndex("by_group_user", (q) => q.eq("groupId", membership.groupId).eq("userId", userId))
        .unique();
      const lastMessage = await ctx.db.query("groupMessages")
        .withIndex("by_group", (q) => q.eq("groupId", membership.groupId))
        .order("desc")
        .take(1);
      const unread = lastRead
        ? (await ctx.db.query("groupMessages")
            .withIndex("by_group", (q) => q.eq("groupId", membership.groupId))
            .order("desc")
            .take(20))
            .filter((m) => m._creationTime > lastRead.lastReadAt && m.userId !== userId && !m.deletedAt).length
        : lastMessage.length > 0 ? 1 : 0;
      conversations.push({
        groupId: group._id,
        name: group.name,
        lastMessage: lastMessage[0] && !lastMessage[0].deletedAt ? lastMessage[0].body : "",
        lastMessageTime: lastMessage[0]?._creationTime ?? group.createdAt,
        unreadCount: unread,
        memberCount: (await ctx.db.query("groupMembers").withIndex("by_group", (q) => q.eq("groupId", membership.groupId)).collect()).length,
        role: membership.role,
      });
    }
    conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    return conversations;
  },
});

export const markGroupRead = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db.query("groupReads")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { lastReadAt: Date.now() });
    else await ctx.db.insert("groupReads", { groupId, userId, lastReadAt: Date.now() });
  },
});
