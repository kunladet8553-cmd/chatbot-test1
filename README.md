# chatbot-test1

LINE bot ที่ตอบลูกค้าในนาม "พี่ Win ที่ปรึกษาประกันชีวิต AIA" โดยอ้างอิงเฉพาะ FAQ จาก Google Sheet และตอบด้วย Gemini

## Stack

- Next.js 14 (App Router) + TypeScript
- `@line/bot-sdk` — รับ/ตอบ webhook ของ LINE Messaging API
- `@google/genai` — เรียก Gemini (`gemini-3.5-flash`)
- Deploy: Vercel

## โครงไฟล์

```
app/
  api/
    line-webhook/route.ts   # endpoint ที่ LINE ยิง webhook เข้ามา
lib/
  sheet.ts                   # ดึง + parse CSV จาก Google Sheet, cache 60 วิ
  gemini.ts                  # เรียก Gemini, สร้าง system prompt
  line.ts                    # LINE client + reply helper
```

## ตั้งค่า

1. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า:
   - `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` — จาก LINE Developers Console (Messaging API channel)
   - `GEMINI_API_KEY` — จาก Google AI Studio
   - `SHEET_CSV_URL` — URL ของ Google Sheet ที่ publish เป็น CSV (File > Share > Publish to web > CSV)
2. Google Sheet ต้องมีคอลัมน์ในแถวแรก (รองรับทั้งชื่ออังกฤษและไทย):
   - คำถาม: `question` หรือ `คำถามที่ลูกค้ามักถาม`
   - คำตอบ: `answer` หรือ `แนวทางตอบเบื้องต้น (Chatbot)`
   - หมวดหมู่: `category` หรือ `หมวดหมู่`
   - เปิด/ปิดใช้งาน (ไม่บังคับ ถ้าไม่มีถือว่าทุกแถว active): `active` (TRUE/FALSE) หรือ `เปิดใช้งาน`
3. แก้เบอร์โทร/LINE ID สำรองใน `lib/gemini.ts` (`DEFAULT_REPLY`) ก่อนใช้งานจริง — ตอนนี้เป็น placeholder `[เบอร์โทร Win]`
4. (ไม่บังคับ) `ADMIN_LINE_USER_ID` — เมื่อลูกค้าพิมพ์ขอคุยกับคน/แอดมิน บอทจะ push แจ้งเตือนไปที่ LINE ส่วนตัวของ Win วิธีตั้งค่า:
   - Deploy โดยยังไม่ต้องตั้งค่านี้ก่อนก็ได้ (ฟีเจอร์นี้จะแค่ข้ามไปเงียบๆ ถ้าไม่ได้ตั้ง)
   - ให้ Win ทักแชทบอทตัวเองสักข้อความหนึ่ง
   - เปิด Vercel Logs หา บรรทัด `[line-webhook] from userId: Uxxxxxxxx...` แล้ว copy ค่า userId มา
   - ตั้งเป็น `ADMIN_LINE_USER_ID` ใน Vercel env vars แล้ว push commit ใหม่เพื่อบังคับ deploy สด (ห้ามกดปุ่ม Redeploy เฉยๆ)

## Dev

```bash
npm install
npm run dev
```

## Deploy บน Vercel

1. Push ขึ้น GitHub แล้ว import project เข้า Vercel (ตั้งค่าไว้แล้วใน `vercel.json` ว่าเป็น Next.js)
2. ตั้ง env vars ด้านบนใน Vercel > Settings > Environment Variables (4 ตัวจำเป็น + `ADMIN_LINE_USER_ID` ถ้าต้องการฟีเจอร์แจ้งเตือน)
3. เอา production URL + `/api/line-webhook` ไปตั้งใน LINE Developers Console (Messaging API > Webhook URL) แล้วกด Verify
4. ทดสอบส่งข้อความจริงใน LINE OA แล้วเช็ค log ใน Vercel
