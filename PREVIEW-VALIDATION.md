# ClerkMe preview validation

This branch is intended for review only. Do not merge it until the Cloudflare Pages preview has passed the checks below.

## Hosting configuration
- Cloudflare Pages project: `clerkmd`
- Repository root: `/`
- Build command: `npm run build`
- Build output: `out`
- The Pages deployment uses the root-level `functions/` directory for authenticated API endpoints.
- The preview environment is configured with the existing D1 binding `DB`, Workers AI binding `AI` and Google OAuth client ID.

## Manual preview checks
1. Open the preview and confirm the workspace renders on desktop and mobile.
2. Sign in with Google and confirm the profile loads.
3. Open Clinical clerking and verify the 18-stage guide proceeds from biodata through handover.
4. Upload a de-identified clerking note and confirm the organiser returns polished prose, missing questions and uncertainty flags.
5. Upload text-based study material and check the structured summary.
6. Ask the AI tutor a question that is answered by the material, then ask one not covered by the material and confirm the tutor says when the source does not contain the answer.
7. Open Patient simulation, ask about an initial symptom and then ask focused follow-up questions. Confirm the patient stays in character and does not volunteer a diagnosis.
8. Run the existing question bank and flight game.
9. Verify the cases area still saves and lists only the signed-in account's cases.

Use fictional cases and non-identifying notes only. Do not upload identifiable patient information.

## Known limits in this preview
The study-material workspace extracts text in the browser and uses it for the active session. The uploaded original documents and extracted study text are not yet saved to a persistent personal document library. Scanned/image-only documents may require OCR and are not supported by this text-extraction flow.
