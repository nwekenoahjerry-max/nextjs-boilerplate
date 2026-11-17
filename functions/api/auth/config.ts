import { json, type AppContext } from "../../_lib/auth";
export const onRequestGet = async ({ env }: AppContext) => {
  if (!env.GOOGLE_CLIENT_ID) return json({ error: "Google sign-in is not configured." }, 503);
  return json({ clientId: env.GOOGLE_CLIENT_ID });
};
