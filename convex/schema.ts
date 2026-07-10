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
  }).index("sender", ["userId", "recipient"]),
  keys: defineTable({
    userId: v.id("users"),
    key: v.string(),
  }).index("userId", ["userId"]),
});
