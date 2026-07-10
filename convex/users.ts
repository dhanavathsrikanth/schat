import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    return userId !== null ? ctx.db.get(userId) : null;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userDocs = await ctx.db.query("users").collect();
    return Promise.all(userDocs.map(async (doc) => {
      const presence = await ctx.db.query("presence")
        .withIndex("userId", (q) => q.eq("userId", doc._id))
        .unique();
      return {
      _id: doc._id,
      name: doc.name,
      email: doc.email,
      isOnline: presence?.isOnline && presence.lastSeen > Date.now() - 60_000,
      lastSeen: presence?.lastSeen ?? null,
      };
    }));
  },
});

export const heartbeat = mutation({
  args: { isOnline: v.boolean() },
  handler: async (ctx, { isOnline }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db.query("presence").withIndex("userId", (q) => q.eq("userId", userId)).unique();
    if (existing) await ctx.db.patch(existing._id, { isOnline, lastSeen: Date.now() });
    else await ctx.db.insert("presence", { userId, isOnline, lastSeen: Date.now() });
  },
});

export const toggleBlock = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: blockedUserId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId || userId === blockedUserId) throw new Error("Invalid block request");
    const existing = await ctx.db.query("blocks").withIndex("by_user", (q) => q.eq("userId", userId).eq("blockedUserId", blockedUserId)).unique();
    if (existing) { await ctx.db.delete(existing._id); return false; }
    await ctx.db.insert("blocks", { userId, blockedUserId });
    return true;
  },
});

export const blocked = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: blockedUserId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return false;
    return !!(await ctx.db.query("blocks").withIndex("by_user", (q) => q.eq("userId", userId).eq("blockedUserId", blockedUserId)).unique());
  },
});

export const setTyping = mutation({
  args: { recipient: v.id("users"), isTyping: v.boolean() },
  handler: async (ctx, { recipient, isTyping }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId || userId === recipient) return;
    const existing = await ctx.db.query("typing").withIndex("sender", (q) => q.eq("userId", userId).eq("recipient", recipient)).unique();
    if (!isTyping) { if (existing) await ctx.db.delete(existing._id); return; }
    const expiresAt = Date.now() + 5000;
    if (existing) await ctx.db.patch(existing._id, { expiresAt });
    else await ctx.db.insert("typing", { userId, recipient, expiresAt });
  },
});

export const isTyping = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewer = await auth.getUserId(ctx);
    if (!viewer) return false;
    const typing = await ctx.db.query("typing").withIndex("sender", (q) => q.eq("userId", userId).eq("recipient", viewer)).unique();
    return !!typing && typing.expiresAt > Date.now();
  },
});

export const storeKey = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const userId = await auth.getUserId(ctx);
    if (userId === null) {
      throw new Error("Not signed in");
    }
    const keyDoc = await ctx.db.query("keys")
      .withIndex("userId", q => q.eq("userId", userId))
      .unique();
    if (keyDoc) {
      await ctx.db.patch(keyDoc._id, { key });
    } else {
      await ctx.db.insert("keys", { userId, key });
    }
  },
});

export const getPublicKey = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const keyDoc = await ctx.db.query("keys")
      .withIndex("userId", q => q.eq("userId", userId))
      .unique();
    return keyDoc?.key ?? null;
  },
});
