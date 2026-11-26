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

export interface DemoSession {
  token: string;
  user: SeededUser;
  expiresInSeconds: number;
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

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchDemoAccounts(): Promise<SeededUser[]> {
  const res = await fetch('/api/auth/demo-accounts');
  const data = await parseResponse<{ accounts: SeededUser[] }>(res);
  return data.accounts;
}

export async function loginDemoAccount(userId: string): Promise<DemoSession> {
  const res = await fetch('/api/auth/demo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return parseResponse<DemoSession>(res);
}

export async function logoutSession(token: string): Promise<void> {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: authHeaders(token),
  });
  await parseResponse<void>(res);
}

export async function fetchUsers(token: string): Promise<SeededUser[]> {
  const res = await fetch('/api/users', {
    headers: authHeaders(token),
  });
  const data = await parseResponse<{ users: SeededUser[] }>(res);
  return data.users;
}

export async function fetchDocuments(token: string): Promise<DocumentDTO[]> {
  const res = await fetch('/api/documents', {
    headers: authHeaders(token),
  });
  const data = await parseResponse<{ documents: DocumentDTO[] }>(res);
  return data.documents;
}

export async function fetchDocument(
  token: string,
  docId: string
): Promise<DocumentDTO> {
  const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
    headers: authHeaders(token),
  });
  const data = await parseResponse<{ document: DocumentDTO }>(res);
  return data.document;
}

export async function createDocument(
  token: string,
  payload?: { title?: string; contentHtml?: string }
): Promise<DocumentDTO> {
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify(payload ?? {}),
  });
  const data = await parseResponse<{ document: DocumentDTO }>(res);
  return data.document;
}

export async function updateDocument(
  token: string,
  docId: string,
  payload: { title?: string; contentHtml?: string }
): Promise<DocumentDTO> {
  const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
  const data = await parseResponse<{ document: DocumentDTO }>(res);
  return data.document;
}

export async function deleteDocument(
  token: string,
  docId: string
): Promise<void> {
  const res = await fetch(`/api/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await parseResponse<void>(res);
}

export async function importDocumentFile(
  token: string,
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
    headers: authHeaders(token),
    body: formData,
  });
  const data = await parseResponse<{ document: DocumentDTO }>(res);
  return data.document;
}

export async function grantDocumentShare(
  token: string,
  docId: string,
  targetUserId: string,
  permission: SharePermission
): Promise<DocumentDTO> {
  const res = await fetch(`/api/documents/${encodeURIComponent(docId)}/shares`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify({ userId: targetUserId, permission }),
  });
  const data = await parseResponse<{ document: DocumentDTO }>(res);
  return data.document;
}

export async function revokeDocumentShare(
  token: string,
  docId: string,
  targetUserId: string
): Promise<DocumentDTO> {
  const res = await fetch(
    `/api/documents/${encodeURIComponent(docId)}/shares/${encodeURIComponent(targetUserId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );
  const data = await parseResponse<{ document: DocumentDTO }>(res);
  return data.document;
}
