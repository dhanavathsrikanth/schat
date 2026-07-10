import { mutation } from "./_generated/server";
import { auth } from "./auth";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    if ((await auth.getUserId(ctx)) === null) {
      throw new Error("Not signed in");
    }
    return await ctx.storage.generateUploadUrl();
  },
});
