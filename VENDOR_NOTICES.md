# Bundled source-document readers

ClerkMe includes browser-side readers so student uploads can be opened inside the authenticated Source Material tab. Original documents remain stored unchanged in the private `clerkme-source-materials` R2 bucket; these readers render the files only in the student's browser.

- **pptx-browser 4.1.5** — `lib/pptx-browser/`, MIT License. Upstream: https://github.com/bowespublishing/pptx-browser
- **docx-preview 0.4.1** — `public/vendor/docx-preview.min.js`, Apache-2.0 License. Upstream: https://github.com/VolodymyrBaydalka/docxjs
- **JSZip 3.10.2** — `public/vendor/jszip.min.js`, MIT License (also offered under GPL-3.0). Upstream: https://github.com/Stuk/jszip

The corresponding licence texts are included alongside the bundled files. Document binaries are retrieved from ClerkMe through the authenticated API and are not uploaded to an external preview service.
