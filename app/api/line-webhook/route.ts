import { NextRequest, NextResponse } from "next/server";
import { validateSignature, type WebhookEvent } from "@line/bot-sdk";
import { getFaq } from "@/lib/sheet";
import { askGemini, DEFAULT_REPLY } from "@/lib/gemini";
import { replyText } from "@/lib/line";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-line-signature");
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!signature || !channelSecret) {
    console.warn("[line-webhook] missing signature or channel secret");
    return new NextResponse(null, { status: 401 });
  }

  const rawBody = await request.text();

  let isValid = false;
  try {
    isValid = validateSignature(rawBody, channelSecret, signature);
  } catch {
    isValid = false;
  }

  if (!isValid) {
    console.warn("[line-webhook] signature validation failed");
    return new NextResponse(null, { status: 401 });
  }

  let events: WebhookEvent[] = [];
  try {
    events = JSON.parse(rawBody).events ?? [];
  } catch (err) {
    console.error("[line-webhook] failed to parse body:", err);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Always resolve 200 to LINE even if individual events fail, so LINE does
  // not retry the webhook delivery.
  await Promise.all(
    events.map(async (event) => {
      if (event.type !== "message" || event.message.type !== "text") {
        return;
      }

      const { replyToken } = event;
      try {
        const userMessage = event.message.text;
        const faq = await getFaq();
        const reply = await askGemini(userMessage, faq);
        await replyText(replyToken, reply);
      } catch (err) {
        console.error("[line-webhook] failed to handle event:", err);
        await replyText(replyToken, DEFAULT_REPLY);
      }
    })
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}
