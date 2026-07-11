import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

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
    isVoiceNote: v.optional(v.boolean()),
  }).index("sender", ["userId", "recipient"])
    .index("recipient", ["recipient", "userId"])
    .index("by_sender", ["userId"])
    .index("search_body", ["body"]),
  keys: defineTable({
    userId: v.id("users"),
    key: v.string(),
    deviceId: v.optional(v.string()),
    rotationVersion: v.optional(v.number()),
  }).index("userId", ["userId"])
    .index("by_device", ["userId", "deviceId"]),
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
  profiles: defineTable({
    userId: v.id("users"),
    handle: v.string(),
    about: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }).index("by_user", ["userId"])
    .index("by_handle", ["handle"]),
  groups: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    avatarStorageId: v.optional(v.id("_storage")),
  }).index("by_creator", ["createdBy"]),
  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
  }).index("by_group", ["groupId"])
    .index("by_user", ["userId"])
    .index("by_group_user", ["groupId", "userId"]),
  groupMessages: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    body: v.string(),
    attachment: v.optional(v.object({
      storageId: v.id("_storage"),
      name: v.string(),
      contentType: v.string(),
      size: v.number(),
    })),
    deletedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    replyTo: v.optional(v.id("groupMessages")),
    reactions: v.optional(v.array(v.object({ userId: v.id("users"), emoji: v.string() }))),
    isVoiceNote: v.optional(v.boolean()),
  }).index("by_group", ["groupId"])
    .index("by_sender", ["userId"]),
  contacts: defineTable({
    userId: v.id("users"),
    contactUserId: v.id("users"),
    addedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_contact", ["contactUserId"])
    .index("by_user_contact", ["userId", "contactUserId"]),
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  }).index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),
  groupReads: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    lastReadAt: v.number(),
  }).index("by_group_user", ["groupId", "userId"]),
  invitations: defineTable({
    inviterUserId: v.id("users"),
    code: v.string(),
    createdAt: v.number(),
    usedBy: v.optional(v.id("users")),
    usedAt: v.optional(v.number()),
  }).index("by_code", ["code"])
    .index("by_inviter", ["inviterUserId"]),
});
