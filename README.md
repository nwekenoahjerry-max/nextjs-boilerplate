# ClerkMe

ClerkMe is a clinical clerking and learning companion concept for medical students, with an initial focus on African medical training contexts.

## Current version

This repository currently contains the first responsive front-end prototype:
- Clinical workspace overview and navigation
- Clinical clerking template selection for medicine, paediatrics, obstetrics and surgery
- A basic in-session draft form (not persistent storage)
- Placeholder areas for patient case library, clinical guides, OSCE/Viva and question bank
- Responsive desktop and mobile layouts

## Development

```bash
npm install
npm run dev
```

## Important implementation notes

- Patient data is not currently persisted or sent to a backend.
- Authentication, role-based access, AI assistance, database storage, QBank content and OSCE simulations are not yet implemented.
- Do not enter identifiable patient information into this prototype.
- ClerkMe is a learning and documentation aid, not an autonomous diagnostic or prescribing system. Clinical decisions remain the responsibility of qualified healthcare professionals.

## Deployment

The Cloudflare Pages project is connected to this repository's `main` branch. A push to `main` triggers an automatic deployment. The current Cloudflare configuration should be checked for a compatible Next.js static export/build setup before relying on production deployment.
