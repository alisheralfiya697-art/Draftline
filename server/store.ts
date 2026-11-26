import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  DocumentDTO,
  DocumentRecord,
  DocumentShare,
  SeededUser,
  SharePermission,
} from '../src/types/document.js';
import { countWords, sanitizeDocumentHtml } from './importer.js';
import { createInitialDocuments, SEEDED_USERS } from './seed.js';

export class StoreError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'StoreError';
    this.status = status;
  }
}

interface PersistedState {
  version: number;
  documents: DocumentRecord[];
}

export class DocumentStore {
  private readonly filePath: string;
  private readonly usersMap: Map<string, SeededUser>;
  private documents: DocumentRecord[] = [];

  constructor(filePath = path.resolve(process.cwd(), 'data', 'documents.json')) {
    this.filePath = filePath;
    this.usersMap = new Map(SEEDED_USERS.map((u) => [u.id, u]));
    this.loadOrSeed();
  }

  private loadOrSeed(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as PersistedState;
        if (Array.isArray(parsed.documents)) {
          this.documents = parsed.documents;
          return;
        }
      } catch {
        // Fall through to re-seed if file is unreadable
      }
    }

    this.documents = createInitialDocuments();
    this.persist();
  }

  private persist(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload: PersistedState = {
      version: 1,
      documents: this.documents,
    };
    const tmpPath = `${this.filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }

  public getUsers(): SeededUser[] {
    return SEEDED_USERS;
  }

  public getUserById(userId: string): SeededUser | undefined {
    return this.usersMap.get(userId);
  }

  private hydrate(doc: DocumentRecord, currentUserId: string): DocumentDTO {
    const owner = this.usersMap.get(doc.ownerId) ?? SEEDED_USERS[0];
    const lastEditedBy = this.usersMap.get(doc.lastEditedById) ?? owner;
    const isOwner = doc.ownerId === currentUserId;
    const shareEntry = doc.sharedWith.find((s) => s.userId === currentUserId);
    const accessRole: 'owner' | SharePermission = isOwner
      ? 'owner'
      : shareEntry?.permission ?? 'viewer';

    const sharedWith = doc.sharedWith
      .map((s) => {
        const user = this.usersMap.get(s.userId);
        if (!user) return null;
        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          initials: user.initials,
          permission: s.permission,
          grantedAt: s.grantedAt,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return {
      id: doc.id,
      title: doc.title,
      contentHtml: doc.contentHtml,
      ownerId: doc.ownerId,
      owner,
      isOwner,
      accessRole,
      sharedWith,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      lastEditedBy,
      sourceFormat: doc.sourceFormat ?? 'native',
      wordCount: countWords(doc.contentHtml),
    };
  }

  private getAccessibleRecord(docId: string, userId: string): DocumentRecord {
    const doc = this.documents.find((d) => d.id === docId);
    if (!doc) {
      throw new StoreError('Document not found.', 404);
    }
    const isOwner = doc.ownerId === userId;
    const isShared = doc.sharedWith.some((s) => s.userId === userId);
    if (!isOwner && !isShared) {
      throw new StoreError('You do not have access to this document.', 403);
    }
    return doc;
  }

  public listForUser(userId: string): DocumentDTO[] {
    return this.documents
      .filter(
        (doc) =>
          doc.ownerId === userId || doc.sharedWith.some((s) => s.userId === userId)
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((doc) => this.hydrate(doc, userId));
  }

  public getForUser(docId: string, userId: string): DocumentDTO {
    const doc = this.getAccessibleRecord(docId, userId);
    return this.hydrate(doc, userId);
  }

  public createDocument(params: {
    userId: string;
    title?: string;
    contentHtml?: string;
    sourceFormat?: 'native' | 'txt' | 'md' | 'docx';
  }): DocumentDTO {
    const rawTitle = typeof params.title === 'string' ? params.title.trim() : 'Untitled Document';
    const title = rawTitle || 'Untitled Document';
    if (title.length > 160) {
      throw new StoreError('Document title must be 160 characters or fewer.', 400);
    }

    const now = new Date().toISOString();
    const record: DocumentRecord = {
      id: `doc-${crypto.randomUUID().slice(0, 8)}`,
      title,
      contentHtml: sanitizeDocumentHtml(params.contentHtml ?? '<p></p>'),
      ownerId: params.userId,
      sharedWith: [],
      createdAt: now,
      updatedAt: now,
      lastEditedById: params.userId,
      sourceFormat: params.sourceFormat ?? 'native',
    };

    this.documents.unshift(record);
    this.persist();
    return this.hydrate(record, params.userId);
  }

  public updateDocument(params: {
    docId: string;
    userId: string;
    title?: string;
    contentHtml?: string;
  }): DocumentDTO {
    const doc = this.getAccessibleRecord(params.docId, params.userId);
    const isOwner = doc.ownerId === params.userId;
    const shareEntry = doc.sharedWith.find((s) => s.userId === params.userId);
    const canEdit = isOwner || shareEntry?.permission === 'editor';

    if (!canEdit) {
      throw new StoreError('View-only access: you cannot edit or rename this document.', 403);
    }

    if (params.title !== undefined) {
      if (typeof params.title !== 'string') {
        throw new StoreError('Document title must be text.', 400);
      }
      const trimmed = params.title.trim();
      if (!trimmed) {
        throw new StoreError('Document title cannot be empty.', 400);
      }
      if (trimmed.length > 160) {
        throw new StoreError('Document title must be 160 characters or fewer.', 400);
      }
      doc.title = trimmed;
    }

    if (params.contentHtml !== undefined) {
      if (typeof params.contentHtml !== 'string') {
        throw new StoreError('Document content must be HTML text.', 400);
      }
      doc.contentHtml = sanitizeDocumentHtml(params.contentHtml);
    }

    doc.updatedAt = new Date().toISOString();
    doc.lastEditedById = params.userId;
    this.persist();
    return this.hydrate(doc, params.userId);
  }

  public deleteDocument(docId: string, userId: string): void {
    const doc = this.getAccessibleRecord(docId, userId);
    if (doc.ownerId !== userId) {
      throw new StoreError('Only the document owner can delete this document.', 403);
    }
    this.documents = this.documents.filter((d) => d.id !== docId);
    this.persist();
  }

  public grantShare(params: {
    docId: string;
    ownerId: string;
    targetUserId: string;
    permission: SharePermission;
  }): DocumentDTO {
    const doc = this.getAccessibleRecord(params.docId, params.ownerId);
    if (doc.ownerId !== params.ownerId) {
      throw new StoreError('Only the document owner can manage sharing settings.', 403);
    }

    if (!this.usersMap.has(params.targetUserId)) {
      throw new StoreError('Selected user does not exist.', 400);
    }
    if (params.targetUserId === doc.ownerId) {
      throw new StoreError('The document owner already has full access.', 400);
    }
    if (params.permission !== 'editor' && params.permission !== 'viewer') {
      throw new StoreError('Permission must be "editor" or "viewer".', 400);
    }

    const existing = doc.sharedWith.find((s) => s.userId === params.targetUserId);
    const now = new Date().toISOString();
    if (existing) {
      existing.permission = params.permission;
      existing.grantedAt = now;
    } else {
      const share: DocumentShare = {
        userId: params.targetUserId,
        permission: params.permission,
        grantedAt: now,
      };
      doc.sharedWith.push(share);
    }

    doc.updatedAt = now;
    this.persist();
    return this.hydrate(doc, params.ownerId);
  }

  public revokeShare(params: {
    docId: string;
    ownerId: string;
    targetUserId: string;
  }): DocumentDTO {
    const doc = this.getAccessibleRecord(params.docId, params.ownerId);
    if (doc.ownerId !== params.ownerId) {
      throw new StoreError('Only the document owner can revoke access.', 403);
    }

    const beforeCount = doc.sharedWith.length;
    doc.sharedWith = doc.sharedWith.filter((s) => s.userId !== params.targetUserId);
    if (doc.sharedWith.length === beforeCount) {
      throw new StoreError('That user does not currently have access to this document.', 404);
    }

    doc.updatedAt = new Date().toISOString();
    this.persist();
    return this.hydrate(doc, params.ownerId);
  }
}
