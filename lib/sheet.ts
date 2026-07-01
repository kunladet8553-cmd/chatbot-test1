export interface FaqItem {
  question: string;
  answer: string;
  category: string;
  active: boolean;
}

const CACHE_TTL_MS = 60_000;

let cache: FaqItem[] | null = null;
let cacheTimestamp = 0;

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

const QUESTION_HEADER_ALIASES = ["question", "คำถามที่ลูกค้ามักถาม"];
const ANSWER_HEADER_ALIASES = ["answer", "แนวทางตอบเบื้องต้น (chatbot)"];
const CATEGORY_HEADER_ALIASES = ["category", "หมวดหมู่"];
const ACTIVE_HEADER_ALIASES = ["active", "เปิดใช้งาน"];

function findColumnIndex(header: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = header.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

function rowsToFaqItems(rows: string[][]): FaqItem[] {
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const questionIdx = findColumnIndex(header, QUESTION_HEADER_ALIASES);
  const answerIdx = findColumnIndex(header, ANSWER_HEADER_ALIASES);
  const categoryIdx = findColumnIndex(header, CATEGORY_HEADER_ALIASES);
  const activeIdx = findColumnIndex(header, ACTIVE_HEADER_ALIASES);

  const items: FaqItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const question = questionIdx >= 0 ? (cols[questionIdx] ?? "").trim() : "";
    const answer = answerIdx >= 0 ? (cols[answerIdx] ?? "").trim() : "";
    const category = categoryIdx >= 0 ? (cols[categoryIdx] ?? "").trim() : "";
    const activeRaw = activeIdx >= 0 ? (cols[activeIdx] ?? "").trim().toUpperCase() : "TRUE";
    const active = activeRaw === "TRUE";

    if (!question || !answer) continue;
    items.push({ question, answer, category, active });
  }

  return items.filter((item) => item.active);
}

export async function getFaq(): Promise<FaqItem[]> {
  const now = Date.now();

  if (cache && now - cacheTimestamp < CACHE_TTL_MS) {
    return cache;
  }

  const sheetUrl = process.env.SHEET_CSV_URL;
  if (!sheetUrl) {
    console.error("[sheet] SHEET_CSV_URL is not set");
    return cache ?? [];
  }

  try {
    const res = await fetch(sheetUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Sheet fetch failed with status ${res.status}`);
    }

    const csv = await res.text();
    const items = rowsToFaqItems(parseCsv(csv));

    cache = items;
    cacheTimestamp = now;
    return items;
  } catch (err) {
    console.error("[sheet] failed to fetch/parse FAQ sheet:", err);
    // Fall back to stale cache if available, otherwise empty FAQ list.
    return cache ?? [];
  }
}
