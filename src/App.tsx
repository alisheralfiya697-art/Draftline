import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  createDocument,
  deleteDocument,
  fetchDemoAccounts,
  fetchDocument,
  fetchDocuments,
  fetchUsers,
  loginDemoAccount,
  logoutSession,
  updateDocument,
  type DemoSession,
} from './api/client';
import { DemoLoginView } from './components/DemoLoginView';
import {
  DocumentEditor,
  type DocumentEditorHandle,
} from './components/DocumentEditor';
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

function readDocParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('doc');
}

function writeDocParam(docId: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (docId) {
    params.set('doc', docId);
  } else {
    params.delete('doc');
  }
  const query = params.toString();
  const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, '', next);
}

export default function App() {
  const editorRef = useRef<DocumentEditorHandle | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<SeededUser[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingInId, setSigningInId] = useState<string | null>(null);
  const [switchingUser, setSwitchingUser] = useState(false);

  // Session token is kept strictly in React memory (never localStorage/sessionStorage)
  const [session, setSession] = useState<DemoSession | null>(null);
  const [users, setUsers] = useState<SeededUser[]>([]);

  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<DocumentFilter | 'notes'>(
    'all'
  );
  const [openDocId, setOpenDocId] = useState<string | null>(readDocParam);
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

  // Load available demo accounts for the login screen
  useEffect(() => {
    setLoadingAccounts(true);
    fetchDemoAccounts()
      .then((accounts) => {
        setDemoAccounts(accounts);
      })
      .catch((err) => {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Unable to load demo workspace accounts.'
        );
      })
      .finally(() => {
        setLoadingAccounts(false);
      });
  }, []);

  const handleUnauthorized = useCallback(
    (err: unknown): boolean => {
      if (err instanceof ApiError && err.status === 401) {
        setSession(null);
        setActiveDocument(null);
        setDocuments([]);
        showToast('Session expired. Please sign in again.', 'error');
        return true;
      }
      return false;
    },
    [showToast]
  );

  // Sync URL ?doc=... parameter
  useEffect(() => {
    writeDocParam(openDocId);
  }, [openDocId]);

  const loadWorkspace = useCallback(
    async (token: string) => {
      setLoadingDocs(true);
      setDocsError(null);
      try {
        const [userList, docList] = await Promise.all([
          fetchUsers(token),
          fetchDocuments(token),
        ]);
        setUsers(userList);
        setDocuments(docList);
      } catch (err) {
        if (!handleUnauthorized(err)) {
          setDocsError(
            err instanceof Error ? err.message : 'Failed to load documents.'
          );
        }
      } finally {
        setLoadingDocs(false);
      }
    },
    [handleUnauthorized]
  );

  // Fetch workspace data whenever authenticated session changes
  useEffect(() => {
    if (!session) return;
    void loadWorkspace(session.token);
  }, [session, loadWorkspace]);

  // Load specific document when openDocId or session changes
  useEffect(() => {
    if (!session || !openDocId) {
      setActiveDocument(null);
      return;
    }

    let cancelled = false;
    setLoadingSingleDoc(true);
    fetchDocument(session.token, openDocId)
      .then((doc) => {
        if (!cancelled) {
          setActiveDocument(doc);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (!handleUnauthorized(err)) {
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
  }, [session, openDocId, handleUnauthorized, showToast]);

  const handleSignIn = async (userId: string) => {
    setSigningInId(userId);
    setAuthError(null);
    try {
      const nextSession = await loginDemoAccount(userId);
      setSession(nextSession);
      showToast(`Signed in as ${nextSession.user.name}`);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Unable to sign in.'
      );
    } finally {
      setSigningInId(null);
    }
  };

  const handleSwitchUser = async (nextUserId: string) => {
    if (!session) return;
    if (editorRef.current) {
      await editorRef.current.flushPendingSave();
    }
    setSwitchingUser(true);
    const previousToken = session.token;
    try {
      const nextSession = await loginDemoAccount(nextUserId);
      setSession(nextSession);
      void logoutSession(previousToken).catch(() => {});
      showToast(`Signed in as ${nextSession.user.name}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not switch account.',
        'error'
      );
    } finally {
      setSwitchingUser(false);
    }
  };

  const handleSignOut = async () => {
    if (editorRef.current) {
      await editorRef.current.flushPendingSave();
    }
    const token = session?.token;
    setSession(null);
    setActiveDocument(null);
    setDocuments([]);
    setShareTarget(null);
    setDeleteTarget(null);
    setImportOpen(false);
    if (token) {
      void logoutSession(token).catch(() => {});
    }
  };

  const handleSelectSection = async (section: DocumentFilter | 'notes') => {
    if (editorRef.current) {
      await editorRef.current.flushPendingSave();
    }
    setOpenDocId(null);
    setActiveDocument(null);
    setActiveSection(section);
  };

  const handleCreateDocument = async () => {
    if (!session) return;
    setCreating(true);
    try {
      const doc = await createDocument(session.token, {
        title: 'Untitled Document',
        contentHtml: '<p></p>',
      });
      setDocuments((prev) => [doc, ...prev]);
      setActiveSection('all');
      setOpenDocId(doc.id);
      setActiveDocument(doc);
    } catch (err) {
      if (!handleUnauthorized(err)) {
        showToast(
          err instanceof Error ? err.message : 'Could not create document.',
          'error'
        );
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRenameDocument = async (docId: string, nextTitle: string) => {
    if (!session) return;
    try {
      const updated = await updateDocument(session.token, docId, {
        title: nextTitle,
      });
      setDocuments((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d))
      );
      if (activeDocument?.id === updated.id) {
        setActiveDocument(updated);
      }
      showToast('Document renamed');
    } catch (err) {
      handleUnauthorized(err);
      throw err;
    }
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
    if (!deleteTarget || !session) return;
    setDeleting(true);
    try {
      await deleteDocument(session.token, deleteTarget.id);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      if (openDocId === deleteTarget.id) {
        setOpenDocId(null);
        setActiveDocument(null);
      }
      showToast(`Deleted "${deleteTarget.title}"`);
      setDeleteTarget(null);
    } catch (err) {
      if (!handleUnauthorized(err)) {
        showToast(
          err instanceof Error ? err.message : 'Could not delete document.',
          'error'
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  if (!session) {
    return (
      <>
        <DemoLoginView
          accounts={demoAccounts}
          loading={loadingAccounts}
          signingInId={signingInId}
          error={authError}
          onSignIn={handleSignIn}
        />
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
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        users={users.length > 0 ? users : demoAccounts}
        activeUser={session.user}
        onSwitchUser={handleSwitchUser}
        onSignOut={handleSignOut}
        switchingUser={switchingUser}
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
            ref={editorRef}
            document={activeDocument}
            authToken={session.token}
            activeUserId={session.user.id}
            onBack={() => {
              setOpenDocId(null);
              setActiveDocument(null);
              void loadWorkspace(session.token);
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

      {importOpen && (
        <ImportModal
          authToken={session.token}
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

      {shareTarget && (
        <ShareModal
          document={shareTarget}
          users={users.length > 0 ? users : demoAccounts}
          authToken={session.token}
          activeUserId={session.user.id}
          onClose={() => setShareTarget(null)}
          onUpdated={handleDocumentUpdated}
        />
      )}

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
