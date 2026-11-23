# ClerkMe

ClerkMe is a clinical clerking and learning platform for medical students and clinical trainees, designed for African training contexts.

## Learning and clerking features

- Extensive core clerking pathway from preparation and biodata through presenting complaints, history, examination, summary, differential diagnoses, investigations, management, progress notes and final case presentation.
- Specialty-specific clerking modules for General Medicine, Surgery, Paediatrics, Obstetrics & Gynaecology, Emergency Medicine, Psychiatry, Community Medicine and Orthopaedics.
- Guided prompts, documentation examples, clinical reasoning, red flags, common omissions and final quality checks.
- Presentation-based guides that reuse the unit-specific clinical case library.
- Private, account-scoped study-material library. Students can upload PDF, PPTX, DOCX, TXT, MD and CSV files, select a unit and organise their materials.
- AI-generated, exam-ready study guides with detailed explanations, learning objectives, high-yield facts, short-note themes, viva practice, comparison tables, visual process flows, topic-specific YouTube searches and source-coverage checks.
- Source-grounded AI tutor for questions about a selected uploaded document. The tutor separates source-supported content from supplementary explanation and reports limitations.
- Validated single-best-answer question generation from uploaded study materials, with configurable set size and difficulty, duplicate checks, a top-up attempt for incomplete sets and integration with the unit's core question bank.
- Unit- and material-adaptive Flight Academy game.
- Interactive AI clinical simulation with fictional cases, staged questions, answer assessment, corrections, reasoning and direct tutor-style question answering.
- Existing case records, student activity tracking and account-specific access controls.

## AI and document handling

The browser extracts readable text from supported documents before sending it to the authenticated ClerkMe API. The current materials feature retains the extracted text, structured summary and generated questions; it does not retain the original binary file. Text-based PDFs are supported. Scanned image-only documents may need OCR or a text-based copy.

Workers AI is used for summaries, source-grounded Q&A, question generation and clinical simulation. AI outputs are educational material, may contain errors and must be checked against the original source, current local guidelines and clinical supervision. The simulation uses fictional scenarios and is not a diagnostic or prescribing service.

## API routes

- `GET /api/health`
- `GET /api/auth/config`
- `POST /api/auth/google`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/profile`
- `PATCH /api/profile`
- `GET /api/cases`
- `POST /api/cases`
- `GET /api/cases/:id`
- `PATCH /api/cases/:id`
- `DELETE /api/cases/:id`
- `GET /api/activity`
- `POST /api/activity`
- `GET /api/learning/materials`
- `POST /api/learning/materials`
- `DELETE /api/learning/materials`
- `POST /api/learning/summarise`
- `POST /api/learning/ask`
- `POST /api/learning/generate`
- `POST /api/learning/organise`
- `POST /api/learning/simulate`

## Cloudflare requirements

The Pages project requires:
- D1 binding named `DB`.
- Workers AI binding named `AI`.
- `GOOGLE_CLIENT_ID` configured as a Pages environment variable.
- The Google Identity Services authorised JavaScript origin must include the deployment origin used for sign-in.

The `clerkmd` Pages project has a dedicated, empty `clerkme-preview` D1 database attached to the preview environment. The production environment remains attached to the existing `clerkme` database. Preview database setup does not copy production student records.

## Database migrations

Apply migrations in numerical order:

1. `0000_student_auth.sql` creates the modern student profile, Google identity, hashed-session and authentication rate-limit tables. It preserves legacy account/payment tables, maps existing `users` and `google_accounts` into the new identity schema, and renames the old session table to `sessions_legacy` so existing records are retained.
2. `0001_clerkme_core.sql` creates case and audit tables.
3. `0002_student_activity.sql` creates activity-day tracking.
4. `0003_learning_materials.sql` creates the private learning-material store.
5. `0004_expand_case_specialties.sql` extends case records to every supported clinical unit while preserving existing case rows.
6. `0005_student_profile_details.sql` adds career interests and Nigerian state / LGA details.
7. `0006_saved_learning_videos.sql`, `0007_study_generation_jobs.sql` and `0008_original_source_files.sql` extend saved learning and study-material handling.
8. `0009_student_country.sql` adds the country field used by the global university selector. Apply it to the production D1 database before the updated profile form is used.

The country selector uses a 249-country directory. University suggestions use a bundled snapshot of the community-maintained Hipo university directory, combined with ClerkME’s curated Nigerian institution list. The directory is searchable; a student can still enter an institution manually when it is not listed. Data sources: https://github.com/umpirsky/country-list and https://github.com/Hipo/university-domains-list.

The preview database has been provisioned with the equivalent schema for isolated testing. The production migrations have not been applied as part of this preview work.

## Local development

```bash
npm install
npm run dev
```

Cloudflare Pages Functions require a Pages-compatible local runtime to test D1 and Workers AI bindings. Do not test authenticated endpoints against production with real patient data.

## Clinical data, privacy and safety

- Upload study resources, not identifiable patient records.
- Use a non-identifying case reference. Do not store patient names, hospital numbers, addresses, phone numbers or other direct identifiers in learning cases.
- This service is not approved for identifiable patient health information or unsupervised clinical care.
- AI summaries, answers, questions and simulated feedback are learning aids, not authoritative clinical guidance.
- Clinical decisions remain the responsibility of qualified healthcare professionals.
- Before production use with real patient records, complete security review, privacy/legal review for each operating jurisdiction, retention/deletion policy, backup and restore testing, monitoring, rate limiting and penetration testing.
