import { AlertCircle, Trash2, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { grantDocumentShare, revokeDocumentShare } from '../api/client';
import type {
  DocumentDTO,
  SeededUser,
  SharePermission,
} from '../types/document';

interface ShareModalProps {
  document: DocumentDTO;
  users: SeededUser[];
  authToken: string;
  activeUserId: string;
  onClose: () => void;
  onUpdated: (updated: DocumentDTO) => void;
}

export function ShareModal({
  document,
  users,
  authToken,
  activeUserId,
  onClose,
  onUpdated,
}: ShareModalProps) {
  const sharedIds = new Set(document.sharedWith.map((s) => s.userId));
  const availableUsers = users.filter(
    (u) => u.id !== document.ownerId && !sharedIds.has(u.id)
  );

  const [selectedUserId, setSelectedUserId] = useState<string>(
    availableUsers[0]?.id ?? ''
  );
  const [permission, setPermission] = useState<SharePermission>('editor');
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentCandidateId =
    availableUsers.some((u) => u.id === selectedUserId)
      ? selectedUserId
      : availableUsers[0]?.id ?? '';

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCandidateId) {
      setError('Select a team member to share with.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const updated = await grantDocumentShare(
        authToken,
        document.id,
        currentCandidateId,
        permission
      );
      onUpdated(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update sharing settings.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (
    targetUserId: string,
    nextPermission: SharePermission
  ) => {
    setError(null);
    setBusyUserId(targetUserId);
    try {
      const updated = await grantDocumentShare(
        authToken,
        document.id,
        targetUserId,
        nextPermission
      );
      onUpdated(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update permission.'
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRevoke = async (targetUserId: string) => {
    setError(null);
    setBusyUserId(targetUserId);
    try {
      const updated = await revokeDocumentShare(
        authToken,
        document.id,
        targetUserId
      );
      onUpdated(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to remove collaborator.'
      );
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="share-modal-title"
              className="font-display text-base font-semibold text-slate-900 truncate"
            >
              Share &ldquo;{document.title}&rdquo;
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {document.isOwner
                ? 'Grant seeded team members editor or viewer access.'
                : `Owned by ${document.owner.name}. Only the owner can change access.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {document.isOwner && (
            <form onSubmit={handleGrant} className="space-y-3">
              <label className="block text-xs font-medium text-slate-700">
                Add team member
              </label>
              {availableUsers.length > 0 ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    aria-label="Select team member"
                    value={currentCandidateId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Select permission level"
                    value={permission}
                    onChange={(e) =>
                      setPermission(e.target.value as SharePermission)
                    }
                    className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{submitting ? 'Sharing...' : 'Share'}</span>
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  All seeded team members already have access to this document.
                </p>
              )}
            </form>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-medium text-slate-500">
              People with access
            </h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {/* Owner row */}
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-md bg-slate-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    {document.owner.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {document.owner.name}
                      {document.isOwner ? ' (you)' : ''}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {document.owner.email}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-600 shrink-0">
                  Owner
                </span>
              </div>

              {document.sharedWith.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500">
                  Not shared with anyone yet.
                </div>
              ) : (
                document.sharedWith.map((share) => {
                  const isBusy = busyUserId === share.userId;
                  return (
                    <div
                      key={share.userId}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center shrink-0">
                          {share.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {share.name}
                            {share.userId === activeUserId ? ' (you)' : ''}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {share.email}
                          </p>
                        </div>
                      </div>

                      {document.isOwner ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            aria-label={`Permission for ${share.name}`}
                            value={share.permission}
                            disabled={isBusy}
                            onChange={(e) =>
                              handleRoleChange(
                                share.userId,
                                e.target.value as SharePermission
                              )
                            }
                            className="h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            <option value="editor">Can edit</option>
                            <option value="viewer">Can view</option>
                          </select>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRevoke(share.userId)}
                            aria-label={`Remove ${share.name}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600 shrink-0">
                          {share.permission === 'editor'
                            ? 'Can edit'
                            : 'Can view'}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
