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
            Scope rationale, verification summary, and reviewer guide (also saved in ARCHITECTURE.md, AI_WORKFLOW.md, and WALKTHROUGH_SCRIPT.md).
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
            <strong>Focused Scope Over Feature Parity:</strong> Draftline deliberately omits real-time operational transformation/CRDT cursors, nested folder trees, comment threads, and external OAuth logins. Instead, it delivers a reliable end-to-end core: creating, renaming, formatting, importing, sharing, and persisting documents.
          </p>
          <p>
            <strong>Rich-Text Editor (Tiptap / ProseMirror):</strong> Built on Tiptap StarterKit v3 rather than raw browser <code>contentEditable</code> / <code>execCommand</code> so bold, italic, underline, H1–H3 headings, bulleted/numbered lists, and undo/redo produce clean, consistent HTML across browsers.
          </p>
          <p>
            <strong>Server-Side Import &amp; Sanitization:</strong> Uploaded <code>.txt</code>, <code>.md</code>, and <code>.docx</code> files (max 5 MB) are parsed on the Express backend with <code>mammoth</code> and <code>marked</code>, then sanitized with <code>sanitize-html</code> using an allowlist of safe formatting tags before storage.
          </p>
          <p>
            <strong>Simple Persistence &amp; Seeded Access Control:</strong> Documents and share records persist atomically to <code>data/documents.json</code> using write-temp-and-rename, surviving page refreshes and server restarts without external database setup. Four seeded team accounts can be switched from the header, with every API endpoint enforcing owner, editor, and viewer permissions via <code>X-User-Id</code>.
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
            <strong>What Was Verified:</strong> Verified Tiptap v3 StarterKit type definitions (confirming <code>Underline</code> is bundled natively in v3 to prevent duplicate extension registration), ran the full Vitest suite testing CRUD, file import parsing, XSS tag stripping, and role-based 403 enforcement, and verified TypeScript compilation plus Vite production bundling.
          </p>
          <p>
            <strong>What Was Changed:</strong> Removed duplicate standalone Tiptap Underline registration after checking package types, moved <code>.docx</code>/<code>.md</code> parsing and HTML sanitization exclusively to the backend trust boundary, and replaced raw browser dialogs with accessible in-app confirmation and sharing modals.
          </p>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-3">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          03. Quick Reviewer Verification Flow
        </h2>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
          <li>
            As <strong>Maya Lin</strong>, create a new document, format headings/lists/bold/underline, rename it, and verify the status settles on <strong>Saved</strong>.
          </li>
          <li>
            Refresh the browser page to confirm the document, edits, and active user persist via URL state and server storage.
          </li>
          <li>
            Click <strong>Import File</strong> to upload a <code>.txt</code>, <code>.md</code>, or <code>.docx</code> file and edit the resulting document.
          </li>
          <li>
            Click <strong>Share</strong>, grant <strong>Carlos Vega</strong> <em>Can view</em> or <em>Can edit</em> access, then switch to <strong>Carlos Vega</strong> in the top-right switcher and check <strong>Shared with Me</strong>.
          </li>
        </ol>
      </section>
    </main>
  );
}
