import { json, requireUser, isResponse, type AppContext } from "../../_lib/auth";

const PRODUCTION_PUBLIC_KEY = "BOmGKXo7G7bdhAbeMMHds5rpr8PDmrsh_QMVZ3LI8lvIwaWrXYYqF7XrYfzuM47_depI8abDrFN98UrWtqec_ek";

export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  const publicKey = context.env.VAPID_PUBLIC_KEY || PRODUCTION_PUBLIC_KEY;
  return json({ publicKey });
};