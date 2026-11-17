import { json, requireUser, isResponse, type AppContext } from "../../../_lib/auth";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
function safeDownloadName(value: string): string {
  const leaf = value.split(/[\\/]/).pop() || "source-material";
  return leaf.replace(/[\r\n\0]/g, "").slice(0, 180) || "source-material";
}

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  if (!context.env.SOURCE_FILES) return json({ error: "Original-file storage is not available." }, 503);

  const url = new URL(context.request.url);
  const id = clean(url.searchParams.get("id"), 80);
  if (!id) return json({ error: "A source material ID is required." }, 400);
  const material = await context.env.DB.prepare(`
    SELECT source_name, mime_type, original_object_key
    FROM learning_materials
    WHERE id = ? AND user_id = ?
  `).bind(id, user.id).first<{
    source_name: string; mime_type: string|null; original_object_key: string|null;
  }>();
  if (!material) return json({ error: "This source material could not be found in your private library." }, 404);
  if (!material.original_object_key) {
    return json({ error: "The original file was not retained for this older upload. Re-upload it to enable original-format viewing." }, 404);
  }

  try {
    const object = await context.env.SOURCE_FILES.get(material.original_object_key);
    if (!object) return json({ error: "The original file is missing from private storage. Please upload it again." }, 404);
    const fileName = safeDownloadName(material.source_name);
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    const encodedName = encodeURIComponent(fileName).replace(/['()*]/g, character =>
      "%" + character.charCodeAt(0).toString(16).toUpperCase()
    );
    return new Response(object.body, {
      status: 200,
      headers: {
        "Content-Type": material.mime_type || object.httpMetadata?.contentType || "application/octet-stream",
        "Content-Disposition": disposition + "; filename*=UTF-8''" + encodedName,
        "Content-Length": String(object.size),
        "Cache-Control": "private, no-store, max-age=0",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Accept-Ranges": "none"
      }
    });
  } catch (error) {
    console.error("[ClerkMe] Private original source could not be streamed.", {
      materialId: id,
      message: error instanceof Error ? error.message.slice(0, 220) : "Unknown R2 read error."
    });
    return json({ error: "ClerkMe could not open the original file. Please retry." }, 502);
  }
};
