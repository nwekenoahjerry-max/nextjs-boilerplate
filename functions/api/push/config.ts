import { json, requireUser, isResponse, type AppContext } from "../../_lib/auth";
import { PUSH_VAPID_PUBLIC_KEY } from "../../../lib/push-config";

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  return json({ publicKey: context.env.VAPID_PUBLIC_KEY || PUSH_VAPID_PUBLIC_KEY });
};
