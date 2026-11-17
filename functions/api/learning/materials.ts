import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

const MAX_TEXT = 42000;
const ALLOWED_UNITS = [
  "general-medicine", "surgery", "paediatrics", "obstetrics-gynaecology",
  "emergency", "psychiatry", "community-medicine", "orthopaedics"
];
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
function parseStored(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const rows = await context.env.DB.prepare(`
    SELECT id, title, source_name, unit, category, mime_type, content_text,
           summary_json, questions_json, created_at, updated_at
    FROM learning_materials
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(user.id).all<{
    id:string; title:string; source_name:string; unit:string; category:string;
    mime_type:string|null; content_text:string; summary_json:string|null; questions_json:string|null;
    created_at:number; updated_at:number;
  }>();
  const materials = rows.results.map(row => ({
    id: row.id,
    title: row.title,
    sourceName: row.source_name,
    unit: row.unit,
    category: row.category,
    mimeType: row.mime_type,
    contentText: row.content_text,
    summary: parseStored(row.summary_json),
    questions: parseStored(row.questions_json) || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
  return json({ materials });
};

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  let body: Record<string, unknown>;
  try { body = await context.request.json() as Record<string, unknown>; }
  catch { return json({ error: "Invalid request body." }, 400); }

  const title = clean(body.title, 180);
  const sourceName = clean(body.sourceName, 220);
  const unit = clean(body.unit, 80);
  const category = clean(body.category, 80) || "Lecture notes";
  const mimeType = clean(body.mimeType, 120) || null;
  const content = clean(body.contentText, MAX_TEXT);

  if (!title || !sourceName) return json({ error: "Add a title and select a source file." }, 400);
  if (!ALLOWED_UNITS.includes(unit)) return json({ error: "Select a valid clinical unit." }, 400);
  if (content.length < 100) return json({ error: "The document contains too little readable text. Try a text-based PDF, DOCX, PPTX or text file." }, 400);
  if (typeof body.contentText === "string" && body.contentText.length > MAX_TEXT) {
    return json({ error: "The extracted document is too long. Split it into smaller files and upload each part separately." }, 413);
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await context.env.DB.prepare(`
    INSERT INTO learning_materials
      (id, user_id, title, source_name, unit, category, mime_type, content_text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, user.id, title, sourceName, unit, category, mimeType, content, now, now).run();

  return json({
    material: {
      id, title, sourceName, unit, category, mimeType, contentText: content,
      summary: null, questions: [], createdAt: now, updatedAt: now
    }
  }, 201);
};

export const onRequestDelete = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  let id = "";
  try {
    const body = await context.request.json() as Record<string, unknown>;
    id = clean(body.id, 80);
  } catch {
    id = clean(new URL(context.request.url).searchParams.get("id"), 80);
  }
  if (!id) return json({ error: "Choose a material to remove." }, 400);
  const result = await context.env.DB.prepare(
    "DELETE FROM learning_materials WHERE id = ? AND user_id = ?"
  ).bind(id, user.id).run();
  return json({ deleted: true, changes: (result as { meta?: { changes?: number } }).meta?.changes ?? null });
};
