import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const create = internalMutation({
  args: {
    username: v.string(),
    imageUrl: v.string(),
    clerkId: v.string(),
    email: v.string(),
  },
  handler: async (context, args) => {
    await context.db.insert("users", args);
  },
});

export const get = internalQuery({
  args: { clerkId: v.string() },
  async handler(context, args) {
    return context.db
      .query("users")
      .withIndex("by_clerkId", (query) => query.eq("clerkId", args.clerkId))
      .unique();
  },
});
