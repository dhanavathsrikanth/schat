import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  messages: defineTable({
    userId: v.id("users"),
    recipient: v.id("users"),
    body: v.string(),
    attachment: v.optional(v.object({
      storageId: v.id("_storage"),
      name: v.string(),
      contentType: v.string(),
      size: v.number(),
    })),
    deliveredAt: v.optional(v.number()),
    readAt: v.optional(v.number()),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    replyTo: v.optional(v.id("messages")),
    reactions: v.optional(v.array(v.object({ userId: v.id("users"), emoji: v.string() }))),
  }).index("sender", ["userId", "recipient"])
    .index("recipient", ["recipient", "userId"])
    .index("by_sender", ["userId"]),
  keys: defineTable({
    userId: v.id("users"),
    key: v.string(),
  }).index("userId", ["userId"]),
  presence: defineTable({
    userId: v.id("users"),
    lastSeen: v.number(),
    isOnline: v.boolean(),
  }).index("userId", ["userId"]),
  typing: defineTable({
    userId: v.id("users"),
    recipient: v.id("users"),
    expiresAt: v.number(),
  }).index("sender", ["userId", "recipient"]),
  blocks: defineTable({
    userId: v.id("users"),
    blockedUserId: v.id("users"),
  }).index("by_user", ["userId", "blockedUserId"]),
});
