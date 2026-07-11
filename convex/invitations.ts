import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const existing = await ctx.db.query("invitations")
      .withIndex("by_inviter", (q) => q.eq("inviterUserId", userId))
      .filter((q) => q.eq(q.field("usedBy"), undefined))
      .take(1);
    if (existing.length > 0) return existing[0];

    const code = generateCode();
    const inviteId = await ctx.db.insert("invitations", {
      inviterUserId: userId,
      code,
      createdAt: Date.now(),
    });
    return await ctx.db.get(inviteId);
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const invite = await ctx.db.query("invitations")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!invite) return null;
    const inviter = await ctx.db.get(invite.inviterUserId);
    const profile = await ctx.db.query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", invite.inviterUserId))
      .unique();
    return {
      ...invite,
      inviterName: inviter?.name ?? inviter?.email ?? "Someone",
      inviterHandle: profile?.handle ?? null,
    };
  },
});

export const claim = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const invite = await ctx.db.query("invitations")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!invite) throw new Error("Invalid invite code");
    if (invite.usedBy) throw new Error("This invite has already been used");
    if (invite.inviterUserId === userId) throw new Error("You can't use your own invite");

    await ctx.db.patch(invite._id, { usedBy: userId, usedAt: Date.now() });
    return { inviterUserId: invite.inviterUserId };
  },
});

export const myInvites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    return await ctx.db.query("invitations")
      .withIndex("by_inviter", (q) => q.eq("inviterUserId", userId))
      .collect();
  },
});
