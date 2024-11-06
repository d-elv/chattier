import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserByClerkId } from "./_utils";

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

    const conversation = await context.db.get(args.id);

    if (!conversation) {
      throw new ConvexError("Conversation not found.");
    }

    const membership = await context.db
      .query("conversationMembers")
      .withIndex("by_memberId_conversationId", (query) =>
        query
          .eq("memberId", currentUser._id)
          .eq("conversationId", conversation._id)
      )
      .unique();

    if (!membership) {
      throw new ConvexError("You aren't a member of this conversation");
    }

    const allConversationMemberships = await context.db
      .query("conversationMembers")
      .withIndex("by_conversationId", (query) =>
        query.eq("conversationId", args.id)
      )
      .collect();

    if (!conversation.isGroup) {
      const otherMembership = allConversationMemberships.filter(
        (membership) => membership.memberId !== currentUser._id
      )[0];

      const otherMemberDetails = await context.db.get(otherMembership.memberId);

      return {
        ...conversation,
        otherMember: {
          ...otherMemberDetails,
          lastSeenMessageId: otherMembership.lastSeenMessage,
        },
        otherMembers: null,
      };
    } else {
      const otherMembers = await Promise.all(
        allConversationMemberships
          .filter((membership) => membership.memberId !== currentUser._id)
          .map(async (membership) => {
            const member = await context.db.get(membership.memberId);

            if (!member) {
              throw new ConvexError("Member could not be found.");
            }

            return {
              _id: member._id,
              username: member.username,
            };
          })
      );

      return { ...conversation, otherMembers, otherMember: null };
    }
  },
});

export const createGroup = mutation({
  args: {
    members: v.array(v.id("users")),
    name: v.string(),
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

    const conversationId = await context.db.insert("conversations", {
      isGroup: true,
      name: args.name,
    });

    await Promise.all(
      [...args.members, currentUser._id].map(async (memberId) => {
        await context.db.insert("conversationMembers", {
          memberId,
          conversationId,
        });
      })
    );
  },
});

export const deleteGroup = mutation({
  args: {
    conversationId: v.id("conversations"),
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

    const conversation = await context.db.get(args.conversationId);

    if (!conversation) {
      throw new ConvexError("Conversation not found.");
    }

    const memberships = await context.db
      .query("conversationMembers")
      .withIndex("by_conversationId", (query) =>
        query.eq("conversationId", args.conversationId)
      )
      .collect();

    if (!memberships || memberships.length <= 1) {
      throw new ConvexError("This conversation does not have any members.");
    }

    const messages = await context.db
      .query("messages")
      .withIndex("by_conversationId", (query) =>
        query.eq("conversationId", args.conversationId)
      )
      .collect();

    await context.db.delete(args.conversationId);

    await Promise.all(
      memberships.map(async (membership) => {
        await context.db.delete(membership._id);
      })
    );

    await Promise.all(
      messages.map(async (message) => {
        await context.db.delete(message._id);
      })
    );
  },
});

export const leaveGroup = mutation({
  args: {
    conversationId: v.id("conversations"),
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

    const conversation = await context.db.get(args.conversationId);

    if (!conversation) {
      throw new ConvexError("Conversation not found.");
    }

    const membership = await context.db
      .query("conversationMembers")
      .withIndex("by_memberId_conversationId", (query) =>
        query
          .eq("memberId", currentUser._id)
          .eq("conversationId", args.conversationId)
      )
      .unique();

    if (!membership) {
      throw new ConvexError("You are not a member of this group.");
    }

    await context.db.delete(membership._id);
  },
});

export const markRead = mutation({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
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
        query
          .eq("memberId", currentUser._id)
          .eq("conversationId", args.conversationId)
      )
      .unique();

    if (!membership) {
      throw new ConvexError("You are not a member of this group.");
    }

    const lastMessage = await context.db.get(args.messageId);

    await context.db.patch(membership._id, {
      lastSeenMessage: lastMessage ? lastMessage._id : undefined,
    });
  },
});
