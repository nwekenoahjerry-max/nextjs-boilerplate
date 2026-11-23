import { json, requireAdmin, isResponse, type AppContext } from "../../_lib/auth";

type UserRow = {
  id:string; name:string; email:string; university:string; level:string; createdAt:number;
  lastActive:string|null; caseCount:number; materialCount:number; videoCount:number;
};

export const onRequestGet = async (context:AppContext) => {
  const admin = await requireAdmin(context);
  if (isResponse(admin)) return admin;
  const params = new URL(context.request.url).searchParams;
  const search=(params.get("q")||"").trim().slice(0,100);
  const page=Math.max(1,Math.min(10000,Number.parseInt(params.get("page")||"1",10)||1));
  const perPage=Math.max(10,Math.min(50,Number.parseInt(params.get("perPage")||"20",10)||20));
  const offset=(page-1)*perPage;
  const where=search?"WHERE p.full_name LIKE ? OR p.email LIKE ? OR p.school LIKE ?":"";
  const pattern="%"+search+"%";
  const filters=search?[pattern,pattern,pattern]:[];
  try {
    const [count,rows]=await Promise.all([
      context.env.DB.prepare("SELECT COUNT(*) AS total FROM student_profiles p "+where)
        .bind(...filters).first<{total:number}>(),
      context.env.DB.prepare(`
        SELECT p.id,p.full_name AS name,p.email,p.school AS university,p.level,p.created_at AS createdAt,
          (SELECT MAX(d.activity_date) FROM student_activity_days d WHERE d.user_id=p.id) AS lastActive,
          (SELECT COUNT(*) FROM cases c WHERE c.user_id=p.id AND c.deleted_at IS NULL) AS caseCount,
          (SELECT COUNT(*) FROM learning_materials m WHERE m.user_id=p.id) AS materialCount,
          (SELECT COUNT(*) FROM saved_learning_videos v WHERE v.user_id=p.id) AS videoCount
        FROM student_profiles p ${where}
        ORDER BY (CASE WHEN p.created_at > 100000000000 THEN p.created_at/1000 ELSE p.created_at END) DESC LIMIT ? OFFSET ?
      `).bind(...filters,perPage,offset).all<UserRow>()
    ]);
    const total=count?.total||0;
    return json({users:rows.results,page,perPage,total,totalPages:Math.max(1,Math.ceil(total/perPage))});
  } catch(error) {
    console.error("[ClerkME admin] User directory query failed.",error instanceof Error?error.message:"Unknown database error.");
    return json({error:"The student directory could not be loaded. Please refresh and try again."},500);
  }
};