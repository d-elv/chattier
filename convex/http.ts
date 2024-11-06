import { WebhookEvent } from "@clerk/nextjs/server";
import { httpActionGeneric, httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";

const validatePayload = async (
  request: Request
): Promise<WebhookEvent | undefined> => {
  const payload = await request.text();

  const svixHeaders = {
    "svix-id": request.headers.get("svix-id")!,
    "svix-timestamp": request.headers.get("svix-timestamp")!,
    "svix-signature": request.headers.get("svix-signature")!,
  };

  const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");

  try {
    const event = webhook.verify(payload, svixHeaders) as WebhookEvent;
    return event;
  } catch (error) {
    console.error("Clerk webhook request could not be verified", error);
    return;
  }
};

const handleClerkWebook = httpActionGeneric(async (context, request) => {
  const event = await validatePayload(request);

  if (!event) {
    return new Response("Could not validate Clerk payload", {
      status: 400,
    });
  }

  switch (event.type) {
    case "user.created":
      const user = await context.runQuery(internal.user.get, {
        clerkId: event.data.id,
      });
      if (user) {
        console.log(`Updating user ${event.data.id} with ${event.data}`);
      }

    case "user.updated":
      console.log("Creating/Updating user:", event.data.id);
      await context.runMutation(internal.user.create, {
        username: `${event.data.first_name} ${event.data.last_name}`,
        imageUrl: event.data.image_url,
        clerkId: event.data.id,
        email: event.data.email_addresses[0].email_address,
      });
      break;
    default:
      console.log("Clerk webhook event not supported", event.type);
  }

  return new Response(null, {
    status: 200,
  });
});

const http = httpRouter();

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: handleClerkWebook,
});

export default http;
