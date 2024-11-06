import { ConvexError, v } from "convex/values";
import { getUserByClerkId } from "./_utils";
import { query } from "./_generated/server";

export const get = query({
  args: {
    id: v.id("conversations"),
  },
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

    const membership = await context.db
      .query("conversationMembers")
      .withIndex("by_memberId_conversationId", (query) =>
        query.eq("memberId", currentUser._id).eq("conversationId", args.id)
      )
      .unique();

    if (!membership) {
      throw new ConvexError("You aren't a member of this conversation");
    }

    const messages = await context.db
      .query("messages")
      .withIndex("by_conversationId", (query) =>
        query.eq("conversationId", args.id)
      )
      .order("desc")
      .collect();

    const messagesWithUsers = Promise.all(
      messages.map(async (message) => {
        const messageSender = await context.db.get(message.senderId);

        if (!messageSender) {
          throw new ConvexError("Could not find message sender.");
        }

        return {
          message,
          senderImage: messageSender.imageUrl,
          senderName: messageSender.username,
          isCurrentUser: messageSender._id === currentUser._id,
        };
      })
    );

    return messagesWithUsers;
  },
});
