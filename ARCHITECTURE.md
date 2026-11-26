# Architecture & Technical Design

## 1. Frontend Architecture
- **Single-Page Application (`src/App.tsx`)**: Manages in-memory demo authentication session (`DemoSession`), URL query sync (`?doc=<id>`), workspace document list, modal states, and toast notifications.
- **Top Navigation (`src/components/TopBar.tsx`)**: Three-zone bar with brand wordmark, ownership/documentation tabs (`All Documents`, `Owned by Me`, `Shared with Me`, `Project Notes`), and authenticated demo session switcher + sign-out menu.
- **Document Library (`src/components/DocumentLibrary.tsx`)**: Displays recent documents strip, ownership filter tabs, live client-side search, inline title renaming with validation, loading skeletons, empty states, and accessible actions.
- **Rich-Text Editor (`src/components/DocumentEditor.tsx`)**: Wraps Tiptap v3 (`StarterKit` configured for H1–H3, bold, italic, underline, bullet/ordered lists, undo/redo + `Placeholder`). Uses ref-backed serialized saving (`runSerializedSave`) to prevent stale closures, avoid duplicate overlapping `PATCH` requests, preserve newer edits made while a save is in flight, and flush pending edits before navigation or account switching.
- **Modals (`ImportModal.tsx`, `ShareModal.tsx`)**: Provide client pre-validation, drag-and-drop file selection, collaborator management, and inline error reporting.

## 2. Backend Architecture
- **`server.ts`**: Application entrypoint configuring `DATA_DIR`, initializing `DocumentStore` and `AuthService`, mounting Vite dev middleware in development or serving `dist/` in production on port `3000`, and handling graceful `SIGINT`/`SIGTERM` database closure.
- **`server/app.ts`**: Express REST router (`createApiApp`) enforcing security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy`), `2 MB` JSON limit, `5 MB` multipart file limit, centralized `400`/`401`/`403`/`404`/`500` error mapping (never leaking stack traces), and authentication middleware.
- **`server/auth.ts`**: `AuthService` issuing and verifying HMAC-SHA256 signed session tokens with 24h TTL, `crypto.timingSafeEqual`, and in-memory revocation on logout.
- **`server/importer.ts`**: Server-side file parser and sanitizer validating file extensions, MIME prefixes, UTF-8 encoding (rejecting NUL bytes and binary control chars in `.txt`/`.md`), ZIP magic bytes (`PK\x03\x04`) for `.docx`, and sanitizing all HTML via `sanitize-html`.
- **`server/store.ts`**: SQLite repository (`DocumentStore`) backed by `node:sqlite`.

## 3. Data Model (`draftline.db`)
- **`documents` table**: `id TEXT PRIMARY KEY`, `title TEXT`, `content_html TEXT`, `owner_id TEXT`, `created_at TEXT`, `updated_at TEXT`, `last_edited_by_id TEXT`, `source_format TEXT`.
- **`document_shares` table**: `document_id TEXT REFERENCES documents(id) ON DELETE CASCADE`, `user_id TEXT`, `permission TEXT CHECK (permission IN ('editor', 'viewer'))`, `granted_at TEXT`, `PRIMARY KEY (document_id, user_id)`.

## 4. API Design
- `GET /api/health` — Liveness check (`{ ok: true }`).
- `GET /api/auth/demo-accounts` — Lists seeded demo profiles for the login screen.
- `POST /api/auth/demo-login` — Issues HMAC-signed Bearer token for a seeded user.
- `GET /api/auth/me` *(auth)* — Returns current authenticated user.
- `POST /api/auth/logout` *(auth)* — Revokes current Bearer token.
- `GET /api/users` *(auth)* — Lists workspace collaborators.
- `GET /api/documents` *(auth)* — Lists owned + shared documents for caller.
- `POST /api/documents` *(auth)* — Creates a document owned by caller.
- `POST /api/documents/import` *(auth)* — Parses and sanitizes `.txt`/`.md`/`.docx` upload into a new owned document.
- `GET /api/documents/:id` *(auth)* — Fetches document if owner or shared.
- `PATCH /api/documents/:id` *(auth)* — Renames or updates content if owner or `editor`.
- `DELETE /api/documents/:id` *(auth)* — Deletes document if owner.
- `PUT /api/documents/:id/shares` *(auth)* — Grants or updates `editor`/`viewer` share if owner.
- `DELETE /api/documents/:id/shares/:targetUserId` *(auth)* — Revokes collaborator share if owner.

## 5. Persistence Approach
SQLite (`node:sqlite` `DatabaseSync`) configured with `PRAGMA journal_mode = WAL;`, `PRAGMA busy_timeout = 5000;`, `PRAGMA foreign_keys = ON;`, and startup `PRAGMA quick_check;`. All writes run inside `BEGIN IMMEDIATE ... COMMIT` transactions with parameterized queries. If a legacy `documents.json` exists on first boot, valid records migrate into SQLite; corrupted legacy files throw an explicit error rather than silently overwriting user data with seed defaults.

## 6. Authentication Model
Simulated Demo Authentication: users choose a seeded team account (`POST /api/auth/demo-login`) to obtain a server-signed HMAC-SHA256 Bearer token kept strictly in React memory (never `localStorage` or `sessionStorage`). **This is explicitly a take-home demo flow, not production authentication** (no passwords, MFA, or external IdP).

## 7. Authorization
Every document and share endpoint enforces server-side RBAC:
- **Owner**: Read, rename, edit, share, revoke shares, delete.
- **Editor**: Read, rename, edit; denied (`403`) on sharing and deletion.
- **Viewer**: Read only; denied (`403`) on rename, edit, sharing, and deletion.
- **Unshared user**: Denied (`403`) on all document operations.

## 8. Security Considerations
- Strict HTML allowlist via `sanitize-html` on both `PATCH` and `POST /api/documents/import` blocks `<script>`, `<iframe>`, `on*` handlers, and `javascript:` URLs.
- File uploads check extensions, MIME prefixes, `5 MB` size cap, UTF-8 validity, and `.docx` ZIP magic headers before parsing.
- Parameterized SQL statements eliminate SQL injection; `timingSafeEqual` verifies HMAC signatures; JSON error handler suppresses internal stack traces.

## 9. Technical Tradeoffs
- **Tiptap vs. raw `contentEditable`**: Chose Tiptap for reliable cross-browser list/heading behavior at the cost of a slightly larger frontend bundle.
- **SQLite (`node:sqlite`) vs. Postgres**: Zero external DB setup and full ACID concurrency for single-instance deployment (`DATA_DIR` persistent volume), with a clean repository boundary (`DocumentStore`) if future multi-node scaling requires Postgres.
- **In-memory Bearer tokens vs. `localStorage`**: Avoids persistent token XSS exposure, trading off requiring one click on the Demo Sign-In screen after a full page reload.
