# AI Workflow Note

## AI Tools Used
- **Google AI Studio Build Assistant (`gemini-4-hydrogen`)**: Used for project scaffolding, code auditing, refactoring storage and authentication layers, and drafting documentation and integration tests.

## How AI Accelerated Development
- Scaffolded the initial Express REST API (`server/app.ts`), Tiptap editor integration (`src/components/DocumentEditor.tsx`), file import pipeline (`server/importer.ts`), and Vitest + Supertest suite (`tests/api.test.ts`).
- Accelerated the migration from initial JSON persistence + `X-User-Id` header switching to transactional `node:sqlite` (`WAL` mode) and HMAC-SHA256 demo session authentication (`server/auth.ts`).

## What AI-Generated Code Was Modified or Rejected
- **Rejected `X-User-Id` Header Switching**: Initial prototype relied on client-sent `X-User-Id` headers. Replaced with `AuthService` (`POST /api/auth/demo-login`, Bearer verification with `timingSafeEqual`, and `POST /api/auth/logout` revocation) plus an explicit `DemoLoginView`.
- **Rejected Flat JSON File Persistence**: Initial `documents.json` rewrite approach carried corruption and concurrent-write risks. Replaced with `node:sqlite` (`DatabaseSync`), `BEGIN IMMEDIATE` transactions, `PRAGMA quick_check`, and strict failure on corrupted legacy JSON instead of silent fallback to seed data.
- **Fixed Tiptap Duplicate Extension**: Inspected `node_modules/@tiptap/starter-kit/dist/index.d.ts` and removed redundant `@tiptap/extension-underline` dependency because Tiptap v3 `StarterKit` bundles `Underline` natively.
- **Fixed Editor Autosave Closures & Races**: Rewrote `DocumentEditor.tsx` autosave to use refs (`latestTitleRef`, `latestHtmlRef`, `inFlightSaveRef`) and `flushPendingSave` on navigation/account switching so rapid edits during an in-flight request are never marked `Saved` prematurely.
- **Fixed Word Count Block Spacing**: Initial `stripHtmlToText` concatenated adjacent block tags (`</h1><p>`) without spaces; updated to insert spaces at block tag boundaries.
- **Hardened File Upload Validation**: Added ZIP magic-byte verification (`PK\x03\x04`) for `.docx`, strict UTF-8 / binary NUL-byte checks for `.txt`/`.md`, and disallowed media MIME rejection.
- **Removed Template Boilerplate**: Renamed `package.json` from `react-example` to `draftline` and removed unused `@google/genai`, `motion`, and `autoprefixer` packages plus unused `tsconfig.json` flags.

## How Implementation Was Verified
- Inspected TypeScript definitions (`@tiptap/starter-kit`, `@types/node/sqlite.d.ts`) against actual installed versions.
- Executed automated tests (`npm test`), TypeScript type-checking (`npm run lint`), production build (`npm run build`), and live HTTP checks against `http://localhost:3000`.

## Actual Test & Build Results
- `npm test` (`vitest run`): **1 test file passed, 5 test cases passed** (`tests/api.test.ts`), covering Bearer auth/logout revocation, SQLite concurrency (`Promise.all`) and reopen persistence, owner/editor/viewer/revocation authorization, `.txt`/`.md`/`.docx` imports, >5 MB limit, binary `.txt` disguise rejection, XSS `<script>` stripping, deletion, and corrupt legacy JSON safety.
- `npm run lint` (`tsc --noEmit`): **Passed (exit code 0)**.
- `npm run build` (`vite build && esbuild server.ts ...`): **Passed (built `dist/` and `server.js`)**.
