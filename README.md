# Draftline — Collaborative Document Workspace

**Live App URL:** https://ais-pre-7fwstimnwg65sp5fetln7h-284446791353.asia-southeast1.run.app

## Project Overview
**Draftline** is a focused full-stack rich-text document workspace inspired by Google Docs, built for the Ajaia LLC AI-Native Full Stack Developer Assignment. It prioritizes a dependable, cleanly testable core workflow—creating, renaming, editing, importing, sharing, and persisting documents—rather than sprawling feature parity.

## Features
- **Simulated Demo Authentication**: Explicit demo sign-in (`POST /api/auth/demo-login`) for 4 seeded workspace accounts, issuing HMAC-SHA256 signed `Authorization: Bearer` tokens with 24-hour expiry and logout revocation (`POST /api/auth/logout`).
- **Document Library**: Live search by title or owner, **Recent documents** quick-access strip, ownership filter tabs (**All Documents**, **Owned by Me**, **Shared with Me**), inline rename, sharing modal, and owner-only deletion.
- **Rich-Text Editor (Tiptap v3)**: Undo/Redo, Normal text, H1–H3 headings, Bold, Italic, Underline, Bulleted lists, Numbered lists, Clear formatting, live word count, serialized autosave (`1.2s`), manual **Save**, and `Ctrl/Cmd + S` shortcut.
- **File Import (`.txt`, `.md`, `.docx`)**: Multipart upload (`POST /api/documents/import`, max `5 MB`) with server-side extension, MIME, UTF-8/binary, and ZIP magic-byte validation (`PK\x03\x04`), converted via `marked` / `mammoth` and sanitized with `sanitize-html`.
- **Role-Based Sharing**: Owners can grant, update, or revoke `Editor` (`Can edit`) and `Viewer` (`View only`) permissions. Viewers are locked read-only in both the UI and API (`403`).
- **Transactional SQLite Persistence**: Uses Node's built-in `node:sqlite` (`DatabaseSync`) with `WAL` mode, `busy_timeout = 5000`, foreign keys, startup `PRAGMA quick_check`, and `BEGIN IMMEDIATE` transactions.

## Technology Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Tiptap v3 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`), Lucide Icons.
- **Backend**: Node.js (`>= 22.14.0`), Express 4, `node:sqlite` (`DatabaseSync`), `multer`, `mammoth`, `marked`, `sanitize-html`.
- **Testing & Tooling**: Vitest, Supertest, Vite 8, esbuild, tsx.

## Project Structure
```text
├── server.ts                  # Express entrypoint + Vite middleware / production static serving
├── server/
│   ├── app.ts                 # REST API routes, validation, security headers, error handling
│   ├── auth.ts                # HMAC-SHA256 demo session token signing, verification & revocation
│   ├── importer.ts            # .txt / .md / .docx parser, magic-byte checks & HTML sanitization
│   ├── seed.ts                # Seeded demo users & initial starter documents
│   └── store.ts               # Transactional SQLite (node:sqlite) repository
├── src/
│   ├── App.tsx                # Root state, in-memory Bearer session, URL ?doc sync & modals
│   ├── api/client.ts          # Typed fetch client sending Authorization: Bearer tokens
│   ├── types/document.ts      # Shared TypeScript interfaces
│   └── components/
│       ├── DemoLoginView.tsx  # Simulated demo account sign-in screen
│       ├── TopBar.tsx         # Workspace navigation & session switcher / sign-out
│       ├── DocumentLibrary.tsx# Recent docs strip, ownership tabs, search & table
│       ├── DocumentEditor.tsx # Tiptap editor, formatting toolbar & serialized autosave
│       ├── ImportModal.tsx    # Drag-and-drop .txt / .md / .docx uploader
│       ├── ShareModal.tsx     # Collaborator permission management
│       └── ProjectNotesView.tsx
├── tests/api.test.ts          # Vitest + Supertest integration test suite
├── ARCHITECTURE.md            # System architecture, schema & tradeoffs
├── AI_WORKFLOW.md             # AI usage, refinements & verified test results
├── WALKTHROUGH_SCRIPT.md      # 3–5 minute video walkthrough guide
└── SUBMISSION.md              # Submission links & manual checklist
```

## Prerequisites
- **Node.js `>= 22.14.0`** (required for built-in `node:sqlite`)
- **npm `>= 10`**

## Installation
```bash
npm install
cp .env.example .env
```

## Environment Variables
Configured in `.env.example`:
- `PORT`: HTTP port for Express + Vite server (default `3000`).
- `DATA_DIR`: Directory storing `draftline.db` (default `./data`). Point to a mounted persistent volume in production.
- `APP_URL`: Public URL where the app is hosted.
- `SESSION_SECRET` *(optional)*: 32+ character signing key for HMAC Bearer tokens in production (falls back to an in-memory `crypto.randomBytes(32)` key if unset).

## Local Development
```bash
npm run dev
```
Open `http://localhost:3000`.

## Testing, Type-Checking & Production Build
```bash
npm test        # Runs Vitest + Supertest integration suite (tests/api.test.ts)
npm run lint    # Runs TypeScript type-check (tsc --noEmit)
npm run build   # Builds frontend (dist/) and bundles server (server.js)
npm start       # Runs NODE_ENV=production node server.js on PORT
```

## API Overview
- `GET /api/health` — Server health check (`{ ok: true }`)
- `GET /api/auth/demo-accounts` — Lists seeded demo accounts
- `POST /api/auth/demo-login` — Issues signed Bearer token for a selected demo user
- `GET /api/auth/me` *(auth)* — Returns active authenticated user
- `POST /api/auth/logout` *(auth)* — Revokes active Bearer token
- `GET /api/users` *(auth)* — Lists seeded collaborators
- `GET /api/documents` *(auth)* — Lists owned and shared documents for caller
- `POST /api/documents` *(auth)* — Creates a new document
- `POST /api/documents/import` *(auth)* — Imports `.txt`, `.md`, or `.docx` into an editable document
- `GET /api/documents/:id` *(auth)* — Fetches a document (owner or shared collaborator)
- `PATCH /api/documents/:id` *(auth)* — Renames or updates content (owner or `editor`)
- `DELETE /api/documents/:id` *(auth)* — Deletes a document (owner only)
- `PUT /api/documents/:id/shares` *(auth)* — Grants or updates collaborator permission (owner only)
- `DELETE /api/documents/:id/shares/:targetUserId` *(auth)* — Revokes collaborator access (owner only)

## Deployment (with Persistent Storage)
1. Provision a **Node `>= 22.14.0`** environment (Render, Railway, Fly.io, Cloud Run).
2. Mount a persistent writable disk/volume and set `DATA_DIR` to that mount path (e.g., `DATA_DIR=/data`) so `draftline.db` persists across container restarts and deployments.
3. Set `NODE_ENV=production`, `PORT=3000` (or platform port), and `SESSION_SECRET`.
4. Build with `npm run build` and start with `npm start`.

## Demo User Accounts
Select any seeded user on the **Sign in to Draftline** screen (simulated demo auth, no password required):

| Name | Email | Role | ID |
| :--- | :--- | :--- | :--- |
| Maya Lin | `maya@draftline.app` | Product Lead | `user-maya` |
| Devon Brooks | `devon@draftline.app` | Staff Engineer | `user-devon` |
| Priya Nair | `priya@draftline.app` | Design Systems | `user-priya` |
| Carlos Vega | `carlos@draftline.app` | Operations | `user-carlos` |

## Reviewer Quick Verification
1. Sign in as **Maya Lin**, create a document, apply headings/bold/italic/underline/lists, rename it, and wait for **Saved**.
2. Refresh the page and sign back in as **Maya Lin** to verify SQLite persistence across refreshes.
3. Click **Import File** to upload a `.txt`, `.md`, or `.docx` file into an editable document.
4. Click **Share**, grant **Carlos Vega** `Can view` access, switch demo session to **Carlos Vega**, and verify the document appears under **Shared with Me** in read-only mode.

## Known Limitations
- **Simulated Demo Auth**: Uses a seeded demo account selector issuing in-memory HMAC Bearer tokens rather than real passwords or external OAuth/OIDC. Refreshing returns to the Demo Sign-In screen while documents and shares persist in SQLite.
- **Single-Node SQLite**: Built for single-instance deployment with persistent disk (`DATA_DIR`). Multi-instance horizontal scaling would require migrating `DocumentStore` to PostgreSQL.
- **No Real-Time CRDT Co-Editing**: Concurrent edits serialize safely on the server (last committed save wins), without live multi-cursor presence.

## Related Documentation
- `ARCHITECTURE.md` — Frontend/backend design, SQLite schema, auth, and security
- `AI_WORKFLOW.md` — AI assistance, code modifications, and verified test/build results
- `WALKTHROUGH_SCRIPT.md` — 3–5 minute video recording script
- `SUBMISSION.md` — Live links, demo accounts, and submission checklist
