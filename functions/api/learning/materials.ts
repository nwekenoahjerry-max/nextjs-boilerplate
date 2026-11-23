import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

const MAX_TEXT = 120000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "pptx", "docx", "xlsx", "txt", "md", "csv", "rtf", "html", "htm", "json",
  "png", "jpg", "jpeg", "webp", "heic", "heif"
]);
const ALLOWED_UNITS = [
  "general-medicine", "surgery", "paediatrics", "obstetrics-gynaecology",
  "emergency", "psychiatry", "community-medicine", "orthopaedics"
];
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const isValidLibrarySubject = (value:string) => {
  if (ALLOWED_UNITS.includes(value)) return true;
  if (!value.startsWith("custom:")) return false;
  const subject = value.slice("custom:".length).trim();
  return subject.length >= 2 && subject.length <= 70 && /^[\p{L}\p{N}][\p{L}\p{N} &'().,\/_-]*$/u.test(subject);
};
function parseStored(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}
function safeFileName(value: string): string {
  const leaf = value.split(/[\\/]/).pop() || "uploaded-document";
  return leaf.replace(/[\r\n\0]/g, "").slice(0, 180) || "uploaded-document";
}
function inferMimeType(fileName: string, supplied: string): string {
  if (supplied && supplied !== "application/octet-stream") return supplied.slice(0, 120);
  const ext = fileName.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rtf: "application/rtf",
    html: "text/html",
    htm: "text/html",
    json: "application/json",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif"
  };
  return types[ext || ""] || "application/octet-stream";
}

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const requestedId = clean(new URL(context.request.url).searchParams.get("id"), 80);
  if (requestedId) {
    const url = new URL(context.request.url);
    if (url.searchParams.get("include") === "study") {
      const study = await context.env.DB.prepare(`
        SELECT id, summary_json, questions_json
        FROM learning_materials
        WHERE id = ? AND user_id = ?
      `).bind(requestedId, user.id).first<{id:string;summary_json:string|null;questions_json:string|null}>();
      if (!study) return json({ error: "This material could not be found in your private library." }, 404);
      const summary = parseStored(study.summary_json);
      const questions = parseStored(study.questions_json);
      return json({ material: {
        id: study.id,
        summary,
        questions: Array.isArray(questions) ? questions : [],
        hasSummary: Boolean(summary),
        questionCount: Array.isArray(questions) ? questions.length : 0,
        studyLoaded: true
      } });
    }
    const source = await context.env.DB.prepare(
      "SELECT id, content_text, original_object_key, original_size_bytes, mime_type FROM learning_materials WHERE id = ? AND user_id = ?"
    ).bind(requestedId, user.id).first<{
      id:string; content_text:string; original_object_key:string|null;
      original_size_bytes:number|null; mime_type:string|null;
    }>();
    if (!source) return json({ error: "This material could not be found in your private library." }, 404);
    return json({ material: {
      id: source.id,
      contentText: source.content_text,
      originalFileAvailable: Boolean(source.original_object_key),
      originalSizeBytes: source.original_size_bytes,
      mimeType: source.mime_type,
      hasExtractableText: source.content_text.trim().length >= 100
    } });
  }
  const rows = await context.env.DB.prepare(`
    SELECT id, title, source_name, unit, category, mime_type,
           original_object_key, original_size_bytes,
           LENGTH(TRIM(COALESCE(content_text, ''))) AS content_text_length,
           CASE WHEN summary_json IS NOT NULL AND LENGTH(summary_json) > 2 THEN 1 ELSE 0 END AS has_summary,
           CASE WHEN questions_json IS NOT NULL AND json_valid(questions_json) THEN json_array_length(questions_json) ELSE 0 END AS question_count,
           created_at, updated_at
    FROM learning_materials
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(user.id).all<{
    id:string; title:string; source_name:string; unit:string; category:string;
    mime_type:string|null; original_object_key:string|null; original_size_bytes:number|null;
    content_text_length:number; has_summary:number; question_count:number;
    created_at:number; updated_at:number;
  }>();
  const materials = rows.results.map(row => ({
    id: row.id,
    title: row.title,
    sourceName: row.source_name,
    unit: row.unit,
    category: row.category,
    mimeType: row.mime_type,
    originalFileAvailable: Boolean(row.original_object_key),
    originalSizeBytes: row.original_size_bytes,
    hasExtractableText: row.content_text_length >= 100,
    hasSummary: row.has_summary === 1,
    questionCount: Number(row.question_count) || 0,
    summary: null,
    questions: [],
    studyLoaded: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
  return json({ materials });
};

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  if (!context.env.SOURCE_FILES) {
    return json({
      error: "Original-file storage is not connected. ClerkMe cannot save this upload yet. Please retry after the SOURCE_FILES R2 binding is deployed.",
      code: "SOURCE_STORAGE_UNAVAILABLE"
    }, 503);
  }

  let form: FormData;
  try { form = await context.request.formData(); }
  catch { return json({ error: "The uploaded document could not be read. Please try again." }, 400); }

  const title = clean(form.get("title"), 180);
  const sourceName = safeFileName(clean(form.get("sourceName"), 220));
  const unit = clean(form.get("unit"), 80);
  const category = clean(form.get("category"), 80) || "Lecture notes";
  const originalFile = form.get("originalFile");
  const contentValue = form.get("contentText");
  const content = typeof contentValue === "string" ? contentValue : "";

  if (!title || !sourceName) return json({ error: "Add a title and select a source file." }, 400);
  if (!isValidLibrarySubject(unit)) return json({ error: "Choose a valid clinical unit or enter a subject name between 2 and 70 characters." }, 400);
  if (!(originalFile instanceof File)) return json({ error: "The original file was not included. Please select it again." }, 400);
  const extension = (originalFile.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return json({ error: "This file format is not supported. Upload PDF, PPTX, DOCX, XLSX, TXT, MD, CSV, RTF, HTML, JSON, PNG, JPG, WEBP, HEIC or HEIF. Older PPT, DOC and XLS files should be saved as a modern format or PDF." }, 415);
  }
  if (!originalFile.size) return json({ error: "The selected file is empty." }, 400);
  if (originalFile.size > MAX_FILE_BYTES) return json({ error: "This file is larger than 20 MB. Please compress it or split it into smaller parts." }, 413);
  if (content.length > MAX_TEXT) return json({ error: "The extracted document is too long. Split it into smaller files and upload each part separately." }, 413);

  const fileName = safeFileName(originalFile.name || sourceName);
  const mimeType = inferMimeType(fileName, originalFile.type);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const objectKey = user.id + "/" + id + "/" + fileName;

  try {
    await context.env.SOURCE_FILES.put(objectKey, await originalFile.arrayBuffer(), {
      httpMetadata: { contentType: mimeType },
      customMetadata: { materialId: id, ownerId: user.id }
    });
    await context.env.DB.prepare(`
      INSERT INTO learning_materials
        (id, user_id, title, source_name, unit, category, mime_type, content_text,
         original_object_key, original_size_bytes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, user.id, title, fileName, unit, category, mimeType, content,
      objectKey, originalFile.size, now, now
    ).run();
  } catch (error) {
    await context.env.SOURCE_FILES.delete(objectKey).catch(() => undefined);
    console.error("[ClerkMe] Original source upload failed.", {
      materialId: id,
      message: error instanceof Error ? error.message.slice(0, 250) : "Unknown storage error."
    });
    return json({ error: "ClerkMe could not save the original file. Your lecture has not been added. Please retry." }, 502);
  }

  return json({
    material: {
      id, title, sourceName: fileName, unit, category, mimeType,
      originalFileAvailable: true, originalSizeBytes: originalFile.size,
      hasExtractableText: content.trim().length >= 100,
      contentText: content, summary: null, questions: [], createdAt: now, updatedAt: now
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
  const existing = await context.env.DB.prepare(
    "SELECT original_object_key FROM learning_materials WHERE id = ? AND user_id = ?"
  ).bind(id, user.id).first<{original_object_key:string|null}>();
  if (!existing) return json({ deleted: false, changes: 0 });
  if (existing.original_object_key && context.env.SOURCE_FILES) {
    await context.env.SOURCE_FILES.delete(existing.original_object_key).catch(error => {
      console.warn("[ClerkMe] Could not remove deleted material's original R2 object.", {
        materialId: id,
        message: error instanceof Error ? error.message.slice(0, 180) : "Unknown storage error."
      });
    });
  }
  const result = await context.env.DB.prepare(
    "DELETE FROM learning_materials WHERE id = ? AND user_id = ?"
  ).bind(id, user.id).run();
  return json({ deleted: true, changes: (result as { meta?: { changes?: number } }).meta?.changes ?? null });
};
