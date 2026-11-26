import { ArrowLeft } from 'lucide-react';

interface ProjectNotesViewProps {
  onBackToDocuments: () => void;
}

export function ProjectNotesView({ onBackToDocuments }: ProjectNotesViewProps) {
  return (
    <main className="max-w-[920px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Architecture &amp; AI Workflow Notes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Scope rationale, verification summary, and reviewer guide (also saved in ARCHITECTURE.md, AI_WORKFLOW.md, and SUBMISSION.md).
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToDocuments}
          className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Documents</span>
        </button>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          01. Architecture &amp; Scope Choices
        </h2>
        <div className="space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            <strong>Focused Scope Over Feature Parity:</strong> Draftline deliberately omits real-time operational transformation/CRDT cursors, nested folder trees, comment threads, and external OAuth providers. Instead, it delivers a reliable end-to-end core: creating, renaming, formatting, importing, sharing, and persisting documents.
          </p>
          <p>
            <strong>Rich-Text Editor (Tiptap / ProseMirror):</strong> Built on Tiptap StarterKit v3 rather than raw browser <code>contentEditable</code> / <code>execCommand</code> so bold, italic, underline, H1–H3 headings, bulleted/numbered lists, and undo/redo produce clean, consistent HTML across browsers.
          </p>
          <p>
            <strong>Server-Side Import &amp; Sanitization:</strong> Uploaded <code>.txt</code>, <code>.md</code>, and <code>.docx</code> files (max 5 MB) are parsed on the Express backend with <code>mammoth</code> and <code>marked</code>, then sanitized with <code>sanitize-html</code> using an allowlist of safe formatting tags before storage.
          </p>
          <p>
            <strong>Transactional SQLite Persistence &amp; Simulated Demo Auth:</strong> Documents and share records persist in SQLite (<code>node:sqlite</code> with WAL mode, foreign keys, and <code>BEGIN IMMEDIATE</code> transactions) under <code>DATA_DIR/draftline.db</code>, eliminating JSON corruption and concurrent write races. Authentication uses an explicit simulated demo login flow (<code>POST /api/auth/demo-login</code>) issuing HMAC-SHA256 signed <code>Authorization: Bearer</code> tokens held strictly in React memory.
          </p>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          02. AI Workflow Note
        </h2>
        <div className="space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            <strong>Where AI Helped:</strong> AI assisted with scaffolding the Express REST router, Tiptap toolbar wiring, TypeScript DTO contracts, and Vitest + Supertest integration test cases.
          </p>
          <p>
            <strong>What Was Verified:</strong> Verified Tiptap v3 StarterKit type definitions, ran the Vitest suite testing SQLite transaction safety, concurrent writes, file import parsing, XSS tag stripping, HMAC token verification, and role-based 403 enforcement, plus verified TypeScript compilation and Vite/esbuild production bundling.
          </p>
          <p>
            <strong>What Was Changed:</strong> Replaced initial header-based <code>X-User-Id</code> user switching with an authenticated demo login flow and server-signed Bearer tokens, upgraded persistence from a flat JSON file to transactional SQLite WAL storage, removed unused template packages/configs, and fixed HTML block-boundary spacing in word counting.
          </p>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-3">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          03. Quick Reviewer Verification Flow
        </h2>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
          <li>
            Sign in as <strong>Maya Lin</strong> on the Demo Sign-In screen, create a new document, format headings/lists/bold/underline, rename it, and verify the status settles on <strong>Saved</strong>.
          </li>
          <li>
            Refresh the browser page and sign back in to confirm the document, edits, and sharing state persisted in SQLite.
          </li>
          <li>
            Click <strong>Import File</strong> to upload a <code>.txt</code>, <code>.md</code>, or <code>.docx</code> file and edit the resulting document.
          </li>
          <li>
            Click <strong>Share</strong>, grant <strong>Carlos Vega</strong> <em>Can view</em> or <em>Can edit</em> access, then switch demo session to <strong>Carlos Vega</strong> in the top-right menu and open <strong>Shared with Me</strong>.
          </li>
        </ol>
      </section>
    </main>
  );
}
