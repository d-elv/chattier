import { ConvexError, v } from "convex/values";
import { getUserByClerkId } from "./_utils";
import { mutation } from "./_generated/server";

export const create = mutation({
  args: {
    email: v.string(),
  },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();

    if (!identity) {
      throw new ConvexError("Unauthorised.");
    }

    if (args.email === identity.email) {
      throw new ConvexError("Can't friend yourself!");
    }

    const currentUser = await getUserByClerkId({
      context,
      clerkId: identity.subject,
    });

    if (!currentUser) {
      throw new ConvexError("User not found.");
    }

    const receiver = await context.db
      .query("users")
      .withIndex("by_email", (query) => query.eq("email", args.email))
      .unique();

    if (!receiver) {
      throw new ConvexError("User could not be found.");
    }

    const requestAlreadySent = await context.db
      .query("requests")
      .withIndex("by_receiver_sender", (query) =>
        query.eq("receiver", receiver._id).eq("sender", currentUser._id)
      )
      .unique();

    if (requestAlreadySent) {
      throw new ConvexError("Request already sent.");
    }

    const requestAlreadyReceived = await context.db
      .query("requests")
      .withIndex("by_receiver_sender", (query) =>
        query.eq("receiver", currentUser._id).eq("sender", receiver._id)
      )
      .unique();

    if (requestAlreadyReceived) {
      throw new ConvexError(
        "This user has already sent you a request. Go accept it!"
      );
    }

    const friendsOne = await context.db
      .query("friends")
      .withIndex("by_userOne", (query) => query.eq("userOne", currentUser._id))
      .collect();

    const friendsTwo = await context.db
      .query("friends")
      .withIndex("by_userTwo", (query) => query.eq("userTwo", currentUser._id))
      .collect();

    if (
      friendsOne.some((friend) => friend.userTwo === receiver._id) ||
      friendsTwo.some((friend) => friend.userOne === receiver._id)
    ) {
      throw new ConvexError("You are already friends with this user.");
    }
    const request = await context.db.insert("requests", {
      sender: currentUser._id,
      receiver: receiver._id,
    });
    return request;
  },
});

export const deny = mutation({
  args: {
    id: v.id("requests"),
  },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();

    if (!identity) {
      throw new ConvexError("Unauthorised.");
    }

    const currentUser = await getUserByClerkId({
      context,
      clerkId: identity.subject,
    });

    if (!currentUser) {
      throw new ConvexError("User not found.");
    }

    const request = await context.db.get(args.id);

    if (!request || request.receiver !== currentUser._id) {
      throw new ConvexError("There was an error denying this request.");
    }

    await context.db.delete(request._id);
  },
});

export const accept = mutation({
  args: {
    id: v.id("requests"),
  },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();

    if (!identity) {
      throw new ConvexError("Unauthorised.");
    }

    const currentUser = await getUserByClerkId({
      context,
      clerkId: identity.subject,
    });

    if (!currentUser) {
      throw new ConvexError("User not found.");
    }

    const request = await context.db.get(args.id);

    if (!request || request.receiver !== currentUser._id) {
      throw new ConvexError("There was an error accepting this request.");
    }

    const conversationId = await context.db.insert("conversations", {
      isGroup: false,
    });

    await context.db.insert("friends", {
      userOne: currentUser._id,
      userTwo: request.sender,
      conversationId,
    });

    await context.db.insert("conversationMembers", {
      memberId: currentUser._id,
      conversationId,
    });
    await context.db.insert("conversationMembers", {
      memberId: request.sender,
      conversationId,
    });

    await context.db.delete(request._id);
  },
});
