import { json, type AppContext } from "../_lib/auth";

export const onRequestGet = async ({ env }: AppContext) => {
  // Report only runtime availability. Never expose credential values or names
  // beyond the non-secret capability flags below.
  const hasGemini = Boolean(env.GEMINI_API_KEY?.trim());
  const hasYoutube = Boolean(env.YOUTUBE_API_KEY?.trim());
  const hasResend = Boolean(env.RESEND_API_KEY?.trim());
  const hasWorkersAI = Boolean(env.AI);

  const integrations = {
    youtubeDataApi: hasYoutube,
    geminiApi: hasGemini,
    zaiApi: Boolean(env.ZAI_API_KEY?.trim()),
    resendEmail: hasResend,
    sourceFiles: Boolean(env.SOURCE_FILES),
    statusMedia: Boolean(env.STATUS_MEDIA),
    chatRooms: Boolean(env.CHAT_ROOMS),
    workersAI: hasWorkersAI
  };

  const capabilities = {
    studyGuideGeneration: hasWorkersAI || hasGemini,
    sbaQuestionGeneration: hasWorkersAI || hasGemini,
    askClerkMeText: hasWorkersAI || hasGemini,
    askClerkMeLiveVoice: hasGemini,
    patientSimulationText: hasWorkersAI,
    patientSimulationLiveVoice: hasGemini,
    youtubeMusicAndLectureSearch: hasYoutube,
    emailDelivery: hasResend
  };

  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return json({ status: "ok", service: "ClerkMe API", database: "connected", integrations, capabilities });
  } catch {
    return json({ status: "error", service: "ClerkMe API", database: "unavailable", integrations, capabilities }, 503);
  }
};
