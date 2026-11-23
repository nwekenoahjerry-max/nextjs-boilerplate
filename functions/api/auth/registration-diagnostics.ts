import { json, sha256, type AppContext } from "../../_lib/auth";
import { checkAuthRateLimit, hashPassword, randomHex } from "../../_lib/email-auth";

/**
 * Temporary, non-destructive production diagnostic for the registration path.
 * This endpoint must be removed immediately after the investigation.
 */
export const onRequestGet = async ({ request, env }: AppContext) => {
  const checks: Record<string, { ok: boolean; detail?: string; durationMs?: number }> = {};
  const run = async (name: string, task: () => Promise<unknown>) => {
    const started = Date.now();
    try {
      await task();
      checks[name] = { ok: true, durationMs: Date.now() - started };
    } catch (error) {
      checks[name] = {
        ok: false,
        detail: error instanceof Error ? error.message : "Unknown runtime error",
        durationMs: Date.now() - started
      };
    }
  };

  await run("database_read", async () => {
    await env.DB.prepare("SELECT 1 AS ok").first();
  });

  const identity = "diagnostic-" + randomHex(12);
  const bucketHash = await sha256("clerkme-auth:registration-diagnostic:" + identity);
  try {
    await run("registration_rate_limit", async () => {
      await checkAuthRateLimit(env.DB, request, "registration-diagnostic", 5, 3600, identity);
    });
  } finally {
    await env.DB.prepare("DELETE FROM auth_rate_limits WHERE bucket_hash = ?").bind(bucketHash).run();
  }

  await run("account_lookup", async () => {
    await env.DB.prepare(
      "SELECT id FROM student_profiles WHERE email = ? COLLATE NOCASE"
    ).bind("clerkme-registration-diagnostic@example.invalid").first();
  });

  await run("password_hashing", async () => {
    const result = await hashPassword("Temporary diagnostic passphrase only", randomHex(16));
    if (!result.startsWith("pbkdf2_sha256$600000$")) {
      throw new Error("Password hashing returned an unexpected format.");
    }
  });

  return json({
    diagnostic: "registration-runtime-check",
    checks,
    emailProviderConfigured: Boolean(env.RESEND_API_KEY),
    note: "No account, verification token, or email was created or sent."
  }, 200, { "Cache-Control": "no-store" });
};
