import { json, requireUser, isResponse, type AppContext } from "../../_lib/auth";
export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context);
  if (isResponse(user)) return user;
  return json({ user });
};
