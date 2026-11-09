# ClerkMe

ClerkMe is a clinical clerking and learning platform for medical students and clinical trainees, designed for African training contexts.

## Implemented backend foundation

- Google Identity Services sign-in with server-side ID-token verification against the configured Google OAuth client ID.
- Server-issued, HTTP-only, Secure, SameSite=Lax session cookie.
- Session records stored as SHA-256 token hashes in the existing D1 `sessions` table.
- Reuses the existing `student_profiles` and `google_identities` account schema; does not replace existing account or payment records.
- D1-backed case creation, listing, retrieval, editing and soft deletion.
- Per-account case ownership checks on every case endpoint.
- Audit events for case creation, edits and deletion.
- Health endpoint for checking the API/database binding.

## API routes

- `GET /api/health`
- `GET /api/auth/config`
- `POST /api/auth/google`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/cases`
- `POST /api/cases`
- `GET /api/cases/:id`
- `PATCH /api/cases/:id`
- `DELETE /api/cases/:id`

## Cloudflare requirements

The Pages project must have:
- D1 binding named `DB` pointing to the existing ClerkMD database.
- Environment variable `GOOGLE_CLIENT_ID` set to the OAuth Web Client ID.
- The Google Identity Services authorised JavaScript origin must include the deployed ClerkMe/ClerkMD site origin.

The additive case and audit schema is in `migrations/0001_clerkme_core.sql`. It references the existing `student_profiles` table. The migration has been applied to the connected D1 database.

## Local development

```bash
npm install
npm run dev
```

Cloudflare Pages Functions require a Pages-compatible local runtime to test D1 bindings. Do not test authenticated endpoints against production with real patient data.

## Clinical data and safety

- Use a non-identifying case reference. Do not store patient names, hospital numbers, addresses, phone numbers or other direct identifiers.
- This service is not yet approved for identifiable patient health information or unsupervised clinical care.
- ClerkMe is a learning and documentation aid, not an autonomous diagnostic or prescribing system.
- Clinical decisions remain the responsibility of qualified healthcare professionals.
- Before production use with real patient records, complete security review, privacy/legal review for each operating jurisdiction, retention/deletion policy, backup and restore testing, monitoring, rate limiting, and penetration testing.

## Product areas still to implement

The authenticated case API is the first persistent workflow. Full specialty-specific clerking forms, case-detail editing UI, AI-assisted learning, clinical guides, OSCE/Viva simulation, question bank, subscription/payment workflows and admin tools require their own implementation and tests. They must not be presented as available until working end to end.
