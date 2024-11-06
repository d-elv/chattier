import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserByClerkId } from "./_utils";

export const get = query({
  args: {},
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthorised");
    }

    const currentUser = await getUserByClerkId({
      context,
      clerkId: identity.subject,
    });

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    const friendshipsOne = await context.db
      .query("friends")
      .withIndex("by_userOne", (query) => query.eq("userOne", currentUser._id))
      .collect();

    const friendshipsTwo = await context.db
      .query("friends")
      .withIndex("by_userTwo", (query) => query.eq("userTwo", currentUser._id))
      .collect();

    const friendships = [...friendshipsOne, ...friendshipsTwo];

    const friends = await Promise.all(
      friendships.map(async (friendship) => {
        const friend = await context.db.get(
          friendship.userOne === currentUser._id
            ? friendship.userTwo
            : friendship.userOne
        );

        if (!friend) {
          throw new ConvexError("Friend could not be found.");
        }

        return friend;
      })
    );
    return friends;
  },
});
