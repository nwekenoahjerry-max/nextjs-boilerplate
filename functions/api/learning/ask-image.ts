import { requireUser, isResponse, type AppContext } from "../../_lib/auth";

const cleanId = (value: string) => value.trim().slice(0, 80);

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;

  const imageId = cleanId(new URL(context.request.url).searchParams.get("id") || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(imageId)) {
    return new Response("Image not found.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (!context.env.SOURCE_FILES) {
    return new Response("Image storage is unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  // Generated study images are private to the authenticated account.
  const object = await context.env.SOURCE_FILES.get("ask-images/" + user.id + "/" + imageId + ".png");
  if (!object) return new Response("Image not found.", { status: 404, headers: { "Cache-Control": "no-store" } });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "image/png",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
};
