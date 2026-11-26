import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  createDocument,
  deleteDocument,
  fetchDocument,
  fetchDocuments,
  fetchUsers,
  updateDocument,
} from './api/client';
import { DocumentEditor } from './components/DocumentEditor';
import { DocumentLibrary } from './components/DocumentLibrary';
import { ImportModal } from './components/ImportModal';
import { ProjectNotesView } from './components/ProjectNotesView';
import { ShareModal } from './components/ShareModal';
import { TopBar } from './components/TopBar';
import type {
  DocumentDTO,
  DocumentFilter,
  SeededUser,
} from './types/document';

function readUrlState(): { userId: string; docId: string | null } {
  const params = new URLSearchParams(window.location.search);
  return {
    userId: params.get('user') || 'user-maya',
    docId: params.get('doc'),
  };
}

function writeUrlState(userId: string, docId: string | null) {
  const params = new URLSearchParams(window.location.search);
  params.set('user', userId);
  if (docId) {
    params.set('doc', docId);
  } else {
    params.delete('doc');
  }
  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', next);
}

export default function App() {
  const initial = readUrlState();

  const [users, setUsers] = useState<SeededUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>(initial.userId);
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<DocumentFilter | 'notes'>(
    'all'
  );
  const [openDocId, setOpenDocId] = useState<string | null>(initial.docId);
  const [activeDocument, setActiveDocument] = useState<DocumentDTO | null>(null);
  const [loadingSingleDoc, setLoadingSingleDoc] = useState<boolean>(false);

  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<DocumentDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Load seeded users once
  useEffect(() => {
    fetchUsers()
      .then((list) => {
        setUsers(list);
        if (list.length > 0 && !list.some((u) => u.id === activeUserId)) {
          setActiveUserId(list[0].id);
        }
      })
      .catch((err) => {
        setDocsError(
          err instanceof Error ? err.message : 'Failed to load seeded users.'
        );
      });
  }, [activeUserId]);

  // Load documents for active user
  const loadDocuments = useCallback(async (userId: string) => {
    setLoadingDocs(true);
    setDocsError(null);
    try {
      const docs = await fetchDocuments(userId);
      setDocuments(docs);
    } catch (err) {
      setDocsError(
        err instanceof Error ? err.message : 'Failed to load documents.'
      );
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    writeUrlState(activeUserId, openDocId);
  }, [activeUserId, openDocId]);

  useEffect(() => {
    void loadDocuments(activeUserId);
  }, [activeUserId, loadDocuments]);

  // Load specific document when openDocId changes
  useEffect(() => {
    if (!openDocId) {
      setActiveDocument(null);
      return;
    }

    let cancelled = false;
    setLoadingSingleDoc(true);
    fetchDocument(activeUserId, openDocId)
      .then((doc) => {
        if (!cancelled) {
          setActiveDocument(doc);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setOpenDocId(null);
          setActiveDocument(null);
          showToast(
            err instanceof Error
              ? err.message
              : 'You do not have access to that document.',
            'error'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSingleDoc(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeUserId, openDocId, showToast]);

  const activeUser =
    users.find((u) => u.id === activeUserId) ?? users[0] ?? null;

  const handleSelectSection = (section: DocumentFilter | 'notes') => {
    setOpenDocId(null);
    setActiveDocument(null);
    setActiveSection(section);
  };

  const handleSwitchUser = (nextUserId: string) => {
    setActiveUserId(nextUserId);
    const nextUser = users.find((u) => u.id === nextUserId);
    if (nextUser) {
      showToast(`Switched account to ${nextUser.name}`);
    }
  };

  const handleCreateDocument = async () => {
    setCreating(true);
    try {
      const doc = await createDocument(activeUserId, {
        title: 'Untitled Document',
        contentHtml: '<p></p>',
      });
      setDocuments((prev) => [doc, ...prev]);
      setActiveSection('all');
      setOpenDocId(doc.id);
      setActiveDocument(doc);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not create document.',
        'error'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRenameDocument = async (docId: string, nextTitle: string) => {
    const updated = await updateDocument(activeUserId, docId, {
      title: nextTitle,
    });
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    if (activeDocument?.id === updated.id) {
      setActiveDocument(updated);
    }
    showToast('Document renamed');
  };

  const handleDocumentUpdated = useCallback((updated: DocumentDTO) => {
    setDocuments((prev) => {
      const exists = prev.some((d) => d.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev
        .map((d) => (d.id === updated.id ? updated : d))
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    });
    setActiveDocument((curr) => (curr?.id === updated.id ? updated : curr));
    setShareTarget((curr) => (curr?.id === updated.id ? updated : curr));
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocument(activeUserId, deleteTarget.id);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      if (openDocId === deleteTarget.id) {
        setOpenDocId(null);
        setActiveDocument(null);
      }
      showToast(`Deleted "${deleteTarget.title}"`);
      setDeleteTarget(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not delete document.',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        users={users}
        activeUser={activeUser}
        onSwitchUser={handleSwitchUser}
      />

      {openDocId ? (
        loadingSingleDoc && !activeDocument ? (
          <div className="max-w-[816px] mx-auto py-12 px-4">
            <div className="bg-white border border-slate-200 rounded-xl p-12 space-y-4 animate-pulse">
              <div className="h-7 bg-slate-200 rounded w-1/2" />
              <div className="h-4 bg-slate-100 rounded w-full" />
              <div className="h-4 bg-slate-100 rounded w-5/6" />
              <div className="h-4 bg-slate-100 rounded w-4/6" />
            </div>
          </div>
        ) : activeDocument ? (
          <DocumentEditor
            document={activeDocument}
            activeUserId={activeUserId}
            onBack={() => {
              setOpenDocId(null);
              setActiveDocument(null);
              void loadDocuments(activeUserId);
            }}
            onUpdated={handleDocumentUpdated}
            onOpenShare={(doc) => setShareTarget(doc)}
            onDeleteRequest={(doc) => setDeleteTarget(doc)}
          />
        ) : null
      ) : activeSection === 'notes' ? (
        <ProjectNotesView
          onBackToDocuments={() => handleSelectSection('all')}
        />
      ) : (
        <DocumentLibrary
          documents={documents}
          loading={loadingDocs}
          error={docsError}
          filter={activeSection}
          onFilterChange={setActiveSection}
          onOpenDocument={(id) => setOpenDocId(id)}
          onCreateDocument={handleCreateDocument}
          onOpenImport={() => setImportOpen(true)}
          onRenameDocument={handleRenameDocument}
          onOpenShare={(doc) => setShareTarget(doc)}
          onDeleteDocument={(doc) => setDeleteTarget(doc)}
          creating={creating}
        />
      )}

      {/* Import File Modal */}
      {importOpen && (
        <ImportModal
          activeUserId={activeUserId}
          onClose={() => setImportOpen(false)}
          onImported={(doc) => {
            setImportOpen(false);
            setDocuments((prev) => [doc, ...prev]);
            setActiveSection('all');
            setOpenDocId(doc.id);
            setActiveDocument(doc);
            showToast(`Imported "${doc.title}"`);
          }}
        />
      )}

      {/* Share Modal */}
      {shareTarget && (
        <ShareModal
          document={shareTarget}
          users={users}
          activeUserId={activeUserId}
          onClose={() => setShareTarget(null)}
          onUpdated={handleDocumentUpdated}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="delete-modal-title"
                  className="font-display text-base font-semibold text-slate-900"
                >
                  Delete &ldquo;{deleteTarget.title}&rdquo;?
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  This permanently removes the document and revokes access for all collaborators.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="h-9 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-sm font-medium text-white cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-xl border shadow-lg flex items-center gap-2.5 text-sm ${
            toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
