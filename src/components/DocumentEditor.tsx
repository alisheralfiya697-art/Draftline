import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlertCircle,
  ArrowLeft,
  Bold,
  Check,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Lock,
  Redo2,
  RemoveFormatting,
  Save,
  Share2,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { updateDocument } from '../api/client';
import type { DocumentDTO } from '../types/document';

export interface DocumentEditorHandle {
  flushPendingSave: () => Promise<boolean>;
}

interface DocumentEditorProps {
  ref?: Ref<DocumentEditorHandle>;
  document: DocumentDTO;
  authToken: string;
  activeUserId: string;
  onBack: () => void;
  onUpdated: (updated: DocumentDTO) => void;
  onOpenShare: (doc: DocumentDTO) => void;
  onDeleteRequest: (doc: DocumentDTO) => void;
}

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export function DocumentEditor({
  ref,
  document,
  authToken,
  activeUserId,
  onBack,
  onUpdated,
  onOpenShare,
  onDeleteRequest,
}: DocumentEditorProps) {
  const canEdit = document.isOwner || document.accessRole === 'editor';

  const [title, setTitle] = useState(document.title);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(document.wordCount);

  // Refs prevent stale closures and serialize concurrent/overlapping saves
  const docIdRef = useRef(document.id);
  const authTokenRef = useRef(authToken);
  const activeUserIdRef = useRef(activeUserId);
  const canEditRef = useRef(canEdit);
  const latestTitleRef = useRef(document.title);
  const latestHtmlRef = useRef(document.contentHtml);
  const lastSavedTitleRef = useRef(document.title);
  const lastSavedHtmlRef = useRef(document.contentHtml);
  const debounceTimerRef = useRef<number | null>(null);
  const inFlightSaveRef = useRef<Promise<boolean> | null>(null);
  const mountedRef = useRef(true);

  authTokenRef.current = authToken;
  activeUserIdRef.current = activeUserId;
  canEditRef.current = canEdit;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const computeWords = (text: string): number => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  };

  const runSerializedSave = useCallback(async (): Promise<boolean> => {
    if (!canEditRef.current) return true;

    // If a save is already running, wait for it and then evaluate remaining dirty state
    if (inFlightSaveRef.current) {
      await inFlightSaveRef.current;
    }

    const targetDocId = docIdRef.current;
    const targetToken = authTokenRef.current;
    const targetUserId = activeUserIdRef.current;
    const nextTitleRaw = latestTitleRef.current;
    const nextHtml = latestHtmlRef.current;
    const trimmedTitle = nextTitleRaw.trim();

    if (!trimmedTitle) {
      if (mountedRef.current) {
        setTitleError('Document title cannot be empty.');
        setSaveStatus('error');
      }
      return false;
    }

    const titleChanged = trimmedTitle !== lastSavedTitleRef.current;
    const htmlChanged = nextHtml !== lastSavedHtmlRef.current;

    if (!titleChanged && !htmlChanged) {
      if (mountedRef.current) {
        setTitleError(null);
        setSaveError(null);
        setSaveStatus('saved');
      }
      return true;
    }

    if (mountedRef.current) {
      setSaveStatus('saving');
      setSaveError(null);
      setTitleError(null);
    }

    let savePromise: Promise<boolean> | null = null;
    savePromise = (async (): Promise<boolean> => {
      try {
        const payload: { title?: string; contentHtml?: string } = {};
        if (titleChanged) payload.title = trimmedTitle;
        if (htmlChanged) payload.contentHtml = nextHtml;

        const updated = await updateDocument(targetToken, targetDocId, payload);

        // Ignore response if user already switched documents or accounts while saving
        if (
          !mountedRef.current ||
          docIdRef.current !== targetDocId ||
          activeUserIdRef.current !== targetUserId
        ) {
          onUpdated(updated);
          return true;
        }

        lastSavedTitleRef.current = updated.title;
        lastSavedHtmlRef.current = updated.contentHtml;
        setWordCount(updated.wordCount);
        onUpdated(updated);

        // Only mark 'saved' if no newer local edits occurred while request was in flight
        const stillDirtyTitle =
          latestTitleRef.current.trim() !== updated.title;
        const stillDirtyHtml = latestHtmlRef.current !== nextHtml;

        if (stillDirtyTitle || stillDirtyHtml) {
          setSaveStatus('unsaved');
          if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = window.setTimeout(() => {
            void runSerializedSave();
          }, 400);
          return false;
        }

        setTitle(updated.title);
        latestTitleRef.current = updated.title;
        setSaveStatus('saved');
        return true;
      } catch (err) {
        if (mountedRef.current && docIdRef.current === targetDocId) {
          setSaveStatus('error');
          setSaveError(
            err instanceof Error ? err.message : 'Failed to save changes.'
          );
        }
        return false;
      } finally {
        if (inFlightSaveRef.current === savePromise) {
          inFlightSaveRef.current = null;
        }
      }
    })();

    inFlightSaveRef.current = savePromise;
    return savePromise;
  }, [onUpdated]);

  const scheduleAutosave = useCallback(() => {
    if (!canEditRef.current) return;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      void runSerializedSave();
    }, 1200);
  }, [runSerializedSave]);

  const flushPendingSave = useCallback(async (): Promise<boolean> => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    return runSerializedSave();
  }, [runSerializedSave]);

  useImperativeHandle(
    ref,
    () => ({
      flushPendingSave,
    }),
    [flushPendingSave]
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          link: false,
        }),
        Placeholder.configure({
          placeholder: 'Start writing your document...',
        }),
      ],
      content: document.contentHtml,
      editable: canEdit,
      onUpdate: ({ editor: ed }) => {
        const html = ed.getHTML();
        latestHtmlRef.current = html;
        setWordCount(computeWords(ed.getText()));
        if (html !== lastSavedHtmlRef.current) {
          setSaveStatus('unsaved');
          scheduleAutosave();
        }
      },
    },
    [document.id, canEdit, activeUserId]
  );

  // Reset editor local baseline ONLY when switching documents, user sessions, or editability
  useEffect(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    docIdRef.current = document.id;
    setTitle(document.title);
    latestTitleRef.current = document.title;
    latestHtmlRef.current = document.contentHtml;
    lastSavedTitleRef.current = document.title;
    lastSavedHtmlRef.current = document.contentHtml;
    setWordCount(document.wordCount);
    setTitleError(null);
    setSaveError(null);
    setSaveStatus('saved');
  }, [document.id, activeUserId, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd/Ctrl + S shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (canEditRef.current) {
          void flushPendingSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flushPendingSave]);

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    latestTitleRef.current = nextTitle;
    if (!nextTitle.trim()) {
      setTitleError('Document title cannot be empty.');
      setSaveStatus('error');
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      return;
    }
    setTitleError(null);
    if (nextTitle.trim() !== lastSavedTitleRef.current) {
      setSaveStatus('unsaved');
      scheduleAutosave();
    } else if (latestHtmlRef.current === lastSavedHtmlRef.current) {
      setSaveStatus('saved');
    }
  };

  const handleTitleBlur = () => {
    if (!canEditRef.current) return;
    if (!latestTitleRef.current.trim()) {
      setTitleError('Document title cannot be empty.');
      setSaveStatus('error');
      return;
    }
    if (latestTitleRef.current.trim() !== lastSavedTitleRef.current) {
      void flushPendingSave();
    }
  };

  const handleBack = async () => {
    await flushPendingSave();
    onBack();
  };

  const roleLabel = document.isOwner
    ? 'Owner'
    : document.accessRole === 'editor'
    ? 'Editor'
    : 'Viewer';

  const toolbarBtnClass = (active = false) =>
    `h-8 px-2.5 rounded-md inline-flex items-center justify-center gap-1.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
      active
        ? 'bg-blue-50 text-blue-700 border border-blue-200'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
    }`;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slate-50 flex flex-col">
      {/* Document Title & Action Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleBack}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Documents</span>
            </button>

            <div className="min-w-0 flex-1 max-w-xl">
              {canEdit ? (
                <div>
                  <input
                    type="text"
                    value={title}
                    maxLength={160}
                    aria-label="Document title"
                    onChange={(e) => handleTitleChange(e.target.value)}
                    onBlur={handleTitleBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    className={`w-full font-display text-base sm:text-lg font-semibold text-slate-900 bg-transparent px-2 py-1 -ml-2 rounded-md border transition-colors focus:outline-none ${
                      titleError
                        ? 'border-red-400 bg-red-50/40 focus:ring-2 focus:ring-red-500'
                        : 'border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white'
                    }`}
                  />
                  {titleError && (
                    <p className="text-xs text-red-600 mt-0.5">{titleError}</p>
                  )}
                </div>
              ) : (
                <h1 className="font-display text-base sm:text-lg font-semibold text-slate-900 truncate">
                  {document.title}
                </h1>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] font-medium ${
                    document.isOwner
                      ? 'border-slate-300 bg-slate-100 text-slate-800'
                      : document.accessRole === 'editor'
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  {roleLabel}
                </span>
                <span className="truncate">
                  {document.isOwner
                    ? 'Owned by you'
                    : `Shared by ${document.owner.name}`}
                  {document.sourceFormat !== 'native' &&
                    ` · Imported .${document.sourceFormat}`}
                </span>
              </div>
            </div>
          </div>

          {/* Right Controls: Save State, Save, Share, Delete */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canEdit && (
              <>
                <span
                  aria-live="polite"
                  className="text-xs text-slate-500 mr-1 inline-flex items-center gap-1 whitespace-nowrap tabular-nums"
                >
                  {saveStatus === 'saving' && 'Saving...'}
                  {saveStatus === 'unsaved' && 'Unsaved changes'}
                  {saveStatus === 'saved' && (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Saved</span>
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <span className="text-red-600 font-medium">Save failed</span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => void flushPendingSave()}
                  disabled={
                    saveStatus === 'saving' ||
                    (saveStatus === 'saved' && !titleError)
                  }
                  className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => onOpenShare(document)}
              className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-medium text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer tabular-nums"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>
                {document.isOwner
                  ? document.sharedWith.length > 0
                    ? `Share (${document.sharedWith.length})`
                    : 'Share'
                  : `Access (${document.sharedWith.length + 1})`}
              </span>
            </button>

            {document.isOwner && (
              <button
                type="button"
                onClick={() => onDeleteRequest(document)}
                aria-label="Delete document"
                title="Delete document"
                className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Rich-Text Formatting Toolbar */}
        <div className="border-t border-slate-100 bg-slate-50/70">
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
            <div
              role="toolbar"
              aria-label="Formatting options"
              className="flex flex-wrap items-center gap-1"
            >
              <button
                type="button"
                disabled={!canEdit || !editor?.can().undo()}
                onClick={() => editor?.chain().focus().undo().run()}
                aria-label="Undo"
                title="Undo"
                className={toolbarBtnClass()}
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!canEdit || !editor?.can().redo()}
                onClick={() => editor?.chain().focus().redo().run()}
                aria-label="Redo"
                title="Redo"
                className={toolbarBtnClass()}
              >
                <Redo2 className="w-4 h-4" />
              </button>

              <span
                aria-hidden="true"
                className="w-px h-5 bg-slate-200 mx-1"
              />

              <button
                type="button"
                disabled={!canEdit}
                onClick={() => editor?.chain().focus().setParagraph().run()}
                aria-pressed={editor?.isActive('paragraph')}
                className={toolbarBtnClass(editor?.isActive('paragraph'))}
              >
                Normal
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 1 }).run()
                }
                aria-label="Heading 1"
                aria-pressed={editor?.isActive('heading', { level: 1 })}
                className={toolbarBtnClass(
                  editor?.isActive('heading', { level: 1 })
                )}
              >
                <Heading1 className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 2 }).run()
                }
                aria-label="Heading 2"
                aria-pressed={editor?.isActive('heading', { level: 2 })}
                className={toolbarBtnClass(
                  editor?.isActive('heading', { level: 2 })
                )}
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() =>
                  editor?.chain().focus().toggleHeading({ level: 3 }).run()
                }
                aria-label="Heading 3"
                aria-pressed={editor?.isActive('heading', { level: 3 })}
                className={toolbarBtnClass(
                  editor?.isActive('heading', { level: 3 })
                )}
              >
                <Heading3 className="w-4 h-4" />
              </button>

              <span
                aria-hidden="true"
                className="w-px h-5 bg-slate-200 mx-1"
              />

              <button
                type="button"
                disabled={!canEdit}
                onClick={() => editor?.chain().focus().toggleBold().run()}
                aria-label="Bold"
                title="Bold (Ctrl+B)"
                aria-pressed={editor?.isActive('bold')}
                className={toolbarBtnClass(editor?.isActive('bold'))}
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                aria-label="Italic"
                title="Italic (Ctrl+I)"
                aria-pressed={editor?.isActive('italic')}
                className={toolbarBtnClass(editor?.isActive('italic'))}
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                aria-label="Underline"
                title="Underline (Ctrl+U)"
                aria-pressed={editor?.isActive('underline')}
                className={toolbarBtnClass(editor?.isActive('underline'))}
              >
                <UnderlineIcon className="w-4 h-4" />
              </button>

              <span
                aria-hidden="true"
                className="w-px h-5 bg-slate-200 mx-1"
              />

              <button
                type="button"
                disabled={!canEdit}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                aria-label="Bullet list"
                title="Bullet list"
                aria-pressed={editor?.isActive('bulletList')}
                className={toolbarBtnClass(editor?.isActive('bulletList'))}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() =>
                  editor?.chain().focus().toggleOrderedList().run()
                }
                aria-label="Numbered list"
                title="Numbered list"
                aria-pressed={editor?.isActive('orderedList')}
                className={toolbarBtnClass(editor?.isActive('orderedList'))}
              >
                <ListOrdered className="w-4 h-4" />
              </button>

              <span
                aria-hidden="true"
                className="w-px h-5 bg-slate-200 mx-1"
              />

              <button
                type="button"
                disabled={!canEdit}
                onClick={() =>
                  editor?.chain().focus().unsetAllMarks().clearNodes().run()
                }
                aria-label="Clear formatting"
                title="Clear formatting"
                className={toolbarBtnClass()}
              >
                <RemoveFormatting className="w-4 h-4" />
              </button>
            </div>

            <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
          </div>
        </div>
      </div>

      {/* Editor Canvas */}
      <div className="flex-1 py-8 px-4 sm:px-6">
        <div className="max-w-[816px] mx-auto space-y-4">
          {saveError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {!canEdit && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-600">
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                You have view-only access to this document. Contact{' '}
                <strong className="font-medium text-slate-900">
                  {document.owner.name}
                </strong>{' '}
                to request editing permissions.
              </span>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs px-6 sm:px-14 py-8 sm:py-12 min-h-[820px]">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}
