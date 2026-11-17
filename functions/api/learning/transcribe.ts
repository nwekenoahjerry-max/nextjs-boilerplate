import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../../_lib/auth";

const MODEL = "@cf/openai/whisper-large-v3-turbo";
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  if (!context.env.AI) return json({ error: "Voice transcription is temporarily unavailable. You can type your question instead." }, 503);

  let form: FormData;
  try { form = await context.request.formData(); }
  catch { return json({ error: "The audio upload could not be read. Please record again." }, 400); }
  const audioFile = form.get("audio");
  if (!(audioFile instanceof File)) return json({ error: "Record a voice question before requesting transcription." }, 400);
  if (!audioFile.size) return json({ error: "The recording was empty. Check your microphone and try again." }, 400);
  if (audioFile.size > MAX_AUDIO_BYTES) return json({ error: "The recording is too large. Record a shorter question and try again." }, 413);
  if (!audioFile.type.startsWith("audio/")) return json({ error: "The uploaded recording format is not supported." }, 415);

  try {
    const audioBytes = new Uint8Array(await audioFile.arrayBuffer());
    const encodedAudio = toBase64(audioBytes);
    const result = await context.env.AI.run(MODEL, {
      audio: encodedAudio,
      task: "transcribe",
      language: "en",
      vad_filter: true,
    }) as Record<string, unknown>;
    const nested = result.result && typeof result.result === "object" ? result.result as Record<string, unknown> : {};
    const transcript = typeof result.text === "string" ? result.text.trim()
      : typeof nested.text === "string" ? nested.text.trim()
      : typeof result.response === "string" ? result.response.trim() : "";
    if (!transcript) return json({ error: "No speech was recognised. Speak clearly, keep the microphone close and try again." }, 422);
    return json({ transcript });
  } catch {
    return json({ error: "Voice transcription failed. Please try again or type your question." }, 502);
  }
};
