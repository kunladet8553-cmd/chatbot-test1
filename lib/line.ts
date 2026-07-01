import { messagingApi } from "@line/bot-sdk";

const { MessagingApiClient } = messagingApi;

let client: InstanceType<typeof MessagingApiClient> | null = null;

export function getLineClient(): InstanceType<typeof MessagingApiClient> {
  if (!client) {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
      throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
    }
    client = new MessagingApiClient({ channelAccessToken });
  }
  return client;
}

export async function replyText(replyToken: string, text: string): Promise<void> {
  const lineClient = getLineClient();
  try {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: "text", text }],
    });
  } catch (err) {
    // replyToken is single-use and short-lived — if this fails the customer
    // cannot be reached via reply anymore, so just log and move on.
    console.error("[line] replyMessage failed:", err);
  }
}

export async function notifyAdmin(text: string): Promise<void> {
  const adminUserId = process.env.ADMIN_LINE_USER_ID;
  if (!adminUserId) return;

  const lineClient = getLineClient();
  try {
    await lineClient.pushMessage({
      to: adminUserId,
      messages: [{ type: "text", text }],
    });
  } catch (err) {
    console.error("[line] notifyAdmin push failed:", err);
  }
}
