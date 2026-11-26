# Draftline — Collaborative Document Workspace

A focused full-stack rich-text document application inspired by Google Docs, built with React, TypeScript, Tailwind CSS, Tiptap, and Express.

## Features
- **Document Lifecycle**: Create, rename (inline in library or editor), edit, save (auto-save + manual `Ctrl/Cmd+S`), reopen, and delete documents.
- **Rich-Text Editor**: Powered by Tiptap with Undo/Redo, Normal text, H1–H3 headings, Bold, Italic, Underline, Bulleted lists, Numbered lists, Clear formatting, and live word count.
- **File Import (`.txt`, `.md`, `.docx`)**: Multipart upload parsed on the server with `marked` and `mammoth`, sanitized via `sanitize-html`, and opened directly in the editor.
- **Sharing & Access Control**: Switch between 4 seeded users (`Maya Lin`, `Devon Brooks`, `Priya Nair`, `Carlos Vega`). Owners can grant or revoke `Can edit` and `Can view` permissions; library tabs clearly separate **Owned by Me** from **Shared with Me**.
- **Persistence**: Atomic JSON persistence (`data/documents.json`) preserves documents and sharing records across browser refreshes and server restarts.

## Running Locally
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

## Running Tests & Production Build
```bash
npm test       # Runs Vitest + Supertest integration tests
npm run lint   # TypeScript check (tsc --noEmit)
npm run build  # Builds Vite frontend (dist/) and Express server (server.js)
npm start      # Serves production bundle on port 3000
```

## Documentation
- `ARCHITECTURE.md` — Scope choices, data model, and persistence tradeoffs.
- `AI_WORKFLOW.md` — Where AI helped, what was verified, and what was changed.
- `WALKTHROUGH_SCRIPT.md` — 3–5 minute demo walkthrough script.
