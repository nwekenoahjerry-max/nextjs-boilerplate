# ClerkMe

ClerkMe is a clinical clerking and learning workspace for medical students and clinical trainees, designed for African training contexts.

## Current application architecture

- The main interface is the Next.js App Router application in \`app/\`.
- \`next.config.ts\` uses static export; the output is written to \`out/\`.
- Root-level \`functions/\` contains Cloudflare Pages Functions for authenticated APIs.
- Cloudflare D1 stores accounts, sessions, activity and cases. Cloudflare Workers AI powers study tools.
- \`clerkmd/public/\` and \`clerkmd/functions/\` are the legacy ClerkMD static client and API. They are retained for rollback/reference but are no longer the configured Pages build output.

## Learning features

- **Complete clerking framework:** an 18-stage guide from biodata, informant and presenting complaints through history, specialty-specific details, examination, assessment, investigations, management and handover.
- **Clerking note organiser:** paste or upload de-identified notes; the AI formats the information, identifies missing questions and flags ambiguity without inventing findings.
- **Study materials:** upload multiple text-based PDF, PPTX, DOCX, TXT, Markdown or CSV files; extract readable text in the browser; request a structured guide with learning objectives, key concepts, step-by-step explanations, high-yield points, clinical applications, examination focus, memory aids and cautions.
- **Source-grounded tutor:** ask follow-up questions about the uploaded material. The tutor distinguishes what the source says from general educational context and states when the source does not contain an answer.
- **Patient simulation:** select a fictional case and interview the standardised patient through a conversational interface. The simulated patient reveals information in response to the student's questions rather than volunteering a diagnosis.
- **Question bank and flight game:** existing practice questions and lecture-derived question generation remain available.

The browser extracts readable text before requesting an AI summary. The current study-material workspace does not permanently store the original uploaded files or extracted source in a personal document library. A refresh clears the active study session. Scanned/image-only PDFs may not yield readable text.

## API routes

- \`GET /api/health\`
- \`GET /api/auth/config\`
- \`POST /api/auth/google\`
- \`GET /api/auth/me\`
- \`POST /api/auth/logout\`
- \`GET /api/cases\`
- \`POST /api/cases\`
- \`GET /api/cases/:id\`
- \`PATCH /api/cases/:id\`
- \`DELETE /api/cases/:id\`
- \`POST /api/learning/organise\`
- \`POST /api/learning/generate\`
- \`POST /api/learning/summarise\`
- \`POST /api/learning/answer\`
- \`POST /api/learning/simulate\`

All AI routes require a valid user session, same-origin requests and a Cloudflare Workers AI binding. AI output is validated and bounded before returning to the browser.

## Cloudflare Pages configuration

Build settings:
- Build command: \`npm run build\`
- Build output directory: \`out\`
- Root directory: repository root

Required bindings/settings:
- D1 binding named \`DB\` pointing to the ClerkMe database.
- Workers AI binding named \`AI\`.
- \`GOOGLE_CLIENT_ID\` set to the Google OAuth Web Client ID.
- The Google Identity Services authorised JavaScript origins must include the deployed ClerkMe site origin.

The Pages build output directory in \`wrangler.jsonc\` is set to \`./out\`. Keep the Cloudflare project build output setting consistent with this value. Root \`functions/\` routes are deployed alongside the static export.

The additive case and audit schema is in \`migrations/0001_clerkme_core.sql\`; student activity is in \`migrations/0002_student_activity.sql\`. Verify that both migrations have been applied to the intended D1 database before enabling features that depend on them.

## Local development and validation

\`\`\`bash
npm ci
npm run lint
npm run build
\`\`\`

A normal Next.js local server does not automatically provide Cloudflare D1 and Workers AI bindings. Use a Pages-compatible local runtime to test authenticated APIs. Do not test with identifiable patient data.

## Clinical data, privacy and safety

- Use non-identifying case references only. Do not upload patient names, hospital numbers, addresses, phone numbers, photographs or other direct identifiers.
- The clerking note organiser preserves supplied facts and must not create missing symptoms, examination findings, investigations or treatment.
- Uploaded learning materials are treated as untrusted source content; embedded instructions are ignored.
- The study tutor should state when the uploaded material does not contain the answer. General educational context must be labelled separately.
- Simulated patient cases are fictional teaching scenarios. They are not clinical advice or real encounters.
- ClerkMe is a learning and documentation aid, not an autonomous diagnostic or prescribing system. Clinical decisions remain the responsibility of qualified healthcare professionals.
- Before production use with real patient records, complete security and privacy review, retention/deletion policy, backup and restore testing, monitoring, rate limiting and penetration testing.
