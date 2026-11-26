import { AlertCircle, FileText, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { importDocumentFile } from '../api/client';
import type { DocumentDTO } from '../types/document';

interface ImportModalProps {
  authToken: string;
  onClose: () => void;
  onImported: (document: DocumentDTO) => void;
}

const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.docx'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function ImportModal({
  authToken,
  onClose,
  onImported,
}: ImportModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    const lowerName = file.name.toLowerCase();
    const hasValidExt = ACCEPTED_EXTENSIONS.some((ext) =>
      lowerName.endsWith(ext)
    );
    if (!hasValidExt) {
      return 'Unsupported file type. Please choose a .txt, .md, or .docx file.';
    }
    if (file.size === 0) {
      return 'The selected file is empty.';
    }
    if (file.size > MAX_SIZE_BYTES) {
      return 'File exceeds the 5 MB upload limit.';
    }
    return null;
  };

  const handleSelectFile = (file: File | undefined) => {
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
    if (!customTitle.trim()) {
      const stripped = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
      setCustomTitle(stripped);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Choose a .txt, .md, or .docx file to import.');
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const doc = await importDocumentFile(
        authToken,
        selectedFile,
        customTitle
      );
      onImported(doc);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to import the selected file.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2
              id="import-modal-title"
              className="font-display text-base font-semibold text-slate-900"
            >
              Import Document
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Convert a .txt, .md, or .docx file (up to 5 MB) into an editable document.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import dialog"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleSelectFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            className={`border border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              dragging
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.md,.docx"
              className="hidden"
              onChange={(e) => handleSelectFile(e.target.files?.[0])}
            />
            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <FileText className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-900">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {(selectedFile.size / 1024).toFixed(1)} KB · Click to choose a different file
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-900">
                  Drop a file here or click to browse
                </p>
                <p className="text-xs text-slate-500">
                  Supports Plain Text (.txt), Markdown (.md), and Word (.docx)
                </p>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="import-doc-title"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Document title
            </label>
            <input
              id="import-doc-title"
              type="text"
              maxLength={160}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Derived from file name"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              {uploading ? 'Importing...' : 'Import & Open'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
