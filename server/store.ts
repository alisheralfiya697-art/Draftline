import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  DocumentDTO,
  DocumentRecord,
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

interface DocumentRow {
  id: string;
  title: string;
  content_html: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  last_edited_by_id: string;
  source_format: 'native' | 'txt' | 'md' | 'docx';
}

interface ShareRow {
  document_id: string;
  user_id: string;
  permission: SharePermission;
  granted_at: string;
}

export function resolveDataDir(): string {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.resolve(process.cwd(), 'data');
}

export class DocumentStore {
  private readonly db: DatabaseSync;
  private readonly usersMap: Map<string, SeededUser>;

  constructor(dbPath = path.join(resolveDataDir(), 'draftline.db')) {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.usersMap = new Map(SEEDED_USERS.map((u) => [u.id, u]));
    this.db = new DatabaseSync(dbPath, {
      enableForeignKeyConstraints: true,
      timeout: 5000,
    });

    this.configureDatabase();
    this.initializeSchema();
    this.seedIfEmpty(dbPath);
  }

  private configureDatabase(): void {
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    const check = this.db.prepare('PRAGMA quick_check;').get() as
      | { quick_check: string }
      | undefined;
    if (check && check.quick_check !== 'ok') {
      throw new Error(
        `SQLite database integrity check failed: ${check.quick_check}`
      );
    }
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content_html TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_edited_by_id TEXT NOT NULL,
        source_format TEXT NOT NULL DEFAULT 'native'
      ) STRICT;

      CREATE TABLE IF NOT EXISTS document_shares (
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        permission TEXT NOT NULL CHECK (permission IN ('editor', 'viewer')),
        granted_at TEXT NOT NULL,
        PRIMARY KEY (document_id, user_id)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
      CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_shares_user ON document_shares(user_id);
    `);
  }

  private runInTransaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // Ignore rollback errors if transaction already closed
      }
      throw err;
    }
  }

  private seedIfEmpty(dbPath: string): void {
    const countRow = this.db
      .prepare('SELECT COUNT(*) AS total FROM documents')
      .get() as { total: number };

    if (countRow.total > 0) {
      return;
    }

    // If a legacy JSON file exists alongside the DB, migrate it safely without silent data loss
    let recordsToSeed: DocumentRecord[] | null = null;
    if (dbPath !== ':memory:') {
      const legacyJsonPath = path.join(path.dirname(dbPath), 'documents.json');
      if (fs.existsSync(legacyJsonPath)) {
        const raw = fs.readFileSync(legacyJsonPath, 'utf8');
        let parsed: { documents?: unknown };
        try {
          parsed = JSON.parse(raw) as { documents?: unknown };
        } catch (err) {
          throw new Error(
            `Refusing to overwrite corrupted legacy storage file at ${legacyJsonPath}: ${(err as Error).message}`
          );
        }
        if (!Array.isArray(parsed.documents)) {
          throw new Error(
            `Legacy storage file ${legacyJsonPath} is invalid (missing documents array).`
          );
        }
        recordsToSeed = parsed.documents.filter(
          (item): item is DocumentRecord =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as DocumentRecord).id === 'string' &&
            typeof (item as DocumentRecord).title === 'string' &&
            typeof (item as DocumentRecord).ownerId === 'string'
        );
      }
    }

    const records = recordsToSeed ?? createInitialDocuments();

    this.runInTransaction(() => {
      const insertDoc = this.db.prepare(`
        INSERT INTO documents (
          id, title, content_html, owner_id, created_at, updated_at, last_edited_by_id, source_format
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertShare = this.db.prepare(`
        INSERT INTO document_shares (document_id, user_id, permission, granted_at)
        VALUES (?, ?, ?, ?)
      `);

      for (const doc of records) {
        insertDoc.run(
          doc.id,
          doc.title,
          sanitizeDocumentHtml(doc.contentHtml),
          doc.ownerId,
          doc.createdAt,
          doc.updatedAt,
          doc.lastEditedById ?? doc.ownerId,
          doc.sourceFormat ?? 'native'
        );

        for (const share of doc.sharedWith ?? []) {
          if (
            this.usersMap.has(share.userId) &&
            share.userId !== doc.ownerId &&
            (share.permission === 'editor' || share.permission === 'viewer')
          ) {
            insertShare.run(
              doc.id,
              share.userId,
              share.permission,
              share.grantedAt ?? doc.createdAt
            );
          }
        }
      }
    });
  }

  public close(): void {
    this.db.close();
  }

  public getUsers(): SeededUser[] {
    return SEEDED_USERS;
  }

  public getUserById(userId: string): SeededUser | undefined {
    return this.usersMap.get(userId);
  }

  private getSharesForDocuments(docIds: string[]): Map<string, ShareRow[]> {
    const map = new Map<string, ShareRow[]>();
    if (docIds.length === 0) return map;

    const placeholders = docIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT document_id, user_id, permission, granted_at
         FROM document_shares
         WHERE document_id IN (${placeholders})
         ORDER BY granted_at ASC`
      )
      .all(...docIds) as unknown as ShareRow[];

    for (const row of rows) {
      const list = map.get(row.document_id) ?? [];
      list.push(row);
      map.set(row.document_id, list);
    }
    return map;
  }

  private hydrate(
    doc: DocumentRow,
    shares: ShareRow[],
    currentUserId: string
  ): DocumentDTO {
    const owner = this.usersMap.get(doc.owner_id) ?? SEEDED_USERS[0];
    const lastEditedBy =
      this.usersMap.get(doc.last_edited_by_id) ?? owner;
    const isOwner = doc.owner_id === currentUserId;
    const shareEntry = shares.find((s) => s.user_id === currentUserId);
    const accessRole: 'owner' | SharePermission = isOwner
      ? 'owner'
      : shareEntry?.permission ?? 'viewer';

    const sharedWith = shares
      .map((s) => {
        const user = this.usersMap.get(s.user_id);
        if (!user) return null;
        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          initials: user.initials,
          permission: s.permission,
          grantedAt: s.granted_at,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return {
      id: doc.id,
      title: doc.title,
      contentHtml: doc.content_html,
      ownerId: doc.owner_id,
      owner,
      isOwner,
      accessRole,
      sharedWith,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
      lastEditedBy,
      sourceFormat: doc.source_format ?? 'native',
      wordCount: countWords(doc.content_html),
    };
  }

  private getAccessibleRow(
    docId: string,
    userId: string
  ): { doc: DocumentRow; shares: ShareRow[] } {
    const doc = this.db
      .prepare('SELECT * FROM documents WHERE id = ?')
      .get(docId) as unknown as DocumentRow | undefined;

    if (!doc) {
      throw new StoreError('Document not found.', 404);
    }

    const shares = this.db
      .prepare(
        `SELECT document_id, user_id, permission, granted_at
         FROM document_shares
         WHERE document_id = ?
         ORDER BY granted_at ASC`
      )
      .all(docId) as unknown as ShareRow[];

    const isOwner = doc.owner_id === userId;
    const isShared = shares.some((s) => s.user_id === userId);
    if (!isOwner && !isShared) {
      throw new StoreError('You do not have access to this document.', 403);
    }

    return { doc, shares };
  }

  public listForUser(userId: string): DocumentDTO[] {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT d.*
         FROM documents d
         LEFT JOIN document_shares s ON d.id = s.document_id
         WHERE d.owner_id = ? OR s.user_id = ?
         ORDER BY d.updated_at DESC`
      )
      .all(userId, userId) as unknown as DocumentRow[];

    const sharesByDoc = this.getSharesForDocuments(rows.map((r) => r.id));
    return rows.map((row) =>
      this.hydrate(row, sharesByDoc.get(row.id) ?? [], userId)
    );
  }

  public getForUser(docId: string, userId: string): DocumentDTO {
    const { doc, shares } = this.getAccessibleRow(docId, userId);
    return this.hydrate(doc, shares, userId);
  }

  public createDocument(params: {
    userId: string;
    title?: string;
    contentHtml?: string;
    sourceFormat?: 'native' | 'txt' | 'md' | 'docx';
  }): DocumentDTO {
    const rawTitle =
      typeof params.title === 'string'
        ? params.title.trim()
        : 'Untitled Document';
    const title = rawTitle || 'Untitled Document';
    if (title.length > 160) {
      throw new StoreError(
        'Document title must be 160 characters or fewer.',
        400
      );
    }

    const now = new Date().toISOString();
    const id = `doc-${crypto.randomUUID().slice(0, 8)}`;
    const sanitizedHtml = sanitizeDocumentHtml(params.contentHtml ?? '<p></p>');
    const sourceFormat = params.sourceFormat ?? 'native';

    this.runInTransaction(() => {
      this.db
        .prepare(
          `INSERT INTO documents (
            id, title, content_html, owner_id, created_at, updated_at, last_edited_by_id, source_format
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          title,
          sanitizedHtml,
          params.userId,
          now,
          now,
          params.userId,
          sourceFormat
        );
    });

    return this.getForUser(id, params.userId);
  }

  public updateDocument(params: {
    docId: string;
    userId: string;
    title?: string;
    contentHtml?: string;
  }): DocumentDTO {
    return this.runInTransaction(() => {
      const { doc } = this.getAccessibleRow(params.docId, params.userId);
      const isOwner = doc.owner_id === params.userId;
      const shareRow = this.db
        .prepare(
          'SELECT permission FROM document_shares WHERE document_id = ? AND user_id = ?'
        )
        .get(params.docId, params.userId) as
        | { permission: SharePermission }
        | undefined;

      const canEdit = isOwner || shareRow?.permission === 'editor';
      if (!canEdit) {
        throw new StoreError(
          'View-only access: you cannot edit or rename this document.',
          403
        );
      }

      let nextTitle = doc.title;
      if (params.title !== undefined) {
        if (typeof params.title !== 'string') {
          throw new StoreError('Document title must be text.', 400);
        }
        const trimmed = params.title.trim();
        if (!trimmed) {
          throw new StoreError('Document title cannot be empty.', 400);
        }
        if (trimmed.length > 160) {
          throw new StoreError(
            'Document title must be 160 characters or fewer.',
            400
          );
        }
        nextTitle = trimmed;
      }

      let nextHtml = doc.content_html;
      if (params.contentHtml !== undefined) {
        if (typeof params.contentHtml !== 'string') {
          throw new StoreError('Document content must be HTML text.', 400);
        }
        nextHtml = sanitizeDocumentHtml(params.contentHtml);
      }

      const now = new Date().toISOString();
      this.db
        .prepare(
          `UPDATE documents
           SET title = ?, content_html = ?, updated_at = ?, last_edited_by_id = ?
           WHERE id = ?`
        )
        .run(nextTitle, nextHtml, now, params.userId, params.docId);

      return this.getForUser(params.docId, params.userId);
    });
  }

  public deleteDocument(docId: string, userId: string): void {
    this.runInTransaction(() => {
      const { doc } = this.getAccessibleRow(docId, userId);
      if (doc.owner_id !== userId) {
        throw new StoreError(
          'Only the document owner can delete this document.',
          403
        );
      }
      this.db.prepare('DELETE FROM documents WHERE id = ?').run(docId);
    });
  }

  public grantShare(params: {
    docId: string;
    ownerId: string;
    targetUserId: string;
    permission: SharePermission;
  }): DocumentDTO {
    if (!this.usersMap.has(params.targetUserId)) {
      throw new StoreError('Selected user does not exist.', 400);
    }
    if (params.permission !== 'editor' && params.permission !== 'viewer') {
      throw new StoreError('Permission must be "editor" or "viewer".', 400);
    }

    return this.runInTransaction(() => {
      const { doc } = this.getAccessibleRow(params.docId, params.ownerId);
      if (doc.owner_id !== params.ownerId) {
        throw new StoreError(
          'Only the document owner can manage sharing settings.',
          403
        );
      }
      if (params.targetUserId === doc.owner_id) {
        throw new StoreError(
          'The document owner already has full access.',
          400
        );
      }

      const now = new Date().toISOString();
      this.db
        .prepare(
          `INSERT INTO document_shares (document_id, user_id, permission, granted_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(document_id, user_id)
           DO UPDATE SET permission = excluded.permission, granted_at = excluded.granted_at`
        )
        .run(params.docId, params.targetUserId, params.permission, now);

      this.db
        .prepare('UPDATE documents SET updated_at = ? WHERE id = ?')
        .run(now, params.docId);

      return this.getForUser(params.docId, params.ownerId);
    });
  }

  public revokeShare(params: {
    docId: string;
    ownerId: string;
    targetUserId: string;
  }): DocumentDTO {
    return this.runInTransaction(() => {
      const { doc } = this.getAccessibleRow(params.docId, params.ownerId);
      if (doc.owner_id !== params.ownerId) {
        throw new StoreError(
          'Only the document owner can revoke access.',
          403
        );
      }

      const res = this.db
        .prepare(
          'DELETE FROM document_shares WHERE document_id = ? AND user_id = ?'
        )
        .run(params.docId, params.targetUserId);

      if (res.changes === 0) {
        throw new StoreError(
          'That user does not currently have access to this document.',
          404
        );
      }

      const now = new Date().toISOString();
      this.db
        .prepare('UPDATE documents SET updated_at = ? WHERE id = ?')
        .run(now, params.docId);

      return this.getForUser(params.docId, params.ownerId);
    });
  }
}
