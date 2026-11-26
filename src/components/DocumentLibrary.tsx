import {
  Check,
  Clock,
  FileText,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { DocumentDTO, DocumentFilter } from '../types/document';

interface DocumentLibraryProps {
  documents: DocumentDTO[];
  loading: boolean;
  error: string | null;
  filter: DocumentFilter;
  onFilterChange: (filter: DocumentFilter) => void;
  onOpenDocument: (docId: string) => void;
  onCreateDocument: () => void;
  onOpenImport: () => void;
  onRenameDocument: (docId: string, nextTitle: string) => Promise<void>;
  onOpenShare: (doc: DocumentDTO) => void;
  onDeleteDocument: (doc: DocumentDTO) => void;
  creating: boolean;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function RoleTag({ doc }: { doc: DocumentDTO }) {
  if (doc.isOwner) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-300 bg-slate-100 text-[11px] font-medium text-slate-800 whitespace-nowrap">
        Owner
      </span>
    );
  }
  if (doc.accessRole === 'editor') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-[11px] font-medium text-blue-700 whitespace-nowrap">
        Editor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-[11px] font-medium text-amber-800 whitespace-nowrap">
      Viewer
    </span>
  );
}

export function DocumentLibrary({
  documents,
  loading,
  error,
  filter,
  onFilterChange,
  onOpenDocument,
  onCreateDocument,
  onOpenImport,
  onRenameDocument,
  onOpenShare,
  onDeleteDocument,
  creating,
}: DocumentLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [savingRename, setSavingRename] = useState(false);

  const ownedCount = documents.filter((d) => d.isOwner).length;
  const sharedCount = documents.filter((d) => !d.isOwner).length;

  const filteredDocuments = documents.filter((doc) => {
    if (filter === 'owned' && !doc.isOwner) return false;
    if (filter === 'shared' && doc.isOwner) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.owner.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const recentDocuments = !searchQuery.trim()
    ? filteredDocuments.slice(0, 3)
    : [];

  const startRename = (doc: DocumentDTO) => {
    setRenamingId(doc.id);
    setRenameValue(doc.title);
    setRenameError(null);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
    setRenameError(null);
  };

  const submitRename = async (docId: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError('Document title cannot be empty.');
      return;
    }
    setSavingRename(true);
    setRenameError(null);
    try {
      await onRenameDocument(docId, trimmed);
      setRenamingId(null);
    } catch (err) {
      setRenameError(
        err instanceof Error ? err.message : 'Could not rename document.'
      );
    } finally {
      setSavingRename(false);
    }
  };

  const sectionHeading =
    filter === 'owned'
      ? 'Owned by Me'
      : filter === 'shared'
      ? 'Shared with Me'
      : 'All Documents';

  return (
    <main className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Workspace Header & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {sectionHeading}
          </h1>
          <p className="text-sm text-slate-500 mt-1 tabular-nums">
            {documents.length} total · {ownedCount} owned · {sharedCount} shared with you
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenImport}
            className="h-10 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Import File</span>
          </button>

          <button
            type="button"
            onClick={onCreateDocument}
            disabled={creating}
            className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium text-white inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Plus className="w-4 h-4" />
            <span>{creating ? 'Creating...' : 'New Document'}</span>
          </button>
        </div>
      </div>

      {/* Recent Documents Strip */}
      {!loading && recentDocuments.length > 0 && (
        <section aria-label="Recent documents" className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Recent documents</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recentDocuments.map((doc) => (
              <button
                key={`recent-${doc.id}`}
                type="button"
                onClick={() => onOpenDocument(doc.id)}
                className="text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-slate-50/40 transition-colors cursor-pointer space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-slate-900 truncate">
                    {doc.title}
                  </span>
                  <RoleTag doc={doc} />
                </div>
                <p className="text-xs text-slate-500 truncate tabular-nums">
                  {doc.isOwner ? 'Owned by you' : `By ${doc.owner.name}`}
                  <span aria-hidden="true"> · </span>
                  {formatRelativeDate(doc.updatedAt)}
                  <span aria-hidden="true"> · </span>
                  {doc.wordCount} {doc.wordCount === 1 ? 'word' : 'words'}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Filter Segmented Control + Live Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter documents by ownership"
          className="inline-flex items-center p-1 rounded-lg bg-slate-100 border border-slate-200/80 self-start overflow-x-auto max-w-full"
        >
          {(
            [
              { id: 'all', label: `All (${documents.length})` },
              { id: 'owned', label: `Owned by Me (${ownedCount})` },
              { id: 'shared', label: `Shared with Me (${sharedCount})` },
            ] as const
          ).map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer tabular-nums ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or owner..."
            aria-label="Search documents"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Document Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="px-5 py-4 flex items-center justify-between gap-4 animate-pulse"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-100 rounded w-1/4" />
                </div>
                <div className="h-4 bg-slate-100 rounded w-24" />
              </div>
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="px-6 py-16 text-center max-w-md mx-auto space-y-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              {searchQuery.trim()
                ? 'No matching documents'
                : filter === 'shared'
                ? 'No documents shared with you yet'
                : 'No documents in this view'}
            </h2>
            <p className="text-sm text-slate-500">
              {searchQuery.trim()
                ? 'Try clearing your search filter or switching tabs.'
                : filter === 'shared'
                ? 'Switch to another demo account in the top right and share a document with this account.'
                : 'Create a blank document or import an existing .txt, .md, or .docx file to get started.'}
            </p>
            {!searchQuery.trim() && filter !== 'shared' && (
              <div className="pt-2 flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Import File
                </button>
                <button
                  type="button"
                  onClick={onCreateDocument}
                  className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-medium text-white cursor-pointer"
                >
                  New Document
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="py-3 pl-5 pr-4">Document</th>
                  <th className="py-3 px-4 hidden sm:table-cell">
                    Ownership &amp; Access
                  </th>
                  <th className="py-3 px-4 hidden md:table-cell">Shared With</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Updated</th>
                  <th className="py-3 pl-4 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map((doc) => {
                  const isRenaming = renamingId === doc.id;
                  const canEdit =
                    doc.isOwner || doc.accessRole === 'editor';

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Document Title + Metadata */}
                      <td className="py-3.5 pl-5 pr-4 min-w-[220px]">
                        {isRenaming ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={renameValue}
                                maxLength={160}
                                autoFocus
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void submitRename(doc.id);
                                  } else if (e.key === 'Escape') {
                                    cancelRename();
                                  }
                                }}
                                aria-label="New document title"
                                className="h-8 px-2.5 rounded-md border border-blue-500 text-sm text-slate-900 w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                              <button
                                type="button"
                                disabled={savingRename}
                                onClick={() => void submitRename(doc.id)}
                                aria-label="Save title"
                                className="p-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelRename}
                                aria-label="Cancel rename"
                                className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {renameError && (
                              <p className="text-xs text-red-600">
                                {renameError}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <FileText className="w-4 h-4 text-blue-600 mt-1 shrink-0" />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => onOpenDocument(doc.id)}
                                className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors text-left truncate max-w-md block cursor-pointer"
                              >
                                {doc.title}
                              </button>
                              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                                {doc.wordCount}{' '}
                                {doc.wordCount === 1 ? 'word' : 'words'}
                                {doc.sourceFormat !== 'native' && (
                                  <>
                                    <span aria-hidden="true"> · </span>
                                    <span>Imported .{doc.sourceFormat}</span>
                                  </>
                                )}
                              </p>
                              {/* Compact mobile summary */}
                              <div className="sm:hidden flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                                <RoleTag doc={doc} />
                                <span>
                                  {doc.isOwner
                                    ? 'You'
                                    : doc.owner.name}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">
                                  {formatRelativeDate(doc.updatedAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Ownership & Access */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap hidden sm:table-cell">
                        <div className="inline-flex items-center gap-2">
                          <RoleTag doc={doc} />
                          <span>
                            {doc.isOwner ? (
                              'Owned by you'
                            ) : (
                              <>
                                Shared by{' '}
                                <strong className="font-medium text-slate-900">
                                  {doc.owner.name}
                                </strong>
                              </>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Collaborators */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 hidden md:table-cell whitespace-nowrap tabular-nums">
                        {doc.sharedWith.length === 0
                          ? 'Private'
                          : doc.sharedWith.length === 1
                          ? doc.sharedWith[0].name
                          : `${doc.sharedWith.length} collaborators`}
                      </td>

                      {/* Updated Timestamp */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 hidden sm:table-cell whitespace-nowrap tabular-nums">
                        {formatRelativeDate(doc.updatedAt)}
                      </td>

                      {/* Row Actions */}
                      <td className="py-3.5 pl-4 pr-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenDocument(doc.id)}
                            className="h-8 px-2.5 rounded-md text-xs font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 transition-colors cursor-pointer"
                          >
                            Open
                          </button>

                          {canEdit && !isRenaming && (
                            <button
                              type="button"
                              onClick={() => startRename(doc)}
                              aria-label={`Rename ${doc.title}`}
                              title="Rename document"
                              className="p-2 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {doc.isOwner && (
                            <button
                              type="button"
                              onClick={() => onOpenShare(doc)}
                              aria-label={`Share ${doc.title}`}
                              title="Share document"
                              className="p-2 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50/70 transition-colors cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {doc.isOwner && (
                            <button
                              type="button"
                              onClick={() => onDeleteDocument(doc)}
                              aria-label={`Delete ${doc.title}`}
                              title="Delete document"
                              className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
