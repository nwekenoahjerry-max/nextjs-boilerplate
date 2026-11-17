import { json, requireUser, isResponse, validSameOrigin, type AppContext } from "../_lib/auth";

function localDate() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
async function readProgress(context: AppContext, userId: string, recordToday: boolean) {
  const today = localDate();
  if (recordToday) {
    await context.env.DB.prepare("INSERT OR IGNORE INTO student_activity_days (user_id, activity_date, created_at) VALUES (?, ?, unixepoch())").bind(userId, today).run();
  }
  const result = await context.env.DB.prepare("SELECT activity_date FROM student_activity_days WHERE user_id = ? ORDER BY activity_date DESC LIMIT 400").bind(userId).all<{activity_date:string}>();
  const dates = result.results.map(row => row.activity_date);
  const dateSet = new Set(dates);
  const yesterday = new Date(today + "T00:00:00Z"); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const y = yesterday.toISOString().slice(0,10);
  let streak = 0;
  let cursor = dateSet.has(today) ? today : y;
  while (dateSet.has(cursor)) {
    streak++;
    const date = new Date(cursor + "T00:00:00Z"); date.setUTCDate(date.getUTCDate() - 1);
    cursor = date.toISOString().slice(0,10);
  }
  let bestStreak = 0, run = 0, previous = "";
  for (const dateValue of [...dates].sort()) {
    if (previous) {
      const next = new Date(previous + "T00:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
      run = next.toISOString().slice(0,10) === dateValue ? run + 1 : 1;
    } else run = 1;
    previous = dateValue;
    bestStreak = Math.max(bestStreak, run);
  }
  return { today, streak, bestStreak, activeDays: dates.length, todayActive: dateSet.has(today), recentDates: dates.slice(0,30) };
}
export const onRequestGet = async (context: AppContext) => {
  const user = await requireUser(context); if (isResponse(user)) return user;
  return json(await readProgress(context, user.id, false));
};
export const onRequestPost = async (context: AppContext) => {
  if (!validSameOrigin(context.request)) return json({ error: "Invalid request origin." }, 403);
  const user = await requireUser(context); if (isResponse(user)) return user;
  return json(await readProgress(context, user.id, true));
};
