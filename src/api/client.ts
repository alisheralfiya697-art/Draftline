import type {
  DocumentDTO,
  SeededUser,
  SharePermission,
} from '../types/document';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) {
      throw new ApiError(`Request failed with status ${res.status}.`, res.status);
    }
    return undefined as T;
  }

  if (!res.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed with status ${res.status}.`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export async function fetchUsers(): Promise<SeededUser[]> {
  const res = await fetch('/api/users');
  const data = await parseResponse<{ users: SeededUser[] }>(res);
  return data.users;
}

export async function fetchDocuments(userId: string): Promise<DocumentDTO[]> {
  const res = await fetch('/api/documents', {
    headers: { 'X-User-Id': userId },
  });
  const data = await parseResponse<{ documents: DocumentDTO[] }>(res);
  return data.documents;
}

export async function fetchDocument(
  userId: string,
  docId: string
): Promise<DocumentDTO> {
  const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
    headers: { 'X-User-Id': userId },
  });
  const data = await parseResponse<{ document: DocumentDTO }>(res);
  return data.document;
}

export async function createDocument(
  userId: string,
  payload?: { title?: string; contentHtml?: string }
): Promise<DocumentDTO> {
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify(payload ?? {}),
  });
  const data = await parseResponse<{ document: DocumentDTO }>(res);
  return data.document;
}

export async function updateDocument(
  userId: string,
  docId: string,
  payload: { title?: string; contentHtml?: string }
): Promise<DocumentDTO> {
  const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify(payload),
  });
  const data = await parseResponse<{ document: DocumentDTO }>(res);
  return data.document;
}

export async function deleteDocument(
  userId: string,
  docId: string
): Promise<void> {
  const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    headers: { 'X-User-Id': userId },
  });
  await parseResponse<void>(res);
}

export async function importDocumentFile(
  userId: string,
  file: File,
  customTitle?: string
): Promise<DocumentDTO> {
  const formData = new FormData();
  formData.append('file', file);
  if (customTitle && customTitle.trim()) {
    formData.append('title', customTitle.trim());
  }

  const res = await fetch('/api/documents/import', {
    method: 'POST',
    headers: { 'X-User-Id': userId },
    body: formData,
  });
  const data = await parseResponse<{ document: DocumentDTO }>(res);
  return data.document;
}

export async function grantDocumentShare(
  userId: string,
  docId: string,
  targetUserId: string,
  permission: SharePermission
): Promise<DocumentDTO> {
  const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/shares`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify({ userId: targetUserId, permission }),
  });
  const data = await parseResponse<{ document: DocumentDTO }>(res);
  return data.document;
}

export async function revokeDocumentShare(
  userId: string,
  docId: string,
  targetUserId: string
): Promise<DocumentDTO> {
  const res = await fetch(
    `/api/documents/${encodeURIComponent(docId)}/shares/${encodeURIComponent(targetUserId)}`,
    {
      method: 'DELETE',
      headers: { 'X-User-Id': userId },
    }
  );
  const data = await parseResponse<{ document: DocumentDTO }>(res);
  return data.document;
}
