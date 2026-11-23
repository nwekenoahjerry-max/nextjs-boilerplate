import { json, requireAdmin, isResponse, type AppContext } from "../../_lib/auth";

type MetricRow = {
  totalUsers:number; newUsers7d:number; activeToday:number; totalCases:number;
  totalMaterials:number; totalVideos:number; activeGenerationJobs:number; failedGenerationJobs7d:number;
};
type ActivityRow = { day:string; activeUsers:number };
type JobRow = { status:string; total:number };
type AuditRow = { id:string; action:string; createdAt:string; userName:string; userEmail:string };

export const onRequestGet = async (context:AppContext) => {
  const admin = await requireAdmin(context);
  if (isResponse(admin)) return admin;
  try {
    const [counts,activity,jobs,events] = await Promise.all([
      context.env.DB.prepare(`
        SELECT
          (SELECT COUNT(*) FROM student_profiles) AS totalUsers,
          (SELECT COUNT(*) FROM student_profiles WHERE (CASE WHEN created_at > 100000000000 THEN created_at/1000 ELSE created_at END) >= unixepoch()-604800) AS newUsers7d,
          (SELECT COUNT(*) FROM student_activity_days WHERE activity_date=date('now','+1 hour')) AS activeToday,
          (SELECT COUNT(*) FROM cases WHERE deleted_at IS NULL) AS totalCases,
          (SELECT COUNT(*) FROM learning_materials) AS totalMaterials,
          (SELECT COUNT(*) FROM saved_learning_videos) AS totalVideos,
          (SELECT COUNT(*) FROM study_generation_jobs WHERE status IN ('queued','in_progress')) AS activeGenerationJobs,
          (SELECT COUNT(*) FROM study_generation_jobs WHERE status='failed' AND created_at >= unixepoch()-604800) AS failedGenerationJobs7d
      `).first<MetricRow>(),
      context.env.DB.prepare(`
        WITH RECURSIVE recent_days(day,step) AS (
          SELECT date('now','+1 hour','-6 days'),0
          UNION ALL SELECT date(day,'+1 day'),step+1 FROM recent_days WHERE step<6
        )
        SELECT recent_days.day,COUNT(DISTINCT student_activity_days.user_id) AS activeUsers
        FROM recent_days
        LEFT JOIN student_activity_days ON student_activity_days.activity_date=recent_days.day
        GROUP BY recent_days.day ORDER BY recent_days.day
      `).all<ActivityRow>(),
      context.env.DB.prepare(`
        SELECT status,COUNT(*) AS total FROM study_generation_jobs
        WHERE created_at>=unixepoch()-604800 GROUP BY status
      `).all<JobRow>(),
      context.env.DB.prepare(`
        SELECT audit_events.id,audit_events.action,audit_events.created_at AS createdAt,
          COALESCE(student_profiles.full_name,'Former account') AS userName,
          COALESCE(student_profiles.email,'') AS userEmail
        FROM audit_events LEFT JOIN student_profiles ON student_profiles.id=audit_events.user_id
        ORDER BY audit_events.created_at DESC LIMIT 8
      `).all<AuditRow>()
    ]);
    return json({
      admin:{name:admin.name,email:admin.email},
      metrics:counts || {totalUsers:0,newUsers7d:0,activeToday:0,totalCases:0,totalMaterials:0,totalVideos:0,activeGenerationJobs:0,failedGenerationJobs7d:0},
      activity:activity.results,jobs:jobs.results,events:events.results,
      services:{
        database:true,
        googleSignIn:Boolean(context.env.GOOGLE_CLIENT_ID),
        workersAI:Boolean(context.env.AI),
        geminiAPI:Boolean(context.env.GEMINI_API_KEY),
        zaiAPI:Boolean(context.env.ZAI_API_KEY),
        youtubeDataAPI:Boolean(context.env.YOUTUBE_API_KEY),
        sourceFileStorage:Boolean(context.env.SOURCE_FILES)
      },
      metering:{aiTokenUsage:"not_recorded",aiSpend:"not_recorded",note:"ClerkME currently records generation jobs, but does not yet meter AI tokens or provider costs."}
    });
  } catch(error) {
    console.error("[ClerkME admin] Overview query failed.",error instanceof Error?error.message:"Unknown database error.");
    return json({error:"The admin overview could not be loaded. Please refresh and try again."},500);
  }
};