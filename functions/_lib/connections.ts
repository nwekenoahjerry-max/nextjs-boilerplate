import type { D1Database } from "./auth";

export function sortedStudentPair(first:string,second:string):[string,string] {
  return first < second ? [first,second] : [second,first];
}

export async function areConnected(db:D1Database,first:string,second:string):Promise<boolean> {
  if(!first||!second||first===second) return false;
  const [userA,userB]=sortedStudentPair(first,second);
  const row=await db.prepare(
    "SELECT 1 AS ok FROM student_connections WHERE user_a_id=? AND user_b_id=? LIMIT 1"
  ).bind(userA,userB).first();
  return Boolean(row);
}
