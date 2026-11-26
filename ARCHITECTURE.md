# Architecture & Scope Note

## Goal
**Draftline** is a focused, full-stack document editor inspired by Google Docs. Rather than aiming for broad feature parity, it prioritizes a dependable, cleanly testable core workflow: creating, renaming, formatting, importing, sharing, and persisting documents.

## Scope Choices

1. **In-Scope Core**
   - Document CRUD (`POST`, `GET`, `PATCH`, `DELETE`) with inline renaming and validation.
   - Rich-text editing via **Tiptap (ProseMirror)** supporting Undo/Redo, Normal text, H1–H3 headings, Bold, Italic, Underline, Bulleted lists, Numbered lists, and Clear formatting.
   - Debounced auto-save (`1.2s`) alongside an explicit `Save` button and `Ctrl/Cmd + S` shortcut.
   - Server-side file import (`POST /api/documents/import`) converting `.txt`, `.md` (`marked`), and `.docx` (`mammoth`) into sanitized editable HTML (`sanitize-html`).
   - Ownership & sharing model with 4 seeded team members (`Maya Lin`, `Devon Brooks`, `Priya Nair`, `Carlos Vega`), clear separation between **Owned by Me** and **Shared with Me**, and server-enforced `owner`, `editor`, and `viewer` roles.

2. **Intentionally Out of Scope**
   - Real-time multi-cursor CRDT/WebSocket co-editing (last-write persistence is sufficient for the target scope).
   - External OAuth/password authentication (replaced by an instant seeded user switcher sending `X-User-Id` so sharing can be verified immediately).
   - Nested folders, comment threads, version history diffs, and PDF export.

## Persistence & Trust Boundaries
- **Storage**: `DocumentStore` (`server/store.ts`) persists all documents and sharing records to `data/documents.json` using atomic write-temp-and-rename (`fs.writeFileSync` + `fs.renameSync`) so refreshes and server restarts never corrupt state.
- **Security & Sanitization**: Uploaded files are size-limited (`5 MB`), extension-checked, parsed on the backend, and passed through `sanitize-html` with a strict formatting tag allowlist (stripping `<script>`, event attributes, and unsafe URLs) before storage or rendering.
- **Authorization**: Every `/api/documents*` route verifies caller identity against seeded users and enforces ownership/permission checks (`403` for view-only edits, non-owner share changes, or non-owner deletions).
