# AI Workflow Note

## Where AI Helped
- **Backend Scaffolding**: Generated the initial Express API structure (`server/app.ts`), `multer` multipart upload handler, and atomic JSON repository (`server/store.ts`) with typed DTOs.
- **Editor & UI Components**: Accelerated React component creation for the Tiptap formatting toolbar (`src/components/DocumentEditor.tsx`), document library table (`src/components/DocumentLibrary.tsx`), and share/import modals.
- **Automated Test Drafting**: Drafted Vitest + Supertest test cases covering document persistence across store reloads, role-based access enforcement (`403` checks), and file upload sanitization.

## What Was Verified
- **Dependency & API Compatibility**: Checked installed `@tiptap/starter-kit` v3.35.0 type definitions (`node_modules/@tiptap/starter-kit/dist/index.d.ts`) to verify extension configuration.
- **Automated Test Execution**: Ran `npm test` (`vitest run`) against isolated temporary storage directories to confirm CRUD, reload persistence, `.txt`/`.md`/`.docx` validation, XSS tag stripping, and owner/editor/viewer authorization rules.
- **Type Safety & Build**: Verified TypeScript compilation (`npm run lint`) and full-stack production bundling (`npm run build` for Vite frontend + `esbuild` server bundle).

## What Was Changed & Refined
- **Removed Duplicate Tiptap Extension**: Initial plans included `@tiptap/extension-underline` separately, but inspecting StarterKit v3 types showed `Underline` is bundled natively in v3, so `StarterKit` was configured directly to avoid duplicate registration warnings.
- **Server-Side Sanitization Boundary**: Enforced `sanitize-html` on both document updates (`PATCH`) and file imports (`POST /api/documents/import`) on the Express server rather than trusting client-submitted HTML.
- **In-App Confirmations & URL State**: Replaced native browser `alert`/`confirm` prompts with accessible in-app modals and stored the active seeded user and open document ID in URL query params (`?user=...&doc=...`) so browser refreshes preserve full workspace context.
