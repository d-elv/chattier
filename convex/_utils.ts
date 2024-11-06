import { MutationCtx, QueryCtx } from "./_generated/server";

export async function getUserByClerkId({
  context,
  clerkId,
}: {
  context: QueryCtx | MutationCtx;
  clerkId: string;
}) {
  return await context.db
    .query("users")
    .withIndex("by_clerkId", (query) => query.eq("clerkId", clerkId))
    .unique();
}
