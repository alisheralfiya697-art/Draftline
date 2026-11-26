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
import { useCallback, useEffect, useRef, useState } from 'react';
import { updateDocument } from '../api/client';
import type { DocumentDTO } from '../types/document';

interface DocumentEditorProps {
  document: DocumentDTO;
  activeUserId: string;
  onBack: () => void;
  onUpdated: (updated: DocumentDTO) => void;
  onOpenShare: (doc: DocumentDTO) => void;
  onDeleteRequest: (doc: DocumentDTO) => void;
}

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export function DocumentEditor({
  document,
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

  const lastSavedHtmlRef = useRef(document.contentHtml);
  const lastSavedTitleRef = useRef(document.title);
  const debounceTimerRef = useRef<number | null>(null);
  const docIdRef = useRef(document.id);

  const computeWords = (text: string): number => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  };

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
        setWordCount(computeWords(ed.getText()));
        if (html !== lastSavedHtmlRef.current) {
          setSaveStatus('unsaved');
          if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = window.setTimeout(() => {
            void persistChanges(title, html);
          }, 1200);
        }
      },
    },
    [document.id, canEdit]
  );

  const persistChanges = useCallback(
    async (nextTitle: string, nextHtml: string) => {
      if (!canEdit) return;
      const trimmedTitle = nextTitle.trim();
      if (!trimmedTitle) {
        setTitleError('Document title cannot be empty.');
        setSaveStatus('error');
        return;
      }

      const titleChanged = trimmedTitle !== lastSavedTitleRef.current;
      const htmlChanged = nextHtml !== lastSavedHtmlRef.current;
      if (!titleChanged && !htmlChanged) {
        setSaveStatus('saved');
        return;
      }

      setSaveStatus('saving');
      setSaveError(null);
      setTitleError(null);

      try {
        const payload: { title?: string; contentHtml?: string } = {};
        if (titleChanged) payload.title = trimmedTitle;
        if (htmlChanged) payload.contentHtml = nextHtml;

        const updated = await updateDocument(
          activeUserId,
          docIdRef.current,
          payload
        );
        lastSavedTitleRef.current = updated.title;
        lastSavedHtmlRef.current = updated.contentHtml;
        setTitle(updated.title);
        setWordCount(updated.wordCount);
        setSaveStatus('saved');
        onUpdated(updated);
      } catch (err) {
        setSaveStatus('error');
        setSaveError(
          err instanceof Error ? err.message : 'Failed to save changes.'
        );
      }
    },
    [activeUserId, canEdit, onUpdated]
  );

  // Sync when switching documents or external metadata changes (e.g. share modal)
  useEffect(() => {
    docIdRef.current = document.id;
    setTitle(document.title);
    setWordCount(document.wordCount);
    setTitleError(null);
    setSaveError(null);
    lastSavedTitleRef.current = document.title;
    lastSavedHtmlRef.current = document.contentHtml;
    setSaveStatus('saved');
  }, [document.id, document.title, document.contentHtml, document.wordCount]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Cmd/Ctrl + S shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (canEdit && editor) {
          if (debounceTimerRef.current) {
            window.clearTimeout(debounceTimerRef.current);
          }
          void persistChanges(title, editor.getHTML());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canEdit, editor, persistChanges, title]);

  const handleTitleBlur = () => {
    if (!canEdit || !editor) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('Document title cannot be empty.');
      return;
    }
    if (trimmed !== lastSavedTitleRef.current) {
      void persistChanges(trimmed, editor.getHTML());
    }
  };

  const handleManualSave = () => {
    if (!canEdit || !editor) return;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    void persistChanges(title, editor.getHTML());
  };

  const handleBack = async () => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    if (canEdit && editor && saveStatus === 'unsaved' && title.trim()) {
      await persistChanges(title, editor.getHTML());
    }
    onBack();
  };

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
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (e.target.value.trim()) setTitleError(null);
                      setSaveStatus('unsaved');
                    }}
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

              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {document.isOwner
                  ? 'Owned by you'
                  : `Shared by ${document.owner.name} · ${
                      document.accessRole === 'editor' ? 'Can edit' : 'View only'
                    }`}
                {document.sourceFormat !== 'native' &&
                  ` · Imported .${document.sourceFormat}`}
              </p>
            </div>
          </div>

          {/* Right Controls: Save State, Save, Share, Delete */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canEdit && (
              <>
                <span className="text-xs text-slate-500 mr-1 inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
                  {saveStatus === 'saving' && 'Saving...'}
                  {saveStatus === 'unsaved' && 'Unsaved changes'}
                  {saveStatus === 'saved' && (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Saved</span>
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <span className="text-red-600">Save failed</span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={handleManualSave}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved'}
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

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs px-8 sm:px-14 py-10 sm:py-12 min-h-[820px]">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}
