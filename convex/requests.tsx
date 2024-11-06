import { ConvexError } from "convex/values";
import { query } from "./_generated/server";
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

    const requests = await context.db
      .query("requests")
      .withIndex("by_receiver", (query) =>
        query.eq("receiver", currentUser._id)
      )
      .collect();

    const requestsWithSender = await Promise.all(
      requests.map(async (request) => {
        const sender = await context.db.get(request.sender);

        if (!sender) {
          throw new ConvexError("Request sender could not be found");
        }

        return { sender, request };
      })
    );

    return requestsWithSender;
  },
});

export const count = query({
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

    const requests = await context.db
      .query("requests")
      .withIndex("by_receiver", (query) =>
        query.eq("receiver", currentUser._id)
      )
      .collect();

    return requests.length;
  },
});
