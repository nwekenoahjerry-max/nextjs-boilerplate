import type { AppContext } from "./auth";

export type LiveDiagnosticEntry = {
  requestId: string;
  route: "ask-clerkme" | "patient-simulation";
  rayId?: string | null;
  stage: string;
  statusCode?: number | null;
  model?: string | null;
  errorCode?: string | null;
  detail?: string | null;
};

/**
 * Persist a small, redacted breadcrumb for Live token requests.
 * A missing sequence in this table means the request failed before the
 * application handler reached the corresponding stage.
 */
export async function writeLiveDiagnostic(context: AppContext, entry: LiveDiagnosticEntry): Promise<void> {
  const detail = (entry.detail || "")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-key]")
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .slice(0, 240);

  try {
    await context.env.DB.prepare(
      `INSERT INTO live_voice_diagnostics
        (id, request_id, route, ray_id, stage, status_code, model, error_code, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      entry.requestId.slice(0, 32),
      entry.route,
      (entry.rayId || "").slice(0, 80) || null,
      entry.stage.slice(0, 64),
      Number.isFinite(entry.statusCode) ? entry.statusCode : null,
      (entry.model || "").slice(0, 80) || null,
      (entry.errorCode || "").slice(0, 80) || null,
      detail || null
    ).run();
  } catch (error) {
    // Diagnostics must never make the Live API request fail.
    console.warn("[ClerkMe] Could not persist Live diagnostic.", {
      requestId: entry.requestId,
      route: entry.route,
      stage: entry.stage,
      detail: error instanceof Error ? error.message.slice(0, 160) : "D1 diagnostic write failed"
    });
  }
}
