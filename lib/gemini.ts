import { GoogleGenAI } from "@google/genai";
import type { FaqItem } from "./sheet";

const MODEL = "gemini-3.5-flash";
const GEMINI_TIMEOUT_MS = 7_000;

export const DEFAULT_REPLY =
  "ขอบคุณที่สอบถามนะคะ/ครับ เรื่องนี้ขอให้พี่ Win เช็คให้ก่อน รบกวนโทร [เบอร์โทร Win] หรือทัก LINE ส่วนตัวได้เลยค่ะ/ครับ ถ้าด่วนแนะนำโทรเลยนะคะ";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

function buildSystemInstruction(faq: FaqItem[]): string {
  const faqBlock =
    faq.length > 0
      ? faq
          .map(
            (item) =>
              `question: ${item.question}\nanswer: ${item.answer}\ncategory: ${item.category}`
          )
          .join("\n---\n")
      : "(ไม่มีข้อมูล FAQ ในขณะนี้)";

  return `<role>
คุณคือพี่ Win ที่ปรึกษาด้านการเงินและประกันชีวิตของ AIA กำลังตอบแชทลูกค้าทาง LINE
</role>

<constraints>
- ตอบโดยใช้ข้อมูลใน <faq> เท่านั้น ห้ามแต่งราคา เบี้ยประกัน เงื่อนไข หรือเวลานัดหมายขึ้นมาเอง
- ถ้าคำถามลูกค้าไม่มีข้อมูลตรงกันใน <faq> ให้ตอบด้วย default message นี้เท่านั้น:
  "${DEFAULT_REPLY}"
- โทน: สุภาพ เป็นกันเอง เหมือนพี่ที่ปรึกษาคุยกับลูกค้า ใส่ emoji ได้บ้าง (1 อันต่อคำตอบ) แต่ไม่ต้องทุกประโยค
- ความยาวคำตอบ 1-3 ประโยค กระชับ อ่านง่าย ไม่ใช้ศัพท์การเงินซับซ้อนโดยไม่อธิบาย
- ห้ามพูดถึงหรือเปรียบเทียบกับบริษัทประกันคู่แข่งในเชิงลบ
</constraints>

<output_format>
ภาษาไทย ไม่ใช้ markdown ไม่ใช้ bullet point ตอบเป็นข้อความล้วนพร้อมส่งใน LINE ได้ทันที
</output_format>

<faq>
${faqBlock}
</faq>`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Gemini call timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function askGemini(question: string, faq: FaqItem[]): Promise<string> {
  try {
    const ai = getClient();
    const systemInstruction = buildSystemInstruction(faq);

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL,
        contents: `<question>\n${question}\n</question>`,
        config: {
          systemInstruction,
          temperature: 1.0,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      GEMINI_TIMEOUT_MS
    );

    const finishReason = response.candidates?.[0]?.finishReason;
    const thoughtsTokenCount = response.usageMetadata?.thoughtsTokenCount;
    const candidatesTokenCount = response.usageMetadata?.candidatesTokenCount;

    console.log("[gemini] usage", {
      finishReason,
      thoughtsTokenCount,
      candidatesTokenCount,
    });

    if (finishReason === "MAX_TOKENS") {
      return DEFAULT_REPLY;
    }

    const text = response.text?.trim();
    return text && text.length > 0 ? text : DEFAULT_REPLY;
  } catch (err) {
    console.error("[gemini] call failed:", err);
    return DEFAULT_REPLY;
  }
}
