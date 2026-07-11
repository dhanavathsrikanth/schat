import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    return user ? { ...user, handle: profile?.handle ?? null, about: profile?.about ?? null, avatarUrl: profile?.avatarUrl ?? null } : null;
  },
});

export const hasProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return false;
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    return !!profile;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userDocs = await ctx.db.query("users").collect();
    return Promise.all(userDocs.map(async (doc) => {
      const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", doc._id)).unique();
      const presence = await ctx.db.query("presence")
        .withIndex("userId", (q) => q.eq("userId", doc._id))
        .unique();
      return {
      _id: doc._id,
      name: doc.name,
      email: doc.email,
      handle: profile?.handle ?? null,
      about: profile?.about ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      isOnline: presence?.isOnline && presence.lastSeen > Date.now() - 60_000,
      lastSeen: presence?.lastSeen ?? null,
      };
    }));
  },
});

export const searchByHandle = query({
  args: { query: v.string() },
  handler: async (ctx, { query: searchQuery }) => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const normalized = searchQuery.trim().toLowerCase().replace(/^@/, "");
    const allProfiles = await ctx.db.query("profiles")
      .withIndex("by_handle", (q) => q.gte("handle", normalized))
      .take(50);
    const profiles = allProfiles.filter((p) => p.handle.startsWith(normalized));
    const viewerId = await auth.getUserId(ctx);
    return Promise.all(
      profiles
        .filter((p) => p.userId !== viewerId)
        .map(async (profile) => {
          const user = await ctx.db.get(profile.userId);
          const presence = await ctx.db.query("presence")
            .withIndex("userId", (q) => q.eq("userId", profile.userId))
            .unique();
          return {
            _id: profile.userId,
            name: user?.name ?? null,
            email: user?.email ?? null,
            handle: profile.handle,
            about: profile.about ?? null,
            avatarUrl: profile.avatarUrl ?? null,
            isOnline: presence?.isOnline && presence.lastSeen > Date.now() - 60_000,
            lastSeen: presence?.lastSeen ?? null,
          };
        })
    );
  },
});

export const getByHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const normalized = handle.trim().toLowerCase().replace(/^@/, "");
    const profile = await ctx.db.query("profiles").withIndex("by_handle", (q) => q.eq("handle", normalized)).unique();
    if (!profile) return null;
    const user = await ctx.db.get(profile.userId);
    const presence = await ctx.db.query("presence")
      .withIndex("userId", (q) => q.eq("userId", profile.userId))
      .unique();
    return {
      _id: profile.userId,
      name: user?.name ?? null,
      email: user?.email ?? null,
      handle: profile.handle,
      about: profile.about ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      isOnline: presence?.isOnline && presence.lastSeen > Date.now() - 60_000,
      lastSeen: presence?.lastSeen ?? null,
    };
  },
});

export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    return userId ? await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique() : null;
  },
});

export const setHandle = mutation({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const normalized = handle.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9_]{3,24}$/.test(normalized)) throw new Error("Use 3–24 lowercase letters, numbers, or underscores.");
    const taken = await ctx.db.query("profiles").withIndex("by_handle", (q) => q.eq("handle", normalized)).unique();
    if (taken && taken.userId !== userId) throw new Error("That username is already taken.");
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (profile) await ctx.db.patch(profile._id, { handle: normalized });
    else await ctx.db.insert("profiles", { userId, handle: normalized });
  },
});

export const updateProfile = mutation({
  args: { about: v.optional(v.string()), avatarUrl: v.optional(v.string()) },
  handler: async (ctx, { about, avatarUrl }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (!profile) throw new Error("No profile found. Set a username first.");
    const updates: { about?: string; avatarUrl?: string } = {};
    if (about !== undefined) updates.about = about;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    await ctx.db.patch(profile._id, updates);
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
  args: { key: v.string(), deviceId: v.optional(v.string()) },
  handler: async (ctx, { key, deviceId }) => {
    const userId = await auth.getUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const deviceTag = deviceId ?? "default";
    const existing = await ctx.db.query("keys")
      .withIndex("by_device", (q) => q.eq("userId", userId).eq("deviceId", deviceTag))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { key });
    } else {
      const keyCount = await ctx.db.query("keys")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();
      const nextVersion = keyCount.length + 1;
      await ctx.db.insert("keys", { userId, key, deviceId: deviceTag, rotationVersion: nextVersion });
    }
  },
});

export const getPublicKey = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const keys = await ctx.db.query("keys")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    if (keys.length === 0) return null;
    return keys[keys.length - 1].key;
  },
});

export const getAllPublicKeys = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const keys = await ctx.db.query("keys")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    return keys.map((k) => ({ key: k.key, deviceId: k.deviceId, version: k.rotationVersion }));
  },
});

export const rotateKey = mutation({
  args: { newKey: v.string() },
  handler: async (ctx, { newKey }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existingKeys = await ctx.db.query("keys")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const maxVersion = existingKeys.reduce((max, k) => Math.max(max, k.rotationVersion ?? 0), 0);
    await ctx.db.insert("keys", {
      userId,
      key: newKey,
      deviceId: `rotated-${Date.now()}`,
      rotationVersion: maxVersion + 1,
    });
  },
});

// Push notification subscriptions
export const subscribePush = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() },
  handler: async (ctx, { endpoint, p256dh, auth: authKey }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint)).unique();
    if (!existing) {
      await ctx.db.insert("pushSubscriptions", { userId, endpoint, p256dh, auth: authKey });
    }
  },
});

export const unsubscribePush = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const existing = await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint)).unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const getPushSubscriptions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.query("pushSubscriptions").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
  },
});

// Contacts
export const addContact = mutation({
  args: { contactUserId: v.id("users") },
  handler: async (ctx, { contactUserId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    if (userId === contactUserId) throw new Error("Cannot add yourself as a contact");
    const existing = await ctx.db.query("contacts")
      .withIndex("by_user_contact", (q) => q.eq("userId", userId).eq("contactUserId", contactUserId))
      .unique();
    if (existing) return false;
    await ctx.db.insert("contacts", { userId, contactUserId, addedAt: Date.now() });
    return true;
  },
});

export const removeContact = mutation({
  args: { contactUserId: v.id("users") },
  handler: async (ctx, { contactUserId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const existing = await ctx.db.query("contacts")
      .withIndex("by_user_contact", (q) => q.eq("userId", userId).eq("contactUserId", contactUserId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const getContacts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const contacts = await ctx.db.query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return Promise.all(
      contacts.map(async (contact) => {
        const user = await ctx.db.get(contact.contactUserId);
        const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", contact.contactUserId)).unique();
        const presence = await ctx.db.query("presence")
          .withIndex("userId", (q) => q.eq("userId", contact.contactUserId))
          .unique();
        return {
          _id: contact.contactUserId,
          name: user?.name ?? null,
          email: user?.email ?? null,
          handle: profile?.handle ?? null,
          avatarUrl: profile?.avatarUrl ?? null,
          isOnline: presence?.isOnline && presence.lastSeen > Date.now() - 60_000,
          lastSeen: presence?.lastSeen ?? null,
        };
      })
    );
  },
});

export const isContact = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: contactUserId }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return false;
    return !!(await ctx.db.query("contacts")
      .withIndex("by_user_contact", (q) => q.eq("userId", userId).eq("contactUserId", contactUserId))
      .unique());
  },
});
